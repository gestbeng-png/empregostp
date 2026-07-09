import React, { useEffect, useMemo, useState } from "react";
import Head from "next/head";
import Link from "next/link";
import { useRouter } from "next/router";
import {
  FiArrowRight,
  FiBell,
  FiBriefcase,
  FiCheckCircle,
  FiChevronUp,
  FiClock,
  FiGrid,
  FiHeart,
  FiList,
  FiMapPin,
  FiStar,
  FiUsers,
  FiX,
  FiZap,
} from "react-icons/fi";
import PublicPageShell from "../../components/PublicPageShell";
import styles from "../../styles/VagasPage.module.css";

function normalizeSearchValue(value) {
  if (Array.isArray(value)) return value.join(" ");
  return String(value || "");
}

function parseList(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value.filter(Boolean);
  return String(value)
    .split(/\n|,|;/g)
    .map((item) => item.trim())
    .filter(Boolean);
}

function matchesSearch(job, term) {
  const haystack = [
    job.titulo,
    job.descricao,
    job.localizacao,
    job.categoria,
    job.tipoContrato,
    ...(Array.isArray(job.palavrasChave) ? job.palavrasChave : []),
    normalizeSearchValue(job.requisitos),
    normalizeSearchValue(job.beneficios),
  ]
    .join(" ")
    .toLowerCase();

  return haystack.includes(term);
}

function compareRecentJobs(a, b) {
  if (a.destaque && !b.destaque) return -1;
  if (!a.destaque && b.destaque) return 1;
  if (a.premiumOnly && !b.premiumOnly) return -1;
  if (!a.premiumOnly && b.premiumOnly) return 1;
  return new Date(b.createdAt || b.publishedAt || 0) - new Date(a.createdAt || a.publishedAt || 0);
}

function normalizeContractType(value = "") {
  const normalized = String(value || "").toLowerCase();
  const types = {
    "full-time": "Full-time",
    "tempo integral": "Full-time",
    "part-time": "Part-time",
    "meio período": "Part-time",
    "meio periodo": "Part-time",
    contract: "Contrato",
    contrato: "Contrato",
    internship: "Estágio",
    estagio: "Estágio",
    estágio: "Estágio",
    freelance: "Freelance",
    temporário: "Temporário",
    temporario: "Temporário",
    voluntariado: "Voluntariado",
  };

  return types[normalized] || value || "Não informado";
}

function formatPublishedAgo(value) {
  if (!value) return "agora";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "agora";

  const diffMs = Date.now() - date.getTime();
  const minutes = Math.floor(diffMs / 60000);
  const hours = Math.floor(diffMs / 3600000);
  const days = Math.floor(diffMs / 86400000);

  if (days >= 1) return `há ${days} dia${days === 1 ? "" : "s"}`;
  if (hours >= 1) return `há ${hours}h`;
  if (minutes >= 1) return `há ${minutes}m`;
  return "agora";
}

function parseMoney(value) {
  if (!value && value !== 0) return null;
  const numeric = Number.parseFloat(
    String(value)
      .replace(/[^\d,.-]/g, "")
      .replace(",", "."),
  );
  return Number.isFinite(numeric) ? numeric : null;
}

function formatCompactMoney(value) {
  const numeric = parseMoney(value);
  if (numeric === null) return "";
  if (numeric >= 1000) {
    const compact = numeric / 1000;
    return `${Number.isInteger(compact) ? compact : compact.toFixed(1)}k`;
  }
  return new Intl.NumberFormat("pt-PT", { maximumFractionDigits: 0 }).format(numeric);
}

function formatSalary(fromValue, toValue) {
  const from = formatCompactMoney(fromValue);
  const to = formatCompactMoney(toValue);

  if (from && to && from !== to) return `${from}-${to}`;
  if (from) return from;
  if (to) return to;
  return "A combinar";
}

function getCompanyInitials(label) {
  return (
    String(label || "STP")
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part.charAt(0).toUpperCase())
      .join("") || "STP"
  );
}

function isRemoteJob(job) {
  const text = `${job.modalidade || ""} ${job.regime || ""}`.toLowerCase();
  return Boolean(job.remoto) || text.includes("remoto");
}

function isHybridJob(job) {
  const text = `${job.modalidade || ""} ${job.regime || ""} ${job.localizacao || ""}`.toLowerCase();
  return text.includes("hibrido") || text.includes("híbrido");
}

function getModalityLabel(job) {
  if (isHybridJob(job)) return "Híbrido";
  if (isRemoteJob(job)) return "Remoto";
  return "Presencial";
}

function getApplicationCount(job, fallback = 0) {
  const count = Number(
    job.applicationCount ||
      job.applicationsCount ||
      job.candidaturasCount ||
      job.totalApplications ||
      fallback,
  );
  return Number.isFinite(count) && count > 0 ? count : fallback;
}

function getExperienceBucket(job) {
  const text = `${job.nivelExperiencia || ""} ${job.experiencia || ""}`.toLowerCase();

  if (text.includes("5+") || text.includes("+5") || text.includes("sénior") || text.includes("senior")) {
    return "5+";
  }
  if (text.includes("3-5") || text.includes("3 a 5")) return "3-5";
  if (text.includes("1-3") || text.includes("1 a 3") || text.includes("júnior") || text.includes("junior")) {
    return "1-3";
  }
  if (text.includes("sem") || text.includes("entry") || text.includes("0-2") || text.includes("iniciante")) {
    return "sem";
  }
  return "";
}

function getExperienceLabel(bucket) {
  const labels = {
    sem: "Sem experiência",
    "1-3": "1-3 anos",
    "3-5": "3-5 anos",
    "5+": "5+ anos",
  };
  return labels[bucket] || bucket;
}

function getMatchPercent(job, index = 0) {
  const base = Number(job.matchPercent || job.match || 0);
  if (base > 0) return Math.min(96, Math.max(42, Math.round(base)));
  const seed = String(job.id || job.titulo || index).split("").reduce((sum, char) => sum + char.charCodeAt(0), 0);
  return 62 + (seed % 25);
}

function getCardFlag(job, index, match) {
  const closingDate = job.dataFecho ? new Date(job.dataFecho) : null;
  const daysToClose =
    closingDate && !Number.isNaN(closingDate.getTime())
      ? Math.ceil((closingDate.getTime() - Date.now()) / 86400000)
      : null;

  if (job.destaque || (daysToClose !== null && daysToClose <= 5 && daysToClose >= 0)) {
    return { label: "Urgente", variant: "urgent" };
  }
  if (match >= 82 || index % 5 === 3) {
    return { label: "Popular", variant: "popular" };
  }
  return null;
}

function getBadgeBackground(seedText) {
  const palettes = [
    "linear-gradient(135deg, #10a6c7 0%, #2bd4ea 100%)",
    "linear-gradient(135deg, #23a958 0%, #39d47d 100%)",
    "linear-gradient(135deg, #e17b00 0%, #f59e0b 100%)",
    "linear-gradient(135deg, #8758f2 0%, #bf63ff 100%)",
    "linear-gradient(135deg, #5b5eea 0%, #7c83ff 100%)",
    "linear-gradient(135deg, #d9335b 0%, #f35f7f 100%)",
  ];
  const seed = String(seedText || "STP")
    .split("")
    .reduce((sum, char) => sum + char.charCodeAt(0), 0);
  return palettes[seed % palettes.length];
}

function getJobTags(job) {
  return Array.from(
    new Set(
      [
        normalizeContractType(job.tipoContrato),
        job.categoria,
        job.nivelExperiencia,
        ...(Array.isArray(job.palavrasChave) ? job.palavrasChave : []),
        ...parseList(job.competencias || job.requisitos).slice(0, 3),
      ]
        .map((tag) => String(tag || "").trim())
        .filter(Boolean),
    ),
  ).slice(0, 4);
}

function countBy(items, predicate) {
  return items.reduce((total, item) => total + (predicate(item) ? 1 : 0), 0);
}

function JobCard({ job, index, viewMode }) {
  const companyName = job.empresaNome || job.companyName || "Empresa";
  const initials = getCompanyInitials(companyName);
  const match = getMatchPercent(job, index);
  const flag = getCardFlag(job, index, match);
  const applications = getApplicationCount(job, index === 0 ? 8 : 0);
  const tags = getJobTags(job).slice(0, 3);

  return (
    <article className={`${styles.jobCard} ${viewMode === "list" ? styles.jobCardList : ""}`}>
      <div className={styles.jobCardTop}>
        <div
          className={styles.companyBadge}
          style={{ background: getBadgeBackground(companyName) }}
        >
          {job.empresaLogo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={job.empresaLogo} alt={companyName} className={styles.companyLogo} />
          ) : (
            initials
          )}
        </div>
        <div className={styles.cardActions}>
          {flag ? (
            <span className={`${styles.cardFlag} ${styles[`cardFlag${flag.variant}`]}`}>
              {flag.variant === "urgent" ? <FiZap size={16} /> : <FiStar size={16} />}
              {flag.label}
            </span>
          ) : null}
          <button
            type="button"
            className={`${styles.favoriteButton} ${index === 0 ? styles.favoriteButtonActive : ""}`}
            aria-label="Guardar vaga"
          >
            <FiHeart size={22} />
          </button>
        </div>
      </div>

      <div>
        <Link href={`/vaga/${job.id}`} className={styles.jobTitle}>
          {job.titulo}
        </Link>
        <p className={styles.companyLine}>
          {companyName}
          {job.companyVerified ? <FiCheckCircle size={16} /> : null}
          {job.rating ? (
            <span className={styles.rating}>
              <FiStar size={15} /> {job.rating}
            </span>
          ) : null}
        </p>
      </div>

      <div className={styles.jobMeta}>
        <span>
          <FiMapPin size={17} />
          {job.localizacao || "São Tomé"} · {getModalityLabel(job)}
        </span>
        <span>
          <FiClock size={17} />
          {formatPublishedAgo(job.publicadoEm || job.publishedAt || job.createdAt)}
        </span>
        {applications > 0 ? (
          <span>
            <FiUsers size={17} />
            {applications}
          </span>
        ) : null}
      </div>

      {tags.length > 0 ? (
        <div className={styles.jobTags}>
          {tags.map((tag) => (
            <span key={tag}>{tag}</span>
          ))}
        </div>
      ) : null}

      <div className={styles.cardDivider} />

      <div className={styles.jobCardFooter}>
        <div>
          <strong className={styles.salaryValue}>{formatSalary(job.salarioDe, job.salarioAte)}</strong>
          <span className={styles.salaryUnit}>STD/mês</span>
        </div>
        <div className={styles.matchMini}>
          <span className={styles.matchMiniTrack}>
            <span style={{ width: `${match}%` }} />
          </span>
          <strong>{match}% match</strong>
        </div>
      </div>

      <Link href={`/vaga/${job.id}`} className={styles.applyCardButton}>
        Candidatar <FiArrowRight size={22} />
      </Link>
    </article>
  );
}

export default function VagasPage({ initialJobs = [] }) {
  const router = useRouter();
  const jobs = initialJobs;
  const [filteredJobs, setFilteredJobs] = useState(initialJobs);
  const [searchTerm, setSearchTerm] = useState("");
  const [filters, setFilters] = useState({
    localizacao: "",
    tipoContrato: "",
    status: "",
    categoria: "",
    modalidade: "",
    experiencia: "",
    showFeatured: false,
  });
  const [minSalary, setMinSalary] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [sortBy, setSortBy] = useState("recentes");
  const [viewMode, setViewMode] = useState("grid");

  useEffect(() => {
    setSearchTerm(typeof router.query.search === "string" ? router.query.search : "");
    setFilters((prev) => ({
      ...prev,
      categoria: typeof router.query.categoria === "string" ? router.query.categoria : "",
    }));
  }, [router.query.search, router.query.categoria]);

  useEffect(() => {
    setIsLoading(true);

    const timeoutId = setTimeout(() => {
      let result = [...jobs];
      const normalizedSearch = searchTerm.toLowerCase().trim();

      if (normalizedSearch) {
        result = result.filter((job) => matchesSearch(job, normalizedSearch));
      }

      if (filters.localizacao) {
        result = result.filter((job) => job.localizacao === filters.localizacao);
      }

      if (filters.tipoContrato) {
        result = result.filter((job) => job.tipoContrato === filters.tipoContrato);
      }

      if (filters.status) {
        result = result.filter((job) => job.status === filters.status);
      }

      if (filters.categoria) {
        result = result.filter(
          (job) =>
            String(job.categoria || "").toLowerCase() ===
            String(filters.categoria).toLowerCase(),
        );
      }

      if (filters.experiencia) {
        result = result.filter((job) => getExperienceBucket(job) === filters.experiencia);
      }

      if (filters.modalidade === "remoto") {
        result = result.filter((job) => isRemoteJob(job));
      } else if (filters.modalidade === "hibrido") {
        result = result.filter((job) => isHybridJob(job));
      } else if (filters.modalidade === "presencial") {
        result = result.filter((job) => !isRemoteJob(job) && !isHybridJob(job));
      }

      if (filters.showFeatured) {
        result = result.filter(
          (job) => job.destaque === true || job.featured === true || job.isFeatured === true,
        );
      }

      if (minSalary > 0) {
        result = result.filter((job) => {
          const salary = parseMoney(job.salarioAte) || parseMoney(job.salarioDe) || 0;
          return salary >= minSalary;
        });
      }

      if (sortBy === "recentes") {
        result.sort(compareRecentJobs);
      } else if (sortBy === "prazo") {
        result.sort((a, b) => {
          if (a.destaque && !b.destaque) return -1;
          if (!a.destaque && b.destaque) return 1;
          return new Date(a.dataFecho || "9999-12-31") - new Date(b.dataFecho || "9999-12-31");
        });
      } else if (sortBy === "salario") {
        result.sort((a, b) => {
          if (a.destaque && !b.destaque) return -1;
          if (!a.destaque && b.destaque) return 1;
          return (parseMoney(b.salarioDe) || 0) - (parseMoney(a.salarioDe) || 0);
        });
      }

      setFilteredJobs(result);
      setIsLoading(false);
    }, 180);

    return () => clearTimeout(timeoutId);
  }, [filters, jobs, minSalary, searchTerm, sortBy]);

  const localizacoes = useMemo(
    () => [...new Set(jobs.map((job) => job.localizacao).filter(Boolean))],
    [jobs],
  );
  const tiposContrato = useMemo(
    () => [...new Set(jobs.map((job) => job.tipoContrato).filter(Boolean))],
    [jobs],
  );
  const featuredJob = useMemo(
    () => jobs.find((job) => job.destaque || job.premiumOnly) || jobs[0] || null,
    [jobs],
  );
  const featuredMatch = featuredJob ? getMatchPercent(featuredJob, 0) : 80;
  const featuredTags = featuredJob ? getJobTags(featuredJob) : [];
  const featuredApplications = featuredJob ? getApplicationCount(featuredJob, 12) : 12;
  const maxSalary = useMemo(() => {
    const highest = jobs.reduce((max, job) => {
      const salary = parseMoney(job.salarioAte) || parseMoney(job.salarioDe) || 0;
      return Math.max(max, salary);
    }, 0);
    return Math.max(30000, Math.ceil(highest / 5000) * 5000 || 30000);
  }, [jobs]);
  const experienceBuckets = ["sem", "1-3", "3-5", "5+"];
  const activeFilterChips = [
    searchTerm.trim() ? { key: "search", label: searchTerm.trim() } : null,
    filters.categoria ? { key: "categoria", label: filters.categoria } : null,
    filters.tipoContrato ? { key: "tipoContrato", label: normalizeContractType(filters.tipoContrato) } : null,
    filters.modalidade ? { key: "modalidade", label: filters.modalidade === "hibrido" ? "Híbrido" : filters.modalidade } : null,
    filters.experiencia ? { key: "experiencia", label: getExperienceLabel(filters.experiencia) } : null,
    filters.localizacao ? { key: "localizacao", label: filters.localizacao } : null,
    minSalary > 0 ? { key: "minSalary", label: `+${formatCompactMoney(minSalary)} STD` } : null,
    filters.showFeatured ? { key: "showFeatured", label: "Destaque" } : null,
  ].filter(Boolean);

  const clearFilter = (key) => {
    if (key === "search") {
      setSearchTerm("");
      return;
    }
    if (key === "minSalary") {
      setMinSalary(0);
      return;
    }
    setFilters((prev) => ({
      ...prev,
      [key]: key === "showFeatured" ? false : "",
    }));
  };

  const clearFilters = () => {
    setSearchTerm("");
    setFilters({
      localizacao: "",
      tipoContrato: "",
      status: "",
      categoria: "",
      modalidade: "",
      experiencia: "",
      showFeatured: false,
    });
    setMinSalary(0);
    setSortBy("recentes");
  };

  const handleSearchSubmit = (event) => {
    event.preventDefault();
  };

  return (
    <>
      <Head>
        <title>Vagas de Emprego - EmpregoSTP</title>
        <meta
          name="description"
          content="Descubra vagas com filtros úteis, match visual e candidaturas rápidas em São Tomé e Príncipe."
        />
      </Head>

      <PublicPageShell headerVariant="light">
        <main className={styles.page}>
          {featuredJob ? (
            <section className={styles.featuredHero}>
              <div className={styles.featuredCopy}>
                <div className={styles.heroLogo}>{getCompanyInitials(featuredJob.empresaNome || featuredJob.companyName)}</div>
                <div className={styles.sponsorPill}>
                  <FiStar size={18} />
                  Patrocinada · Destaque
                </div>
                <h1>{featuredJob.titulo}</h1>
                <p className={styles.heroCompany}>
                  {featuredJob.empresaNome || featuredJob.companyName || "Empresa"}
                  {featuredJob.companyVerified ? <FiCheckCircle size={22} /> : null}
                  <span>· {featuredApplications} colaboradores</span>
                </p>
                <p className={styles.heroDescription}>
                  {featuredJob.descricao ||
                    "Constrói uma carreira com oportunidades verificadas, contexto claro e candidatura rápida na EmpregoSTP."}
                </p>

                <div className={styles.heroMeta}>
                  <span>
                    <FiMapPin />
                    {featuredJob.localizacao || "São Tomé"} · {getModalityLabel(featuredJob)}
                  </span>
                  <span>
                    <FiBriefcase />
                    {normalizeContractType(featuredJob.tipoContrato)}
                  </span>
                  <span>
                    <FiClock />
                    {formatPublishedAgo(featuredJob.publishedAt || featuredJob.createdAt)}
                  </span>
                  <span>
                    <FiUsers />
                    {featuredApplications} candidaturas
                  </span>
                </div>

                {featuredTags.length > 0 ? (
                  <div className={styles.heroTags}>
                    {featuredTags.map((tag) => (
                      <span key={tag}>{tag}</span>
                    ))}
                  </div>
                ) : null}
              </div>

              <aside className={styles.heroActionCard}>
                <div className={styles.heroMatch}>
                  <div className={styles.matchRing} style={{ "--match": `${featuredMatch}%` }}>
                    <span>{featuredMatch}%</span>
                  </div>
                  <div>
                    <strong>Match alto</strong>
                    <span>tens 4 de 5 skills</span>
                  </div>
                </div>
                <div className={styles.heroCardDivider} />
                <div className={styles.heroSalaryBlock}>
                  <span>Salário</span>
                  <strong>
                    {formatSalary(featuredJob.salarioDe, featuredJob.salarioAte)}
                    <small> STD/mês</small>
                  </strong>
                </div>
                <Link href={`/vaga/${featuredJob.id}`} className={styles.heroApplyButton}>
                  Candidatar agora <FiArrowRight size={26} />
                </Link>
                <Link href={`/vaga/${featuredJob.id}`} className={styles.heroSaveButton}>
                  <FiHeart size={24} /> Guardar vaga
                </Link>
              </aside>
            </section>
          ) : null}

          <section className={styles.discoverySection}>
            <form className={styles.filtersPanel} onSubmit={handleSearchSubmit}>
              <div className={styles.filtersTop}>
                <h2>Filtros</h2>
                <button type="button" onClick={clearFilters}>
                  Limpar
                </button>
              </div>

              {activeFilterChips.length > 0 ? (
                <div className={styles.activeFilters}>
                  {activeFilterChips.map((chip) => (
                    <button key={chip.key} type="button" onClick={() => clearFilter(chip.key)}>
                      {chip.label} <FiX size={16} />
                    </button>
                  ))}
                </div>
              ) : null}

              <div className={styles.filterSection}>
                <div className={styles.filterSectionHeader}>
                  <h3>Tipo de contrato</h3>
                  <FiChevronUp size={18} />
                </div>
                {tiposContrato.slice(0, 6).map((tipo) => (
                  <label key={tipo} className={styles.checkRow}>
                    <input
                      type="checkbox"
                      checked={filters.tipoContrato === tipo}
                      onChange={() =>
                        setFilters((prev) => ({
                          ...prev,
                          tipoContrato: prev.tipoContrato === tipo ? "" : tipo,
                        }))
                      }
                    />
                    <span>{normalizeContractType(tipo)}</span>
                    <strong>{countBy(jobs, (job) => job.tipoContrato === tipo)}</strong>
                  </label>
                ))}
              </div>

              <div className={styles.filterSection}>
                <div className={styles.filterSectionHeader}>
                  <h3>Modalidade</h3>
                  <FiChevronUp size={18} />
                </div>
                {[
                  ["presencial", "Presencial", countBy(jobs, (job) => !isRemoteJob(job) && !isHybridJob(job))],
                  ["hibrido", "Híbrido", countBy(jobs, isHybridJob)],
                  ["remoto", "Remoto", countBy(jobs, isRemoteJob)],
                ].map(([value, label, count]) => (
                  <label key={value} className={styles.checkRow}>
                    <input
                      type="checkbox"
                      checked={filters.modalidade === value}
                      onChange={() =>
                        setFilters((prev) => ({
                          ...prev,
                          modalidade: prev.modalidade === value ? "" : value,
                        }))
                      }
                    />
                    <span>{label}</span>
                    <strong>{count}</strong>
                  </label>
                ))}
              </div>

              <div className={styles.filterSection}>
                <div className={styles.filterSectionHeader}>
                  <h3>Localização</h3>
                  <FiChevronUp size={18} />
                </div>
                {localizacoes.slice(0, 6).map((localizacao) => (
                  <label key={localizacao} className={styles.checkRow}>
                    <input
                      type="checkbox"
                      checked={filters.localizacao === localizacao}
                      onChange={() =>
                        setFilters((prev) => ({
                          ...prev,
                          localizacao: prev.localizacao === localizacao ? "" : localizacao,
                        }))
                      }
                    />
                    <span>{localizacao}</span>
                    <strong>{countBy(jobs, (job) => job.localizacao === localizacao)}</strong>
                  </label>
                ))}
              </div>

              <div className={styles.filterSection}>
                <div className={styles.filterSectionHeader}>
                  <h3>Experiência</h3>
                  <FiChevronUp size={18} />
                </div>
                {experienceBuckets.map((bucket) => (
                  <label key={bucket} className={styles.checkRow}>
                    <input
                      type="checkbox"
                      checked={filters.experiencia === bucket}
                      onChange={() =>
                        setFilters((prev) => ({
                          ...prev,
                          experiencia: prev.experiencia === bucket ? "" : bucket,
                        }))
                      }
                    />
                    <span>{getExperienceLabel(bucket)}</span>
                    <strong>{countBy(jobs, (job) => getExperienceBucket(job) === bucket)}</strong>
                  </label>
                ))}
              </div>

              <div className={styles.filterSection}>
                <div className={styles.filterSectionHeader}>
                  <h3>Salário mínimo</h3>
                </div>
                <input
                  className={styles.salaryRange}
                  type="range"
                  min="0"
                  max={maxSalary}
                  step="1000"
                  value={minSalary}
                  onChange={(event) => setMinSalary(Number(event.target.value))}
                  aria-label="Salário mínimo"
                />
                <div className={styles.salaryRangeLabels}>
                  <span>0</span>
                  <strong>{formatCompactMoney(minSalary || maxSalary)} STD</strong>
                </div>
              </div>

              <div className={styles.alertCard}>
                <span className={styles.alertIcon}>
                  <FiBell size={26} />
                </span>
                <strong>Cria um alerta</strong>
                <p>Avisamos-te por email assim que surgir uma vaga com estes filtros.</p>
                <button type="button">Ativar alerta</button>
              </div>
            </form>

            <div className={styles.resultsPanel}>
              <div className={styles.resultsHeader}>
                <h2>
                  {filteredJobs.length} vaga{filteredJobs.length === 1 ? "" : "s"} ·{" "}
                  <span>filtradas para ti</span>
                </h2>
                <div className={styles.resultsTools}>
                  <select value={sortBy} onChange={(event) => setSortBy(event.target.value)}>
                    <option value="recentes">Mais recentes</option>
                    <option value="prazo">Prazo</option>
                    <option value="salario">Maior salário</option>
                  </select>
                  <div className={styles.viewToggle}>
                    <button
                      type="button"
                      className={viewMode === "grid" ? styles.viewActive : ""}
                      onClick={() => setViewMode("grid")}
                      aria-label="Ver em grelha"
                    >
                      <FiGrid size={22} />
                    </button>
                    <button
                      type="button"
                      className={viewMode === "list" ? styles.viewActive : ""}
                      onClick={() => setViewMode("list")}
                      aria-label="Ver em lista"
                    >
                      <FiList size={24} />
                    </button>
                  </div>
                </div>
              </div>

              {isLoading ? (
                <div className={styles.loadingState}>
                  <div className={styles.loadingSpinner} />
                  <p>Atualizando resultados...</p>
                </div>
              ) : filteredJobs.length === 0 ? (
                <div className={styles.emptyState}>
                  <h3>Nenhuma vaga combina com os filtros atuais</h3>
                  <p>Limpe os filtros ou experimente outra combinação para ampliar os resultados.</p>
                  <button type="button" onClick={clearFilters}>
                    Limpar filtros
                  </button>
                </div>
              ) : (
                <div className={`${styles.jobsGrid} ${viewMode === "list" ? styles.jobsGridList : ""}`}>
                  {filteredJobs.map((job, index) => (
                    <JobCard key={job.id} job={job} index={index} viewMode={viewMode} />
                  ))}
                </div>
              )}
            </div>
          </section>
        </main>
      </PublicPageShell>
    </>
  );
}

export async function getServerSideProps(context) {
  try {
    const { admin } = await import("../../lib/firebaseAdmin");
    const { getEmpresaPlanSummary } =
      await import("../../lib/empresaPlanFeatures");
    const { getEffectiveJobStatus, syncExpiredJobStatus } =
      await import("../../lib/jobExpiration");

    context?.res?.setHeader?.(
      "Cache-Control",
      "public, s-maxage=30, stale-while-revalidate=120",
    );

    const serializeTimestamp = (timestamp) => {
      if (!timestamp) return null;
      if (timestamp.toDate) return timestamp.toDate().toISOString();
      if (timestamp.toMillis) return new Date(timestamp.toMillis()).toISOString();
      if (typeof timestamp === "string") return timestamp;
      if (timestamp instanceof Date) return timestamp.toISOString();
      return null;
    };

    const serializeJob = (job) => ({
      id: job.id,
      ...Object.keys(job).reduce((acc, key) => {
        const value = job[key];
        if (value && (value.toDate || value.toMillis)) {
          acc[key] = serializeTimestamp(value);
        } else if (
          value &&
          typeof value === "object" &&
          !Array.isArray(value) &&
          value.constructor === Object
        ) {
          acc[key] = Object.keys(value).reduce((nestedAcc, nestedKey) => {
            const nestedValue = value[nestedKey];
            nestedAcc[nestedKey] =
              nestedValue && (nestedValue.toDate || nestedValue.toMillis)
                ? serializeTimestamp(nestedValue)
                : nestedValue;
            return nestedAcc;
          }, {});
        } else {
          acc[key] = value;
        }
        return acc;
      }, {}),
    });

    const snapshot = await admin
      .firestore()
      .collection("jobs")
      .orderBy("createdAt", "desc")
      .get();

    const normalizedDocs = await Promise.all(
      snapshot.docs.map(async (doc) => {
        const synced = await syncExpiredJobStatus(doc.ref, doc.data(), admin);
        return {
          id: doc.id,
          ...synced.jobData,
          status: getEffectiveJobStatus(synced.jobData),
        };
      }),
    );

    const companyIds = [
      ...new Set(normalizedDocs.map((job) => job.companyId).filter(Boolean)),
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
        name: companyData.name || companyData.fullName || "Empresa",
        logo: planSummary.features?.logoOnJob ? companyData.logo || "" : "",
        verified: Boolean(planSummary.features?.companyVerified),
      });
    });

    const jobs = normalizedDocs
      .map((job) => {
        const company = companiesById.get(job.companyId) || {};
        return serializeJob({
          ...job,
          empresaNome:
            company.name || job.empresaNome || job.companyName || "Empresa",
          companyName:
            company.name || job.companyName || job.empresaNome || "Empresa",
          empresaLogo: company.logo || job.empresaLogo || "",
          companyVerified: company.verified || job.companyVerified || false,
        });
      })
      .sort(compareRecentJobs);

    return {
      props: { initialJobs: jobs },
    };
  } catch (error) {
    console.error("Erro ao buscar vagas:", error);
    return {
      props: { initialJobs: [] },
    };
  }
}
