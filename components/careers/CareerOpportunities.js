import { useEffect, useState } from 'react';
import Link from 'next/link';
import styles from '../../styles/CarreiraPage.module.css';

export default function CareerOpportunities() {
  const [jobs, setJobs] = useState([]);
  const [status, setStatus] = useState('loading');
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      setStatus('loading');
      try {
        const response = await fetch('/api/careers/opportunities', {
          signal: controller.signal,
        });
        if (!response.ok) throw new Error('opportunities');
        const data = await response.json();
        const opportunities = data.opportunities ?? data.jobs;
        if (!Array.isArray(opportunities)) throw new Error('opportunities');
        setJobs(opportunities);
        setStatus('ready');
      } catch (error) {
        if (error.name !== 'AbortError') setStatus('error');
      }
    }
    load();
    return () => controller.abort();
  }, [attempt]);
  return (
    <div
      className={styles.roles}
      aria-live="polite"
      aria-busy={status === 'loading'}
    >
      {status === 'loading' && (
        <p className={styles.status} role="status">
          A carregar oportunidades na equipa…
        </p>
      )}
      {status === 'error' && (
        <div className={styles.empty}>
          <p role="alert">
            Não foi possível carregar as oportunidades. Tente novamente.
          </p>
          <button
            type="button"
            className={styles.retry}
            onClick={() => setAttempt((value) => value + 1)}
          >
            Tentar novamente
          </button>
        </div>
      )}
      {status === 'ready' && !jobs.length && (
        <div className={styles.empty}>
          <h3>Sem vagas abertas neste momento.</h3>
          <p>Mas queremos conhecê-lo na mesma.</p>
        </div>
      )}
      {status === 'ready' &&
        jobs.map((job) => (
          <article className={styles.role} key={job.id}>
            <div>
              <h3>{job.titulo || job.title}</h3>
              <p>
                {[
                  job.departamento || job.department || job.categoria,
                  job.localizacao || job.location,
                  job.modalidade ||
                    job.modality ||
                    (job.remoto === true ? 'Remoto' : ''),
                  job.tipoContrato || job.contractType,
                ]
                  .filter(
                    (value) =>
                      typeof value === 'string' &&
                      value &&
                      value !== 'Não informado',
                  )
                  .join(' · ')}
              </p>
              <p>Posição aberta</p>
            </div>
            <Link
              className={styles.secondary}
              href={`/vaga/${encodeURIComponent(job.id)}`}
            >
              Ver descrição e candidatar-me
            </Link>
          </article>
        ))}
    </div>
  );
}
