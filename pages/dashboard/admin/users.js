import { useMemo, useState } from 'react';
import Link from 'next/link';
import Head from 'next/head';
import { useRouter } from 'next/router';
import nookies from 'nookies';
import { admin } from '../../../lib/firebaseAdmin';
import styles from '../../../styles/AdminPanel.module.css';
import { redirectToLogin } from '../../../lib/loginRedirect';

/**
 * A API de criação de administradores existia sem ecrã: dar acesso de admin a
 * alguém só era possível mexendo na base de dados. A pessoa recebe o email da
 * EmpregoSTP para definir a senha.
 */
function AddAdminPanel({ onCreated }) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState(null);

  const submit = async (event) => {
    event.preventDefault();
    if (busy) return;
    const cleanName = name.trim();
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanName || !cleanEmail) return;
    setBusy(true);
    setFeedback(null);
    try {
      const { getAuth } = await import('firebase/auth');
      const token = await getAuth().currentUser?.getIdToken();
      const response = await fetch('/api/admin/users', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: cleanName,
          email: cleanEmail,
          userType: 'admin',
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.message || 'Não foi possível criar a conta.');
      }
      setFeedback({
        ok: true,
        text: data.passwordEmailSent
          ? `Conta criada. Enviámos a ${cleanEmail} um email para definir a senha.`
          : `Conta criada, mas o email não foi enviado. Peça a ${cleanEmail} para usar «Recuperar senha» na página de login.`,
      });
      setName('');
      setEmail('');
      onCreated?.();
    } catch (error) {
      setFeedback({ ok: false, text: error.message });
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className={`${styles.surface} ${styles.panel} ${styles.section}`}>
      <details>
        <summary className={styles.chartTitle}>Adicionar administrador</summary>
        <form
          onSubmit={submit}
          className={styles.inlineControls}
          aria-label="Adicionar administrador"
        >
          <div style={{ flex: '1 1 220px' }}>
            <label className={styles.chartTitle} htmlFor="admin-new-name">
              Nome
            </label>
            <input
              id="admin-new-name"
              type="text"
              required
              maxLength={120}
              value={name}
              onChange={(event) => setName(event.target.value)}
              className={styles.inputControl}
            />
          </div>
          <div style={{ flex: '1 1 260px' }}>
            <label className={styles.chartTitle} htmlFor="admin-new-email">
              Email
            </label>
            <input
              id="admin-new-email"
              type="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className={styles.inputControl}
            />
          </div>
          <button
            type="submit"
            disabled={busy}
            className={`${styles.buttonBase} ${styles.buttonPrimary}`}
          >
            {busy ? 'A criar…' : 'Criar e enviar convite'}
          </button>
        </form>
      </details>
      {feedback ? (
        <div
          role="status"
          aria-live="polite"
          className={`${styles.alert} ${
            feedback.ok ? styles.alertSuccess : styles.alertError
          }`}
        >
          {feedback.text}
        </div>
      ) : null}
    </section>
  );
}

export default function AdminUsers({ users = [] }) {
  const router = useRouter();
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('all');

  const filteredUsers = useMemo(() => {
    return users.filter((user) => {
      const query = searchTerm.trim().toLowerCase();
      const matchesSearch =
        !query ||
        user.name?.toLowerCase().includes(query) ||
        user.fullName?.toLowerCase().includes(query) ||
        user.email?.toLowerCase().includes(query) ||
        user.phone?.toLowerCase().includes(query);

      const matchesType = filterType === 'all' || user.userType === filterType;
      return matchesSearch && matchesType;
    });
  }, [users, searchTerm, filterType]);

  const stats = {
    total: users.length,
    candidatos: users.filter((user) => user.userType === 'candidato').length,
    empresas: users.filter((user) => user.userType === 'empresa').length,
    admins: users.filter((user) => user.userType === 'admin').length,
  };

  return (
    <>
      <Head>
        <title>Gerir utilizadores - Admin</title>
      </Head>

      <div className={styles.page}>
        <section className={styles.headerCard}>
          <div className={styles.headerCopy}>
            <Link
              href="/dashboard/admin"
              className={`${styles.linkButton} ${styles.buttonGhost} ${styles.buttonSmall}`}
            >
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M19 12H5M12 19l-7-7 7-7" />
              </svg>
              Voltar ao dashboard
            </Link>
            <h1 className={styles.headerTitle}>Gerir utilizadores</h1>
            <p className={styles.headerSubtitle}>
              {filteredUsers.length} de {users.length} utilizadores encontrados.
            </p>
          </div>
        </section>

        <section className={`${styles.section} ${styles.gridStats}`}>
          <StatCard
            title="Total"
            value={stats.total}
            active={filterType === 'all'}
            accent="var(--dash-info-text, #064bb5)"
            onClick={() => setFilterType('all')}
          />
          <StatCard
            title="Candidatos"
            value={stats.candidatos}
            active={filterType === 'candidato'}
            accent="var(--sky, #5fb8f5)"
            onClick={() => setFilterType('candidato')}
          />
          <StatCard
            title="Empresas"
            value={stats.empresas}
            active={filterType === 'empresa'}
            accent="var(--dash-company-text, #5c6d00)"
            onClick={() => setFilterType('empresa')}
          />
          <StatCard
            title="Admins"
            value={stats.admins}
            active={filterType === 'admin'}
            accent="var(--admin-text)"
            onClick={() => setFilterType('admin')}
          />
        </section>

        <AddAdminPanel
          onCreated={() =>
            router.replace(router.asPath, undefined, { scroll: false })
          }
        />

        <section
          className={`${styles.surface} ${styles.panel} ${styles.section}`}
        >
          <div className={styles.inlineControls}>
            <div style={{ flex: '1 1 320px' }}>
              <label className={styles.chartTitle} htmlFor="admin-users-search">
                Pesquisar
              </label>
              <input
                id="admin-users-search"
                type="text"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Nome, email ou telefone..."
                className={styles.inputControl}
              />
            </div>
            {searchTerm ? (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                className={`${styles.buttonBase} ${styles.buttonGhost}`}
              >
                Limpar
              </button>
            ) : null}
          </div>
        </section>

        {filteredUsers.length === 0 ? (
          <section className={styles.emptyState}>
            <p className={styles.emptyText}>
              Nenhum utilizador encontrado para os filtros atuais.
            </p>
          </section>
        ) : (
          <section className={styles.tableShell}>
            <div className={`${styles.tableWrap} ${styles.tableWrapMin}`}>
              <table className={styles.table}>
                <thead>
                  <tr className={styles.tableHeadRow}>
                    <th className={styles.tableHeadCell}>Nome</th>
                    <th className={styles.tableHeadCell}>Email</th>
                    <th className={styles.tableHeadCell}>Telefone</th>
                    <th
                      className={`${styles.tableHeadCell} ${styles.alignCenter}`}
                    >
                      Tipo
                    </th>
                    <th className={styles.tableHeadCell}>Localização</th>
                    <th className={styles.tableHeadCell}>Data</th>
                    <th
                      className={`${styles.tableHeadCell} ${styles.alignRight}`}
                    >
                      Ações
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredUsers.map((user) => (
                    <tr className={styles.tableRow} key={user.id}>
                      <td
                        className={`${styles.tableCell} ${styles.tableCellStrong}`}
                      >
                        {user.name || user.fullName || 'Não informado'}
                      </td>
                      <td
                        className={`${styles.tableCell} ${styles.tableCellMuted}`}
                      >
                        {user.email || '—'}
                      </td>
                      <td
                        className={`${styles.tableCell} ${styles.tableCellSoft}`}
                      >
                        {user.phone || '—'}
                      </td>
                      <td
                        className={`${styles.tableCell} ${styles.alignCenter}`}
                      >
                        <UserTypeBadge type={user.userType} />
                      </td>
                      <td
                        className={`${styles.tableCell} ${styles.tableCellSoft}`}
                      >
                        {user.location || '—'}
                      </td>
                      <td
                        className={`${styles.tableCell} ${styles.tableCellSoft} ${styles.nowrap}`}
                      >
                        {formatDateTime(user.createdAt)}
                      </td>
                      <td
                        className={`${styles.tableCell} ${styles.alignRight}`}
                      >
                        <div className={styles.buttonGroup}>
                          <Link
                            href={`/dashboard/admin/users/${user.id}`}
                            className={`${styles.linkButton} ${styles.buttonPrimary} ${styles.buttonSmall}`}
                          >
                            Ver
                          </Link>
                          <Link
                            href={`/dashboard/admin/users/${user.id}/edit`}
                            className={`${styles.linkButton} ${styles.buttonAccent} ${styles.buttonSmall}`}
                            style={{
                              '--button-bg': 'rgba(95, 184, 245, 0.14)',
                              '--button-border': 'rgba(95, 184, 245, 0.28)',
                              '--button-color': 'var(--admin-blue)',
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
            </div>
          </section>
        )}
      </div>
    </>
  );
}

function StatCard({ title, value, active, accent, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`${styles.statCard} ${active ? styles.statCardActive : ''}`}
      style={{
        '--accent-color': accent,
      }}
    >
      <p className={styles.statValue}>{value}</p>
      <p className={styles.statLabel}>{title}</p>
    </button>
  );
}

function UserTypeBadge({ type }) {
  const palette = {
    candidato: {
      label: 'Candidato',
      style: {
        '--badge-bg': 'rgba(95, 184, 245, 0.14)',
        '--badge-color': 'var(--admin-blue)',
        '--badge-border': '1px solid rgba(95, 184, 245, 0.24)',
      },
    },
    empresa: {
      label: 'Empresa',
      style: {
        '--badge-bg': 'rgba(217, 255, 47, 0.22)',
        '--badge-color': 'var(--dash-company-text, #5c6d00)',
        '--badge-border': '1px solid rgba(217, 255, 47, 0.3)',
      },
    },
    admin: {
      label: 'Admin',
      style: {
        '--badge-bg': 'rgba(30, 43, 77, 0.12)',
        '--badge-color': 'var(--admin-text)',
        '--badge-border': '1px solid rgba(30, 43, 77, 0.16)',
      },
    },
  };

  const current = palette[type] || {
    label: 'Desconhecido',
    style: {
      '--badge-bg': 'rgba(123, 141, 168, 0.12)',
      '--badge-color': 'var(--admin-muted)',
      '--badge-border': '1px solid rgba(123, 141, 168, 0.18)',
    },
  };

  return (
    <span
      className={`${styles.badge} ${styles.badgeSmall}`}
      style={current.style}
    >
      {current.label}
    </span>
  );
}

function formatDateTime(value) {
  if (!value) return 'Não disponível';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Não disponível';
  return date.toLocaleString('pt-PT', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export async function getServerSideProps(context) {
  try {
    const cookies = nookies.get(context);

    if (!cookies.token) {
      return redirectToLogin(context);
    }

    const token = await admin.auth().verifyIdToken(cookies.token);
    const { uid } = token;

    const userDoc = await admin.firestore().collection('users').doc(uid).get();
    if (!userDoc.exists) {
      return redirectToLogin(context);
    }

    const userData = userDoc.data();

    if (userData.userType !== 'admin') {
      return { redirect: { destination: '/dashboard', permanent: false } };
    }

    const [usersSnapshot, profilesSnapshot] = await Promise.all([
      admin.firestore().collection('users').orderBy('createdAt', 'desc').get(),
      admin.firestore().collection('profiles').get(),
    ]);
    const profilesMap = {};
    profilesSnapshot.docs.forEach((doc) => {
      profilesMap[doc.id] = doc.data();
    });

    const serializeTs = (value) => {
      if (!value) return null;
      if (typeof value.toMillis === 'function') return value.toMillis();
      if (typeof value.toDate === 'function') return value.toDate().getTime();
      if (typeof value === 'number') return value;
      return null;
    };

    const users = usersSnapshot.docs.map((doc) => {
      const firestoreUser = doc.data();
      const profileData = profilesMap[doc.id] || {};

      return {
        id: doc.id,
        name:
          firestoreUser.name ||
          firestoreUser.fullName ||
          profileData.fullName ||
          '',
        fullName:
          firestoreUser.fullName ||
          firestoreUser.name ||
          profileData.fullName ||
          '',
        email: firestoreUser.email || '',
        phone: profileData.phone || firestoreUser.phone || '',
        location:
          profileData.city ||
          profileData.location ||
          firestoreUser.location ||
          firestoreUser.cidade ||
          '',
        userType: firestoreUser.userType || '',
        photoUrl: profileData.photoUrl || firestoreUser.photoUrl || '',
        createdAt:
          serializeTs(firestoreUser.createdAt) ||
          serializeTs(profileData.createdAt) ||
          null,
        updatedAt:
          serializeTs(firestoreUser.updatedAt) ||
          serializeTs(profileData.updatedAt) ||
          null,
        planEndDate: serializeTs(firestoreUser.planEndDate) || null,
        currentPlan: firestoreUser.currentPlan || '',
        provider: firestoreUser.provider || 'email',
      };
    });

    return {
      props: { users },
    };
  } catch (error) {
    console.error('Erro no getServerSideProps de admin/users:', error);
    return redirectToLogin(context);
  }
}
