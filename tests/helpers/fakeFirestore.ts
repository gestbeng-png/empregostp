import type { Firestore } from 'firebase-admin/firestore';

/**
 * Firestore em memória para testes unitários (sem emulador): documentos por
 * caminho, consultas por igualdade, `limit`, transações com get/set/update/
 * create e atualizações com chaves com ponto («ratings.uid»). Também apaga
 * documentos, subcoleções («users/u1/formDrafts»), `batch()`, `add()` e
 * filtra por campos aninhados («deletion.status»).
 */
type Data = Record<string, unknown>;

function setPath(target: Data, path: string, value: unknown) {
  const parts = path.split('.');
  let node = target;
  for (const part of parts.slice(0, -1)) {
    node[part] =
      node[part] && typeof node[part] === 'object'
        ? { ...(node[part] as Data) }
        : {};
    node = node[part] as Data;
  }
  node[parts[parts.length - 1] as string] = value;
}

export function createFakeFirestore(seed: Record<string, Data> = {}): {
  db: Firestore;
  docs: Map<string, Data>;
} {
  const docs = new Map<string, Data>(
    Object.entries(seed).map(([k, v]) => [k, { ...v }]),
  );
  let auto = 0;
  const apply = (op: string, path: string, data: Data) => {
    if (op === 'create' && docs.has(path))
      throw new Error(`ALREADY_EXISTS ${path}`);
    if (op === 'update') {
      if (!docs.has(path)) throw new Error(`NOT_FOUND ${path}`);
      const next = { ...docs.get(path) };
      for (const [key, value] of Object.entries(data))
        setPath(next, key, value);
      docs.set(path, next);
    } else docs.set(path, { ...data });
  };
  const snapshot = (path: string) => ({
    id: path.split('/').pop() ?? '',
    exists: docs.has(path),
    data: () => (docs.has(path) ? { ...docs.get(path) } : undefined),
    ref: docRef(path),
  });
  function docRef(path: string) {
    return {
      id: path.split('/').pop() ?? '',
      path,
      get: async () => snapshot(path),
      create: async (data: Data) => apply('create', path, data),
      set: async (data: Data) => apply('set', path, data),
      update: async (data: Data) => apply('update', path, data),
      delete: async () => {
        docs.delete(path);
      },
      collection: (name: string) => collectionRef(`${path}/${name}`),
    };
  }
  const readField = (data: Data | undefined, field: string): unknown =>
    field
      .split('.')
      .reduce<unknown>(
        (node, part) =>
          node && typeof node === 'object' ? (node as Data)[part] : undefined,
        data,
      );
  function query(
    name: string,
    filters: [string, unknown, string][],
    max?: number,
  ) {
    return {
      where: (field: string, op: string, value: unknown) =>
        query(name, [...filters, [field, value, op]], max),
      limit: (n: number) => query(name, filters, n),
      orderBy: () => query(name, filters, max),
      get: async () => {
        const matches = [...docs.keys()]
          .filter(
            (path) =>
              path.startsWith(`${name}/`) &&
              path.split('/').length === name.split('/').length + 1,
          )
          .filter((path) =>
            filters.every(([field, value, op]) => {
              const actual = readField(docs.get(path), field);
              return op === 'array-contains'
                ? Array.isArray(actual) && actual.includes(value)
                : actual === value;
            }),
          )
          .slice(0, max ?? Number.MAX_SAFE_INTEGER)
          .map(snapshot);
        return {
          docs: matches,
          size: matches.length,
          empty: matches.length === 0,
        };
      },
    };
  }
  function collectionRef(name: string) {
    return {
      doc: (id?: string) => docRef(`${name}/${id ?? `auto-${++auto}`}`),
      add: async (data: Data) => {
        const ref = docRef(`${name}/auto-${++auto}`);
        apply('create', ref.path, data);
        return ref;
      },
      ...query(name, []),
    };
  }
  const db = {
    collection: (name: string) => collectionRef(name),
    getAll: (...refs: Array<{ get: () => Promise<unknown> }>) =>
      Promise.all(refs.map((ref) => ref.get())),
    batch: () => {
      const pending: (() => void)[] = [];
      const batch = {
        set: (
          ref: { path: string },
          data: Data,
          options?: { merge?: boolean },
        ) => {
          pending.push(() =>
            options?.merge && docs.has(ref.path)
              ? apply('update', ref.path, data)
              : apply('set', ref.path, data),
          );
          return batch;
        },
        update: (ref: { path: string }, data: Data) => {
          pending.push(() => apply('update', ref.path, data));
          return batch;
        },
        delete: (ref: { path: string }) => {
          pending.push(() => docs.delete(ref.path));
          return batch;
        },
        commit: async () => {
          for (const run of pending) run();
        },
      };
      return batch;
    },
    runTransaction: async (fn: (tx: unknown) => Promise<unknown>) => {
      const pending: [string, string, Data][] = [];
      const result = await fn({
        get: async (ref: { path: string; get?: () => unknown }) =>
          'path' in ref
            ? snapshot(ref.path)
            : (ref as { get: () => unknown }).get(),
        create: (ref: { path: string }, data: Data) =>
          pending.push(['create', ref.path, data]),
        set: (ref: { path: string }, data: Data) =>
          pending.push(['set', ref.path, data]),
        update: (ref: { path: string }, data: Data) =>
          pending.push(['update', ref.path, data]),
      });
      for (const [op, path, data] of pending) apply(op, path, data);
      return result;
    },
  } as unknown as Firestore;
  return { db, docs };
}
