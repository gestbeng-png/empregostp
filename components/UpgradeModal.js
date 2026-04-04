import Link from 'next/link';

/**
 * Modal exibido quando o utilizador atinge o limite do plano.
 * Usado em páginas de vaga e no dashboard candidato.
 */
export default function UpgradeModal({ isOpen, onClose, message, upgradeUrl = '/premium/candidatos', userType = 'candidato' }) {
  if (!isOpen) return null;

  const plans = userType === 'empresa'
    ? [
        { name: 'Profissional', price: '100 Db/mês', highlight: ['5 vagas ativas', '1 destaque', 'Exportar candidaturas', 'Suporte prioritário'] },
        { name: 'PRO', price: '2000 Db/mês', highlight: ['Vagas ilimitadas', 'Mensagens diretas com candidatos', 'Analytics completos', 'Banco de talentos'], popular: true }
      ]
    : [
        { name: 'Profissional', price: '50 Db/mês', highlight: ['20 candidaturas/mês', 'Salvar vagas', 'Gerador de CV em PDF', 'Notificações'] },
        { name: 'Premium', price: '200 Db/mês', highlight: ['Candidaturas ilimitadas', 'Vagas ilimitadas', 'Quem viu o perfil', 'Suporte VIP'], popular: true }
      ];

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        background: 'rgba(0,0,0,0.75)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '1rem'
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
          border: '1px solid rgba(99,102,241,0.3)',
          borderRadius: '16px',
          padding: '2rem',
          maxWidth: '520px',
          width: '100%',
          position: 'relative'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          style={{
            position: 'absolute', top: '1rem', right: '1rem',
            background: 'rgba(255,255,255,0.07)', border: 'none',
            borderRadius: '50%', width: '32px', height: '32px',
            color: '#94a3b8', cursor: 'pointer', fontSize: '1.1rem',
            display: 'flex', alignItems: 'center', justifyContent: 'center'
          }}
        >
          ×
        </button>

        <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
          <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>🚀</div>
          <h2 style={{ color: 'white', fontSize: '1.3rem', fontWeight: 700, margin: '0 0 0.5rem' }}>
            Limite atingido
          </h2>
          <p style={{ color: '#94a3b8', fontSize: '0.9rem', margin: 0 }}>
            {message || 'Faça upgrade para continuar a candidatar-se a mais vagas.'}
          </p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '1.5rem' }}>
          {plans.map((plan) => (
            <div
              key={plan.name}
              style={{
                background: plan.popular ? 'rgba(99,102,241,0.15)' : 'rgba(255,255,255,0.04)',
                border: `1px solid ${plan.popular ? 'rgba(99,102,241,0.5)' : 'rgba(255,255,255,0.08)'}`,
                borderRadius: '12px',
                padding: '1rem',
                position: 'relative'
              }}
            >
              {plan.popular && (
                <span style={{
                  position: 'absolute', top: '-10px', left: '50%', transform: 'translateX(-50%)',
                  background: '#6366f1', color: 'white', fontSize: '0.65rem', fontWeight: 700,
                  padding: '2px 10px', borderRadius: '20px', whiteSpace: 'nowrap'
                }}>
                  MAIS POPULAR
                </span>
              )}
              <p style={{ color: 'white', fontWeight: 700, fontSize: '1rem', margin: '0 0 0.2rem' }}>{plan.name}</p>
              <p style={{ color: '#6366f1', fontWeight: 600, fontSize: '0.85rem', margin: '0 0 0.75rem' }}>{plan.price}</p>
              <ul style={{ margin: 0, padding: 0, listStyle: 'none' }}>
                {plan.highlight.map((feat) => (
                  <li key={feat} style={{ color: '#94a3b8', fontSize: '0.78rem', marginBottom: '0.3rem', display: 'flex', gap: '0.35rem', alignItems: 'flex-start' }}>
                    <span style={{ color: '#10b981', flexShrink: 0 }}>✓</span>
                    {feat}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <Link
          href={upgradeUrl}
          style={{
            display: 'block', textAlign: 'center', width: '100%',
            background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
            color: 'white', fontWeight: 700, fontSize: '0.95rem',
            padding: '0.85rem', borderRadius: '10px', textDecoration: 'none',
            transition: 'opacity 0.2s'
          }}
        >
          Ver Planos e Fazer Upgrade
        </Link>
      </div>
    </div>
  );
}
