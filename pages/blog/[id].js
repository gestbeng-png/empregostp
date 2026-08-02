import Head from "next/head";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/router";
import { useState } from "react";
import { FiArrowLeft, FiArrowRight, FiBookOpen } from "react-icons/fi";
import PublicPageShell from "../../components/PublicPageShell";
import { admin } from "../../lib/firebaseAdmin";
import { isContentPublished } from "../../lib/contentPublication";
import styles from "../../styles/BlogPostPage.module.css";

function hasHtmlMarkup(content) {
  return /<\/?[a-z][\s\S]*>/i.test(String(content || ""));
}

function PlainTextArticle({ content }) {
  const blocks = String(content || "")
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean);
  const elements = [];

  for (let index = 0; index < blocks.length; index += 1) {
    const lines = blocks[index]
      .split(/\n+/)
      .map((line) => line.trim())
      .filter(Boolean);
    const [firstLine, ...bodyLines] = lines;
    const isSection =
      index > 0 &&
      bodyLines.length > 0 &&
      firstLine.length <= 100 &&
      !/[.!?;:]$/.test(firstLine);
    const listItems = [];

    if (bodyLines.at(-1)?.endsWith(":")) {
      while (index + 1 < blocks.length) {
        const nextLines = blocks[index + 1]
          .split(/\n+/)
          .map((line) => line.trim())
          .filter(Boolean);
        if (
          nextLines.length !== 1 ||
          /[.!?]$/.test(nextLines[0])
        ) {
          break;
        }
        listItems.push(nextLines[0]);
        index += 1;
      }
    }

    if (isSection) {
      elements.push(
        <section key={`${firstLine}-${index}`}>
          <h2>{firstLine}</h2>
          {bodyLines.map((line) => (
            <p key={line}>{line}</p>
          ))}
          {listItems.length > 0 ? (
            <ul>
              {listItems.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          ) : null}
        </section>,
      );
      continue;
    }

    elements.push(<p key={`${firstLine}-${index}`}>{lines.join(" ")}</p>);
  }

  return elements;
}

export default function BlogPost({ post }) {
  const router = useRouter();
  const [failedHeroImage, setFailedHeroImage] = useState("");

  if (router.isFallback) {
    return (
      <PublicPageShell headerVariant="light">
        <div className={styles.loadingState} role="status">
          A carregar…
        </div>
      </PublicPageShell>
    );
  }

  if (!post) {
    return (
      <PublicPageShell headerVariant="light">
        <div className={styles.notFound}>
          <h1>Artigo não encontrado</h1>
          <Link href="/blog" className={styles.notFoundLink}>
            Voltar ao blog
          </Link>
        </div>
      </PublicPageShell>
    );
  }

  const showHeroImage = post.image && failedHeroImage !== post.image;

  return (
    <>
      <Head>
        <title>{post.title} | Blog EmpregoSTP</title>
        <meta name="description" content={post.excerpt} />
      </Head>

      <PublicPageShell headerVariant="light">
        <div className={styles.page}>
          <nav
            className={styles.articleNavigation}
            aria-label="Navegação do artigo"
          >
            <Link href="/blog" className={styles.backLink}>
              <span className={styles.backLinkIcon} aria-hidden="true">
                <FiArrowLeft />
              </span>
              <span>Voltar ao blog</span>
            </Link>
            <span className={styles.navigationContext}>
              Centro de Imprensa <span aria-hidden="true">/</span>{" "}
              <strong>{post.category}</strong>
            </span>
          </nav>

          <section className={styles.hero}>
            {showHeroImage ? (
              <>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={post.image}
                  alt=""
                  className={styles.heroImage}
                  onError={() => setFailedHeroImage(post.image)}
                />
              </>
            ) : (
              <div className={styles.heroFallback} aria-hidden="true">
                <Image
                  src="/assets/Emprego STP Logo 2-wide.png"
                  alt=""
                  width={320}
                  height={96}
                  className={styles.heroFallbackLogo}
                />
                <FiBookOpen />
              </div>
            )}
            <div className={styles.heroOverlay} />
            <div className={styles.heroInner}>
              <div className={styles.metaRow}>
                <span className={styles.categoryPill}>
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
            <div className={styles.articleContent}>
              {hasHtmlMarkup(post.content) ? (
                <div dangerouslySetInnerHTML={{ __html: post.content }} />
              ) : (
                <PlainTextArticle content={post.content} />
              )}
            </div>
            <footer className={styles.articleFooter}>
              <Link href="/blog" className={styles.allPostsLink}>
                Ver todas as publicações
                <FiArrowRight aria-hidden="true" />
              </Link>
            </footer>
          </article>
        </div>
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

    // Recursively convert any Firestore Timestamp / Date into an ISO string so
    // the whole document is JSON-serializable for getStaticProps.
    const serializeValue = (value) => {
      if (value === null || value === undefined) return null;
      if (typeof value?.toDate === "function") return value.toDate().toISOString();
      if (value instanceof Date) return value.toISOString();
      if (Array.isArray(value)) return value.map(serializeValue);
      if (typeof value === "object") {
        return Object.fromEntries(
          Object.entries(value).map(([key, val]) => [key, serializeValue(val)])
        );
      }
      return value;
    };

    const serializedPost = serializeValue(post);

    return {
      props: { post: serializedPost },
      revalidate: 300,
    };
  } catch (error) {
    console.error("Erro ao carregar artigo do blog:", error);
    return { notFound: true };
  }
}
