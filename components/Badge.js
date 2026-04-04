const Badge = ({ status }) => {
  const normalized = (status || '').toString().toLowerCase();
  const isClosed = ['closed', 'fechada', 'inactive', 'inativa', 'disabled', 'desativada'].includes(normalized);
  const isUrgent = ['urgent', 'urgente', 'destaque'].includes(normalized);
  const label = isClosed ? 'FECHADA' : isUrgent ? 'URGENTE' : 'ABERTA';
  const variantClass = isClosed ? 'badge--closed' : isUrgent ? 'badge--urgent' : 'badge--open';
  const dotClass = isClosed ? 'dot--closed' : isUrgent ? 'dot--urgent' : 'dot--open';

  return (
    <>
      <style jsx>{`
        .badge {
          display: inline-flex;
          align-items: center;
          padding: 0.35rem 0.75rem;
          border-radius: 10px;
          font-size: 0.65rem;
          font-weight: 800;
          letter-spacing: 0.12em;
          border: 1px solid transparent;
          text-transform: uppercase;
          gap: 0.4rem;
        }
        .badge--open {
          background: rgba(6, 182, 212, 0.12);
          color: #67e8f9;
          border-color: rgba(6, 182, 212, 0.25);
        }
        .badge--urgent {
          background: rgba(244, 63, 94, 0.12);
          color: #fda4af;
          border-color: rgba(244, 63, 94, 0.25);
        }
        .badge--closed {
          background: rgba(148, 163, 184, 0.12);
          color: #94a3b8;
          border-color: rgba(148, 163, 184, 0.25);
        }
        .dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          animation: pulse 1.6s ease-in-out infinite;
        }
        .dot--open {
          background: #22d3ee;
        }
        .dot--urgent {
          background: #fb7185;
        }
        .dot--closed {
          background: #94a3b8;
          animation: none;
        }
        @keyframes pulse {
          0% { transform: scale(0.95); opacity: 0.7; }
          50% { transform: scale(1.15); opacity: 1; }
          100% { transform: scale(0.95); opacity: 0.7; }
        }
      `}</style>
      <span className={`badge ${variantClass}`}>
        <span className={`dot ${dotClass}`} />
        {label}
      </span>
    </>
  );
};

export default Badge;
