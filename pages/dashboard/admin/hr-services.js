import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Head from "next/head";
import LandingHeader from "../../../components/LandingHeader";
import { requireAdminPageAuth } from "../../../lib/adminPageGuard";
import { useAuth } from "../../../context/AuthContext";
import styles from "../../../styles/AdminPanel.module.css";

const STATUS_META = {
  pending: {
    label: "Em análise",
    style: {
      "--badge-bg": "rgba(245, 158, 11, 0.14)",
      "--badge-color": "#b45309",
      "--badge-border": "1px solid rgba(245, 158, 11, 0.28)",
    },
  },
  approved: {
    label: "Aprovado · em andamento",
    style: {
      "--badge-bg": "rgba(32, 87, 215, 0.12)",
      "--badge-color": "#1d4ed8",
      "--badge-border": "1px solid rgba(32, 87, 215, 0.26)",
    },
  },
  completed: {
    label: "Concluído",
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
  { key: "pending", title: "Em análise", accent: "#f59e0b" },
  { key: "approved", title: "Em andamento", accent: "#2057d7" },
  { key: "completed", title: "Concluídos", accent: "#3dbb7a" },
  { key: "rejected", title: "Rejeitados", accent: "#ef4444" },
  { key: "all", title: "Total", accent: "#64748b" },
];

const emptyDoc = () => ({ label: "", url: "" });
const MIN_RESPONSE_LENGTH = 5;
const MAX_RESPONSE_LENGTH = 3000;

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

export default function AdminHRServices() {
  const { user } = useAuth();
  const [filter, setFilter] = useState("pending");
  const [requests, setRequests] = useState([]);
  const [stats, setStats] = useState({
    total: 0,
    pending: 0,
    approved: 0,
    completed: 0,
    rejected: 0,
  });
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState(null);
  const [feedback, setFeedback] = useState(null);

  // Modal de conclusão (resposta + documentos de resultado)
  const [completing, setCompleting] = useState(null);
  const [response, setResponse] = useState("");
  const [resultDocs, setResultDocs] = useState([emptyDoc()]);

  const fetchRequests = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const token = await user.getIdToken();
      const res = await fetch(`/api/admin/hr-services?status=${filter}`, {
        cache: "no-store",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      setRequests(data.requests || []);
      if (data.stats) setStats(data.stats);
    } catch (error) {
      console.error("Erro ao carregar pedidos de serviço RH:", error);
      setFeedback({ type: "error", text: "Não foi possível carregar os pedidos." });
    } finally {
      setLoading(false);
    }
  }, [user, filter]);

  useEffect(() => {
    fetchRequests();
  }, [fetchRequests]);

  const handleAction = useCallback(
    async (id, action, body) => {
      if (!user) return;
      if (action === "delete" && !window.confirm("Eliminar este pedido permanentemente?")) {
        return;
      }
      setProcessingId(id);
      setFeedback(null);
      try {
        const token = await user.getIdToken();
        const res = await fetch(`/api/admin/hr-services/${id}`, {
          method: action === "delete" ? "DELETE" : "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: action === "delete" ? undefined : JSON.stringify({ action, ...body }),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.message || "Falha na operação");
        }
        const messages = {
          approve: "Pedido aprovado.",
          reject: "Pedido rejeitado.",
          complete: "Pedido concluído e enviado à empresa.",
          delete: "Pedido eliminado.",
        };
        setFeedback({ type: "success", text: messages[action] || "Estado atualizado." });
        await fetchRequests();
        return true;
      } catch (error) {
        console.error("Erro ao processar pedido de serviço RH:", error);
        setFeedback({ type: "error", text: error.message || "Erro ao processar a ação." });
        return false;
      } finally {
        setProcessingId(null);
      }
    },
    [user, fetchRequests],
  );

  const openComplete = (request) => {
    setResponse(request.adminResponse || "");
    setResultDocs(
      request.resultDocuments?.length ? request.resultDocuments.map((d) => ({ ...d })) : [emptyDoc()],
    );
    setCompleting(request);
    setFeedback(null);
  };

  const closeComplete = () => {
    setCompleting(null);
    setResponse("");
    setResultDocs([emptyDoc()]);
  };

  const handleDocChange = (index, key) => (event) => {
    const value = event.target.value;
    setResultDocs((prev) => prev.map((doc, i) => (i === index ? { ...doc, [key]: value } : doc)));
  };

  const addDocRow = () =>
    setResultDocs((prev) => (prev.length >= 10 ? prev : [...prev, emptyDoc()]));

  const removeDocRow = (index) =>
    setResultDocs((prev) => {
      const next = prev.filter((_, i) => i !== index);
      return next.length ? next : [emptyDoc()];
    });

  const submitComplete = async () => {
    if (!completing) return;
    const adminResponse = response.trim();
    if (adminResponse.length < MIN_RESPONSE_LENGTH) {
      setFeedback({
        type: "error",
        text: `Escreva uma resposta com pelo menos ${MIN_RESPONSE_LENGTH} caracteres antes de finalizar.`,
      });
      return;
    }
    if (adminResponse.length > MAX_RESPONSE_LENGTH) {
      setFeedback({
        type: "error",
        text: `A resposta não pode ultrapassar ${MAX_RESPONSE_LENGTH} caracteres.`,
      });
      return;
    }
    const documents = resultDocs
      .map((doc) => ({ label: (doc.label || "").trim(), url: (doc.url || "").trim() }))
      .filter((doc) => doc.url);
    const ok = await handleAction(completing.id, "complete", {
      adminResponse,
      resultDocuments: documents,
    });
    if (ok) closeComplete();
  };

  const activeCount = useMemo(() => requests.length, [requests]);

  return (
    <>
      <Head>
        <title>Serviços RH - Admin</title>
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
            <h1 className={styles.headerTitle}>Serviços de RH</h1>
            <p className={styles.headerSubtitle}>
              {stats.pending} em análise · {activeCount}{" "}
              {activeCount === 1 ? "pedido" : "pedidos"} no filtro atual.
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
            <p className={styles.emptyText}>A carregar pedidos...</p>
          </section>
        ) : requests.length === 0 ? (
          <section className={styles.emptyState}>
            <p className={styles.emptyText}>Nenhum pedido neste filtro.</p>
          </section>
        ) : (
          <section className={styles.section} style={{ display: "grid", gap: "1rem" }}>
            {requests.map((item) => {
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
                      <p style={{ margin: 0, color: "#2057d7", fontWeight: 800, fontSize: "0.72rem", letterSpacing: "0.4px", textTransform: "uppercase" }}>
                        {item.serviceType}
                      </p>
                      <p style={{ margin: "0.2rem 0 0", fontWeight: 800, color: "#162a55", fontSize: "1.05rem" }}>
                        {item.title}
                      </p>
                      <p style={{ margin: "0.15rem 0 0", color: "#607394", fontSize: "0.85rem" }}>
                        {item.companyName}
                        {item.companyEmail ? ` · ${item.companyEmail}` : ""}
                      </p>
                    </div>
                    <span className={`${styles.badge} ${styles.badgeSmall}`} style={meta.style}>
                      {meta.label}
                    </span>
                  </div>

                  <p style={{ margin: "0.9rem 0 0", color: "#33415c", lineHeight: 1.7, whiteSpace: "pre-line" }}>
                    {item.description}
                  </p>

                  {item.documents?.length > 0 ? (
                    <div style={{ marginTop: "0.9rem" }}>
                      <p style={{ margin: "0 0 0.4rem", color: "#94a3b8", fontSize: "0.74rem", fontWeight: 800, textTransform: "uppercase" }}>
                        Documentos enviados
                      </p>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
                        {item.documents.map((doc, i) => (
                          <a
                            key={i}
                            href={doc.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{ color: "#2057d7", fontSize: "0.84rem", fontWeight: 600, textDecoration: "none", background: "rgba(32,87,215,0.08)", border: "1px solid rgba(32,87,215,0.18)", borderRadius: 999, padding: "0.35rem 0.7rem" }}
                          >
                            📎 {doc.label || "Documento"}
                          </a>
                        ))}
                      </div>
                    </div>
                  ) : null}

                  {item.adminResponse ? (
                    <div style={{ marginTop: "1rem", padding: "0.9rem 1rem", borderRadius: 12, background: "rgba(61,187,122,0.07)", border: "1px solid rgba(61,187,122,0.2)" }}>
                      <p style={{ margin: "0 0 0.4rem", color: "#94a3b8", fontSize: "0.74rem", fontWeight: 800, textTransform: "uppercase" }}>
                        Resposta enviada
                      </p>
                      <p style={{ margin: 0, color: "#33415c", lineHeight: 1.6, whiteSpace: "pre-line" }}>{item.adminResponse}</p>
                      {item.resultDocuments?.length > 0 ? (
                        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", marginTop: "0.6rem" }}>
                          {item.resultDocuments.map((doc, i) => (
                            <a
                              key={i}
                              href={doc.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              style={{ color: "#15803d", fontSize: "0.84rem", fontWeight: 600, textDecoration: "none", background: "rgba(61,187,122,0.1)", border: "1px solid rgba(61,187,122,0.24)", borderRadius: 999, padding: "0.35rem 0.7rem" }}
                            >
                              📥 {doc.label || "Documento"}
                            </a>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  ) : null}

                  <p style={{ margin: "0.9rem 0 0", color: "#94a3b8", fontSize: "0.8rem" }}>
                    Recebido em {formatDateTime(item.createdAt)}
                  </p>

                  <div className={styles.buttonGroup} style={{ marginTop: "1rem" }}>
                    {item.status === "pending" ? (
                      <button
                        type="button"
                        disabled={processingId === item.id}
                        onClick={() => handleAction(item.id, "approve")}
                        className={`${styles.buttonBase} ${styles.buttonSuccess} ${styles.buttonSmall}`}
                      >
                        Aprovar
                      </button>
                    ) : null}
                    {item.status !== "completed" ? (
                      <button
                        type="button"
                        disabled={processingId === item.id}
                        onClick={() => openComplete(item)}
                        className={`${styles.buttonBase} ${styles.buttonAccent} ${styles.buttonSmall}`}
                        style={{
                          "--button-bg": "rgba(32, 87, 215, 0.14)",
                          "--button-border": "rgba(32, 87, 215, 0.3)",
                          "--button-color": "#1d4ed8",
                        }}
                      >
                        Finalizar & responder
                      </button>
                    ) : (
                      <button
                        type="button"
                        disabled={processingId === item.id}
                        onClick={() => openComplete(item)}
                        className={`${styles.buttonBase} ${styles.buttonGhost} ${styles.buttonSmall}`}
                      >
                        Editar resposta
                      </button>
                    )}
                    {item.status !== "rejected" && item.status !== "completed" ? (
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

      {completing ? (
        <div className={styles.modalOverlay} onClick={() => processingId ? null : closeComplete()}>
          <div
            className={styles.modalCard}
            onClick={(event) => event.stopPropagation()}
            style={{ maxWidth: 640 }}
          >
            <div className={styles.modalHeader}>
              <div>
                <h2 className={styles.modalTitle}>Finalizar pedido</h2>
                <p className={styles.modalSub}>
                  {completing.title} · {completing.companyName}
                </p>
              </div>
              <button
                type="button"
                className={`${styles.buttonBase} ${styles.buttonGhost} ${styles.buttonSmall}`}
                onClick={closeComplete}
                disabled={processingId === completing.id}
              >
                ✕
              </button>
            </div>

            <div style={{ display: "grid", gap: "0.4rem", marginTop: "0.6rem" }}>
              <label className={styles.label} style={{ fontWeight: 700, fontSize: "0.85rem", color: "#46597a" }}>
                Resposta à empresa
              </label>
              <textarea
                value={response}
                onChange={(event) => setResponse(event.target.value)}
                placeholder="Descreva o resultado do serviço, próximos passos ou observações para a empresa."
                rows={5}
                minLength={MIN_RESPONSE_LENGTH}
                maxLength={MAX_RESPONSE_LENGTH}
                style={{
                  width: "100%",
                  padding: "0.7rem 0.85rem",
                  borderRadius: 12,
                  border: "1px solid rgba(30, 43, 77, 0.14)",
                  background: "#f7fbff",
                  fontFamily: "inherit",
                  fontSize: "0.92rem",
                  resize: "vertical",
                }}
              />
              <p style={{ margin: 0, color: "#607394", fontSize: "0.78rem" }}>
                Mínimo {MIN_RESPONSE_LENGTH} caracteres · {response.trim().length}/{MAX_RESPONSE_LENGTH}
              </p>
            </div>

            <div style={{ marginTop: "1rem" }}>
              <label className={styles.label} style={{ fontWeight: 700, fontSize: "0.85rem", color: "#46597a" }}>
                Documentos de resultado (links)
              </label>
              <div style={{ display: "grid", gap: "0.5rem", marginTop: "0.4rem" }}>
                {resultDocs.map((doc, index) => (
                  <div key={index} style={{ display: "grid", gridTemplateColumns: "0.7fr 1.3fr auto", gap: "0.5rem" }}>
                    <input
                      type="text"
                      value={doc.label}
                      onChange={handleDocChange(index, "label")}
                      placeholder="Nome (opcional)"
                      style={{ padding: "0.55rem 0.7rem", borderRadius: 10, border: "1px solid rgba(30,43,77,0.14)", background: "#f7fbff", fontFamily: "inherit", fontSize: "0.88rem", minWidth: 0 }}
                    />
                    <input
                      type="url"
                      value={doc.url}
                      onChange={handleDocChange(index, "url")}
                      placeholder="https://…"
                      style={{ padding: "0.55rem 0.7rem", borderRadius: 10, border: "1px solid rgba(30,43,77,0.14)", background: "#f7fbff", fontFamily: "inherit", fontSize: "0.88rem", minWidth: 0 }}
                    />
                    <button
                      type="button"
                      onClick={() => removeDocRow(index)}
                      style={{ width: 36, borderRadius: 10, border: "1px solid rgba(30,43,77,0.14)", background: "#f7fbff", cursor: "pointer", color: "#607394" }}
                      aria-label="Remover documento"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
              {resultDocs.length < 10 ? (
                <button
                  type="button"
                  onClick={addDocRow}
                  style={{ marginTop: "0.6rem", background: "none", border: "1px dashed rgba(30,43,77,0.2)", borderRadius: 10, padding: "0.45rem 0.8rem", fontSize: "0.82rem", fontWeight: 700, color: "#2057d7", cursor: "pointer" }}
                >
                  + Adicionar documento
                </button>
              ) : null}
            </div>

            <div className={styles.modalActions} style={{ marginTop: "1.2rem" }}>
              <button
                type="button"
                className={`${styles.buttonBase} ${styles.buttonGhost}`}
                onClick={closeComplete}
                disabled={processingId === completing.id}
              >
                Cancelar
              </button>
              <button
                type="button"
                className={`${styles.buttonBase} ${styles.buttonSuccess}`}
                onClick={submitComplete}
                disabled={
                  processingId === completing.id ||
                  response.trim().length < MIN_RESPONSE_LENGTH ||
                  response.trim().length > MAX_RESPONSE_LENGTH
                }
              >
                {processingId === completing.id ? "A enviar…" : "Concluir e enviar"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

export async function getServerSideProps(context) {
  const result = await requireAdminPageAuth(context);
  if (!result.ok) {
    return { redirect: result.redirect };
  }
  return { props: {} };
}
