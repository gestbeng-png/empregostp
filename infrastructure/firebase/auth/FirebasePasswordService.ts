import {
  EmailAuthProvider,
  getAuth,
  reauthenticateWithCredential,
  updatePassword,
} from 'firebase/auth';

import type { PasswordChangeInput } from '@/application/auth/contracts/passwordChangeSchema';
import type { PasswordService } from '@/application/auth/ports/PasswordService';
import { pt } from '@/shared/i18n/pt';

export class FirebasePasswordService implements PasswordService {
  public async changePassword(input: PasswordChangeInput): Promise<void> {
    const currentUser = getAuth().currentUser;
    if (!currentUser?.email) {
      throw new Error(pt.candidateSettings.password.errors.provider);
    }

    const credential = EmailAuthProvider.credential(
      currentUser.email,
      input.currentPassword,
    );
    await reauthenticateWithCredential(currentUser, credential);
    await updatePassword(currentUser, input.newPassword);
  }
}
