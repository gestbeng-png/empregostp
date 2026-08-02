import React from 'react';

/**
 * Badge visual para indicar status de verificação
 * @param {boolean} verified - Se o perfil está verificado
 * @param {string} size - Tamanho do badge (sm, md, lg)
 * @param {string} variant - Tipo de exibição (badge, check, text)
 */
export default function VerificationBadge({ verified = false, size = 'md', variant = 'badge' }) {
  if (!verified) return null;

  const sizeMap = {
    sm: { icon: '16px', container: '0.25rem 0.6rem' },
    md: { icon: '20px', container: '0.35rem 0.8rem' },
    lg: { icon: '24px', container: '0.5rem 1rem' },
  };

  const dimensions = sizeMap[size] || sizeMap.md;

  if (variant === 'check') {
    return (
      <svg
        width={dimensions.icon}
        height={dimensions.icon}
        viewBox="0 0 24 24"
        fill="none"
        stroke="#064bb5"
        strokeWidth="2"
        title="Perfil verificado"
        style={{ display: 'inline-block' }}
      >
        <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z" />
      </svg>
    );
  }

  if (variant === 'text') {
    return (
      <span
        style={{
          fontSize: size === 'sm' ? '0.75rem' : size === 'lg' ? '1rem' : '0.875rem',
          color: '#064bb5',
          fontWeight: '600',
          display: 'inline-flex',
          alignItems: 'center',
          gap: '0.4rem',
        }}
        title="Perfil verificado"
      >
        ✓ Verificado
      </span>
    );
  }

  // Default badge variant
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '0.4rem',
        padding: dimensions.container,
        backgroundColor: '#eefabf',
        color: '#102441',
        border: '1px solid #daff45',
        borderRadius: '9999px',
        fontSize: size === 'sm' ? '0.7rem' : size === 'lg' ? '1rem' : '0.85rem',
        fontWeight: '600',
        whiteSpace: 'nowrap',
      }}
      title="Perfil verificado"
    >
      <svg
        width={dimensions.icon}
        height={dimensions.icon}
        viewBox="0 0 24 24"
        fill="currentColor"
      >
        <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z" />
      </svg>
      Verificado
    </span>
  );
}
