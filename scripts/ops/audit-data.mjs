// Read-only. No documents, tokens, names or contacts are printed or written.
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { initializeApp, cert, applicationDefault } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const fields = {
  jobs: [
    'status',
    'titulo',
    'title',
    'dataFecho',
    'expiresAt',
    'dataEncerramento',
    'salarioDe',
    'salarioAte',
    'createdAt',
    'localizacao',
    'location',
    'district',
  ],
  applications: [
    'jobId',
    'candidateId',
    'applicationForm.documents.cv',
    'cvSnapshotKey',
    'cvSnapshotData',
    'cvUrl',
    'status',
  ],
  profiles: ['settings.privacy.profileVisibility', 'cvUrl', 'cvStoragePath'],
  users: ['userType', 'organizationIds', 'cvUrl', 'cvStoragePath'],
  posts: ['title', 'titulo', 'status'],
  news: ['title', 'titulo', 'status'],
};
const cap = 5000;
const deadline = setTimeout(() => {
  process.stderr.write(
    'Auditoria interrompida após 45 segundos sem concluir.\n',
  );
  process.exit(1);
}, 45000);
deadline.unref();
let data;
let totals = {};
let source;
if (process.argv[2] === '--input' && process.argv[3]) {
  data = JSON.parse(await readFile(process.argv[3], 'utf8'));
  source = 'ficheiro local fornecido; não é uma medição de produção';
  for (const name of Object.keys(fields)) {
    if (!Array.isArray(data[name]))
      throw new Error(`Falta a coleção ${name} no ficheiro.`);
    totals[name] = data[name].length;
  }
} else if (process.argv[2] === '--firestore') {
  const projectId =
    process.env.FIREBASE_PROJECT_ID ||
    process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  if (!projectId) throw new Error('Projeto Firebase não configurado.');
  const credential =
    process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY
      ? cert({
          projectId,
          clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
          privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
        })
      : applicationDefault();
  const db = getFirestore(initializeApp({ projectId, credential }));
  db.settings({ preferRest: true });
  source = 'Firestore configurado; leitura agregada sem alterações';
  data = {};
  try {
    for (const [name, projection] of Object.entries(fields)) {
      totals[name] = (await db.collection(name).count().get()).data().count;
      const snapshot = await db
        .collection(name)
        .select(...projection)
        .limit(cap)
        .get();
      data[name] = snapshot.docs.map((doc) => doc.data());
    }
  } catch {
    process.stderr.write(
      'Auditoria indisponível: verifique ligação e credenciais. Nenhum relatório de contagens foi gerado.\n',
    );
    process.exit(1);
  }
} else {
  throw new Error(
    'Use --input <ficheiro.json> ou --firestore (apenas leitura).',
  );
}
const normalize = (v) =>
  String(v || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
const knownLocations = [
  'agua grande',
  'sao tome',
  'me zochi',
  'cantagalo',
  'caue',
  'lemba',
  'lobata',
  'principe',
  'pague',
  'remoto',
];
const permanentUrl = (v) =>
  /firebasestorage\.googleapis\.com.*[?&]token=/.test(String(v || ''));
const jobsByStatus = {};
for (const job of data.jobs) {
  const status = String(job.status || '(ausente)');
  jobsByStatus[status] = (jobsByStatus[status] || 0) + 1;
}
const keys = new Map();
for (const application of data.applications) {
  if (application.jobId && application.candidateId) {
    const key = JSON.stringify([application.jobId, application.candidateId]);
    keys.set(key, (keys.get(key) || 0) + 1);
  }
}
const report = {
  measuredAt: new Date().toISOString(),
  source,
  capPerCollection: cap,
  totals,
  complete: Object.entries(totals).every(
    ([name, total]) => data[name].length === total,
  ),
  sampled: Object.fromEntries(
    Object.keys(fields).map((name) => [name, data[name].length]),
  ),
  jobsByStatus,
  multiRoleTitleSignals: data.jobs.filter((j) =>
    /\/|\s(?:ou|e)\s|,/.test(normalize(j.titulo || j.title)),
  ).length,
  jobsWithoutDeadline: data.jobs.filter(
    (j) => !(j.dataFecho || j.expiresAt || j.dataEncerramento),
  ).length,
  salarySuspicionSignals: data.jobs.filter((j) =>
    [j.salarioDe, j.salarioAte].some(
      (v) =>
        Number(
          String(v || '')
            .replace(/\s/g, '')
            .replace(',', '.'),
        ) >= 1000000,
    ),
  ).length,
  locationReviewSignals: data.jobs.filter(
    (j) =>
      !j.district &&
      !knownLocations.some((value) =>
        normalize(j.localizacao || j.location)
          .replace(/[-–]/g, ' ')
          .includes(value),
      ),
  ).length,
  duplicateApplicationGroups: [...keys.values()].filter((n) => n > 1).length,
  applicationsWithoutCvReference: data.applications.filter(
    (a) =>
      !(
        a.cvSnapshotKey ||
        a.cvSnapshotData ||
        a.cvUrl ||
        a.applicationForm?.documents?.cv
      ),
  ).length,
  profilesWithoutExplicitVisibility: data.profiles.filter(
    (p) => !p.settings?.privacy?.profileVisibility,
  ).length,
  permanentCvUrls: data.profiles.filter((p) => permanentUrl(p.cvUrl)).length,
  usersWithMultipleOrganizationIds: data.users.filter(
    (u) => Array.isArray(u.organizationIds) && u.organizationIds.length > 1,
  ).length,
  testContentTitleSignals: [...data.posts, ...data.news].filter((p) =>
    /lorem ipsum|gggg|^teste?$|^test$/.test(normalize(p.title || p.titulo)),
  ).length,
  limitations: [
    'Sinais heurísticos não são decisões de moderação nem conversões automáticas.',
    'Salários com separadores ambíguos ou data desconhecida requerem revisão adicional.',
    'Ausência de referência ao CV na candidatura não prova que o candidato não possua CV no perfil.',
    'Contagens de organizationIds não substituem auditoria de memberships legadas.',
    'Tokens de download sinalizam URL permanente; acesso anónimo e IAM do bucket não foram testados.',
  ],
};
await mkdir('docs/audits', { recursive: true });
await writeFile(
  'docs/audits/data-counts.json',
  JSON.stringify(report, null, 2) + '\n',
);
process.stdout.write(JSON.stringify(report) + '\n');
