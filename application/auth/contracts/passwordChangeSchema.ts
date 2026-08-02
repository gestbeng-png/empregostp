import { z } from 'zod';

import { pt } from '@/shared/i18n/pt';

export const passwordChangeSchema = z
  .object({
    confirmPassword: z.string(),
    currentPassword: z
      .string()
      .min(1, pt.candidateSettings.password.errors.invalidCredential),
    newPassword: z
      .string()
      .min(8, pt.candidateSettings.password.errors.weak)
      .max(128, pt.candidateSettings.password.errors.weak),
  })
  .refine((values) => values.newPassword === values.confirmPassword, {
    message: pt.candidateSettings.password.errors.mismatch,
    path: ['confirmPassword'],
  });

export interface PasswordChangeInput {
  confirmPassword: string;
  currentPassword: string;
  newPassword: string;
}
