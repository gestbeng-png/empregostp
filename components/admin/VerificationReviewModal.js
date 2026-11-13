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

function safeEvidenceUrl(value) {
  try {
    const url = new URL(value);
    return ['https:', 'http:'].includes(url.protocol) ? url.href : null;
  } catch {
    return null;
  }
}

export default function VerificationReviewModal({
  selectedVerification,
  closeModal,
  reviewReason,
  setReviewReason,
  processAction,
  processingKey,
}) {
  const items = getOrderedItems(selectedVerification);
  const publicVerified = Boolean(
    selectedVerification.summary?.publicVerified ??
    selectedVerification.verificationItems?.[
      selectedVerification.verificationMethod === 'competencies'
        ? 'competencies'
        : 'identity'
    ]?.status === 'approved',
  );
  const pending = items.some((item) => item.status === 'pending');
  const revoked = items.some(
    (item) => item.status === 'rejected' && item.revokedAt,
  );
  const eligible = selectedVerification.approvalEligibility?.allowed !== false;
  const busy = Boolean(processingKey);
  const cvUrl = safeEvidenceUrl(selectedVerification.cvUrl);
  const documents = [];
  const seen = new Set(cvUrl ? [cvUrl] : []);
  for (const item of items) {
    for (const evidence of item.evidence || []) {
      const url = safeEvidenceUrl(evidence.url);
      if (!url || seen.has(url)) continue;
      seen.add(url);
      documents.push({
        url,
        label: evidence.label || evidence.fileName || item.label,
        category: item.label,
        description: evidence.description || '',
      });
    }
  }
  const notes = items
    .flatMap((item) =>
      (item.evidence || [])
        .filter((entry) => entry.text && !entry.url)
        .map((entry) => ({
          label: entry.label || item.label,
          text: entry.text,
        })),
    )
    .filter(
      (entry, index, all) =>
        all.findIndex((other) => other.text === entry.text) === index &&
        entry.text !== selectedVerification.candidateEmail,
    );
  const act = (action) => {
    if (busy) return;
    if (
      action === 'revoke' &&
      !window.confirm(
        'Desativar a verificação deste perfil? O selo será removido.',
      )
    )
      return;
    if (
      action === 'reactivate' &&
      !window.confirm('Reativar a verificação deste perfil?')
    )
      return;
    processAction(selectedVerification, action);
  };

  return (
    <div
      className={styles.modalOverlay}
      onClick={busy ? undefined : closeModal}
    >
      <div
        className={`${styles.modalCard} ${styles.verificationModal} ${styles.verificationCompactModal}`}
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="verification-review-title"
        aria-busy={busy}
      >
        <div className={styles.modalHeader}>
          <h2 id="verification-review-title" className={styles.modalTitle}>
            {selectedVerification.candidateName}
          </h2>
          <p className={styles.modalSubtitle}>
            {selectedVerification.candidateEmail}
          </p>
          <p className={styles.proofNote}>
            {selectedVerification.verificationMethod === 'competencies'
              ? 'Avaliação de competências · sem plano pago'
              : 'Verificação documental · plano pago'}
          </p>
        </div>
        <div className={styles.modalBodyStack}>
          <div className={styles.verificationPublicRow}>
            <StatusBadge
              status={
                publicVerified
                  ? 'approved'
                  : pending
                    ? 'pending'
                    : revoked
                      ? 'draft'
                      : selectedVerification.status
              }
            >
              {publicVerified
                ? 'Verificação ativa'
                : pending
                  ? 'Pedido pendente'
                  : revoked
                    ? 'Verificação desativada'
                    : 'Sem verificação ativa'}
            </StatusBadge>
            {cvUrl && (
              <a
                href={cvUrl}
                target="_blank"
                rel="noreferrer"
                className={styles.proofLink}
              >
                Abrir CV
              </a>
            )}
          </div>
          {publicVerified && pending && (
            <p className={styles.proofNote}>
              Existem novos documentos a aguardar revisão.
            </p>
          )}
          {(pending || revoked) && !eligible && (
            <p role="status" className={styles.proofNote}>
              {selectedVerification.approvalEligibility?.reason ||
                'Os requisitos para aprovação ainda não estão cumpridos.'}
            </p>
          )}
          <section aria-label="Documentos e links para revisão">
            <h3 className={styles.modalInfoTitle}>Documentos e links</h3>
            {documents.length ? (
              <ul className={styles.verificationDocumentList}>
                {documents.map((document) => (
                  <li key={document.url}>
                    <span>{document.category}</span>
                    <div className={styles.verificationDocumentContent}>
                      {document.description && <p>{document.description}</p>}
                      <a
                        href={document.url}
                        target="_blank"
                        rel="noreferrer"
                        className={styles.proofLink}
                      >
                        {document.label}
                      </a>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className={styles.proofNote}>
                {cvUrl
                  ? 'Sem documentos adicionais.'
                  : 'Nenhum documento disponível.'}
              </p>
            )}
          </section>
          {notes.length > 0 && (
            <details className={styles.verificationExtraDetails}>
              <summary>Informações do candidato</summary>
              <dl>
                {notes.map((note, index) => (
                  <div key={index}>
                    <dt>{note.label}</dt>
                    <dd>{note.text}</dd>
                  </div>
                ))}
              </dl>
            </details>
          )}
          <details className={styles.verificationExtraDetails}>
            <summary>Adicionar nota ao candidato</summary>
            <label htmlFor="review-reason" className={styles.srOnly}>
              Nota de revisão
            </label>
            <textarea
              id="review-reason"
              value={reviewReason}
              disabled={busy}
              onChange={(event) => setReviewReason(event.target.value)}
              rows={3}
              placeholder="Motivo ou observação (opcional)"
              className={styles.textareaControl}
            />
          </details>
        </div>
        <div className={styles.verificationCompactActions}>
          <button
            type="button"
            onClick={closeModal}
            disabled={busy}
            className={`${styles.buttonBase} ${styles.buttonGhost}`}
          >
            Fechar
          </button>
          {pending && (
            <>
              <button
                type="button"
                disabled={busy}
                onClick={() => act('reject')}
                className={`${styles.buttonBase} ${styles.buttonGhost}`}
              >
                Rejeitar pedido
              </button>
              <button
                type="button"
                disabled={busy || !eligible}
                onClick={() => act('approve')}
                className={`${styles.buttonBase} ${styles.buttonPrimary}`}
              >
                Aprovar pedido
              </button>
            </>
          )}
          {publicVerified && (
            <button
              type="button"
              disabled={busy}
              onClick={() => act('revoke')}
              className={`${styles.buttonBase} ${styles.buttonDangerOutline}`}
            >
              Desativar verificação
            </button>
          )}
          {!publicVerified && revoked && (
            <button
              type="button"
              disabled={busy || !eligible}
              onClick={() => act('reactivate')}
              className={`${styles.buttonBase} ${styles.buttonPrimary}`}
            >
              Reativar verificação
            </button>
          )}
        </div>
        {busy && (
          <p role="status" className={styles.proofNote}>
            A guardar alteração…
          </p>
        )}
      </div>
    </div>
  );
}
