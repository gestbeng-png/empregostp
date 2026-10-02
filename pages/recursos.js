import Head from 'next/head';
import { useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import {
  FiAward,
  FiBarChart2,
  FiBookOpen,
  FiBriefcase,
  FiChevronDown,
  FiChevronLeft,
  FiChevronRight,
  FiClock,
  FiDownload,
  FiFile,
  FiFileText,
  FiGrid,
  FiHeadphones,
  FiLink,
  FiLock,
  FiMail,
  FiRss,
  FiSearch,
  FiShield,
  FiSliders,
  FiTrendingUp,
} from 'react-icons/fi';
import PublicPageShell from '../components/PublicPageShell';
import { admin } from '../lib/firebaseAdmin';
import { resolveProfessionalResourceAccess } from '../lib/resourcePremiumAccess';
import pageStyles from '../styles/RecursosStitchPage.module.css';
import {
  DEFAULT_GUIDES,
  DEFAULT_TEMPLATES,
  DEFAULT_TOOLS,
  RESOURCE_AUDIENCE,
  isHiddenTool,
  normalizeAudience,
  resolveGuideContentId,
  resolveTemplateContentId,
  slugifyFilename,
} from '../lib/resourcesCatalog';

const icons = {
  award: <FiAward aria-hidden="true" />,
  bars: <FiBarChart2 aria-hidden="true" />,
  book: <FiBookOpen aria-hidden="true" />,
  briefcase: <FiBriefcase aria-hidden="true" />,
  calculator: <FiGrid aria-hidden="true" />,
  chevronDown: <FiChevronDown aria-hidden="true" />,
  chevronLeft: <FiChevronLeft aria-hidden="true" />,
  chevronRight: <FiChevronRight aria-hidden="true" />,
  clock: <FiClock aria-hidden="true" />,
  document: <FiFileText aria-hidden="true" />,
  download: <FiDownload aria-hidden="true" />,
  file: <FiFile aria-hidden="true" />,
  headphones: <FiHeadphones aria-hidden="true" />,
  link: <FiLink aria-hidden="true" />,
  lock: <FiLock aria-hidden="true" />,
  rss: <FiRss aria-hidden="true" />,
  scale: <FiSliders aria-hidden="true" />,
  search: <FiSearch aria-hidden="true" />,
  shield: <FiShield aria-hidden="true" />,
  trending: <FiTrendingUp aria-hidden="true" />,
};

const normalizeCategory = (category) => {
  return category ? String(category).trim() : 'Outros';
};

const normalizeSearchText = (value) => {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
};

const formatResourceCount = (count, singular, plural) => {
  return `${count} ${count === 1 ? singular : plural}`;
};

const serializeDoc = (doc) => {
  const data = doc.data();
  return {
    ...data,
    id: doc.id,
    createdAt: data.createdAt?.toDate?.()?.toISOString() || null,
    updatedAt: data.updatedAt?.toDate?.()?.toISOString() || null,
  };
};

const fetchCollection = async (collectionName, limit = 6) => {
  const query = admin
    .firestore()
    .collection(collectionName)
    .orderBy('createdAt', 'desc')
    .limit(limit);
  const snapshot = await query.get();
  return snapshot.docs.map(serializeDoc);
};

const FAQS = [
  {
    id: 'faq1',
    question: 'Como posso candidatar-me a uma vaga no EmpregoSTP?',
    answer:
      'Crie uma conta gratuita, complete o seu perfil e currículo, consulte as vagas disponíveis e selecione Candidatar nas oportunidades que lhe interessam. A empresa receberá a sua candidatura automaticamente.',
  },
  {
    id: 'faq2',
    question: 'Quanto custa usar a plataforma?',
    answer:
      'O plano básico permite criar um perfil, candidatar-se a vagas e usar recursos essenciais sem custos. Existem planos pagos com mais candidaturas, visibilidade e ferramentas profissionais.',
  },
  {
    id: 'faq3',
    question: 'Como sei se a minha candidatura foi vista?',
    answer:
      'Na área de candidato, pode acompanhar o estado de todas as suas candidaturas. Quando uma empresa atualiza o processo, recebe uma notificação automática.',
  },
  {
    id: 'faq4',
    question: 'Posso editar a minha candidatura depois de a enviar?',
    answer:
      'Pode atualizar o seu currículo e perfil a qualquer momento. As alterações ficam disponíveis para as empresas, mas as mensagens já enviadas com candidaturas não podem ser editadas.',
  },
  {
    id: 'faq5',
    question: 'Como funciona a verificação de perfil?',
    answer:
      'A verificação confirma a sua identidade e reforça a credibilidade do perfil. Pode verificar email, telefone e documentos profissionais na área de candidato.',
  },
  {
    id: 'faq6',
    question: 'Quanto tempo as vagas ficam ativas?',
    answer:
      'Cada vaga apresenta a respetiva data de encerramento. A empresa pode prolongar ou terminar a publicação antes dessa data, por isso recomendamos uma candidatura atempada.',
  },
];

const LINKS = [
  {
    id: 'l1',
    title: 'Ministério do Trabalho STP',
    description:
      'Portal oficial com informações sobre legislação e serviços públicos.',
    url: 'https://governo.st',
    category: 'Governo',
    icon: 'briefcase',
  },
  {
    id: 'l2',
    title: 'Câmara de Comércio STP',
    description:
      'Informações sobre empresas, negócios e oportunidades comerciais.',
    url: 'https://ccistp.st',
    category: 'Negocios',
    icon: 'bars',
  },
  {
    id: 'l3',
    title: 'Instituto de Segurança Social',
    description: 'Informações sobre contribuições, benefícios e pensões.',
    url: 'https://inss.st',
    category: 'Governo',
    icon: 'shield',
  },
  {
    id: 'l4',
    title: 'EmpregoSTP Blog',
    description: 'Dicas práticas sobre carreira, recrutamento e mercado.',
    url: '/blog',
    category: 'Carreira',
    icon: 'rss',
  },
  {
    id: 'l5',
    title: 'Contactos úteis',
    description: 'Fale com a equipa EmpregoSTP sempre que precisar de apoio.',
    url: '/contacto',
    category: 'Suporte',
    icon: 'headphones',
  },
];

const AUDIENCE_FILTERS = [
  { id: RESOURCE_AUDIENCE.all, label: 'Todos' },
  { id: RESOURCE_AUDIENCE.candidato, label: 'Candidatos' },
  { id: RESOURCE_AUDIENCE.empresa, label: 'Empresas' },
];

const DEFAULT_TEMPLATE_CATEGORIES = ['CV', 'Carta', 'Contrato', 'Freelancer'];

const inferAudienceByContent = (item, fallback = RESOURCE_AUDIENCE.all) => {
  const category = String(item?.category || '').toLowerCase();
  const title = String(item?.title || '').toLowerCase();
  if (
    category.includes('contrato') ||
    category.includes('freelancer') ||
    title.includes('empresa')
  ) {
    return RESOURCE_AUDIENCE.empresa;
  }
  if (
    category.includes('cv') ||
    category.includes('carta') ||
    title.includes('candidato')
  ) {
    return RESOURCE_AUDIENCE.candidato;
  }
  return fallback;
};

const normalizeLinkValue = (value) => {
  const current = String(value || '').trim();
  if (!current || current === '#') {
    return null;
  }
  return current;
};

const normalizeBoolean = (value, fallback = false) => {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (normalized === 'true' || normalized === '1' || normalized === 'sim')
      return true;
    if (
      normalized === 'false' ||
      normalized === '0' ||
      normalized === 'nao' ||
      normalized === 'não'
    )
      return false;
  }
  return fallback;
};

const getResourceKey = (item, index = 0) => {
  const titleKey = slugifyFilename(
    item?.title || item?.name || item?.question || '',
  );
  if (titleKey) {
    return titleKey;
  }
  const idKey = slugifyFilename(item?.id || '');
  if (idKey) {
    return idKey;
  }
  return `resource-${index}`;
};

const getResourceMergeKey = (item, index, canonicalResolver) => {
  const canonicalId = canonicalResolver?.(item);
  return canonicalId || getResourceKey(item, index);
};

const mergeResourceList = (defaults = [], fromDb = [], canonicalResolver) => {
  const merged = new Map();
  defaults.forEach((item, index) => {
    merged.set(getResourceMergeKey(item, index, canonicalResolver), {
      ...item,
    });
  });

  fromDb.forEach((item, index) => {
    const key = getResourceMergeKey(item, index + 200, canonicalResolver);
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
  const [activeCategory, setActiveCategory] = useState('todos');
  const [activeAudience, setActiveAudience] = useState(
    normalizeAudience(userAudience),
  );
  const [searchQuery, setSearchQuery] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [expandedFaq, setExpandedFaq] = useState(null);
  const [newsletterEmail, setNewsletterEmail] = useState('');
  const [newsletterState, setNewsletterState] = useState({
    status: 'idle',
    message: '',
  });
  const templateRailRef = useRef(null);
  const hasProfessionalAccess = Boolean(professionalAccess?.allowed);
  const premiumCtaUrl = professionalAccess?.ctaUrl || '/premium/candidatos';

  const normalizedTemplates = useMemo(() => {
    return (templates || []).map((template) => {
      const bundledContentId = resolveTemplateContentId(template);

      return {
        ...template,
        category: normalizeCategory(template.category),
        audience: normalizeAudience(
          template.audience,
          inferAudienceByContent(template, RESOURCE_AUDIENCE.all),
        ),
        downloadUrl:
          normalizeLinkValue(template.fileUrl) ||
          normalizeLinkValue(template.url) ||
          (bundledContentId
            ? `/api/resources/download?kind=template&id=${encodeURIComponent(
                bundledContentId,
              )}&title=${encodeURIComponent(template.title || 'modelo')}`
            : null),
      };
    });
  }, [templates]);

  const normalizedGuides = useMemo(() => {
    return (guides || []).map((guide) => ({
      ...guide,
      audience: normalizeAudience(
        guide.audience,
        inferAudienceByContent(guide, RESOURCE_AUDIENCE.all),
      ),
      readUrl:
        (String(guide.content || '').trim() || resolveGuideContentId(guide)) &&
        guide.id
          ? `/recursos/guia/${encodeURIComponent(guide.id)}`
          : null,
      downloadUrl:
        normalizeLinkValue(guide.fileUrl) ||
        normalizeLinkValue(guide.url) ||
        (resolveGuideContentId(guide)
          ? `/api/resources/download?kind=guide&id=${encodeURIComponent(resolveGuideContentId(guide))}&title=${encodeURIComponent(
              guide.title || 'guia',
            )}`
          : null),
    }));
  }, [guides]);

  const normalizedTools = useMemo(() => {
    return (tools || [])
      .filter((tool) => !isHiddenTool(tool))
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
      templatePool.map((template) => template.category || 'Outros'),
    );
    const extras = Array.from(uniqueCategories).filter(
      (cat) => cat && !DEFAULT_TEMPLATE_CATEGORIES.includes(cat),
    );
    return [
      { id: 'todos', label: 'Todos' },
      ...DEFAULT_TEMPLATE_CATEGORIES.map((label) => ({ id: label, label })),
      ...extras.map((label) => ({ id: label, label })),
    ];
  }, [normalizedTemplates, activeAudience]);

  const filteredTemplates = useMemo(() => {
    const base = normalizedTemplates.filter((template) => {
      const categoryMatch =
        activeCategory === 'todos' || template.category === activeCategory;
      const audienceMatch =
        activeAudience === RESOURCE_AUDIENCE.all ||
        template.audience === RESOURCE_AUDIENCE.all ||
        template.audience === activeAudience;
      return categoryMatch && audienceMatch;
    });

    const query = normalizeSearchText(searchQuery).trim();
    if (!query) return base;

    return base.filter((template) => {
      const title = normalizeSearchText(template.title);
      const description = normalizeSearchText(template.description);
      const category = normalizeSearchText(template.category);
      return (
        title.includes(query) ||
        description.includes(query) ||
        category.includes(query)
      );
    });
  }, [normalizedTemplates, activeCategory, activeAudience, searchQuery]);

  const displayedTemplates = filteredTemplates;
  const guidesToShow = useMemo(() => {
    const base = normalizedGuides.filter((guide) => {
      const audienceMatch =
        activeAudience === RESOURCE_AUDIENCE.all ||
        guide.audience === RESOURCE_AUDIENCE.all ||
        guide.audience === activeAudience;
      return audienceMatch;
    });

    const query = normalizeSearchText(searchQuery).trim();
    if (!query) return base;

    return base.filter((guide) => {
      const title = normalizeSearchText(guide.title);
      const description = normalizeSearchText(guide.description);
      const category = normalizeSearchText(guide.category);
      return (
        title.includes(query) ||
        description.includes(query) ||
        category.includes(query)
      );
    });
  }, [normalizedGuides, activeAudience, searchQuery]);

  const toolsToShow = useMemo(() => {
    const base = normalizedTools.filter((tool) => {
      const audienceMatch =
        activeAudience === RESOURCE_AUDIENCE.all ||
        tool.audience === RESOURCE_AUDIENCE.all ||
        tool.audience === activeAudience;
      return audienceMatch;
    });

    const query = normalizeSearchText(searchQuery).trim();
    if (!query) return base;

    return base.filter((tool) => {
      const title = normalizeSearchText(tool.title);
      const description = normalizeSearchText(tool.description);
      return title.includes(query) || description.includes(query);
    });
  }, [normalizedTools, activeAudience, searchQuery]);

  const faqItems = faqs.length ? faqs : FAQS;
  const resourceStatus = `${formatResourceCount(
    displayedTemplates.length,
    'modelo',
    'modelos',
  )}, ${formatResourceCount(guidesToShow.length, 'guia', 'guias')} e ${formatResourceCount(
    toolsToShow.length,
    'ferramenta',
    'ferramentas',
  )} disponíveis.`;

  const handleNewsletterSubmit = async (event) => {
    event.preventDefault();
    const email = newsletterEmail.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setNewsletterState({
        status: 'error',
        message: 'Introduza um email válido.',
      });
      return;
    }

    setNewsletterState({ status: 'loading', message: '' });

    try {
      const response = await fetch('/api/newsletter/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, source: 'recursos' }),
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        setNewsletterState({
          status: 'error',
          message:
            data.error ||
            'Não foi possível concluir a subscrição. Tente novamente.',
        });
        return;
      }

      setNewsletterState({
        status: 'success',
        message: data.message || 'Subscrição confirmada. Obrigado.',
      });
      setNewsletterEmail('');
    } catch (error) {
      setNewsletterState({
        status: 'error',
        message:
          'Não foi possível estabelecer a ligação. Tente novamente dentro de momentos.',
      });
    }
  };

  return (
    <>
      <Head>
        <title>Recursos gratuitos | EmpregoSTP</title>
        <meta
          name="description"
          content="Recursos gratuitos para a sua carreira: modelos de currículo, guias de entrevista, ferramentas úteis e respostas sobre emprego em São Tomé e Príncipe."
        />
      </Head>

      <PublicPageShell>
        <div className={pageStyles.page}>
          <div className={pageStyles.toolbar}>
            <div className={pageStyles.container}>
              <h1 className={pageStyles.srOnly}>
                Recursos gratuitos para a sua carreira
              </h1>
              <div className={pageStyles.toolbarInner}>
                <div
                  className={pageStyles.audienceFilters}
                  role="group"
                  aria-label="Filtrar recursos por público"
                >
                  {AUDIENCE_FILTERS.map((audience) => (
                    <button
                      key={audience.id}
                      type="button"
                      onClick={() => {
                        setActiveAudience(audience.id);
                        setActiveCategory('todos');
                        templateRailRef.current?.scrollTo({
                          left: 0,
                          behavior: 'smooth',
                        });
                      }}
                      className={[
                        pageStyles.audienceButton,
                        activeAudience === audience.id
                          ? pageStyles.audienceButtonActive
                          : '',
                      ]
                        .filter(Boolean)
                        .join(' ')}
                      aria-pressed={activeAudience === audience.id}
                    >
                      {audience.label}
                    </button>
                  ))}
                </div>

                <div className={pageStyles.searchControl}>
                  <button
                    type="button"
                    className={[
                      pageStyles.searchToggle,
                      searchOpen || searchQuery
                        ? pageStyles.searchToggleActive
                        : '',
                    ]
                      .filter(Boolean)
                      .join(' ')}
                    aria-label={
                      searchOpen ? 'Fechar pesquisa' : 'Pesquisar recursos'
                    }
                    aria-expanded={searchOpen}
                    aria-controls="resource-search-panel"
                    onClick={() => setSearchOpen((current) => !current)}
                  >
                    {icons.search}
                  </button>

                  {searchOpen ? (
                    <div
                      id="resource-search-panel"
                      className={pageStyles.searchPanel}
                      role="search"
                      aria-label="Pesquisar no centro de recursos"
                    >
                      <label
                        className={pageStyles.srOnly}
                        htmlFor="resource-search"
                      >
                        Pesquisar recursos
                      </label>
                      <div className={pageStyles.searchField}>
                        <span aria-hidden="true">{icons.search}</span>
                        <input
                          id="resource-search"
                          type="search"
                          placeholder="Pesquisar recursos…"
                          value={searchQuery}
                          onChange={(event) => {
                            setSearchQuery(event.target.value);
                            templateRailRef.current?.scrollTo({
                              left: 0,
                              behavior: 'smooth',
                            });
                          }}
                          autoFocus
                        />
                      </div>
                      <label
                        className={pageStyles.srOnly}
                        htmlFor="resource-category"
                      >
                        Filtrar modelos por categoria
                      </label>
                      <select
                        id="resource-category"
                        value={activeCategory}
                        onChange={(event) => {
                          setActiveCategory(event.target.value);
                          templateRailRef.current?.scrollTo({
                            left: 0,
                            behavior: 'smooth',
                          });
                        }}
                      >
                        {categories.map((category) => (
                          <option key={category.id} value={category.id}>
                            {category.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  ) : null}
                </div>
              </div>

              <p
                className={pageStyles.srOnly}
                role="status"
                aria-live="polite"
                aria-atomic="true"
              >
                {resourceStatus}
              </p>
            </div>
          </div>

          <div className={pageStyles.resourcesBody}>
            <section id="modelos" className={pageStyles.section}>
              <div className={pageStyles.container}>
                <div className={pageStyles.sectionHeader}>
                  <div className={pageStyles.sectionHeadingGroup}>
                    <h2 className={pageStyles.sectionTitle}>
                      Modelos e documentos
                    </h2>
                    <p className={pageStyles.sectionDescription}>
                      Estruturas profissionais prontas a usar.
                    </p>
                  </div>
                  <div
                    className={pageStyles.carouselControls}
                    aria-label="Navegar pelos modelos"
                  >
                    <button
                      type="button"
                      aria-label="Modelos anteriores"
                      onClick={() =>
                        templateRailRef.current?.scrollBy({
                          left: -460,
                          behavior: 'smooth',
                        })
                      }
                    >
                      {icons.chevronLeft}
                    </button>
                    <button
                      type="button"
                      aria-label="Modelos seguintes"
                      onClick={() =>
                        templateRailRef.current?.scrollBy({
                          left: 460,
                          behavior: 'smooth',
                        })
                      }
                    >
                      {icons.chevronRight}
                    </button>
                  </div>
                </div>

                <div
                  ref={templateRailRef}
                  className={pageStyles.templatesGrid}
                  role="list"
                  aria-label="Modelos e documentos disponíveis"
                >
                  {displayedTemplates.length === 0 ? (
                    <p className={pageStyles.emptyMessage}>
                      {searchQuery.trim()
                        ? `Nenhum modelo corresponde a “${searchQuery.trim()}”.`
                        : 'Ainda não existem modelos para estes filtros.'}
                    </p>
                  ) : (
                    displayedTemplates.map((template, templateIndex) => {
                      const downloads = Number(template.downloads);
                      const hasDownloadMetric =
                        template.downloads !== null &&
                        template.downloads !== undefined &&
                        Number.isFinite(downloads) &&
                        downloads >= 0;
                      const fileUrl = template.downloadUrl;
                      const isPopular =
                        normalizeBoolean(template.popular, false) ||
                        templateIndex === 0;
                      return (
                        <article
                          key={`${template.id || template.title}-${templateIndex}`}
                          className={pageStyles.templateCard}
                          role="listitem"
                        >
                          <div className={pageStyles.cardTopline}>
                            <span className={pageStyles.templateIcon}>
                              {icons.document}
                            </span>
                            {isPopular ? (
                              <span className={pageStyles.popularBadge}>
                                Popular
                              </span>
                            ) : null}
                          </div>
                          <h3 className={pageStyles.templateTitle}>
                            {template.title}
                          </h3>
                          <p className={pageStyles.templateDescription}>
                            {template.description}
                          </p>
                          <div className={pageStyles.templateMeta}>
                            <span>{icons.download}</span>
                            {hasDownloadMetric
                              ? `${downloads.toLocaleString('pt-PT')} descargas`
                              : 'Modelo pronto a usar'}
                          </div>
                          {fileUrl ? (
                            <a
                              href={fileUrl}
                              className={pageStyles.templateButton}
                              aria-label={`Descarregar ${template.title}`}
                            >
                              Descarregar
                            </a>
                          ) : (
                            <span className={pageStyles.disabledButton}>
                              Em breve
                            </span>
                          )}
                        </article>
                      );
                    })
                  )}
                </div>
              </div>
            </section>

            <section id="guias" className={pageStyles.section}>
              <div className={pageStyles.container}>
                <div className={pageStyles.sectionHeader}>
                  <div className={pageStyles.sectionHeadingGroup}>
                    <h2 className={pageStyles.sectionTitle}>Guias e manuais</h2>
                    <p className={pageStyles.sectionDescription}>
                      Conteúdo aprofundado para navegação na carreira.
                    </p>
                  </div>
                </div>

                <div className={pageStyles.guidesGrid}>
                  {guidesToShow.length === 0 ? (
                    <p className={pageStyles.emptyMessage}>
                      {searchQuery.trim()
                        ? `Nenhum guia corresponde a “${searchQuery.trim()}”.`
                        : 'Ainda não existem guias para estes filtros.'}
                    </p>
                  ) : (
                    guidesToShow.map((guide, guideIndex) => (
                      <article
                        key={`${guide.id || guide.title}-${guideIndex}`}
                        className={pageStyles.guideCard}
                      >
                        <span className={pageStyles.guideIcon}>
                          {guideIndex % 2 === 0 ? icons.book : icons.trending}
                        </span>
                        <div className={pageStyles.guideContent}>
                          <div className={pageStyles.guideTitleRow}>
                            <h3 className={pageStyles.guideTitle}>
                              {guide.title}
                            </h3>
                            {guide.popular ? (
                              <span className={pageStyles.popularBadge}>
                                Popular
                              </span>
                            ) : null}
                          </div>
                          <p className={pageStyles.guideDescription}>
                            {guide.description}
                          </p>
                          <div className={pageStyles.guideMeta}>
                            <span>
                              {icons.clock}
                              {guide.readTime || 'Não indicado'}
                            </span>
                            <span>
                              {icons.file}
                              {guide.pages
                                ? `${guide.pages} páginas`
                                : 'Não indicado'}
                            </span>
                          </div>
                          <div className={pageStyles.guideButtons}>
                            {guide.readUrl ? (
                              <Link
                                href={guide.readUrl}
                                className={pageStyles.guideReadButton}
                                aria-label={`Ler ${guide.title}`}
                              >
                                Ler guia
                              </Link>
                            ) : null}
                            {guide.downloadUrl ? (
                              <a
                                href={guide.downloadUrl}
                                className={[
                                  pageStyles.guideDownloadButton,
                                  guide.popular
                                    ? pageStyles.guideDownloadButtonAccent
                                    : '',
                                ]
                                  .filter(Boolean)
                                  .join(' ')}
                                aria-label={`Descarregar ${guide.title}`}
                              >
                                Descarregar anexo
                              </a>
                            ) : null}
                            {!guide.readUrl && !guide.downloadUrl ? (
                              <span className={pageStyles.disabledButton}>
                                Em breve
                              </span>
                            ) : null}
                          </div>
                        </div>
                      </article>
                    ))
                  )}
                </div>
              </div>
            </section>

            <section id="servicos" className={pageStyles.section}>
              <div className={pageStyles.container}>
                <div className={pageStyles.sectionHeader}>
                  <div className={pageStyles.sectionHeadingGroup}>
                    <h2 className={pageStyles.sectionTitleWithIcon}>
                      Ferramentas
                      <span aria-hidden="true">{icons.award}</span>
                    </h2>
                    <p className={pageStyles.sectionDescription}>
                      Funcionalidades avançadas para subscritores Profissionais.
                    </p>
                  </div>
                </div>

                <div className={pageStyles.toolsGrid}>
                  {toolsToShow.length === 0 ? (
                    <p className={pageStyles.emptyMessage}>
                      {searchQuery.trim()
                        ? `Nenhuma ferramenta corresponde a “${searchQuery.trim()}”.`
                        : 'Ainda não existem ferramentas para estes filtros.'}
                    </p>
                  ) : (
                    toolsToShow.map((tool, toolIndex) => {
                      const icon = icons[tool.icon] || icons.document;
                      const isLocked =
                        tool.requiresProfessional && !hasProfessionalAccess;
                      const actionUrl = isLocked
                        ? premiumCtaUrl
                        : tool.actionUrl;
                      const isInternalAction = actionUrl?.startsWith('/');
                      return (
                        <article
                          key={`${tool.id || tool.title}-${toolIndex}`}
                          className={[
                            pageStyles.toolCard,
                            isLocked ? pageStyles.toolCardLocked : '',
                          ]
                            .filter(Boolean)
                            .join(' ')}
                        >
                          <div className={pageStyles.toolCardBody}>
                            <span className={pageStyles.toolIcon}>{icon}</span>
                            <h3 className={pageStyles.toolTitle}>
                              {tool.title}
                            </h3>
                            <p className={pageStyles.toolDescription}>
                              {tool.description}
                            </p>
                            {!isLocked && actionUrl ? (
                              isInternalAction ? (
                                <Link
                                  href={actionUrl}
                                  className={pageStyles.toolButton}
                                  aria-label={`Usar ferramenta: ${tool.title}`}
                                >
                                  Usar ferramenta
                                </Link>
                              ) : (
                                <a
                                  href={actionUrl}
                                  target="_blank"
                                  rel="noreferrer"
                                  className={pageStyles.toolButton}
                                  aria-label={`Usar ferramenta: ${tool.title} — abre numa nova janela`}
                                >
                                  Usar ferramenta
                                </a>
                              )
                            ) : null}
                            {!isLocked && !actionUrl ? (
                              <span className={pageStyles.disabledButton}>
                                Em breve
                              </span>
                            ) : null}
                          </div>

                          {isLocked ? (
                            <div className={pageStyles.toolLockOverlay}>
                              <span className={pageStyles.lockIcon}>
                                {icons.lock}
                              </span>
                              <Link
                                href={premiumCtaUrl}
                                className={pageStyles.upgradeButton}
                                aria-label={`Upgrade para aceder a ${tool.title}`}
                              >
                                Upgrade para Aceder
                              </Link>
                            </div>
                          ) : null}
                        </article>
                      );
                    })
                  )}
                </div>
              </div>
            </section>

            <section id="faq" className={pageStyles.supportSection}>
              <div className={pageStyles.container}>
                <div className={pageStyles.supportGrid}>
                  <div className={pageStyles.faqColumn}>
                    <h2 className={pageStyles.sectionTitle}>
                      Perguntas frequentes
                    </h2>
                    <div className={pageStyles.faqList}>
                      {faqItems.map((faq, faqIndex) => {
                        const faqBaseKey =
                          slugifyFilename(faq.id) ||
                          slugifyFilename(faq.question) ||
                          'faq';
                        const faqKey = `${faqBaseKey}-${faqIndex}`;
                        const expanded = expandedFaq === faqKey;
                        return (
                          <div key={faqKey} className={pageStyles.faqItem}>
                            <h3 className={pageStyles.faqHeading}>
                              <button
                                type="button"
                                className={pageStyles.faqQuestion}
                                id={`${faqKey}-button`}
                                aria-controls={`${faqKey}-answer`}
                                aria-expanded={expanded}
                                onClick={() =>
                                  setExpandedFaq(expanded ? null : faqKey)
                                }
                              >
                                <span className={pageStyles.faqQuestionText}>
                                  {faq.question}
                                </span>
                                <span
                                  className={[
                                    pageStyles.faqIcon,
                                    expanded ? pageStyles.faqIconOpen : '',
                                  ]
                                    .filter(Boolean)
                                    .join(' ')}
                                >
                                  {icons.chevronDown}
                                </span>
                              </button>
                            </h3>
                            {expanded ? (
                              <div
                                className={pageStyles.faqAnswer}
                                id={`${faqKey}-answer`}
                                role="region"
                                aria-labelledby={`${faqKey}-button`}
                              >
                                {faq.answer}
                              </div>
                            ) : null}
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <div className={pageStyles.linksColumn}>
                    <h2 className={pageStyles.sectionTitle}>Links úteis</h2>
                    <div className={pageStyles.linksGrid}>
                      {LINKS.map((link) => {
                        const linkIcon = icons[link.icon] || icons.link;
                        const linkContent = (
                          <>
                            <span className={pageStyles.linkIcon}>
                              {linkIcon}
                            </span>
                            <span className={pageStyles.linkTitle}>
                              {link.title}
                            </span>
                            <span className={pageStyles.srOnly}>
                              {link.description}
                            </span>
                          </>
                        );
                        return link.url.startsWith('/') ? (
                          <Link
                            key={link.id}
                            href={link.url}
                            className={pageStyles.linkCard}
                            aria-label={`${link.title}: ${link.description}`}
                          >
                            {linkContent}
                          </Link>
                        ) : (
                          <a
                            key={link.id}
                            href={link.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={pageStyles.linkCard}
                            aria-label={`${link.title}: ${link.description} — abre numa nova janela`}
                          >
                            {linkContent}
                          </a>
                        );
                      })}
                    </div>

                    <div
                      className={pageStyles.newsletter}
                      aria-labelledby="newsletter-title"
                    >
                      <span
                        className={pageStyles.newsletterIcon}
                        aria-hidden="true"
                      >
                        <FiMail />
                      </span>
                      <h2
                        id="newsletter-title"
                        className={pageStyles.newsletterTitle}
                      >
                        Receba novidades do mercado de trabalho
                      </h2>
                      <p className={pageStyles.newsletterText}>
                        Inscreva-se na nossa newsletter semanal para receber
                        as melhores dicas e vagas diretamente no seu email.
                      </p>
                      <form
                        className={pageStyles.newsletterForm}
                        onSubmit={handleNewsletterSubmit}
                      >
                        <input
                          type="email"
                          placeholder="O seu email profissional"
                          aria-label="Email para subscrever a newsletter"
                          className={pageStyles.newsletterInput}
                          value={newsletterEmail}
                          onChange={(event) => {
                            setNewsletterEmail(event.target.value);
                            if (newsletterState.status !== 'idle') {
                              setNewsletterState({
                                status: 'idle',
                                message: '',
                              });
                            }
                          }}
                          disabled={newsletterState.status === 'loading'}
                        />
                        <button
                          type="submit"
                          className={pageStyles.newsletterButton}
                          disabled={newsletterState.status === 'loading'}
                        >
                          {newsletterState.status === 'loading'
                            ? 'A subscrever…'
                            : 'Subscrever'}
                        </button>
                        {newsletterState.message ? (
                          <p
                            className={`${pageStyles.newsletterFeedback} ${
                              newsletterState.status === 'error'
                                ? pageStyles.newsletterFeedbackError
                                : pageStyles.newsletterFeedbackSuccess
                            }`}
                            role="status"
                            aria-live="polite"
                          >
                            {newsletterState.message}
                          </p>
                        ) : null}
                      </form>
                    </div>
                  </div>
                </div>
              </div>
            </section>
          </div>
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
      safeFetchCollection('resources_templates', 12),
      safeFetchCollection('resources_guides', 12),
      safeFetchCollection('resources_tools', 8),
      safeFetchCollection('resources_faqs', 12),
    ]);

  const templates = mergeResourceList(
    DEFAULT_TEMPLATES,
    templatesFromDb,
    resolveTemplateContentId,
  );
  const guides = mergeResourceList(
    DEFAULT_GUIDES,
    guidesFromDb,
    resolveGuideContentId,
  );
  const tools = mergeResourceList(DEFAULT_TOOLS, toolsFromDb);
  const faqs = faqsFromDb.length ? faqsFromDb : FAQS;

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
