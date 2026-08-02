import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc } from 'firebase/firestore';

const projectId = 'empregostp';
const candidateId = 'rules-candidate';

describe('firestore.rules para perfis de candidatos', () => {
  let environment: RulesTestEnvironment;

  beforeAll(async () => {
    environment = await initializeTestEnvironment({
      projectId,
      firestore: {
        rules: readFileSync(join(process.cwd(), 'firestore.rules'), 'utf8'),
      },
    });
  });

  beforeEach(async () => {
    await environment.clearFirestore();
    await environment.withSecurityRulesDisabled(async (context) => {
      const firestore = context.firestore();
      await setDoc(doc(firestore, 'users', candidateId), {
        userType: 'candidato',
      });
      await setDoc(doc(firestore, 'profiles', candidateId), {
        settings: { language: 'pt-PT' },
      });
      await setDoc(doc(firestore, 'users', 'rules-admin'), {
        userType: 'admin',
      });
    });
  });

  afterAll(async () => {
    await environment.cleanup();
  });

  it('permite ao candidato ler apenas o próprio perfil', async () => {
    const candidate = environment.authenticatedContext(candidateId).firestore();
    const otherCandidate = environment
      .authenticatedContext('another-candidate')
      .firestore();

    await assertSucceeds(getDoc(doc(candidate, 'profiles', candidateId)));
    await assertFails(getDoc(doc(otherCandidate, 'profiles', candidateId)));
  });

  it('obriga a gravação a passar pela API, mesmo para o proprietário', async () => {
    const candidate = environment.authenticatedContext(candidateId).firestore();

    await assertFails(
      setDoc(doc(candidate, 'profiles', candidateId), {
        settings: { language: 'en' },
      }),
    );
  });

  it('permite ao administrador analisar o perfil', async () => {
    const admin = environment.authenticatedContext('rules-admin').firestore();

    await assertSucceeds(getDoc(doc(admin, 'profiles', candidateId)));
  });
});
