import React, { useState, useEffect } from "react";
import Head from "next/head";
import { useRouter } from "next/router";
import PublicPageShell from "../../components/PublicPageShell";
import CompactJobCard from "../../components/home/CompactJobCard";
import styles from "../../styles/VagasPage.module.css";

function normalizeSearchValue(value) {
  if (Array.isArray(value)) {
    return value.join(" ");
  }
  return String(value || "");
}

function matchesSearch(job, term) {
  const haystack = [
    job.titulo,
    job.descricao,
    job.localizacao,
    job.categoria,
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
  return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
}

function getCardBadgeLabel(vaga) {
  if (vaga.remoto) return "REMOTO";

  const normalized = String(vaga.tipoContrato || "").toLowerCase();
  const labels = {
    "tempo integral": "FULL-TIME",
    "full-time": "FULL-TIME",
    "meio período": "PART-TIME",
    "meio periodo": "PART-TIME",
    "part-time": "PART-TIME",
    estágio: "ESTÁGIO",
    estagio: "ESTÁGIO",
    internship: "ESTÁGIO",
    contrato: "CONTRATO",
    contract: "CONTRATO",
    freelance: "FREELANCE",
    voluntariado: "VOLUNTARIADO",
  };

  return labels[normalized] || "VAGA";
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

function formatCardSalary(fromValue, toValue) {
  const normalizeMoney = (value) => {
    if (!value && value !== 0) return "";

    const numeric = Number.parseFloat(
      String(value)
        .replace(/[^\d,.-]/g, "")
        .replace(",", "."),
    );

    if (!Number.isFinite(numeric)) return "";

    return new Intl.NumberFormat("en-US", {
      maximumFractionDigits: 0,
    }).format(numeric);
  };

  const from = normalizeMoney(fromValue);
  const to = normalizeMoney(toValue);

  if (from && to && from !== to) return `${from} - ${to} STN`;
  if (from) return `${from} STN`;
  if (to) return `${to} STN`;
  return "A combinar";
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
    showFeatured: false,
    showRemote: false,
  });
  const [isLoading, setIsLoading] = useState(false);
  const [sortBy, setSortBy] = useState("recentes");

  useEffect(() => {
    setSearchTerm(
      typeof router.query.search === "string" ? router.query.search : "",
    );
    setFilters((prev) => ({
      ...prev,
      categoria:
        typeof router.query.categoria === "string"
          ? router.query.categoria
          : "",
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
        result = result.filter(
          (job) => job.localizacao === filters.localizacao,
        );
      }

      if (filters.tipoContrato) {
        result = result.filter(
          (job) => job.tipoContrato === filters.tipoContrato,
        );
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

      if (filters.showFeatured) {
        result = result.filter(
          (job) =>
            job.destaque === true ||
            job.featured === true ||
            job.isFeatured === true,
        );
      }

      if (filters.showRemote) {
        result = result.filter((job) => job.remoto === true);
      }

      if (sortBy === "recentes") {
        result.sort(compareRecentJobs);
      } else if (sortBy === "prazo") {
        result.sort((a, b) => {
          if (a.destaque && !b.destaque) return -1;
          if (!a.destaque && b.destaque) return 1;
          return (
            new Date(a.dataFecho || "9999-12-31") -
            new Date(b.dataFecho || "9999-12-31")
          );
        });
      } else if (sortBy === "salario") {
        result.sort((a, b) => {
          if (a.destaque && !b.destaque) return -1;
          if (!a.destaque && b.destaque) return 1;
          return (Number(b.salarioDe) || 0) - (Number(a.salarioDe) || 0);
        });
      }

      setFilteredJobs(result);
      setIsLoading(false);
    }, 220);

    return () => clearTimeout(timeoutId);
  }, [filters, jobs, searchTerm, sortBy]);

  const localizacoes = [
    ...new Set(jobs.map((job) => job.localizacao).filter(Boolean)),
  ];
  const tiposContrato = [
    ...new Set(jobs.map((job) => job.tipoContrato).filter(Boolean)),
  ];
  const categorias = [
    ...new Set(jobs.map((job) => job.categoria).filter(Boolean)),
  ];

  const activeFilterChips = [
    searchTerm.trim() ? `Busca: ${searchTerm.trim()}` : null,
    filters.localizacao ? `Localização: ${filters.localizacao}` : null,
    filters.tipoContrato ? `Contrato: ${filters.tipoContrato}` : null,
    filters.status ? `Status: ${filters.status}` : null,
    filters.categoria ? `Categoria: ${filters.categoria}` : null,
    filters.showFeatured ? "Somente destaques" : null,
    filters.showRemote ? "Somente remotas" : null,
  ].filter(Boolean);
  const hasActiveFilters = activeFilterChips.length > 0;

  const sortLabel =
    {
      recentes: "Mais recentes",
      prazo: "Prazo de candidatura",
      salario: "Maior salário",
    }[sortBy] || "Mais recentes";
  const handleSearchSubmit = (event) => {
    event.preventDefault();
  };

  const handleFilterChange = (event) => {
    const { name, value } = event.target;
    setFilters((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const clearFilters = () => {
    setSearchTerm("");
    setFilters({
      localizacao: "",
      tipoContrato: "",
      status: "",
      categoria: "",
      showFeatured: false,
      showRemote: false,
    });
    setSortBy("recentes");
  };

  return (
    <>
      <Head>
        <title>Vagas de Emprego - EmpregoSTP</title>
        <meta
          name="description"
          content="Descubra vagas com melhor contexto, filtros úteis e candidaturas mais rápidas em São Tomé e Príncipe."
        />
      </Head>

      <PublicPageShell headerVariant="light">
        <main className={styles.page}>
          <section className={styles.discoverySection}>
            <form className={styles.filtersPanel} onSubmit={handleSearchSubmit}>
              <div className={styles.sidebarHeader}>
                <div>
                  <p className={styles.sidebarEyebrow}>Refinar pesquisa</p>
                  <h2 className={styles.sidebarTitle}>Filtros da vitrine</h2>
                  <p className={styles.sidebarSummary}>
                    {hasActiveFilters
                      ? `${activeFilterChips.length} filtro${activeFilterChips.length > 1 ? "s" : ""} ativo${activeFilterChips.length > 1 ? "s" : ""}`
                      : "Use os filtros para cortar ruído e chegar mais rápido à vaga certa."}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={clearFilters}
                  className={styles.clearButton}
                >
                  Limpar
                </button>
              </div>

              <div className={styles.searchGroup}>
                <label className={styles.filterLabel}>Pesquisar vagas</label>
                <div className={styles.searchField}>
                  <svg
                    className={styles.searchIcon}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                    />
                  </svg>
                  <input
                    type="text"
                    placeholder="Título, skills, descrição ou localização"
                    aria-label="Pesquisar vagas"
                    value={searchTerm}
                    onChange={(event) => setSearchTerm(event.target.value)}
                    className={styles.searchInput}
                  />
                </div>
              </div>

              <div className={styles.filterGrid}>
                <div className={styles.filterGroup}>
                  <label className={styles.filterLabel}>Categoria</label>
                  <select
                    name="categoria"
                    value={filters.categoria}
                    onChange={handleFilterChange}
                    className={styles.filterControl}
                  >
                    <option value="">Todas</option>
                    {categorias.map((categoria) => (
                      <option key={categoria} value={categoria}>
                        {categoria}
                      </option>
                    ))}
                  </select>
                </div>

                <div className={styles.filterGroup}>
                  <label className={styles.filterLabel}>Localização</label>
                  <select
                    name="localizacao"
                    value={filters.localizacao}
                    onChange={handleFilterChange}
                    className={styles.filterControl}
                  >
                    <option value="">Todas</option>
                    {localizacoes.map((loc) => (
                      <option key={loc} value={loc}>
                        {loc}
                      </option>
                    ))}
                  </select>
                </div>

                <div className={styles.filterGroup}>
                  <label className={styles.filterLabel}>Contrato</label>
                  <select
                    name="tipoContrato"
                    value={filters.tipoContrato}
                    onChange={handleFilterChange}
                    className={styles.filterControl}
                  >
                    <option value="">Todos</option>
                    {tiposContrato.map((tipo) => (
                      <option key={tipo} value={tipo}>
                        {tipo}
                      </option>
                    ))}
                  </select>
                </div>

                <div className={styles.filterGroup}>
                  <label className={styles.filterLabel}>Estado</label>
                  <select
                    name="status"
                    value={filters.status}
                    onChange={handleFilterChange}
                    className={styles.filterControl}
                  >
                    <option value="">Todos</option>
                    <option value="active">Aberta</option>
                    <option value="closed">Fechada</option>
                    <option value="disabled">Desativada</option>
                  </select>
                </div>
              </div>

              <div className={styles.quickToggles}>
                <label
                  className={`${styles.toggleChip} ${filters.showFeatured ? styles.toggleChipActive : ""}`}
                >
                  <input
                    type="checkbox"
                    name="showFeatured"
                    checked={filters.showFeatured}
                    onChange={(event) => {
                      setFilters((prev) => ({
                        ...prev,
                        showFeatured: event.target.checked,
                      }));
                    }}
                    className={styles.toggleInput}
                  />
                  <span>Somente destaque</span>
                </label>

                <label
                  className={`${styles.toggleChip} ${filters.showRemote ? styles.toggleChipActive : ""}`}
                >
                  <input
                    type="checkbox"
                    name="showRemote"
                    checked={filters.showRemote}
                    onChange={(event) => {
                      setFilters((prev) => ({
                        ...prev,
                        showRemote: event.target.checked,
                      }));
                    }}
                    className={styles.toggleInput}
                  />
                  <span>Somente remotas</span>
                </label>
              </div>
            </form>

            <div className={styles.resultsPanel}>
              <div className={styles.resultsHeader}>
                <div>
                  <p className={styles.resultsEyebrow}>
                    Resultados encontrados
                  </p>
                  <h2 className={styles.resultsTitle}>
                    {filteredJobs.length}{" "}
                    {filteredJobs.length === 1
                      ? "vaga encontrada"
                      : "vagas encontradas"}
                  </h2>
                  <p className={styles.resultsMeta}>
                    Ordenação atual: {sortLabel}
                  </p>
                </div>

                <div className={styles.resultsActions}>
                  <div className={styles.sortGroup}>
                    <label className={styles.filterLabel}>Ordenar por</label>
                    <select
                      value={sortBy}
                      onChange={(event) => setSortBy(event.target.value)}
                      className={styles.sortControl}
                    >
                      <option value="recentes">Mais recentes</option>
                      <option value="prazo">Prazo de candidatura</option>
                      <option value="salario">Maior salário</option>
                    </select>
                  </div>
                </div>
              </div>

              {activeFilterChips.length > 0 ? (
                <div className={styles.activeFilters}>
                  {activeFilterChips.map((chip) => (
                    <span key={chip} className={styles.filterChip}>
                      {chip}
                    </span>
                  ))}
                </div>
              ) : null}

              {isLoading ? (
                <div className={styles.loadingState}>
                  <div className={styles.loadingSpinner}></div>
                  <p className={styles.loadingText}>
                    Atualizando resultados...
                  </p>
                </div>
              ) : filteredJobs.length === 0 ? (
                <div className={styles.emptyState}>
                  <svg
                    className={styles.emptyIcon}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="1.5"
                      d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                  <h3 className={styles.emptyTitle}>
                    Nenhuma vaga combina com os filtros atuais
                  </h3>
                  <p className={styles.emptyText}>
                    Limpe os filtros ou experimente outra combinação de
                    categoria, localização e modalidade para ampliar os
                    resultados.
                  </p>
                  <button onClick={clearFilters} className={styles.emptyButton}>
                    Limpar filtros
                  </button>
                </div>
              ) : (
                <div className={styles.jobsList}>
                  {filteredJobs.map((vaga) => (
                    <CompactJobCard
                      key={vaga.id}
                      href={`/vaga/${vaga.id}`}
                      variant="light"
                      title={vaga.titulo}
                      badgeLabel={getCardBadgeLabel(vaga)}
                      status={vaga.status}
                      salary={formatCardSalary(vaga.salarioDe, vaga.salarioAte)}
                      companyName={
                        vaga.empresaNome || vaga.companyName || "Empresa"
                      }
                      companyLogo={vaga.empresaLogo}
                      imageAlt={
                        vaga.empresaNome || vaga.companyName || "Empresa"
                      }
                      metaItems={[
                        {
                          icon: "fas fa-location-dot",
                          text: vaga.localizacao || "Local não informado",
                        },
                        {
                          icon: "fas fa-briefcase",
                          text: normalizeContractType(vaga.tipoContrato),
                        },
                        {
                          icon: "fas fa-clock",
                          text: formatPublishedAgo(
                            vaga.publicadoEm || vaga.createdAt,
                          ),
                        },
                      ]}
                    />
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
      if (timestamp.toMillis)
        return new Date(timestamp.toMillis()).toISOString();
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
