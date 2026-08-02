import { deleteApp, initializeApp, type App } from 'firebase-admin/app';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';

import { createDefaultCandidateSettings } from '@/domain/candidate-settings/CandidateSettings';
import { toUserId } from '@/domain/shared/brand';
import { FirebaseCandidateSettingsRepository } from '@/infrastructure/firebase/repositories/FirebaseCandidateSettingsRepository';

const projectId = 'empregostp';
const candidateId = toUserId('integration-candidate');

describe('FirebaseCandidateSettingsRepository', () => {
  let app: App;
  let firestore: Firestore;

  beforeAll(() => {
    if (!process.env.FIRESTORE_EMULATOR_HOST) {
      throw new Error('Execute este teste com o Firestore Emulator.');
    }
    app = initializeApp({ projectId }, 'candidate-settings-integration');
    firestore = getFirestore(app);
  });

  beforeEach(async () => {
    await clearEmulator();
    await firestore.collection('users').doc(candidateId).set({
      userType: 'candidato',
    });
  });

  afterAll(async () => {
    await deleteApp(app);
  });

  it('grava as preferências numa transação e volta a lê-las', async () => {
    const repository = new FirebaseCandidateSettingsRepository(firestore);
    const settings = createDefaultCandidateSettings();
    settings.privacy.profileVisibility = 'private';

    await repository.saveForCandidate(candidateId, settings);

    await expect(repository.findByUserId(candidateId)).resolves.toEqual(
      settings,
    );
    const stored = await firestore
      .collection('profiles')
      .doc(candidateId)
      .get();
    expect(stored.data()?.settingsUpdatedAt).toBeDefined();
  });

  it('impede uma conta de empresa de usar o repositório do candidato', async () => {
    await firestore.collection('users').doc(candidateId).set({
      userType: 'empresa',
    });
    const repository = new FirebaseCandidateSettingsRepository(firestore);

    await expect(
      repository.saveForCandidate(
        candidateId,
        createDefaultCandidateSettings(),
      ),
    ).rejects.toMatchObject({ code: 'forbidden' });
  });
});

async function clearEmulator(): Promise<void> {
  const host = process.env.FIRESTORE_EMULATOR_HOST;
  if (!host) {
    throw new Error('O endereço do Firestore Emulator não foi definido.');
  }
  const response = await fetch(
    `http://${host}/emulator/v1/projects/${projectId}/databases/(default)/documents`,
    { method: 'DELETE' },
  );
  if (!response.ok) {
    throw new Error('Não foi possível limpar o Firestore Emulator.');
  }
}
