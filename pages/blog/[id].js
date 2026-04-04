import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import LandingHeader from '../../components/LandingHeader';
import Footer from '../../components/home/Footer';
import { admin } from '../../lib/firebaseAdmin';
import { isContentPublished } from '../../lib/contentPublication';

export default function BlogPost({ post }) {
    const router = useRouter();

    if (router.isFallback) {
        return <div style={{ minHeight: '100vh', background: '#09090b', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>Carregando...</div>;
    }

    if (!post) {
        return (
            <div style={{ minHeight: '100vh', background: '#09090b', color: 'white' }}>
                <LandingHeader />
                <div style={{ padding: '4rem', textAlign: 'center' }}>
                    <h1>Artigo não encontrado</h1>
                    <Link href="/blog" style={{ color: '#6366f1' }}>Voltar ao Blog</Link>
                </div>
                <Footer />
            </div>
        );
    }

    const styles = {
        page: {
            minHeight: '100vh',
            backgroundColor: '#09090b',
            color: '#fff'
        },
        hero: {
            height: '60vh',
            minHeight: '400px',
            position: 'relative',
            display: 'flex',
            alignItems: 'end',
            padding: '0 0 4rem',
            background: `linear-gradient(to top, #09090b 10%, transparent 100%), url(${post.image || 'https://via.placeholder.com/1200x600?text=No+Image'})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center'
        },
        container: {
            maxWidth: '800px',
            margin: '0 auto',
            padding: '0 2rem',
            position: 'relative',
            zIndex: 1
        },
        meta: {
            display: 'flex',
            gap: '1rem',
            marginBottom: '1rem',
            fontSize: '0.9rem',
            color: 'rgba(255,255,255,0.8)',
            flexWrap: 'wrap'
        },
        category: {
            background: post.color || '#6366f1',
            padding: '0.25rem 0.75rem',
            borderRadius: '4px',
            fontWeight: 'bold',
            fontSize: '0.8rem',
            textTransform: 'uppercase'
        },
        title: {
            fontSize: 'clamp(2rem, 5vw, 3.5rem)',
            fontWeight: 800,
            lineHeight: 1.1,
            marginBottom: '1rem',
            color: 'white'
        },
        content: {
            fontSize: '1.1rem',
            lineHeight: 1.8,
            color: '#d4d4d8',
            padding: '4rem 0'
        },
        backLink: {
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.5rem',
            color: '#a1a1aa',
            textDecoration: 'none',
            marginBottom: '2rem',
            fontSize: '0.9rem'
        }
    };

    return (
        <>
            <Head>
                <title>{post.title} | Blog EmpregoSTP</title>
                <meta name="description" content={post.excerpt} />
            </Head>

            <div style={styles.page} className="blogPostPage">
                <LandingHeader />

                <div style={styles.hero} className="blogPostHero">
                    <div style={styles.container} className="blogPostContainer">
                        <Link href="/blog" style={styles.backLink}>← Voltar ao Blog</Link>
                        <div style={styles.meta} className="blogPostMeta">
                            <span style={styles.category}>{post.category}</span>
                            <span>{post.readTime} de leitura</span>
                            <span>•</span>
                            <span>{post.createdAt ? new Date(post.createdAt).toLocaleDateString() : 'Data desconhecida'}</span>
                        </div>
                        <h1 style={styles.title}>{post.title}</h1>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                            <span style={{ color: '#e4e4e7', fontWeight: 500 }}>Por {post.author}</span>
                        </div>
                    </div>
                </div>

                <article style={styles.container} className="blogPostContainer">
                    <div
                        style={styles.content}
                        dangerouslySetInnerHTML={{ __html: post.content }}
                        className="blog-content"
                    />
                </article>

                <Footer />
            </div>

            <style jsx global>{`
        .blog-content h2 { color: white; margin-top: 2rem; margin-bottom: 1rem; font-size: 1.8rem; }
        .blog-content h3 { color: white; margin-top: 1.5rem; margin-bottom: 0.75rem; font-size: 1.4rem; }
        .blog-content p { margin-bottom: 1.5rem; }
        .blog-content ul { margin-bottom: 1.5rem; padding-left: 1.5rem; }
        .blog-content li { margin-bottom: 0.5rem; }
        .blog-content a { color: #818cf8; text-decoration: underline; }
        .blog-content blockquote { border-left: 4px solid #6366f1; padding-left: 1rem; color: #a1a1aa; font-style: italic; margin: 2rem 0; }
        .blog-content img { max-width: 100%; border-radius: 12px; margin: 2rem 0; }

        @media (max-width: 720px) {
          .blogPostHero {
            height: 52vh !important;
            min-height: 320px !important;
            padding: 0 0 2.25rem !important;
          }

          .blogPostContainer {
            padding-left: 1rem !important;
            padding-right: 1rem !important;
          }

          .blogPostMeta {
            gap: 0.65rem !important;
          }

          .blog-content {
            font-size: 1rem !important;
            padding: 2.25rem 0 !important;
          }

          .blog-content h2 {
            font-size: 1.45rem !important;
          }

          .blog-content h3 {
            font-size: 1.2rem !important;
          }

          .blog-content img {
            margin: 1.25rem 0 !important;
          }

          .blog-content blockquote {
            margin: 1.25rem 0 !important;
          }
        }
      `}</style>
        </>
    );
}

export async function getStaticPaths() {
    // Fetch all posts to generate paths
    // Note: Is using getStaticPaths best here? If we have many posts, might be better to fallback: 'blocking'
    // Or if we want it completely dynamic (client side or SSR), we can use getServerSideProps.
    // Given the structure, let's use dynamic SSR/ISR or fallback='blocking'

    // For now, let's just pre-render nothing and rely on fallback blocking for simplicity and freshness
    return {
        paths: [],
        fallback: 'blocking'
    };
}

export async function getStaticProps({ params }) {
    try {
        let postSnap = await admin.firestore().collection('posts').doc(params.id).get();
        let post = postSnap.exists ? { id: postSnap.id, ...postSnap.data() } : null;

        // If not found in posts, try news
        if (!post) {
            postSnap = await admin.firestore().collection('news').doc(params.id).get();
            post = postSnap.exists ? { id: postSnap.id, ...postSnap.data() } : null;
        }

        if (!post) {
            return { notFound: true };
        }

        if (!isContentPublished(post.status)) {
            return { notFound: true };
        }

        // Parse dates to strings
        const serializeField = (val) => {
            if (!val) return null;
            if (val.toDate) return val.toDate().toISOString(); // Firestore Timestamp
            if (val instanceof Date) return val.toISOString(); // JS Date
            return val;
        };

        const serializedPost = {
            ...post,
            // Ensure defaults for news items which might lack some fields
            image: post.image || 'https://images.unsplash.com/photo-1504711434969-e33886168f5c?q=80&w=2070&auto=format&fit=crop', // Default News Image
            author: post.author || 'EmpregoSTP Team',
            readTime: post.readTime || '1 min',
            createdAt: serializeField(post.createdAt),
            updatedAt: serializeField(post.updatedAt)
        };

        return {
            props: { post: serializedPost },
            revalidate: 60 // Revalidate every minute
        };
    } catch (error) {
        console.error('Error fetching post:', error);
        return { notFound: true };
    }
}
