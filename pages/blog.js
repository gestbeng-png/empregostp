import Head from "next/head";
import Link from "next/link";
import { useMemo, useState } from "react";
import PublicPageShell from "../components/PublicPageShell";
import { admin } from "../lib/firebaseAdmin";
import {
  safeText,
  safeTimestampToISOString,
  safeTimestampToMillis,
} from "../lib/firestoreNormalize";
import {
  isContentPublished,
  normalizeContentStatus,
} from "../lib/contentPublication";
import styles from "../styles/BlogPage.module.css";

export async function getServerSideProps(context) {
  const fetchWithFallback = async (collectionName) => {
    const collectionRef = admin.firestore().collection(collectionName);
    try {
      return await collectionRef.orderBy("createdAt", "desc").get();
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
      "Cache-Control",
      "public, s-maxage=60, stale-while-revalidate=300",
    );

    const [postsSnapshot, newsSnapshot] = await Promise.all([
      fetchWithFallback("posts"),
      fetchWithFallback("news"),
    ]);

    const posts = postsSnapshot.docs
      .map((doc) => {
        const data = doc.data() || {};
        const createdAt = safeTimestampToISOString(data.createdAt);
        const updatedAt = safeTimestampToISOString(data.updatedAt);

        return {
          id: doc.id,
          title: safeText(data.title, "Sem título"),
          excerpt: safeText(data.excerpt, ""),
          category: safeText(data.category, "Geral"),
          author: safeText(data.author, "EmpregoSTP"),
          image: safeText(data.image, ""),
          readTime: safeText(data.readTime, "5 min"),
          color: safeText(data.color, "#2057d7"),
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
          title: safeText(data.title, "Sem título"),
          category: safeText(data.category, "Atualização"),
          date: safeText(
            data.date,
            createdAt ? new Date(createdAt).toLocaleDateString("pt-PT") : "",
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
    console.error("Error fetching blog data:", error);
    return {
      props: {
        initialPosts: [],
        initialNews: [],
      },
    };
  }
}

const icons = {
  clock: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  ),
  eye: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  ),
  arrow: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <line x1="5" y1="12" x2="19" y2="12" />
      <polyline points="12 5 19 12 12 19" />
    </svg>
  ),
  search: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="11" cy="11" r="8" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  ),
  trending: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
      <polyline points="17 6 23 6 23 12" />
    </svg>
  ),
  users: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" />
    </svg>
  ),
};

function formatDate(value) {
  if (!value) return "Data desconhecida";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("pt-PT", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export default function BlogPage({ initialPosts = [], initialNews = [] }) {
  const [activeCategory, setActiveCategory] = useState("todos");
  const [searchQuery, setSearchQuery] = useState("");
  const posts = initialPosts;
  const news = initialNews;

  const categories = useMemo(
    () => [
      { id: "todos", label: "Todos", count: posts.length },
      ...Array.from(
        new Set(posts.map((post) => post.category).filter(Boolean)),
      ).map((category) => ({
        id: category,
        label: category,
        count: posts.filter((post) => post.category === category).length,
      })),
    ],
    [posts],
  );

  const filteredPosts = useMemo(() => {
    const normalizedSearch = searchQuery.toLowerCase().trim();
    return posts.filter((post) => {
      const matchesCategory =
        activeCategory === "todos" || post.category === activeCategory;
      const matchesSearch =
        !normalizedSearch ||
        post.title.toLowerCase().includes(normalizedSearch) ||
        post.excerpt?.toLowerCase().includes(normalizedSearch);
      return matchesCategory && matchesSearch;
    });
  }, [activeCategory, posts, searchQuery]);

  const featuredPost = filteredPosts[0] || null;
  const remainingPosts = filteredPosts.slice(featuredPost ? 1 : 0);

  const handleNewsletterSubmit = (event) => {
    event.preventDefault();
    alert("Obrigado por subscrever! Receberá novidades em breve.");
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
        <main className={styles.page}>
          <section className={styles.hero}>
            <div className={styles.heroInner}>
              <div className={styles.heroBadge}>
                <span className={styles.heroBadgeIcon}>{icons.trending}</span>
                <span>Centro de imprensa</span>
              </div>
              <h1 className={styles.heroTitle}>Blog & Novidades</h1>
              <p className={styles.heroSubtitle}>
                Artigos, dicas de carreira, novidades do EmpregoSTP e histórias
                de sucesso da maior plataforma de emprego em São Tomé e
                Príncipe.
              </p>

              <div className={styles.searchBar}>
                <span className={styles.searchIcon}>{icons.search}</span>
                <input
                  type="text"
                  placeholder="Pesquisar artigos..."
                  aria-label="Pesquisar artigos do blog"
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  className={styles.searchInput}
                />
              </div>
            </div>
          </section>

          <section className={styles.content}>
            {featuredPost ? (
              <article className={styles.featuredCard}>
                <div
                  className={styles.featuredMedia}
                  style={{
                    backgroundImage: `linear-gradient(180deg, rgba(30, 43, 77, 0.08), rgba(30, 43, 77, 0.28)), url(${
                      featuredPost.image ||
                      "https://via.placeholder.com/1200x800?text=EmpregoSTP"
                    })`,
                  }}
                />
                <div className={styles.featuredBody}>
                  <span
                    className={styles.categoryPill}
                    style={{
                      "--category-bg": `${featuredPost.color || "#2057d7"}18`,
                      "--category-border": `${featuredPost.color || "#2057d7"}30`,
                      "--category-color": featuredPost.color || "#2057d7",
                    }}
                  >
                    {featuredPost.category}
                  </span>
                  <h2 className={styles.featuredTitle}>{featuredPost.title}</h2>
                  <p className={styles.featuredExcerpt}>
                    {featuredPost.excerpt}
                  </p>
                  <div className={styles.metaRow}>
                    <span className={styles.metaItem}>
                      {icons.clock}
                      {featuredPost.readTime}
                    </span>
                    <span className={styles.metaItem}>
                      {icons.eye}
                      {featuredPost.views} visualizações
                    </span>
                    <span className={styles.metaItem}>
                      {formatDate(featuredPost.createdAt)}
                    </span>
                  </div>
                  <Link
                    href={`/blog/${featuredPost.id}`}
                    className={styles.featuredButton}
                  >
                    Ler artigo
                    <span className={styles.inlineIcon}>{icons.arrow}</span>
                  </Link>
                </div>
              </article>
            ) : null}

            <div className={styles.layout}>
              <div className={styles.mainColumn}>
                <div className={styles.sectionHeader}>
                  <div>
                    <p className={styles.sectionEyebrow}>Explorar</p>
                    <h2 className={styles.sectionTitle}>
                      Publicações recentes
                    </h2>
                  </div>
                  <div className={styles.categories}>
                    {categories.map((category) => {
                      const active = activeCategory === category.id;
                      return (
                        <button
                          key={category.id}
                          type="button"
                          className={`${styles.categoryTab} ${
                            active ? styles.categoryTabActive : ""
                          }`}
                          onClick={() => setActiveCategory(category.id)}
                        >
                          {category.label}
                          <span className={styles.categoryCount}>
                            {category.count}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {remainingPosts.length > 0 ? (
                  <div className={styles.postsGrid}>
                    {remainingPosts.map((post) => (
                      <Link
                        key={post.id}
                        href={`/blog/${post.id}`}
                        className={styles.postCard}
                      >
                        <span
                          className={styles.categoryPill}
                          style={{
                            "--category-bg": `${post.color || "#2057d7"}18`,
                            "--category-border": `${post.color || "#2057d7"}30`,
                            "--category-color": post.color || "#2057d7",
                          }}
                        >
                          {post.category}
                        </span>
                        <h3 className={styles.postTitle}>{post.title}</h3>
                        <p className={styles.postExcerpt}>{post.excerpt}</p>
                        <div className={styles.postFooter}>
                          <span className={styles.postAuthor}>
                            {post.author}
                          </span>
                          <div className={styles.postMeta}>
                            <span className={styles.postMetaItem}>
                              {icons.clock}
                              {post.readTime}
                            </span>
                            <span className={styles.postMetaItem}>
                              {icons.eye}
                              {post.views}
                            </span>
                          </div>
                        </div>
                      </Link>
                    ))}
                  </div>
                ) : (
                  <div className={styles.emptyState}>
                    <h3 className={styles.emptyTitle}>
                      Nenhum artigo encontrado
                    </h3>
                    <p className={styles.emptyText}>
                      Ajuste a pesquisa ou escolha outra categoria para ver mais
                      publicações.
                    </p>
                  </div>
                )}
              </div>

              <aside className={styles.sidebar}>
                <section className={styles.sidebarCard}>
                  <h3 className={styles.sidebarTitle}>
                    <span className={styles.sidebarIcon}>{icons.trending}</span>
                    Atualizações rápidas
                  </h3>
                  <div className={styles.newsList}>
                    {news.length > 0 ? (
                      news.map((item) => (
                        <article key={item.id} className={styles.newsItem}>
                          <p className={styles.newsCategory}>{item.category}</p>
                          <h4 className={styles.newsTitle}>{item.title}</h4>
                          <p className={styles.newsDate}>{item.date}</p>
                        </article>
                      ))
                    ) : (
                      <p className={styles.sidebarText}>
                        Ainda não existem atualizações recentes publicadas.
                      </p>
                    )}
                  </div>
                </section>

                <section className={styles.sidebarCard}>
                  <h3 className={styles.sidebarTitle}>
                    <span className={styles.sidebarIcon}>{icons.users}</span>
                    Categorias
                  </h3>
                  <div className={styles.sidebarCategoryList}>
                    {categories
                      .filter((item) => item.id !== "todos")
                      .map((item) => (
                        <button
                          key={item.id}
                          type="button"
                          className={styles.sidebarCategoryItem}
                          onClick={() => setActiveCategory(item.id)}
                        >
                          <span>{item.label}</span>
                          <span className={styles.sidebarCategoryCount}>
                            {item.count}
                          </span>
                        </button>
                      ))}
                  </div>
                </section>
              </aside>
            </div>

            <section className={styles.newsletter}>
              <div className={styles.newsletterCopy}>
                <p className={styles.sectionEyebrow}>Newsletter</p>
                <h2 className={styles.newsletterTitle}>
                  Receba novidades do mercado de trabalho
                </h2>
                <p className={styles.newsletterText}>
                  Subscreva para acompanhar novos artigos, atualizações do
                  EmpregoSTP e tendências de carreira em São Tomé e Príncipe.
                </p>
              </div>
              <form
                className={styles.newsletterForm}
                onSubmit={handleNewsletterSubmit}
              >
                <input
                  type="email"
                  placeholder="Seu email"
                  aria-label="Seu email"
                  className={styles.newsletterInput}
                />
                <button type="submit" className={styles.newsletterButton}>
                  Subscrever
                </button>
              </form>
            </section>
          </section>
        </main>
      </PublicPageShell>
    </>
  );
}
