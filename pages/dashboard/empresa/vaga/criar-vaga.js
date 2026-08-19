import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";
import Head from "next/head";
import Link from "next/link";
import { onAuthStateChanged } from "firebase/auth";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { EARLY_ACCESS_HOUR_OPTIONS } from "../../../../lib/candidateApplicationPremium";
import { auth, storage } from "../../../../lib/firebase";
import { getFirebaseStorageErrorMessage } from "../../../../lib/firebaseStorageError";
import { normalizeSkillsAssessmentInput } from "../../../../lib/skillsAssessment";
import { FiArrowLeft } from "react-icons/fi";
import { useAuth } from "../../../../context/AuthContext";
import DashboardShell from "../../../../components/dashboard/DashboardShell";
import AutoSaveStatus from "../../../../components/forms/AutoSaveStatus";
import useAutoDraft from "../../../../hooks/useAutoDraft";
import { createFormDraftKey } from "../../../../lib/formDraft";
import styles from "../../../../styles/EmpresaJobForm.module.css";

const EMPLOYMENT_TYPES = [
  "Tempo Integral",
  "Meio Período",
  "Contrato",
  "Estágio",
  "Freelance",
  "Voluntariado",
];

const EXPERIENCE_LEVELS = [
  "Júnior (0-2 anos)",
  "Pleno (2-5 anos)",
  "Sénior (5+ anos)",
  "Especialista",
  "Gestão",
];

const EDUCATION_LEVELS = [
  "Ensino Básico",
  "Ensino Secundário",
  "Licenciatura",
  "Mestrado",
  "Doutoramento",
  "Não exigido",
];

const JOB_CATEGORIES = [
  "Marketing Digital",
  "Programação",
  "Design",
  "Gestão e Administração",
  "Vendas",
  "Educação",
  "Saúde",
  "Engenharia",
  "Finanças",
  "Recursos Humanos",
  "Jurídico",
  "Atendimento",
];

const INITIAL_JOB_DATA = {
  titulo: "",
  descricao: "",
  requisitos: "",
  responsabilidades: "",
  localizacao: "",
  tipoContrato: "",
  nivelExperiencia: "",
  escolaridade: "",
  salarioDe: "",
  salarioAte: "",
  beneficios: "",
  dataAbertura: new Date().toISOString().split("T")[0],
  dataFecho: "",
  remoto: false,
  destaque: false,
  tdrUrl: "",
  tdrFileName: "",
  vagasDisponiveis: 1,
  palavrasChave: "",
  categoria: "",
  premiumOnly: false,
  earlyAccessHours: "0",
  requireCoverLetter: false,
  skillsAssessment: {
    enabled: false,
    passingScore: 70,
    questions: [],
  },
};

function normalizeDateInput(value) {
  if (!value) return "";
  const raw = `${value}`;
  if (raw.includes("T")) return raw.split("T")[0];
  return raw;
}

function hydrateJobForm(job) {
  return {
    ...INITIAL_JOB_DATA,
    titulo: job?.titulo || "",
    descricao: job?.descricao || "",
    requisitos: job?.requisitos || "",
    responsabilidades: job?.responsabilidades || "",
    localizacao: job?.localizacao || "",
    tipoContrato: job?.tipoContrato || "",
    nivelExperiencia: job?.nivelExperiencia || "",
    escolaridade: job?.escolaridade || "",
    salarioDe: job?.salarioDe || "",
    salarioAte: job?.salarioAte || "",
    beneficios: job?.beneficios || "",
    dataAbertura: normalizeDateInput(job?.dataAbertura),
    dataFecho: normalizeDateInput(job?.dataFecho),
    remoto: Boolean(job?.remoto),
    destaque: Boolean(job?.destaque),
    tdrUrl: job?.tdrUrl || "",
    tdrFileName: job?.tdrFileName || "",
    vagasDisponiveis: job?.vagasDisponiveis || 1,
    palavrasChave: Array.isArray(job?.palavrasChave)
      ? job.palavrasChave.join(", ")
      : job?.palavrasChave || "",
    categoria: job?.categoria || "",
    premiumOnly: Boolean(job?.premiumOnly),
    earlyAccessHours: String(job?.earlyAccessHours || 0),
    requireCoverLetter: Boolean(job?.requireCoverLetter),
    skillsAssessment: {
      enabled: Boolean(job?.skillsAssessment?.enabled),
      passingScore: job?.skillsAssessment?.passingScore || 70,
      questions: Array.isArray(job?.skillsAssessment?.questions)
        ? job.skillsAssessment.questions.map((question, index) => ({
            id: question.id || `q-${index + 1}`,
            prompt: question.prompt || "",
            options:
              Array.isArray(question.options) && question.options.length >= 2
                ? question.options
                : ["", ""],
            correctOptionIndex:
              typeof question.correctOptionIndex === "number"
                ? question.correctOptionIndex
                : 0,
          }))
        : [],
    },
  };
}

export default function CriarVaga() {
  const router = useRouter();
  const { user: authUser, loading: authContextLoading } = useAuth();
  const editJobId = useMemo(() => {
    if (!router.isReady) return "";
    const value = router.query.edit;
    return Array.isArray(value) ? value[0] || "" : value || "";
  }, [router.isReady, router.query.edit]);
  const isEditMode = Boolean(editJobId);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingExisting, setIsLoadingExisting] = useState(false);
  const [uploadingTDR, setUploadingTDR] = useState(false);
  const [error, setError] = useState("");
  const [errorAction, setErrorAction] = useState(null);
  const [success, setSuccess] = useState("");
  const [currentStep, setCurrentStep] = useState(1);
  const [jobData, setJobData] = useState(INITIAL_JOB_DATA);
  const [existingJobLoad, setExistingJobLoad] = useState({
    resourceId: "",
    settled: false,
    updatedAt: "",
  });

  useEffect(() => {
    if (!router.isReady || !editJobId) return;

    let isActive = true;
    let loadedJobUpdatedAt = "";

    setExistingJobLoad({
      resourceId: editJobId,
      settled: false,
      updatedAt: "",
    });

    const getCurrentUser = async () => {
      if (auth.currentUser) return auth.currentUser;

      return new Promise((resolve) => {
        const unsubscribe = onAuthStateChanged(auth, (user) => {
          unsubscribe();
          resolve(user);
        });
      });
    };

    const loadExistingJob = async () => {
      try {
        setIsLoadingExisting(true);
        setError("");
        setErrorAction(null);

        const user = await getCurrentUser();
        if (!user) {
          if (!isActive) return;
          setError("Faça login novamente para editar esta vaga.");
          return;
        }

        const response = await fetch(`/api/jobs/${editJobId}`, {
          headers: {
            Authorization: `Bearer ${await user.getIdToken()}`,
          },
        });

        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(data.error || "Não foi possível carregar a vaga.");
        }

        if (!isActive) return;
        setJobData(hydrateJobForm(data.job));
        loadedJobUpdatedAt = data.job?.updatedAt || "";
      } catch (fetchError) {
        console.error("Erro ao carregar vaga para edição:", fetchError);
        if (!isActive) return;
        setError(
          fetchError.message || "Não foi possível carregar a vaga para edição.",
        );
      } finally {
        if (isActive) {
          setIsLoadingExisting(false);
          setExistingJobLoad({
            resourceId: editJobId,
            settled: true,
            updatedAt: loadedJobUpdatedAt,
          });
        }
      }
    };

    loadExistingJob();

    return () => {
      isActive = false;
    };
  }, [editJobId, router.isReady]);

  const draftOwnerId = authUser?.uid || "";
  const jobDraftResourceId = editJobId || "new";
  const jobDraftKey = useMemo(
    () =>
      createFormDraftKey({
        scope: "company-job",
        ownerId: draftOwnerId,
        resourceId: jobDraftResourceId,
      }),
    [draftOwnerId, jobDraftResourceId],
  );
  const jobDraftValue = useMemo(
    () => ({ jobData, currentStep }),
    [currentStep, jobData],
  );
  const existingJobSettled =
    !isEditMode ||
    (existingJobLoad.resourceId === editJobId && existingJobLoad.settled);
  const jobDraftReady =
    router.isReady &&
    !authContextLoading &&
    Boolean(draftOwnerId) &&
    existingJobSettled;

  const getDraftToken = useCallback(async () => {
    if (!authUser) return "";
    return authUser.getIdToken();
  }, [authUser]);

  const restoreJobDraft = useCallback((draft) => {
    if (!draft || typeof draft !== "object") return;

    if (draft.jobData && typeof draft.jobData === "object") {
      setJobData((current) => {
        const restoredAssessment = draft.jobData.skillsAssessment;

        return {
          ...current,
          ...draft.jobData,
          skillsAssessment:
            restoredAssessment && typeof restoredAssessment === "object"
              ? {
                  ...current.skillsAssessment,
                  ...restoredAssessment,
                  questions: Array.isArray(restoredAssessment.questions)
                    ? restoredAssessment.questions
                    : current.skillsAssessment.questions,
                }
              : current.skillsAssessment,
        };
      });
    }

    const restoredStep = Number(draft.currentStep);
    if (Number.isFinite(restoredStep)) {
      setCurrentStep(Math.max(1, Math.min(4, Math.trunc(restoredStep))));
    }
  }, []);

  const {
    status: jobDraftStatus,
    lastSavedAt: jobDraftSavedAt,
    isOnline: jobDraftIsOnline,
    clearDraft: clearJobDraft,
  } = useAutoDraft({
    storageKey: jobDraftKey,
    scope: "company-job",
    resourceId: jobDraftResourceId,
    value: jobDraftValue,
    onRestore: restoreJobDraft,
    getToken: getDraftToken,
    enabled: Boolean(draftOwnerId),
    ready: jobDraftReady,
    baseUpdatedAt: isEditMode ? existingJobLoad.updatedAt : "",
  });

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setJobData((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  const handleTDRUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (!file.type.includes("pdf") && !file.type.includes("document")) {
      setError("Por favor, envie apenas ficheiros PDF ou Word");
      setErrorAction(null);
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      setError("O ficheiro TDR deve ter no máximo 10MB");
      setErrorAction(null);
      return;
    }

    setUploadingTDR(true);
    setError("");
    setErrorAction(null);

    try {
      const user = auth.currentUser;
      if (!user) {
        setError("Você precisa estar logado");
        setErrorAction(null);
        setUploadingTDR(false);
        return;
      }

      const fileName = `${Date.now()}_${file.name.replace(/[^a-zA-Z0-9.]/g, "_")}`;
      const storagePath = `job-tdr/${user.uid}/${fileName}`;
      const storageRef = ref(storage, storagePath);

      await uploadBytes(storageRef, file);
      const url = await getDownloadURL(storageRef);

      setJobData((prev) => ({
        ...prev,
        tdrUrl: url,
        tdrFileName: file.name,
      }));
      setSuccess("TDR enviado com sucesso!");
      setTimeout(() => setSuccess(""), 3000);
    } catch (err) {
      console.error("Erro ao enviar TDR:", err);
      setError(getFirebaseStorageErrorMessage(err, "Erro ao enviar o ficheiro TDR"));
      setErrorAction(null);
    } finally {
      setUploadingTDR(false);
    }
  };

  const removeTDR = () => {
    setJobData((prev) => ({ ...prev, tdrUrl: "", tdrFileName: "" }));
  };

  const handleAssessmentToggle = () => {
    setJobData((prev) => ({
      ...prev,
      skillsAssessment: {
        ...prev.skillsAssessment,
        enabled: !prev.skillsAssessment.enabled,
      },
    }));
  };

  const handleAssessmentPassingScoreChange = (value) => {
    setJobData((prev) => ({
      ...prev,
      skillsAssessment: {
        ...prev.skillsAssessment,
        passingScore: value,
      },
    }));
  };

  const handleAddAssessmentQuestion = () => {
    setJobData((prev) => ({
      ...prev,
      skillsAssessment: {
        ...prev.skillsAssessment,
        enabled: true,
        questions: [
          ...prev.skillsAssessment.questions,
          {
            id: `q${Date.now()}`,
            prompt: "",
            options: ["", ""],
            correctOptionIndex: 0,
          },
        ],
      },
    }));
  };

  const handleRemoveAssessmentQuestion = (questionIndex) => {
    setJobData((prev) => ({
      ...prev,
      skillsAssessment: {
        ...prev.skillsAssessment,
        questions: prev.skillsAssessment.questions.filter(
          (_, index) => index !== questionIndex,
        ),
      },
    }));
  };

  const handleAssessmentQuestionChange = (questionIndex, field, value) => {
    setJobData((prev) => ({
      ...prev,
      skillsAssessment: {
        ...prev.skillsAssessment,
        questions: prev.skillsAssessment.questions.map((question, index) =>
          index === questionIndex ? { ...question, [field]: value } : question,
        ),
      },
    }));
  };

  const handleAssessmentOptionChange = (questionIndex, optionIndex, value) => {
    setJobData((prev) => ({
      ...prev,
      skillsAssessment: {
        ...prev.skillsAssessment,
        questions: prev.skillsAssessment.questions.map((question, index) => {
          if (index !== questionIndex) return question;
          const options = [...question.options];
          options[optionIndex] = value;
          return { ...question, options };
        }),
      },
    }));
  };

  const handleAddAssessmentOption = (questionIndex) => {
    setJobData((prev) => ({
      ...prev,
      skillsAssessment: {
        ...prev.skillsAssessment,
        questions: prev.skillsAssessment.questions.map((question, index) =>
          index === questionIndex
            ? { ...question, options: [...question.options, ""] }
            : question,
        ),
      },
    }));
  };

  const handleRemoveAssessmentOption = (questionIndex, optionIndex) => {
    setJobData((prev) => ({
      ...prev,
      skillsAssessment: {
        ...prev.skillsAssessment,
        questions: prev.skillsAssessment.questions.map((question, index) => {
          if (index !== questionIndex || question.options.length <= 2)
            return question;
          const options = question.options.filter(
            (_, currentIndex) => currentIndex !== optionIndex,
          );
          const nextCorrectIndex =
            question.correctOptionIndex >= options.length
              ? options.length - 1
              : question.correctOptionIndex;
          return {
            ...question,
            options,
            correctOptionIndex: nextCorrectIndex,
          };
        }),
      },
    }));
  };

  const nextStep = () => {
    if (
      currentStep === 1 &&
      (!jobData.titulo || !jobData.descricao || !jobData.categoria)
    ) {
      setError(
        "Preencha o título, a descrição e selecione uma categoria para continuar",
      );
      setErrorAction(null);
      return;
    }
    if (currentStep === 2 && (!jobData.localizacao || !jobData.tipoContrato)) {
      setError("Preencha a localização e o tipo de contrato");
      setErrorAction(null);
      return;
    }
    if (currentStep === 3 && jobData.skillsAssessment.enabled) {
      const normalizedAssessment = normalizeSkillsAssessmentInput(
        jobData.skillsAssessment,
      );
      if (!normalizedAssessment.questions.length) {
        setError(
          "Adicione pelo menos uma pergunta válida ao teste de habilidades ou desative o teste.",
        );
        setErrorAction(null);
        return;
      }
      if (
        normalizedAssessment.questions.length !==
        jobData.skillsAssessment.questions.length
      ) {
        setError(
          "Revise o teste de habilidades. Todas as perguntas precisam de enunciado, pelo menos 2 opções e uma resposta correta.",
        );
        setErrorAction(null);
        return;
      }
    }
    setError("");
    setErrorAction(null);
    setCurrentStep((prev) => Math.min(prev + 1, 4));
  };

  const prevStep = () => {
    setError("");
    setErrorAction(null);
    setCurrentStep((prev) => Math.max(prev - 1, 1));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (
      !jobData.titulo ||
      !jobData.descricao ||
      !jobData.localizacao ||
      !jobData.tipoContrato ||
      !jobData.dataFecho
    ) {
      setError("Por favor, preencha todos os campos obrigatórios");
      setErrorAction(null);
      return;
    }

    setIsLoading(true);
    setError("");
    setErrorAction(null);
    setSuccess("");

    try {
      const user = auth.currentUser;
      if (!user) {
        setError("Você precisa estar logado");
        setErrorAction(null);
        setIsLoading(false);
        return;
      }

      const vagaData = {
        ...jobData,
        palavrasChave: jobData.palavrasChave
          .split(",")
          .map((k) => k.trim())
          .filter(Boolean),
        vagasDisponiveis: parseInt(jobData.vagasDisponiveis, 10) || 1,
        earlyAccessHours: parseInt(jobData.earlyAccessHours, 10) || 0,
        skillsAssessment: normalizeSkillsAssessmentInput(
          jobData.skillsAssessment,
        ),
      };

      const endpoint = isEditMode ? `/api/jobs/${editJobId}` : "/api/jobs";
      const method = isEditMode ? "PUT" : "POST";

      const createResponse = await fetch(endpoint, {
        method,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${await user.getIdToken()}`,
        },
        body: JSON.stringify(vagaData),
      });

      const createData = await createResponse.json().catch(() => ({}));
      if (!createResponse.ok) {
        const businessMessage =
          createData.reason ||
          createData.error ||
          createData.message ||
          "Não foi possível criar a vaga neste momento.";

        setError(businessMessage);
        setErrorAction(
          createData.upgradeUrl
            ? {
                label: createData.upgradeMessage || "Ver planos disponíveis",
                href: createData.upgradeUrl,
              }
            : null,
        );
        return;
      }

      await clearJobDraft();

      // Uma vaga que ficou à espera de moderação ainda não é pública: notificar
      // candidatos nessa altura divulgava algo que ninguém pode abrir. O
      // servidor já recusa (409), mas evitamos o pedido inútil.
      const jobIsPublished =
        String(createData.job?.status || "active") === "active";

      if (!isEditMode && jobIsPublished) {
        try {
          // Título e localização vêm do registo guardado, no servidor: enviá-los
          // daqui não teria efeito e mascararia a origem do conteúdo.
          await fetch("/api/notify-candidates", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${await user.getIdToken()}`,
            },
            body: JSON.stringify({ jobId: createData.job?.id }),
          });
        } catch (notifError) {
          console.error(
            "Aviso: Erro ao enviar notificações (não crítico):",
            notifError,
          );
        }
      }

      setSuccess(
        createData.warning
          ? `${
              isEditMode
                ? "Vaga atualizada com sucesso!"
                : "Vaga criada com sucesso!"
            } ${createData.warning}`
          : isEditMode
            ? "Vaga atualizada com sucesso!"
            : "Vaga criada com sucesso!",
      );

      setTimeout(() => {
        router.push(
          isEditMode
            ? `/dashboard/empresa/vaga/${editJobId}`
            : "/dashboard/empresa",
        );
      }, 2000);
    } catch (error) {
      console.error("Erro ao criar vaga:", error);
      setError("Não foi possível criar a vaga. Tente novamente em instantes.");
      setErrorAction(null);
    } finally {
      setIsLoading(false);
    }
  };

  const steps = [
    { num: 1, label: "Informações" },
    { num: 2, label: "Detalhes" },
    { num: 3, label: "Documentos" },
    { num: 4, label: "Revisão" },
  ];

  return (
    <>
      <Head>
        <title>{isEditMode ? "Editar Vaga" : "Criar Vaga"} - EmpregoSTP</title>
        <style>{`
          body {
            background: #f7fbff;
            min-height: 100vh;
          }
        `}</style>
      </Head>

      <DashboardShell
        role="empresa"
        active="jobs"
        title={isEditMode ? "Editar vaga" : "Publicar vaga"}
        subtitle="Gestão de publicações"
        profile={{ name: "Empresa", role: "Empresa" }}
      >
        <div className={`dash-page ${styles.page}`}>
          {/* Header */}
          <header className={styles.pageHeader}>
            <Link href="/dashboard/empresa?tab=jobs" className="dash-back">
              <FiArrowLeft /> Voltar às vagas
            </Link>
            <span className={styles.eyebrow}>Operação de recrutamento</span>
            <h1 className={styles.pageTitle}>
              {isEditMode ? "Editar vaga" : "Criar nova vaga"}
            </h1>
            <p className={styles.pageDescription}>
              {isEditMode
                ? "Atualize a publicação sem perder o histórico de candidaturas."
                : "Estruture a oportunidade em quatro etapas e reveja tudo antes de publicar."}
            </p>
            <AutoSaveStatus
              status={jobDraftStatus}
              lastSavedAt={jobDraftSavedAt}
              isOnline={jobDraftIsOnline}
            />
          </header>

        {/* Step Indicator */}
        <ol className={styles.stepper} aria-label="Progresso da publicação">
          {steps.map((step, i) => (
            <li
              key={step.num}
              className={`${styles.step} ${currentStep >= step.num ? styles.stepActive : ""} ${currentStep > step.num ? styles.stepComplete : ""}`}
              aria-current={currentStep === step.num ? "step" : undefined}
            >
              <div className={styles.stepContent}>
                <span className={styles.stepNumber} aria-hidden="true">
                  {currentStep > step.num ? "✓" : step.num}
                </span>
                <span className={styles.stepLabel}>{step.label}</span>
              </div>
              {i < steps.length - 1 ? <span className={styles.stepLine} aria-hidden="true" /> : null}
            </li>
          ))}
        </ol>

        {/* Mensagens */}
        {success && (
          <div className={`${styles.feedback} ${styles.feedbackSuccess}`} role="status" aria-live="polite">
            {success}
          </div>
        )}

        {error && (
          <div className={`${styles.feedback} ${styles.feedbackError}`} role="alert">
            <div className={styles.feedbackBody}>
              <span>{error}</span>
              {errorAction?.href && (
                <div>
                  <Link
                    href={errorAction.href}
                    className={styles.feedbackAction}
                  >
                    {errorAction.label}
                  </Link>
                </div>
              )}
            </div>
          </div>
        )}

        {isLoadingExisting && (
          <div className={`${styles.feedback} ${styles.feedbackInfo}`} role="status" aria-live="polite">
            A carregar os dados da vaga...
          </div>
        )}

        {/* Formulário */}
        <form onSubmit={handleSubmit} className={styles.form}>
          {/* Step 1: Informações Básicas */}
          {currentStep === 1 && (
            <FormSection title="Informações Básicas">
              <div className={styles.gridTwo}>
                <InputField
                  label="Título da Vaga *"
                  name="titulo"
                  value={jobData.titulo}
                  onChange={handleChange}
                  placeholder="Ex: Desenvolvedor Full Stack"
                />

                <SelectField
                  label="Categoria *"
                  name="categoria"
                  value={jobData.categoria}
                  onChange={handleChange}
                  options={[
                    { value: "", label: "Selecione..." },
                    ...JOB_CATEGORIES.map((cat) => ({
                      value: cat,
                      label: cat,
                    })),
                  ]}
                />
              </div>

              <TextAreaField
                label="Descrição da Vaga *"
                name="descricao"
                value={jobData.descricao}
                onChange={handleChange}
                placeholder="Descreva as responsabilidades e o que a pessoa fará no dia a dia..."
                rows={5}
              />

              <TextAreaField
                label="Responsabilidades"
                name="responsabilidades"
                value={jobData.responsabilidades}
                onChange={handleChange}
                placeholder="Liste as principais responsabilidades do cargo..."
                rows={4}
              />

              <TextAreaField
                label="Requisitos"
                name="requisitos"
                value={jobData.requisitos}
                onChange={handleChange}
                placeholder="Liste os requisitos separados por vírgula: JavaScript, React, Node.js, etc."
                rows={3}
              />
            </FormSection>
          )}

          {/* Step 2: Detalhes */}
          {currentStep === 2 && (
            <FormSection title="Detalhes da Vaga">
              <div className={styles.gridFour}>
                <InputField
                  label="Localização *"
                  name="localizacao"
                  value={jobData.localizacao}
                  onChange={handleChange}
                  placeholder="Cidade, Distrito"
                />

                <SelectField
                  label="Tipo de Contrato *"
                  name="tipoContrato"
                  value={jobData.tipoContrato}
                  onChange={handleChange}
                  options={[
                    { value: "", label: "Selecione..." },
                    ...EMPLOYMENT_TYPES.map((type) => ({
                      value: type,
                      label: type,
                    })),
                  ]}
                />

                <SelectField
                  label="Nível de Experiência"
                  name="nivelExperiencia"
                  value={jobData.nivelExperiencia}
                  onChange={handleChange}
                  options={[
                    { value: "", label: "Selecione..." },
                    ...EXPERIENCE_LEVELS.map((level) => ({
                      value: level,
                      label: level,
                    })),
                  ]}
                />

                <SelectField
                  label="Escolaridade Mínima"
                  name="escolaridade"
                  value={jobData.escolaridade}
                  onChange={handleChange}
                  options={[
                    { value: "", label: "Selecione..." },
                    ...EDUCATION_LEVELS.map((level) => ({
                      value: level,
                      label: level,
                    })),
                  ]}
                />
              </div>

              <div className={styles.gridThree}>
                <InputField
                  label="Salário Mínimo (Db)"
                  name="salarioDe"
                  type="number"
                  value={jobData.salarioDe}
                  onChange={handleChange}
                  placeholder="Ex: 5000"
                />

                <InputField
                  label="Salário Máximo (Db)"
                  name="salarioAte"
                  type="number"
                  value={jobData.salarioAte}
                  onChange={handleChange}
                  placeholder="Ex: 8000"
                />

                <InputField
                  label="Vagas Disponíveis"
                  name="vagasDisponiveis"
                  type="number"
                  value={jobData.vagasDisponiveis}
                  onChange={handleChange}
                  placeholder="1"
                />
              </div>

              <div className={styles.toggleGrid}>
                <label className={styles.toggleCard}>
                  <input
                    type="checkbox"
                    name="remoto"
                    checked={jobData.remoto}
                    onChange={handleChange}
                    className={styles.checkbox}
                  />
                  <span>Trabalho remoto</span>
                </label>

                <label className={styles.toggleCard}>
                  <input
                    type="checkbox"
                    name="destaque"
                    checked={jobData.destaque}
                    onChange={handleChange}
                    className={styles.checkbox}
                  />
                  <span>Vaga em destaque</span>
                </label>
              </div>

              <TextAreaField
                label="Benefícios"
                name="beneficios"
                value={jobData.beneficios}
                onChange={handleChange}
                placeholder="Vale alimentação, Plano de saúde, Bônus anual, etc."
                rows={3}
              />
            </FormSection>
          )}

          {/* Step 3: Documentos e Datas */}
          {currentStep === 3 && (
            <FormSection title="Documentos e Período">
              {/* TDR Upload */}
              <div className={styles.uploadBlock}>
                <span className={styles.fieldLabel}>
                  Termos de Referência (TDR)
                </span>
                <p className={styles.fieldHint}>
                  Envie um documento PDF ou Word com os termos de referência
                  detalhados da vaga (opcional)
                </p>

                {jobData.tdrUrl ? (
                  <div className={styles.uploadedFile}>
                    <div className={styles.fileIdentity}>
                      <svg
                        width="24"
                        height="24"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="#1e2b4d"
                        strokeWidth="2"
                      >
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                        <polyline points="14 2 14 8 20 8" />
                      </svg>
                      <div>
                        <p className={styles.fileName}>
                          {jobData.tdrFileName}
                        </p>
                        <a
                          href={jobData.tdrUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={styles.fileLink}
                        >
                          Ver documento
                        </a>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={removeTDR}
                      className={styles.removeButton}
                    >
                      Remover
                    </button>
                  </div>
                ) : (
                  <label className={`${styles.dropzone} ${uploadingTDR ? styles.dropzoneDisabled : ""}`}>
                    <svg
                      width="40"
                      height="40"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="#2057d7"
                      strokeWidth="2"
                      className={styles.dropzoneIcon}
                    >
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                      <polyline points="17 8 12 3 7 8" />
                      <line x1="12" y1="3" x2="12" y2="15" />
                    </svg>
                    <span className={styles.dropzoneTitle}>
                      {uploadingTDR ? "A enviar..." : "Clique para enviar TDR"}
                    </span>
                    <span className={styles.dropzoneHint}>
                      PDF ou Word (máx. 10MB)
                    </span>
                    <input
                      type="file"
                      accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                      onChange={handleTDRUpload}
                      className={styles.hiddenInput}
                      disabled={uploadingTDR}
                    />
                  </label>
                )}
              </div>

              <div className={styles.gridTwo}>
                <InputField
                  label="Data de Abertura *"
                  name="dataAbertura"
                  type="date"
                  value={jobData.dataAbertura}
                  onChange={handleChange}
                  min={
                    isEditMode
                      ? undefined
                      : new Date().toISOString().split("T")[0]
                  }
                />

                <InputField
                  label="Data de Encerramento *"
                  name="dataFecho"
                  type="date"
                  value={jobData.dataFecho}
                  onChange={handleChange}
                  min={
                    jobData.dataAbertura ||
                    new Date().toISOString().split("T")[0]
                  }
                />
              </div>

              <InputField
                label="Palavras-chave"
                name="palavrasChave"
                value={jobData.palavrasChave}
                onChange={handleChange}
                placeholder="Separe por vírgula: marketing, vendas, gestão..."
              />

              <div className={styles.advancedPanel}>
                <div className={styles.advancedHeader}>
                  <h3 className={styles.advancedTitle}>
                    Acesso premium da candidatura
                  </h3>
                  <p className={styles.advancedDescription}>
                    Configure vagas premium, acesso antecipado e carta de
                    apresentação sem afetar vagas antigas.
                  </p>
                </div>

                <div className={styles.optionStack}>
                  <label className={styles.optionCard}>
                    <div>
                      <strong className={styles.optionTitle}>
                        Vaga premium
                      </strong>
                      <span className={styles.optionDescription}>
                        Apenas candidatos Profissional e Premium podem
                        candidatar-se.
                      </span>
                    </div>
                    <input
                      type="checkbox"
                      name="premiumOnly"
                      checked={jobData.premiumOnly}
                      onChange={handleChange}
                      className={styles.checkbox}
                    />
                  </label>

                  <div className={`${styles.optionCard} ${styles.optionCardStack}`}>
                    <div>
                      <strong className={styles.optionTitle}>
                        Acesso antecipado
                      </strong>
                      <span className={styles.optionDescription}>
                        Durante o período escolhido, a candidatura fica aberta
                        primeiro para candidatos Profissional e Premium.
                      </span>
                    </div>
                    <SelectField
                      label="Janela de acesso antecipado"
                      name="earlyAccessHours"
                      value={jobData.earlyAccessHours}
                      onChange={handleChange}
                      options={[
                        { value: "0", label: "Sem acesso antecipado" },
                        ...EARLY_ACCESS_HOUR_OPTIONS.filter(
                          (hours) => hours > 0,
                        ).map((hours) => ({
                          value: String(hours),
                          label: `${hours} hora${hours > 1 ? "s" : ""}`,
                        })),
                      ]}
                    />
                  </div>

                  <label className={styles.optionCard}>
                    <div>
                      <strong className={styles.optionTitle}>
                        Carta de apresentação obrigatória
                      </strong>
                      <span className={styles.optionDescription}>
                        Exige uma carta personalizada no envio da candidatura.
                      </span>
                    </div>
                    <input
                      type="checkbox"
                      name="requireCoverLetter"
                      checked={jobData.requireCoverLetter}
                      onChange={handleChange}
                      className={styles.checkbox}
                    />
                  </label>
                </div>

                <div className={styles.assessmentHeader}>
                  <div>
                    <h3 className={styles.advancedTitle}>
                      Teste de habilidades
                    </h3>
                    <p className={styles.advancedDescription}>
                      Adicione perguntas rápidas para filtrar melhor os
                      candidatos antes da entrevista.
                    </p>
                  </div>
                  <label className={styles.assessmentToggle}>
                    <input
                      type="checkbox"
                      checked={jobData.skillsAssessment.enabled}
                      onChange={handleAssessmentToggle}
                      className={styles.checkbox}
                    />
                    Ativar teste
                  </label>
                </div>

                {jobData.skillsAssessment.enabled && (
                  <div className={styles.assessmentBody}>
                    <InputField
                      label="Nota mínima para aprovação (%)"
                      name="assessmentPassingScore"
                      type="number"
                      value={jobData.skillsAssessment.passingScore}
                      onChange={(event) =>
                        handleAssessmentPassingScoreChange(event.target.value)
                      }
                      min={0}
                    />

                    <div className={styles.assessmentToolbar}>
                      <span className={styles.assessmentCount}>
                        {jobData.skillsAssessment.questions.length} pergunta(s)
                      </span>
                      <button
                        type="button"
                        onClick={handleAddAssessmentQuestion}
                        className={styles.secondaryButton}
                      >
                        Adicionar pergunta
                      </button>
                    </div>

                    {jobData.skillsAssessment.questions.map(
                      (question, questionIndex) => (
                        <div key={question.id} className={styles.questionCard}>
                          <div className={styles.questionHeader}>
                            <strong className={styles.questionTitle}>
                              Pergunta {questionIndex + 1}
                            </strong>
                            <button
                              type="button"
                              onClick={() =>
                                handleRemoveAssessmentQuestion(questionIndex)
                              }
                              className={styles.removeButton}
                            >
                              Remover
                            </button>
                          </div>

                          <TextAreaField
                            label="Enunciado"
                            name={`assessmentPrompt-${questionIndex}`}
                            value={question.prompt}
                            onChange={(event) =>
                              handleAssessmentQuestionChange(
                                questionIndex,
                                "prompt",
                                event.target.value,
                              )
                            }
                            rows={2}
                            placeholder="Ex.: Qual prática reduz regressões em produção?"
                          />

                          <div className={styles.optionsList}>
                            {question.options.map((option, optionIndex) => (
                              <div key={`${question.id}-${optionIndex}`} className={styles.optionRow}>
                                <input
                                  type="radio"
                                  name={`correct-option-${question.id}`}
                                  checked={
                                    Number(question.correctOptionIndex) ===
                                    optionIndex
                                  }
                                  onChange={() =>
                                    handleAssessmentQuestionChange(
                                      questionIndex,
                                      "correctOptionIndex",
                                      optionIndex,
                                    )
                                  }
                                  className={styles.radio}
                                />
                                <input
                                  type="text"
                                  value={option}
                                  onChange={(event) =>
                                    handleAssessmentOptionChange(
                                      questionIndex,
                                      optionIndex,
                                      event.target.value,
                                    )
                                  }
                                  placeholder={`Opção ${optionIndex + 1}`}
                                  className={styles.optionInput}
                                />
                                {question.options.length > 2 && (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      handleRemoveAssessmentOption(
                                        questionIndex,
                                        optionIndex,
                                      )
                                    }
                                    className={styles.iconRemoveButton}
                                    aria-label={`Remover opção ${optionIndex + 1}`}
                                  >
                                    ×
                                  </button>
                                )}
                              </div>
                            ))}
                          </div>

                          {question.options.length < 5 && (
                            <button
                              type="button"
                              onClick={() =>
                                handleAddAssessmentOption(questionIndex)
                              }
                              className={styles.addOptionButton}
                            >
                              Adicionar opção
                            </button>
                          )}
                        </div>
                      ),
                    )}
                  </div>
                )}
              </div>
            </FormSection>
          )}

          {/* Step 4: Revisão */}
          {currentStep === 4 && (
            <FormSection title="Revisão Final">
              <div className={styles.reviewList}>
                <ReviewItem label="Título" value={jobData.titulo} />
                <ReviewItem label="Descrição" value={jobData.descricao} />
                <ReviewItem label="Localização" value={jobData.localizacao} />
                <ReviewItem
                  label="Tipo de Contrato"
                  value={jobData.tipoContrato}
                />
                <ReviewItem
                  label="Nível"
                  value={jobData.nivelExperiencia || "Não especificado"}
                />
                <ReviewItem
                  label="Salário"
                  value={
                    jobData.salarioDe && jobData.salarioAte
                      ? `${jobData.salarioDe} - ${jobData.salarioAte} Db`
                      : "Não especificado"
                  }
                />
                <ReviewItem
                  label="Período"
                  value={`${jobData.dataAbertura} até ${jobData.dataFecho}`}
                />
                <ReviewItem
                  label="Remoto"
                  value={jobData.remoto ? "Sim" : "Não"}
                />
                <ReviewItem
                  label="Vaga premium"
                  value={jobData.premiumOnly ? "Sim" : "Não"}
                />
                <ReviewItem
                  label="Acesso antecipado"
                  value={
                    Number(jobData.earlyAccessHours) > 0
                      ? `${jobData.earlyAccessHours} hora(s)`
                      : "Não ativado"
                  }
                />
                <ReviewItem
                  label="Carta obrigatória"
                  value={jobData.requireCoverLetter ? "Sim" : "Não"}
                />
                <ReviewItem
                  label="TDR"
                  value={jobData.tdrFileName || "Não enviado"}
                />
                <ReviewItem
                  label="Teste de habilidades"
                  value={
                    jobData.skillsAssessment.enabled
                      ? `${jobData.skillsAssessment.questions.length} pergunta(s)`
                      : "Não ativado"
                  }
                />
              </div>
            </FormSection>
          )}

          {/* Botões de Navegação */}
          <div className={styles.formActions}>
            <div>
              {currentStep > 1 && (
                <button
                  type="button"
                  onClick={prevStep}
                  className={styles.secondaryButton}
                >
                  Voltar
                </button>
              )}
            </div>
            <div className={styles.actionGroup}>
              <Link
                href="/dashboard/empresa"
                className={styles.cancelButton}
              >
                Cancelar
              </Link>
              {currentStep < 4 ? (
                <button
                  type="button"
                  onClick={nextStep}
                  className={styles.primaryButton}
                >
                  Continuar
                </button>
              ) : (
                <button
                  type="submit"
                  disabled={isLoading}
                  className={styles.primaryButton}
                >
                  {isLoading
                    ? isEditMode
                      ? "A atualizar..."
                      : "A criar..."
                    : isEditMode
                      ? "Guardar Alterações"
                      : "Publicar Vaga"}
                </button>
              )}
            </div>
          </div>
        </form>
        </div>
      </DashboardShell>
    </>
  );
}

// Review Item Component
function ReviewItem({ label, value }) {
  return (
    <div className={styles.reviewItem}>
      <span className={styles.reviewLabel}>{label}</span>
      <span className={styles.reviewValue}>
        {value || "-"}
      </span>
    </div>
  );
}

// Componentes de Formulário
function FormSection({ title, children }) {
  return (
    <section className={styles.formSection}>
      <h2 className={styles.sectionTitle}>
        {title}
      </h2>
      <div className={styles.sectionBody}>
        {children}
      </div>
    </section>
  );
}

function InputField({
  label,
  name,
  value,
  onChange,
  type = "text",
  placeholder = "",
  required = false,
  min,
}) {
  return (
    <label className={styles.field}>
      <span className={styles.fieldLabel}>{label}</span>
      <input
        type={type}
        name={name}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        required={required}
        min={min}
        className={styles.input}
      />
    </label>
  );
}

function SelectField({
  label,
  name,
  value,
  onChange,
  options,
  required = false,
}) {
  return (
    <label className={styles.field}>
      <span className={styles.fieldLabel}>{label}</span>
      <select
        name={name}
        value={value}
        onChange={onChange}
        required={required}
        className={`${styles.input} ${styles.select}`}
      >
        {options.map((opt) => (
          <option
            key={opt.value}
            value={opt.value}
          >
            {opt.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function TextAreaField({
  label,
  name,
  value,
  onChange,
  placeholder = "",
  rows = 4,
  required = false,
}) {
  return (
    <label className={styles.field}>
      <span className={styles.fieldLabel}>{label}</span>
      <textarea
        name={name}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        rows={rows}
        required={required}
        className={`${styles.input} ${styles.textarea}`}
      />
    </label>
  );
}
