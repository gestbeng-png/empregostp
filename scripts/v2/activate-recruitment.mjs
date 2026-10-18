// Explicit rollout helper. The default remains dry-run; production activation
// still requires a separately approved deployment and flag change.
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';

export const RECRUITMENT_FLAGS = Object.freeze([
  'V2_APPLICATION_SNAPSHOT',
  'V2_CANDIDATE_TRACKING',
  'V2_EMPLOYER_ATS',
  'V2_INTERVIEWS_OFFERS',
  'V2_JOB_LIFECYCLE',
  'V2_MODERATION',
  'V2_SEO_PAGES',
]);
export const PRODUCTION_PROBES = Object.freeze([
  ['/api/workspace', 401],
  ['/api/me/organizations', 401],
  ['/api/admin/recruitment', 401],
  ['/api/applications/probe/cv', 401],
  ['/api/interviews/probe/ics', 401],
  ['/api/invitations/probe/accept', 405],
]);

export async function verifyPublishedApis(fetcher = fetch) {
  for (const [path, status] of PRODUCTION_PROBES) {
    const response = await fetcher(`https://empregostp.com${path}`, {
      method: 'GET',
      redirect: 'error',
      cache: 'no-store',
      signal: AbortSignal.timeout(20000),
    });
    if (response.status !== status)
      throw new Error('PRODUCTION_CODE_NOT_READY');
  }
}
export async function activateRecruitment(
  db,
  { projectId, deploymentId, apply = false },
  fetcher = fetch,
) {
  if (projectId !== 'empregostp') throw new Error('TARGET_PROJECT_MISMATCH');
  if (apply && !/^dpl_[a-zA-Z0-9]+$/.test(deploymentId || ''))
    throw new Error('DEPLOYMENT_ID_REQUIRED');
  await verifyPublishedApis(fetcher);
  const refs = RECRUITMENT_FLAGS.map((key) =>
    db.collection('featureFlags').doc(key),
  );
  if (!apply) {
    const docs = await Promise.all(refs.map((ref) => ref.get()));
    return {
      mode: 'DRY_RUN',
      keys: RECRUITMENT_FLAGS,
      alreadyEnabled: docs.filter((doc) => doc.data()?.enabled === true).length,
    };
  }
  const rolloutId = randomUUID();
  await db.runTransaction(async (tx) => {
    const docs = await Promise.all(refs.map((ref) => tx.get(ref)));
    const previous = Object.fromEntries(
      docs.map((doc, index) => [
        RECRUITMENT_FLAGS[index],
        doc.exists ? doc.data() : null,
      ]),
    );
    const atMs = Date.now();
    tx.create(db.collection('featureFlagRollouts').doc(rolloutId), {
      actor: 'user-approved-codex-rollout',
      projectId,
      deploymentId,
      atMs,
      keys: RECRUITMENT_FLAGS,
      previous,
      // The user requested activation in the system, including production.
      applied: {
        enabled: true,
        rolloutPercent: 100,
        environments: ['development', 'staging', 'production'],
      },
    });
    refs.forEach((ref) =>
      tx.set(
        ref,
        {
          enabled: true,
          rolloutPercent: 100,
          environments: ['development', 'staging', 'production'],
        },
        { merge: true },
      ),
    );
  });
  return {
    mode: 'APPLIED',
    projectId,
    deploymentId,
    rolloutId,
    keys: RECRUITMENT_FLAGS,
  };
}
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    const args = process.argv.slice(2);
    const apply = args.includes('--apply');
    const deploymentId = args[args.indexOf('--deployment') + 1];
    if (
      args.some(
        (arg, index) =>
          arg !== '--apply' &&
          arg !== '--deployment' &&
          args[index - 1] !== '--deployment',
      )
    )
      throw new Error('INVALID_ARGUMENTS');
    const { admin } = await import('../../lib/firebaseAdmin.js');
    const db = admin.firestore();
    try {
      console.log(
        JSON.stringify(
          await activateRecruitment(db, {
            projectId: admin.app().options.projectId,
            deploymentId,
            apply,
          }),
          null,
          2,
        ),
      );
    } finally {
      await db.terminate();
    }
  } catch (error) {
    const allowed = [
      'TARGET_PROJECT_MISMATCH',
      'DEPLOYMENT_ID_REQUIRED',
      'PRODUCTION_CODE_NOT_READY',
      'INVALID_ARGUMENTS',
    ];
    console.error(
      allowed.includes(error?.message) ? error.message : 'ROLLOUT_FAILED',
    );
    process.exitCode = 1;
  }
}
