import Head from 'next/head';
import Link from 'next/link';
import {
  FiArrowLeft,
  FiBookOpen,
  FiClock,
  FiDownload,
  FiFileText,
} from 'react-icons/fi';
import PublicPageShell from '../../../components/PublicPageShell';
import { admin } from '../../../lib/firebaseAdmin';
import { DEFAULT_GUIDES, GUIDE_CONTENTS } from '../../../lib/resourcesCatalog';
import styles from '../../../styles/ResourceGuidePage.module.css';

const MIN_COMPLETE_GUIDE_LENGTH = 80;
const LEGACY_GUIDE_COPY = {
  'Preparacao pratica para entrevistas presenciais e remotas.':
    'Preparação prática para entrevistas presenciais e remotas.',
  'Guia de Negociacao Salarial': 'Guia de Negociação Salarial',
  'Como negociar remuneracao com argumentos objetivos.':
    'Como negociar a remuneração com argumentos objetivos.',
  'Playbook de Entrevistas para Empresas':
    'Roteiro de Entrevistas para Empresas',
  'Roteiro para triagem, entrevista e avaliacao de candidatos.':
    'Roteiro para triagem, entrevista e avaliação de candidatos.',
  'Guia de Onboarding de Novos Colaboradores':
    'Guia de Integração de Novos Colaboradores',
  'Plano de 30 dias para integracao e produtividade inicial.':
    'Plano de 30 dias para integração e produtividade inicial.',
  Gestao: 'Gestão',
};

const normalizeGuideCopy = (value, fallback = '') => {
  const text = String(value || fallback).trim();
  return LEGACY_GUIDE_COPY[text] || text;
};

const toPlainText = (value) => {
  const text = String(value || '').trim();
  if (!text) return '';
  return text
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<[^>]+>/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
};

const createGuideBlocks = (content) => {
  const blocks = [];
  let listItems = [];
  let listType = 'unordered';

  const flushList = () => {
    if (listItems.length > 0) {
      blocks.push({ items: listItems, type: listType });
      listItems = [];
    }
  };

  toPlainText(content)
    .split('\n')
    .forEach((rawLine) => {
      const line = rawLine.trim();

      if (!line) {
        flushList();
        return;
      }

      if (/^#\s+/.test(line)) {
        flushList();
        return;
      }

      const heading = line.match(/^#{2,3}\s+(.+)$/);
      if (heading) {
        flushList();
        blocks.push({ text: heading[1], type: 'heading' });
        return;
      }

      const unorderedItem = line.match(/^[-*]\s+(.+)$/);
      const orderedItem = line.match(/^\d+[.)]\s+(.+)$/);
      if (unorderedItem || orderedItem) {
        const nextListType = orderedItem ? 'ordered' : 'unordered';
        if (listItems.length > 0 && listType !== nextListType) flushList();
        listType = nextListType;
        listItems.push((orderedItem || unorderedItem)[1]);
        return;
      }

      flushList();
      blocks.push({ text: line, type: 'paragraph' });
    });

  flushList();
  return blocks;
};

function GuideContent({ content }) {
  const blocks = createGuideBlocks(content);

  if (blocks.length === 0) {
    return (
      <div className={styles.emptyState}>
        <FiFileText aria-hidden="true" />
        <div>
          <h2>Conteúdo em preparação</h2>
          <p>Este guia ainda não tem conteúdo disponível.</p>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.guideContent}>
      {blocks.map((block, index) => {
        const key = `${block.type}-${index}`;

        if (block.type === 'heading') {
          return <h2 key={key}>{block.text}</h2>;
        }

        if (block.type === 'ordered') {
          return (
            <ol key={key}>
              {block.items.map((item, itemIndex) => (
                <li key={`${item}-${itemIndex}`}>{item}</li>
              ))}
            </ol>
          );
        }

        if (block.type === 'unordered') {
          return (
            <ul key={key}>
              {block.items.map((item, itemIndex) => (
                <li key={`${item}-${itemIndex}`}>{item}</li>
              ))}
            </ul>
          );
        }

        return <p key={key}>{block.text}</p>;
      })}
    </div>
  );
}

export default function GuiaDetalhePage({ guide }) {
  return (
    <>
      <Head>
        <title>{guide.title} | Guia EmpregoSTP</title>
        <meta
          name="description"
          content={
            guide.description || 'Guia prático de carreira no EmpregoSTP.'
          }
        />
      </Head>

      <PublicPageShell>
        <div className={styles.page}>
          <div className={styles.container}>
            <Link href="/recursos" className={styles.backLink}>
              <FiArrowLeft aria-hidden="true" />
              Voltar aos recursos
            </Link>

            <header className={styles.hero}>
              <span className={styles.eyebrow}>
                <FiBookOpen aria-hidden="true" />
                {guide.category || 'Guia prático'}
              </span>
              <h1>{guide.title}</h1>
              {guide.description ? <p>{guide.description}</p> : null}

              <div className={styles.details} aria-label="Detalhes do guia">
                {guide.readTime ? (
                  <span>
                    <FiClock aria-hidden="true" />
                    {guide.readTime}
                  </span>
                ) : null}
                {guide.pages ? (
                  <span>
                    <FiFileText aria-hidden="true" />
                    {guide.pages} páginas
                  </span>
                ) : null}
              </div>

              {guide.downloadUrl ? (
                <a href={guide.downloadUrl} className={styles.downloadLink}>
                  <FiDownload aria-hidden="true" />
                  Descarregar anexo
                </a>
              ) : null}
            </header>

            <article className={styles.article}>
              <GuideContent content={guide.content} />
            </article>
          </div>
        </div>
      </PublicPageShell>
    </>
  );
}

export async function getServerSideProps(context) {
  const id = String(context?.params?.id || '').trim();
  if (!id) {
    return { notFound: true };
  }

  const fallbackGuide = DEFAULT_GUIDES.find((item) => item.id === id);
  const fallbackContent = toPlainText(GUIDE_CONTENTS[id] || '');
  let guide = null;

  try {
    const guideDoc = await admin
      .firestore()
      .collection('resources_guides')
      .doc(id)
      .get();
    if (guideDoc.exists) {
      const data = guideDoc.data() || {};
      const storedContent = toPlainText(data.content || '');
      const content =
        storedContent.length >= MIN_COMPLETE_GUIDE_LENGTH || !fallbackContent
          ? storedContent
          : fallbackContent;

      guide = {
        id: guideDoc.id,
        title: normalizeGuideCopy(data.title, fallbackGuide?.title || 'Guia'),
        description: normalizeGuideCopy(
          data.description,
          fallbackGuide?.description,
        ),
        category: normalizeGuideCopy(
          data.category,
          fallbackGuide?.category || 'Guia',
        ),
        readTime: data.readTime || fallbackGuide?.readTime || '',
        pages: data.pages || fallbackGuide?.pages || '',
        downloadUrl: data.fileUrl || data.url || null,
        content,
      };
    }
  } catch (error) {
    console.error('Erro ao carregar guia por ID:', error);
  }

  if (!guide && fallbackGuide) {
    guide = {
      id: fallbackGuide.id,
      title: fallbackGuide.title || 'Guia',
      description: fallbackGuide.description || '',
      category: fallbackGuide.category || 'Guia',
      readTime: fallbackGuide.readTime || '',
      pages: fallbackGuide.pages || '',
      downloadUrl: null,
      content: fallbackContent,
    };
  }

  if (!guide) {
    return { notFound: true };
  }

  return {
    props: {
      guide,
    },
  };
}
