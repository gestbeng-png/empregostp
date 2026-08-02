import type { PasswordChangeInput } from '@/application/auth/contracts/passwordChangeSchema';

export interface PasswordService {
  changePassword(input: PasswordChangeInput): Promise<void>;
}
