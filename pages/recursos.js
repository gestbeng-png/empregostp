import Head from "next/head";
import { useMemo, useState } from "react";
import Link from "next/link";
import PublicPageShell from "../components/PublicPageShell";
import { admin } from "../lib/firebaseAdmin";
import { resolveProfessionalResourceAccess } from "../lib/resourcePremiumAccess";
import pageStyles from "../styles/RecursosPage.module.css";
import {
  DEFAULT_GUIDES,
  DEFAULT_TEMPLATES,
  DEFAULT_TOOLS,
  RESOURCE_AUDIENCE,
  normalizeAudience,
  resolveGuideContentId,
  slugifyFilename,
} from "../lib/resourcesCatalog";

const icons = {
  document: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
      <path d="M14 2v6h6M16 13H8M16 17H8M10 9H8" />
    </svg>
  ),
  download: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" y1="15" x2="12" y2="3" />
    </svg>
  ),
  book: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M4 19.5A2.5 2.5 0 016.5 17H20" />
      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z" />
    </svg>
  ),
  scale: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M12 2v20M2 12l4-4 4 4M14 12l4-4 4 4" />
      <path d="M2 20h4M18 20h4" />
    </svg>
  ),
  help: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="10" />
      <path d="M9.09 9a3 3 0 015.83 1c0 2-3 3-3 3" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  ),
  calculator: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="4" y="2" width="16" height="20" rx="2" />
      <line x1="8" y1="6" x2="16" y2="6" />
      <line x1="8" y1="10" x2="8.01" y2="10" />
      <line x1="12" y1="10" x2="12.01" y2="10" />
      <line x1="16" y1="10" x2="16.01" y2="10" />
      <line x1="8" y1="14" x2="8.01" y2="14" />
      <line x1="12" y1="14" x2="12.01" y2="14" />
      <line x1="16" y1="14" x2="16.01" y2="14" />
      <line x1="8" y1="18" x2="8.01" y2="18" />
      <line x1="12" y1="18" x2="12.01" y2="18" />
      <line x1="16" y1="18" x2="16.01" y2="18" />
    </svg>
  ),
  link: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71" />
      <path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71" />
    </svg>
  ),
  play: (
    <svg viewBox="0 0 24 24" fill="currentColor" stroke="none">
      <polygon points="5 3 19 12 5 21 5 3" />
    </svg>
  ),
  search: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="11" cy="11" r="8" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  ),
  chevronRight: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <polyline points="9 18 15 12 9 6" />
    </svg>
  ),
  chevronDown: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <polyline points="6 9 12 15 18 9" />
    </svg>
  ),
  mail: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
      <polyline points="22 6 12 13 2 6" />
    </svg>
  ),
  phone: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72 12.84 12.84 0 00.7 2.81 2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45 12.84 12.84 0 002.81.7A2 2 0 0122 16.92z" />
    </svg>
  ),
  file: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M13 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V9z" />
      <polyline points="13 2 13 9 20 9" />
    </svg>
  ),
  clock: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  ),
  folder: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z" />
    </svg>
  ),
};

const normalizeCategory = (category) => {
  return category ? category.trim() : "Outros";
};

const serializeDoc = (doc) => {
  const data = doc.data();
  return {
    id: doc.id,
    ...data,
    createdAt: data.createdAt?.toDate?.()?.toISOString() || null,
    updatedAt: data.updatedAt?.toDate?.()?.toISOString() || null,
  };
};

const fetchCollection = async (collectionName, limit = 6) => {
  const query = admin
    .firestore()
    .collection(collectionName)
    .orderBy("createdAt", "desc")
    .limit(limit);
  const snapshot = await query.get();
  return snapshot.docs.map(serializeDoc);
};

const FAQS = [
  {
    id: "faq1",
    question: "Como me candidatar a uma vaga no EmpregoSTP?",
    answer:
      'Crie uma conta gratuita, complete seu perfil e CV, navegue pelas vagas disponiveis e clique em "Candidatar-me" nas oportunidades que lhe interessam. O empregador recebera sua candidatura automaticamente.',
  },
  {
    id: "faq2",
    question: "Quanto custa usar a plataforma?",
    answer:
      "Para candidatos, a plataforma e 100% gratuita. Voce pode criar perfil, candidatar-se a vagas e usar recursos basicos sem qualquer custo. Oferecemos planos premium com recursos adicionais para quem deseja mais visibilidade.",
  },
  {
    id: "faq3",
    question: "Como sei se minha candidatura foi vista?",
    answer:
      "No seu dashboard, voce pode acompanhar o status de todas as suas candidaturas. Quando um empregador visualiza seu perfil ou altera o status, voce recebe uma notificacao automatica.",
  },
  {
    id: "faq4",
    question: "Posso editar minha candidatura depois de enviar?",
    answer:
      "Voce pode atualizar seu CV e perfil a qualquer momento. As alteracoes ficam disponiveis para todos os empregadores. No entanto, mensagens enviadas junto com candidaturas nao podem ser editadas.",
  },
  {
    id: "faq5",
    question: "Como funciona a verificacao de perfil?",
    answer:
      "A verificacao confirma sua identidade e aumenta sua credibilidade. Voce pode verificar seu email, telefone e documentos. Perfis verificados tem ate 3x mais visualizacoes de empregadores.",
  },
  {
    id: "faq6",
    question: "Quanto tempo as vagas ficam ativas?",
    answer:
      "As vagas ficam ativas por 30 dias por padrao, mas os empregadores podem estender ou encerrar antes. Recomendamos candidatar-se o mais rapido possivel as oportunidades interessantes.",
  },
];

const LINKS = [
  {
    id: "l1",
    title: "Ministerio do Trabalho STP",
    description:
      "Portal oficial com informacoes sobre legislacao e servicos publicos.",
    url: "https://governo.st",
    category: "Governo",
  },
  {
    id: "l2",
    title: "Camara de Comercio STP",
    description:
      "Informacoes sobre empresas, negocios e oportunidades comerciais.",
    url: "https://ccistp.st",
    category: "Negocios",
  },
  {
    id: "l3",
    title: "Instituto de Seguranca Social",
    description: "Informacoes sobre contribuicoes, beneficios e pensoes.",
    url: "https://inss.st",
    category: "Governo",
  },
];

const AUDIENCE_FILTERS = [
  { id: RESOURCE_AUDIENCE.all, label: "Todos" },
  { id: RESOURCE_AUDIENCE.candidato, label: "Candidatos" },
  { id: RESOURCE_AUDIENCE.empresa, label: "Empresas" },
];

const DEFAULT_TEMPLATE_CATEGORIES = ["CV", "Carta", "Contrato", "Freelancer"];

const inferAudienceByContent = (item, fallback = RESOURCE_AUDIENCE.all) => {
  const category = String(item?.category || "").toLowerCase();
  const title = String(item?.title || "").toLowerCase();
  if (
    category.includes("contrato") ||
    category.includes("freelancer") ||
    title.includes("empresa")
  ) {
    return RESOURCE_AUDIENCE.empresa;
  }
  if (
    category.includes("cv") ||
    category.includes("carta") ||
    title.includes("candidato")
  ) {
    return RESOURCE_AUDIENCE.candidato;
  }
  return fallback;
};

const normalizeLinkValue = (value) => {
  const current = String(value || "").trim();
  if (!current || current === "#") {
    return null;
  }
  return current;
};

const normalizeBoolean = (value, fallback = false) => {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (normalized === "true" || normalized === "1" || normalized === "sim")
      return true;
    if (
      normalized === "false" ||
      normalized === "0" ||
      normalized === "nao" ||
      normalized === "não"
    )
      return false;
  }
  return fallback;
};

const isRemovedTool = (tool) => {
  const id = String(tool?.id || "")
    .trim()
    .toLowerCase();
  // Mantemos apenas o filtro de itens antigos/duplicados do Firestore.
  // O Criador de CV /recursos/gerador-cv deve aparecer nesta rota.
  return id === "tool2" || id === "tool-cv";
};

const getResourceKey = (item, index = 0) => {
  const titleKey = slugifyFilename(
    item?.title || item?.name || item?.question || "",
  );
  if (titleKey) {
    return titleKey;
  }
  const idKey = slugifyFilename(item?.id || "");
  if (idKey) {
    return idKey;
  }
  return `resource-${index}`;
};

const mergeResourceList = (defaults = [], fromDb = []) => {
  const merged = new Map();
  defaults.forEach((item, index) => {
    merged.set(getResourceKey(item, index), { ...item });
  });

  fromDb.forEach((item, index) => {
    const key = getResourceKey(item, index + 200);
    const previous = merged.get(key) || {};
    const next = { ...previous, ...item };

    if (normalizeLinkValue(item?.link) === null && previous?.link) {
      next.link = previous.link;
    }
    if (normalizeLinkValue(item?.url) === null && previous?.url) {
      next.url = previous.url;
    }
    if (normalizeLinkValue(item?.fileUrl) === null && previous?.fileUrl) {
      next.fileUrl = previous.fileUrl;
    }

    merged.set(key, next);
  });

  return Array.from(merged.values());
};

export default function RecursosPage({
  templates = [],
  guides = [],
  tools = [],
  faqs = [],
  userAudience = RESOURCE_AUDIENCE.all,
  professionalAccess = {},
}) {
  const [activeCategory, setActiveCategory] = useState("todos");
  const [activeAudience, setActiveAudience] = useState(
    normalizeAudience(userAudience),
  );
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedFaq, setExpandedFaq] = useState(null);
  const hasProfessionalAccess = Boolean(professionalAccess?.allowed);
  const premiumCtaUrl = professionalAccess?.ctaUrl || "/premium/candidatos";

  const normalizedTemplates = useMemo(() => {
    return (templates || []).map((template) => ({
      ...template,
      category: normalizeCategory(template.category),
      audience: normalizeAudience(
        template.audience,
        inferAudienceByContent(template, RESOURCE_AUDIENCE.all),
      ),
      downloadUrl:
        normalizeLinkValue(template.fileUrl) ||
        normalizeLinkValue(template.url),
    }));
  }, [templates]);

  const normalizedGuides = useMemo(() => {
    return (guides || []).map((guide) => ({
      ...guide,
      audience: normalizeAudience(
        guide.audience,
        inferAudienceByContent(guide, RESOURCE_AUDIENCE.all),
      ),
      readUrl:
        (String(guide.content || "").trim() || resolveGuideContentId(guide)) &&
        guide.id
          ? `/recursos/guia/${encodeURIComponent(guide.id)}`
          : null,
      downloadUrl:
        normalizeLinkValue(guide.fileUrl) ||
        normalizeLinkValue(guide.url) ||
        (resolveGuideContentId(guide)
          ? `/api/resources/download?kind=guide&id=${encodeURIComponent(resolveGuideContentId(guide))}&title=${encodeURIComponent(
              guide.title || "guia",
            )}`
          : null),
    }));
  }, [guides]);

  const normalizedTools = useMemo(() => {
    return (tools || [])
      .filter((tool) => !isRemovedTool(tool))
      .map((tool) => ({
        ...tool,
        audience: normalizeAudience(tool.audience, RESOURCE_AUDIENCE.all),
        requiresProfessional: normalizeBoolean(
          tool.requiresProfessional,
          false,
        ),
        actionUrl:
          normalizeLinkValue(tool.url) || normalizeLinkValue(tool.link),
      }));
  }, [tools]);

  const categories = useMemo(() => {
    const templatePool = normalizedTemplates.filter((template) => {
      return (
        activeAudience === RESOURCE_AUDIENCE.all ||
        template.audience === RESOURCE_AUDIENCE.all ||
        template.audience === activeAudience
      );
    });
    const uniqueCategories = new Set(
      templatePool.map((template) => template.category || "Outros"),
    );
    const extras = Array.from(uniqueCategories).filter(
      (cat) => cat && !DEFAULT_TEMPLATE_CATEGORIES.includes(cat),
    );
    return [
      { id: "todos", label: "Todos" },
      ...DEFAULT_TEMPLATE_CATEGORIES.map((label) => ({ id: label, label })),
      ...extras.map((label) => ({ id: label, label })),
    ];
  }, [normalizedTemplates, activeAudience]);

  const filteredTemplates = useMemo(() => {
    const base = normalizedTemplates.filter((template) => {
      const categoryMatch =
        activeCategory === "todos" || template.category === activeCategory;
      const audienceMatch =
        activeAudience === RESOURCE_AUDIENCE.all ||
        template.audience === RESOURCE_AUDIENCE.all ||
        template.audience === activeAudience;
      return categoryMatch && audienceMatch;
    });

    const query = (searchQuery || "").trim().toLowerCase();
    if (!query) return base;

    return base.filter((template) => {
      const title = (template.title || "").toLowerCase();
      const description = (template.description || "").toLowerCase();
      const category = (template.category || "").toLowerCase();
      return (
        title.includes(query) ||
        description.includes(query) ||
        category.includes(query)
      );
    });
  }, [normalizedTemplates, activeCategory, activeAudience, searchQuery]);

  const displayedTemplates = filteredTemplates.slice(0, 8);
  const guidesToShow = useMemo(() => {
    const base = normalizedGuides.filter((guide) => {
      const audienceMatch =
        activeAudience === RESOURCE_AUDIENCE.all ||
        guide.audience === RESOURCE_AUDIENCE.all ||
        guide.audience === activeAudience;
      return audienceMatch;
    });

    const query = (searchQuery || "").trim().toLowerCase();
    if (!query) return base.slice(0, 4);

    return base
      .filter((guide) => {
        const title = (guide.title || "").toLowerCase();
        const description = (guide.description || "").toLowerCase();
        const category = (guide.category || "").toLowerCase();
        return (
          title.includes(query) ||
          description.includes(query) ||
          category.includes(query)
        );
      })
      .slice(0, 4);
  }, [normalizedGuides, activeAudience, searchQuery]);

  const toolsToShow = useMemo(() => {
    const base = normalizedTools.filter((tool) => {
      const audienceMatch =
        activeAudience === RESOURCE_AUDIENCE.all ||
        tool.audience === RESOURCE_AUDIENCE.all ||
        tool.audience === activeAudience;
      return audienceMatch;
    });

    const query = (searchQuery || "").trim().toLowerCase();
    if (!query) return base.slice(0, 4);

    return base
      .filter((tool) => {
        const title = (tool.title || "").toLowerCase();
        const description = (tool.description || "").toLowerCase();
        return title.includes(query) || description.includes(query);
      })
      .slice(0, 4);
  }, [normalizedTools, activeAudience, searchQuery]);

  const faqItems = faqs.length ? faqs : FAQS;

  return (
    <>
      <Head>
        <title>
          Recursos Gratuitos | EmpregoSTP - Templates, Guias e Ferramentas
        </title>
        <meta
          name="description"
          content="Recursos gratuitos para sua carreira: modelos de CV, guias de entrevista, ferramentas uteis e respostas para suas duvidas sobre emprego em Sao Tome e Principe."
        />
      </Head>

      <PublicPageShell>
        <div className={pageStyles.page}>
          {/* Hero */}
          <section className={pageStyles.hero}>
            <div className={pageStyles.heroGlowPrimary} />
            <div className={pageStyles.heroGlowSecondary} />

            <div className={pageStyles.container}>
              <div className={pageStyles.heroContent}>
                <div className={pageStyles.badge}>
                  <span className={pageStyles.badgeIcon}>{icons.folder}</span>
                  <span className={pageStyles.badgeText}>
                    Centro de Recursos
                  </span>
                </div>

                <h1 className={pageStyles.title}>
                  Recursos Gratuitos para sua Carreira
                </h1>
                <p className={pageStyles.subtitle}>
                  Templates de CV, guias praticos, ferramentas uteis e tudo que
                  voce precisa para se preparar e conquistar sua proxima
                  oportunidade.
                </p>

                <div className={pageStyles.searchBar}>
                  <span className={pageStyles.searchIcon}>{icons.search}</span>
                  <input
                    type="text"
                    placeholder="Pesquisar recursos..."
                    aria-label="Pesquisar recursos"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className={pageStyles.searchInput}
                  />
                </div>

                <div className={pageStyles.audienceFilters}>
                  {AUDIENCE_FILTERS.map((audience) => (
                    <button
                      key={audience.id}
                      type="button"
                      onClick={() => setActiveAudience(audience.id)}
                      className={[
                        pageStyles.audienceButton,
                        activeAudience === audience.id
                          ? pageStyles.audienceButtonActive
                          : "",
                      ]
                        .filter(Boolean)
                        .join(" ")}
                    >
                      {audience.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </section>

          {/* Templates */}
          <section className={pageStyles.section}>
            <div className={pageStyles.container}>
              <div className={pageStyles.sectionHeader}>
                <h2 className={pageStyles.sectionTitle}>
                  <span className={pageStyles.sectionIcon}>
                    {icons.document}
                  </span>
                  Templates e Modelos
                </h2>
                <div className={pageStyles.categories}>
                  {categories.map((cat) => (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => setActiveCategory(cat.id)}
                      className={[
                        pageStyles.categoryButton,
                        activeCategory === cat.id
                          ? pageStyles.categoryButtonActive
                          : "",
                      ]
                        .filter(Boolean)
                        .join(" ")}
                    >
                      {cat.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className={pageStyles.templatesGrid}>
                {displayedTemplates.length === 0 ? (
                  <p className={pageStyles.emptyMessage}>
                    Nenhum recurso disponível para esta categoria.
                  </p>
                ) : (
                  displayedTemplates.map((template) => {
                    const downloads = Number(template.downloads) || 0;
                    const fileUrl = template.downloadUrl;
                    return (
                      <div
                        key={template.id || template.title}
                        className={pageStyles.templateCard}
                      >
                        <div className={pageStyles.templateHeader}>
                          <span
                            className={pageStyles.templateCategory}
                            style={{
                              "--resource-accent": template.color || "#2057d7",
                              "--resource-accent-soft": `${template.color || "#2057d7"}15`,
                            }}
                          >
                            {template.category || "Recursos"}
                          </span>
                          <span className={pageStyles.templateFormat}>
                            {template.format || "Documento"}
                          </span>
                        </div>
                        <h3 className={pageStyles.templateTitle}>
                          {template.title}
                        </h3>
                        <p className={pageStyles.templateDescription}>
                          {template.description}
                        </p>
                        <div className={pageStyles.templateFooter}>
                          <span className={pageStyles.templateDownloads}>
                            <span className={pageStyles.templateDownloadIcon}>
                              {icons.download}
                            </span>
                            {downloads.toLocaleString("pt-PT")} downloads
                          </span>
                          {fileUrl ? (
                            <a
                              href={fileUrl}
                              className={pageStyles.templateButton}
                            >
                              <span className={pageStyles.templateDownloadIcon}>
                                {icons.download}
                              </span>
                              Baixar
                            </a>
                          ) : (
                            <span className={pageStyles.disabledButton}>
                              Em breve
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </section>

          {/* Guides */}
          <section className={`${pageStyles.section} ${pageStyles.sectionAlt}`}>
            <div className={pageStyles.container}>
              <div className={pageStyles.sectionHeader}>
                <h2 className={pageStyles.sectionTitle}>
                  <span className={pageStyles.sectionIcon}>{icons.book}</span>
                  Guias e Manuais
                </h2>
              </div>

              <div className={pageStyles.guidesGrid}>
                {guidesToShow.length === 0 ? (
                  <p className={pageStyles.emptyMessage}>
                    Sem guias cadastradas no momento.
                  </p>
                ) : (
                  guidesToShow.map((guide) => (
                    <div
                      key={guide.id || guide.title}
                      className={pageStyles.guideCard}
                    >
                      <div
                        className={pageStyles.guideIcon}
                        style={{
                          "--resource-accent": guide.color || "#6366f1",
                          "--resource-accent-soft": `${guide.color || "#6366f1"}15`,
                        }}
                      >
                        <span className={pageStyles.guideIconSvg}>
                          {icons.book}
                        </span>
                      </div>
                      <div className={pageStyles.guideContent}>
                        <div className={pageStyles.guideHeader}>
                          <span className={pageStyles.guideCategory}>
                            {guide.category || "Orientação"}
                          </span>
                          {guide.popular && (
                            <span className={pageStyles.guidePopular}>
                              Popular
                            </span>
                          )}
                        </div>
                        <h3 className={pageStyles.guideTitle}>{guide.title}</h3>
                        <p className={pageStyles.guideDescription}>
                          {guide.description}
                        </p>
                        <div className={pageStyles.guideFooter}>
                          <div className={pageStyles.guideMeta}>
                            <span className={pageStyles.guideMetaItem}>
                              <span className={pageStyles.guideMetaIcon}>
                                {icons.clock}
                              </span>
                              {guide.readTime || "—"}
                            </span>
                            <span className={pageStyles.guideMetaItem}>
                              <span className={pageStyles.guideMetaIcon}>
                                {icons.file}
                              </span>
                              {guide.pages ? `${guide.pages} páginas` : "—"}
                            </span>
                          </div>
                          <div className={pageStyles.guideButtons}>
                            {guide.readUrl ? (
                              <Link
                                href={guide.readUrl}
                                className={pageStyles.guideButton}
                              >
                                Ler guia
                              </Link>
                            ) : null}
                            {guide.downloadUrl ? (
                              <a
                                href={guide.downloadUrl}
                                className={pageStyles.guideButton}
                              >
                                <span
                                  className={pageStyles.templateDownloadIcon}
                                >
                                  {icons.download}
                                </span>
                                Baixar anexo
                              </a>
                            ) : null}
                            {!guide.readUrl && !guide.downloadUrl ? (
                              <span className={pageStyles.disabledButton}>
                                Em breve
                              </span>
                            ) : null}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </section>

          {/* Tools */}
          <section id="servicos" className={pageStyles.section}>
            <div className={pageStyles.container}>
              <div className={pageStyles.sectionHeader}>
                <h2 className={pageStyles.sectionTitle}>
                  <span className={pageStyles.sectionIcon}>
                    {icons.calculator}
                  </span>
                  Ferramentas Online
                </h2>
              </div>

              <div className={pageStyles.toolsGrid}>
                {toolsToShow.length === 0 ? (
                  <p className={pageStyles.emptyMessage}>
                    Ferramentas em processo de disponibilidade.
                  </p>
                ) : (
                  toolsToShow.map((tool) => {
                    const icon = icons[tool.icon] || icons.document;
                    const isLocked =
                      tool.requiresProfessional && !hasProfessionalAccess;
                    const actionUrl = isLocked ? premiumCtaUrl : tool.actionUrl;
                    const isInternalAction = actionUrl?.startsWith("/");
                    const actionLabel = isLocked
                      ? "Desbloquear recurso"
                      : "Usar Ferramenta";
                    return (
                      <div
                        key={tool.id || tool.title}
                        className={pageStyles.toolCard}
                      >
                        <div
                          className={pageStyles.toolIcon}
                          style={{
                            "--resource-accent": tool.color || "#2057d7",
                            "--resource-accent-soft": `${tool.color || "#2057d7"}15`,
                          }}
                        >
                          <span className={pageStyles.toolIconSvg}>{icon}</span>
                        </div>
                        <h3 className={pageStyles.toolTitle}>{tool.title}</h3>
                        <p className={pageStyles.toolDescription}>
                          {tool.description}
                        </p>
                        {actionUrl ? (
                          isInternalAction ? (
                            <Link
                              href={actionUrl}
                              className={pageStyles.toolButton}
                            >
                              {actionLabel}
                              <span style={{ width: "14px", height: "14px" }}>
                                {icons.chevronRight}
                              </span>
                            </Link>
                          ) : (
                            <a
                              href={actionUrl}
                              target="_blank"
                              rel="noreferrer"
                              className={pageStyles.toolButton}
                            >
                              {actionLabel}
                              <span style={{ width: "14px", height: "14px" }}>
                                {icons.chevronRight}
                              </span>
                            </a>
                          )
                        ) : (
                          <span className={pageStyles.disabledButton}>
                            Em breve
                          </span>
                        )}
                        {isLocked && (
                          <p className={pageStyles.toolLocked}>
                            Disponivel apenas para plano Profissional.
                          </p>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </section>

          {/* FAQ */}
          <section
            id="faq"
            className={`${pageStyles.section} ${pageStyles.sectionAlt}`}
          >
            <div className={pageStyles.container}>
              <div
                className={`${pageStyles.sectionHeader} ${pageStyles.sectionHeaderCompact}`}
              >
                <h2 className={pageStyles.sectionTitle}>
                  <span className={pageStyles.sectionIcon}>{icons.help}</span>
                  Perguntas Frequentes
                </h2>
              </div>

              <div className={pageStyles.faqSection}>
                <div className={pageStyles.faqList}>
                  {faqItems.map((faq) => (
                    <div
                      key={faq.id || faq.question}
                      className={pageStyles.faqItem}
                    >
                      <div
                        className={pageStyles.faqQuestion}
                        onClick={() => {
                          const currentId = faq.id || faq.question;
                          setExpandedFaq(
                            expandedFaq === currentId ? null : currentId,
                          );
                        }}
                      >
                        <p className={pageStyles.faqQuestionText}>
                          {faq.question}
                        </p>
                        <span
                          className={[
                            pageStyles.faqIcon,
                            expandedFaq === (faq.id || faq.question)
                              ? pageStyles.faqIconOpen
                              : "",
                          ]
                            .filter(Boolean)
                            .join(" ")}
                        >
                          {icons.chevronDown}
                        </span>
                      </div>
                      {expandedFaq === (faq.id || faq.question) && (
                        <div className={pageStyles.faqAnswer}>{faq.answer}</div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </section>

          {/* External Links */}
          <section className={pageStyles.section}>
            <div className={pageStyles.container}>
              <div className={pageStyles.sectionHeader}>
                <h2 className={pageStyles.sectionTitle}>
                  <span className={pageStyles.sectionIcon}>{icons.link}</span>
                  Links Uteis
                </h2>
              </div>

              <div className={pageStyles.linksSection}>
                {LINKS.map((link) => (
                  <div key={link.id} className={pageStyles.linkCard}>
                    <span className={pageStyles.linkCategory}>
                      {link.category}
                    </span>
                    <h3 className={pageStyles.linkTitle}>{link.title}</h3>
                    <p className={pageStyles.linkDescription}>
                      {link.description}
                    </p>
                    <a
                      href={link.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={pageStyles.linkAnchor}
                    >
                      Visitar site
                      <span className={pageStyles.linkIcon}>
                        {icons.chevronRight}
                      </span>
                    </a>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* Contact */}
          <section className={pageStyles.section}>
            <div className={pageStyles.container}>
              <div className={pageStyles.contactSection}>
                <h2 className={pageStyles.contactTitle}>Precisa de ajuda?</h2>
                <p className={pageStyles.contactText}>
                  Nao encontrou o que procura? Nossa equipa esta pronta para
                  ajudar com suas duvidas sobre emprego e carreira.
                </p>
                <div className={pageStyles.contactMethods}>
                  <div className={pageStyles.contactMethod}>
                    <div className={pageStyles.contactIcon}>
                      <span className={pageStyles.contactIconSvg}>
                        {icons.mail}
                      </span>
                    </div>
                    <div>
                      <p className={pageStyles.contactLabel}>Email</p>
                      <p className={pageStyles.contactValue}>
                        suporte@empregostp.st
                      </p>
                    </div>
                  </div>
                  <div className={pageStyles.contactMethod}>
                    <div className={pageStyles.contactIcon}>
                      <span className={pageStyles.contactIconSvg}>
                        {icons.phone}
                      </span>
                    </div>
                    <div>
                      <p className={pageStyles.contactLabel}>Telefone</p>
                      <p className={pageStyles.contactValue}>+239 222 1234</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>
        </div>
      </PublicPageShell>
    </>
  );
}

const safeFetchCollection = async (collectionName, limit) => {
  try {
    return await fetchCollection(collectionName, limit);
  } catch (error) {
    console.error(`Erro ao buscar coleção ${collectionName}:`, error);
    return [];
  }
};

export async function getServerSideProps(context) {
  const professionalAccess = await resolveProfessionalResourceAccess(context);
  const userAudience = normalizeAudience(
    professionalAccess.userType,
    RESOURCE_AUDIENCE.all,
  );

  const [templatesFromDb, guidesFromDb, toolsFromDb, faqsFromDb] =
    await Promise.all([
      safeFetchCollection("resources_templates", 12),
      safeFetchCollection("resources_guides", 12),
      safeFetchCollection("resources_tools", 8),
      safeFetchCollection("resources_faqs", 12),
    ]);

  const templates = mergeResourceList(DEFAULT_TEMPLATES, templatesFromDb);
  const guides = mergeResourceList(DEFAULT_GUIDES, guidesFromDb);
  const tools = mergeResourceList(DEFAULT_TOOLS, toolsFromDb);
  const faqs = mergeResourceList(FAQS, faqsFromDb);

  return {
    props: {
      templates,
      guides,
      tools,
      faqs,
      userAudience,
      professionalAccess,
    },
  };
}
