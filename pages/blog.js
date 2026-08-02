import Head from 'next/head';
import Image from 'next/image';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import {
  FiArrowRight,
  FiCalendar,
  FiClock,
  FiExternalLink,
  FiMail,
  FiSearch,
  FiX,
} from 'react-icons/fi';
import PublicPageShell from '../components/PublicPageShell';
import { admin } from '../lib/firebaseAdmin';
import {
  safeText,
  safeTimestampToISOString,
  safeTimestampToMillis,
} from '../lib/firestoreNormalize';
import {
  isContentPublished,
  normalizeContentStatus,
} from '../lib/contentPublication';
import styles from '../styles/BlogPage.module.css';

const POSTS_BATCH_SIZE = 4;

function normalizeSearchText(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function normalizeAccentColor(value) {
  const color = String(value || '').trim();
  return /^#[0-9a-f]{3,8}$/i.test(color) ? color : '#2563eb';
}

function BlogImage({ post, priority = false, className, fallbackClassName }) {
  const [failed, setFailed] = useState(false);

  if (post.image && !failed) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={post.image}
        alt={`Imagem do artigo ${post.title}`}
        className={className}
        loading={priority ? 'eager' : 'lazy'}
        decoding="async"
        fetchPriority={priority ? 'high' : 'auto'}
        onError={() => setFailed(true)}
      />
    );
  }

  return (
    <div
      className={fallbackClassName}
      role="img"
      aria-label={`Identidade visual do artigo ${post.title}`}
      style={{ '--post-accent': normalizeAccentColor(post.color) }}
    >
      <span className={styles.mediaFallbackLabel} aria-hidden="true">
        EmpregoSTP Journal
      </span>
      <span className={styles.mediaFallbackMonogram} aria-hidden="true">
        {String(post.category || 'E').trim().charAt(0).toUpperCase() || 'E'}
      </span>
      <Image
        src="/assets/Emprego STP Logo 2-wide.png"
        alt=""
        width={260}
        height={72}
        className={styles.mediaFallbackLogo}
      />
    </div>
  );
}

export async function getServerSideProps(context) {
  const fetchWithFallback = async (collectionName) => {
    const collectionRef = admin.firestore().collection(collectionName);
    try {
      return await collectionRef.orderBy('createdAt', 'desc').get();
    } catch (error) {
      console.warn(
        `[blog] fallback sem orderBy em ${collectionName}:`,
        error?.message || error,
      );
      return collectionRef.get();
    }
  };

  const sortByRecent = (a, b) => {
    const aScore = a.createdAtMs || a.updatedAtMs || 0;
    const bScore = b.createdAtMs || b.updatedAtMs || 0;
    return bScore - aScore;
  };

  try {
    context?.res?.setHeader?.(
      'Cache-Control',
      'public, s-maxage=60, stale-while-revalidate=300',
    );

    const [postsSnapshot, newsSnapshot] = await Promise.all([
      fetchWithFallback('posts'),
      fetchWithFallback('news'),
    ]);

    const posts = postsSnapshot.docs
      .map((doc) => {
        const data = doc.data() || {};
        const createdAt = safeTimestampToISOString(data.createdAt);
        const updatedAt = safeTimestampToISOString(data.updatedAt);

        return {
          id: doc.id,
          title: safeText(data.title, 'Sem título'),
          excerpt: safeText(data.excerpt, ''),
          category: safeText(data.category, 'Geral'),
          author: safeText(data.author, 'EmpregoSTP'),
          image: safeText(data.image, ''),
          readTime: safeText(data.readTime, '5 min'),
          color: safeText(data.color, '#2057d7'),
          views: Number(data.views) || 0,
          featured: Boolean(data.featured),
          status: normalizeContentStatus(data.status),
          createdAt,
          updatedAt,
          createdAtMs: safeTimestampToMillis(data.createdAt),
          updatedAtMs: safeTimestampToMillis(data.updatedAt),
        };
      })
      .filter((post) => isContentPublished(post.status))
      .sort(sortByRecent)
      .map(({ createdAtMs, updatedAtMs, ...post }) => post);

    const news = newsSnapshot.docs
      .map((doc) => {
        const data = doc.data() || {};
        const createdAt = safeTimestampToISOString(data.createdAt);
        const updatedAt = safeTimestampToISOString(data.updatedAt);

        return {
          id: doc.id,
          title: safeText(data.title, 'Sem título'),
          category: safeText(data.category, 'Atualização'),
          date: safeText(
            data.date,
            createdAt ? new Date(createdAt).toLocaleDateString('pt-PT') : '',
          ),
          status: normalizeContentStatus(data.status),
          createdAt,
          updatedAt,
          createdAtMs: safeTimestampToMillis(data.createdAt),
          updatedAtMs: safeTimestampToMillis(data.updatedAt),
        };
      })
      .filter((item) => isContentPublished(item.status))
      .sort(sortByRecent)
      .slice(0, 8)
      .map(({ createdAtMs, updatedAtMs, ...item }) => item);

    return {
      props: {
        initialPosts: posts || [],
        initialNews: news || [],
      },
    };
  } catch (error) {
    console.error('Error fetching blog data:', error);
    return {
      props: {
        initialPosts: [],
        initialNews: [],
      },
    };
  }
}

function formatDate(value) {
  if (!value) return 'Data desconhecida';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString('pt-PT', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

export default function BlogPage({ initialPosts = [], initialNews = [] }) {
  const [activeCategory, setActiveCategory] = useState('todos');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [visiblePostCount, setVisiblePostCount] = useState(POSTS_BATCH_SIZE);
  const [newsletterEmail, setNewsletterEmail] = useState('');
  const [newsletterState, setNewsletterState] = useState({
    status: 'idle',
    message: '',
  });
  const posts = initialPosts;
  const news = initialNews;

  const categories = useMemo(() => {
    const counts = new Map();
    posts.forEach((post) => {
      if (!post.category) return;
      counts.set(post.category, (counts.get(post.category) || 0) + 1);
    });

    return [
      { id: 'todos', label: 'Todos', count: posts.length },
      ...Array.from(counts, ([category, count]) => ({
        id: category,
        label: category,
        count,
      })),
    ];
  }, [posts]);

  const filteredPosts = useMemo(() => {
    const normalizedSearch = normalizeSearchText(searchQuery);
    return posts.filter((post) => {
      const matchesCategory =
        activeCategory === 'todos' || post.category === activeCategory;
      const matchesSearch =
        !normalizedSearch ||
        normalizeSearchText(post.title).includes(normalizedSearch) ||
        normalizeSearchText(post.excerpt).includes(normalizedSearch);
      return matchesCategory && matchesSearch;
    });
  }, [activeCategory, posts, searchQuery]);

  const featuredPost = filteredPosts[0] || null;
  const remainingPosts = filteredPosts.slice(featuredPost ? 1 : 0);
  const visiblePosts = remainingPosts.slice(0, visiblePostCount);
  const canLoadMore = visiblePostCount < remainingPosts.length;

  const handleCategoryChange = (categoryId) => {
    setActiveCategory(categoryId);
    setVisiblePostCount(POSTS_BATCH_SIZE);
  };

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
        body: JSON.stringify({ email, source: 'blog' }),
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
        <title>Blog | EmpregoSTP</title>
        <meta
          name="description"
          content="Artigos, dicas de carreira, novidades e histórias de sucesso da maior plataforma de emprego em São Tomé e Príncipe."
        />
      </Head>

      <PublicPageShell headerVariant="light">
        <div className={styles.page}>
          <div className={styles.blogBody}>
            <section className={styles.hero} aria-labelledby="blog-page-title">
              <p className={styles.heroEyebrow}>
                <span className={styles.heroEyebrowDesktop}>
                  Centro de Imprensa
                </span>
                <span className={styles.heroEyebrowMobile}>
                  Blog e novidades
                </span>
              </p>
              <h1 id="blog-page-title" className={styles.heroTitle}>
                <span className={styles.heroTitleDesktop}>
                  Blog e novidades.
                </span>
                <span className={styles.heroTitleMobile}>
                  Centro de Imprensa
                </span>
              </h1>
              <p className={styles.heroSubtitle}>
                Artigos, dicas de carreira, novidades do EmpregoSTP e histórias
                de sucesso da maior plataforma de emprego em São Tomé e
                Príncipe.
              </p>
            </section>

            {featuredPost ? (
              <article className={styles.featuredCard}>
                <div className={styles.featuredMedia}>
                  <BlogImage
                    post={featuredPost}
                    priority
                    className={styles.featuredMediaImage}
                    fallbackClassName={styles.featuredMediaFallback}
                  />
                  <span className={styles.featuredCategory}>
                    {featuredPost.category}
                  </span>
                </div>
                <div className={styles.featuredBody}>
                  <div className={styles.featuredMetaDesktop}>
                    <span>
                      <FiCalendar aria-hidden="true" />
                      {formatDate(featuredPost.createdAt)}
                    </span>
                    <span className={styles.metaDot} aria-hidden="true" />
                    <span>
                      <FiClock aria-hidden="true" />
                      {featuredPost.readTime} leitura
                    </span>
                  </div>
                  <h2 className={styles.featuredTitle}>
                    <Link href={`/blog/${featuredPost.id}`}>
                      {featuredPost.title}
                    </Link>
                  </h2>
                  <p className={styles.featuredExcerpt}>
                    {featuredPost.excerpt}
                  </p>
                  <div className={styles.featuredMetaMobile}>
                    <span>
                      <FiClock aria-hidden="true" />
                      {featuredPost.readTime}
                    </span>
                    <span className={styles.metaDot} aria-hidden="true" />
                    <span>{formatDate(featuredPost.createdAt)}</span>
                  </div>
                  <span className={styles.srOnly}>
                    {featuredPost.views} visualizações
                  </span>
                  <Link
                    href={`/blog/${featuredPost.id}`}
                    className={styles.featuredButton}
                  >
                    Ler artigo
                    <FiArrowRight
                      className={styles.inlineIcon}
                      aria-hidden="true"
                    />
                  </Link>
                </div>
              </article>
            ) : (
              <section className={styles.emptyFeatured} aria-live="polite">
                <h2>Nenhum artigo publicado</h2>
                <p>
                  Assim que houver novas publicações, elas aparecerão nesta
                  página.
                </p>
              </section>
            )}

            <div className={styles.editorialGrid}>
              <section
                className={styles.recentSection}
                aria-labelledby="recent-posts-title"
              >
                <div className={styles.recentHeader}>
                  <h2 id="recent-posts-title" className={styles.sectionTitle}>
                    Publicações recentes
                  </h2>
                  <div className={styles.recentControls}>
                    <div
                      className={styles.categories}
                      role="group"
                      aria-label="Filtrar publicações por categoria"
                    >
                      {categories.map((category) => {
                        const active = activeCategory === category.id;
                        return (
                          <button
                            key={category.id}
                            type="button"
                            className={`${styles.categoryTab} ${
                              active ? styles.categoryTabActive : ''
                            }`}
                            onClick={() => handleCategoryChange(category.id)}
                            aria-pressed={active}
                          >
                            {category.label}
                          </button>
                        );
                      })}
                    </div>
                    <button
                      type="button"
                      className={`${styles.searchToggle} ${
                        searchQuery ? styles.searchToggleActive : ''
                      }`}
                      onClick={() => setSearchOpen((open) => !open)}
                      aria-expanded={searchOpen}
                      aria-controls="blog-search-panel"
                      aria-label={
                        searchOpen
                          ? 'Fechar pesquisa de artigos'
                          : 'Pesquisar artigos'
                      }
                    >
                      {searchOpen ? (
                        <FiX aria-hidden="true" />
                      ) : (
                        <FiSearch aria-hidden="true" />
                      )}
                    </button>
                  </div>
                </div>

                {searchOpen ? (
                  <div id="blog-search-panel" className={styles.searchPanel}>
                    <FiSearch aria-hidden="true" />
                    <input
                      type="search"
                      autoFocus
                      placeholder="Pesquisar por título ou tema…"
                      aria-label="Pesquisar artigos do blog"
                      value={searchQuery}
                      onChange={(event) => {
                        setSearchQuery(event.target.value);
                        setVisiblePostCount(POSTS_BATCH_SIZE);
                      }}
                    />
                  </div>
                ) : null}

                <p className={styles.srOnly} role="status" aria-live="polite">
                  {filteredPosts.length === 1
                    ? '1 publicação encontrada'
                    : `${filteredPosts.length} publicações encontradas`}
                </p>

                {visiblePosts.length > 0 ? (
                  <div className={styles.postsGrid}>
                    {visiblePosts.map((post) => (
                      <article key={post.id} className={styles.postCard}>
                        <Link
                          href={`/blog/${post.id}`}
                          className={styles.postCardLink}
                        >
                          <div className={styles.postMedia}>
                            <BlogImage
                              post={post}
                              className={styles.postMediaImage}
                              fallbackClassName={styles.postMediaFallback}
                            />
                            <span className={styles.postCategoryDesktop}>
                              {post.category}
                            </span>
                          </div>
                          <div className={styles.postBody}>
                            <span className={styles.postCategoryMobile}>
                              {post.category}
                            </span>
                            <div className={styles.postMetaDesktop}>
                              <span>{formatDate(post.createdAt)}</span>
                              <span
                                className={styles.metaDot}
                                aria-hidden="true"
                              />
                              <span>{post.readTime} leitura</span>
                            </div>
                            <h3 className={styles.postTitle}>{post.title}</h3>
                            <p className={styles.postExcerpt}>{post.excerpt}</p>
                            <div className={styles.postMetaMobile}>
                              <span>{post.author}</span>
                              <span
                                className={styles.metaDot}
                                aria-hidden="true"
                              />
                              <span>{post.readTime}</span>
                            </div>
                            <span className={styles.postReadMore}>
                              Ler mais
                              <FiArrowRight aria-hidden="true" />
                            </span>
                            <span className={styles.srOnly}>
                              {post.views} visualizações
                            </span>
                          </div>
                        </Link>
                      </article>
                    ))}
                  </div>
                ) : (
                  <div className={styles.emptyState}>
                    <h3 className={styles.emptyTitle}>
                      {featuredPost
                        ? 'Sem outras publicações nesta seleção'
                        : 'Nenhum artigo encontrado'}
                    </h3>
                    <p className={styles.emptyText}>
                      Ajuste a pesquisa ou escolha outra categoria para ver mais
                      publicações.
                    </p>
                  </div>
                )}

                {canLoadMore ? (
                  <button
                    type="button"
                    className={styles.loadMoreButton}
                    onClick={() =>
                      setVisiblePostCount(
                        (current) => current + POSTS_BATCH_SIZE,
                      )
                    }
                  >
                    Carregar mais publicações
                  </button>
                ) : null}
              </section>

              <section
                className={styles.newsletter}
                aria-labelledby="newsletter-title"
              >
                <span className={styles.newsletterIcon} aria-hidden="true">
                  <FiMail />
                </span>
                <h2 id="newsletter-title" className={styles.newsletterTitle}>
                  Receba novidades do mercado de trabalho
                </h2>
                <p className={styles.newsletterText}>
                  Inscreva-se na nossa newsletter semanal para receber as
                  melhores dicas e vagas diretamente no seu email.
                </p>
                <form
                  className={styles.newsletterForm}
                  onSubmit={handleNewsletterSubmit}
                >
                  <input
                    type="email"
                    placeholder="O seu email profissional"
                    aria-label="Email para subscrever a newsletter"
                    className={styles.newsletterInput}
                    value={newsletterEmail}
                    onChange={(event) => {
                      setNewsletterEmail(event.target.value);
                      if (newsletterState.status !== 'idle') {
                        setNewsletterState({ status: 'idle', message: '' });
                      }
                    }}
                    disabled={newsletterState.status === 'loading'}
                  />
                  <button
                    type="submit"
                    className={styles.newsletterButton}
                    disabled={newsletterState.status === 'loading'}
                  >
                    {newsletterState.status === 'loading'
                      ? 'A subscrever…'
                      : 'Subscrever'}
                  </button>
                  {newsletterState.message ? (
                    <p
                      className={`${styles.newsletterFeedback} ${
                        newsletterState.status === 'error'
                          ? styles.newsletterFeedbackError
                          : styles.newsletterFeedbackSuccess
                      }`}
                      role="status"
                      aria-live="polite"
                    >
                      {newsletterState.message}
                    </p>
                  ) : null}
                </form>
              </section>

              <section
                className={styles.categoryPanel}
                aria-labelledby="blog-categories-title"
              >
                <h2 id="blog-categories-title" className={styles.panelTitle}>
                  Categorias
                </h2>
                <div className={styles.categoryList}>
                  {categories
                    .filter((item) => item.id !== 'todos')
                    .map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        className={styles.categoryListItem}
                        onClick={() => handleCategoryChange(item.id)}
                        aria-pressed={activeCategory === item.id}
                      >
                        <span>{item.label}</span>
                        <span className={styles.categoryListCount}>
                          {item.count}
                        </span>
                      </button>
                    ))}
                </div>
              </section>

              <section
                className={styles.updatesPanel}
                aria-labelledby="quick-updates-title"
              >
                <h2 id="quick-updates-title" className={styles.panelTitle}>
                  <span className={styles.updatesBolt} aria-hidden="true">
                    ↯
                  </span>
                  Atualizações rápidas
                </h2>
                <div className={styles.newsList}>
                  {news.length > 0 ? (
                    news.map((item) => (
                      <article key={item.id} className={styles.newsItem}>
                        <div className={styles.newsHeading}>
                          <h3 className={styles.newsTitle}>{item.title}</h3>
                          <FiExternalLink aria-hidden="true" />
                        </div>
                        <div className={styles.newsMeta}>
                          <span className={styles.newsCategory}>
                            {item.category}
                          </span>
                          <span className={styles.newsDate}>{item.date}</span>
                        </div>
                      </article>
                    ))
                  ) : (
                    <p className={styles.panelEmptyText}>
                      Ainda não existem atualizações recentes publicadas.
                    </p>
                  )}
                </div>
              </section>
            </div>
          </div>
        </div>
      </PublicPageShell>
    </>
  );
}
