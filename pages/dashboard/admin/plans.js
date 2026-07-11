import { useState, useEffect } from 'react';
import { getAuth } from 'firebase/auth';
import Link from 'next/link';
import Head from 'next/head';
import LandingHeader from '../../../components/LandingHeader';
import { requireAdminPageAuth } from '../../../lib/adminPageGuard';
import { normalizeUserType } from '../../../lib/defaultPlans';
import { getCandidateMarketingPlans } from '../../../lib/candidateCatalog';
import styles from '../../../styles/AdminPanel.module.css';

// Os planos de candidato são fixos (Verificação, Profissional, Premium): o admin
// edita-os, mas não cria/apaga planos avulsos. O dashboard do candidato lê
// exatamente estes 3 planos canónicos.
const FIXED_CANDIDATE_PLANS = getCandidateMarketingPlans({
  includeBasic: false,
  includeVerification: true,
});

function buildFixedCandidatePlans(firestorePlans) {
  const byId = (firestorePlans || []).reduce((acc, plan) => {
    acc[plan.id] = plan;
    return acc;
  }, {});

  return FIXED_CANDIDATE_PLANS.map((base) => {
    const override = byId[base.id] || {};
    return {
      ...base,
      ...override,
      id: base.id,
      type: 'candidato',
      priceLabel: override.priceLabel || base.priceLabel,
      features: Array.isArray(override.features) && override.features.length
        ? override.features
        : base.features,
    };
  });
}

const PLAN_SECTIONS = [
  {
    type: 'empresa',
    title: 'Planos para Empresas',
    accent: '#f59e0b',
    createBg: 'rgba(245, 158, 11, 0.18)',
    createBorder: 'rgba(245, 158, 11, 0.35)',
    createColor: '#fbbf24'
  },
  {
    type: 'candidato',
    title: 'Planos para Candidatos',
    accent: '#10b981',
    createBg: 'rgba(16, 185, 129, 0.18)',
    createBorder: 'rgba(16, 185, 129, 0.35)',
    createColor: '#34d399'
  }
];

const getMessageTone = (message) => {
  const normalized = String(message || '').toLowerCase();
  return normalized.includes('sucesso') || normalized.includes('aprovado') || normalized.includes('atualizado')
    ? styles.alertSuccess
    : styles.alertError;
};

const getRequestStatusConfig = (status) => {
  switch (status) {
    case 'payment_submitted':
      return {
        label: 'Comprovativo enviado',
        backgroundColor: 'rgba(59, 130, 246, 0.18)',
        color: '#93c5fd',
        border: '1px solid rgba(59, 130, 246, 0.3)'
      };
    case 'pending':
      return {
        label: 'Aguardando comprovativo',
        backgroundColor: 'rgba(245, 158, 11, 0.18)',
        color: '#fbbf24',
        border: '1px solid rgba(245, 158, 11, 0.3)'
      };
    case 'approved':
      return {
        label: 'Aprovado',
        backgroundColor: 'rgba(16, 185, 129, 0.18)',
        color: '#34d399',
        border: '1px solid rgba(16, 185, 129, 0.3)'
      };
    case 'rejected':
      return {
        label: 'Rejeitado',
        backgroundColor: 'rgba(239, 68, 68, 0.18)',
        color: '#f87171',
        border: '1px solid rgba(239, 68, 68, 0.3)'
      };
    default:
      return {
        label: status || 'Desconhecido',
        backgroundColor: 'rgba(148, 163, 184, 0.18)',
        color: '#cbd5e1',
        border: '1px solid rgba(148, 163, 184, 0.3)'
      };
  }
};

const getUserTypeConfig = (userType) => {
  if (userType === 'empresa') {
    return {
      label: 'Empresa',
      backgroundColor: 'rgba(245, 158, 11, 0.18)',
      color: '#fbbf24',
      border: '1px solid rgba(245, 158, 11, 0.3)'
    };
  }

  return {
    label: 'Candidato',
    backgroundColor: 'rgba(16, 185, 129, 0.18)',
    color: '#34d399',
    border: '1px solid rgba(16, 185, 129, 0.3)'
  };
};

const formatRequestDate = (request) => {
  const value = request.requestDate || request.createdAt || null;
  if (!value) return '---';

  const date = new Date(value.seconds ? value.seconds * 1000 : value);
  if (Number.isNaN(date.getTime())) return '---';

  return date.toLocaleDateString('pt-PT', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  });
};

const formatPlanDuration = (duration) => {
  if (duration === 0) return '∞';
  if (duration === null || duration === undefined || duration === '') return '---';
  return `${duration}d`;
};

const renderFeatureList = (features) => {
  if (!features?.length) {
    return <span className={styles.listCompactEmpty}>—</span>;
  }

  return (
    <ul className={styles.listCompact}>
      {features.map((feature, index) => (
        <li key={`${feature}-${index}`}>{feature}</li>
      ))}
    </ul>
  );
};

function StatCard({ title, value, color }) {
  return (
    <div className={styles.statCard} style={{ '--accent-color': color }}>
      <p className={styles.statValue}>{value}</p>
      <p className={styles.statLabel}>{title}</p>
    </div>
  );
}

export default function AdminPlans() {
  const [plans, setPlans] = useState([]);
  const [requests, setRequests] = useState([]);
  const [stats, setStats] = useState({
    totalRequests: 0,
    pendingRequests: 0,
    approvedRequests: 0,
    rejectedRequests: 0
  });
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [activeTab, setActiveTab] = useState('plans');
  const [planType, setPlanType] = useState('empresa');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPlan, setEditingPlan] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    price: '',
    priceLabel: '',
    duration: '',
    type: 'empresa',
    vagasLimit: '',
    destaque: false,
    curriculoDestacado: false,
    features: [],
    isActive: true
  });

  useEffect(() => {
    loadData();
  }, []);

  const resetForm = () => {
    setFormData({
      name: '',
      price: '',
      priceLabel: '',
      duration: '',
      type: planType,
      vagasLimit: '',
      destaque: false,
      curriculoDestacado: false,
      features: [],
      isActive: true
    });
    setEditingPlan(null);
  };

  const openModal = (plan = null, typeForNew = 'empresa') => {
    const resolvedType = plan ? (normalizeUserType(plan.type) || 'empresa') : typeForNew;
    setPlanType(resolvedType);

    if (plan) {
      setFormData({
        ...plan,
        type: resolvedType,
        features: plan.features || [],
        vagasLimit: plan.vagasLimit?.toString() || '',
        duration: plan.duration?.toString() || ''
      });
      setEditingPlan(plan);
    } else {
      setFormData({
        name: '',
        price: '',
        priceLabel: '',
        duration: '',
        type: resolvedType,
        vagasLimit: '',
        destaque: false,
        curriculoDestacado: false,
        features: [],
        isActive: true
      });
      setEditingPlan(null);
    }

    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    resetForm();
  };

  const handleInputChange = (event) => {
    const { name, value, type, checked } = event.target;

    if (type === 'checkbox') {
      setFormData((prev) => ({ ...prev, [name]: checked }));
      return;
    }

    if (name === 'features') {
      setFormData((prev) => ({ ...prev, features: value.split('\n').filter((feature) => feature.trim()) }));
      return;
    }

    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  async function handleSubmit(event) {
    event.preventDefault();

    try {
      setLoading(true);
      const auth = getAuth();
      const token = await auth.currentUser?.getIdToken();
      if (!token) {
        window.location.href = '/login';
        return;
      }

      const planData = {
        ...formData,
        type: planType,
        price: parseFloat(formData.price),
        duration: parseInt(formData.duration, 10),
        vagasLimit: formData.vagasLimit ? parseInt(formData.vagasLimit, 10) : null
      };

      const url = editingPlan ? `/api/admin/plans/${editingPlan.id}` : '/api/admin/plans';
      const method = editingPlan ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(planData)
      });

      if (!res.ok) throw new Error('Falha ao salvar plano');

      setMessage(editingPlan ? 'Plano atualizado com sucesso!' : 'Plano criado com sucesso!');
      await loadData();
      closeModal();
    } catch (error) {
      console.error('Erro ao salvar plano:', error);
      setMessage('Erro ao salvar plano');
    } finally {
      setLoading(false);
    }
  }

  async function handleDeletePlan(planId) {
    if (!window.confirm('Tem certeza que deseja excluir este plano?')) return;

    try {
      setLoading(true);
      const auth = getAuth();
      const token = await auth.currentUser?.getIdToken();
      if (!token) {
        window.location.href = '/login';
        return;
      }

      const res = await fetch(`/api/admin/plans/${planId}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

      if (!res.ok) throw new Error('Falha ao excluir plano');

      setMessage('Plano excluído com sucesso!');
      await loadData();
    } catch (error) {
      console.error('Erro ao excluir plano:', error);
      setMessage('Erro ao excluir plano');
    } finally {
      setLoading(false);
    }
  }

  async function loadData() {
    try {
      const auth = getAuth();
      const token = await auth.currentUser?.getIdToken();
      if (!token) {
        window.location.href = '/login';
        return;
      }

      const plansRes = await fetch('/api/admin/plans', {
        headers: { Authorization: `Bearer ${token}` }
      });
      const plansData = await plansRes.json();
      setPlans(plansData.plans || []);

      const requestsRes = await fetch('/api/admin/subscription-requests?status=all&pageSize=200', {
        headers: { Authorization: `Bearer ${token}` }
      });

      let requestsArr = [];
      if (!requestsRes.ok) {
        console.error('Erro ao buscar pedidos:', requestsRes.status, await requestsRes.text());
        setMessage('Falha ao carregar pedidos. Verifique o console para detalhes.');
        setRequests([]);
      } else {
        const requestsData = await requestsRes.json();
        requestsArr = requestsData.requests || [];
        setRequests(requestsArr);
      }

      const statsData = requestsArr.reduce(
        (acc, req) => {
          acc.totalRequests += 1;
          if (req.status === 'pending' || req.status === 'payment_submitted') acc.pendingRequests += 1;
          if (req.status === 'approved') acc.approvedRequests += 1;
          if (req.status === 'rejected') acc.rejectedRequests += 1;
          return acc;
        },
        {
          totalRequests: 0,
          pendingRequests: 0,
          approvedRequests: 0,
          rejectedRequests: 0
        }
      );

      setStats(statsData);
    } catch (error) {
      console.error('Erro geral ao carregar dados:', error);
      setMessage('Erro ao carregar dados. Verifique o console.');
    } finally {
      setLoading(false);
    }
  }

  async function handleAction(requestId, action) {
    try {
      setLoading(true);
      const auth = getAuth();
      const token = await auth.currentUser?.getIdToken();
      if (!token) {
        window.location.href = '/login';
        return;
      }

      const res = await fetch(`/api/admin/subscription-requests/${requestId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ action })
      });

      if (!res.ok) throw new Error('Falha ao processar pedido');

      setMessage(action === 'approve' ? 'Pedido aprovado com sucesso!' : 'Pedido rejeitado');
      await loadData();
    } catch (error) {
      console.error('Erro ao processar pedido:', error);
      setMessage('Erro ao processar pedido');
    } finally {
      setLoading(false);
    }
  }

  async function handleCreatePlans() {
    try {
      setLoading(true);
      const auth = getAuth();
      const token = await auth.currentUser?.getIdToken();
      if (!token) {
        window.location.href = '/login';
        return;
      }

      const res = await fetch('/api/admin/plans/setup', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

      if (!res.ok) throw new Error('Falha ao criar planos');

      setMessage('Planos criados com sucesso!');
      await loadData();
    } catch (error) {
      console.error('Erro ao criar planos:', error);
      setMessage('Erro ao criar planos');
    } finally {
      setLoading(false);
    }
  }

  const renderPlansTable = (planKind, sectionPlans, { allowDelete = true } = {}) => {
    if (!sectionPlans.length) {
      return (
        <div className={styles.emptyState}>
          <p className={styles.emptyText}>Nenhum plano cadastrado para este tipo.</p>
        </div>
      );
    }

    return (
      <div className={styles.tableShell}>
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr className={styles.tableHeadRow}>
                <th className={styles.tableHeadCell}>Nome</th>
                <th className={styles.tableHeadCell}>Preço</th>
                {planKind === 'empresa' ? (
                  <>
                    <th className={`${styles.tableHeadCell} ${styles.alignCenter}`}>Vagas</th>
                    <th className={`${styles.tableHeadCell} ${styles.alignCenter}`}>Destaque</th>
                  </>
                ) : (
                  <th className={`${styles.tableHeadCell} ${styles.alignCenter}`}>Currículo destacado</th>
                )}
                <th className={`${styles.tableHeadCell} ${styles.alignCenter}`}>Duração</th>
                <th className={styles.tableHeadCell}>Recursos</th>
                <th className={`${styles.tableHeadCell} ${styles.alignRight}`}>Ações</th>
              </tr>
            </thead>
            <tbody>
              {sectionPlans.map((plan) => (
                <tr key={plan.id} className={styles.tableRow}>
                  <td className={`${styles.tableCell} ${styles.tableCellStrong}`}>{plan.name}</td>
                  <td className={`${styles.tableCell} ${styles.tableCellStrong}`}>{plan.priceLabel}</td>
                  {planKind === 'empresa' ? (
                    <>
                      <td className={`${styles.tableCell} ${styles.alignCenter} ${styles.tableCellMuted}`}>
                        {plan.vagasLimit === null ? '∞' : plan.vagasLimit}
                      </td>
                      <td className={`${styles.tableCell} ${styles.alignCenter}`}>
                        <span
                          className={`${styles.badge} ${styles.badgeSmall}`}
                          style={{
                            '--badge-bg': plan.destaque ? 'rgba(16, 185, 129, 0.18)' : 'rgba(100, 116, 139, 0.18)',
                            '--badge-color': plan.destaque ? '#34d399' : '#94a3b8',
                            '--badge-border': plan.destaque ? '1px solid rgba(16, 185, 129, 0.3)' : '1px solid rgba(100, 116, 139, 0.3)'
                          }}
                        >
                          {plan.destaque ? 'Ativo' : 'Não'}
                        </span>
                      </td>
                    </>
                  ) : (
                    <td className={`${styles.tableCell} ${styles.alignCenter}`}>
                      <span
                        className={`${styles.badge} ${styles.badgeSmall}`}
                        style={{
                          '--badge-bg': plan.curriculoDestacado ? 'rgba(16, 185, 129, 0.18)' : 'rgba(100, 116, 139, 0.18)',
                          '--badge-color': plan.curriculoDestacado ? '#34d399' : '#94a3b8',
                          '--badge-border': plan.curriculoDestacado ? '1px solid rgba(16, 185, 129, 0.3)' : '1px solid rgba(100, 116, 139, 0.3)'
                        }}
                      >
                        {plan.curriculoDestacado ? 'Sim' : 'Não'}
                      </span>
                    </td>
                  )}
                  <td className={`${styles.tableCell} ${styles.alignCenter} ${styles.tableCellMuted}`}>{formatPlanDuration(plan.duration)}</td>
                  <td className={styles.tableCell}>{renderFeatureList(plan.features)}</td>
                  <td className={`${styles.tableCell} ${styles.alignRight}`}>
                    <div className={styles.buttonGroup}>
                      <button
                        type="button"
                        onClick={() => openModal(plan)}
                        className={`${styles.buttonBase} ${styles.buttonAccent} ${styles.buttonSmall}`}
                        style={{ '--button-bg': 'rgba(59, 130, 246, 0.18)', '--button-border': 'rgba(59, 130, 246, 0.35)', '--button-color': '#93c5fd' }}
                      >
                        Editar
                      </button>
                      {allowDelete ? (
                        <button
                          type="button"
                          onClick={() => handleDeletePlan(plan.id)}
                          className={`${styles.buttonBase} ${styles.buttonAccent} ${styles.buttonSmall}`}
                          style={{ '--button-bg': 'rgba(239, 68, 68, 0.18)', '--button-border': 'rgba(239, 68, 68, 0.35)', '--button-color': '#fca5a5' }}
                        >
                          Excluir
                        </button>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  const renderPlanSection = ({ type, title, accent, createBg, createBorder, createColor }) => {
    const isCandidate = type === 'candidato';
    const sectionPlans = isCandidate
      ? buildFixedCandidatePlans(plans)
      : plans.filter((plan) => normalizeUserType(plan.type) === type);

    return (
      <section className={styles.section} key={type}>
        <div className={styles.sectionHeading}>
          <div className={styles.sectionTitleWrap}>
            <h2 className={styles.sectionTitle} style={{ '--accent-color': accent }}>{title}</h2>
            <span className={styles.countBadge}>{sectionPlans.length}</span>
          </div>
          {isCandidate ? (
            <span className={styles.metaText}>Planos fixos — edite nome, preço e recursos.</span>
          ) : (
            <button
              type="button"
              onClick={() => openModal(null, type)}
              className={`${styles.buttonBase} ${styles.buttonAccent} ${styles.buttonSmall}`}
              style={{ '--button-bg': createBg, '--button-border': createBorder, '--button-color': createColor }}
            >
              + Novo plano
            </button>
          )}
        </div>

        {renderPlansTable(type, sectionPlans, { allowDelete: !isCandidate })}
      </section>
    );
  };

  const renderRequestsTable = () => {
    if (!requests.length) {
      return (
        <div className={styles.emptyState}>
          <p className={styles.emptyText}>Nenhum pedido de assinatura encontrado.</p>
        </div>
      );
    }

    return (
      <div className={styles.tableShell}>
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr className={styles.tableHeadRow}>
                <th className={styles.tableHeadCell}>Usuário</th>
                <th className={styles.tableHeadCell}>Tipo</th>
                <th className={styles.tableHeadCell}>Plano</th>
                <th className={styles.tableHeadCell}>Preço</th>
                <th className={styles.tableHeadCell}>Data do pedido</th>
                <th className={styles.tableHeadCell}>Status</th>
                <th className={`${styles.tableHeadCell} ${styles.alignCenter}`}>Ações</th>
              </tr>
            </thead>
            <tbody>
              {requests.map((request) => {
                const status = getRequestStatusConfig(request.status);
                const userType = getUserTypeConfig(request.userType);
                const canApprove = request.status === 'payment_submitted' || (Number(request.price || 0) === 0 && request.status === 'pending');

                return (
                  <tr key={request.id} className={styles.tableRow}>
                    <td className={styles.tableCell}>
                      <div className={styles.tableCellStrong}>{request.userName}</div>
                      <div className={styles.metaText}>{request.userEmail}</div>
                    </td>
                    <td className={styles.tableCell}>
                      <span
                        className={`${styles.badge} ${styles.badgeSmall}`}
                        style={{ '--badge-bg': userType.backgroundColor, '--badge-color': userType.color, '--badge-border': userType.border }}
                      >
                        {userType.label}
                      </span>
                    </td>
                    <td className={`${styles.tableCell} ${styles.tableCellStrong}`}>{request.planName}</td>
                    <td className={`${styles.tableCell} ${styles.tableCellStrong}`}>{request.priceLabel}</td>
                    <td className={`${styles.tableCell} ${styles.tableCellMuted}`}>{formatRequestDate(request)}</td>
                    <td className={styles.tableCell}>
                      <span
                        className={styles.badge}
                        style={{ '--badge-bg': status.backgroundColor, '--badge-color': status.color, '--badge-border': status.border }}
                      >
                        {status.label}
                      </span>
                    </td>
                    <td className={`${styles.tableCell} ${styles.alignCenter}`}>
                      {(request.status === 'pending' || request.status === 'payment_submitted') ? (
                        <div className={styles.buttonGroupCenter}>
                          <button
                            type="button"
                            onClick={() => handleAction(request.id, 'approve')}
                            disabled={loading || !canApprove}
                            className={`${styles.buttonBase} ${styles.buttonAccent} ${styles.buttonSmall}`}
                            style={{
                              '--button-bg': canApprove ? 'rgba(16, 185, 129, 0.18)' : 'rgba(148, 163, 184, 0.12)',
                              '--button-border': canApprove ? 'rgba(16, 185, 129, 0.32)' : 'rgba(148, 163, 184, 0.18)',
                              '--button-color': canApprove ? '#34d399' : '#94a3b8'
                            }}
                          >
                            Aprovar
                          </button>
                          <button
                            type="button"
                            onClick={() => handleAction(request.id, 'reject')}
                            disabled={loading}
                            className={`${styles.buttonBase} ${styles.buttonDanger} ${styles.buttonSmall}`}
                          >
                            Rejeitar
                          </button>
                        </div>
                      ) : (
                        <span className={styles.tableCellSoft}>Sem ações</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  return (
    <>
      <Head>
        <title>Gerenciar Planos - Admin</title>
      </Head>
      <LandingHeader />

      <main className={styles.page}>
        <div className={styles.headerCard}>
          <div className={styles.headerCopy}>
            <Link
              href="/dashboard/admin"
              className={`${styles.linkButton} ${styles.buttonAccent} ${styles.buttonSmall}`}
              style={{ '--button-bg': 'rgba(255, 255, 255, 0.04)', '--button-border': 'rgba(255, 255, 255, 0.1)', '--button-color': '#93c5fd' }}
            >
              ← Voltar ao Dashboard
            </Link>
            <h1 className={styles.headerTitle}>Gestão de Planos</h1>
            <p className={styles.headerSubtitle}>Gerencie planos ativos e acompanhe os pedidos de assinatura a partir do mesmo fluxo visual.</p>
          </div>
          <div className={styles.headerActions}>
            <button type="button" onClick={handleCreatePlans} disabled={loading} className={`${styles.buttonBase} ${styles.buttonAccent}`} style={{ '--button-bg': 'rgba(59, 130, 246, 0.18)', '--button-border': 'rgba(59, 130, 246, 0.3)', '--button-color': '#60a5fa' }}>
              Criar Planos Padrão
            </button>
          </div>
        </div>

        {message ? (
          <div className={`${styles.alert} ${getMessageTone(message)}`}>
            {message}
          </div>
        ) : null}

        <section className={styles.section}>
          <div className={styles.gridStats}>
            <StatCard title="Total de Pedidos" value={stats.totalRequests} color="#3b82f6" />
            <StatCard title="Pendentes" value={stats.pendingRequests} color="#f59e0b" />
            <StatCard title="Aprovados" value={stats.approvedRequests} color="#10b981" />
            <StatCard title="Rejeitados" value={stats.rejectedRequests} color="#ef4444" />
          </div>
        </section>

        <div className={styles.tabs}>
          <button
            type="button"
            onClick={() => setActiveTab('plans')}
            className={`${styles.tab} ${activeTab === 'plans' ? styles.tabActive : ''}`}
          >
            Planos
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('requests')}
            className={`${styles.tab} ${activeTab === 'requests' ? styles.tabActive : ''}`}
          >
            Pedidos de Assinatura
          </button>
        </div>

        {loading ? (
          <div className={styles.loadingState}>
            <div className={`${styles.spinner} ${styles.spinnerLarge}`} />
            <p className={styles.loadingText}>Carregando gestão de planos...</p>
          </div>
        ) : activeTab === 'plans' ? (
          <>
            {PLAN_SECTIONS.map((section) => renderPlanSection(section))}
          </>
        ) : (
          <section className={styles.section}>
            {renderRequestsTable()}
          </section>
        )}
      </main>

      {isModalOpen ? (
        <div className={styles.modalOverlay} onClick={closeModal}>
          <div className={`${styles.modalCard} ${styles.modalCardLarge}`} onClick={(event) => event.stopPropagation()}>
            <div className={`${styles.modalHeader} ${styles.sectionHeading}`}>
              <div>
                <h2 className={styles.modalTitle}>
                  {editingPlan ? 'Editar Plano' : 'Criar Novo Plano'} — {planType === 'empresa' ? 'Empresa' : 'Candidato'}
                </h2>
                <p className={styles.modalSubtitle}>Atualize nome, preço, recursos e regras do plano selecionado.</p>
              </div>
              <button type="button" onClick={closeModal} className={`${styles.buttonBase} ${styles.buttonGhost} ${styles.buttonSmall}`}>
                Fechar
              </button>
            </div>

            <form onSubmit={handleSubmit}>
              <div className={styles.formGrid}>
                <div className={styles.formField}>
                  <label htmlFor="plan-name" className={styles.formLabel}>Nome do Plano</label>
                  <input id="plan-name" type="text" name="name" value={formData.name} onChange={handleInputChange} required className={styles.inputControl} />
                </div>

                <div className={styles.formField}>
                  <label htmlFor="plan-price" className={styles.formLabel}>Preço (em Dobras)</label>
                  <input id="plan-price" type="number" name="price" value={formData.price} onChange={handleInputChange} required className={styles.inputControl} />
                </div>

                <div className={styles.formField}>
                  <label htmlFor="plan-price-label" className={styles.formLabel}>Rótulo de Preço</label>
                  <input id="plan-price-label" type="text" name="priceLabel" value={formData.priceLabel} onChange={handleInputChange} required className={styles.inputControl} />
                </div>

                <div className={styles.formField}>
                  <label htmlFor="plan-duration" className={styles.formLabel}>Duração (em dias)</label>
                  <input id="plan-duration" type="number" name="duration" value={formData.duration} onChange={handleInputChange} required className={styles.inputControl} />
                </div>

                {planType === 'empresa' ? (
                  <div className={styles.formField}>
                    <label htmlFor="plan-vagas-limit" className={styles.formLabel}>Limite de Vagas</label>
                    <input
                      id="plan-vagas-limit"
                      type="number"
                      name="vagasLimit"
                      value={formData.vagasLimit}
                      onChange={handleInputChange}
                      className={styles.inputControl}
                      placeholder="Deixe vazio para ilimitado"
                    />
                  </div>
                ) : null}

                <div className={`${styles.formField} ${styles.formFieldFull}`}>
                  <label htmlFor="plan-features" className={styles.formLabel}>Recursos do Plano</label>
                  <textarea
                    id="plan-features"
                    name="features"
                    value={formData.features.join('\n')}
                    onChange={handleInputChange}
                    rows="6"
                    className={styles.textareaControl}
                    placeholder="Digite cada recurso em uma linha"
                  />
                </div>

                {planType === 'empresa' ? (
                  <label className={`${styles.checkboxField} ${styles.formFieldFull}`}>
                    <input type="checkbox" name="destaque" checked={formData.destaque} onChange={handleInputChange} />
                    Vagas em destaque
                  </label>
                ) : (
                  <label className={`${styles.checkboxField} ${styles.formFieldFull}`}>
                    <input type="checkbox" name="curriculoDestacado" checked={formData.curriculoDestacado} onChange={handleInputChange} />
                    Currículo destacado
                  </label>
                )}

                <label className={`${styles.checkboxField} ${styles.formFieldFull}`}>
                  <input type="checkbox" name="isActive" checked={formData.isActive} onChange={handleInputChange} />
                  Plano ativo
                </label>
              </div>

              <div className={styles.buttonGroupEnd}>
                <button type="button" onClick={closeModal} className={`${styles.buttonBase} ${styles.buttonGhost}`}>
                  Cancelar
                </button>
                <button type="submit" disabled={loading} className={`${styles.buttonBase} ${styles.buttonPrimary}`}>
                  {loading ? 'Processando...' : editingPlan ? 'Atualizar Plano' : 'Criar Plano'}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </>
  );
}

export async function getServerSideProps(context) {
  const authResult = await requireAdminPageAuth(context);
  if (!authResult.ok) {
    return { redirect: authResult.redirect };
  }

  return { props: {} };
}
