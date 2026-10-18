import { escapeHtml } from '../escapeHtml.js';
import { botao, etiquetas, paragrafo, renderEmail } from './emailLayout.js';
import { normalizeExternalUrl } from '../externalUrl.js';

// Emails da newsletter: boas-vindas à subscrição e anúncio de nova publicação.

export function welcomeEmail({ site = 'https://empregostp.com' }) {
  const corpo =
    paragrafo(
      'Obrigado por subscrever a newsletter do <b style="color:#0f1b34;">EmpregoSTP</b>.',
    ) +
    paragrafo(
      'A partir de agora recebe novidades, dicas de carreira e novos artigos sobre o mercado de trabalho em São Tomé e Príncipe.',
    ) +
    botao({ label: 'Ver os artigos mais recentes', url: `${site}/blog` });

  return {
    subject: 'Bem-vindo à newsletter do EmpregoSTP',
    html: renderEmail({
      eyebrow: 'Newsletter',
      titulo: 'Subscrição confirmada',
      preheader:
        'Novidades, dicas de carreira e novas vagas em São Tomé e Príncipe.',
      corpo,
      rodape: `Recebeu este email porque subscreveu a newsletter em <a href="${site}" style="color:#2f6edb;">empregostp.com</a>.`,
      site,
    }),
    text: `Subscrição confirmada\n\nObrigado por subscrever a newsletter do EmpregoSTP. Vai receber novidades, dicas de carreira e novos artigos.\n\nVer artigos: ${site}/blog`,
  };
}

const RESUMO_MAX = 260;

/** Converte o conteúdo (HTML ou texto) num resumo curto de texto simples. */
function resumirConteudo(valor) {
  const texto = String(valor || '')
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<\/p>/gi, ' ')
    .replace(/<[^>]*>/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  if (texto.length <= RESUMO_MAX) return texto;
  return `${texto.slice(0, RESUMO_MAX).trimEnd()}…`;
}

/**
 * Anúncio de um artigo do blog ou de uma notícia publicada.
 *
 * O título é o elemento central: aparece no assunto, no preheader e como
 * cabeçalho do email. As colecções `posts` e `news` usam ambas o campo `title`;
 * só o blog tem `excerpt`, `author` e `readTime`, e só as notícias têm
 * `content` e os links opcionais (`formUrl`, `siteUrl`).
 *
 * O `type` decide o vocabulário: uma notícia não pode chamar-se "artigo".
 */
export function announcementEmail({
  post = {},
  postId,
  type = 'blog',
  site = 'https://empregostp.com',
}) {
  const noticia = type === 'news';
  const url = `${site}/blog/${postId}`;
  const titulo = post.title || (noticia ? 'Nova notícia' : 'Nova publicação');
  const resumo = post.excerpt || (noticia ? resumirConteudo(post.content) : '');
  const formUrl = noticia ? normalizeExternalUrl(post.formUrl) : '';
  const siteUrl = noticia ? normalizeExternalUrl(post.siteUrl) : '';
  const rotuloPrincipal = noticia ? 'Ver a notícia' : 'Ler o artigo completo';

  const corpo =
    etiquetas([
      post.category,
      post.readTime ? `${post.readTime} de leitura` : null,
    ]) +
    (resumo ? paragrafo(escapeHtml(resumo)) : '') +
    (post.author
      ? paragrafo(`Por ${escapeHtml(post.author)}.`, { suave: true })
      : '') +
    // Quando há formulário, é ele a acção principal: o resto fica secundário.
    (formUrl
      ? botao({ label: 'Preencher formulário', url: formUrl }) +
        botao({ label: rotuloPrincipal, url, variante: 'secundaria' })
      : botao({ label: rotuloPrincipal, url })) +
    (siteUrl
      ? botao({ label: 'Ir ao site', url: siteUrl, variante: 'secundaria' })
      : '');

  const blocosTexto = [
    titulo,
    resumo,
    post.author ? `Por ${post.author}.` : '',
    formUrl ? `Preencher formulário: ${formUrl}` : '',
    `${noticia ? 'Ver a notícia' : 'Ler'}: ${url}`,
    siteUrl ? `Site: ${siteUrl}` : '',
    'Recebeu este email porque tem conta no EmpregoSTP ou subscreveu a newsletter. Para deixar de os receber, vá a Definições no seu painel.',
  ].filter(Boolean);

  return {
    // O título vai no assunto: é o que decide se a pessoa abre.
    subject: titulo,
    html: renderEmail({
      eyebrow: noticia ? 'Nova notícia' : 'Nova publicação',
      titulo,
      preheader:
        resumo ||
        (noticia
          ? 'Nova notícia publicada no EmpregoSTP.'
          : 'Novo artigo publicado no EmpregoSTP.'),
      corpo,
      rodape: `Recebeu este email porque tem conta no EmpregoSTP ou subscreveu a newsletter. Pode desligar estes avisos nas <a href="${site}/dashboard" style="color:#2f6edb;">Definições</a> do seu painel.`,
      site,
    }),
    text: blocosTexto.join('\n\n'),
  };
}

export default announcementEmail;
