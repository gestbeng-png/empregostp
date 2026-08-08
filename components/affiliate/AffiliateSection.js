import { useCallback, useEffect, useMemo, useState } from "react";
import styles from "../../styles/AffiliateSection.module.css";

const STATUS_META = {
  pending: {
    emoji: "⏳",
    badgeClass: "badgePending",
    label: "Em análise",
    title: "Candidatura recebida!",
    text: "A sua candidatura ao programa de afiliados está a ser analisada pela nossa equipa. Entraremos em contacto assim que for aprovada.",
  },
  approved: {
    emoji: "✅",
    badgeClass: "badgeApproved",
    label: "Aprovada",
    title: "É oficialmente um afiliado!",
    text: "A sua candidatura foi aprovada. A nossa equipa poderá contactá-lo com tarefas e oportunidades de colaboração.",
  },
  contacted: {
    emoji: "🤝",
    badgeClass: "badgeContacted",
    label: "Em colaboração",
    title: "Já estamos em contacto",
    text: "A nossa equipa já entrou em contacto consigo sobre o programa de afiliados. Obrigado pela colaboração!",
  },
  rejected: {
    emoji: "📄",
    badgeClass: "badgeRejected",
    label: "Não aprovada",
    title: "Candidatura não aprovada",
    text: "Desta vez a sua candidatura não foi aprovada. Pode atualizar os seus dados e submeter novamente.",
  },
};

const COPY = {
  candidato: {
    occupationLabel: "Profissão / Área de atuação",
    occupationPlaceholder: "Ex.: Designer, Contabilista, Estudante...",
    heroText:
      "Ajude a ligar mais pessoas a oportunidades de emprego em São Tomé e Príncipe. Registe-se como afiliado e colabore connosco em tarefas pontuais e ações de divulgação — e seja recompensado por isso.",
  },
  empresa: {
    occupationLabel: "Setor de atividade",
    occupationPlaceholder: "Ex.: Comércio, Turismo, Tecnologia...",
    heroText:
      "Torne a sua empresa parceira afiliada do EmpregoSTP. Colabore connosco em divulgação e ações conjuntas, alargue a sua rede e seja recompensado pelas indicações e parcerias.",
  },
};

const BENEFITS = [
  { title: "Recompensas", text: "Ganhe por tarefas e indicações concluídas." },
  { title: "Divulgação", text: "Ajude a espalhar oportunidades de emprego." },
  { title: "Rede em crescimento", text: "Faça parte da comunidade EmpregoSTP." },
];

async function getToken(user) {
  if (user?.getIdToken) {
    return user.getIdToken();
  }
  const { getAuth } = await import("firebase/auth");
  const auth = getAuth();
  return auth.currentUser?.getIdToken();
}

export default function AffiliateSection({ role = "candidato", user, defaults = {} }) {
  const copy = COPY[role] || COPY.candidato;

  const [checking, setChecking] = useState(true);
  const [application, setApplication] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    fullName: defaults.fullName || "",
    email: defaults.email || "",
    phone: defaults.phone || "",
    location: defaults.location || "",
    occupation: defaults.occupation || "",
    channels: "",
    motivation: "",
  });

  // Prefill quando os dados do perfil chegam depois do primeiro render
  useEffect(() => {
    setForm((prev) => ({
      ...prev,
      fullName: prev.fullName || defaults.fullName || "",
      email: prev.email || defaults.email || "",
      phone: prev.phone || defaults.phone || "",
      location: prev.location || defaults.location || "",
      occupation: prev.occupation || defaults.occupation || "",
    }));
  }, [defaults.fullName, defaults.email, defaults.phone, defaults.location, defaults.occupation]);

  const loadStatus = useCallback(async () => {
    try {
      const token = await getToken(user);
      if (!token) {
        setChecking(false);
        return;
      }
      const res = await fetch("/api/affiliate/apply", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setApplication(data.application || null);
      }
    } catch (error) {
      console.error("Erro ao carregar estado de afiliado:", error);
    } finally {
      setChecking(false);
    }
  }, [user]);

  useEffect(() => {
    loadStatus();
  }, [loadStatus]);

  const handleChange = (field) => (event) => {
    setForm((prev) => ({ ...prev, [field]: event.target.value }));
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
      const res = await fetch("/api/affiliate/apply", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(form),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setFeedback({ type: "error", text: data.error || "Erro ao enviar candidatura." });
        if (data.application) setApplication(data.application);
        return;
      }
      setApplication(data.application || null);
      setShowForm(false);
      setFeedback({ type: "success", text: data.message || "Candidatura enviada com sucesso!" });
    } catch (error) {
      console.error("Erro ao enviar candidatura de afiliado:", error);
      setFeedback({ type: "error", text: "Erro ao enviar candidatura. Tente novamente." });
    } finally {
      setSubmitting(false);
    }
  };

  const statusMeta = useMemo(() => {
    if (!application) return null;
    return STATUS_META[application.status] || STATUS_META.pending;
  }, [application]);

  // Estado bloqueante (já tem candidatura) e não está a reeditar após rejeição
  const hasActiveApplication =
    application && ["pending", "approved", "contacted"].includes(application.status);

  const renderHero = () => (
    <div className={styles.hero}>
      <span className={styles.heroBadge}>Programa de Afiliados</span>
      <h2 className={styles.heroTitle}>Torne-se afiliado do EmpregoSTP</h2>
      <p className={styles.heroText}>{copy.heroText}</p>
      <div className={styles.benefits}>
        {BENEFITS.map((b) => (
          <div key={b.title} className={styles.benefit}>
            <span>
              <strong>{b.title}</strong>
              {b.text}
            </span>
          </div>
        ))}
      </div>
    </div>
  );

  if (checking) {
    return (
      <div className={styles.wrap}>
        {renderHero()}
        <div className={styles.loading}>A carregar…</div>
      </div>
    );
  }

  if (hasActiveApplication && !showForm) {
    return (
      <div className={styles.wrap}>
        {renderHero()}
        {feedback && (
          <div
            className={`${styles.feedback} ${
              feedback.type === "success" ? styles.feedbackSuccess : styles.feedbackError
            }`}
          >
            {feedback.text}
          </div>
        )}
        <div className={styles.statusCard}>
          <span className={styles.statusEmoji}>{statusMeta.emoji}</span>
          <div className={styles.statusBody}>
            <h3>{statusMeta.title}</h3>
            <p>{statusMeta.text}</p>
            <span className={`${styles.badge} ${styles[statusMeta.badgeClass]}`}>
              {statusMeta.label}
            </span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.wrap}>
      {renderHero()}
      <div className={styles.card}>
        <h3 className={styles.cardTitle}>Candidatura de afiliado</h3>
        <p className={styles.cardSub}>
          {application?.status === "rejected"
            ? "Atualize os seus dados e submeta novamente a candidatura."
            : "Preencha os seus dados. A nossa equipa entrará em contacto para as próximas etapas."}
        </p>
        <form className={styles.form} onSubmit={handleSubmit}>
          <div className={styles.field}>
            <label className={styles.label}>
              Nome completo<span className={styles.req}>*</span>
            </label>
            <input
              className={styles.input}
              type="text"
              value={form.fullName}
              onChange={handleChange("fullName")}
              placeholder="O seu nome"
              required
            />
          </div>

          <div className={styles.field}>
            <label className={styles.label}>
              Email<span className={styles.req}>*</span>
            </label>
            <input
              className={styles.input}
              type="email"
              value={form.email}
              onChange={handleChange("email")}
              placeholder="email@exemplo.com"
              required
            />
          </div>

          <div className={styles.field}>
            <label className={styles.label}>
              Telefone / WhatsApp<span className={styles.req}>*</span>
            </label>
            <input
              className={styles.input}
              type="tel"
              value={form.phone}
              onChange={handleChange("phone")}
              placeholder="+239 000 0000"
              required
            />
          </div>

          <div className={styles.field}>
            <label className={styles.label}>Localização</label>
            <input
              className={styles.input}
              type="text"
              value={form.location}
              onChange={handleChange("location")}
              placeholder="Cidade / Distrito"
            />
          </div>

          <div className={styles.field}>
            <label className={styles.label}>{copy.occupationLabel}</label>
            <input
              className={styles.input}
              type="text"
              value={form.occupation}
              onChange={handleChange("occupation")}
              placeholder={copy.occupationPlaceholder}
            />
          </div>

          <div className={styles.field}>
            <label className={styles.label}>Redes sociais / canais</label>
            <input
              className={styles.input}
              type="text"
              value={form.channels}
              onChange={handleChange("channels")}
              placeholder="Facebook, Instagram, grupos, site..."
            />
          </div>

          <div className={`${styles.field} ${styles.full}`}>
            <label className={styles.label}>
              Porque quer ser afiliado e como pode colaborar?<span className={styles.req}>*</span>
            </label>
            <textarea
              className={styles.textarea}
              value={form.motivation}
              onChange={handleChange("motivation")}
              placeholder="Conte-nos como pretende ajudar a divulgar o EmpregoSTP, a sua disponibilidade e experiência relevante."
              required
            />
            <span className={styles.hint}>{form.motivation.length}/900 caracteres</span>
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
              {submitting ? "A enviar…" : "Enviar candidatura"}
            </button>
            <span className={styles.privacy}>
              Os seus dados são usados apenas para o programa de afiliados.
            </span>
          </div>
        </form>
      </div>
    </div>
  );
}
