import { useState, useEffect } from 'react';
import { getAuth } from 'firebase/auth';
import Link from 'next/link';
import Head from 'next/head';
import LandingHeader from '../../../components/LandingHeader';
import { requireAdminPageAuth } from '../../../lib/adminPageGuard';

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

  // Estilos padrão para inputs
  const inputStyle = {
    width: '100%',
    padding: '0.75rem',
    background: 'rgba(255, 255, 255, 0.05)',
    border: '1px solid rgba(255, 255, 255, 0.2)',
    borderRadius: '8px',
    color: 'white',
    fontSize: '0.95rem',
    transition: 'all 0.3s ease'
  };

  const labelStyle = {
    display: 'block',
    marginBottom: '0.5rem',
    color: 'white',
    fontWeight: '600',
    fontSize: '0.95rem'
  };

  const checkboxLabelStyle = {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    color: 'white',
    fontWeight: '500',
    fontSize: '0.95rem',
    cursor: 'pointer'
  };

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

  const openModal = (plan = null) => {
    if (plan) {
      setFormData({
        ...plan,
        features: plan.features || [],
        vagasLimit: plan.vagasLimit?.toString() || '',
        duration: plan.duration?.toString() || ''
      });
      setEditingPlan(plan);
    } else {
      resetForm();
    }
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    resetForm();
  };

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    if (type === 'checkbox') {
      setFormData(prev => ({ ...prev, [name]: checked }));
    } else if (name === 'features') {
      setFormData(prev => ({ ...prev, features: value.split('\n').filter(f => f.trim()) }));
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }
  };

  async function handleSubmit(e) {
    e.preventDefault();
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
        duration: parseInt(formData.duration),
        vagasLimit: formData.vagasLimit ? parseInt(formData.vagasLimit) : null
      };

      const url = editingPlan 
        ? `/api/admin/plans/${editingPlan.id}`
        : '/api/admin/plans';

      const res = await fetch(url, {
        method: editingPlan ? 'PUT' : 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(planData)
      });

      if (!res.ok) throw new Error('Falha ao salvar plano');

      setMessage(editingPlan ? 'Plano atualizado com sucesso!' : 'Plano criado com sucesso!');
      loadData();
      closeModal();
    } catch (error) {
      console.error('Erro ao salvar plano:', error);
      setMessage('Erro ao salvar plano');
    } finally {
      setLoading(false);
    }
  }

  async function handleDeletePlan(planId) {
    if (!confirm('Tem certeza que deseja excluir este plano?')) return;

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
      loadData();
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

      // Carregar planos (mantido como está)
      const plansRes = await fetch('/api/admin/plans', {
        headers: { Authorization: `Bearer ${token}` }
      });
      const plansData = await plansRes.json();
      setPlans(plansData.plans);

      // Carregar pedidos com logging e erro handling
      const requestsRes = await fetch('/api/admin/subscription-requests?status=all&pageSize=200', {
        headers: { Authorization: `Bearer ${token}` }
      });
      let requestsArr = [];
      if (!requestsRes.ok) {
        console.error('Erro ao buscar pedidos: ', requestsRes.status, await requestsRes.text());
        setMessage('Falha ao carregar pedidos. Verifique o console para detalhes.');
        setRequests([]);  // Definir como array vazio para evitar erros
      } else {
        const requestsData = await requestsRes.json();
        requestsArr = requestsData.requests || [];
        setRequests(requestsArr);
      }

      // Calcular estatísticas
      const stats = requestsArr.reduce((acc, req) => {
        acc.totalRequests++;
        if (req.status === 'pending' || req.status === 'payment_submitted') acc.pendingRequests++;
        if (req.status === 'approved') acc.approvedRequests++;
        if (req.status === 'rejected') acc.rejectedRequests++;
        return acc;
      }, {
        totalRequests: 0,
        pendingRequests: 0,
        approvedRequests: 0,
        rejectedRequests: 0
      });
      setStats(stats);

    } catch (error) {
      console.error('Erro geral ao carregar dados: ', error);
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
      loadData();
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
      loadData();
    } catch (error) {
      console.error('Erro ao criar planos:', error);
      setMessage('Erro ao criar planos');
    } finally {
      setLoading(false);
    }
  }

  const filteredPlans = plans.filter(plan => plan.type === planType);

  const renderPlanTable = () => {
    if (planType === 'empresa') {
      return (
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: 'rgba(255, 255, 255, 0.05)', borderBottom: '1px solid rgba(255, 255, 255, 0.1)' }}>
              <th style={{ padding: '1rem', textAlign: 'left', color: 'white', fontWeight: '700' }}>Nome</th>
              <th style={{ padding: '1rem', textAlign: 'left', color: 'white', fontWeight: '700' }}>Preço</th>
              <th style={{ padding: '1rem', textAlign: 'center', color: 'white', fontWeight: '700' }}>Vagas</th>
              <th style={{ padding: '1rem', textAlign: 'center', color: 'white', fontWeight: '700' }}>Destaque</th>
              <th style={{ padding: '1rem', textAlign: 'center', color: 'white', fontWeight: '700' }}>Duração</th>
              <th style={{ padding: '1rem', textAlign: 'left', color: 'white', fontWeight: '700' }}>Recursos</th>
              <th style={{ padding: '1rem', textAlign: 'right', color: 'white', fontWeight: '700' }}>Ações</th>
            </tr>
          </thead>
          <tbody>
            {filteredPlans.map((plan) => (
              <tr key={plan.id} style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.05)' }}>
                <td style={{ padding: '1rem', color: 'white', fontWeight: '600' }}>{plan.name}</td>
                <td style={{ padding: '1rem', color: '#34d399', fontWeight: '700' }}>{plan.priceLabel}</td>
                <td style={{ padding: '1rem', textAlign: 'center', color: 'rgba(255, 255, 255, 0.8)' }}>
                  {plan.vagasLimit === null ? '∞' : `${plan.vagasLimit}`}
                </td>
                <td style={{ padding: '1rem', textAlign: 'center' }}>
                  {plan.destaque ? (
                    <span style={{ color: '#34d399', fontWeight: '700' }}>✓</span>
                  ) : (
                    <span style={{ color: '#64748b' }}>—</span>
                  )}
                </td>
                <td style={{ padding: '1rem', textAlign: 'center', color: 'rgba(255, 255, 255, 0.8)' }}>
                  {plan.duration === 0 ? '∞' : `${plan.duration}d`}
                </td>
                <td style={{ padding: '1rem' }}>
                  <ul style={{ margin: 0, paddingLeft: '1.2rem', color: 'rgba(255, 255, 255, 0.8)', fontSize: '0.9rem' }}>
                    {plan.features?.map((feature, index) => (
                      <li key={index}>{feature}</li>
                    )) || <span style={{ color: 'rgba(255, 255, 255, 0.5)' }}>—</span>}
                  </ul>
                </td>
                <td style={{ padding: '1rem', textAlign: 'right' }}>
                  <div style={{ display: 'inline-flex', gap: '0.5rem' }}>
                    <button
                      type="button"
                      onClick={() => openModal(plan)}
                      style={{
                        padding: '0.45rem 0.8rem',
                        borderRadius: '8px',
                        border: '1px solid rgba(59, 130, 246, 0.35)',
                        background: 'rgba(59, 130, 246, 0.18)',
                        color: '#93c5fd',
                        fontWeight: '600',
                        cursor: 'pointer'
                      }}
                    >
                      Editar
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeletePlan(plan.id)}
                      style={{
                        padding: '0.45rem 0.8rem',
                        borderRadius: '8px',
                        border: '1px solid rgba(239, 68, 68, 0.35)',
                        background: 'rgba(239, 68, 68, 0.18)',
                        color: '#fca5a5',
                        fontWeight: '600',
                        cursor: 'pointer'
                      }}
                    >
                      Excluir
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      );
    } else {
      return (
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: 'rgba(255, 255, 255, 0.05)', borderBottom: '1px solid rgba(255, 255, 255, 0.1)' }}>
              <th style={{ padding: '1rem', textAlign: 'left', color: 'white', fontWeight: '700' }}>Nome</th>
              <th style={{ padding: '1rem', textAlign: 'left', color: 'white', fontWeight: '700' }}>Preço</th>
              <th style={{ padding: '1rem', textAlign: 'center', color: 'white', fontWeight: '700' }}>Currículo Destacado</th>
              <th style={{ padding: '1rem', textAlign: 'center', color: 'white', fontWeight: '700' }}>Duração</th>
              <th style={{ padding: '1rem', textAlign: 'left', color: 'white', fontWeight: '700' }}>Recursos do Plano</th>
              <th style={{ padding: '1rem', textAlign: 'right', color: 'white', fontWeight: '700' }}>Ações</th>
            </tr>
          </thead>
          <tbody>
            {filteredPlans.map((plan) => (
              <tr key={plan.id} style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.05)' }}>
                <td style={{ padding: '1rem', color: 'white', fontWeight: '600' }}>{plan.name}</td>
                <td style={{ padding: '1rem', color: '#34d399', fontWeight: '700' }}>{plan.priceLabel}</td>
                <td style={{ padding: '1rem', textAlign: 'center' }}>
                  {plan.curriculoDestacado ? (
                    <span style={{ color: '#34d399', fontWeight: '700' }}>✓ Sim</span>
                  ) : (
                    <span style={{ color: '#64748b' }}>✗ Não</span>
                  )}
                </td>
                <td style={{ padding: '1rem', textAlign: 'center', color: 'rgba(255, 255, 255, 0.8)' }}>
                  {plan.duration === 0 ? '∞' : `${plan.duration}d`}
                </td>
                <td style={{ padding: '1rem' }}>
                  <ul style={{ margin: 0, paddingLeft: '1.2rem', color: 'rgba(255, 255, 255, 0.8)', fontSize: '0.9rem' }}>
                    {plan.features?.map((feature, index) => (
                      <li key={index} style={{ color: 'rgba(255, 255, 255, 0.8)' }}>{feature}</li>
                    )) || <span style={{ color: 'rgba(255, 255, 255, 0.5)' }}>—</span>}
                  </ul>
                </td>
                <td style={{ padding: '1rem', textAlign: 'right' }}>
                  <div style={{ display: 'inline-flex', gap: '0.5rem' }}>
                    <button
                      type="button"
                      onClick={() => openModal(plan)}
                      style={{
                        padding: '0.45rem 0.8rem',
                        borderRadius: '8px',
                        border: '1px solid rgba(59, 130, 246, 0.35)',
                        background: 'rgba(59, 130, 246, 0.18)',
                        color: '#93c5fd',
                        fontWeight: '600',
                        cursor: 'pointer'
                      }}
                    >
                      Editar
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeletePlan(plan.id)}
                      style={{
                        padding: '0.45rem 0.8rem',
                        borderRadius: '8px',
                        border: '1px solid rgba(239, 68, 68, 0.35)',
                        background: 'rgba(239, 68, 68, 0.18)',
                        color: '#fca5a5',
                        fontWeight: '600',
                        cursor: 'pointer'
                      }}
                    >
                      Excluir
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      );
    }
  };

  return (
    <>
      <Head>
        <title>Gerenciar Planos - Admin</title>
        <style>{`
          body {
            background: linear-gradient(180deg, #0a0e1a 0%, #1a1f35 100%);
            min-height: 100vh;
          }
        `}</style>
      </Head>
      <LandingHeader />
      <main style={{ maxWidth: '1400px', margin: '0 auto', padding: '2rem', minHeight: '100vh' }}>
        
        {/* Header */}
        <div style={{ marginBottom: '2rem' }}>
          <Link href="/dashboard/admin" style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.5rem',
            color: '#60a5fa',
            textDecoration: 'none',
            fontWeight: '600',
            marginBottom: '1rem'
          }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M19 12H5M12 19l-7-7 7-7"/>
            </svg>
            Voltar ao Dashboard
          </Link>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
            <div>
              <h1 style={{ margin: '0', fontSize: '2.5rem', color: 'white', fontWeight: '900' }}>
                Gestão de Planos
              </h1>
              <p style={{ margin: '0.5rem 0 0 0', color: 'rgba(255, 255, 255, 0.7)', fontSize: '1.05rem' }}>
                Gerencie planos e solicitações de assinatura
              </p>
            </div>
          <div style={{ display: 'flex', gap: '1rem' }}>
            <button
              onClick={() => openModal()}
              style={{
                padding: '0.75rem 1.5rem',
                  background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                color: 'white',
                border: 'none',
                  borderRadius: '12px',
                  fontWeight: '700',
                  cursor: 'pointer',
                  boxShadow: '0 4px 15px rgba(16, 185, 129, 0.4)'
              }}
            >
              Criar Novo Plano
            </button>
            <button
              onClick={handleCreatePlans}
              disabled={loading}
              style={{
                padding: '0.75rem 1.5rem',
                  background: 'rgba(59, 130, 246, 0.2)',
                  color: '#60a5fa',
                  border: '2px solid rgba(59, 130, 246, 0.3)',
                  borderRadius: '12px',
                  fontWeight: '700',
                  cursor: loading ? 'not-allowed' : 'pointer',
                  opacity: loading ? 0.5 : 1
              }}
            >
              Criar Planos Padrão
            </button>
            </div>
          </div>
        </div>

        {message && (
          <div style={{ 
            background: message.includes('sucesso') ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
            border: `1px solid ${message.includes('sucesso') ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`,
            borderRadius: '12px',
            padding: '1rem 1.25rem',
            marginBottom: '2rem',
            color: message.includes('sucesso') ? '#6ee7b7' : '#fca5a5',
            fontWeight: '600'
          }}>
            {message}
          </div>
        )}

        {/* Estatísticas */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.5rem', marginBottom: '2rem' }}>
          <StatCard title="Total de Pedidos" value={stats.totalRequests} color="#3b82f6" />
          <StatCard title="Pendentes" value={stats.pendingRequests} color="#f59e0b" />
          <StatCard title="Aprovados" value={stats.approvedRequests} color="#10b981" />
          <StatCard title="Rejeitados" value={stats.rejectedRequests} color="#ef4444" />
        </div>

        {/* Tabs */}
        <div style={{
          background: 'rgba(255, 255, 255, 0.05)',
          backdropFilter: 'blur(10px)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          borderRadius: '16px',
          padding: '1rem',
          marginBottom: '2rem',
          display: 'flex',
          gap: '0.5rem',
          flexWrap: 'wrap'
        }}>
          <button
            onClick={() => setActiveTab('plans')}
            style={{
              padding: '0.75rem 1.5rem',
              background: activeTab === 'plans' ? 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)' : 'transparent',
              border: activeTab === 'plans' ? 'none' : '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: '12px',
              color: activeTab === 'plans' ? 'white' : 'rgba(255, 255, 255, 0.7)',
              fontWeight: '600',
              cursor: 'pointer',
              transition: 'all 0.3s ease',
              fontSize: '0.95rem',
              boxShadow: activeTab === 'plans' ? '0 4px 15px rgba(59, 130, 246, 0.4)' : 'none'
            }}
          >
            Planos
          </button>
          <button
            onClick={() => setActiveTab('requests')}
            style={{
              padding: '0.75rem 1.5rem',
              background: activeTab === 'requests' ? 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)' : 'transparent',
              border: activeTab === 'requests' ? 'none' : '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: '12px',
              color: activeTab === 'requests' ? 'white' : 'rgba(255, 255, 255, 0.7)',
              fontWeight: '600',
              cursor: 'pointer',
              transition: 'all 0.3s ease',
              fontSize: '0.95rem',
              boxShadow: activeTab === 'requests' ? '0 4px 15px rgba(59, 130, 246, 0.4)' : 'none'
            }}
          >
            Pedidos de Assinatura
          </button>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '4rem 2rem' }}>
            <div style={{ 
              width: '50px', 
              height: '50px', 
              margin: '0 auto 1.5rem', 
              border: '4px solid rgba(255, 255, 255, 0.1)',
              borderTop: '4px solid #60a5fa',
              borderRadius: '50%',
              animation: 'spin 1s linear infinite'
            }}></div>
            <style jsx>{`
              @keyframes spin {
                0% { transform: rotate(0deg); }
                100% { transform: rotate(360deg); }
              }
            `}</style>
            <p style={{ color: 'rgba(255, 255, 255, 0.8)', fontSize: '1.05rem' }}>Carregando...</p>
          </div>
        ) : activeTab === 'plans' ? (
          <>
            {/* Seletor de tipo de plano */}
            <div style={{ marginBottom: '2rem', display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                <button
                  onClick={() => setPlanType('empresa')}
                  style={{
                    padding: '0.75rem 1.5rem',
                  background: planType === 'empresa' ? 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)' : 'rgba(255, 255, 255, 0.05)',
                  color: planType === 'empresa' ? 'white' : 'rgba(255, 255, 255, 0.7)',
                  border: planType === 'empresa' ? 'none' : '1px solid rgba(255, 255, 255, 0.1)',
                  borderRadius: '12px',
                    cursor: 'pointer',
                  fontWeight: '700',
                  fontSize: '0.95rem',
                  transition: 'all 0.3s ease',
                  boxShadow: planType === 'empresa' ? '0 4px 15px rgba(245, 158, 11, 0.4)' : 'none'
                  }}
                >
                  Planos para Empresas
                </button>
                <button
                  onClick={() => setPlanType('candidato')}
                  style={{
                    padding: '0.75rem 1.5rem',
                  background: planType === 'candidato' ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)' : 'rgba(255, 255, 255, 0.05)',
                  color: planType === 'candidato' ? 'white' : 'rgba(255, 255, 255, 0.7)',
                  border: planType === 'candidato' ? 'none' : '1px solid rgba(255, 255, 255, 0.1)',
                  borderRadius: '12px',
                    cursor: 'pointer',
                  fontWeight: '700',
                  fontSize: '0.95rem',
                  transition: 'all 0.3s ease',
                  boxShadow: planType === 'candidato' ? '0 4px 15px rgba(16, 185, 129, 0.4)' : 'none'
                  }}
                >
                  Planos para Candidatos
                </button>
            </div>

            <div style={{
              background: 'rgba(255, 255, 255, 0.05)',
              backdropFilter: 'blur(10px)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: '16px',
              overflow: 'hidden'
            }}>
            <div style={{ overflowX: 'auto' }}>
              {renderPlanTable()}
              </div>
            </div>
          </>
        ) : (
          <div style={{
            background: 'rgba(255, 255, 255, 0.05)',
            backdropFilter: 'blur(10px)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            borderRadius: '16px',
            overflow: 'hidden'
          }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                  <tr style={{ background: 'rgba(255, 255, 255, 0.05)', borderBottom: '1px solid rgba(255, 255, 255, 0.1)' }}>
                    <th style={{ padding: '1rem', textAlign: 'left', color: 'white', fontWeight: '700' }}>Usuário</th>
                    <th style={{ padding: '1rem', textAlign: 'left', color: 'white', fontWeight: '700' }}>Tipo</th>
                    <th style={{ padding: '1rem', textAlign: 'left', color: 'white', fontWeight: '700' }}>Plano</th>
                    <th style={{ padding: '1rem', textAlign: 'left', color: 'white', fontWeight: '700' }}>Preço</th>
                    <th style={{ padding: '1rem', textAlign: 'left', color: 'white', fontWeight: '700' }}>Data do Pedido</th>
                    <th style={{ padding: '1rem', textAlign: 'left', color: 'white', fontWeight: '700' }}>Status</th>
                    <th style={{ padding: '1rem', textAlign: 'center', color: 'white', fontWeight: '700' }}>Ações</th>
                </tr>
              </thead>
              <tbody>
                {requests.map((request) => (
                    <tr key={request.id} style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.05)' }}>
                    <td style={{ padding: '1rem' }}>
                        <div style={{ color: 'white', fontWeight: '600' }}>{request.userName}</div>
                        <div style={{ fontSize: '0.875rem', color: 'rgba(255, 255, 255, 0.6)', marginTop: '0.25rem' }}>{request.userEmail}</div>
                    </td>
                    <td style={{ padding: '1rem' }}>
                      <span style={{
                          padding: '0.4rem 0.75rem',
                          borderRadius: '12px',
                          fontSize: '0.85rem',
                          fontWeight: '700',
                          backgroundColor: request.userType === 'empresa' ? 'rgba(245, 158, 11, 0.2)' : 'rgba(16, 185, 129, 0.2)',
                          color: request.userType === 'empresa' ? '#fbbf24' : '#34d399',
                          border: `1px solid ${request.userType === 'empresa' ? 'rgba(245, 158, 11, 0.3)' : 'rgba(16, 185, 129, 0.3)'}`
                      }}>
                        {request.userType === 'empresa' ? 'Empresa' : 'Candidato'}
                      </span>
                    </td>
                      <td style={{ padding: '1rem', color: 'white', fontWeight: '600' }}>{request.planName}</td>
                      <td style={{ padding: '1rem', color: '#34d399', fontWeight: '700' }}>{request.priceLabel}</td>
                      <td style={{ padding: '1rem', color: 'rgba(255, 255, 255, 0.8)' }}>
                      {(
                        request.requestDate
                          ? new Date(request.requestDate)
                          : request.createdAt
                            ? new Date(request.createdAt)
                            : null
                        )?.toLocaleDateString('pt-PT', {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric'
                        }) || '---'}
                    </td>
                    <td style={{ padding: '1rem' }}>
                      {(() => {
                        const statusLabel =
                          request.status === 'payment_submitted'
                            ? 'Comprovativo enviado'
                            : request.status === 'pending'
                              ? 'Aguardando comprovativo'
                              : request.status === 'approved'
                                ? 'Aprovado'
                                : request.status === 'rejected'
                                  ? 'Rejeitado'
                                  : request.status || 'Desconhecido';
                        const statusBg =
                          request.status === 'payment_submitted'
                            ? 'rgba(59, 130, 246, 0.2)'
                            : request.status === 'pending'
                              ? 'rgba(245, 158, 11, 0.2)'
                              : request.status === 'approved'
                                ? 'rgba(16, 185, 129, 0.2)'
                                : 'rgba(239, 68, 68, 0.2)';
                        const statusColor =
                          request.status === 'payment_submitted'
                            ? '#93c5fd'
                            : request.status === 'pending'
                              ? '#fbbf24'
                              : request.status === 'approved'
                                ? '#34d399'
                                : '#f87171';
                        const statusBorder =
                          request.status === 'payment_submitted'
                            ? '1px solid rgba(59, 130, 246, 0.3)'
                            : request.status === 'pending'
                              ? '1px solid rgba(245, 158, 11, 0.3)'
                              : request.status === 'approved'
                                ? '1px solid rgba(16, 185, 129, 0.3)'
                                : '1px solid rgba(239, 68, 68, 0.3)';
                        return (
                          <span style={{
                              padding: '0.4rem 0.75rem',
                              borderRadius: '12px',
                              fontSize: '0.85rem',
                              fontWeight: '700',
                              backgroundColor: statusBg,
                              color: statusColor,
                              border: statusBorder
                          }}>
                            {statusLabel}
                          </span>
                        );
                      })()}
                    </td>
                    <td style={{ padding: '1rem', textAlign: 'center' }}>
                      {(() => {
                        const canApprove = request.status === 'payment_submitted' || (Number(request.price || 0) === 0 && request.status === 'pending');
                        return (request.status === 'pending' || request.status === 'payment_submitted') ? (
                          <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center' }}>
                            <button
                              onClick={() => handleAction(request.id, 'approve')}
                              disabled={loading || !canApprove}
                              style={{
                                padding: '0.5rem 1rem',
                                background: canApprove ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)' : 'rgba(148, 163, 184, 0.18)',
                                color: 'white',
                                border: 'none',
                                borderRadius: '8px',
                                cursor: loading || !canApprove ? 'not-allowed' : 'pointer',
                                fontWeight: '700',
                                fontSize: '0.85rem',
                                opacity: loading || !canApprove ? 0.6 : 1,
                                transition: 'all 0.3s ease',
                                boxShadow: canApprove ? '0 2px 8px rgba(16, 185, 129, 0.3)' : 'none'
                              }}
                            >
                              Aprovar
                            </button>
                            <button
                              onClick={() => handleAction(request.id, 'reject')}
                              disabled={loading}
                              style={{
                                padding: '0.5rem 1rem',
                                background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
                                color: 'white',
                                border: 'none',
                                borderRadius: '8px',
                                cursor: loading ? 'not-allowed' : 'pointer',
                                fontWeight: '700',
                                fontSize: '0.85rem',
                                opacity: loading ? 0.5 : 1,
                                transition: 'all 0.3s ease',
                                boxShadow: '0 2px 8px rgba(239, 68, 68, 0.3)'
                              }}
                            >
                              Rejeitar
                            </button>
                          </div>
                        ) : null;
                      })()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          </div>
        )}
      </main>

      {/* Modal de Criação/Edição de Plano */}
      {isModalOpen && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.8)',
          backdropFilter: 'blur(5px)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 1000
        }}>
          <div style={{
            background: 'linear-gradient(135deg, rgba(30, 41, 59, 0.95) 0%, rgba(15, 23, 42, 0.95) 100%)',
            backdropFilter: 'blur(20px)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            borderRadius: '20px',
            padding: '2rem',
            width: '90%',
            maxWidth: '600px',
            maxHeight: '90vh',
            overflow: 'auto',
            boxShadow: '0 20px 60px rgba(0, 0, 0, 0.5)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
              <h2 style={{ margin: 0, color: 'white', fontSize: '1.75rem', fontWeight: '800' }}>
                {editingPlan ? 'Editar Plano' : 'Criar Novo Plano'}
              </h2>
              <button
                onClick={closeModal}
                style={{
                  background: 'rgba(255, 255, 255, 0.1)',
                  border: 'none',
                  fontSize: '1.5rem',
                  cursor: 'pointer',
                  color: 'white',
                  width: '32px',
                  height: '32px',
                  borderRadius: '8px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'all 0.3s ease'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'rgba(239, 68, 68, 0.3)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)';
                }}
              >
                ×
              </button>
            </div>

            <form onSubmit={handleSubmit}>
              <div style={{ marginBottom: '1.5rem' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', color: 'white', fontWeight: '600', fontSize: '0.95rem' }}>
                  Nome do Plano
                </label>
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleInputChange}
                  required
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    background: 'rgba(255, 255, 255, 0.05)',
                    border: '1px solid rgba(255, 255, 255, 0.2)',
                    borderRadius: '8px',
                    color: 'white',
                    fontSize: '0.95rem',
                    transition: 'all 0.3s ease'
                  }}
                  onFocus={(e) => {
                    e.currentTarget.style.borderColor = '#60a5fa';
                    e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)';
                  }}
                  onBlur={(e) => {
                    e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.2)';
                    e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
                  }}
                />
              </div>

              <div style={{ marginBottom: '1.5rem' }}>
                <label style={labelStyle}>
                  Preço (em Dobras)
                </label>
                <input
                  type="number"
                  name="price"
                  value={formData.price}
                  onChange={handleInputChange}
                  required
                  style={inputStyle}
                  onFocus={(e) => {
                    e.currentTarget.style.borderColor = '#60a5fa';
                    e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)';
                  }}
                  onBlur={(e) => {
                    e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.2)';
                    e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
                  }}
                />
              </div>

              <div style={{ marginBottom: '1.5rem' }}>
                <label style={labelStyle}>
                  Rótulo de Preço (ex: &quot;100 Dobras&quot;, &quot;Gratuito&quot;)
                </label>
                <input
                  type="text"
                  name="priceLabel"
                  value={formData.priceLabel}
                  onChange={handleInputChange}
                  required
                  style={inputStyle}
                  onFocus={(e) => {
                    e.currentTarget.style.borderColor = '#60a5fa';
                    e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)';
                  }}
                  onBlur={(e) => {
                    e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.2)';
                    e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
                  }}
                />
              </div>

              <div style={{ marginBottom: '1.5rem' }}>
                <label style={labelStyle}>
                  Duração (em dias)
                </label>
                <input
                  type="number"
                  name="duration"
                  value={formData.duration}
                  onChange={handleInputChange}
                  required
                  style={inputStyle}
                  onFocus={(e) => {
                    e.currentTarget.style.borderColor = '#60a5fa';
                    e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)';
                  }}
                  onBlur={(e) => {
                    e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.2)';
                    e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
                  }}
                />
              </div>

              {planType === 'empresa' && (
                <>
                  <div style={{ marginBottom: '1.5rem' }}>
                    <label style={labelStyle}>
                      Limite de Vagas (deixe vazio para ilimitado)
                    </label>
                    <input
                      type="number"
                      name="vagasLimit"
                      value={formData.vagasLimit}
                      onChange={handleInputChange}
                      style={inputStyle}
                      onFocus={(e) => {
                        e.currentTarget.style.borderColor = '#60a5fa';
                        e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)';
                      }}
                      onBlur={(e) => {
                        e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.2)';
                        e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
                      }}
                    />
                  </div>

                  <div style={{ marginBottom: '1.5rem' }}>
                    <label style={checkboxLabelStyle}>
                      <input
                        type="checkbox"
                        name="destaque"
                        checked={formData.destaque}
                        onChange={handleInputChange}
                        style={{
                          width: '18px',
                          height: '18px',
                          cursor: 'pointer',
                          accentColor: '#60a5fa'
                        }}
                      />
                      Vagas em Destaque
                    </label>
                  </div>
                </>
              )}

              {planType === 'candidato' && (
                <div style={{ marginBottom: '1.5rem' }}>
                  <label style={checkboxLabelStyle}>
                    <input
                      type="checkbox"
                      name="curriculoDestacado"
                      checked={formData.curriculoDestacado}
                      onChange={handleInputChange}
                      style={{
                        width: '18px',
                        height: '18px',
                        cursor: 'pointer',
                        accentColor: '#60a5fa'
                      }}
                    />
                    Currículo Destacado
                  </label>
                </div>
              )}

              <div style={{ marginBottom: '1.5rem' }}>
                <label style={labelStyle}>
                  Recursos (um por linha)
                </label>
                <textarea
                  name="features"
                  value={formData.features.join('\n')}
                  onChange={handleInputChange}
                  rows="4"
                  style={{
                    ...inputStyle,
                    resize: 'vertical',
                    fontFamily: 'inherit'
                  }}
                  placeholder="Digite cada recurso em uma linha"
                  onFocus={(e) => {
                    e.currentTarget.style.borderColor = '#60a5fa';
                    e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)';
                  }}
                  onBlur={(e) => {
                    e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.2)';
                    e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
                  }}
                />
              </div>

              <div style={{ marginBottom: '1.5rem' }}>
                <label style={checkboxLabelStyle}>
                  <input
                    type="checkbox"
                    name="isActive"
                    checked={formData.isActive}
                    onChange={handleInputChange}
                    style={{
                      width: '18px',
                      height: '18px',
                      cursor: 'pointer',
                      accentColor: '#60a5fa'
                    }}
                  />
                  Plano Ativo
                </label>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginTop: '2rem' }}>
                <button
                  type="button"
                  onClick={closeModal}
                  style={{
                    padding: '0.75rem 1.5rem',
                    background: 'rgba(255, 255, 255, 0.1)',
                    color: 'white',
                    border: '1px solid rgba(255, 255, 255, 0.2)',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    fontWeight: '600',
                    fontSize: '0.95rem',
                    transition: 'all 0.3s ease'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'rgba(255, 255, 255, 0.15)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)';
                  }}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  style={{
                    padding: '0.75rem 1.5rem',
                    background: loading 
                      ? 'rgba(59, 130, 246, 0.5)' 
                      : 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    cursor: loading ? 'not-allowed' : 'pointer',
                    fontWeight: '700',
                    fontSize: '0.95rem',
                    transition: 'all 0.3s ease',
                    boxShadow: loading ? 'none' : '0 4px 15px rgba(59, 130, 246, 0.4)',
                    opacity: loading ? 0.6 : 1
                  }}
                  onMouseEnter={(e) => {
                    if (!loading) {
                      e.currentTarget.style.transform = 'translateY(-2px)';
                      e.currentTarget.style.boxShadow = '0 6px 20px rgba(59, 130, 246, 0.5)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.boxShadow = loading ? 'none' : '0 4px 15px rgba(59, 130, 246, 0.4)';
                  }}
                >
                  {loading ? 'Processando...' : (editingPlan ? 'Atualizar' : 'Criar')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}

function StatCard({ title, value, color }) {
  return (
    <div style={{
      background: 'rgba(255, 255, 255, 0.05)',
      backdropFilter: 'blur(10px)',
      border: '1px solid rgba(255, 255, 255, 0.1)',
      borderRadius: '12px',
      padding: '1.5rem',
      textAlign: 'center',
      transition: 'all 0.3s ease'
    }}
    onMouseEnter={(e) => {
      e.currentTarget.style.transform = 'translateY(-4px)';
      e.currentTarget.style.boxShadow = `0 10px 30px ${color}40`;
      e.currentTarget.style.borderColor = color;
    }}
    onMouseLeave={(e) => {
      e.currentTarget.style.transform = 'translateY(0)';
      e.currentTarget.style.boxShadow = 'none';
      e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.1)';
    }}>
      <div style={{ fontSize: '2.5rem', fontWeight: '900', color: color, marginBottom: '0.5rem' }}>
        {value}
      </div>
      <div style={{ fontSize: '0.95rem', color: 'white', fontWeight: '700' }}>
        {title}
      </div>
    </div>
  );
}

export async function getServerSideProps(context) {
  const authResult = await requireAdminPageAuth(context);
  if (!authResult.ok) {
    return authResult.redirect;
  }

  return { props: {} };
}
