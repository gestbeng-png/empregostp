import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import Head from 'next/head';
import { FiArrowLeft } from 'react-icons/fi';
import { admin } from '../../../../../lib/firebaseAdmin';
import adminStyles from '../../../../../styles/AdminPanel.module.css';
import nookies from 'nookies';
import { redirectToLogin } from '../../../../../lib/loginRedirect';
import { useAuth } from '../../../../../context/AuthContext';
import AutoSaveStatus from '../../../../../components/forms/AutoSaveStatus';
import useAutoDraft from '../../../../../hooks/useAutoDraft';
import { createFormDraftKey } from '../../../../../lib/formDraft';

const EDITABLE_JOB_FIELDS = [
  'titulo',
  'descricao',
  'requisitos',
  'salario',
  'location',
  'tipoContrato',
  'status',
  'prazo',
];

function prepareAdminJobDraft(value) {
  if (!value || typeof value !== 'object') return {};

  return EDITABLE_JOB_FIELDS.reduce((draft, field) => {
    if (typeof value[field] === 'string') draft[field] = value[field];
    return draft;
  }, {});
}

function buildAdminJobForm(job) {
  return {
    titulo: job?.titulo || '',
    descricao: job?.descricao || '',
    requisitos: job?.requisitos || '',
    salario: job?.salario || '',
    location: job?.location || '',
    tipoContrato: job?.tipoContrato || 'CLT',
    status: job?.status || 'active',
    prazo: job?.prazo || '',
  };
}

export default function EditJob({ job, companyName }) {
  const router = useRouter();
  const { id } = router.query;
  const { user, loading: authLoading } = useAuth();

  const [formData, setFormData] = useState(() => buildAdminJobForm(job));

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);

  const draftOwnerId = user?.uid || '';
  const jobId = job?.id || '';
  const [appliedJobId, setAppliedJobId] = useState(jobId);

  useEffect(() => {
    if (!jobId) return;
    setFormData(buildAdminJobForm(job));
    setAppliedJobId(jobId);
  }, [job, jobId]);

  const jobDraftKey = useMemo(
    () =>
      createFormDraftKey({
        scope: 'admin-job',
        ownerId: draftOwnerId,
        resourceId: jobId,
      }),
    [draftOwnerId, jobId],
  );
  const jobDraftValue = useMemo(
    () => prepareAdminJobDraft(formData),
    [formData],
  );

  const getDraftToken = useCallback(async () => {
    if (!user) return '';
    return user.getIdToken();
  }, [user]);

  const restoreJobDraft = useCallback((draft) => {
    const restoredFields = prepareAdminJobDraft(draft);
    if (Object.keys(restoredFields).length === 0) return;
    setFormData((current) => ({ ...current, ...restoredFields }));
  }, []);

  const {
    status: jobDraftStatus,
    lastSavedAt: jobDraftSavedAt,
    isOnline: jobDraftIsOnline,
    clearDraft: clearJobDraft,
  } = useAutoDraft({
    storageKey: jobDraftKey,
    scope: 'admin-job',
    resourceId: jobId,
    value: jobDraftValue,
    onRestore: restoreJobDraft,
    getToken: getDraftToken,
    enabled: Boolean(draftOwnerId && jobId),
    ready:
      router.isReady &&
      !authLoading &&
      Boolean(draftOwnerId && jobId && job) &&
      appliedJobId === jobId,
    baseUpdatedAt: job?.updatedAt || '',
  });

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(false);

    try {
      const res = await fetch(`/api/admin/jobs/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.message || 'Erro ao atualizar vaga');
      }

      await clearJobDraft();
      setSuccess(true);
      setTimeout(() => {
        router.push('/dashboard/admin/jobs');
      }, 2000);
    } catch (err) {
      console.error('Erro ao atualizar vaga:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Head>
        <title>Editar Vaga - Admin Dashboard</title>
      </Head>

      <div
        className={adminStyles.legacyPage}
        style={{ maxWidth: 800, margin: '2.5rem auto', padding: '0 1.5rem' }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '1.5rem',
          }}
        >
          <div>
            <h1 style={{ margin: 0, fontSize: '2rem', color: '#1a202c' }}>
              Editar Vaga
            </h1>
            <AutoSaveStatus
              status={jobDraftStatus}
              lastSavedAt={jobDraftSavedAt}
              isOnline={jobDraftIsOnline}
            />
          </div>
          <Link
            href="/dashboard/admin/jobs"
            className={`${adminStyles.linkButton} ${adminStyles.buttonGhost} ${adminStyles.buttonSmall}`}
          >
            <FiArrowLeft aria-hidden="true" />
            Voltar para Vagas
          </Link>
        </div>

        {error && (
          <div
            role="alert"
            style={{
              padding: '1rem',
              backgroundColor: '#fed7d7',
              color: '#c53030',
              borderRadius: '0.375rem',
              marginBottom: '1.5rem',
            }}
          >
            {error}
          </div>
        )}

        {success && (
          <div
            role="status"
            aria-live="polite"
            style={{
              padding: '1rem',
              backgroundColor: '#c6f6d5',
              color: '#2f855a',
              borderRadius: '0.375rem',
              marginBottom: '1.5rem',
            }}
          >
            Vaga atualizada com sucesso! Redirecionando...
          </div>
        )}

        <div
          style={{
            backgroundColor: 'white',
            borderRadius: '0.5rem',
            padding: '2rem',
            boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
          }}
        >
          <div style={{ marginBottom: '1.5rem' }}>
            <p
              style={{
                margin: 0,
                fontSize: '0.875rem',
                fontWeight: '500',
                color: '#4a5568',
                marginBottom: '0.5rem',
              }}
            >
              Empresa
            </p>
            <p
              style={{
                margin: 0,
                fontSize: '1rem',
                color: '#2d3748',
                padding: '0.75rem',
                backgroundColor: '#f7fafc',
                borderRadius: '0.375rem',
              }}
            >
              {companyName || 'N/A'}
            </p>
          </div>

          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom: '1.5rem' }}>
              <label
                htmlFor="job-edit-title"
                style={{
                  display: 'block',
                  marginBottom: '0.5rem',
                  fontWeight: '500',
                  color: '#4a5568',
                }}
              >
                Título da Vaga
              </label>
              <input
                id="job-edit-title"
                type="text"
                name="titulo"
                value={formData.titulo}
                onChange={handleChange}
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  borderRadius: '0.375rem',
                  border: '1px solid #e2e8f0',
                  fontSize: '1rem',
                }}
                required
              />
            </div>

            <div style={{ marginBottom: '1.5rem' }}>
              <label
                htmlFor="job-edit-description"
                style={{
                  display: 'block',
                  marginBottom: '0.5rem',
                  fontWeight: '500',
                  color: '#4a5568',
                }}
              >
                Descrição
              </label>
              <textarea
                id="job-edit-description"
                name="descricao"
                value={formData.descricao}
                onChange={handleChange}
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  borderRadius: '0.375rem',
                  border: '1px solid #e2e8f0',
                  fontSize: '1rem',
                  minHeight: '150px',
                  resize: 'vertical',
                }}
                required
              />
            </div>

            <div style={{ marginBottom: '1.5rem' }}>
              <label
                htmlFor="job-edit-requirements"
                style={{
                  display: 'block',
                  marginBottom: '0.5rem',
                  fontWeight: '500',
                  color: '#4a5568',
                }}
              >
                Requisitos
              </label>
              <textarea
                id="job-edit-requirements"
                name="requisitos"
                value={formData.requisitos}
                onChange={handleChange}
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  borderRadius: '0.375rem',
                  border: '1px solid #e2e8f0',
                  fontSize: '1rem',
                  minHeight: '100px',
                  resize: 'vertical',
                }}
              />
            </div>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: '1.5rem',
                marginBottom: '1.5rem',
              }}
            >
              <div>
                <label
                  htmlFor="job-edit-salary"
                  style={{
                    display: 'block',
                    marginBottom: '0.5rem',
                    fontWeight: '500',
                    color: '#4a5568',
                  }}
                >
                  Salário
                </label>
                <input
                  id="job-edit-salary"
                  type="text"
                  name="salario"
                  value={formData.salario}
                  onChange={handleChange}
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    borderRadius: '0.375rem',
                    border: '1px solid #e2e8f0',
                    fontSize: '1rem',
                  }}
                />
              </div>

              <div>
                <label
                  htmlFor="job-edit-location"
                  style={{
                    display: 'block',
                    marginBottom: '0.5rem',
                    fontWeight: '500',
                    color: '#4a5568',
                  }}
                >
                  Localização
                </label>
                <input
                  id="job-edit-location"
                  type="text"
                  name="location"
                  value={formData.location}
                  onChange={handleChange}
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    borderRadius: '0.375rem',
                    border: '1px solid #e2e8f0',
                    fontSize: '1rem',
                  }}
                />
              </div>
            </div>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: '1.5rem',
                marginBottom: '1.5rem',
              }}
            >
              <div>
                <label
                  htmlFor="job-edit-contract"
                  style={{
                    display: 'block',
                    marginBottom: '0.5rem',
                    fontWeight: '500',
                    color: '#4a5568',
                  }}
                >
                  Tipo de Contrato
                </label>
                <select
                  id="job-edit-contract"
                  name="tipoContrato"
                  value={formData.tipoContrato}
                  onChange={handleChange}
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    borderRadius: '0.375rem',
                    border: '1px solid #e2e8f0',
                    fontSize: '1rem',
                    backgroundColor: 'white',
                  }}
                >
                  <option value="CLT">CLT</option>
                  <option value="PJ">PJ</option>
                  <option value="Estágio">Estágio</option>
                  <option value="Freelancer">Freelancer</option>
                  <option value="Temporário">Temporário</option>
                </select>
              </div>

              <div>
                <label
                  htmlFor="job-edit-deadline"
                  style={{
                    display: 'block',
                    marginBottom: '0.5rem',
                    fontWeight: '500',
                    color: '#4a5568',
                  }}
                >
                  Prazo de Inscrição
                </label>
                <input
                  id="job-edit-deadline"
                  type="date"
                  name="prazo"
                  value={formData.prazo}
                  onChange={handleChange}
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    borderRadius: '0.375rem',
                    border: '1px solid #e2e8f0',
                    fontSize: '1rem',
                  }}
                />
              </div>
            </div>

            <div style={{ marginBottom: '1.5rem' }}>
              <label
                htmlFor="job-edit-status"
                style={{
                  display: 'block',
                  marginBottom: '0.5rem',
                  fontWeight: '500',
                  color: '#4a5568',
                }}
              >
                Estado da vaga
              </label>
              <select
                id="job-edit-status"
                name="status"
                value={formData.status}
                onChange={handleChange}
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  borderRadius: '0.375rem',
                  border: '1px solid #e2e8f0',
                  fontSize: '1rem',
                  backgroundColor: 'white',
                }}
              >
                <option value="active">Ativa</option>
                <option value="closed">Fechada</option>
                <option value="disabled">Desativada</option>
              </select>
              <p
                style={{
                  fontSize: '0.875rem',
                  color: '#718096',
                  marginTop: '0.5rem',
                }}
              >
                <strong>Ativa:</strong> A vaga está aberta para candidaturas.
                <br />
                <strong>Fechada:</strong> O processo seletivo foi encerrado.
                <br />
                <strong>Desativada:</strong> A vaga foi temporariamente
                suspensa.
              </p>
            </div>

            <div
              style={{
                display: 'flex',
                justifyContent: 'flex-end',
                gap: '1rem',
                marginTop: '2rem',
              }}
            >
              <Link
                href="/dashboard/admin/jobs"
                className={`${adminStyles.linkButton} ${adminStyles.buttonGhost}`}
              >
                Cancelar
              </Link>
              <button
                type="submit"
                disabled={loading}
                className={`${adminStyles.buttonBase} ${adminStyles.buttonPrimary}`}
                style={{
                  cursor: loading ? 'not-allowed' : 'pointer',
                  opacity: loading ? 0.7 : 1,
                }}
              >
                {loading ? 'Salvando...' : 'Salvar Alterações'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </>
  );
}

// Serializa recursivamente dados do Firestore (Timestamps -> ISO, undefined ->
// null) para poderem passar por `getServerSideProps` sem erro de serialização.
function serializeForProps(value) {
  if (value === null || value === undefined) return null;
  if (typeof value !== 'object') return value;
  if (typeof value.toDate === 'function') {
    try {
      return value.toDate().toISOString();
    } catch (error) {
      return null;
    }
  }
  if (value instanceof Date) return value.toISOString();
  if (
    typeof value._seconds === 'number' &&
    typeof value._nanoseconds === 'number'
  ) {
    return new Date(
      value._seconds * 1000 + Math.floor(value._nanoseconds / 1e6),
    ).toISOString();
  }
  if (Array.isArray(value)) {
    return value.map((item) => serializeForProps(item));
  }
  const output = {};
  for (const [key, val] of Object.entries(value)) {
    output[key] = serializeForProps(val);
  }
  return output;
}

export async function getServerSideProps(context) {
  try {
    const { id } = context.params;

    // Obtém os cookies do contexto do servidor
    const cookies = nookies.get(context);

    if (!cookies.token) {
      return redirectToLogin(context);
    }

    // Verifica o token
    try {
      const token = await admin.auth().verifyIdToken(cookies.token);
      const adminUid = token.uid;

      // Busca perfil do administrador
      const adminDoc = await admin
        .firestore()
        .collection('users')
        .doc(adminUid)
        .get();
      if (!adminDoc.exists) {
        return redirectToLogin(context);
      }

      const adminData = adminDoc.data();

      // Verifica se é um administrador
      if (adminData.userType !== 'admin') {
        return redirectToLogin(context);
      }

      // Busca a vaga a ser editada
      const jobDoc = await admin.firestore().collection('jobs').doc(id).get();
      if (!jobDoc.exists) {
        return {
          notFound: true,
        };
      }

      const jobData = jobDoc.data();

      // Serializa todos os Timestamps do documento (createdAt, updatedAt,
      // closedAt, expiresAt, publishedAt, etc.) de forma recursiva.
      const serializedJob = serializeForProps({
        id: jobDoc.id,
        ...jobData,
      });

      // Busca informações da empresa
      let companyName =
        jobData.companyName ||
        jobData.empresaNome ||
        jobData.empresa ||
        'Empresa não encontrada';
      if (jobData.companyId) {
        const companyDoc = await admin
          .firestore()
          .collection('users')
          .doc(jobData.companyId)
          .get();
        if (companyDoc.exists) {
          const companyData = companyDoc.data();
          companyName = companyData.name || companyData.fullName || 'Empresa';
        }
      }

      return {
        props: {
          job: serializedJob,
          companyName,
        },
      };
    } catch (tokenError) {
      console.error('Erro ao verificar token:', tokenError);
      return redirectToLogin(context);
    }
  } catch (error) {
    console.error('Erro no getServerSideProps:', error);
    return redirectToLogin(context);
  }
}
