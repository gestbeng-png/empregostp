import Head from "next/head";
import Link from "next/link";
import { useRouter } from "next/router";
import PublicPageShell from "../../components/PublicPageShell";
import { admin } from "../../lib/firebaseAdmin";
import { isContentPublished } from "../../lib/contentPublication";
import styles from "../../styles/BlogPostPage.module.css";

export default function BlogPost({ post }) {
  const router = useRouter();

  if (router.isFallback) {
    return (
      <PublicPageShell headerVariant="light">
        <main className={styles.loadingState}>Carregando...</main>
      </PublicPageShell>
    );
  }

  if (!post) {
    return (
      <PublicPageShell headerVariant="light">
        <main className={styles.notFound}>
          <h1>Artigo não encontrado</h1>
          <Link href="/blog" className={styles.notFoundLink}>
            Voltar ao blog
          </Link>
        </main>
      </PublicPageShell>
    );
  }

  const heroImage =
    post.image || "https://via.placeholder.com/1200x600?text=EmpregoSTP";

  return (
    <>
      <Head>
        <title>{post.title} | Blog EmpregoSTP</title>
        <meta name="description" content={post.excerpt} />
      </Head>

      <PublicPageShell headerVariant="light">
        <main className={styles.page}>
          <section
            className={styles.hero}
            style={{
              backgroundImage: `linear-gradient(180deg, rgba(30, 43, 77, 0.14), rgba(30, 43, 77, 0.62)), url(${heroImage})`,
            }}
          >
            <div className={styles.heroOverlay} />
            <div className={styles.heroInner}>
              <Link href="/blog" className={styles.backLink}>
                ← Voltar ao blog
              </Link>
              <div className={styles.metaRow}>
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
                <span className={styles.metaText}>
                  {post.readTime} de leitura
                </span>
                <span className={styles.metaText}>
                  {post.createdAt
                    ? new Date(post.createdAt).toLocaleDateString("pt-PT")
                    : "Data desconhecida"}
                </span>
              </div>
              <h1 className={styles.title}>{post.title}</h1>
              <p className={styles.author}>Por {post.author}</p>
            </div>
          </section>

          <article className={styles.articleShell}>
            <div
              className={styles.articleContent}
              dangerouslySetInnerHTML={{ __html: post.content }}
            />
          </article>
        </main>
      </PublicPageShell>
    </>
  );
}

export async function getStaticPaths() {
  return {
    paths: [],
    fallback: "blocking",
  };
}

export async function getStaticProps({ params }) {
  try {
    let postSnap = await admin
      .firestore()
      .collection("posts")
      .doc(params.id)
      .get();
    let post = postSnap.exists ? { id: postSnap.id, ...postSnap.data() } : null;

    if (!post) {
      postSnap = await admin
        .firestore()
        .collection("news")
        .doc(params.id)
        .get();
      post = postSnap.exists ? { id: postSnap.id, ...postSnap.data() } : null;
    }

    if (!post || !isContentPublished(post.status)) {
      return { notFound: true };
    }

    const serializeField = (value) => {
      if (!value) return null;
      if (value.toDate) return value.toDate().toISOString();
      if (value instanceof Date) return value.toISOString();
      return value;
    };

    const serializedPost = {
      ...post,
      createdAt: serializeField(post.createdAt),
      updatedAt: serializeField(post.updatedAt),
    };

    return {
      props: { post: serializedPost },
      revalidate: 300,
    };
  } catch (error) {
    console.error("Erro ao carregar artigo do blog:", error);
    return { notFound: true };
  }
}
