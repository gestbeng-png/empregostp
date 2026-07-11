import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Head from "next/head";
import LandingHeader from "../../../components/LandingHeader";
import { requireAdminPageAuth } from "../../../lib/adminPageGuard";
import { useAuth } from "../../../context/AuthContext";
import styles from "../../../styles/AdminPanel.module.css";

const STATUS_META = {
  pending: {
    label: "Pendente",
    style: {
      "--badge-bg": "rgba(245, 158, 11, 0.14)",
      "--badge-color": "#b45309",
      "--badge-border": "1px solid rgba(245, 158, 11, 0.28)",
    },
  },
  approved: {
    label: "Aprovado",
    style: {
      "--badge-bg": "rgba(61, 187, 122, 0.14)",
      "--badge-color": "#15803d",
      "--badge-border": "1px solid rgba(61, 187, 122, 0.28)",
    },
  },
  rejected: {
    label: "Rejeitado",
    style: {
      "--badge-bg": "rgba(239, 68, 68, 0.12)",
      "--badge-color": "#b91c1c",
      "--badge-border": "1px solid rgba(239, 68, 68, 0.24)",
    },
  },
};

const FILTERS = [
  { key: "pending", title: "Pendentes", accent: "#f59e0b" },
  { key: "approved", title: "Aprovados", accent: "#3dbb7a" },
  { key: "rejected", title: "Rejeitados", accent: "#ef4444" },
  { key: "all", title: "Total", accent: "#2057d7" },
];

export default function AdminTestimonials() {
  const { user } = useAuth();
  const [filter, setFilter] = useState("pending");
  const [testimonials, setTestimonials] = useState([]);
  const [stats, setStats] = useState({ total: 0, pending: 0, approved: 0, rejected: 0 });
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState(null);
  const [feedback, setFeedback] = useState(null);

  const fetchTestimonials = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const token = await user.getIdToken();
      const response = await fetch(`/api/admin/testimonials?status=${filter}`, {
        cache: "no-store",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) {
        throw new Error(await response.text());
      }
      const data = await response.json();
      setTestimonials(data.testimonials || []);
      if (data.stats) setStats(data.stats);
    } catch (error) {
      console.error("Erro ao carregar testemunhos:", error);
      setFeedback({ type: "error", text: "Não foi possível carregar os testemunhos." });
    } finally {
      setLoading(false);
    }
  }, [user, filter]);

  useEffect(() => {
    fetchTestimonials();
  }, [fetchTestimonials]);

  const handleAction = useCallback(
    async (id, action) => {
      if (!user) return;
      if (action === "delete" && !window.confirm("Eliminar este testemunho permanentemente?")) {
        return;
      }
      setProcessingId(id);
      setFeedback(null);
      try {
        const token = await user.getIdToken();
        const response = await fetch(`/api/admin/testimonials/${id}`, {
          method: action === "delete" ? "DELETE" : "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: action === "delete" ? undefined : JSON.stringify({ action }),
        });
        if (!response.ok) {
          const data = await response.json().catch(() => ({}));
          throw new Error(data.message || "Falha na operação");
        }
        const messages = {
          approve: "Testemunho aprovado e publicado.",
          reject: "Testemunho rejeitado.",
          delete: "Testemunho eliminado.",
        };
        setFeedback({ type: "success", text: messages[action] });
        await fetchTestimonials();
      } catch (error) {
        console.error("Erro ao moderar testemunho:", error);
        setFeedback({ type: "error", text: error.message || "Erro ao processar a ação." });
      } finally {
        setProcessingId(null);
      }
    },
    [user, fetchTestimonials],
  );

  const activeCount = useMemo(() => testimonials.length, [testimonials]);

  return (
    <>
      <Head>
        <title>Moderar testemunhos - Admin</title>
      </Head>
      <LandingHeader />

      <main className={styles.page}>
        <section className={styles.headerCard}>
          <div className={styles.headerCopy}>
            <Link
              href="/dashboard/admin"
              className={`${styles.linkButton} ${styles.buttonGhost} ${styles.buttonSmall}`}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M19 12H5M12 19l-7-7 7-7" />
              </svg>
              Voltar ao dashboard
            </Link>
            <h1 className={styles.headerTitle}>Moderar testemunhos</h1>
            <p className={styles.headerSubtitle}>
              {stats.pending} pendente{stats.pending === 1 ? "" : "s"} · {activeCount}{" "}
              {activeCount === 1 ? "testemunho" : "testemunhos"} no filtro atual.
            </p>
          </div>
        </section>

        <section className={`${styles.section} ${styles.gridStats}`}>
          {FILTERS.map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={() => setFilter(item.key)}
              className={styles.statCard}
              style={{
                "--accent-color": item.accent,
                borderColor: filter === item.key ? item.accent : undefined,
                background:
                  filter === item.key
                    ? `linear-gradient(180deg, #ffffff, color-mix(in srgb, ${item.accent} 14%, #f8fbff))`
                    : undefined,
              }}
            >
              <p className={styles.statValue}>
                {item.key === "all" ? stats.total : stats[item.key]}
              </p>
              <p className={styles.statLabel}>{item.title}</p>
            </button>
          ))}
        </section>

        {feedback ? (
          <section className={styles.section}>
            <div
              className={`${styles.alert} ${
                feedback.type === "success" ? styles.alertSuccess : styles.alertError
              }`}
            >
              {feedback.text}
            </div>
          </section>
        ) : null}

        {loading ? (
          <section className={styles.emptyState}>
            <p className={styles.emptyText}>A carregar testemunhos...</p>
          </section>
        ) : testimonials.length === 0 ? (
          <section className={styles.emptyState}>
            <p className={styles.emptyText}>Nenhum testemunho neste filtro.</p>
          </section>
        ) : (
          <section
            className={styles.section}
            style={{ display: "grid", gap: "1rem" }}
          >
            {testimonials.map((item) => {
              const meta = STATUS_META[item.status] || STATUS_META.pending;
              return (
                <article
                  key={item.id}
                  className={`${styles.surface} ${styles.panel}`}
                  style={{ padding: "1.4rem 1.5rem" }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "flex-start",
                      gap: "1rem",
                      flexWrap: "wrap",
                    }}
                  >
                    <div>
                      <p style={{ margin: 0, fontWeight: 800, color: "#162a55", fontSize: "1.05rem" }}>
                        {item.name}
                      </p>
                      {item.role ? (
                        <p style={{ margin: "0.15rem 0 0", color: "#607394", fontSize: "0.88rem" }}>
                          {item.role}
                        </p>
                      ) : null}
                    </div>
                    <span className={`${styles.badge} ${styles.badgeSmall}`} style={meta.style}>
                      {meta.label}
                    </span>
                  </div>

                  {item.rating ? (
                    <p style={{ margin: "0.6rem 0 0", color: "#f59e0b", letterSpacing: "2px" }}>
                      {"★".repeat(item.rating)}
                      <span style={{ color: "#d4dbe8" }}>{"★".repeat(5 - item.rating)}</span>
                    </p>
                  ) : null}

                  <p style={{ margin: "0.7rem 0 0", color: "#33415c", lineHeight: 1.7 }}>
                    &ldquo;{item.message}&rdquo;
                  </p>

                  <p style={{ margin: "0.7rem 0 0", color: "#94a3b8", fontSize: "0.8rem" }}>
                    {formatDateTime(item.createdAt)}
                  </p>

                  <div className={styles.buttonGroup} style={{ marginTop: "1rem" }}>
                    {item.status !== "approved" ? (
                      <button
                        type="button"
                        disabled={processingId === item.id}
                        onClick={() => handleAction(item.id, "approve")}
                        className={`${styles.buttonBase} ${styles.buttonSuccess} ${styles.buttonSmall}`}
                      >
                        Aprovar
                      </button>
                    ) : null}
                    {item.status !== "rejected" ? (
                      <button
                        type="button"
                        disabled={processingId === item.id}
                        onClick={() => handleAction(item.id, "reject")}
                        className={`${styles.buttonBase} ${styles.buttonGhost} ${styles.buttonSmall}`}
                      >
                        Rejeitar
                      </button>
                    ) : null}
                    <button
                      type="button"
                      disabled={processingId === item.id}
                      onClick={() => handleAction(item.id, "delete")}
                      className={`${styles.buttonBase} ${styles.buttonDanger} ${styles.buttonSmall}`}
                    >
                      Eliminar
                    </button>
                  </div>
                </article>
              );
            })}
          </section>
        )}
      </main>
    </>
  );
}

function formatDateTime(value) {
  if (!value) return "Data não disponível";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Data não disponível";
  return date.toLocaleString("pt-PT", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export async function getServerSideProps(context) {
  const result = await requireAdminPageAuth(context);
  if (!result.ok) {
    return { redirect: result.redirect };
  }
  return { props: {} };
}
