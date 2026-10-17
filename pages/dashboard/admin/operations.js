import { useEffect, useState } from 'react';
import Head from 'next/head';
import { requireAdminPageAuth } from '../../../lib/adminPageGuard';
import { apiRequest } from '../../../lib/apiClient';
import { ActionForm } from '../../../components/empresa/RecruitmentControls';
import styles from '../../../styles/RecruitmentWorkspace.module.css';
import { isRecruitmentWorkspaceEnabled } from '../../../lib/recruitmentAvailability';

export default function OperationsPage() {
  const [data, setData] = useState(null);
  const [hires, setHires] = useState([]);
  const [error, setError] = useState('');
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setError('');
    Promise.allSettled([
      apiRequest('/api/admin/operations', { signal: controller.signal }),
      apiRequest('/api/admin/recruitment', { signal: controller.signal }),
    ]).then(([operations, recruitment]) => {
      if (controller.signal.aborted) return;
      setData(operations.status === 'fulfilled' ? operations.value : null);
      setHires(
        recruitment.status === 'fulfilled' ? recruitment.value.hires : [],
      );
      setError(
        [operations, recruitment]
          .filter((result) => result.status === 'rejected')
          .map((result) => result.reason.message)
          .join(' '),
      );
    });
    return () => controller.abort();
  }, [revision]);
  return (
    <div className={styles.root}>
      <Head>
        <title>Operações de recrutamento · EmpregoSTP</title>
        <meta name="robots" content="noindex, nofollow" />
      </Head>
      <h1>Operações de recrutamento</h1>
      <button
        type="button"
        className="btn btn-ghost"
        onClick={() => setRevision((value) => value + 1)}
      >
        Atualizar operações
      </button>
      {error ? <p role="alert">{error}</p> : null}
      {data ? (
        <section className={styles.panel}>
          <h2>Saúde da outbox</h2>
          <p>Processador esperado: {data.outboxExpected ? 'Sim' : 'Não'}</p>
          <p>
            Última execução:{' '}
            {data.lastOutboxRunAtMs
              ? new Date(data.lastOutboxRunAtMs).toLocaleString('pt-PT')
              : 'Sem execução registada'}
          </p>
          <ul>
            {data.alerts?.map((alert, index) => (
              <li key={index}>{alert.message || alert.code}</li>
            ))}
          </ul>
        </section>
      ) : null}
      <section className={styles.panel}>
        <h2>Contratações ativas</h2>
        <p>Até 100 registos. A anulação exige motivo e fica auditada.</p>
        {hires.map((hire) => (
          <details key={hire.id}>
            <summary>
              Vaga {hire.jobId} · confirmação {hire.candidateConfirmation}
            </summary>
            <ActionForm
              title="Anular contratação"
              path={`/api/hires/${encodeURIComponent(hire.id)}/annul`}
              fields={[
                {
                  name: 'reason',
                  label: 'Motivo obrigatório da anulação',
                  type: 'textarea',
                  required: true,
                  maxLength: 1000,
                },
              ]}
              confirmText="Confirmo a anulação desta contratação e a alteração da candidatura."
              submit="Anular contratação"
              onSuccess={() => setRevision((value) => value + 1)}
            />
          </details>
        ))}
      </section>
    </div>
  );
}
export async function getServerSideProps(context) {
  context.res.setHeader('Cache-Control', 'private, no-store');
  context.res.setHeader('X-Robots-Tag', 'noindex, nofollow');
  // ADR-019: operações de recrutamento retiradas com a área.
  if (!isRecruitmentWorkspaceEnabled())
    return { redirect: { destination: '/dashboard/admin', permanent: false } };
  const result = await requireAdminPageAuth(context);
  return result.ok ? { props: {} } : { redirect: result.redirect };
}
