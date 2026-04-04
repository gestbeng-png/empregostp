/**
 * Função auxiliar para integrar destaques de vagas na homepage
 * Import esta função e use em componentes que exibem vagas
 */

export async function getFeaturedJobs(limit = 6) {
  try {
    const response = await fetch('/api/jobs?destaque=true&limit=' + limit);
    if (!response.ok) return [];
    const data = await response.json();
    return data.vagas || [];
  } catch (error) {
    console.error('Error fetching featured jobs:', error);
    return [];
  }
}

/**
 * Função para formatado com badge de destaque
 * Uso em componentes:
 * 
 * {vaga.destaque && <FeaturedBadge />}
 */
export function FeaturedJobBadge() {
  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: '0.5rem',
      padding: '0.35rem 0.75rem',
      background: 'linear-gradient(135deg, rgba(251, 146, 60, 0.2), rgba(251, 146, 60, 0.1))',
      border: '1px solid rgba(251, 146, 60, 0.3)',
      borderRadius: '6px',
      color: '#fb923c',
      fontSize: '0.75rem',
      fontWeight: '600',
      whiteSpace: 'nowrap'
    }}>
      ⭐ Em Destaque
    </span>
  );
}

/**
 * Exemplo de uso em listagem de vagas:
 * 
 * import { getFeaturedJobs, FeaturedJobBadge } from '../../lib/featuredJobs';
 * 
 * export default function Jobs({ allJobs }) {
 *   // Separar vagas em destaque
 *   const featured = allJobs.filter(j => j.destaque === true);
 *   const regular = allJobs.filter(j => j.destaque !== true);
 * 
 *   return (
 *     <>
 *       <h2>Vagas em Destaque</h2>
 *       {featured.map(vaga => (
 *         <div key={vaga.id}>
 *           <h3>{vaga.title} <FeaturedJobBadge /></h3>
 *           ...
 *         </div>
 *       ))}
 * 
 *       <h2>Outras Vagas</h2>
 *       {regular.map(vaga => (
 *         ...
 *       ))}
 *     </>
 *   );
 * }
 */

export const FEATURED_JOB_STYLES = {
  container: {
    background: 'linear-gradient(135deg, rgba(251, 146, 60, 0.1), rgba(59, 130, 246, 0.05))',
    border: '2px solid rgba(251, 146, 60, 0.3)',
    borderRadius: '12px',
    padding: '1.5rem',
    boxShadow: '0 0 20px rgba(251, 146, 60, 0.1)'
  },
  badge: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.5rem',
    padding: '0.35rem 0.75rem',
    background: 'rgba(251, 146, 60, 0.15)',
    border: '1px solid rgba(251, 146, 60, 0.3)',
    borderRadius: '6px',
    color: '#fb923c',
    fontSize: '0.75rem',
    fontWeight: '600'
  }
};
