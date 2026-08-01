import Head from 'next/head';
import Link from 'next/link';
import { useState } from 'react';
import nookies from 'nookies';
import adminStyles from '../../../../styles/AdminPanel.module.css';
import { admin } from '../../../../lib/firebaseAdmin';
import { serializeForProps } from '../../../../lib/firestoreNormalize';
import { redirectToLogin } from '../../../../lib/loginRedirect';

export default function AdminServiceDetail({ service }) {
  const [svc, setSvc] = useState(service);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  async function updateStatus(newStatus) {
    try {
      setLoading(true);
      setMessage('');
      const res = await fetch(`/api/admin/services/${svc.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: svc.title,
          description: svc.description,
          category: svc.category,
          status: newStatus,
        }),
      });
      if (!res.ok) throw new Error('Falha ao atualizar serviço');
      setSvc({ ...svc, status: newStatus });
      setMessage('Serviço atualizado com sucesso');
    } catch (e) {
      setMessage(e.message);
    } finally {
      setLoading(false);
    }
  }

  async function deleteService() {
    if (!confirm('Tem certeza que deseja excluir este serviço?')) return;
    try {
      setLoading(true);
      setMessage('');
      const res = await fetch(`/api/admin/services/${svc.id}`, {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error('Falha ao excluir serviço');
      setMessage('Serviço excluído com sucesso');
    } catch (e) {
      setMessage(e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <Head>
        <title>Admin - Serviço {svc?.title || svc?.id}</title>
      </Head>
      <div
        className={adminStyles.legacyPage}
        style={{ maxWidth: 1100, margin: '2rem auto', padding: '0 1rem' }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '1.5rem',
          }}
        >
          <h1 style={{ margin: 0 }}>Detalhes do Serviço</h1>
          <Link
            href="/dashboard/admin/services"
            style={{
              textDecoration: 'none',
              background: '#f7fafc',
              border: '1px solid #e2e8f0',
              color: '#4a5568',
              padding: '.5rem .8rem',
              borderRadius: 6,
            }}
          >
            Voltar
          </Link>
        </div>

        {message && (
          <div
            role={message.includes('sucesso') ? 'status' : 'alert'}
            aria-live="polite"
            style={{
              marginBottom: '1rem',
              padding: '.8rem 1rem',
              borderRadius: 6,
              background: message.includes('sucesso') ? '#f0fff4' : '#fff5f5',
              color: message.includes('sucesso') ? '#2f855a' : '#c53030',
            }}
          >
            {message}
          </div>
        )}

        <section
          style={{
            background: '#fff',
            border: '1px solid #e2e8f0',
            borderRadius: 8,
            padding: '1.25rem',
          }}
        >
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '1rem',
            }}
          >
            <div>
              <h2 style={{ marginTop: 0 }}>{svc.title}</h2>
              <p style={{ color: '#4a5568' }}>
                <strong>Categoria:</strong> {svc.category}
              </p>
              <p style={{ color: '#4a5568' }}>
                <strong>Estado:</strong> {svc.status}
              </p>
            </div>
            <div>
              <p style={{ marginTop: 0 }}>
                <strong>Criado em:</strong>{' '}
                {svc.createdAt ? new Date(svc.createdAt).toLocaleString() : '—'}
              </p>
              <p>
                <strong>Atualizado em:</strong>{' '}
                {svc.updatedAt ? new Date(svc.updatedAt).toLocaleString() : '—'}
              </p>
              <div
                style={{ display: 'flex', gap: '.5rem', marginTop: '.75rem' }}
              >
                <button
                  disabled={loading || svc.status === 'active'}
                  onClick={() => updateStatus('active')}
                  style={{
                    padding: '.5rem .9rem',
                    background: '#3182ce',
                    color: '#fff',
                    border: 'none',
                    borderRadius: 6,
                    cursor:
                      loading || svc.status === 'active'
                        ? 'not-allowed'
                        : 'pointer',
                  }}
                >
                  Ativar
                </button>
                <button
                  disabled={loading || svc.status === 'inactive'}
                  onClick={() => updateStatus('inactive')}
                  style={{
                    padding: '.5rem .9rem',
                    background: '#4a5568',
                    color: '#fff',
                    border: 'none',
                    borderRadius: 6,
                    cursor:
                      loading || svc.status === 'inactive'
                        ? 'not-allowed'
                        : 'pointer',
                  }}
                >
                  Inativar
                </button>
                <button
                  disabled={loading}
                  onClick={deleteService}
                  style={{
                    padding: '.5rem .9rem',
                    background: '#e53e3e',
                    color: '#fff',
                    border: 'none',
                    borderRadius: 6,
                    cursor: loading ? 'not-allowed' : 'pointer',
                  }}
                >
                  Excluir
                </button>
              </div>
            </div>
          </div>

          <div style={{ marginTop: '1.25rem' }}>
            <h3>Descrição</h3>
            <p style={{ whiteSpace: 'pre-wrap', color: '#2d3748' }}>
              {svc.description || 'Sem descrição'}
            </p>
          </div>
        </section>
      </div>
    </>
  );
}

function tsToMillis(ts) {
  if (!ts) return null;
  if (typeof ts.toMillis === 'function') return ts.toMillis();
  if (typeof ts.toDate === 'function') return ts.toDate().getTime();
  if (typeof ts === 'number') return ts;
  return null;
}

export async function getServerSideProps(ctx) {
  try {
    const cookies = nookies.get(ctx);
    if (!cookies.token) {
      return redirectToLogin(ctx);
    }

    const token = await admin.auth().verifyIdToken(cookies.token);
    const adminDoc = await admin
      .firestore()
      .collection('users')
      .doc(token.uid)
      .get();
    if (!adminDoc.exists || adminDoc.data().userType !== 'admin') {
      return redirectToLogin(ctx);
    }

    const { id } = ctx.query;
    const doc = await admin.firestore().collection('services').doc(id).get();
    if (!doc.exists) {
      return { notFound: true };
    }
    const data = doc.data();
    const service = serializeForProps({
      id: doc.id,
      ...data,
      createdAt: tsToMillis(data.createdAt),
      updatedAt: tsToMillis(data.updatedAt),
    });
    return { props: { service } };
  } catch (e) {
    console.error('Erro ao carregar serviço admin:', e);
    return redirectToLogin(ctx);
  }
}
