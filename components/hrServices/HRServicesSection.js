import { useCallback, useEffect, useState } from "react";
import styles from "../../styles/HRServicesSection.module.css";

const SERVICE_TYPES = [
  "Recrutamento & Seleção",
  "Processamento salarial",
  "Contratos & Documentação",
  "Formação & Capacitação",
  "Consultoria de RH",
  "Avaliação de desempenho",
  "Apoio jurídico-laboral",
  "Outro",
];

const STATUS_META = {
  pending: { label: "Em análise", emoji: "⏳", badgeClass: "badgePending" },
  approved: { label: "Aprovado · em andamento", emoji: "🛠️", badgeClass: "badgeApproved" },
  completed: { label: "Concluído", emoji: "✅", badgeClass: "badgeCompleted" },
  rejected: { label: "Não aprovado", emoji: "📄", badgeClass: "badgeRejected" },
};

const BENEFITS = [
  { icon: "🧑‍💼", title: "Recrutamento", text: "Encontramos e triamos os candidatos certos." },
  { icon: "📑", title: "Documentação", text: "Contratos, folhas salariais e conformidade." },
  { icon: "🎓", title: "Formação", text: "Capacitação e desenvolvimento da sua equipa." },
];

const emptyDoc = () => ({ label: "", url: "" });

async function getToken(user) {
  if (user?.getIdToken) {
    return user.getIdToken();
  }
  const { getAuth } = await import("firebase/auth");
  const auth = getAuth();
  return auth.currentUser?.getIdToken();
}

function formatDateTime(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString("pt-PT", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function HRServicesSection({ user }) {
  const [checking, setChecking] = useState(true);
  const [requests, setRequests] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    serviceType: "",
    title: "",
    description: "",
    documents: [emptyDoc()],
  });

  const loadRequests = useCallback(async () => {
    try {
      const token = await getToken(user);
      if (!token) {
        setChecking(false);
        return;
      }
      const res = await fetch("/api/hr-services", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setRequests(Array.isArray(data.requests) ? data.requests : []);
      }
    } catch (error) {
      console.error("Erro ao carregar pedidos de serviço RH:", error);
    } finally {
      setChecking(false);
    }
  }, [user]);

  useEffect(() => {
    loadRequests();
  }, [loadRequests]);

  const resetForm = () =>
    setForm({ serviceType: "", title: "", description: "", documents: [emptyDoc()] });

  const handleField = (field) => (event) => {
    setForm((prev) => ({ ...prev, [field]: event.target.value }));
  };

  const handleDocChange = (index, key) => (event) => {
    const value = event.target.value;
    setForm((prev) => {
      const documents = prev.documents.map((doc, i) =>
        i === index ? { ...doc, [key]: value } : doc,
      );
      return { ...prev, documents };
    });
  };

  const addDocRow = () => {
    setForm((prev) =>
      prev.documents.length >= 10
        ? prev
        : { ...prev, documents: [...prev.documents, emptyDoc()] },
    );
  };

  const removeDocRow = (index) => {
    setForm((prev) => {
      const documents = prev.documents.filter((_, i) => i !== index);
      return { ...prev, documents: documents.length ? documents : [emptyDoc()] };
    });
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (submitting) return;
    setFeedback(null);
    setSubmitting(true);
    try {
      const token = await getToken(user);
      if (!token) {
        setFeedback({ type: "error", text: "Sessão expirada. Inicie sessão novamente." });
        return;
      }
      const documents = form.documents
        .map((doc) => ({ label: doc.label.trim(), url: doc.url.trim() }))
        .filter((doc) => doc.url);

      const res = await fetch("/api/hr-services", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          serviceType: form.serviceType,
          title: form.title,
          description: form.description,
          documents,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setFeedback({ type: "error", text: data.error || "Erro ao enviar pedido." });
        return;
      }
      if (data.request) {
        setRequests((prev) => [data.request, ...prev]);
      }
      resetForm();
      setShowForm(false);
      setFeedback({ type: "success", text: data.message || "Pedido enviado com sucesso!" });
    } catch (error) {
      console.error("Erro ao enviar pedido de serviço RH:", error);
      setFeedback({ type: "error", text: "Erro ao enviar pedido. Tente novamente." });
    } finally {
      setSubmitting(false);
    }
  };

  const hasRequests = requests.length > 0;

  const renderHero = () => (
    <div className={styles.hero}>
      <span className={styles.heroBadge}>🧑‍💼 Serviços de RH</span>
      <h2 className={styles.heroTitle}>Serviços de Recursos Humanos</h2>
      <p className={styles.heroText}>
        Precisa de apoio em recrutamento, contratos, folha salarial ou formação? Descreva o
        serviço que pretende, anexe os documentos necessários e a nossa equipa analisa o
        pedido e entrega-lhe o resultado diretamente aqui no painel.
      </p>
      <div className={styles.benefits}>
        {BENEFITS.map((b) => (
          <div key={b.title} className={styles.benefit}>
            <span className={styles.benefitIcon}>{b.icon}</span>
            <span>
              <strong>{b.title}</strong>
              {b.text}
            </span>
          </div>
        ))}
      </div>
    </div>
  );

  const renderForm = () => (
    <div className={styles.card}>
      <h3 className={styles.cardTitle}>Novo pedido de serviço</h3>
      <p className={styles.cardSub}>
        Indique o serviço pretendido e forneça o máximo de detalhes possível. Pode anexar links
        de documentos (Google Drive, Dropbox, etc.).
      </p>
      <form className={styles.form} onSubmit={handleSubmit}>
        <div className={styles.field}>
          <label className={styles.label}>
            Tipo de serviço<span className={styles.req}>*</span>
          </label>
          <select
            className={styles.input}
            value={form.serviceType}
            onChange={handleField("serviceType")}
            required
          >
            <option value="">Selecione…</option>
            {SERVICE_TYPES.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>
        </div>

        <div className={styles.field}>
          <label className={styles.label}>
            Assunto<span className={styles.req}>*</span>
          </label>
          <input
            className={styles.input}
            type="text"
            value={form.title}
            onChange={handleField("title")}
            placeholder="Ex.: Recrutamento de 2 técnicos de contabilidade"
            required
          />
        </div>

        <div className={`${styles.field} ${styles.full}`}>
          <label className={styles.label}>
            Descrição detalhada<span className={styles.req}>*</span>
          </label>
          <textarea
            className={styles.textarea}
            value={form.description}
            onChange={handleField("description")}
            placeholder="Descreva o serviço pretendido, requisitos, prazos, número de pessoas envolvidas e qualquer informação relevante."
            required
          />
          <span className={styles.hint}>{form.description.length}/3000 caracteres</span>
        </div>

        <div className={`${styles.field} ${styles.full}`}>
          <label className={styles.label}>Documentos (links)</label>
          <p className={styles.docHint}>
            Cole o link de cada documento de apoio. Garanta que a partilha está ativada para quem
            tiver o link.
          </p>
          <div className={styles.docList}>
            {form.documents.map((doc, index) => (
              <div key={index} className={styles.docRow}>
                <input
                  className={`${styles.input} ${styles.docLabelInput}`}
                  type="text"
                  value={doc.label}
                  onChange={handleDocChange(index, "label")}
                  placeholder="Nome (opcional)"
                />
                <input
                  className={`${styles.input} ${styles.docUrlInput}`}
                  type="url"
                  value={doc.url}
                  onChange={handleDocChange(index, "url")}
                  placeholder="https://…"
                />
                <button
                  type="button"
                  className={styles.docRemoveBtn}
                  onClick={() => removeDocRow(index)}
                  aria-label="Remover documento"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
          {form.documents.length < 10 && (
            <button type="button" className={styles.docAddBtn} onClick={addDocRow}>
              + Adicionar outro documento
            </button>
          )}
        </div>

        {feedback && (
          <div
            className={`${styles.feedback} ${
              feedback.type === "success" ? styles.feedbackSuccess : styles.feedbackError
            }`}
          >
            {feedback.text}
          </div>
        )}

        <div className={styles.actions}>
          <button type="submit" className={styles.submitBtn} disabled={submitting}>
            {submitting ? "A enviar…" : "Enviar pedido"}
          </button>
          {hasRequests && (
            <button
              type="button"
              className={styles.cancelBtn}
              onClick={() => {
                resetForm();
                setShowForm(false);
                setFeedback(null);
              }}
              disabled={submitting}
            >
              Cancelar
            </button>
          )}
        </div>
      </form>
    </div>
  );

  const renderRequestCard = (request) => {
    const meta = STATUS_META[request.status] || STATUS_META.pending;
    return (
      <article key={request.id} className={styles.requestCard}>
        <div className={styles.requestHead}>
          <div>
            <span className={styles.requestType}>{request.serviceType}</span>
            <h4 className={styles.requestTitle}>{request.title}</h4>
          </div>
          <span className={`${styles.badge} ${styles[meta.badgeClass]}`}>
            {meta.emoji} {meta.label}
          </span>
        </div>

        <p className={styles.requestDesc}>{request.description}</p>

        {request.documents?.length > 0 && (
          <div className={styles.docsBlock}>
            <span className={styles.docsBlockTitle}>Documentos enviados</span>
            <div className={styles.docChips}>
              {request.documents.map((doc, i) => (
                <a
                  key={i}
                  href={doc.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={styles.docChip}
                >
                  📎 {doc.label || "Documento"}
                </a>
              ))}
            </div>
          </div>
        )}

        {request.adminResponse && (
          <div className={styles.responseBlock}>
            <span className={styles.responseTitle}>Resposta da equipa EmpregoSTP</span>
            <p className={styles.responseText}>{request.adminResponse}</p>
            {request.resultDocuments?.length > 0 && (
              <div className={styles.docChips}>
                {request.resultDocuments.map((doc, i) => (
                  <a
                    key={i}
                    href={doc.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`${styles.docChip} ${styles.docChipResult}`}
                  >
                    📥 {doc.label || "Documento"}
                  </a>
                ))}
              </div>
            )}
          </div>
        )}

        <p className={styles.requestDate}>Enviado em {formatDateTime(request.createdAt)}</p>
      </article>
    );
  };

  if (checking) {
    return (
      <div className={styles.wrap}>
        {renderHero()}
        <div className={styles.loading}>A carregar…</div>
      </div>
    );
  }

  return (
    <div className={styles.wrap}>
      {renderHero()}

      {feedback && !showForm && (
        <div
          className={`${styles.feedback} ${
            feedback.type === "success" ? styles.feedbackSuccess : styles.feedbackError
          }`}
        >
          {feedback.text}
        </div>
      )}

      {showForm ? (
        renderForm()
      ) : (
        <div className={styles.newRequestBar}>
          <div>
            <h3 className={styles.barTitle}>Os seus pedidos</h3>
            <p className={styles.barSub}>
              {hasRequests
                ? `${requests.length} pedido${requests.length === 1 ? "" : "s"} de serviço RH.`
                : "Ainda não tem pedidos. Crie o seu primeiro."}
            </p>
          </div>
          <button type="button" className={styles.submitBtn} onClick={() => setShowForm(true)}>
            + Novo pedido
          </button>
        </div>
      )}

      {!showForm && hasRequests && (
        <div className={styles.requestList}>{requests.map(renderRequestCard)}</div>
      )}

      {!showForm && !hasRequests && !checking && (
        <div className={styles.emptyState}>
          <span className={styles.emptyEmoji}>📋</span>
          <p>Solicite o seu primeiro serviço de RH para começar.</p>
        </div>
      )}
    </div>
  );
}
