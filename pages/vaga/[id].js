import Head from "next/head";
import Link from "next/link";
import { useState, useEffect, useMemo } from "react";
import { getAuth } from "firebase/auth";
import { useAuth } from "../../context/AuthContext";
import PublicPageShell from "../../components/PublicPageShell";
import Badge from "../../components/Badge";
import UpgradeModal from "../../components/UpgradeModal";
import styles from "../../styles/VagaDetailPage.module.css";
import {
  FiArrowLeft,
  FiBookmark,
  FiBriefcase,
  FiCalendar,
  FiCheckCircle,
  FiChevronRight,
  FiClock,
  FiDollarSign,
  FiDownload,
  FiFileText,
  FiGlobe,
  FiMail,
  FiMapPin,
  FiPhone,
  FiShare2,
  FiShield,
  FiZap,
} from "react-icons/fi";
import { HiOutlineBuildingOffice2 } from "react-icons/hi2";
import {
  buildCoverLetterSuggestion,
  evaluateCandidateJobAccess,
  getCandidatePremiumApplicationAccess,
  getJobApplicationPremiumConfig,
  normalizeCoverLetter,
} from "../../lib/candidateApplicationPremium";
import { analyzeCandidateJobFit } from "../../lib/candidateOptimizationInsights";
import { getPublicSkillsAssessment } from "../../lib/skillsAssessment";

function formatCurrency(value) {
  if (!value && value !== 0) return "";
  return Number(value).toLocaleString("pt-ST", {
    style: "currency",
    currency: "STN",
  });
}

function formatDate(value) {
  if (!value) return "Não informado";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("pt-PT", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatDateTime(value) {
  if (!value) return "Não informado";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("pt-PT", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function parseList(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value.filter(Boolean);
  if (typeof value === "string") {
    return value
      .split(/\n|,|;/g)
      .map((item) => item.trim())
      .filter(Boolean);
  }
  return [];
}

function resolveUrl(value) {
  if (!value) return "";
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return resolveUrl(value[0]);
  if (typeof value === "object") {
    const common =
      value.url ||
      value.downloadURL ||
      value.link ||
      value.href ||
      value.path ||
      value.fullPath;
    if (typeof common === "string") return common;
    for (const key in value) {
      if (
        typeof value[key] === "string" &&
        (value[key].startsWith("http") || value[key].startsWith("/"))
      ) {
        return value[key];
      }
    }
  }
  return "";
}

function getContractTypeLabel(value) {
  const types = {
    "full-time": "Tempo integral",
    "part-time": "Meio período",
    contract: "Contrato",
    internship: "Estágio",
    freelance: "Freelance",
    estagio: "Estágio",
    contrato: "Contrato",
  };
  return (
    types[String(value || "").toLowerCase()] || value || "Não especificado"
  );
}

function getStatusLabel(status) {
  const normalized = String(status || "").toLowerCase();
  if (!normalized || normalized === "active" || normalized === "open")
    return "Aberta";
  if (normalized === "closed") return "Fechada";
  if (normalized === "disabled" || normalized === "inactive")
    return "Desativada";
  if (normalized === "draft") return "Rascunho";
  return status || "Não informado";
}

function getCompanyInitials(companyLabel) {
  return (
    String(companyLabel || "Empresa")
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part.charAt(0).toUpperCase())
      .join("") || "EM"
  );
}

function serializeTimestamp(timestamp) {
  if (timestamp && typeof timestamp.toDate === "function") {
    return timestamp.toDate().toISOString();
  }
  return timestamp;
}

function serializeJob(job) {
  const serialized = { ...job };
  for (const key in serialized) {
    if (
      serialized[key] &&
      typeof serialized[key] === "object" &&
      typeof serialized[key].toDate === "function"
    ) {
      serialized[key] = serializeTimestamp(serialized[key]);
    } else if (
      serialized[key] &&
      typeof serialized[key] === "object" &&
      !Array.isArray(serialized[key])
    ) {
      serialized[key] = serializeJob(serialized[key]);
    }
  }
  return serialized;
}

export default function VagaDetalhe({ vaga, relatedJobs = [] }) {
  const { user } = useAuth();
  const [applyStatus, setApplyStatus] = useState("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [userType, setUserType] = useState(null);
  const [candidateProfileData, setCandidateProfileData] = useState(null);
  const [isSaved, setIsSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [upgradeModal, setUpgradeModal] = useState({
    open: false,
    message: "",
  });
  const [assessmentAnswers, setAssessmentAnswers] = useState([]);
  const [coverLetter, setCoverLetter] = useState("");
  const [isGeneratingCoverLetter, setIsGeneratingCoverLetter] = useState(false);
  const assessmentQuestions = useMemo(
    () => vaga?.skillsAssessment?.questions || [],
    [vaga?.skillsAssessment?.questions],
  );

  useEffect(() => {
    setAssessmentAnswers(new Array(assessmentQuestions.length).fill(null));
  }, [assessmentQuestions.length, vaga?.id, assessmentQuestions]);

  useEffect(() => {
    setCoverLetter("");
  }, [vaga?.id]);

  useEffect(() => {
    async function trackView() {
      if (!vaga?.id) return;

      try {
        await fetch("/api/track-view", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            jobId: vaga.id,
            userId: user?.uid || null,
            source: "job-detail",
          }),
        });
      } catch (err) {
        console.error("Erro ao registrar visualização:", err);
      }
    }

    trackView();
  }, [vaga?.id, user?.uid]);

  useEffect(() => {
    async function checkExisting() {
      if (!user || !vaga?.id) return;
      try {
        const auth = getAuth();
        const token = await auth.currentUser?.getIdToken();
        if (!token) return;

        const response = await fetch(`/api/applications?jobId=${vaga.id}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (response.ok) {
          const data = await response.json();
          if (data.applications && data.applications.length > 0) {
            setApplyStatus("success");
          }
        }
      } catch (_) {
        // ignore
      }
    }

    checkExisting();
  }, [user, vaga?.id]);

  useEffect(() => {
    async function loadProfile() {
      if (!user) {
        setUserType(null);
        setCandidateProfileData(null);
        return;
      }
      try {
        const auth = getAuth();
        const token = await auth.currentUser?.getIdToken();
        if (!token) {
          setUserType(null);
          return;
        }

        const response = await fetch("/api/profile", {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
        if (response.ok) {
          const data = await response.json();
          const profilePayload = data?.profile?.data || null;
          setUserType(profilePayload?.userType || null);
          setCandidateProfileData(profilePayload);
        } else {
          setUserType(null);
          setCandidateProfileData(null);
        }
      } catch (_) {
        setUserType(null);
        setCandidateProfileData(null);
      }
    }

    loadProfile();
  }, [user]);

  useEffect(() => {
    async function loadSavedJobs() {
      if (!user || !vaga?.id) return;
      try {
        const auth = getAuth();
        const token = await auth.currentUser?.getIdToken();
        if (!token) return;

        const response = await fetch("/api/saved-jobs", {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (response.ok) {
          const data = await response.json();
          const ids = data.savedJobs?.map((job) => job.id) || [];
          setIsSaved(ids.includes(vaga.id));
        }
      } catch (err) {
        console.error("Erro ao carregar vagas salvas:", err);
      }
    }

    loadSavedJobs();
  }, [user, vaga?.id]);

  const salaryRange = useMemo(() => {
    if (!vaga) return "A combinar";
    const { salarioDe, salarioAte } = vaga;
    if (!salarioDe && !salarioAte) return "A combinar";
    const start = salarioDe ? formatCurrency(salarioDe) : "";
    const end = salarioAte ? formatCurrency(salarioAte) : "";
    if (start && end) return `${start} - ${end}`;
    return start || end || "A combinar";
  }, [vaga]);

  const postedAtLabel = useMemo(() => {
    if (!vaga) return "Publicado recentemente";
    const raw =
      vaga.publicadoEm || vaga.createdAt || vaga.dataAbertura || vaga.dataFecho;
    if (!raw) return "Publicado recentemente";
    return formatDate(raw);
  }, [vaga]);

  const premiumConfig = useMemo(
    () => getJobApplicationPremiumConfig(vaga),
    [vaga],
  );
  const candidatePremiumAccess = useMemo(
    () => getCandidatePremiumApplicationAccess(candidateProfileData),
    [candidateProfileData],
  );
  const normalizedCoverLetter = useMemo(
    () => normalizeCoverLetter(coverLetter),
    [coverLetter],
  );
  const premiumApplyRestriction = useMemo(() => {
    if (!user || (userType && userType !== "candidato")) return null;
    if (user && !candidateProfileData && userType === null) return null;
    const access = evaluateCandidateJobAccess(vaga, candidateProfileData);
    return access.allowed ? null : access;
  }, [vaga, candidateProfileData, user, userType]);

  const candidateJobInsights = useMemo(() => {
    if (!user || (userType && userType !== "candidato")) return null;
    if (!candidateProfileData) return null;
    return analyzeCandidateJobFit(
      vaga,
      candidateProfileData,
      candidateProfileData,
    );
  }, [vaga, candidateProfileData, user, userType]);

  if (!vaga) {
    return (
      <PublicPageShell headerVariant="light">
        <main className={styles.notFound}>
          <h2>Vaga não encontrada</h2>
          <Link href="/vagas" className={styles.notFoundLink}>
            Voltar para vagas
          </Link>
        </main>
      </PublicPageShell>
    );
  }

  const {
    titulo,
    descricao,
    requisitos,
    responsabilidades,
    localizacao,
    tipoContrato,
    beneficios,
    dataAbertura,
    dataFecho,
    status,
    destaque,
  } = vaga;

  const companyLabel =
    vaga.empresaNome || vaga.companyName || vaga.empresa || "Empresa";
  const companyInitials = getCompanyInitials(companyLabel);
  const tdrUrl = resolveUrl(
    vaga.tdrUrl ||
      vaga.tdrURL ||
      vaga.tdr_url ||
      vaga.tdr ||
      vaga.termosReferenciaUrl ||
      vaga.termosReferencia ||
      vaga.tdrLink ||
      vaga.tdrPdf ||
      vaga.tdrFile ||
      vaga.tdrArquivo ||
      vaga.documentoTdr ||
      vaga.termosReferenciaArquivo ||
      vaga.ficheiroTdr,
  );

  const requirementsList = parseList(requisitos);
  const responsibilitiesList = parseList(responsabilidades);
  const benefitsList = parseList(beneficios);
  const overviewParagraphs = String(descricao || "")
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);
  const skillsTags = Array.from(
    new Set(
      [
        ...(Array.isArray(vaga.palavrasChave) ? vaga.palavrasChave : []),
        vaga.categoria,
        vaga.nivelExperiencia,
      ]
        .map((item) => String(item || "").trim())
        .filter(Boolean),
    ),
  ).slice(0, 8);

  const fallbackRequirements = [
    "Experiência prática relevante para a função e ambiente de trabalho descritos.",
    "Capacidade de execução com atenção a prazos, qualidade e responsabilidade.",
    "Boa comunicação, organização e compromisso com resultados.",
    "Disponibilidade compatível com a localização e modalidade da vaga.",
  ];

  const benefitsToShow = benefitsList.length
    ? benefitsList
    : [
        "Salário competitivo",
        "Contexto profissional estruturado",
        "Processo de candidatura organizado",
      ];

  const publicAssessment = vaga?.skillsAssessment?.enabled
    ? vaga.skillsAssessment
    : null;
  const assessmentComplete =
    !publicAssessment ||
    (assessmentAnswers.length === publicAssessment.questions.length &&
      assessmentAnswers.every((answer) => Number.isInteger(answer)));

  const statusLabel = getStatusLabel(status);
  const remoteLabel =
    typeof vaga.remoto === "boolean"
      ? vaga.remoto
        ? "Remoto"
        : "Presencial"
      : "Não informado";
  const badgeStatus = destaque ? "urgent" : status;
  const isOpen = status === "active" || status === "open" || !status;
  const isApplying = applyStatus === "loading";
  const isApplied = applyStatus === "success";
  const isBlocked = Boolean(userType && userType !== "candidato");
  const missingRequiredCoverLetter = Boolean(
    premiumConfig.requireCoverLetter &&
    user &&
    candidatePremiumAccess.canUseCoverLetter &&
    !normalizedCoverLetter,
  );
  const applyDisabled =
    !isOpen ||
    isApplying ||
    isApplied ||
    isBlocked ||
    !assessmentComplete ||
    missingRequiredCoverLetter;

  const details = [
    { label: "Salário", value: salaryRange, Icon: FiDollarSign },
    {
      label: "Tipo de contrato",
      value: getContractTypeLabel(tipoContrato),
      Icon: FiBriefcase,
    },
    {
      label: "Localização",
      value: localizacao || "Não informado",
      Icon: FiMapPin,
    },
    { label: "Regime", value: remoteLabel, Icon: FiGlobe },
    {
      label: "Nível de experiência",
      value: vaga.nivelExperiencia || vaga.experiencia || "Não informado",
      Icon: FiCheckCircle,
    },
    {
      label: "Escolaridade",
      value: vaga.escolaridade || "Não informado",
      Icon: FiFileText,
    },
    { label: "Abertura", value: formatDate(dataAbertura), Icon: FiCalendar },
    { label: "Encerramento", value: formatDate(dataFecho), Icon: FiClock },
  ];

  const companyInfoItems = [
    vaga.companyLocation
      ? { label: "Localização", value: vaga.companyLocation, Icon: FiMapPin }
      : null,
    vaga.companyPhone
      ? {
          label: "Telefone",
          value: vaga.companyPhone,
          Icon: FiPhone,
          href: `tel:${vaga.companyPhone}`,
        }
      : null,
    vaga.companyEmail
      ? {
          label: "Email",
          value: vaga.companyEmail,
          Icon: FiMail,
          href: `mailto:${vaga.companyEmail}`,
        }
      : null,
    vaga.companyWebsite
      ? {
          label: "Website",
          value: vaga.companyWebsite,
          Icon: FiGlobe,
          href: vaga.companyWebsite,
        }
      : null,
  ].filter(Boolean);

  const shareUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/vaga/${vaga.id}`
      : "";
  const shareText = `Confira esta vaga: ${titulo}`;
  const metaDescription =
    descricao?.substring(0, 160) ||
    `Vaga de ${titulo} em ${localizacao || "São Tomé e Príncipe"} com detalhes, requisitos e candidatura online.`;

  const handleShare = () => {
    if (!shareUrl) return;
    if (navigator.share) {
      navigator
        .share({
          title: titulo,
          text: shareText,
          url: shareUrl,
        })
        .catch((shareError) => {
          if (shareError?.name === "AbortError") return;
          console.error("Erro ao compartilhar:", shareError);
        });
      return;
    }

    try {
      navigator.clipboard.writeText(`${shareText} ${shareUrl}`);
      alert("Link copiado! Cole onde quiser compartilhar.");
    } catch (_) {
      alert(
        `Não foi possível compartilhar automaticamente. Copie o link manualmente: ${shareUrl}`,
      );
    }
  };

  const handleToggleSave = async () => {
    if (saving) return;
    setSaving(true);

    try {
      const auth = getAuth();
      const currentUser = auth.currentUser;

      if (!currentUser) {
        window.location.href = `/login?redirect=/vaga/${vaga.id}`;
        return;
      }

      const token = await currentUser.getIdToken();
      const method = isSaved ? "DELETE" : "POST";

      const response = await fetch("/api/saved-jobs", {
        method,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ jobId: vaga.id }),
      });

      if (response.ok) {
        setIsSaved(!isSaved);
        return;
      }

      let errorData = {};
      try {
        errorData = await response.json();
      } catch (_) {
        // ignore parse errors
      }

      const shouldShowUpgrade =
        errorData.code === "SAVED_JOBS_LIMIT_REACHED" ||
        errorData.code === "FEATURE_PRO_ONLY" ||
        Boolean(errorData.upgradeMessage);

      if (shouldShowUpgrade) {
        setUpgradeModal({
          open: true,
          message:
            errorData.upgradeMessage ||
            errorData.error ||
            "Faça upgrade para salvar mais vagas.",
          userType: "candidato",
        });
        return;
      }

      alert(errorData.error || "Erro ao salvar vaga");
    } catch (err) {
      console.error("Erro ao salvar vaga:", err);
      alert("Erro ao salvar vaga. Tente novamente.");
    } finally {
      setSaving(false);
    }
  };

  const handleGenerateCoverLetter = async () => {
    if (!user) {
      window.location.href = `/login?redirect=/vaga/${vaga.id}`;
      return;
    }

    if (userType && userType !== "candidato") {
      setErrorMsg("Entre com uma conta de candidato para usar este recurso.");
      return;
    }

    if (!candidatePremiumAccess.canUseCoverLetter) {
      setUpgradeModal({
        open: true,
        message:
          "Cartas de apresentação personalizadas estão disponíveis apenas nos planos Profissional e Premium.",
        userType: "candidato",
      });
      return;
    }

    setIsGeneratingCoverLetter(true);
    try {
      const suggestion = buildCoverLetterSuggestion({
        job: vaga,
        userData: candidateProfileData || {},
        profileData: candidateProfileData || {},
      });
      setCoverLetter(suggestion);
    } finally {
      setIsGeneratingCoverLetter(false);
    }
  };

  const handleApply = async () => {
    if (!user) {
      window.location.href = `/login?redirect=/vaga/${vaga.id}`;
      return;
    }
    if (userType && userType !== "candidato") {
      setErrorMsg(
        "O seu perfil atual não pode candidatar a esta vaga. Entre com uma conta de candidato.",
      );
      setApplyStatus("error");
      return;
    }
    if (premiumApplyRestriction) {
      setUpgradeModal({
        open: true,
        message:
          premiumApplyRestriction.upgradeMessage ||
          premiumApplyRestriction.reason ||
          "Faça upgrade para continuar.",
        userType: "candidato",
      });
      setApplyStatus("idle");
      return;
    }
    if (
      premiumConfig.requireCoverLetter &&
      candidatePremiumAccess.canUseCoverLetter &&
      !normalizedCoverLetter
    ) {
      setErrorMsg("Esta vaga exige carta de apresentação personalizada.");
      setApplyStatus("error");
      return;
    }
    try {
      setApplyStatus("loading");
      setErrorMsg("");

      const auth = getAuth();
      const token = await auth.currentUser?.getIdToken();

      if (!token) {
        window.location.href = `/login?redirect=/vaga/${vaga.id}`;
        return;
      }

      const response = await fetch("/api/applications", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          jobId: vaga.id,
          assessmentAnswers,
          coverLetter: normalizedCoverLetter,
        }),
      });

      if (response.status === 409) {
        setApplyStatus("success");
        return;
      }

      if (!response.ok) {
        let friendly = "Erro ao enviar candidatura";
        try {
          const data = await response.json();
          if (
            response.status === 403 &&
            (data.upgradeMessage ||
              data.code === "APPLICATION_LIMIT_REACHED" ||
              data.code === "FEATURED_JOB_RESTRICTED" ||
              data.code === "PREMIUM_JOB_RESTRICTED" ||
              data.code === "EARLY_ACCESS_RESTRICTED" ||
              data.code === "PREMIUM_APPLICATION_TOOLS_ONLY")
          ) {
            setUpgradeModal({
              open: true,
              message:
                data.upgradeMessage ||
                data.error ||
                "Faça upgrade para continuar!",
            });
            setApplyStatus("idle");
            return;
          }
          friendly = data?.error || friendly;
        } catch (_) {
          // ignore
        }
        setErrorMsg(friendly);
        setApplyStatus("error");
        return;
      }

      setApplyStatus("success");
    } catch (err) {
      console.warn("Erro ao candidatar:", err?.message || err);
      setErrorMsg(err?.message || "Erro ao candidatar-se.");
      setApplyStatus("error");
    }
  };

  return (
    <>
      <UpgradeModal
        isOpen={upgradeModal.open}
        onClose={() => setUpgradeModal({ open: false, message: "" })}
        message={upgradeModal.message}
        upgradeUrl="/premium/candidatos"
        userType="candidato"
      />

      <Head>
        <title>{titulo} - EmpregoSTP</title>
        <meta name="description" content={metaDescription} />
      </Head>

      <PublicPageShell headerVariant="light">
        <div className={styles.page}>
          <div className={styles.toolbar}>
            <Link href="/vagas" className={styles.backButton}>
              <span className={styles.backIcon}>
                <FiArrowLeft size={17} />
              </span>
              Voltar para vagas
            </Link>

            <div className={styles.toolbarActions}>
              <button
                type="button"
                className={styles.toolbarButton}
                onClick={handleShare}
                title="Partilhar"
              >
                <FiShare2 size={18} />
              </button>
              {userType !== "empresa" && (
                <button
                  type="button"
                  className={`${styles.toolbarButton} ${isSaved ? styles.toolbarButtonSaved : ""}`}
                  onClick={handleToggleSave}
                  disabled={saving}
                  title={isSaved ? "Remover dos salvos" : "Salvar vaga"}
                >
                  <FiBookmark size={18} />
                </button>
              )}
            </div>
          </div>

          <section className={styles.hero}>
            <div className={styles.heroMain}>
              <div className={styles.signalRow}>
                <Badge status={badgeStatus} />
                {premiumConfig.premiumOnly && (
                  <span
                    className={`${styles.signalPill} ${styles.signalPillGold}`}
                  >
                    <FiShield size={13} />
                    Vaga premium
                  </span>
                )}
                {premiumConfig.isEarlyAccessActive && (
                  <span
                    className={`${styles.signalPill} ${styles.signalPillCyan}`}
                  >
                    <FiZap size={13} />
                    Acesso antecipado até{" "}
                    {formatDateTime(premiumConfig.earlyAccessUntil)}
                  </span>
                )}
                {premiumConfig.requireCoverLetter && (
                  <span
                    className={`${styles.signalPill} ${styles.signalPillGreen}`}
                  >
                    <FiFileText size={13} />
                    Carta obrigatória
                  </span>
                )}
              </div>

              <div className={styles.companyBand}>
                <div className={styles.companyMark}>
                  {vaga.companyLogo || vaga.empresaLogo ? (
                    <>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={vaga.companyLogo || vaga.empresaLogo}
                        alt={companyLabel}
                        className={styles.companyLogo}
                        loading="eager"
                        decoding="async"
                        width="72"
                        height="72"
                      />
                    </>
                  ) : (
                    <span className={styles.companyInitials}>
                      {companyInitials}
                    </span>
                  )}
                </div>

                <div className={styles.companyInfo}>
                  <div className={styles.companyTitleRow}>
                    <span className={styles.companyName}>{companyLabel}</span>
                    {vaga.companyVerified ? (
                      <span className={styles.verifiedBadge}>
                        <FiCheckCircle size={12} />
                        Empresa verificada
                      </span>
                    ) : null}
                  </div>

                  <div className={styles.companyMetaRow}>
                    <span className={styles.metaChip}>
                      <HiOutlineBuildingOffice2 size={15} />
                      {vaga.categoria || "Oportunidade profissional"}
                    </span>
                    <span className={styles.metaChip}>
                      <FiMapPin size={15} />
                      {localizacao || "Local não informado"}
                    </span>
                  </div>
                </div>
              </div>

              <h1 className={styles.title}>{titulo}</h1>

              <p className={styles.subtitle}>
                {overviewParagraphs[0] ||
                  "Consulte os detalhes completos da vaga, requisitos, benefícios e recursos de candidatura abaixo."}
              </p>

              <div className={styles.summaryGrid}>
                <div className={styles.summaryCard}>
                  <span className={styles.summaryLabel}>Faixa salarial</span>
                  <strong className={styles.summaryValue}>{salaryRange}</strong>
                </div>
                <div className={styles.summaryCard}>
                  <span className={styles.summaryLabel}>Contrato</span>
                  <strong className={styles.summaryValue}>
                    {getContractTypeLabel(tipoContrato)}
                  </strong>
                </div>
                <div className={styles.summaryCard}>
                  <span className={styles.summaryLabel}>Publicado</span>
                  <strong className={styles.summaryValue}>
                    {postedAtLabel}
                  </strong>
                </div>
                <div className={styles.summaryCard}>
                  <span className={styles.summaryLabel}>Prazo</span>
                  <strong className={styles.summaryValue}>
                    {formatDate(dataFecho)}
                  </strong>
                </div>
              </div>

              {skillsTags.length > 0 && (
                <div className={styles.tagRow}>
                  {skillsTags.map((tag) => (
                    <span key={tag} className={styles.tag}>
                      {tag}
                    </span>
                  ))}
                </div>
              )}

              {premiumConfig.hasPremiumFlow && (
                <div className={styles.premiumCallout}>
                  <div className={styles.premiumCalloutTitle}>
                    Fluxo premium de candidatura
                  </div>
                  <p className={styles.premiumCalloutText}>
                    {premiumConfig.premiumOnly
                      ? "Esta vaga está aberta apenas para candidatos Profissional e Premium."
                      : "Esta vaga usa recursos premium para elevar a qualidade da candidatura."}
                    {premiumConfig.isEarlyAccessActive
                      ? ` Durante a janela antecipada, o acesso fica reservado até ${formatDateTime(premiumConfig.earlyAccessUntil)}.`
                      : ""}
                    {premiumConfig.requireCoverLetter
                      ? " A carta de apresentação personalizada faz parte do envio."
                      : ""}
                  </p>
                  {user && !isBlocked && premiumApplyRestriction && (
                    <p className={styles.premiumCalloutWarning}>
                      {premiumApplyRestriction.reason}
                    </p>
                  )}
                  {user &&
                    !isBlocked &&
                    !premiumApplyRestriction &&
                    candidatePremiumAccess.priorityApplied && (
                      <p className={styles.premiumCalloutPositive}>
                        O seu plano atual envia esta candidatura com prioridade
                        adicional na triagem.
                      </p>
                    )}
                </div>
              )}
            </div>
          </section>

          <div className={styles.mainGrid}>
            <div className={styles.contentColumn}>
              <section className={styles.sectionCard}>
                <div className={styles.sectionHeader}>
                  <h2 className={styles.sectionTitle}>
                    Visão geral da oportunidade
                  </h2>
                </div>
                <div className={styles.richText}>
                  {(overviewParagraphs.length
                    ? overviewParagraphs
                    : ["Descrição não informada."]
                  ).map((paragraph) => (
                    <p key={paragraph}>{paragraph}</p>
                  ))}
                </div>
              </section>

              <section className={styles.sectionCard}>
                <div className={styles.sectionHeader}>
                  <h2 className={styles.sectionTitle}>Informações da vaga</h2>
                </div>
                <div className={styles.detailsGrid}>
                  {details.map((item) => (
                    <div key={item.label} className={styles.detailCard}>
                      <span className={styles.detailIcon}>
                        <item.Icon size={16} />
                      </span>
                      <div className={styles.detailBody}>
                        <span className={styles.detailLabel}>{item.label}</span>
                        <strong className={styles.detailValue}>
                          {item.value}
                        </strong>
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              {responsibilitiesList.length > 0 && (
                <section className={styles.sectionCard}>
                  <div className={styles.sectionHeader}>
                    <h2 className={styles.sectionTitle}>
                      Responsabilidades principais
                    </h2>
                  </div>
                  <div className={styles.bulletList}>
                    {responsibilitiesList.map((item) => (
                      <div key={item} className={styles.bulletItem}>
                        <span className={styles.bulletIcon}>
                          <FiCheckCircle size={12} />
                        </span>
                        <span>{item}</span>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              <section className={styles.sectionCard}>
                <div className={styles.sectionHeader}>
                  <h2 className={styles.sectionTitle}>O que procuramos</h2>
                </div>
                <div className={styles.bulletList}>
                  {(requirementsList.length
                    ? requirementsList
                    : fallbackRequirements
                  ).map((item) => (
                    <div key={item} className={styles.bulletItem}>
                      <span className={styles.bulletIcon}>
                        <FiCheckCircle size={12} />
                      </span>
                      <span>{item}</span>
                    </div>
                  ))}
                </div>
              </section>

              <section className={styles.sectionCard}>
                <div className={styles.sectionHeader}>
                  <h2 className={styles.sectionTitle}>Benefícios e contexto</h2>
                </div>
                <div className={styles.benefitsGrid}>
                  {benefitsToShow.map((benefit) => (
                    <div key={benefit} className={styles.benefitCard}>
                      <span className={styles.benefitIcon}>
                        <FiZap size={16} />
                      </span>
                      <strong>{benefit}</strong>
                      <p>
                        Benefício ou vantagem associada a esta oportunidade.
                      </p>
                    </div>
                  ))}
                </div>
              </section>

              {tdrUrl && (
                <section className={styles.sectionCard}>
                  <div className={styles.sectionHeader}>
                    <h2 className={styles.sectionTitle}>
                      Documentação da vaga
                    </h2>
                  </div>
                  <div className={styles.documentCard}>
                    <div className={styles.documentCopy}>
                      <span className={styles.documentIcon}>
                        <FiFileText size={18} />
                      </span>
                      <div>
                        <strong>Termos de Referência</strong>
                        <p>
                          Documento oficial com escopo técnico, critérios e
                          contexto adicional da posição.
                        </p>
                      </div>
                    </div>
                    <a
                      href={tdrUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={styles.documentButton}
                    >
                      <FiDownload size={14} />
                      Descarregar
                    </a>
                  </div>
                </section>
              )}

              {publicAssessment && (
                <section className={styles.sectionCard}>
                  <div className={styles.sectionHeader}>
                    <h2 className={styles.sectionTitle}>
                      Teste de habilidades
                    </h2>
                  </div>
                  <p className={styles.sectionLead}>
                    Responda {publicAssessment.questions.length} pergunta(s).
                    Nota mínima exigida: {publicAssessment.passingScore || 70}%.
                  </p>
                  <div className={styles.assessmentList}>
                    {publicAssessment.questions.map(
                      (question, questionIndex) => (
                        <div
                          key={question.id || questionIndex}
                          className={styles.assessmentCard}
                        >
                          <p className={styles.assessmentPrompt}>
                            {questionIndex + 1}. {question.prompt}
                          </p>
                          <div className={styles.assessmentOptions}>
                            {question.options.map((option, optionIndex) => {
                              const checked =
                                assessmentAnswers[questionIndex] ===
                                optionIndex;
                              return (
                                <label
                                  key={`${question.id || questionIndex}-${optionIndex}`}
                                  className={`${styles.assessmentOption} ${checked ? styles.assessmentOptionChecked : ""}`}
                                >
                                  <input
                                    type="radio"
                                    name={`assessment-${question.id || questionIndex}`}
                                    checked={checked}
                                    onChange={() =>
                                      setAssessmentAnswers((prev) =>
                                        prev.map((answer, index) =>
                                          index === questionIndex
                                            ? optionIndex
                                            : answer,
                                        ),
                                      )
                                    }
                                  />
                                  <span>{option}</span>
                                </label>
                              );
                            })}
                          </div>
                        </div>
                      ),
                    )}
                  </div>
                </section>
              )}
            </div>

            <aside className={styles.sidebarColumn}>
              <div className={styles.sidebarStack}>
                <section
                  className={`${styles.sidebarCard} ${styles.applyCard}`}
                >
                  <span className={styles.sidebarEyebrow}>Candidatura</span>
                  <div className={styles.applySalary}>{salaryRange}</div>
                  <p className={styles.applySalaryMeta}>
                    Resumo salarial apresentado pela vaga
                  </p>

                  <div className={styles.sideInfoList}>
                    <div className={styles.sideInfoRow}>
                      <span>
                        <FiMapPin size={14} /> Localização
                      </span>
                      <strong>{localizacao || "—"}</strong>
                    </div>
                    <div className={styles.sideInfoRow}>
                      <span>
                        <FiBriefcase size={14} /> Contrato
                      </span>
                      <strong>{getContractTypeLabel(tipoContrato)}</strong>
                    </div>
                    <div className={styles.sideInfoRow}>
                      <span>
                        <FiClock size={14} /> Regime
                      </span>
                      <strong>{remoteLabel}</strong>
                    </div>
                    <div className={styles.sideInfoRow}>
                      <span>
                        <FiCalendar size={14} /> Encerra
                      </span>
                      <strong>{formatDate(dataFecho)}</strong>
                    </div>
                  </div>

                  <button
                    className={`${styles.applyButton} ${applyDisabled ? styles.applyButtonDisabled : styles.applyButtonEnabled}`}
                    onClick={handleApply}
                    disabled={applyDisabled}
                  >
                    {isApplying ? (
                      <>
                        <span className={styles.buttonSpinner} />
                        Enviando...
                      </>
                    ) : isApplied ? (
                      <>
                        Candidatado
                        <FiChevronRight size={18} />
                      </>
                    ) : !isOpen ? (
                      "Vaga encerrada"
                    ) : premiumApplyRestriction ? (
                      <>
                        Desbloquear acesso
                        <FiChevronRight size={18} />
                      </>
                    ) : (
                      <>
                        Candidatar-se
                        <FiChevronRight size={18} />
                      </>
                    )}
                  </button>

                  {isBlocked && (
                    <p className={styles.warningText}>
                      O seu perfil atual não pode candidatar a esta vaga.
                    </p>
                  )}
                  {errorMsg && <p className={styles.errorText}>{errorMsg}</p>}
                  {!assessmentComplete && publicAssessment && (
                    <p className={styles.warningText}>
                      Responda o teste de habilidades para liberar a
                      candidatura.
                    </p>
                  )}
                  {missingRequiredCoverLetter && (
                    <p className={styles.warningText}>
                      Adicione a carta de apresentação para concluir o envio.
                    </p>
                  )}
                </section>

                {userType !== "empresa" && candidateJobInsights && (
                  <section className={styles.sidebarCard}>
                    <span className={styles.sidebarEyebrow}>
                      Aderência do perfil
                    </span>
                    <div className={styles.matchHeader}>
                      <div>
                        <h3 className={styles.sidebarTitle}>
                          Análise de compatibilidade
                        </h3>
                        <p className={styles.sidebarMuted}>
                          {candidateJobInsights.matchLabel}
                        </p>
                      </div>
                      <div className={styles.matchScore}>
                        {candidateJobInsights.matchPercent}%
                      </div>
                    </div>

                    {candidateJobInsights.reasons?.length > 0 && (
                      <p className={styles.sidebarText}>
                        {candidateJobInsights.reasons.slice(0, 3).join(" • ")}
                      </p>
                    )}

                    {candidateJobInsights.matchedSkills?.length > 0 && (
                      <div className={styles.sidebarBlock}>
                        <span className={styles.sidebarSubheading}>
                          O que já combina
                        </span>
                        <div className={styles.tagRow}>
                          {candidateJobInsights.matchedSkills
                            .slice(0, 4)
                            .map((skill) => (
                              <span
                                key={skill}
                                className={`${styles.tag} ${styles.tagPositive}`}
                              >
                                {skill}
                              </span>
                            ))}
                        </div>
                      </div>
                    )}

                    {candidateJobInsights.missingSkills?.length > 0 && (
                      <div className={styles.sidebarBlock}>
                        <span className={styles.sidebarSubheading}>
                          Pontos a reforçar
                        </span>
                        <div className={styles.tagRow}>
                          {candidateJobInsights.missingSkills
                            .slice(0, 4)
                            .map((skill) => (
                              <span
                                key={skill}
                                className={`${styles.tag} ${styles.tagWarning}`}
                              >
                                {skill}
                              </span>
                            ))}
                        </div>
                      </div>
                    )}

                    {candidateJobInsights.cvOptimizationTips?.length > 0 && (
                      <div className={styles.sidebarBlock}>
                        <span className={styles.sidebarSubheading}>
                          Dicas para esta candidatura
                        </span>
                        <ul className={styles.miniList}>
                          {candidateJobInsights.cvOptimizationTips
                            .slice(0, 3)
                            .map((tip) => (
                              <li key={tip}>{tip}</li>
                            ))}
                        </ul>
                      </div>
                    )}
                  </section>
                )}

                {(premiumConfig.requireCoverLetter ||
                  candidatePremiumAccess.canUseCoverLetter ||
                  premiumApplyRestriction) &&
                  userType !== "empresa" && (
                    <section className={styles.sidebarCard}>
                      <div className={styles.coverLetterHeader}>
                        <div>
                          <span className={styles.sidebarEyebrow}>
                            Carta de apresentação
                          </span>
                          <h3 className={styles.sidebarTitle}>
                            Preparar envio personalizado
                          </h3>
                        </div>
                        <button
                          type="button"
                          onClick={handleGenerateCoverLetter}
                          disabled={isGeneratingCoverLetter}
                          className={styles.generateButton}
                        >
                          {isGeneratingCoverLetter
                            ? "A gerar..."
                            : "Gerar sugestão"}
                        </button>
                      </div>

                      <p className={styles.sidebarText}>
                        {premiumConfig.requireCoverLetter
                          ? "Esta vaga exige carta personalizada no envio."
                          : "Use uma carta assistida para reforçar o contexto da sua candidatura."}
                      </p>

                      {candidatePremiumAccess.canUseCoverLetter ||
                      premiumConfig.requireCoverLetter ? (
                        <textarea
                          value={coverLetter}
                          onChange={(event) =>
                            setCoverLetter(event.target.value)
                          }
                          placeholder="Escreva ou gere uma carta de apresentação personalizada para esta vaga."
                          rows={7}
                          className={styles.coverLetterInput}
                        />
                      ) : (
                        <div className={styles.lockedBox}>
                          Faça upgrade para desbloquear carta de apresentação
                          personalizada nesta candidatura.
                        </div>
                      )}

                      <div className={styles.coverLetterFooter}>
                        <span className={styles.sidebarMuted}>
                          {normalizedCoverLetter
                            ? `${normalizedCoverLetter.length} caracteres prontos para envio`
                            : "A carta será anexada junto com a candidatura."}
                        </span>
                        {candidatePremiumAccess.priorityApplied && (
                          <span className={styles.priorityPill}>
                            <FiZap size={12} />
                            Candidatura prioritária
                          </span>
                        )}
                      </div>
                    </section>
                  )}

                <section className={styles.sidebarCard}>
                  <span className={styles.sidebarEyebrow}>Empresa</span>
                  <div className={styles.companySidebar}>
                    <div className={styles.companySidebarTop}>
                      <div className={styles.companySidebarMark}>
                        {vaga.companyLogo || vaga.empresaLogo ? (
                          <>
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={vaga.companyLogo || vaga.empresaLogo}
                              alt={companyLabel}
                              className={styles.companySidebarLogo}
                              loading="lazy"
                              decoding="async"
                              width="64"
                              height="64"
                            />
                          </>
                        ) : (
                          <span className={styles.companyInitials}>
                            {companyInitials}
                          </span>
                        )}
                      </div>
                      <div>
                        <h3 className={styles.sidebarTitle}>{companyLabel}</h3>
                        <p className={styles.sidebarMuted}>
                          {vaga.companyLocation ||
                            localizacao ||
                            "São Tomé e Príncipe"}
                        </p>
                      </div>
                    </div>

                    {vaga.companyDescription ? (
                      <p className={styles.sidebarText}>
                        {vaga.companyDescription}
                      </p>
                    ) : (
                      <p className={styles.sidebarText}>
                        Consulte a oportunidade e a informação disponível para
                        conhecer melhor o contexto desta empresa e o perfil
                        procurado.
                      </p>
                    )}

                    {companyInfoItems.length > 0 ? (
                      <div className={styles.companyInfoList}>
                        {companyInfoItems.map(
                          ({ label, value, Icon, href }) => {
                            const content = (
                              <>
                                <span className={styles.companyInfoLabel}>
                                  <Icon size={14} /> {label}
                                </span>
                                <strong>{value}</strong>
                              </>
                            );

                            return href ? (
                              <a
                                key={label}
                                href={href}
                                target={
                                  href.startsWith("http") ? "_blank" : undefined
                                }
                                rel={
                                  href.startsWith("http")
                                    ? "noopener noreferrer"
                                    : undefined
                                }
                                className={styles.companyInfoRow}
                              >
                                {content}
                              </a>
                            ) : (
                              <div
                                key={label}
                                className={styles.companyInfoRow}
                              >
                                {content}
                              </div>
                            );
                          },
                        )}
                      </div>
                    ) : null}
                  </div>
                </section>

                {tdrUrl && (
                  <section className={styles.sidebarCard}>
                    <span className={styles.sidebarEyebrow}>
                      Documento extra
                    </span>
                    <h3 className={styles.sidebarTitle}>TDR disponível</h3>
                    <p className={styles.sidebarText}>
                      A empresa publicou um documento adicional com mais
                      detalhes sobre escopo, requisitos e contexto técnico.
                    </p>
                    <a
                      href={tdrUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={styles.documentButton}
                    >
                      <FiDownload size={14} />
                      Abrir TDR
                    </a>
                  </section>
                )}

                {relatedJobs.length > 0 && (
                  <section className={styles.sidebarCard}>
                    <span className={styles.sidebarEyebrow}>
                      Mais oportunidades
                    </span>
                    <h3 className={styles.sidebarTitle}>Vagas relacionadas</h3>
                    <div className={styles.relatedList}>
                      {relatedJobs.map((job) => (
                        <Link
                          key={job.id}
                          href={`/vaga/${job.id}`}
                          className={styles.relatedItem}
                        >
                          <div className={styles.relatedTop}>
                            <strong className={styles.relatedTitle}>
                              {job.titulo}
                            </strong>
                            {job.destaque ? (
                              <span className={styles.relatedBadge}>
                                Destaque
                              </span>
                            ) : null}
                          </div>
                          <p className={styles.relatedMeta}>
                            {job.empresaNome || job.companyName || "Empresa"} •{" "}
                            {job.localizacao || "Local não informado"}
                          </p>
                          <p className={styles.relatedMeta}>
                            {job.salarioResumo || "A combinar"} •{" "}
                            {formatDate(job.dataFecho)}
                          </p>
                        </Link>
                      ))}
                    </div>
                  </section>
                )}
              </div>
            </aside>
          </div>

          <div className={styles.mobileApplyBar}>
            <div className={styles.mobileApplyMeta}>
              <span className={styles.mobileApplyLabel}>Candidatura</span>
              <strong className={styles.mobileApplyValue}>{salaryRange}</strong>
            </div>
            <button
              className={`${styles.applyButton} ${styles.mobileApplyButton} ${applyDisabled ? styles.applyButtonDisabled : styles.applyButtonEnabled}`}
              onClick={handleApply}
              disabled={applyDisabled}
            >
              {isApplying
                ? "Enviando..."
                : isApplied
                  ? "Candidatado"
                  : !isOpen
                    ? "Vaga encerrada"
                    : premiumApplyRestriction
                      ? "Desbloquear"
                      : "Candidatar-se"}
            </button>
          </div>
        </div>
      </PublicPageShell>
    </>
  );
}

export async function getServerSideProps({ params }) {
  const { id } = params;

  try {
    const { admin } = await import("../../lib/firebaseAdmin");
    const { getEmpresaPlanSummary } =
      await import("../../lib/empresaPlanFeatures");
    const { getEffectiveJobStatus, syncExpiredJobStatus } =
      await import("../../lib/jobExpiration");
    const doc = await admin.firestore().collection("jobs").doc(id).get();

    if (!doc.exists) {
      return { notFound: true };
    }

    const synced = await syncExpiredJobStatus(doc.ref, doc.data(), admin);
    const currentJob = {
      id: doc.id,
      ...synced.jobData,
      status: getEffectiveJobStatus(synced.jobData),
    };

    const relatedSnapshot = await admin
      .firestore()
      .collection("jobs")
      .orderBy("createdAt", "desc")
      .limit(14)
      .get();

    const relatedRaw = await Promise.all(
      relatedSnapshot.docs.map(async (jobDoc) => {
        const syncedJob = await syncExpiredJobStatus(
          jobDoc.ref,
          jobDoc.data(),
          admin,
        );
        return {
          id: jobDoc.id,
          ...syncedJob.jobData,
          status: getEffectiveJobStatus(syncedJob.jobData),
        };
      }),
    );

    const companyIds = [
      ...new Set(
        [
          currentJob.companyId,
          ...relatedRaw.map((job) => job.companyId),
        ].filter(Boolean),
      ),
    ];

    const companyRefs = companyIds.map((companyId) =>
      admin.firestore().collection("users").doc(companyId),
    );
    const companyDocs = companyRefs.length
      ? await admin.firestore().getAll(...companyRefs)
      : [];
    const companiesById = new Map();

    companyDocs.forEach((companyDoc) => {
      if (!companyDoc.exists) return;
      const companyData = companyDoc.data() || {};
      const planSummary = getEmpresaPlanSummary(companyData);
      companiesById.set(companyDoc.id, {
        companyName: companyData.name || companyData.fullName || "Empresa",
        companyLogo: companyData.logoUrl || companyData.logo || "",
        companyDescription: companyData.description || "",
        companyPhone: companyData.phone || "",
        companyWebsite: companyData.website || "",
        companyEmail: companyData.email || "",
        companyLocation:
          companyData.location || companyData.address?.district || "",
        companyVerified: Boolean(planSummary.features?.companyVerified),
      });
    });

    const companyInfo = companiesById.get(currentJob.companyId) || {};
    const jobData = {
      ...currentJob,
      ...companyInfo,
      empresaNome:
        companyInfo.companyName ||
        currentJob.empresaNome ||
        currentJob.companyName ||
        "Empresa",
      companyName:
        companyInfo.companyName ||
        currentJob.companyName ||
        currentJob.empresaNome ||
        "Empresa",
      skillsAssessment: getPublicSkillsAssessment(currentJob.skillsAssessment),
    };

    const relatedJobs = relatedRaw
      .filter((job) => job.id !== id && job.status === "active")
      .map((job) => {
        const company = companiesById.get(job.companyId) || {};
        let score = 0;
        if (
          job.categoria &&
          currentJob.categoria &&
          String(job.categoria).toLowerCase() ===
            String(currentJob.categoria).toLowerCase()
        )
          score += 4;
        if (
          job.localizacao &&
          currentJob.localizacao &&
          String(job.localizacao).toLowerCase() ===
            String(currentJob.localizacao).toLowerCase()
        )
          score += 2;
        if (
          job.tipoContrato &&
          currentJob.tipoContrato &&
          String(job.tipoContrato).toLowerCase() ===
            String(currentJob.tipoContrato).toLowerCase()
        )
          score += 1;
        if (job.remoto && currentJob.remoto) score += 1;

        const serialized = serializeJob({
          ...job,
          empresaNome:
            company.companyName ||
            job.empresaNome ||
            job.companyName ||
            "Empresa",
          companyName:
            company.companyName ||
            job.companyName ||
            job.empresaNome ||
            "Empresa",
          companyLogo: company.companyLogo || job.companyLogo || "",
          companyVerified: company.companyVerified || false,
          salarioResumo:
            job.salarioDe && job.salarioAte
              ? `${formatCurrency(job.salarioDe)} - ${formatCurrency(job.salarioAte)}`
              : job.salarioDe
                ? formatCurrency(job.salarioDe)
                : job.salarioAte
                  ? formatCurrency(job.salarioAte)
                  : "A combinar",
          _score: score,
        });
        return serialized;
      })
      .sort((a, b) => {
        if (b._score !== a._score) return b._score - a._score;
        return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
      })
      .slice(0, 4)
      .map(({ _score, ...job }) => job);

    return {
      props: {
        vaga: serializeJob(jobData),
        relatedJobs,
      },
    };
  } catch (error) {
    console.error("Erro ao buscar vaga:", error);
    return {
      props: { vaga: null, relatedJobs: [] },
    };
  }
}
