import Head from 'next/head';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useState } from 'react';
import {
  FiArrowLeft,
  FiArrowRight,
  FiBookOpen,
  FiCheck,
  FiChevronRight,
  FiCopy,
  FiShare2,
} from 'react-icons/fi';
import PublicPageShell from '../../components/PublicPageShell';
import { admin } from '../../lib/firebaseAdmin';
import { sanitizeRichHtml } from '../../lib/sanitizeRichHtml';
import {
  isContentPublished,
  normalizeContentStatus,
} from '../../lib/contentPublication';
import {
  safeText,
  safeTimestampToISOString,
  serializeForProps,
} from '../../lib/firestoreNormalize';
import styles from '../../styles/BlogPostPage.module.css';

const RELATED_POST_LIMIT = 3;
const RELATED_FALLBACK_IMAGES = [
  '/assets/people/candidate-working.webp',
  '/assets/people/team-working.webp',
];

function hasHtmlMarkup(content) {
  return /<\/?[a-z][\s\S]*>/i.test(String(content || ''));
}

function normalizeComparableText(value) {
  return String(value || '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLocaleLowerCase('pt-PT');
}

function PlainTextArticle({ content }) {
  const blocks = String(content || '')
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean);

  return blocks.map((block, index) => {
    const lines = block
      .split(/\n+/)
      .map((line) => line.trim())
      .filter(Boolean);
    const firstLine = lines[0] || '';
    const bodyLines = lines.slice(1);
    const headingText = firstLine.replace(/^#{1,3}\s+/, '');
    const isHeading =
      /^#{1,3}\s+/.test(firstLine) ||
      /^\d+[.)]\s+\S/.test(firstLine) ||
      (bodyLines.length > 0 &&
        firstLine.length <= 100 &&
        !/[.!?;:]$/.test(firstLine));
    const isQuote = lines.every((line) => line.startsWith('>'));
    const isList = lines.every((line) => /^[-*]\s+/.test(line));

    if (isQuote) {
      return (
        <blockquote key={`quote-${index}`}>
          {lines.map((line) => line.replace(/^>\s?/, '')).join(' ')}
        </blockquote>
      );
    }

    if (isList) {
      return (
        <ul key={`list-${index}`}>
          {lines.map((line) => {
            const item = line.replace(/^[-*]\s+/, '');
            return <li key={item}>{item}</li>;
          })}
        </ul>
      );
    }

    if (isHeading) {
      return (
        <section key={`${headingText}-${index}`}>
          <h2>{headingText}</h2>
          {bodyLines.map((line) => (
            <p key={line}>{line}</p>
          ))}
        </section>
      );
    }

    return <p key={`${firstLine}-${index}`}>{lines.join(' ')}</p>;
  });
}

function formatDate(value) {
  if (!value) return 'Data não indicada';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);

  return date.toLocaleDateString('pt-PT', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function formatReadTime(value) {
  const readTime = String(value || '5 min').trim();
  return /leitura/i.test(readTime) ? readTime : `${readTime} de leitura`;
}

function getInitials(value) {
  const initials = String(value || 'EmpregoSTP')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('');

  return initials || 'ES';
}

function RelatedPostImage({ post, fallbackIndex }) {
  const [failed, setFailed] = useState(false);
  const fallbackImage = RELATED_FALLBACK_IMAGES[fallbackIndex] || '';

  if (post.image && !failed) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={post.image}
        alt={`Imagem do artigo ${post.title}`}
        className={styles.relatedImage}
        loading="lazy"
        decoding="async"
        onError={() => setFailed(true)}
      />
    );
  }

  if (fallbackImage) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={fallbackImage}
        alt={`Imagem ilustrativa do artigo ${post.title}`}
        className={styles.relatedImage}
        loading="lazy"
        decoding="async"
      />
    );
  }

  return (
    <div className={styles.relatedImageFallback} aria-hidden="true">
      <span>
        {String(post.category || 'Blog')
          .charAt(0)
          .toUpperCase()}
      </span>
      <FiBookOpen />
    </div>
  );
}

function normalizePost(rawPost, id) {
  const raw = rawPost || {};
  const publishedAt =
    safeTimestampToISOString(raw.publishedAt) ||
    safeTimestampToISOString(raw.createdAt) ||
    safeTimestampToISOString(raw.date);

  return {
    id,
    title: safeText(raw.title, 'Sem título'),
    excerpt: safeText(raw.excerpt ?? raw.summary, ''),
    content: safeText(raw.content, ''),
    category: safeText(raw.category, 'Carreira'),
    author: safeText(raw.author, 'Equipa EmpregoSTP'),
    authorAvatar: safeText(
      raw.authorAvatar ?? raw.authorImage ?? raw.avatar ?? raw.photoUrl,
      '',
    ),
    image: safeText(raw.image ?? raw.coverImage ?? raw.imageUrl, ''),
    readTime: safeText(raw.readTime, '5 min'),
    color: safeText(raw.color, '#2563eb'),
    featured: Boolean(raw.featured),
    status: normalizeContentStatus(raw.status),
    publishedAt,
    createdAt: safeTimestampToISOString(raw.createdAt) || publishedAt || null,
    updatedAt: safeTimestampToISOString(raw.updatedAt),
  };
}

function sortRelatedPosts(posts, currentPost) {
  const currentCategory = normalizeComparableText(currentPost.category);

  return [...posts].sort((first, second) => {
    const firstCategoryMatch =
      normalizeComparableText(first.category) === currentCategory ? 1 : 0;
    const secondCategoryMatch =
      normalizeComparableText(second.category) === currentCategory ? 1 : 0;

    if (firstCategoryMatch !== secondCategoryMatch) {
      return secondCategoryMatch - firstCategoryMatch;
    }

    if (first.featured !== second.featured) {
      return Number(second.featured) - Number(first.featured);
    }

    const firstDate =
      Date.parse(first.publishedAt || first.createdAt || '') || 0;
    const secondDate =
      Date.parse(second.publishedAt || second.createdAt || '') || 0;
    return secondDate - firstDate;
  });
}

/**
 * @param {{
 *   post: Record<string, unknown> | null,
 *   relatedPosts?: Array<Record<string, unknown>>,
 *   articleHtml?: string | null,
 * }} props `articleHtml` chega já sanitizado do `getStaticProps`; `null`
 *   quando o conteúdo é texto simples.
 */
export default function BlogPost({
  post,
  relatedPosts = [],
  articleHtml = null,
}) {
  const router = useRouter();
  const [failedHeroImage, setFailedHeroImage] = useState(false);
  const [failedAvatar, setFailedAvatar] = useState(false);
  const [shareState, setShareState] = useState('idle');
  const [newsletterEmail, setNewsletterEmail] = useState('');
  const [newsletterState, setNewsletterState] = useState({
    status: 'idle',
    message: '',
  });

  const markLinkCopied = () => {
    setShareState('copied');
    window.setTimeout(() => setShareState('idle'), 2200);
  };

  const copyArticleLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      markLinkCopied();
    } catch (error) {
      setShareState('error');
      window.setTimeout(() => setShareState('idle'), 2200);
    }
  };

  const handleShare = async () => {
    const shareData = {
      title: post.title,
      text: post.excerpt || post.title,
      url: window.location.href,
    };

    if (!navigator.share) {
      await copyArticleLink();
      return;
    }

    try {
      await navigator.share(shareData);
    } catch (error) {
      if (error?.name !== 'AbortError') {
        setShareState('error');
        window.setTimeout(() => setShareState('idle'), 2200);
      }
    }
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
        body: JSON.stringify({ email, source: 'blog-article' }),
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

      setNewsletterEmail('');
      setNewsletterState({
        status: 'success',
        message: data.message || 'Subscrição confirmada. Obrigado.',
      });
    } catch (error) {
      setNewsletterState({
        status: 'error',
        message: 'Não foi possível estabelecer a ligação. Tente novamente.',
      });
    }
  };

  if (router.isFallback) {
    return (
      <PublicPageShell headerVariant="light">
        <div className={styles.loadingState} role="status">
          A carregar o artigo…
        </div>
      </PublicPageShell>
    );
  }

  if (!post) {
    return (
      <PublicPageShell headerVariant="light">
        <div className={styles.notFound}>
          <h1>Artigo não encontrado</h1>
          <p>
            Esta publicação pode ter sido removida ou ainda não está pública.
          </p>
          <Link href="/blog" className={styles.notFoundLink}>
            <FiArrowLeft aria-hidden="true" />
            Voltar ao blog
          </Link>
        </div>
      </PublicPageShell>
    );
  }

  const articleCopy = post.content || post.excerpt || '';
  const normalizedCopy = normalizeComparableText(articleCopy);
  const normalizedExcerpt = normalizeComparableText(post.excerpt);
  const showExcerpt =
    Boolean(normalizedExcerpt) && !normalizedCopy.startsWith(normalizedExcerpt);
  const publishedDate = post.publishedAt || post.createdAt;
  const showHeroImage = post.image && !failedHeroImage;
  const showAvatarImage = post.authorAvatar && !failedAvatar;

  return (
    <>
      <Head>
        <title>{post.title} | Blog EmpregoSTP</title>
        <meta
          name="description"
          content={post.excerpt || `Leia ${post.title} no blog EmpregoSTP.`}
        />
        <meta property="og:type" content="article" />
        <meta property="og:title" content={post.title} />
        <meta
          property="og:description"
          content={post.excerpt || `Leia ${post.title} no blog EmpregoSTP.`}
        />
        {post.image ? <meta property="og:image" content={post.image} /> : null}
        {publishedDate ? (
          <meta property="article:published_time" content={publishedDate} />
        ) : null}
        {post.updatedAt ? (
          <meta property="article:modified_time" content={post.updatedAt} />
        ) : null}
      </Head>

      <PublicPageShell headerVariant="light">
        <div className={styles.page}>
          <div className={styles.pageSheet}>
            <div className={styles.articleLayout}>
              <nav className={styles.breadcrumbs} aria-label="Breadcrumb">
                <Link href="/">Início</Link>
                <FiChevronRight aria-hidden="true" />
                <Link href="/blog" aria-label="Voltar ao blog">
                  Blog
                </Link>
                <FiChevronRight aria-hidden="true" />
                <span aria-current="page">{post.title}</span>
              </nav>

              <article className={styles.articleCard}>
                <figure className={styles.heroFigure}>
                  {showHeroImage ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={post.image}
                      alt={`Imagem de capa do artigo ${post.title}`}
                      className={styles.heroImage}
                      decoding="async"
                      fetchPriority="high"
                      onError={() => setFailedHeroImage(true)}
                    />
                  ) : (
                    <div
                      className={styles.heroFallback}
                      role="img"
                      aria-label={`Capa do artigo ${post.title}`}
                    >
                      <span className={styles.heroFallbackMark}>
                        <FiBookOpen aria-hidden="true" />
                      </span>
                      <Image
                        src="/assets/Logo header.png"
                        alt=""
                        width={420}
                        height={114}
                        className={styles.heroFallbackLogo}
                      />
                    </div>
                  )}
                </figure>

                <div className={styles.articleBody}>
                  <header className={styles.articleHeader}>
                    <div className={styles.metaRow}>
                      <div className={styles.authorBlock}>
                        <span
                          className={styles.authorAvatar}
                          aria-hidden="true"
                        >
                          {showAvatarImage ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={post.authorAvatar}
                              alt=""
                              onError={() => setFailedAvatar(true)}
                            />
                          ) : (
                            getInitials(post.author)
                          )}
                        </span>
                        <span className={styles.authorCopy}>
                          <strong>{post.author}</strong>
                          <span>
                            {formatDate(publishedDate)} ·{' '}
                            {formatReadTime(post.readTime)}
                          </span>
                        </span>
                      </div>
                      <span className={styles.categoryPill}>
                        {post.category}
                      </span>
                    </div>

                    <h1 className={styles.title}>{post.title}</h1>
                    {showExcerpt ? (
                      <p className={styles.lead}>{post.excerpt}</p>
                    ) : null}
                  </header>

                  <div className={styles.articleContent}>
                    {articleHtml !== null ? (
                      <div dangerouslySetInnerHTML={{ __html: articleHtml }} />
                    ) : (
                      <PlainTextArticle content={articleCopy} />
                    )}
                  </div>

                  <footer className={styles.articleFooter}>
                    <span className={styles.shareLabel}>
                      Partilhe este artigo
                    </span>
                    <div className={styles.shareActions}>
                      <button
                        type="button"
                        className={styles.shareIconButton}
                        onClick={handleShare}
                        aria-label="Partilhar artigo"
                        title="Partilhar artigo"
                      >
                        <FiShare2 aria-hidden="true" />
                      </button>
                      <button
                        type="button"
                        className={styles.shareIconButton}
                        onClick={copyArticleLink}
                        aria-label="Copiar ligação do artigo"
                        title="Copiar ligação"
                      >
                        {shareState === 'copied' ? (
                          <FiCheck aria-hidden="true" />
                        ) : (
                          <FiCopy aria-hidden="true" />
                        )}
                      </button>
                    </div>
                    <span className={styles.shareFeedback} aria-live="polite">
                      {shareState === 'copied'
                        ? 'Ligação copiada.'
                        : shareState === 'error'
                          ? 'Não foi possível copiar a ligação.'
                          : ''}
                    </span>
                  </footer>
                </div>
              </article>

              {relatedPosts.length > 0 ? (
                <section
                  className={styles.relatedSection}
                  aria-labelledby="related-posts-title"
                >
                  <div className={styles.sectionHeading}>
                    <h2 id="related-posts-title">Artigos relacionados</h2>
                    <Link href="/blog">
                      Ver todos
                      <FiArrowRight aria-hidden="true" />
                    </Link>
                  </div>
                  <div className={styles.relatedGrid}>
                    {relatedPosts.map((relatedPost, index) => (
                      <article
                        key={relatedPost.id}
                        className={styles.relatedCard}
                      >
                        <Link href={`/blog/${relatedPost.id}`}>
                          <div className={styles.relatedMedia}>
                            <RelatedPostImage
                              post={relatedPost}
                              fallbackIndex={index}
                            />
                          </div>
                          <div className={styles.relatedBody}>
                            <span className={styles.relatedCategory}>
                              {relatedPost.category}
                            </span>
                            <h3>{relatedPost.title}</h3>
                          </div>
                        </Link>
                      </article>
                    ))}
                  </div>
                </section>
              ) : null}

              <div className={styles.ctaRow}>
                <section
                  className={styles.newsletter}
                  aria-labelledby="article-newsletter-title"
                >
                  <div className={styles.newsletterCopy}>
                    <h2 id="article-newsletter-title">
                      Mantenha-se atualizado
                    </h2>
                    <p>
                      Receba artigos de carreira, tendências do mercado e novas
                      oportunidades diretamente no seu email.
                    </p>
                  </div>
                  <form
                    className={styles.newsletterForm}
                    onSubmit={handleNewsletterSubmit}
                  >
                    <div className={styles.newsletterFields}>
                      <label htmlFor="article-newsletter-email">
                        O seu endereço de email
                      </label>
                      <input
                        id="article-newsletter-email"
                        type="email"
                        inputMode="email"
                        autoComplete="email"
                        placeholder="O seu endereço de email"
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
                        disabled={newsletterState.status === 'loading'}
                      >
                        {newsletterState.status === 'loading'
                          ? 'A subscrever…'
                          : 'Subscrever'}
                      </button>
                    </div>
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

                <Link href="/vagas" className={styles.jobsCta}>
                  <span>Ver vagas</span>
                  <FiArrowRight aria-hidden="true" />
                </Link>
              </div>
            </div>
          </div>
        </div>
      </PublicPageShell>
    </>
  );
}

export async function getStaticPaths() {
  return {
    paths: [],
    fallback: 'blocking',
  };
}

export async function getStaticProps({ params }) {
  try {
    const postsCollection = admin.firestore().collection('posts');
    const relatedPostsRequest = async () => {
      try {
        return await postsCollection
          .orderBy('createdAt', 'desc')
          .limit(12)
          .get();
      } catch (error) {
        console.warn(
          '[blog/article] fallback de relacionados sem orderBy:',
          error?.message || error,
        );
        return postsCollection.limit(24).get();
      }
    };

    const [postSnapshot, relatedSnapshot] = await Promise.all([
      postsCollection.doc(params.id).get(),
      relatedPostsRequest(),
    ]);

    let rawPost = postSnapshot.exists
      ? { id: postSnapshot.id, ...postSnapshot.data() }
      : null;

    if (!rawPost) {
      const newsSnapshot = await admin
        .firestore()
        .collection('news')
        .doc(params.id)
        .get();
      rawPost = newsSnapshot.exists
        ? { id: newsSnapshot.id, ...newsSnapshot.data() }
        : null;
    }

    if (!rawPost || !isContentPublished(rawPost.status)) {
      return { notFound: true };
    }

    const post = normalizePost(rawPost, rawPost.id);
    const relatedPosts = sortRelatedPosts(
      relatedSnapshot.docs
        .map((document) => normalizePost(document.data() || {}, document.id))
        .filter(
          (candidate) =>
            candidate.id !== post.id && isContentPublished(candidate.status),
        ),
      post,
    ).slice(0, RELATED_POST_LIMIT);

    // Sanitizado aqui, no servidor: o `sanitize-html` (e o postcss que ele
    // arrasta) deixa de ir no bundle do browser desta página.
    const articleCopy = post.content || post.excerpt || '';
    const articleHtml = hasHtmlMarkup(articleCopy)
      ? sanitizeRichHtml(articleCopy)
      : null;

    return {
      props: serializeForProps({ post, relatedPosts, articleHtml }),
      revalidate: 300,
    };
  } catch (error) {
    console.error('Erro ao carregar artigo do blog:', error);
    return { notFound: true };
  }
}
