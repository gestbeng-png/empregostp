import Head from "next/head";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import PublicPageShell from "../components/PublicPageShell";
import CompactJobCard from "../components/home/CompactJobCard";
import { admin } from "../lib/firebaseAdmin";
import { getEmpresaPlanSummary } from "../lib/empresaPlanFeatures";
import {
  safeText,
  safeTimestampToISOString,
  safeTimestampToMillis,
} from "../lib/firestoreNormalize";
import {
  isContentPublished,
  normalizeContentStatus,
} from "../lib/contentPublication";
import styles from "../styles/HomePage.module.css";

function serializeDateValue(value) {
  if (!value) return null;
  if (typeof value === "string") return value;
  if (value?.toDate) return value.toDate().toISOString();

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function compareRecentJobs(a, b) {
  if (a.destaque && !b.destaque) return -1;
  if (!a.destaque && b.destaque) return 1;
  if (a.premiumOnly && !b.premiumOnly) return -1;
  if (!a.premiumOnly && b.premiumOnly) return 1;
  return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
}

function normalizeContractType(value = "") {
  const normalized = String(value || "").toLowerCase();
  const types = {
    "full-time": "Tempo integral",
    "tempo integral": "Tempo integral",
    "part-time": "Meio período",
    "meio período": "Meio período",
    "meio periodo": "Meio período",
    contract: "Contrato",
    contrato: "Contrato",
    internship: "Estágio",
    estagio: "Estágio",
    estágio: "Estágio",
    freelance: "Freelance",
    voluntariado: "Voluntariado",
  };

  return types[normalized] || value || "Não informado";
}

function formatSalaryRange(fromValue, toValue) {
  const normalizeMoney = (value) => {
    if (!value && value !== 0) return "";
    if (String(value).trim().toLowerCase() === "a combinar") return "";

    const numeric = Number.parseFloat(
      String(value)
        .replace(/[^\d,.-]/g, "")
        .replace(",", "."),
    );
    if (!Number.isFinite(numeric)) return "";

    return new Intl.NumberFormat("pt-PT", {
      maximumFractionDigits: 0,
    }).format(numeric);
  };

  const from = normalizeMoney(fromValue);
  const to = normalizeMoney(toValue);

  if (from && to && from !== to) return `${from} - ${to} STD`;
  if (from) return `${from} STD`;
  if (to) return `${to} STD`;
  return "A combinar";
}

function formatPublishedAgo(value) {
  if (!value) return "Agora";

  const publishedDate = new Date(value);
  if (Number.isNaN(publishedDate.getTime())) return "Agora";

  const diffMs = Date.now() - publishedDate.getTime();
  const minutes = Math.floor(diffMs / (1000 * 60));
  const hours = Math.floor(diffMs / (1000 * 60 * 60));
  const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (days >= 1) return `${days}d`;
  if (hours >= 1) return `${hours}h`;
  if (minutes >= 1) return `${minutes}m`;
  return "Agora";
}

function getInitials(value = "") {
  return (
    String(value)
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part.charAt(0).toUpperCase())
      .join("") || "ES"
  );
}

function getPostDateLabel(post) {
  const source = post?.createdAt || post?.updatedAt;
  if (!source) return "Agora";

  const date = new Date(source);
  if (Number.isNaN(date.getTime())) return "Agora";

  return date.toLocaleDateString("pt-PT", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function truncateText(value = "", maxLength = 112) {
  const normalized = String(value || "")
    .replace(/\s+/g, " ")
    .trim();
  if (normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, maxLength - 1).trim()}…`;
}

function VerificationBadgeIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path
        fillRule="evenodd"
        d="M12 2.25c1.18 0 2.24.52 2.95 1.34a3.9 3.9 0 013.03 1.13 3.9 3.9 0 011.13 3.03c.82.71 1.34 1.77 1.34 2.95s-.52 2.24-1.34 2.95a3.9 3.9 0 01-1.13 3.03 3.9 3.9 0 01-3.03 1.13A3.89 3.89 0 0112 21.75a3.89 3.89 0 01-2.95-1.34 3.9 3.9 0 01-3.03-1.13 3.9 3.9 0 01-1.13-3.03A3.89 3.89 0 013.75 12c0-1.18.52-2.24 1.34-2.95a3.9 3.9 0 011.13-3.03 3.9 3.9 0 013.03-1.13A3.89 3.89 0 0112 2.25zm2.28 6.97a.75.75 0 10-1.06-1.06l-2.67 2.66-1.22-1.22a.75.75 0 10-1.06 1.06l1.75 1.75a.75.75 0 001.06 0l3.2-3.19z"
        clipRule="evenodd"
      />
    </svg>
  );
}

const FALLBACK_CATEGORIES = [
  {
    name: "Marketing Digital",
    icon: "fa-bullhorn",
    color: "#2563eb",
    count: "...",
  },
  { name: "Programação", icon: "fa-code", color: "#10b981", count: "..." },
  { name: "Design", icon: "fa-palette", color: "#0ea5e9", count: "..." },
];

const CATEGORY_CONFIGS = {
  Marketing: { icon: "fa-bullhorn", color: "#2563eb" },
  "Marketing Digital": { icon: "fa-bullhorn", color: "#2563eb" },
  Programação: { icon: "fa-code", color: "#10b981" },
  Desenvolvimento: { icon: "fa-code", color: "#10b981" },
  Design: { icon: "fa-palette", color: "#0ea5e9" },
  Administração: { icon: "fa-briefcase", color: "#4f46e5" },
  Gestão: { icon: "fa-briefcase", color: "#4f46e5" },
  "Gestão e Administração": { icon: "fa-briefcase", color: "#4f46e5" },
  Vendas: { icon: "fa-chart-line", color: "#f97316" },
  Educação: { icon: "fa-graduation-cap", color: "#7c3aed" },
  Saúde: { icon: "fa-heartbeat", color: "#ec4899" },
  Engenharia: { icon: "fa-wrench", color: "#06b6d4" },
  Finanças: { icon: "fa-dollar-sign", color: "#14b8a6" },
  "Recursos Humanos": { icon: "fa-users", color: "#0f766e" },
  RH: { icon: "fa-users", color: "#0f766e" },
};

const HOW_IT_WORKS_STEPS = [
  {
    number: "01",
    title: "Crie a sua conta",
    desc: "Registe-se gratuitamente e aceda ao ecossistema da plataforma.",
    icon: "fa-user-plus",
  },
  {
    number: "02",
    title: "Carregue o seu CV",
    desc: "Organize o seu perfil, currículo e informações principais numa única conta.",
    icon: "fa-file-arrow-up",
  },
  {
    number: "03",
    title: "Explore as oportunidades",
    desc: "Descubra novas vagas, guarde oportunidades e acompanhe prazos com maior facilidade.",
    icon: "fa-magnifying-glass",
  },
  {
    number: "04",
    title: "Candidate-se",
    desc: "Submeta a sua candidatura e acompanhe o processo com mais clareza e confiança.",
    icon: "fa-paper-plane",
  },
];

function resolveCategoryConfig(category) {
  return (
    CATEGORY_CONFIGS[category?.name] || {
      icon: category?.icon || "fa-folder",
      color: category?.color || "#2563eb",
    }
  );
}

async function fetchCollectionWithFallback(collectionName) {
  const collectionRef = admin.firestore().collection(collectionName);
  try {
    return await collectionRef.orderBy("createdAt", "desc").get();
  } catch (error) {
    console.warn(
      `[home] fallback sem orderBy em ${collectionName}:`,
      error?.message || error,
    );
    return collectionRef.get();
  }
}

export async function getServerSideProps(context) {
  try {
    context?.res?.setHeader?.(
      "Cache-Control",
      "public, s-maxage=60, stale-while-revalidate=300",
    );

    const [
      activeJobsSnapshot,
      companiesSnapshot,
      candidatesSnapshot,
      postsSnapshot,
    ] = await Promise.all([
      admin
        .firestore()
        .collection("jobs")
        .where("status", "==", "active")
        .get(),
      admin
        .firestore()
        .collection("users")
        .where("userType", "==", "empresa")
        .get(),
      admin
        .firestore()
        .collection("users")
        .where("userType", "==", "candidato")
        .get(),
      fetchCollectionWithFallback("posts"),
    ]);

    const activeJobsData = activeJobsSnapshot.docs.map((doc) => ({
      ...doc.data(),
      id: doc.id,
    }));
    const companyIds = [
      ...new Set(activeJobsData.map((job) => job.companyId).filter(Boolean)),
    ];
    const companyRefs = companyIds.map((companyId) =>
      admin.firestore().collection("users").doc(companyId),
    );
    const companyDocs = companyRefs.length
      ? await admin.firestore().getAll(...companyRefs)
      : [];
    const companiesMap = new Map();

    companyDocs.forEach((doc) => {
      if (!doc.exists) return;
      const companyData = doc.data() || {};
      companiesMap.set(doc.id, {
        raw: companyData,
        planSummary: getEmpresaPlanSummary(companyData),
      });
    });

    const jobs = activeJobsData
      .map((jobData) => {
        const companyEntry = companiesMap.get(jobData.companyId) || {};
        const companyData = companyEntry.raw || {};
        const planSummary = companyEntry.planSummary || null;

        return {
          id: jobData.id,
          titulo: jobData.titulo || jobData.title || "Sem título",
          localizacao:
            jobData.localizacao ||
            jobData.location ||
            jobData.cidade ||
            "Local não especificado",
          tipoContrato:
            jobData.tipoContrato ||
            jobData.contractType ||
            jobData.tipo ||
            "Não informado",
          salarioDe:
            jobData.salarioDe || jobData.salario || jobData.salaryMin || "",
          salarioAte: jobData.salarioAte || jobData.salaryMax || "",
          empresaLogo: planSummary?.features?.logoOnJob
            ? companyData.logo || jobData.logo || ""
            : "",
          empresaNome:
            companyData.name ||
            companyData.fullName ||
            jobData.empresa ||
            "Empresa Confidencial",
          companyName:
            companyData.name ||
            companyData.fullName ||
            jobData.empresa ||
            "Empresa Confidencial",
          companyVerified: Boolean(planSummary?.features?.companyVerified),
          descricao: jobData.descricao || jobData.description || "",
          experiencia: jobData.experiencia || jobData.experience || "",
          prazo: jobData.prazo || jobData.deadline || jobData.dataLimite || "",
          dataFecho: serializeDateValue(
            jobData.dataFecho ||
              jobData.expiresAt ||
              jobData.deadline ||
              jobData.prazo ||
              jobData.dataLimite,
          ),
          status: jobData.status || "active",
          remoto: jobData.remoto || jobData.remote || false,
          destaque: jobData.destaque || jobData.featured || false,
          premiumOnly: Boolean(jobData.premiumOnly || jobData.isPremiumOnly),
          categoria: jobData.categoria || jobData.category || "",
          palavrasChave: Array.isArray(jobData.palavrasChave)
            ? jobData.palavrasChave
            : Array.isArray(jobData.keywords)
              ? jobData.keywords
              : [],
          companyId: jobData.companyId || "",
          publicadoEm: serializeDateValue(
            jobData.publicadoEm || jobData.publishedAt || jobData.createdAt,
          ),
          createdAt:
            serializeDateValue(jobData.createdAt) || new Date().toISOString(),
          updatedAt:
            serializeDateValue(jobData.updatedAt) || new Date().toISOString(),
        };
      })
      .sort(compareRecentJobs);

    const [
      verifiedFlagSnap,
      verifiedLegacySnap,
      verifiedLegacy2Snap,
      verifiedStatusSnap,
      approvedStatusSnap,
    ] = await Promise.all([
      admin
        .firestore()
        .collection("users")
        .where("userType", "==", "candidato")
        .where("verified", "==", true)
        .limit(60)
        .get(),
      admin
        .firestore()
        .collection("users")
        .where("userType", "==", "candidato")
        .where("verificado", "==", true)
        .limit(60)
        .get(),
      admin
        .firestore()
        .collection("users")
        .where("userType", "==", "candidato")
        .where("isVerified", "==", true)
        .limit(60)
        .get(),
      admin
        .firestore()
        .collection("users")
        .where("userType", "==", "candidato")
        .where("verificationStatus", "==", "verified")
        .limit(60)
        .get(),
      admin
        .firestore()
        .collection("users")
        .where("userType", "==", "candidato")
        .where("verificationStatus", "==", "approved")
        .limit(60)
        .get(),
    ]);

    const verifiedUsersMap = new Map();
    for (const doc of verifiedFlagSnap.docs) verifiedUsersMap.set(doc.id, doc);
    for (const doc of verifiedLegacySnap.docs)
      verifiedUsersMap.set(doc.id, doc);
    for (const doc of verifiedLegacy2Snap.docs)
      verifiedUsersMap.set(doc.id, doc);
    for (const doc of verifiedStatusSnap.docs)
      verifiedUsersMap.set(doc.id, doc);
    for (const doc of approvedStatusSnap.docs)
      verifiedUsersMap.set(doc.id, doc);

    const verifiedUserDocs = Array.from(verifiedUsersMap.values());
    const verifiedUserIds = verifiedUserDocs.map((doc) => doc.id);
    const profileDocs = verifiedUserIds.length
      ? await admin
          .firestore()
          .getAll(
            ...verifiedUserIds.map((uid) =>
              admin.firestore().collection("profiles").doc(uid),
            ),
          )
      : [];

    const profileMap = new Map();
    profileDocs.forEach((profileDoc) => {
      if (profileDoc.exists)
        profileMap.set(profileDoc.id, profileDoc.data() || {});
    });

    const spotlightCandidates = verifiedUserDocs
      .map((doc) => {
        const userData = doc.data() || {};
        const profileData = profileMap.get(doc.id) || {};
        const fullName =
          userData.fullName ||
          userData.name ||
          profileData.fullName ||
          profileData.name ||
          "Candidato verificado";

        const headline =
          userData.headline ||
          userData.profession ||
          profileData.headline ||
          profileData.profession ||
          profileData.objectiveArea ||
          "Profissional";

        const destaque = Boolean(
          userData.destaque ||
          userData.curriculoDestacado ||
          profileData.destaque ||
          profileData.curriculoDestacado,
        );

        const createdAtRaw =
          userData.createdAt || profileData.createdAt || null;
        const createdAt = createdAtRaw?.toDate?.()?.toISOString?.() || null;

        return {
          id: doc.id,
          fullName,
          headline,
          initials: getInitials(fullName),
          photoUrl:
            userData.photoUrl ||
            userData.photo ||
            profileData.photoUrl ||
            profileData.photo ||
            "",
          verified: true,
          destaque,
          createdAt,
        };
      })
      .sort((a, b) => {
        if (a.destaque !== b.destaque) return b.destaque ? 1 : -1;
        return (
          new Date(b.createdAt || 0).getTime() -
          new Date(a.createdAt || 0).getTime()
        );
      });

    const latestPosts = postsSnapshot.docs
      .map((doc) => {
        const data = doc.data() || {};
        return {
          id: doc.id,
          title: safeText(data.title, "Sem título"),
          excerpt: safeText(data.excerpt, ""),
          category: safeText(data.category, "Blog"),
          image: safeText(data.image, ""),
          readTime: safeText(data.readTime, "5 min"),
          status: normalizeContentStatus(data.status),
          createdAt: safeTimestampToISOString(data.createdAt),
          updatedAt: safeTimestampToISOString(data.updatedAt),
          createdAtMs: safeTimestampToMillis(data.createdAt),
          updatedAtMs: safeTimestampToMillis(data.updatedAt),
        };
      })
      .filter((post) => isContentPublished(post.status))
      .sort(
        (a, b) =>
          (b.createdAtMs || b.updatedAtMs || 0) -
          (a.createdAtMs || a.updatedAtMs || 0),
      )
      .slice(0, 2)
      .map(({ createdAtMs, updatedAtMs, ...post }) => post);

    const stats = {
      activeJobs: jobs.length,
      activeCandidates: candidatesSnapshot.size,
      activeCompanies: companiesSnapshot.size,
      recentJobsLast14Days: jobs.filter((job) => {
        if (!job.createdAt) return false;
        const createdAt = new Date(job.createdAt);
        if (Number.isNaN(createdAt.getTime())) return false;
        const ageInDays =
          (new Date().getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24);
        return ageInDays <= 14;
      }).length,
    };

    return {
      props: {
        jobs: JSON.parse(JSON.stringify(jobs)),
        stats,
        spotlightCandidates: JSON.parse(JSON.stringify(spotlightCandidates)),
        latestPosts: JSON.parse(JSON.stringify(latestPosts)),
      },
    };
  } catch (error) {
    console.error("Erro fatal ao buscar dados da home:", error);
    return {
      props: {
        jobs: [],
        stats: {
          activeJobs: 0,
          activeCandidates: 0,
          activeCompanies: 0,
          recentJobsLast14Days: 0,
        },
        spotlightCandidates: [],
        latestPosts: [],
      },
    };
  }
}

export default function HomePage({
  jobs: initialJobs = [],
  stats = {
    activeJobs: 0,
    activeCandidates: 0,
    activeCompanies: 0,
    recentJobsLast14Days: 0,
  },
  spotlightCandidates = [],
  latestPosts = [],
}) {
  const router = useRouter();
  const [searchTerm, setSearchTerm] = useState("");
  const [filteredJobs, setFilteredJobs] = useState(initialJobs);
  const [categories, setCategories] = useState([]);
  const [newsletterEmail, setNewsletterEmail] = useState("");
  const [newsletterState, setNewsletterState] = useState({
    status: "idle",
    message: "",
  });

  useEffect(() => {
    setFilteredJobs(initialJobs);

    fetch("/api/jobs/categories")
      .then((res) => res.json())
      .then((data) => {
        const predefinedCategories = [
          { name: "Marketing Digital", icon: "fa-bullhorn", color: "#2563eb" },
          { name: "Programação", icon: "fa-code", color: "#10b981" },
          { name: "Design", icon: "fa-palette", color: "#0ea5e9" },
        ];

        const categoriesWithCounts = predefinedCategories.map((predef) => {
          const realCategory = data.categories?.find(
            (category) => category.name === predef.name,
          );
          return {
            ...predef,
            count: realCategory ? realCategory.count : 0,
          };
        });

        setCategories(categoriesWithCounts);
      })
      .catch((error) => {
        console.error("Erro ao buscar categorias:", error);
        setCategories(
          FALLBACK_CATEGORIES.map((category) => ({ ...category, count: 0 })),
        );
      });
  }, [initialJobs]);

  const handleSearch = (event) => {
    const term = event.target.value.toLowerCase();
    setSearchTerm(term);

    if (!term) {
      setFilteredJobs(initialJobs);
      return;
    }

    const filtered = initialJobs.filter(
      (job) =>
        (job.titulo?.toLowerCase() || "").includes(term) ||
        (job.empresaNome?.toLowerCase() || "").includes(term) ||
        (job.localizacao?.toLowerCase() || "").includes(term) ||
        (job.tipoContrato?.toLowerCase() || "").includes(term) ||
        (job.categoria?.toLowerCase() || "").includes(term),
    );

    setFilteredJobs(filtered);
  };

  const handleSearchSubmit = (event) => {
    event.preventDefault();
    const query = searchTerm.trim();
    router.push(
      query ? `/vagas?search=${encodeURIComponent(query)}` : "/vagas",
    );
  };

  const handleNewsletterSubmit = async (event) => {
    event.preventDefault();
    const email = newsletterEmail.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setNewsletterState({
        status: "error",
        message: "Introduza um email válido.",
      });
      return;
    }

    setNewsletterState({ status: "loading", message: "" });

    try {
      const response = await fetch("/api/newsletter/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, source: "home" }),
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        setNewsletterState({
          status: "error",
          message: data.error || "Não foi possível subscrever. Tente novamente.",
        });
        return;
      }

      setNewsletterState({
        status: "success",
        message: data.message || "Subscrição confirmada! Obrigado.",
      });
      setNewsletterEmail("");
    } catch (error) {
      setNewsletterState({
        status: "error",
        message: "Erro de ligação. Tente novamente dentro de momentos.",
      });
    }
  };

  const displayedCategories = (
    categories.length === 0 ? FALLBACK_CATEGORIES : categories
  ).slice(0, 3);
  const heroJobs = filteredJobs.slice(0, 4);
  const jobsPreview = filteredJobs.slice(0, 8);
  const featuredCandidates = spotlightCandidates.slice(0, 3);
  const networkCandidates = spotlightCandidates.slice(0, 5);
  const newsPosts =
    latestPosts.length > 0
      ? latestPosts.slice(0, 2)
      : [
          {
            id: "blog",
            title: "Explore conteúdos e dicas para melhorar a sua carreira",
            excerpt:
              "Veja artigos, recursos e atualizações do mercado de trabalho na plataforma.",
            category: "Blog",
            image: "",
            readTime: "5 min",
          },
          {
            id: "recursos",
            title:
              "Descubra recursos práticos para CV, candidatura e preparação",
            excerpt:
              "Use ferramentas e conteúdos do Emprego STP para dar mais força ao seu perfil.",
            category: "Recursos",
            image: "",
            readTime: "4 min",
          },
        ];

  const metrics = [
    { label: "Vagas ativas", value: `${stats.activeJobs}+` },
    { label: "Empresas ativas", value: `${stats.activeCompanies}+` },
    { label: "Talentos registados", value: `${stats.activeCandidates}+` },
  ];
  const candidateFeatures = [
    "Criar perfil profissional",
    "Guardar vagas favoritas",
    "Gerir candidaturas com mais clareza",
  ];

  const companyFeatures = [
    "Publicar vagas com mais visibilidade",
    "Receber candidaturas organizadas",
    "Aceder ao banco de talentos",
  ];

  return (
    <>
      <Head>
        <title>Empregos STP - Conectando Talentos ao Sucesso</title>
        <meta
          name="description"
          content="A melhor plataforma de empregos em São Tomé e Príncipe. Conectando talentos às melhores oportunidades."
        />
        <link rel="icon" href="/favicon.ico" />
        <link
          rel="stylesheet"
          href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0-beta3/css/all.min.css"
        />
      </Head>

      <PublicPageShell headerVariant="light">
        <div className={styles.page}>
          <section className={styles.hero}>
            <div className={styles.sectionContainer}>
              <div className={styles.heroCanvas}>
                <span
                  className={`${styles.heroSpark} ${styles.heroSparkBlueLeft}`}
                  aria-hidden="true"
                />
                <span
                  className={`${styles.heroSpark} ${styles.heroSparkBlueRight}`}
                  aria-hidden="true"
                />
                <span
                  className={`${styles.heroSpark} ${styles.heroSparkLime}`}
                  aria-hidden="true"
                />

                <div className={styles.heroRingOuter} aria-hidden="true" />
                <div className={styles.heroRingInner}>
                  <p className={styles.heroEyebrow}>
                    Empregos em São Tomé e Príncipe
                  </p>
                  <h1 className={styles.heroTitle}>
                    Conectando
                    <br />
                    <span className={styles.heroTitleAccent}>Talentos</span>
                    <br />
                    ao Sucesso
                  </h1>
                  <p className={styles.heroDescription}>
                    Somos a plataforma que aproxima candidatos e empresas com
                    uma experiência mais clara, rápida e acessível.
                  </p>

                  <form
                    className={styles.searchForm}
                    onSubmit={handleSearchSubmit}
                  >
                    <div className={styles.searchField}>
                      <i className="fas fa-search" aria-hidden="true" />
                      <input
                        type="text"
                        value={searchTerm}
                        onChange={handleSearch}
                        className={styles.searchInput}
                        placeholder="Título da vaga"
                        aria-label="Pesquisar vagas na homepage"
                      />
                    </div>
                    <button type="submit" className={styles.searchButton}>
                      BUSCA
                    </button>
                  </form>

                </div>

                {heroJobs.map((job, index) => (
                  <Link
                    key={job.id}
                    href={`/vaga/${job.id}`}
                    className={`${styles.heroFloatingCard} ${styles[`floatingCard${index + 1}`]}`}
                  >
                    <div className={styles.heroFloatingIcon}>
                      {job.empresaLogo ? (
                        <img
                          src={job.empresaLogo}
                          alt={job.empresaNome}
                          className={styles.heroFloatingLogo}
                          loading="lazy"
                          decoding="async"
                        />
                      ) : (
                        <span>{getInitials(job.empresaNome)}</span>
                      )}
                    </div>
                    <div className={styles.heroFloatingBody}>
                      <strong>{truncateText(job.titulo, 34)}</strong>
                      <span>{job.empresaNome}</span>
                      <div className={styles.heroFloatingMeta}>
                        <small>
                          <i className="fas fa-briefcase" aria-hidden="true" />
                          {normalizeContractType(job.tipoContrato)}
                        </small>
                        <em className={styles.heroFloatingTag}>OPEN</em>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          </section>

          <section className={styles.jobsSection}>
            <div className={styles.sectionContainer}>
              <div className={styles.sectionHeaderDark}>
                <h2 className={styles.sectionTitleDark}>
                  Veja vagas disponíveis
                </h2>
                <Link href="/vagas" className={styles.sectionLinkDark}>
                  TODAS
                </Link>
              </div>

              <div className={styles.compactJobsGrid}>
                {jobsPreview.map((job) => (
                  <CompactJobCard
                    key={job.id}
                    href={`/vaga/${job.id}`}
                    title={job.titulo}
                    badgeLabel={job.destaque ? "Destaque" : "Nova"}
                    status={job.status}
                    salary={formatSalaryRange(job.salarioDe, job.salarioAte)}
                    companyName={job.empresaNome}
                    companyLogo={job.empresaLogo}
                    imageAlt={job.empresaNome}
                    metaItems={[
                      {
                        icon: "fas fa-location-dot",
                        text: job.localizacao,
                      },
                      {
                        icon: "fas fa-briefcase",
                        text: normalizeContractType(job.tipoContrato),
                      },
                      {
                        icon: "fas fa-clock",
                        text: formatPublishedAgo(
                          job.publicadoEm || job.createdAt,
                        ),
                      },
                    ]}
                  />
                ))}
              </div>
            </div>
          </section>

          <section className={styles.categoriesSection}>
            <div className={styles.sectionContainer}>
              <div className={styles.sectionHeaderLight}>
                <h2 className={styles.sectionTitleLight}>
                  Categorias populares
                </h2>
                <Link href="/vagas" className={styles.sectionLinkLight}>
                  TODAS
                </Link>
              </div>

              <div className={styles.categoriesGrid}>
                {displayedCategories.map((category) => {
                  const config = resolveCategoryConfig(category);
                  const countLabel =
                    typeof category.count === "number"
                      ? `${category.count} vaga${category.count !== 1 ? "s" : ""}`
                      : category.count;

                  return (
                    <Link
                      key={category.name}
                      href={`/vagas?categoria=${encodeURIComponent(category.name.toLowerCase())}`}
                      className={styles.categoryCard}
                      style={{ "--category-tone": config.color }}
                    >
                      <span className={styles.categoryIcon}>
                        <i
                          className={`fas ${config.icon}`}
                          aria-hidden="true"
                        />
                      </span>
                      <div>
                        <h3 className={styles.categoryName}>{category.name}</h3>
                        <p className={styles.categoryCount}>{countLabel}</p>
                      </div>
                    </Link>
                  );
                })}
              </div>
            </div>
          </section>

          <section id="testemunhos" className={styles.signalsSection}>
            <div className={styles.sectionContainer}>
              <div className={styles.signalsGrid}>
                <article className={styles.metricsCard}>
                  <div className={styles.metricsGrid}>
                    {metrics.map((item) => (
                      <div key={item.label} className={styles.metricItem}>
                        <strong className={styles.metricValue}>
                          {item.value}
                        </strong>
                        <span className={styles.metricLabel}>{item.label}</span>
                      </div>
                    ))}
                  </div>
                </article>

                <Link
                  href="/sobre-nos#testemunhos"
                  className={styles.testimonialCard}
                  aria-label="Ver testemunhos na página Sobre nós"
                >
                  <h2 className={styles.testimonialTitle}>Testemunhos</h2>
                  <div className={styles.testimonialAvatars}>
                    {featuredCandidates.length ? (
                      featuredCandidates.map((candidate) => (
                        <span
                          key={candidate.id}
                          className={styles.testimonialAvatar}
                        >
                          {candidate.initials}
                        </span>
                      ))
                    ) : (
                      <>
                        <span className={styles.testimonialAvatar}>ES</span>
                        <span className={styles.testimonialAvatar}>ST</span>
                        <span className={styles.testimonialAvatar}>JP</span>
                      </>
                    )}
                  </div>
                  <p className={styles.testimonialText}>
                    Empresas e talentos estão a usar a plataforma para encontrar
                    oportunidades com mais rapidez e clareza.
                  </p>
                </Link>
              </div>
            </div>
          </section>

          <section className={styles.aboutSection}>
            <div className={styles.sectionContainer}>
              <div className={styles.aboutGrid}>
                <div className={styles.aboutContent}>
                  <p className={styles.aboutEyebrow}>Sobre nós</p>
                  <h2 className={styles.aboutTitle}>
                    Uma plataforma feita para aproximar candidatos e empresas
                  </h2>
                  <p className={styles.aboutText}>
                    Facilitar o acesso ao emprego em São Tomé e Príncipe,
                    tornando a procura e a divulgação de vagas mais rápidas,
                    transparentes e humanas.
                  </p>
                  <div className={styles.aboutActions}>
                    <Link href="/vagas" className={styles.aboutPrimary}>
                      PESQUISAR VAGAS
                    </Link>
                    <Link
                      href="/register?type=candidato"
                      className={styles.aboutSecondary}
                    >
                      CANDIDATAR-ME
                    </Link>
                  </div>
                </div>

                <div className={styles.networkPanel} aria-hidden="true">
                  <div className={styles.networkCenter}>+</div>
                  {networkCandidates.map((candidate, index) => (
                    <span
                      key={candidate.id}
                      className={`${styles.networkNode} ${styles[`networkNode${index + 1}`] || ""}`}
                    >
                      {candidate.initials}
                    </span>
                  ))}
                  {!networkCandidates.length ? (
                    <>
                      <span
                        className={`${styles.networkNode} ${styles.networkNode1}`}
                      >
                        CV
                      </span>
                      <span
                        className={`${styles.networkNode} ${styles.networkNode2}`}
                      >
                        RH
                      </span>
                      <span
                        className={`${styles.networkNode} ${styles.networkNode3}`}
                      >
                        TI
                      </span>
                      <span
                        className={`${styles.networkNode} ${styles.networkNode4}`}
                      >
                        MK
                      </span>
                    </>
                  ) : null}
                </div>
              </div>
            </div>
          </section>

          <section className={styles.processSection}>
            <div className={styles.sectionContainer}>
              <div className={styles.processPanel}>
                <h2 className={styles.processTitle}>
                  Como funciona a plataforma
                </h2>
                <p className={styles.processText}>
                  Um percurso simples e estruturado para encontrar oportunidades,
                  preparar o seu perfil e candidatar-se com mais confiança.
                </p>

                <div className={styles.processGrid}>
                  {HOW_IT_WORKS_STEPS.map((step) => (
                    <article key={step.number} className={styles.processStep}>
                      <span className={styles.processStepIcon}>
                        <i className={`fas ${step.icon}`} aria-hidden="true" />
                      </span>
                      <h3 className={styles.processStepTitle}>{step.title}</h3>
                      <p className={styles.processStepText}>{step.desc}</p>
                    </article>
                  ))}
                </div>
              </div>
            </div>
          </section>

          <section className={styles.talentsSection}>
            <div className={styles.sectionContainer}>
              <div className={styles.talentsGrid}>
                <div className={styles.talentsContent}>
                  <p className={styles.talentsEyebrow}>Talentos em destaque</p>
                  <h2 className={styles.talentsTitle}>
                    Encontre <span>Candidatos</span> Qualificados
                  </h2>
                  <p className={styles.talentsText}>
                    Explore perfis verificados, descubra profissionais em
                    vitrine e acelere o recrutamento com mais confiança.
                  </p>
                </div>

                <div className={styles.candidatesPanel}>
                  <ul className={styles.candidatesList}>
                    {(featuredCandidates.length
                      ? featuredCandidates
                      : [
                          {
                            id: "fallback-1",
                            fullName: "Candidato Verificado",
                            headline: "Perfil em destaque",
                            initials: "CV",
                          },
                          {
                            id: "fallback-2",
                            fullName: "Talento em análise",
                            headline: "Perfil profissional",
                            initials: "TA",
                          },
                          {
                            id: "fallback-3",
                            fullName: "Novo candidato",
                            headline: "Disponível para oportunidades",
                            initials: "NC",
                          },
                        ]
                    ).map((candidate) => {
                      const profileHref = candidate.id?.startsWith("fallback-")
                        ? "/candidatos"
                        : `/candidatos/${candidate.id}`;

                      return (
                        <li
                          key={candidate.id}
                          className={styles.homeCandidateListItem}
                        >
                          <Link
                            href={profileHref}
                            className={styles.homeCandidateCard}
                          >
                            {candidate.photoUrl ? (
                              <img
                                src={candidate.photoUrl}
                                alt={candidate.fullName}
                                className={styles.homeCandidateAvatarImage}
                                loading="lazy"
                                decoding="async"
                              />
                            ) : (
                              <div className={styles.homeCandidateAvatar}>
                                {candidate.initials}
                              </div>
                            )}
                            <div className={styles.homeCandidateInfo}>
                              <div className={styles.homeCandidateTitleRow}>
                                <h3 className={styles.homeCandidateName}>
                                  {candidate.fullName}
                                </h3>
                                {candidate.verified ? (
                                  <span
                                    className={styles.homeCandidateVerified}
                                  >
                                    <VerificationBadgeIcon />
                                    Verificado
                                  </span>
                                ) : null}
                              </div>
                              <p className={styles.homeCandidateHeadline}>
                                {candidate.headline}
                              </p>
                              <span className={styles.homeCandidateStatus}>
                                Ver perfil
                              </span>
                            </div>
                            <span
                              className={styles.homeCandidateArrow}
                              aria-hidden="true"
                            >
                              →
                            </span>
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              </div>
            </div>
          </section>

          <section className={styles.newsSection}>
            <div className={styles.sectionContainer}>
              <div className={styles.sectionHeaderLight}>
                <h2 className={styles.sectionTitleLight}>
                  Novidades sobre mercado de trabalho
                </h2>
                <Link href="/blog" className={styles.sectionLinkLight}>
                  EXPLORAR
                </Link>
              </div>

              <div className={styles.newsGrid}>
                <article className={styles.newsletterCard}>
                  <h3 className={styles.newsletterTitle}>
                    Subscreva a nossa Newsletter
                  </h3>
                  <p className={styles.newsletterText}>
                    Receba novidades, dicas e conteúdos do mercado de trabalho
                    diretamente no seu email.
                  </p>
                  <form
                    className={styles.newsletterForm}
                    onSubmit={handleNewsletterSubmit}
                  >
                    <input
                      type="email"
                      value={newsletterEmail}
                      onChange={(event) => {
                        setNewsletterEmail(event.target.value);
                        if (newsletterState.status !== "idle") {
                          setNewsletterState({ status: "idle", message: "" });
                        }
                      }}
                      className={styles.newsletterInput}
                      placeholder="Seu email"
                      aria-label="Email para subscrever a newsletter"
                      disabled={newsletterState.status === "loading"}
                    />
                    <button
                      type="submit"
                      className={styles.newsletterButton}
                      disabled={newsletterState.status === "loading"}
                    >
                      {newsletterState.status === "loading" ? "A subscrever…" : "Submeter"}
                    </button>
                  </form>
                  {newsletterState.message ? (
                    <p
                      className={styles.newsletterFeedback}
                      style={{
                        marginTop: "0.6rem",
                        fontSize: "0.85rem",
                        fontWeight: 600,
                        color:
                          newsletterState.status === "error"
                            ? "#dc2626"
                            : "#16a34a",
                      }}
                      role="status"
                      aria-live="polite"
                    >
                      {newsletterState.message}
                    </p>
                  ) : null}
                </article>

                {newsPosts.map((post) => (
                  <Link
                    key={post.id}
                    href={
                      post.id === "recursos" ? "/recursos" : `/blog/${post.id}`
                    }
                    className={styles.postCard}
                  >
                    <div className={styles.postImageWrap}>
                      {post.image ? (
                        <img
                          src={post.image}
                          alt={post.title}
                          className={styles.postImage}
                          loading="lazy"
                          decoding="async"
                        />
                      ) : (
                        <div className={styles.postImagePlaceholder}>
                          {getInitials(post.title)}
                        </div>
                      )}
                    </div>

                    <div className={styles.postBody}>
                      <span className={styles.postCategory}>
                        {post.category}
                      </span>
                      <h3 className={styles.postTitle}>{post.title}</h3>
                      <p className={styles.postExcerpt}>
                        {truncateText(post.excerpt, 120)}
                      </p>
                      <div className={styles.postMeta}>
                        <span>{getPostDateLabel(post)}</span>
                        <span>{post.readTime || "5 min"}</span>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          </section>

          <section className={styles.dualSection}>
            <div className={styles.sectionContainer}>
              <div className={styles.dualGrid}>
                <article
                  className={`${styles.dualCard} ${styles.dualCardCandidate}`}
                >
                  <div className={styles.dualCardHeader}>
                    <span className={styles.dualBadge}>Candidato</span>
                  </div>
                  <h2 className={styles.dualTitle}>
                    Organize o seu perfil e encontre melhores oportunidades
                  </h2>
                  <p className={styles.dualText}>
                    Crie um perfil profissional, guarde vagas favoritas e acompanhe
                    as suas candidaturas com mais clareza.
                  </p>
                  <Link
                    href="/register?type=candidato"
                    className={styles.dualLink}
                  >
                    Criar conta
                  </Link>
                </article>

                <article
                  className={`${styles.dualCard} ${styles.dualCardEmployer}`}
                >
                  <div className={styles.dualCardHeader}>
                    <span className={styles.dualBadge}>Empregador</span>
                  </div>
                  <h2 className={styles.dualTitle}>
                    Publique vagas e encontre talentos com mais eficiência
                  </h2>
                  <p className={styles.dualText}>
                    Publique vagas com visibilidade, receba candidaturas
                    organizadas e aceda ao banco de talentos.
                  </p>
                  <Link
                    href="/register?type=empresa"
                    className={styles.dualLink}
                  >
                    Registar
                  </Link>
                </article>
              </div>
            </div>
          </section>
        </div>
      </PublicPageShell>
    </>
  );
}
