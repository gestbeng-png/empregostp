import { logServerWarning } from './serverLog';

export const JOB_STATUS_PENDING_REVIEW = 'pending_review';
export const JOB_STATUS_REJECTED = 'rejected';

/**
 * Lê o toggle de moderação de vagas em `settings/moderation`.
 *
 * O default é desligado (publicação direta, o comportamento histórico) e uma
 * falha na leitura também publica diretamente: a moderação é uma camada de
 * curadoria, não de segurança, e uma indisponibilidade do Firestore não pode
 * impedir empresas de publicar.
 */
export async function isJobModerationEnabled(adminInstance) {
  try {
    const settingsDoc = await adminInstance
      .firestore()
      .collection('settings')
      .doc('moderation')
      .get();
    return settingsDoc.exists && settingsDoc.data()?.jobApprovalRequired === true;
  } catch (error) {
    logServerWarning('jobs.moderation_settings_lookup_failed', error);
    return false;
  }
}
