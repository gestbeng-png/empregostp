import { useState } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import Head from 'next/head';
import { admin } from '../../../lib/firebaseAdmin';
import nookies from 'nookies';
import adminStyles from '../../../styles/AdminPanel.module.css';
import { redirectToLogin } from '../../../lib/loginRedirect';

export default function AdminServices({ services = [] }) {
  const router = useRouter();
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [showAddModal, setShowAddModal] = useState(false);
  const [newService, setNewService] = useState({
    title: '',
    description: '',
    category: 'formacao',
    status: 'active',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  // Filtrar serviços com base na pesquisa e no status
  const filteredServices = services.filter((service) => {
    const matchesSearch =
      service.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      service.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      service.category?.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesStatus =
      filterStatus === 'all' || service.status === filterStatus;

    return matchesSearch && matchesStatus;
  });

  const handleChange = (e) => {
    const { name, value } = e.target;
    setNewService((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleAddService = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const res = await fetch('/api/admin/services', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(newService),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.message || 'Erro ao adicionar serviço');
      }

      await res.json();
      setSuccess('Serviço adicionado com sucesso!');
      setNewService({
        title: '',
        description: '',
        category: 'formacao',
        status: 'active',
      });
      setShowAddModal(false);

      // Recarregar a página após 2 segundos para mostrar o novo serviço
      setTimeout(() => {
        router.reload();
      }, 2000);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const getCategoryLabel = (category) => {
    switch (category) {
      case 'formacao':
        return 'Formação';
      case 'consultoria':
        return 'Consultoria';
      case 'mentoria':
        return 'Mentoria';
      case 'workshop':
        return 'Workshop';
      case 'curso':
        return 'Curso';
      default:
        return category;
    }
  };

  return (
    <>
      <Head>
        <title>Gerir serviços - Admin</title>
      </Head>

      <div
        className={adminStyles.legacyPage}
        style={{ maxWidth: 1200, margin: '2.5rem auto', padding: '0 1.5rem' }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '1.5rem',
          }}
        >
          <h1 style={{ margin: 0, fontSize: '2rem', color: '#1a202c' }}>
            Gerir serviços
          </h1>
          <Link
            href="/dashboard/admin"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: '0.5rem 1rem',
              borderRadius: '0.375rem',
              backgroundColor: '#f7fafc',
              border: '1px solid #e2e8f0',
              color: '#4a5568',
              textDecoration: 'none',
              fontSize: '0.875rem',
            }}
          >
            <svg
              width="16"
              height="16"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M10 19l-7-7m0 0l7-7m-7 7h18"
              />
            </svg>
            Voltar ao Dashboard
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
            {success}
          </div>
        )}

        {/* Filtros e pesquisa */}
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            justifyContent: 'space-between',
            gap: '1rem',
            marginBottom: '2rem',
            padding: '1.5rem',
            backgroundColor: 'white',
            borderRadius: '0.5rem',
            boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
          }}
        >
          <div
            style={{
              display: 'flex',
              gap: '1rem',
              flex: '1',
              flexWrap: 'wrap',
            }}
          >
            <div style={{ flex: '1 1 300px' }}>
              <label
                htmlFor="admin-services-search"
                style={{
                  display: 'block',
                  marginBottom: '0.5rem',
                  fontSize: '0.875rem',
                  color: '#4a5568',
                }}
              >
                Pesquisar serviços
              </label>
              <input
                id="admin-services-search"
                type="search"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Título, descrição ou categoria"
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  borderRadius: '0.375rem',
                  border: '1px solid #e2e8f0',
                  fontSize: '1rem',
                }}
              />
            </div>

            <div style={{ flex: '0 1 200px' }}>
              <label
                htmlFor="admin-services-status"
                style={{
                  display: 'block',
                  marginBottom: '0.5rem',
                  fontSize: '0.875rem',
                  color: '#4a5568',
                }}
              >
                Filtrar por status
              </label>
              <select
                id="admin-services-status"
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  borderRadius: '0.375rem',
                  border: '1px solid #e2e8f0',
                  fontSize: '1rem',
                  backgroundColor: 'white',
                }}
              >
                <option value="all">Todos</option>
                <option value="active">Ativos</option>
                <option value="inactive">Inativos</option>
              </select>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'flex-end' }}>
            <button
              onClick={() => setShowAddModal(true)}
              style={{
                padding: '0.75rem 1.5rem',
                backgroundColor: '#805ad5',
                color: 'white',
                borderRadius: '0.375rem',
                border: 'none',
                fontSize: '0.875rem',
                fontWeight: '500',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
              }}
            >
              <svg
                width="16"
                height="16"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M12 6v6m0 0v6m0-6h6m-6 0H6"
                />
              </svg>
              Adicionar Serviço
            </button>
          </div>
        </div>

        {/* Tabela de serviços */}
        <div
          style={{
            backgroundColor: 'white',
            borderRadius: '0.5rem',
            boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
            overflowX: 'auto',
          }}
        >
          {filteredServices.length === 0 ? (
            <div
              style={{ padding: '2rem', textAlign: 'center', color: '#718096' }}
            >
              Nenhum serviço encontrado com os filtros atuais.
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ backgroundColor: '#f7fafc', textAlign: 'left' }}>
                  <th
                    style={{
                      padding: '1rem',
                      borderBottom: '1px solid #e2e8f0',
                    }}
                  >
                    Título
                  </th>
                  <th
                    style={{
                      padding: '1rem',
                      borderBottom: '1px solid #e2e8f0',
                    }}
                  >
                    Categoria
                  </th>
                  <th
                    style={{
                      padding: '1rem',
                      borderBottom: '1px solid #e2e8f0',
                    }}
                  >
                    Estado
                  </th>
                  <th
                    style={{
                      padding: '1rem',
                      borderBottom: '1px solid #e2e8f0',
                    }}
                  >
                    Data de Criação
                  </th>
                  <th
                    style={{
                      padding: '1rem',
                      borderBottom: '1px solid #e2e8f0',
                    }}
                  >
                    Ações
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredServices.map((service) => (
                  <tr
                    key={service.id}
                    style={{ borderBottom: '1px solid #e2e8f0' }}
                  >
                    <td style={{ padding: '1rem' }}>{service.title}</td>
                    <td style={{ padding: '1rem' }}>
                      {getCategoryLabel(service.category)}
                    </td>
                    <td style={{ padding: '1rem' }}>
                      <StatusBadge status={service.status} />
                    </td>
                    <td style={{ padding: '1rem' }}>
                      {service.createdAt
                        ? new Date(service.createdAt).toLocaleDateString()
                        : 'N/A'}
                    </td>
                    <td style={{ padding: '1rem' }}>
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <Link
                          href={`/dashboard/admin/services/${service.id}`}
                          style={{
                            padding: '0.5rem 0.75rem',
                            backgroundColor: '#4299e1',
                            color: 'white',
                            borderRadius: '0.25rem',
                            textDecoration: 'none',
                            fontSize: '0.75rem',
                          }}
                        >
                          Ver
                        </Link>
                        <Link
                          href={`/dashboard/admin/services/${service.id}`}
                          style={{
                            padding: '0.5rem 0.75rem',
                            backgroundColor: '#38b2ac',
                            color: 'white',
                            borderRadius: '0.25rem',
                            textDecoration: 'none',
                            fontSize: '0.75rem',
                          }}
                        >
                          Editar
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Modal para adicionar serviço */}
      {showAddModal && (
        <div
          role="presentation"
          onMouseDown={() => !loading && setShowAddModal(false)}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            zIndex: 1000,
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="add-service-title"
            onMouseDown={(event) => event.stopPropagation()}
            style={{
              backgroundColor: 'white',
              borderRadius: '0.5rem',
              padding: '2rem',
              width: '90%',
              maxWidth: '600px',
              maxHeight: '90vh',
              overflow: 'auto',
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '1.5rem',
              }}
            >
              <h2
                id="add-service-title"
                style={{ margin: 0, fontSize: '1.5rem', color: '#1a202c' }}
              >
                Adicionar novo serviço
              </h2>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                aria-label="Fechar janela"
                disabled={loading}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: '1.5rem',
                  color: '#718096',
                }}
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleAddService}>
              <div style={{ marginBottom: '1.5rem' }}>
                <label
                  htmlFor="new-service-title"
                  style={{
                    display: 'block',
                    marginBottom: '0.5rem',
                    fontWeight: '500',
                    color: '#4a5568',
                  }}
                >
                  Título do Serviço
                </label>
                <input
                  id="new-service-title"
                  type="text"
                  name="title"
                  value={newService.title}
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
                  htmlFor="new-service-description"
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
                  id="new-service-description"
                  name="description"
                  value={newService.description}
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
                  htmlFor="new-service-category"
                  style={{
                    display: 'block',
                    marginBottom: '0.5rem',
                    fontWeight: '500',
                    color: '#4a5568',
                  }}
                >
                  Categoria
                </label>
                <select
                  id="new-service-category"
                  name="category"
                  value={newService.category}
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
                  <option value="formacao">Formação</option>
                  <option value="consultoria">Consultoria</option>
                  <option value="mentoria">Mentoria</option>
                  <option value="workshop">Workshop</option>
                  <option value="curso">Curso</option>
                </select>
              </div>

              <div style={{ marginBottom: '1.5rem' }}>
                <label
                  htmlFor="new-service-status"
                  style={{
                    display: 'block',
                    marginBottom: '0.5rem',
                    fontWeight: '500',
                    color: '#4a5568',
                  }}
                >
                  Estado
                </label>
                <select
                  id="new-service-status"
                  name="status"
                  value={newService.status}
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
                  <option value="active">Ativo</option>
                  <option value="inactive">Inativo</option>
                </select>
              </div>

              <div
                style={{
                  display: 'flex',
                  justifyContent: 'flex-end',
                  gap: '1rem',
                  marginTop: '2rem',
                }}
              >
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  style={{
                    padding: '0.75rem 1.5rem',
                    backgroundColor: '#e2e8f0',
                    color: '#4a5568',
                    borderRadius: '0.375rem',
                    border: 'none',
                    fontSize: '0.875rem',
                    fontWeight: '500',
                    cursor: 'pointer',
                  }}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  style={{
                    padding: '0.75rem 1.5rem',
                    backgroundColor: '#805ad5',
                    color: 'white',
                    borderRadius: '0.375rem',
                    border: 'none',
                    fontSize: '0.875rem',
                    fontWeight: '500',
                    cursor: loading ? 'not-allowed' : 'pointer',
                    opacity: loading ? 0.7 : 1,
                  }}
                >
                  {loading ? 'A adicionar...' : 'Adicionar serviço'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}

// Componente para badge de status
function StatusBadge({ status }) {
  let color = '#718096';
  let bgColor = '#edf2f7';
  let label = 'Desconhecido';

  if (status === 'active') {
    color = '#047857';
    bgColor = '#d1fae5';
    label = 'Ativo';
  } else if (status === 'inactive') {
    color = '#4b5563';
    bgColor = '#e5e7eb';
    label = 'Inativo';
  }

  return (
    <span
      style={{
        display: 'inline-block',
        padding: '0.25rem 0.75rem',
        borderRadius: '9999px',
        fontSize: '0.75rem',
        fontWeight: '500',
        backgroundColor: bgColor,
        color: color,
      }}
    >
      {label}
    </span>
  );
}

export async function getServerSideProps(context) {
  try {
    // Obtém os cookies do contexto do servidor
    const cookies = nookies.get(context);

    if (!cookies.token) {
      return redirectToLogin(context);
    }

    // Verifica o token
    try {
      const token = await admin.auth().verifyIdToken(cookies.token);
      const { uid } = token;

      // Busca perfil do usuário
      const userDoc = await admin
        .firestore()
        .collection('users')
        .doc(uid)
        .get();
      if (!userDoc.exists) {
        return redirectToLogin(context);
      }

      const userData = userDoc.data();

      // Verifica se é um administrador
      if (userData.userType !== 'admin') {
        return redirectToLogin(context);
      }

      // Buscar todos os serviços
      const servicesSnapshot = await admin
        .firestore()
        .collection('services')
        .get();
      const services = servicesSnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));

      return {
        props: { services },
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
