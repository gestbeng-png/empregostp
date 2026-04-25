import { useMemo, useState } from "react";
import Link from "next/link";
import Head from "next/head";
import nookies from "nookies";
import LandingHeader from "../../../components/LandingHeader";
import { admin } from "../../../lib/firebaseAdmin";
import styles from "../../../styles/AdminPanel.module.css";

export default function AdminJobs({ jobs = [] }) {
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");

  const filteredJobs = useMemo(() => {
    return jobs.filter((job) => {
      const query = searchTerm.trim().toLowerCase();
      const matchesSearch =
        !query ||
        job.titulo?.toLowerCase().includes(query) ||
        job.companyName?.toLowerCase().includes(query) ||
        job.localizacao?.toLowerCase().includes(query);

      const matchesStatus =
        filterStatus === "all" || job.status === filterStatus;

      return matchesSearch && matchesStatus;
    });
  }, [jobs, searchTerm, filterStatus]);

  const stats = {
    total: jobs.length,
    active: jobs.filter((job) => job.status === "active").length,
    closed: jobs.filter((job) => job.status === "closed").length,
    disabled: jobs.filter((job) => job.status === "disabled").length,
  };

  return (
    <>
      <Head>
        <title>Gerenciar vagas - Admin</title>
      </Head>
      <LandingHeader />

      <main className={styles.page}>
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
            <h1 className={styles.headerTitle}>Gerenciar vagas</h1>
            <p className={styles.headerSubtitle}>
              {filteredJobs.length} de {jobs.length} vagas listadas.
            </p>
          </div>
          <div className={styles.headerActions}>
            <Link
              href="/dashboard/admin/jobs/create"
              className={`${styles.linkButton} ${styles.buttonSuccess}`}
            >
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M12 5v14M5 12h14" />
              </svg>
              Nova vaga
            </Link>
          </div>
        </section>

        <section className={`${styles.section} ${styles.gridStats}`}>
          <StatCard
            title="Total"
            value={stats.total}
            active={filterStatus === "all"}
            accent="#2057d7"
            onClick={() => setFilterStatus("all")}
          />
          <StatCard
            title="Ativas"
            value={stats.active}
            active={filterStatus === "active"}
            accent="#d9ff2f"
            onClick={() => setFilterStatus("active")}
          />
          <StatCard
            title="Fechadas"
            value={stats.closed}
            active={filterStatus === "closed"}
            accent="#ef4444"
            onClick={() => setFilterStatus("closed")}
          />
          <StatCard
            title="Desativadas"
            value={stats.disabled}
            active={filterStatus === "disabled"}
            accent="#607394"
            onClick={() => setFilterStatus("disabled")}
          />
        </section>

        <section
          className={`${styles.surface} ${styles.panel} ${styles.section}`}
        >
          <div className={styles.inlineControls}>
            <div style={{ flex: "1 1 320px" }}>
              <label className={styles.chartTitle} htmlFor="admin-jobs-search">
                Pesquisar
              </label>
              <input
                id="admin-jobs-search"
                type="text"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Título, empresa ou localização..."
                className={styles.inputControl}
              />
            </div>
            {searchTerm ? (
              <button
                type="button"
                onClick={() => setSearchTerm("")}
                className={`${styles.buttonBase} ${styles.buttonGhost}`}
              >
                Limpar pesquisa
              </button>
            ) : null}
          </div>
        </section>

        {filteredJobs.length === 0 ? (
          <section className={styles.emptyState}>
            <p className={styles.emptyText}>
              Nenhuma vaga encontrada para os filtros atuais.
            </p>
          </section>
        ) : (
          <section className={styles.tableShell}>
            <div className={`${styles.tableWrap} ${styles.tableWrapMin}`}>
              <table className={styles.table}>
                <thead>
                  <tr className={styles.tableHeadRow}>
                    <th className={styles.tableHeadCell}>Título</th>
                    <th className={styles.tableHeadCell}>Empresa</th>
                    <th className={styles.tableHeadCell}>Localização</th>
                    <th
                      className={`${styles.tableHeadCell} ${styles.alignCenter}`}
                    >
                      Status
                    </th>
                    <th
                      className={`${styles.tableHeadCell} ${styles.alignCenter}`}
                    >
                      Candidaturas
                    </th>
                    <th
                      className={`${styles.tableHeadCell} ${styles.alignCenter}`}
                    >
                      Views
                    </th>
                    <th className={styles.tableHeadCell}>Data</th>
                    <th
                      className={`${styles.tableHeadCell} ${styles.alignRight}`}
                    >
                      Ações
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredJobs.map((job) => (
                    <tr className={styles.tableRow} key={job.id}>
                      <td
                        className={`${styles.tableCell} ${styles.tableCellStrong}`}
                      >
                        {job.titulo}
                      </td>
                      <td
                        className={`${styles.tableCell} ${styles.tableCellMuted}`}
                      >
                        {job.companyName || "N/A"}
                      </td>
                      <td
                        className={`${styles.tableCell} ${styles.tableCellSoft}`}
                      >
                        {job.localizacao || "N/A"}
                      </td>
                      <td
                        className={`${styles.tableCell} ${styles.alignCenter}`}
                      >
                        <StatusBadge status={job.status} />
                      </td>
                      <td
                        className={`${styles.tableCell} ${styles.alignCenter} ${styles.tableCellStrong}`}
                      >
                        {job.applicationCount || 0}
                      </td>
                      <td
                        className={`${styles.tableCell} ${styles.alignCenter} ${styles.tableCellStrong}`}
                        style={{ color: "#2057d7" }}
                      >
                        {job.views || 0}
                      </td>
                      <td
                        className={`${styles.tableCell} ${styles.tableCellSoft} ${styles.nowrap}`}
                      >
                        {formatDate(job.createdAt)}
                      </td>
                      <td
                        className={`${styles.tableCell} ${styles.alignRight}`}
                      >
                        <div className={styles.buttonGroup}>
                          <Link
                            href={`/dashboard/admin/jobs/${job.id}`}
                            className={`${styles.linkButton} ${styles.buttonPrimary} ${styles.buttonSmall}`}
                          >
                            Ver
                          </Link>
                          <Link
                            href={`/dashboard/admin/jobs/${job.id}/edit`}
                            className={`${styles.linkButton} ${styles.buttonAccent} ${styles.buttonSmall}`}
                            style={{
                              "--button-bg": "rgba(95, 184, 245, 0.14)",
                              "--button-border": "rgba(95, 184, 245, 0.28)",
                              "--button-color": "#2057d7",
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
      </main>
    </>
  );
}

function StatCard({ title, value, active, accent, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={styles.statCard}
      style={{
        "--accent-color": accent,
        borderColor: active ? accent : undefined,
        background: active
          ? `linear-gradient(180deg, #ffffff, color-mix(in srgb, ${accent} 14%, #f8fbff))`
          : undefined,
      }}
    >
      <p className={styles.statValue}>{value}</p>
      <p className={styles.statLabel}>{title}</p>
    </button>
  );
}

function StatusBadge({ status }) {
  const palette = {
    active: {
      label: "Ativa",
      style: {
        "--badge-bg": "rgba(217, 255, 47, 0.22)",
        "--badge-color": "#1e2b4d",
        "--badge-border": "1px solid rgba(217, 255, 47, 0.3)",
      },
    },
    closed: {
      label: "Fechada",
      style: {
        "--badge-bg": "rgba(239, 68, 68, 0.12)",
        "--badge-color": "#c62828",
        "--badge-border": "1px solid rgba(239, 68, 68, 0.22)",
      },
    },
    disabled: {
      label: "Desativada",
      style: {
        "--badge-bg": "rgba(123, 141, 168, 0.12)",
        "--badge-color": "#607394",
        "--badge-border": "1px solid rgba(123, 141, 168, 0.18)",
      },
    },
  };

  const current = palette[status] || {
    label: "Desconhecido",
    style: {
      "--badge-bg": "rgba(123, 141, 168, 0.12)",
      "--badge-color": "#607394",
      "--badge-border": "1px solid rgba(123, 141, 168, 0.18)",
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

function formatDate(value) {
  if (!value) return "N/A";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "N/A";
  return date.toLocaleDateString("pt-PT", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export async function getServerSideProps(context) {
  try {
    const cookies = nookies.get(context);

    if (!cookies.token) {
      return { redirect: { destination: "/login", permanent: false } };
    }

    const token = await admin.auth().verifyIdToken(cookies.token);
    const { uid } = token;

    const userDoc = await admin.firestore().collection("users").doc(uid).get();
    if (!userDoc.exists) {
      return { redirect: { destination: "/login", permanent: false } };
    }

    const userData = userDoc.data();

    if (userData.userType !== "admin") {
      return { redirect: { destination: "/dashboard", permanent: false } };
    }

    const jobsSnapshot = await admin
      .firestore()
      .collection("jobs")
      .orderBy("createdAt", "desc")
      .get();

    const applicationsSnapshot = await admin
      .firestore()
      .collection("applications")
      .get();
    const applicationsByJob = {};
    applicationsSnapshot.docs.forEach((doc) => {
      const data = doc.data();
      if (data.jobId) {
        applicationsByJob[data.jobId] =
          (applicationsByJob[data.jobId] || 0) + 1;
      }
    });

    const companyIds = [
      ...new Set(
        jobsSnapshot.docs.map((doc) => doc.data().companyId).filter(Boolean),
      ),
    ];
    const companiesMap = {};

    if (companyIds.length > 0) {
      const batches = [];
      for (let index = 0; index < companyIds.length; index += 10) {
        batches.push(companyIds.slice(index, index + 10));
      }

      for (const batch of batches) {
        const companiesSnapshot = await admin
          .firestore()
          .collection("users")
          .where(admin.firestore.FieldPath.documentId(), "in", batch)
          .get();

        companiesSnapshot.docs.forEach((doc) => {
          const data = doc.data();
          companiesMap[doc.id] = data.name || data.fullName || "Empresa";
        });
      }
    }

    const jobs = jobsSnapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        titulo: data.titulo || "Sem título",
        descricao: data.descricao || "",
        localizacao: data.localizacao || data.location || "Não especificado",
        tipoContrato: data.tipoContrato || "Não especificado",
        salarioDe: data.salarioDe || "",
        salarioAte: data.salarioAte || "",
        status: data.status || "active",
        companyId: data.companyId || "",
        companyName: companiesMap[data.companyId] || "N/A",
        applicationCount: applicationsByJob[doc.id] || 0,
        views: data.views || 0,
        createdAt:
          typeof data.createdAt === "string"
            ? data.createdAt
            : data.createdAt?.toDate?.()?.toISOString() ||
              new Date().toISOString(),
      };
    });

    return {
      props: { jobs },
    };
  } catch (error) {
    console.error("Erro no getServerSideProps de admin/jobs:", error);
    return { redirect: { destination: "/login", permanent: false } };
  }
}
