import assert from 'node:assert/strict';
import test from 'node:test';
import {
  activateRecruitment,
  PRODUCTION_PROBES,
  RECRUITMENT_FLAGS,
} from '../../scripts/v2/activate-recruitment.mjs';
const fetcher = async (url) => ({
  status: PRODUCTION_PROBES.find(([path]) => url.endsWith(path))[1],
});
const setup = () => {
  const writes = [];
  const db = {
    collection: (collection) => ({
      doc: (key) => ({
        collection,
        key,
        get: async () => ({ exists: false, data: () => undefined }),
      }),
    }),
    runTransaction: async (run) =>
      run({
        get: (ref) => ref.get(),
        create: (ref, value) => writes.push({ ref, value }),
        set: (ref, value, options) => writes.push({ ref, value, options }),
      }),
  };
  return { db, writes };
};
test('failed code probes cannot write flags', async () => {
  const { db, writes } = setup();
  await assert.rejects(
    activateRecruitment(
      db,
      { projectId: 'empregostp', deploymentId: 'dpl_test', apply: true },
      async () => ({ status: 404 }),
    ),
    /PRODUCTION_CODE_NOT_READY/,
  );
  assert.equal(writes.length, 0);
});
test('wrong project and missing deployment proof fail closed', async () => {
  const { db, writes } = setup();
  await assert.rejects(
    activateRecruitment(db, { projectId: 'other', apply: true }, fetcher),
    /TARGET_PROJECT_MISMATCH/,
  );
  await assert.rejects(
    activateRecruitment(db, { projectId: 'empregostp', apply: true }, fetcher),
    /DEPLOYMENT_ID_REQUIRED/,
  );
  assert.equal(writes.length, 0);
});
test('dry-run probes deployment and reads flags but never writes', async () => {
  const { db, writes } = setup();
  const result = await activateRecruitment(
    db,
    { projectId: 'empregostp' },
    fetcher,
  );
  assert.equal(result.mode, 'DRY_RUN');
  assert.equal(writes.length, 0);
});
test('activation has a transactional rollback ledger and merges only implemented flags, not kill switches or providers', async () => {
  const { db, writes } = setup();
  const result = await activateRecruitment(
    db,
    { projectId: 'empregostp', deploymentId: 'dpl_test', apply: true },
    fetcher,
  );
  assert.equal(result.mode, 'APPLIED');
  assert.equal(writes.length, RECRUITMENT_FLAGS.length + 1);
  assert.equal(writes[0].ref.collection, 'featureFlagRollouts');
  assert.deepEqual(Object.keys(writes[0].value.previous), [
    ...RECRUITMENT_FLAGS,
  ]);
  assert.ok(
    writes
      .slice(1)
      .every(
        ({ ref, options }) =>
          RECRUITMENT_FLAGS.includes(ref.key) && options.merge === true,
      ),
  );
  assert.ok(
    RECRUITMENT_FLAGS.every((key) => !/KILL_|PAYMENTS|AI|WHATSAPP/.test(key)),
  );
});
