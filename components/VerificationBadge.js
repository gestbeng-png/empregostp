import React, { useId } from 'react';
import styles from '../styles/VerificationBadge.module.css';

/**
 * Selo de verificação do candidato.
 *
 * Há dois selos e têm de se distinguir à primeira vista:
 * - `paid` (Perfil Premium): revisão de identidade e documentos, paga.
 *   Roseta azul-noite com o visto em lima.
 * - `qualified` (Competências verificadas): avaliação do perfil pela equipa.
 *   Escudo azul com estrela, em fundo claro.
 *
 * Ao passar o rato (ou focar com o teclado) aparece "Verificado pela
 * plataforma" — o `title` nativo demorava e não se via em telemóveis.
 *
 * @param {boolean} verified - Se o perfil está verificado
 * @param {string} size - Tamanho do selo (sm, md, lg)
 * @param {string} variant - Tipo de exibição (badge, seal, icon, check, text)
 */
const BADGE_COPY = {
  paid: {
    label: 'Perfil Premium',
    detail: 'Identidade e documentos confirmados pela equipa EmpregoSTP.',
  },
  qualified: {
    label: 'Competências verificadas',
    detail: 'Competências e percurso avaliados pela equipa EmpregoSTP.',
  },
};

function PremiumSeal() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={styles.icon}>
      <path
        className={styles.sealShape}
        d="M12 1.6l2.35 1.72 2.9-.2.98 2.74 2.47 1.53-.6 2.85L21.5 12l-1.4 1.76.6 2.85-2.47 1.53-.98 2.74-2.9-.2L12 22.4l-2.35-1.72-2.9.2-.98-2.74-2.47-1.53.6-2.85L2.5 12l1.4-1.76-.6-2.85 2.47-1.53.98-2.74 2.9.2z"
      />
      <path
        className={styles.sealCheck}
        d="M8.2 12.3l2.6 2.6 5-5.2"
        fill="none"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function CompetencyShield() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={styles.icon}>
      <path
        className={styles.shieldShape}
        d="M12 2.2l7.6 2.9v6.1c0 4.7-3.1 8.7-7.6 10.6-4.5-1.9-7.6-5.9-7.6-10.6V5.1z"
      />
      <path
        className={styles.shieldStar}
        d="M12 7.2l1.42 2.88 3.18.46-2.3 2.24.54 3.17L12 14.45l-2.84 1.5.54-3.17-2.3-2.24 3.18-.46z"
      />
    </svg>
  );
}

// Desenho do `fi-rr-shield-trust` (Flaticon UIcons, regular rounded), tirado
// da fonte para não carregar a biblioteca inteira por causa de um ícone.
// Exportado para os sítios onde o selo é só decorativo, dentro de um link
// (ex.: cartões da home): aí não pode ter foco nem dica própria.
export function TrustSealIcon({ className = styles.icon }) {
  return (
    <svg viewBox="0 0 24.08 24" aria-hidden="true" className={className}>
      <path
        fill="currentColor"
        d="M23.2 14.08 21.04 16.24V18Q21.04 19.2 20.16 20.08Q19.28 20.96 18 20.96H16.32L14.16 23.12Q13.28 24 12.04 24Q10.8 24 9.92 23.12L7.76 20.96H6Q4.8 20.96 3.92 20.08Q3.04 19.2 3.04 18V16.24L0.88 14.08Q0 13.2 0 11.96Q0 10.72 0.88 9.84L3.04 7.68V6Q3.04 4.72 3.92 3.84Q4.8 2.96 6 2.96H7.76L9.92 0.8Q10.8 -0.08 12.04 -0.08Q13.28 -0.08 14.16 0.8L16.32 2.96H18Q18.48 2.96 18.76 3.24Q19.04 3.52 19.04 3.96Q19.04 4.4 18.76 4.68Q18.48 4.96 18 4.96H15.92Q15.52 4.96 15.2 4.64L12.72 2.24Q12.48 1.92 12.04 1.92Q11.6 1.92 11.36 2.24L8.88 4.64Q8.56 4.96 8.16 4.96H6Q5.6 4.96 5.32 5.24Q5.04 5.52 5.04 6V8.08Q5.04 8.48 4.72 8.8L2.32 11.28Q2 11.52 2 11.96Q2 12.4 2.32 12.64L4.72 15.12Q5.04 15.44 5.04 15.84V18Q5.04 18.4 5.32 18.68Q5.6 18.96 6 18.96H8.16Q8.56 18.96 8.88 19.28L11.36 21.68Q11.6 22 12.04 22Q12.48 22 12.72 21.68L15.2 19.28Q15.52 18.96 15.92 18.96H18Q18.48 18.96 18.76 18.68Q19.04 18.4 19.04 18V15.84Q19.04 15.44 19.36 15.12L21.76 12.64Q22.08 12.4 22.08 11.96Q22.08 11.52 21.8 11.24Q21.52 10.96 21.52 10.56Q21.52 10.16 21.8 9.84Q22.08 9.52 22.48 9.52Q22.88 9.52 23.2 9.84Q24.08 10.72 24.08 11.96Q24.08 13.2 23.2 14.08ZM10.72 13.68 7.68 10.64Q7.44 10.4 7 10.4Q6.56 10.4 6.28 10.68Q6 10.96 6 11.4Q6 11.84 6.32 12.08L9.28 15.12Q10.24 16 11.56 16Q12.88 16 13.76 15.04L22.72 6.24Q22.96 5.92 23 5.52Q23.04 5.12 22.72 4.8Q22.4 4.48 22 4.48Q21.6 4.48 21.28 4.8L12.4 13.68Q12 14 11.52 14Q11.04 14 10.72 13.68Z"
      />
    </svg>
  );
}

export default function VerificationBadge({
  verified = false,
  size = 'md',
  variant = 'badge',
  verificationTypes = [],
  type = null,
  // Substitui a segunda linha da dica (ex.: perfil de empresa).
  detail: customDetail = '',
}) {
  const tooltipId = useId();
  if (!verified) return null;

  // `type` escolhe um selo concreto; sem ele, o Premium prevalece e os
  // registos antigos (só `verified: true`) contam como Premium.
  const types = Array.isArray(verificationTypes) ? verificationTypes : [];
  const kind = type
    ? type === 'qualified'
      ? 'qualified'
      : 'paid'
    : types.includes('qualified') && !types.includes('paid')
      ? 'qualified'
      : 'paid';
  const copy = BADGE_COPY[kind];
  const sizeClass = styles[size] || styles.md;
  const Icon = kind === 'qualified' ? CompetencyShield : PremiumSeal;

  const tooltip = (
    <span role="tooltip" id={tooltipId} className={styles.tooltip}>
      <strong className={styles.tooltipTitle}>
        Verificado pela plataforma
      </strong>
      <span className={styles.tooltipDetail}>{copy.detail}</span>
    </span>
  );

  if (variant === 'text' || variant === 'check') {
    return (
      <span
        className={`${styles.anchor} ${styles.text} ${styles[kind]} ${sizeClass}`}
        tabIndex={0}
        aria-describedby={tooltipId}
      >
        <Icon />
        {variant === 'text' ? (
          copy.label
        ) : (
          <span className={styles.srOnly}>{copy.label}</span>
        )}
        {tooltip}
      </span>
    );
  }

  // Selo junto ao nome: um só ícone para qualquer verificação, com a dica a
  // dizer o que foi confirmado.
  if (variant === 'seal') {
    const hasPaid = kind === 'paid' || types.includes('paid');
    const hasQualified = kind === 'qualified' || types.includes('qualified');
    const detail =
      customDetail ||
      (hasPaid && hasQualified
        ? 'Identidade, documentos e competências confirmados pela equipa EmpregoSTP.'
        : copy.detail);
    return (
      <span
        className={`${styles.anchor} ${styles.seal} ${sizeClass}`}
        tabIndex={0}
        aria-describedby={tooltipId}
      >
        <TrustSealIcon />
        <span className={styles.srOnly}>Verificado pela plataforma</span>
        <span role="tooltip" id={tooltipId} className={styles.tooltip}>
          <strong className={styles.tooltipTitle}>
            Verificado pela plataforma
          </strong>
          <span className={styles.tooltipDetail}>{detail}</span>
        </span>
      </span>
    );
  }

  if (variant === 'icon') {
    return (
      <span
        className={`${styles.anchor} ${styles.iconOnly} ${styles[kind]} ${sizeClass}`}
        tabIndex={0}
        aria-describedby={tooltipId}
      >
        <Icon />
        <span className={styles.srOnly}>{copy.label}</span>
        {tooltip}
      </span>
    );
  }

  return (
    <span
      className={`${styles.anchor} ${styles.badge} ${styles[kind]} ${sizeClass}`}
      tabIndex={0}
      aria-describedby={tooltipId}
    >
      <Icon />
      <span className={styles.label}>{copy.label}</span>
      {tooltip}
    </span>
  );
}
