import styles from '../../styles/AdminPanel.module.css';

// As cores vivem em AdminPanel.module.css (`.status*`), feitas de tokens,
// para funcionarem também no tema escuro do painel.
export const STATUS_CONFIG = {
  pending: { label: 'Pendente', className: styles.statusPending },
  approved: { label: 'Aprovado', className: styles.statusApproved },
  rejected: { label: 'Rejeitado', className: styles.statusRejected },
  partial: { label: 'Parcial', className: styles.statusPartial },
  draft: { label: 'Rascunho', className: styles.statusDraft },
};

const TYPE_ORDER = [
  'identity',
  'certificates',
  'academic',
  'experience',
  'competencies',
];

export function getOrderedItems(verification) {
  const itemMap = verification?.verificationItems || {};
  return TYPE_ORDER.map((type) => itemMap[type]).filter(
    (item) => item && item.requested,
  );
}

export function StatusBadge({ status, children }) {
  const config = STATUS_CONFIG[status] || STATUS_CONFIG.draft;
  return (
    <span className={`${styles.badge} ${config.className}`}>
      {children || config.label}
    </span>
  );
}

export default function VerificationReviewModal({
  selectedVerification,
  closeModal,
  reviewReason,
  setReviewReason,
  processAction,
  processingKey,
}) {
  const approvalEligibility = selectedVerification.approvalEligibility || {
    allowed: true,
  };
  const items = getOrderedItems(selectedVerification);
  const publicVerified =
    Boolean(selectedVerification.summary?.publicVerified) ||
    selectedVerification.verificationItems?.identity?.status === 'approved';
  const hasApprovedItem = items.some((item) => item.status === 'approved');
  const isProcessing = (type, action) =>
    processingKey === `${selectedVerification.id}:${type || 'all'}:${action}`;

  const confirmRevoke = (type, label) => {
    const question = type
      ? `Desativar a verificação de ${label}? O tipo passa a rejeitado e o candidato pode voltar a submeter.`
      : `Desativar a verificação de ${selectedVerification.candidateName}? O selo de perfil verificado deixa de aparecer em todo o site.`;
    if (window.confirm(question)) {
      processAction(selectedVerification, 'revoke', type);
    }
  };

  return (
    <div className={styles.modalOverlay} onClick={closeModal}>
      <div
        className={`${styles.modalCard} ${styles.modalCardLarge}`}
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="verification-review-title"
      >
        <div className={styles.modalHeader}>
          <h2 id="verification-review-title" className={styles.modalTitle}>
            Painel de revisão
          </h2>
          <p className={styles.modalSubtitle}>
            {selectedVerification.candidateName} •{' '}
            {selectedVerification.candidateEmail}
          </p>
        </div>

        <div className={styles.modalBodyStack}>
          <div className={styles.modalInfoCard}>
            <div className={styles.verificationPublicRow}>
              <div>
                <h3 className={styles.modalInfoTitle}>Estado do perfil</h3>
                <div className={styles.buttonGroup}>
                  <StatusBadge status={publicVerified ? 'approved' : 'draft'}>
                    {publicVerified
                      ? 'Perfil verificado ativo'
                      : 'Perfil sem selo de verificado'}
                  </StatusBadge>
                  <StatusBadge status="approved">
                    {selectedVerification.summary?.approvedCount || 0} aprovados
                  </StatusBadge>
                  <StatusBadge status="pending">
                    {selectedVerification.summary?.pendingCount || 0} pendentes
                  </StatusBadge>
                  <StatusBadge status="rejected">
                    {selectedVerification.summary?.rejectedCount || 0}{' '}
                    rejeitados
                  </StatusBadge>
                </div>
              </div>
              {hasApprovedItem ? (
                <button
                  type="button"
                  disabled={isProcessing(null, 'revoke')}
                  onClick={() => confirmRevoke(null)}
                  className={`${styles.buttonBase} ${styles.buttonDangerOutline}`}
                >
                  {isProcessing(null, 'revoke')
                    ? 'A desativar…'
                    : 'Desativar verificação'}
                </button>
              ) : null}
            </div>
          </div>

          <div className={styles.modalInfoCard}>
            <h3 className={styles.modalInfoTitle}>
              Pré-requisitos para aprovar
            </h3>
            <div className={styles.buttonGroup}>
              {selectedVerification.cvUrl ? (
                <a
                  href={selectedVerification.cvUrl}
                  target="_blank"
                  rel="noreferrer"
                  className={styles.proofLink}
                >
                  Abrir CV do candidato
                </a>
              ) : (
                <StatusBadge status="rejected">
                  Sem CV anexado ao perfil
                </StatusBadge>
              )}
              <StatusBadge
                status={approvalEligibility.allowed ? 'approved' : 'rejected'}
              >
                Plano: {selectedVerification.currentPlan || 'basic_candidato'}
                {approvalEligibility.allowed
                  ? ' • pagamento confirmado'
                  : ' • pagamento não confirmado'}
              </StatusBadge>
            </div>
            {!approvalEligibility.allowed ? (
              <p className={styles.proofNote}>
                {approvalEligibility.reason} Não é possível aprovar nenhum tipo
                deste pedido enquanto isto não for resolvido.
              </p>
            ) : null}
          </div>

          <div className={styles.formField}>
            <label htmlFor="review-reason" className={styles.formLabel}>
              Nota de revisão
            </label>
            <textarea
              id="review-reason"
              value={reviewReason}
              onChange={(event) => setReviewReason(event.target.value)}
              rows={3}
              placeholder="Opcional. Justifica a aprovação, rejeição ou desativação e é enviada ao candidato."
              className={styles.textareaControl}
            />
          </div>

          <div className={styles.verificationReviewGrid}>
            {items.map((item) => (
              <article
                key={item.type}
                className={styles.verificationReviewCard}
              >
                <div className={styles.verificationReviewHeader}>
                  <div>
                    <h3 className={styles.verificationReviewTitle}>
                      {item.label}
                    </h3>
                    <p className={styles.verificationReviewText}>
                      {item.description}
                    </p>
                  </div>
                  <StatusBadge status={item.status} />
                </div>

                <div className={styles.verificationChecklistAdmin}>
                  {item.checklist?.map((check) => (
                    <div
                      key={`${item.type}-${check.id}`}
                      className={styles.verificationChecklistAdminItem}
                    >
                      <span
                        className={
                          check.completed
                            ? styles.verificationCheckDone
                            : styles.verificationCheckPending
                        }
                        aria-label={check.completed ? 'Cumprido' : 'Em falta'}
                      >
                        {check.completed ? '✓' : '•'}
                      </span>
                      <div>
                        <strong>{check.label}</strong>
                        {check.hint ? <p>{check.hint}</p> : null}
                      </div>
                    </div>
                  ))}
                </div>

                {item.evidence?.length ? (
                  <div className={styles.verificationEvidenceList}>
                    {item.evidence.map((evidence) => (
                      <div
                        key={evidence.id}
                        className={styles.verificationEvidenceItem}
                      >
                        <strong>{evidence.label}</strong>
                        {evidence.url ? (
                          <a
                            href={evidence.url}
                            target="_blank"
                            rel="noreferrer"
                            className={styles.proofLink}
                          >
                            Abrir evidência
                          </a>
                        ) : (
                          <p>{evidence.text || 'Sem detalhe textual.'}</p>
                        )}
                        <span>
                          {evidence.source === 'submission'
                            ? 'Submetido no pedido'
                            : 'Puxado do perfil atual'}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className={styles.proofNote}>
                    Sem evidências anexadas neste tipo.
                  </p>
                )}

                {item.reviewReason && item.status !== 'pending' ? (
                  <p className={styles.proofNote}>
                    Motivo: {item.reviewReason}
                  </p>
                ) : null}

                {item.status === 'pending' ? (
                  <div className={styles.verificationActions}>
                    <button
                      type="button"
                      disabled={
                        !approvalEligibility.allowed ||
                        isProcessing(item.type, 'approve')
                      }
                      title={
                        approvalEligibility.allowed
                          ? undefined
                          : approvalEligibility.reason
                      }
                      onClick={() =>
                        processAction(
                          selectedVerification,
                          'approve',
                          item.type,
                        )
                      }
                      className={`${styles.buttonBase} ${styles.buttonSuccess} ${styles.buttonSmall}`}
                    >
                      Aprovar tipo
                    </button>
                    <button
                      type="button"
                      disabled={isProcessing(item.type, 'reject')}
                      onClick={() =>
                        processAction(selectedVerification, 'reject', item.type)
                      }
                      className={`${styles.buttonBase} ${styles.buttonDangerOutline} ${styles.buttonSmall}`}
                    >
                      Rejeitar tipo
                    </button>
                  </div>
                ) : item.status === 'approved' ? (
                  <div className={styles.verificationActions}>
                    <button
                      type="button"
                      disabled={isProcessing(item.type, 'revoke')}
                      onClick={() => confirmRevoke(item.type, item.label)}
                      className={`${styles.buttonBase} ${styles.buttonDangerOutline} ${styles.buttonSmall}`}
                    >
                      {isProcessing(item.type, 'revoke')
                        ? 'A desativar…'
                        : 'Desativar tipo'}
                    </button>
                  </div>
                ) : null}
              </article>
            ))}
          </div>
        </div>

        <div className={styles.buttonGroupEnd}>
          <button
            type="button"
            onClick={closeModal}
            className={`${styles.buttonBase} ${styles.buttonGhost}`}
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}
