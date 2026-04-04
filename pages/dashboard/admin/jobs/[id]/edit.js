import { useState } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import Head from 'next/head';
import { admin } from '../../../../../lib/firebaseAdmin';
import nookies from 'nookies';
import LandingHeader from '../../../../../components/LandingHeader';

export default function EditJob({ job, companyName }) {
  const router = useRouter();
  const { id } = router.query;

  const [formData, setFormData] = useState({
    titulo: job?.titulo || '',
    descricao: job?.descricao || '',
    requisitos: job?.requisitos || '',
    salario: job?.salario || '',
    location: job?.location || '',
    tipoContrato: job?.tipoContrato || 'CLT',
    status: job?.status || 'active',
    prazo: job?.prazo || ''
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
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
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(formData)
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.message || 'Erro ao atualizar vaga');
      }

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
      <LandingHeader />

      <main style={{ maxWidth: 800, margin: '2.5rem auto', padding: '0 1.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
          <h1 style={{ margin: 0, fontSize: '2rem', color: '#1a202c' }}>Editar Vaga</h1>
          <Link href="/dashboard/admin/jobs" style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            padding: '0.5rem 1rem',
            borderRadius: '0.375rem',
            backgroundColor: '#f7fafc',
            border: '1px solid #e2e8f0',
            color: '#4a5568',
            textDecoration: 'none',
            fontSize: '0.875rem'
          }}>
            <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Voltar para Vagas
          </Link>
        </div>

        {error && (
          <div style={{
            padding: '1rem',
            backgroundColor: '#fed7d7',
            color: '#c53030',
            borderRadius: '0.375rem',
            marginBottom: '1.5rem'
          }}>
            {error}
          </div>
        )}

        {success && (
          <div style={{
            padding: '1rem',
            backgroundColor: '#c6f6d5',
            color: '#2f855a',
            borderRadius: '0.375rem',
            marginBottom: '1.5rem'
          }}>
            Vaga atualizada com sucesso! Redirecionando...
          </div>
        )}

        <div style={{
          backgroundColor: 'white',
          borderRadius: '0.5rem',
          padding: '2rem',
          boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
        }}>
          <div style={{ marginBottom: '1.5rem' }}>
            <p style={{
              margin: 0,
              fontSize: '0.875rem',
              fontWeight: '500',
              color: '#4a5568',
              marginBottom: '0.5rem'
            }}>
              Empresa
            </p>
            <p style={{
              margin: 0,
              fontSize: '1rem',
              color: '#2d3748',
              padding: '0.75rem',
              backgroundColor: '#f7fafc',
              borderRadius: '0.375rem'
            }}>
              {companyName || 'N/A'}
            </p>
          </div>

          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500', color: '#4a5568' }}>
                Título da Vaga
              </label>
              <input
                type="text"
                name="titulo"
                value={formData.titulo}
                onChange={handleChange}
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  borderRadius: '0.375rem',
                  border: '1px solid #e2e8f0',
                  fontSize: '1rem'
                }}
                required
              />
            </div>

            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500', color: '#4a5568' }}>
                Descrição
              </label>
              <textarea
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
                  resize: 'vertical'
                }}
                required
              />
            </div>

            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500', color: '#4a5568' }}>
                Requisitos
              </label>
              <textarea
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
                  resize: 'vertical'
                }}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: '1.5rem' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500', color: '#4a5568' }}>
                  Salário
                </label>
                <input
                  type="text"
                  name="salario"
                  value={formData.salario}
                  onChange={handleChange}
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    borderRadius: '0.375rem',
                    border: '1px solid #e2e8f0',
                    fontSize: '1rem'
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500', color: '#4a5568' }}>
                  Localização
                </label>
                <input
                  type="text"
                  name="location"
                  value={formData.location}
                  onChange={handleChange}
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    borderRadius: '0.375rem',
                    border: '1px solid #e2e8f0',
                    fontSize: '1rem'
                  }}
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: '1.5rem' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500', color: '#4a5568' }}>
                  Tipo de Contrato
                </label>
                <select
                  name="tipoContrato"
                  value={formData.tipoContrato}
                  onChange={handleChange}
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    borderRadius: '0.375rem',
                    border: '1px solid #e2e8f0',
                    fontSize: '1rem',
                    backgroundColor: 'white'
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
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500', color: '#4a5568' }}>
                  Prazo de Inscrição
                </label>
                <input
                  type="date"
                  name="prazo"
                  value={formData.prazo}
                  onChange={handleChange}
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    borderRadius: '0.375rem',
                    border: '1px solid #e2e8f0',
                    fontSize: '1rem'
                  }}
                />
              </div>
            </div>

            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500', color: '#4a5568' }}>
                Status da Vaga
              </label>
              <select
                name="status"
                value={formData.status}
                onChange={handleChange}
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  borderRadius: '0.375rem',
                  border: '1px solid #e2e8f0',
                  fontSize: '1rem',
                  backgroundColor: 'white'
                }}
              >
                <option value="active">Ativa</option>
                <option value="closed">Fechada</option>
                <option value="disabled">Desativada</option>
              </select>
              <p style={{ fontSize: '0.875rem', color: '#718096', marginTop: '0.5rem' }}>
                <strong>Ativa:</strong> A vaga está aberta para candidaturas.<br />
                <strong>Fechada:</strong> O processo seletivo foi encerrado.<br />
                <strong>Desativada:</strong> A vaga foi temporariamente suspensa.
              </p>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginTop: '2rem' }}>
              <Link href="/dashboard/admin/jobs" style={{
                padding: '0.75rem 1.5rem',
                borderRadius: '0.375rem',
                border: '1px solid #e2e8f0',
                color: '#4a5568',
                textDecoration: 'none',
                fontSize: '0.875rem',
                fontWeight: '500'
              }}>
                Cancelar
              </Link>
              <button
                type="submit"
                disabled={loading}
                style={{
                  padding: '0.75rem 1.5rem',
                  backgroundColor: '#4299e1',
                  color: 'white',
                  borderRadius: '0.375rem',
                  border: 'none',
                  fontSize: '0.875rem',
                  fontWeight: '500',
                  cursor: loading ? 'not-allowed' : 'pointer',
                  opacity: loading ? 0.7 : 1
                }}
              >
                {loading ? 'Salvando...' : 'Salvar Alterações'}
              </button>
            </div>
          </form>
        </div>
      </main>
    </>
  );
}

export async function getServerSideProps(context) {
  try {
    const { id } = context.params;

    // Obtém os cookies do contexto do servidor
    const cookies = nookies.get(context);

    if (!cookies.token) {
      return { redirect: { destination: '/login', permanent: false } };
    }

    // Verifica o token
    try {
      const token = await admin.auth().verifyIdToken(cookies.token);
      const adminUid = token.uid;

      // Busca perfil do administrador
      const adminDoc = await admin.firestore().collection('users').doc(adminUid).get();
      if (!adminDoc.exists) {
        return { redirect: { destination: '/login', permanent: false } };
      }

      const adminData = adminDoc.data();

      // Verifica se é um administrador
      if (adminData.userType !== 'admin') {
        return { redirect: { destination: '/login', permanent: false } };
      }

      // Busca a vaga a ser editada
      const jobDoc = await admin.firestore().collection('jobs').doc(id).get();
      if (!jobDoc.exists) {
        return {
          notFound: true
        };
      }

      const jobData = jobDoc.data();

      // Serialize Firestore Timestamps
      const serializedJob = {
        id: jobDoc.id,
        ...jobData,
        createdAt: jobData.createdAt?.toDate?.()?.toISOString() || jobData.createdAt || null,
        updatedAt: jobData.updatedAt?.toDate?.()?.toISOString() || jobData.updatedAt || null,
        lastViewedAt: jobData.lastViewedAt?.toDate?.()?.toISOString() || jobData.lastViewedAt || null,
        expiresAt: jobData.expiresAt?.toDate?.()?.toISOString() || jobData.expiresAt || null,
      };

      // Busca informações da empresa
      let companyName = 'Empresa não encontrada';
      if (jobData.companyId) {
        const companyDoc = await admin.firestore().collection('users').doc(jobData.companyId).get();
        if (companyDoc.exists) {
          const companyData = companyDoc.data();
          companyName = companyData.name || companyData.fullName || 'Empresa';
        }
      }

      return {
        props: {
          job: serializedJob,
          companyName
        }
      };
    } catch (tokenError) {
      console.error('Erro ao verificar token:', tokenError);
      return { redirect: { destination: '/login', permanent: false } };
    }
  } catch (error) {
    console.error('Erro no getServerSideProps:', error);
    return { redirect: { destination: '/login', permanent: false } };
  }
} 