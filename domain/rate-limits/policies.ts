export const RATE_LIMIT_POLICIES = Object.freeze({
  application_submit: [{ subject: 'USER', limit: 5, windowMs: 600_000 }, { subject: 'USER', limit: 25, windowMs: 86_400_000 }],
  talent_search: [{ subject: 'ORGANIZATION', limit: 120, windowMs: 3_600_000 }],
  talent_invite_pro: [{ subject: 'ORGANIZATION', limit: 15, windowMs: 86_400_000 }],
  talent_invite_business: [{ subject: 'ORGANIZATION', limit: 40, windowMs: 86_400_000 }],
  report_submit: [{ subject: 'USER', limit: 10, windowMs: 86_400_000 }],
  login: [{ subject: 'ACCOUNT_IP', limit: 5, windowMs: 900_000 }],
  register: [{ subject: 'IP', limit: 5, windowMs: 3_600_000 }],
  otp: [{ subject: 'PHONE', limit: 3, windowMs: 600_000 }, { subject: 'PHONE', limit: 10, windowMs: 86_400_000 }],
  password_reset: [{ subject: 'ACCOUNT', limit: 3, windowMs: 3_600_000 }],
  upload: [{ subject: 'USER', limit: 20, windowMs: 3_600_000 }],
  message: [{ subject: 'USER', limit: 30, windowMs: 86_400_000 }],
  search: [{ subject: 'IP', limit: 60, windowMs: 60_000 }],
  export: [{ subject: 'ORGANIZATION', limit: 10, windowMs: 86_400_000 }],
  // H5 (acréscimo do fecho): a especificação fala de 1 pedido/semana para um ZIP
  // gerado em diferido; aqui a exportação é JSON imediato, por isso 3/semana.
  personal_data_export: [{ subject: 'USER', limit: 3, windowMs: 604_800_000 }],
  account_deletion: [{ subject: 'USER', limit: 5, windowMs: 86_400_000 }],
} as const);
export type RateLimitedAction = keyof typeof RATE_LIMIT_POLICIES;
