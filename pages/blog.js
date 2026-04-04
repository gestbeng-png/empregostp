import Head from 'next/head';
import { useState } from 'react';
import Link from 'next/link';
import LandingHeader from '../components/LandingHeader';
import Footer from '../components/home/Footer';
import { admin } from '../lib/firebaseAdmin';
import { safeText, safeTimestampToISOString, safeTimestampToMillis } from '../lib/firestoreNormalize';
import { isContentPublished, normalizeContentStatus } from '../lib/contentPublication';

export async function getServerSideProps() {
  const fetchWithFallback = async (collectionName) => {
    const collectionRef = admin.firestore().collection(collectionName);
    try {
      return await collectionRef.orderBy('createdAt', 'desc').get();
    } catch (error) {
      console.warn(`[blog] fallback sem orderBy em ${collectionName}:`, error?.message || error);
      return collectionRef.get();
    }
  };

  const sortByRecent = (a, b) => {
    const aScore = a.createdAtMs || a.updatedAtMs || 0;
    const bScore = b.createdAtMs || b.updatedAtMs || 0;
    return bScore - aScore;
  };

  try {
    const [postsSnapshot, newsSnapshot] = await Promise.all([
      fetchWithFallback('posts'),
      fetchWithFallback('news')
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
          color: safeText(data.color, '#6366f1'),
          views: Number(data.views) || 0,
          featured: Boolean(data.featured),
          status: normalizeContentStatus(data.status),
          createdAt,
          updatedAt,
          createdAtMs: safeTimestampToMillis(data.createdAt),
          updatedAtMs: safeTimestampToMillis(data.updatedAt)
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
          date: safeText(data.date, createdAt ? new Date(createdAt).toLocaleDateString() : ''),
          status: normalizeContentStatus(data.status),
          createdAt,
          updatedAt,
          createdAtMs: safeTimestampToMillis(data.createdAt),
          updatedAtMs: safeTimestampToMillis(data.updatedAt)
        };
      })
      .filter((item) => isContentPublished(item.status))
      .sort(sortByRecent)
      .slice(0, 8)
      .map(({ createdAtMs, updatedAtMs, ...item }) => item);

    return {
      props: {
        initialPosts: posts || [],
        initialNews: news || []
      }
    };
  } catch (error) {
    console.error('Error fetching blog data:', error);
    return {
      props: {
        initialPosts: [],
        initialNews: []
      }
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
  bookmark: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2z" />
    </svg>
  ),
  share: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="18" cy="5" r="3" />
      <circle cx="6" cy="12" r="3" />
      <circle cx="18" cy="19" r="3" />
      <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
      <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
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
  briefcase: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="2" y="7" width="20" height="14" rx="2" />
      <path d="M16 7V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v2" />
    </svg>
  ),
  check: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  )
};

// Initial states for data that will be fetched
const INITIAL_POSTS = [];
const INITIAL_STATS = [];

export default function BlogPage({ initialPosts = [], initialNews = [] }) {
  const [activeCategory, setActiveCategory] = useState('todos');
  const [searchQuery, setSearchQuery] = useState('');
  const [emailNewsletter, setEmailNewsletter] = useState('');
  const [posts] = useState(initialPosts);
  const [loading] = useState(false);
  const [stats] = useState(INITIAL_STATS);
  const [news] = useState(initialNews);

  // Derived state for categories
  const categories = [
    { id: 'todos', label: 'Todos', count: posts.length },
    ...Array.from(new Set(posts.map((p) => p.category).filter(Boolean))).map(cat => ({
      id: cat,
      label: cat,
      count: posts.filter(p => p.category === cat).length
    }))
  ];

  // Featured post is the first one
  const featuredPost = posts[0];

  const handleNewsletterSubmit = (e) => {
    e.preventDefault();
    alert('Obrigado por subscrever! Recebera nossas novidades em breve.');
    setEmailNewsletter('');
  };

  const filteredPosts = posts.filter(post => {
    const matchesCategory = activeCategory === 'todos' || post.category === activeCategory;
    const matchesSearch = post.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      post.excerpt?.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const styles = {
    page: {
      minHeight: '100vh',
      backgroundColor: '#09090b',
      color: '#fff' // Ensure base color is white
    },
    hero: {
      background: 'linear-gradient(135deg, #09090b 0%, #18181b 100%)',
      padding: '4rem 0 3rem',
      position: 'relative',
      overflow: 'hidden'
    },
    heroGlow1: {
      position: 'absolute',
      top: '-20%',
      right: '10%',
      width: '600px',
      height: '600px',
      background: 'radial-gradient(circle, rgba(99, 102, 241, 0.08) 0%, transparent 70%)',
      borderRadius: '50%',
      filter: 'blur(100px)',
      pointerEvents: 'none'
    },
    heroGlow2: {
      position: 'absolute',
      bottom: '-30%',
      left: '5%',
      width: '500px',
      height: '500px',
      background: 'radial-gradient(circle, rgba(16, 185, 129, 0.06) 0%, transparent 70%)',
      borderRadius: '50%',
      filter: 'blur(80px)',
      pointerEvents: 'none'
    },
    container: {
      maxWidth: '1200px',
      margin: '0 auto',
      padding: '0 2rem',
      position: 'relative',
      zIndex: 1
    },
    heroContent: {
      textAlign: 'center',
      marginBottom: '2.5rem'
    },
    badge: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: '0.5rem',
      padding: '0.5rem 1rem',
      background: 'rgba(99, 102, 241, 0.1)',
      border: '1px solid rgba(99, 102, 241, 0.2)',
      borderRadius: '100px',
      marginBottom: '1.5rem'
    },
    badgeIcon: {
      width: '18px',
      height: '18px',
      color: '#6366f1'
    },
    badgeText: {
      color: '#a5b4fc',
      fontSize: '0.85rem',
      fontWeight: 600
    },
    title: {
      margin: '0 0 1rem',
      fontSize: 'clamp(2rem, 4vw, 3rem)',
      fontWeight: 800,
      color: '#fafafa',
      letterSpacing: '-0.02em',
      lineHeight: 1.2
    },
    subtitle: {
      margin: '0 auto',
      maxWidth: '650px',
      fontSize: '1.1rem',
      color: '#a1a1aa',
      lineHeight: 1.7
    },
    searchBar: {
      maxWidth: '600px',
      margin: '2rem auto 0',
      position: 'relative'
    },
    searchIcon: {
      position: 'absolute',
      left: '1.25rem',
      top: '50%',
      transform: 'translateY(-50%)',
      width: '20px',
      height: '20px',
      color: '#52525b'
    },
    searchInput: {
      width: '100%',
      padding: '1rem 1.25rem 1rem 3.5rem',
      background: 'rgba(255, 255, 255, 0.03)',
      border: '1px solid rgba(255, 255, 255, 0.08)',
      borderRadius: '14px',
      color: '#fafafa',
      fontSize: '1rem',
      outline: 'none',
      transition: 'all 0.2s ease'
    },
    section: {
      padding: '3rem 0'
    },
    sectionHeader: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: '1.5rem',
      flexWrap: 'wrap',
      gap: '1rem'
    },
    sectionTitle: {
      margin: 0,
      fontSize: '1.5rem',
      fontWeight: 700,
      color: '#fafafa',
      display: 'flex',
      alignItems: 'center',
      gap: '0.75rem'
    },
    sectionTitleIcon: {
      width: '24px',
      height: '24px',
      color: '#6366f1'
    },
    viewAll: {
      display: 'flex',
      alignItems: 'center',
      gap: '0.5rem',
      color: '#a5b4fc',
      fontSize: '0.9rem',
      fontWeight: 600,
      textDecoration: 'none',
      transition: 'all 0.2s ease'
    },
    viewAllIcon: {
      width: '16px',
      height: '16px'
    },
    featuredCard: {
      display: 'grid',
      gridTemplateColumns: '1fr 1fr',
      gap: '2rem',
      background: 'rgba(255, 255, 255, 0.02)',
      border: '1px solid rgba(255, 255, 255, 0.06)',
      borderRadius: '20px',
      overflow: 'hidden',
      marginBottom: '3rem',
      transition: 'all 0.3s ease'
    },
    featuredImage: {
      height: '100%',
      minHeight: '350px',
      backgroundSize: 'cover',
      backgroundPosition: 'center',
      position: 'relative'
    },
    featuredImageOverlay: {
      position: 'absolute',
      inset: 0,
      background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.3) 0%, transparent 100%)'
    },
    featuredContent: {
      padding: '2.5rem 2.5rem 2.5rem 0',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center'
    },
    featuredCategory: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: '0.5rem',
      padding: '0.4rem 0.875rem',
      background: 'rgba(99, 102, 241, 0.15)',
      borderRadius: '8px',
      color: '#a5b4fc',
      fontSize: '0.75rem',
      fontWeight: 700,
      textTransform: 'uppercase',
      letterSpacing: '0.05em',
      marginBottom: '1.25rem',
      width: 'fit-content'
    },
    featuredTitle: {
      margin: '0 0 1rem',
      fontSize: '1.75rem',
      fontWeight: 700,
      color: '#fafafa',
      lineHeight: 1.3,
      letterSpacing: '-0.01em'
    },
    featuredExcerpt: {
      margin: '0 0 1.5rem',
      color: '#a1a1aa',
      lineHeight: 1.7,
      fontSize: '1rem'
    },
    featuredMeta: {
      display: 'flex',
      alignItems: 'center',
      gap: '1.5rem',
      flexWrap: 'wrap'
    },
    metaItem: {
      display: 'flex',
      alignItems: 'center',
      gap: '0.4rem',
      color: '#71717a',
      fontSize: '0.85rem'
    },
    metaIcon: {
      width: '16px',
      height: '16px'
    },
    featuredButton: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: '0.5rem',
      padding: '0.875rem 1.5rem',
      background: '#6366f1',
      color: '#fff',
      border: 'none',
      borderRadius: '10px',
      fontSize: '0.9rem',
      fontWeight: 600,
      cursor: 'pointer',
      transition: 'all 0.2s ease',
      marginTop: '1.5rem',
      width: 'fit-content'
    },
    categories: {
      display: 'flex',
      gap: '0.5rem',
      marginBottom: '2rem',
      flexWrap: 'wrap'
    },
    categoryBtn: {
      padding: '0.6rem 1.25rem',
      background: 'rgba(255, 255, 255, 0.03)',
      border: '1px solid rgba(255, 255, 255, 0.06)',
      borderRadius: '10px',
      color: '#a1a1aa',
      fontSize: '0.85rem',
      fontWeight: 500,
      cursor: 'pointer',
      transition: 'all 0.15s ease'
    },
    categoryBtnActive: {
      background: 'rgba(99, 102, 241, 0.15)',
      borderColor: 'rgba(99, 102, 241, 0.3)',
      color: '#a5b4fc'
    },
    postsGrid: {
      display: 'grid',
      gridTemplateColumns: 'repeat(3, 1fr)',
      gap: '1.5rem'
    },
    postCard: {
      background: 'rgba(255, 255, 255, 0.02)',
      border: '1px solid rgba(255, 255, 255, 0.06)',
      borderRadius: '16px',
      padding: '1.5rem',
      display: 'flex',
      flexDirection: 'column',
      gap: '1rem',
      transition: 'all 0.2s ease',
      cursor: 'pointer'
    },
    postCategory: {
      display: 'inline-flex',
      padding: '0.35rem 0.75rem',
      borderRadius: '6px',
      fontSize: '0.7rem',
      fontWeight: 700,
      textTransform: 'uppercase',
      letterSpacing: '0.05em',
      width: 'fit-content'
    },
    postTitle: {
      margin: 0,
      fontSize: '1.1rem',
      fontWeight: 600,
      color: '#fafafa',
      lineHeight: 1.4
    },
    postExcerpt: {
      margin: 0,
      color: '#71717a',
      fontSize: '0.9rem',
      lineHeight: 1.6,
      flex: 1
    },
    postFooter: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingTop: '1rem',
      borderTop: '1px solid rgba(255, 255, 255, 0.04)'
    },
    postAuthor: {
      color: '#a1a1aa',
      fontSize: '0.8rem',
      fontWeight: 500
    },
    postMeta: {
      display: 'flex',
      alignItems: 'center',
      gap: '0.75rem'
    },
    postMetaItem: {
      display: 'flex',
      alignItems: 'center',
      gap: '0.3rem',
      color: '#52525b',
      fontSize: '0.75rem'
    },
    postMetaIcon: {
      width: '14px',
      height: '14px'
    },
    sidebar: {
      display: 'flex',
      flexDirection: 'column',
      gap: '1.5rem'
    },
    sidebarCard: {
      background: 'rgba(255, 255, 255, 0.02)',
      border: '1px solid rgba(255, 255, 255, 0.06)',
      borderRadius: '16px',
      padding: '1.5rem'
    },
    sidebarTitle: {
      margin: '0 0 1.25rem',
      fontSize: '1rem',
      fontWeight: 600,
      color: '#fafafa',
      display: 'flex',
      alignItems: 'center',
      gap: '0.5rem'
    },
    sidebarIcon: {
      width: '18px',
      height: '18px',
      color: '#6366f1'
    },
    newsList: {
      display: 'flex',
      flexDirection: 'column',
      gap: '1rem'
    },
    newsItem: {
      paddingBottom: '1rem',
      borderBottom: '1px solid rgba(255, 255, 255, 0.04)'
    },
    newsItemLast: {
      borderBottom: 'none',
      paddingBottom: 0
    },
    newsCategory: {
      fontSize: '0.7rem',
      fontWeight: 700,
      textTransform: 'uppercase',
      letterSpacing: '0.05em',
      color: '#6366f1',
      marginBottom: '0.35rem'
    },
    newsTitle: {
      margin: '0 0 0.35rem',
      fontSize: '0.9rem',
      fontWeight: 600,
      color: '#e4e4e7',
      lineHeight: 1.4
    },
    newsDate: {
      fontSize: '0.75rem',
      color: '#52525b'
    },
    categoriesList: {
      display: 'flex',
      flexDirection: 'column',
      gap: '0.5rem'
    },
    categoryItem: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: '0.75rem 1rem',
      background: 'rgba(255, 255, 255, 0.02)',
      borderRadius: '10px',
      cursor: 'pointer',
      transition: 'all 0.15s ease'
    },
    categoryLabel: {
      color: '#a1a1aa',
      fontSize: '0.85rem',
      fontWeight: 500
    },
    categoryCount: {
      padding: '0.2rem 0.6rem',
      background: 'rgba(99, 102, 241, 0.1)',
      borderRadius: '6px',
      color: '#a5b4fc',
      fontSize: '0.75rem',
      fontWeight: 600
    },
    mainGrid: {
      display: 'grid',
      gridTemplateColumns: '1fr 320px',
      gap: '2rem'
    },
    newsletter: {
      background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.1) 0%, rgba(16, 185, 129, 0.05) 100%)',
      border: '1px solid rgba(99, 102, 241, 0.2)',
      borderRadius: '20px',
      padding: '3rem',
      textAlign: 'center',
      marginTop: '3rem'
    },
    newsletterTitle: {
      margin: '0 0 0.75rem',
      fontSize: '1.5rem',
      fontWeight: 700,
      color: '#fafafa'
    },
    newsletterText: {
      margin: '0 0 1.5rem',
      color: '#a1a1aa',
      fontSize: '1rem',
      maxWidth: '500px',
      marginLeft: 'auto',
      marginRight: 'auto'
    },
    newsletterForm: {
      display: 'flex',
      gap: '0.75rem',
      maxWidth: '450px',
      margin: '0 auto'
    },
    newsletterInput: {
      flex: 1,
      padding: '0.875rem 1.25rem',
      background: 'rgba(255, 255, 255, 0.05)',
      border: '1px solid rgba(255, 255, 255, 0.1)',
      borderRadius: '10px',
      color: '#fafafa',
      fontSize: '0.95rem',
      outline: 'none'
    },
    newsletterButton: {
      padding: '0.875rem 1.75rem',
      background: '#6366f1',
      color: '#fff',
      border: 'none',
      borderRadius: '10px',
      fontSize: '0.95rem',
      fontWeight: 600,
      cursor: 'pointer',
      transition: 'all 0.2s ease',
      whiteSpace: 'nowrap'
    }
  };

  return (
    <>
      <Head>
        <title>Blog | EmpregoSTP</title>
        <meta name="description" content="Artigos, dicas de carreira, novidades e histórias de sucesso da maior plataforma de emprego em São Tomé e Príncipe." />
      </Head>

      <div style={styles.page} className="blogPage">
        <LandingHeader />

        {/* Hero */}
        <section style={styles.hero} className="blogHero">
          <div style={styles.heroGlow1} />
          <div style={styles.heroGlow2} />

          <div style={styles.container} className="blogContainer">
            <div style={styles.heroContent}>
              <div style={styles.badge}>
                <span style={styles.badgeIcon}>{icons.trending}</span>
                <span style={styles.badgeText}>Centro de Imprensa</span>
              </div>

              <h1 style={styles.title}>Blog & Novidades</h1>
              <p style={styles.subtitle}>
                Artigos, dicas de carreira, novidades do EmpregoSTP e histórias de sucesso
                da maior plataforma de emprego em São Tomé e Príncipe.
              </p>

              <div style={styles.searchBar}>
                <span style={styles.searchIcon}>{icons.search}</span>
                <input
                  type="text"
                  placeholder="Pesquisar artigos..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  style={styles.searchInput}
                />
              </div>
            </div>
          </div>
        </section>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '6rem 2rem' }}>
            <div style={{
              width: '44px', height: '44px', margin: '0 auto 1.25rem',
              border: '3px solid rgba(99,102,241,0.15)',
              borderTop: '3px solid #6366f1',
              borderRadius: '50%',
              animation: 'blogSpin 1s linear infinite',
            }} />
            <style>{`@keyframes blogSpin { to { transform: rotate(360deg); } }`}</style>
            <p style={{ color: '#71717a', fontSize: '1rem' }}>A carregar artigos...</p>
          </div>
        ) : (
          <>

            {/* Featured Post — comes first */}
            {featuredPost && (
              <section style={{ ...styles.section, paddingTop: '3rem' }}>
                <div style={styles.container} className="blogContainer">
                  <div style={styles.featuredCard} className="blogFeaturedCard">
                    <div
                      style={{ ...styles.featuredImage, backgroundImage: `url(${featuredPost.image})` }}
                      className="blogFeaturedImage"
                    >
                      <div style={styles.featuredImageOverlay} />
                    </div>
                    <div style={styles.featuredContent} className="blogFeaturedContent">
                      <span style={styles.featuredCategory}>{featuredPost.category}</span>
                      <h2 style={styles.featuredTitle}>{featuredPost.title}</h2>
                      <p style={styles.featuredExcerpt}>{featuredPost.excerpt}</p>
                      <div style={styles.featuredMeta}>
                        <span style={styles.metaItem}>{featuredPost.author}</span>
                        <span style={styles.metaItem}>
                          <span style={styles.metaIcon}>{icons.clock}</span>
                          {featuredPost.readTime}
                        </span>
                        <span style={styles.metaItem}>
                          <span style={styles.metaIcon}>{icons.eye}</span>
                          {featuredPost.views} views
                        </span>
                      </div>
                      <Link href={`/blog/${featuredPost.id}`} style={{ textDecoration: 'none' }}>
                        <button type="button" style={styles.featuredButton}>
                          Ler Artigo Completo
                          <span style={{ width: '16px', height: '16px' }}>{icons.arrow}</span>
                        </button>
                      </Link>
                    </div>
                  </div>
                </div>
              </section>
            )}

            {/* Platform Statistics */}
            {stats.length > 0 && (
            <section style={{ ...styles.section, background: 'rgba(255, 255, 255, 0.01)', paddingTop: '3rem', paddingBottom: '3rem' }}>
              <div style={styles.container}>
                <div style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
                  <h2 style={{ margin: '0 0 0.75rem', fontSize: '1.75rem', fontWeight: 700, color: '#fafafa' }}>
                    Números da Plataforma
                  </h2>
                  <p style={{ margin: 0, color: '#a1a1aa', fontSize: '1rem' }}>
                    Crescimento e impacto do EmpregoSTP no mercado de trabalho santomense
                  </p>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.5rem' }}>
                  {stats.map(stat => (
                    <div key={stat.id} style={{
                      background: 'rgba(255, 255, 255, 0.02)',
                      border: '1px solid rgba(255, 255, 255, 0.08)',
                      borderRadius: '16px',
                      padding: '2rem 1.5rem',
                      textAlign: 'center',
                      position: 'relative',
                      overflow: 'hidden'
                    }}>
                      <div style={{
                        position: 'absolute',
                        top: '-50%',
                        right: '-20%',
                        width: '150px',
                        height: '150px',
                        background: `radial-gradient(circle, ${stat.color}15 0%, transparent 70%)`,
                        borderRadius: '50%',
                        filter: 'blur(40px)'
                      }} />
                      <div style={{ position: 'relative', zIndex: 1 }}>
                        <div style={{
                          width: '56px',
                          height: '56px',
                          borderRadius: '12px',
                          background: `${stat.color}15`,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          margin: '0 auto 1.25rem'
                        }}>
                          <span style={{ width: '28px', height: '28px', color: stat.color }}>{icons[stat.icon]}</span>
                        </div>
                        <div style={{ fontSize: '2rem', fontWeight: 800, color: '#fafafa', marginBottom: '0.25rem' }}>
                          {stat.value}
                        </div>
                        <div style={{ fontSize: '0.85rem', color: '#a1a1aa', marginBottom: '0.75rem' }}>
                          {stat.label}
                        </div>
                        <div style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.3rem',
                          padding: '0.3rem 0.75rem',
                          borderRadius: '100px',
                          background: 'rgba(16, 185, 129, 0.15)',
                          color: '#34d399',
                          fontSize: '0.75rem',
                          fontWeight: 600
                        }}>
                          ↑ {stat.growth}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </section>
            )}

            {/* Main Content */}
            <section style={styles.section}>
              <div style={styles.container} className="blogContainer">
                {/* Categories Filter */}
                <div style={styles.categories} className="blogCategories">
                  {categories.map(cat => (
                    <button
                      key={cat.id}
                      type="button"
                      className="blogCategoryBtn"
                      onClick={() => setActiveCategory(cat.id)}
                      style={{
                        ...styles.categoryBtn,
                        ...(activeCategory === cat.id ? styles.categoryBtnActive : {})
                      }}
                    >
                      {cat.label}
                    </button>
                  ))}
                </div>

                <div style={styles.mainGrid} className="blogMainGrid">
                  {/* Posts Grid */}
                  <div>
                    <div style={styles.postsGrid} className="blogPostsGrid">
                      {filteredPosts.map(post => (
                        <Link href={`/blog/${post.id}`} key={post.id} style={{ textDecoration: 'none' }}>
                          <article style={styles.postCard}>
                            <span style={{
                              ...styles.postCategory, // Ensure post.color is valid hex or use default
                              background: `${post.color || '#6366f1'}15`,
                              color: post.color || '#6366f1'
                            }}>
                              {post.category}
                            </span>
                            <h3 style={styles.postTitle}>{post.title}</h3>
                            <p style={styles.postExcerpt}>{post.excerpt}</p>
                            <div style={styles.postFooter}>
                              <span style={styles.postAuthor}>{post.author}</span>
                              <div style={styles.postMeta}>
                                <span style={styles.postMetaItem}>
                                  <span style={styles.postMetaIcon}>{icons.clock}</span>
                                  {post.readTime}
                                </span>
                                <span style={styles.postMetaItem}>
                                  <span style={styles.postMetaIcon}>{icons.eye}</span>
                                  {post.views}
                                </span>
                              </div>
                            </div>
                          </article>
                        </Link>
                      ))}
                    </div>
                    {filteredPosts.length === 0 && (
                      <div style={{ textAlign: 'center', color: '#a1a1aa', padding: '2rem' }}>
                        Nenhum artigo encontrado.
                      </div>
                    )}
                  </div>

                  {/* Sidebar */}
                  <aside style={styles.sidebar} className="blogSidebar">
                    {/* News */}
                    <div style={styles.sidebarCard}>
                      <h3 style={styles.sidebarTitle}>
                        <span style={styles.sidebarIcon}>{icons.trending}</span>
                        Atualizacoes Rapidas
                      </h3>
                      <div style={styles.newsList}>
                        {news.map((item, i) => (
                          <Link href={`/blog/${item.id}`} key={item.id} style={{ textDecoration: 'none' }}>
                            <div style={{
                              ...styles.newsItem,
                              ...(i === news.length - 1 ? styles.newsItemLast : {})
                            }}>
                              <p style={styles.newsCategory}>{item.category}</p>
                              <h4 style={styles.newsTitle}>{item.title}</h4>
                              <span style={styles.newsDate}>{item.date}</span>
                            </div>
                          </Link>
                        ))}
                        {news.length === 0 && (
                          <div style={{ fontSize: '0.9rem', color: '#52525b' }}>Nenhuma novidade recente.</div>
                        )}
                      </div>
                    </div>

                    {/* Categories */}
                    <div style={styles.sidebarCard}>
                      <h3 style={styles.sidebarTitle}>
                        <span style={styles.sidebarIcon}>{icons.bookmark}</span>
                        Categorias
                      </h3>
                      <div style={styles.categoriesList}>
                        {categories.filter(c => c.id !== 'todos').map(cat => (
                          <div key={cat.id} style={styles.categoryItem} onClick={() => setActiveCategory(cat.id)}>
                            <span style={styles.categoryLabel}>{cat.label}</span>
                            <span style={styles.categoryCount}>{cat.count}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </aside>
                </div>

                {/* Newsletter */}
                <div style={styles.newsletter} className="blogNewsletter">
                  <h2 style={styles.newsletterTitle}>Receba novidades no seu email</h2>
                  <p style={styles.newsletterText}>
                    Subscreva nossa newsletter e receba artigos, dicas de carreira e oportunidades diretamente no seu email.
                  </p>
                  <form style={styles.newsletterForm} className="blogNewsletterForm" onSubmit={handleNewsletterSubmit}>
                    <input
                      type="email"
                      placeholder="Seu melhor email"
                      value={emailNewsletter}
                      onChange={(e) => setEmailNewsletter(e.target.value)}
                      style={styles.newsletterInput}
                      className="blogNewsletterInput"
                      required
                    />
                    <button type="submit" style={styles.newsletterButton}>
                      Subscrever
                    </button>
                  </form>
                </div>
              </div>
            </section>
          </>
        )}
        <Footer />
      </div>

      <style jsx>{`
        @media (max-width: 1024px) {
          .blogMainGrid {
            grid-template-columns: 1fr !important;
            gap: 1.5rem !important;
          }

          .blogFeaturedCard {
            grid-template-columns: 1fr !important;
          }

          .blogFeaturedContent {
            padding: 1.75rem !important;
          }

          .blogPostsGrid {
            grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
          }
        }

        @media (max-width: 720px) {
          .blogContainer {
            padding-left: 1rem !important;
            padding-right: 1rem !important;
          }

          .blogHero {
            padding: 3rem 0 2.25rem !important;
          }

          .blogFeaturedImage {
            min-height: 220px !important;
          }

          .blogPostsGrid {
            grid-template-columns: 1fr !important;
            gap: 1rem !important;
          }

          .blogCategories {
            flex-wrap: nowrap !important;
            overflow-x: auto !important;
            -webkit-overflow-scrolling: touch;
            padding-bottom: 0.5rem;
          }

          .blogCategories::-webkit-scrollbar {
            display: none;
          }

          .blogCategories :global(.blogCategoryBtn) {
            white-space: nowrap !important;
            flex: 0 0 auto;
          }

          .blogNewsletter {
            padding: 1.75rem !important;
          }

          .blogNewsletterForm {
            flex-direction: column !important;
          }

          .blogNewsletterInput {
            width: 100% !important;
          }

          .blogNewsletterForm :global(button) {
            width: 100% !important;
            justify-content: center !important;
          }
        }
      `}</style>
    </>
  );
}
