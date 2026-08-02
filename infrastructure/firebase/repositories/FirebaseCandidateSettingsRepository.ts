import { FieldValue, type Firestore } from 'firebase-admin/firestore';

import { parsePersistedCandidateSettings } from '@/application/candidate-settings/contracts/candidateSettingsSchema';
import type { CandidateSettingsRepository } from '@/application/candidate-settings/ports/CandidateSettingsRepository';
import type { CandidateSettings } from '@/domain/candidate-settings/CandidateSettings';
import type { UserId } from '@/domain/shared/brand';
import { ApplicationError } from '@/domain/shared/errors';

interface UserDocument {
  userType?: unknown;
}

interface ProfileDocument {
  settings?: unknown;
}

export class FirebaseCandidateSettingsRepository implements CandidateSettingsRepository {
  public constructor(private readonly firestore: Firestore) {}

  public async findByUserId(userId: UserId): Promise<CandidateSettings> {
    const userReference = this.firestore.collection('users').doc(userId);
    const profileReference = this.firestore.collection('profiles').doc(userId);
    const [userSnapshot, profileSnapshot] = await Promise.all([
      userReference.get(),
      profileReference.get(),
    ]);

    this.assertCandidate(userSnapshot.exists, userSnapshot.data());
    const profile = profileSnapshot.data() as ProfileDocument | undefined;
    return parsePersistedCandidateSettings(profile?.settings);
  }

  public async saveForCandidate(
    userId: UserId,
    settings: CandidateSettings,
  ): Promise<CandidateSettings> {
    const userReference = this.firestore.collection('users').doc(userId);
    const profileReference = this.firestore.collection('profiles').doc(userId);

    await this.firestore.runTransaction(async (transaction): Promise<void> => {
      const userSnapshot = await transaction.get(userReference);
      this.assertCandidate(userSnapshot.exists, userSnapshot.data());
      transaction.set(
        profileReference,
        {
          settings,
          settingsUpdatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true },
      );
    });

    return settings;
  }

  private assertCandidate(
    exists: boolean,
    data: UserDocument | undefined,
  ): void {
    if (!exists) {
      throw new ApplicationError(
        'candidate_not_found',
        'Não encontrámos esta conta de candidato.',
      );
    }

    if (data?.userType !== 'candidato') {
      throw new ApplicationError(
        'forbidden',
        'Esta área está disponível apenas para candidatos.',
      );
    }
  }
}
