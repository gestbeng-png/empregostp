import {
  FORM_DRAFT_SCHEMA,
  buildStoredDraft,
  createFormDraftKey,
  parseStoredDraft,
  readLocalDraft,
  readLocalDraftClearedAt,
  sanitizeDraftValue,
  writeLocalDraft,
  writeLocalDraftClearMarker,
} from '../../../lib/formDraft';

function createStorage() {
  const values = new Map<string, string>();
  return {
    getItem: jest.fn((key: string) => values.get(key) ?? null),
    setItem: jest.fn((key: string, value: string) => values.set(key, value)),
    removeItem: jest.fn((key: string) => values.delete(key)),
  };
}

describe('formDraft', () => {
  test('cria chaves versionadas e isoladas por utilizador e recurso', () => {
    expect(
      createFormDraftKey({
        scope: 'company-job',
        ownerId: 'company-1',
        resourceId: 'job-9',
      }),
    ).toBe('empregostp:draft:v1:company-job:company-1:job-9');

    expect(
      createFormDraftKey({ scope: 'profile', ownerId: '', resourceId: 'x' }),
    ).toBe('');
  });

  test('remove segredos, binários e data URLs sem perder o restante formulário', () => {
    const file = new File(['conteúdo'], 'cv.pdf', {
      type: 'application/pdf',
    });
    const result = sanitizeDraftValue({
      name: 'Ana',
      password: 'não guardar',
      access_token: 'não guardar',
      idToken: 'não guardar',
      photo: 'data:image/png;base64,AAAA',
      attachment: file,
      nested: { headline: 'Engenheira', secret: 'não guardar' },
    });

    expect(result).toEqual({
      name: 'Ana',
      nested: { headline: 'Engenheira' },
    });
  });

  test('permite uma imagem local otimizada apenas quando explicitamente autorizado', () => {
    const photo = 'data:image/jpeg;base64,AAAA';

    expect(
      sanitizeDraftValue(
        { fullName: 'Ana', photo },
        { allowDataUrls: true, maxDataUrlLength: 100 },
      ),
    ).toEqual({ fullName: 'Ana', photo });
    expect(
      sanitizeDraftValue(
        { photo },
        { allowDataUrls: true, maxDataUrlLength: 10 },
      ),
    ).toEqual({});
  });

  test('faz round-trip no storage e rejeita rascunho expirado ou corrompido', () => {
    const storage = createStorage();
    const key = 'draft-key';
    writeLocalDraft(storage, key, { title: 'Vaga' }, { now: 1_000, ttlMs: 500 });

    expect(readLocalDraft(storage, key, { now: 1_200 })?.data).toEqual({
      title: 'Vaga',
    });
    expect(readLocalDraft(storage, key, { now: 1_600 })).toBeNull();
    expect(parseStoredDraft('{json inválido')).toBeNull();
  });

  test('um marcador de limpeza impede que uma cópia antiga reapareça', () => {
    const storage = createStorage();
    const key = 'submitted-application';
    writeLocalDraft(storage, key, { letter: 'antiga' }, { now: 1_000 });
    writeLocalDraftClearMarker(storage, key, '1970-01-01T00:00:02.000Z');

    expect(readLocalDraftClearedAt(storage, key)).toBe(2_000);
    expect(readLocalDraft(storage, key, { now: 2_500 })).toBeNull();

    writeLocalDraft(storage, key, { letter: 'nova' }, { now: 3_000 });
    expect(readLocalDraftClearedAt(storage, key)).toBe(0);
    expect(readLocalDraft(storage, key, { now: 3_500 })?.data).toEqual({
      letter: 'nova',
    });
  });

  test('migra o rascunho manual antigo do CV', () => {
    const legacy = JSON.stringify({
      version: 1,
      savedAt: '2026-08-15T10:00:00.000Z',
      form: { fullName: 'Ana Pinto' },
    });

    const parsed = parseStoredDraft(legacy, {
      migrate: (draft: { form: { fullName: string } }) => ({
        form: draft.form,
        currentStep: 2,
      }),
    });

    expect(parsed).toMatchObject({
      source: 'legacy',
      savedAt: '2026-08-15T10:00:00.000Z',
      data: { form: { fullName: 'Ana Pinto' }, currentStep: 2 },
    });
  });

  test('gera envelope com schema, versão e expiração explícitos', () => {
    const envelope = buildStoredDraft(
      { content: 'texto' },
      { now: 10_000, ttlMs: 2_000 },
    );

    expect(envelope).toEqual({
      schema: FORM_DRAFT_SCHEMA,
      version: 1,
      savedAt: '1970-01-01T00:00:10.000Z',
      expiresAt: '1970-01-01T00:00:12.000Z',
      data: { content: 'texto' },
    });
  });
});
