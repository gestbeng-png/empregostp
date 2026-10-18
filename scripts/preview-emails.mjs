// Envia uma amostra de cada email automático para um único destinatário.
//
// Uso: npm run preview:emails -- destino@exemplo.com
//
// Não cria vagas, candidaturas nem subscrições, e não toca no Firestore: usa
// dados fictícios e exercita apenas os templates + a entrega pelo Brevo. É a
// forma de validar os emails sem avisar candidatos reais de uma vaga que não
// existe.
import { loadEnv } from './loadEnv.mjs';

loadEnv();

const { isEmailConfigured, sendEmail } = await import('../lib/email/index.js');
const { decisionEmail } = await import('../lib/email/jobModerationEmail.js');
const { buildNewApplicationEmail } =
  await import('../lib/email/applicationEmails.js');
const { buildNewJobEmail } = await import('../lib/email/newJobEmail.js');
const { buildJobAlertEmail } = await import('../lib/email/jobAlertEmail.js');
const { welcomeEmail, announcementEmail } =
  await import('../lib/email/newsletterEmails.js');
const { notificationEmail } = await import('../lib/email/contactEmails.js');

const destino = process.argv[2] || process.env.EMAIL_FROM_ADDRESS;
const site = process.env.NEXT_PUBLIC_SITE_URL || 'https://empregostp.com';

if (!destino) {
  console.error(
    'Indica o destinatário: npm run preview:emails -- alguem@exemplo.com',
  );
  process.exit(1);
}
if (!isEmailConfigured()) {
  console.error('Email não configurado (falta BREVO_API_KEY).');
  process.exit(1);
}

const vagaFicticia = {
  titulo: '[TESTE] Técnico de Manutenção Industrial',
  empresaNome: 'Empresa de Demonstração',
  companyName: 'Empresa de Demonstração',
  localizacao: 'Água Grande, São Tomé',
  tipoContrato: 'Tempo inteiro',
  salarioMin: 8000,
  salarioMax: 12000,
  moeda: 'STN',
  status: 'active',
  publicadoEm: new Date().toISOString(),
};

const amostras = [
  {
    nome: 'Vaga aprovada (para a empresa)',
    conteudo: decisionEmail({ approved: true, jobTitle: vagaFicticia.titulo }),
  },
  {
    nome: 'Vaga rejeitada (para a empresa)',
    conteudo: decisionEmail({
      approved: false,
      jobTitle: vagaFicticia.titulo,
      reason: 'A descrição não indica o local de trabalho',
    }),
  },
  {
    nome: 'Nova candidatura (para a empresa)',
    conteudo: buildNewApplicationEmail({
      candidateName: 'Maria dos Santos',
      jobTitle: vagaFicticia.titulo,
      compatibilityLabel: 'Boa compatibilidade',
      compatibilityScore: 82,
      hasCoverLetter: true,
      priorityApplied: true,
      site,
    }),
  },
  {
    nome: 'Nova vaga publicada (para candidatos)',
    conteudo: buildNewJobEmail({
      job: vagaFicticia,
      jobId: 'vaga-de-teste',
      site,
    }),
  },
  {
    nome: 'Alerta de vagas (resumo para candidatos)',
    conteudo: buildJobAlertEmail({
      jobs: [
        vagaFicticia,
        { ...vagaFicticia, titulo: '[TESTE] Assistente Administrativo' },
      ],
      site,
      filters: { localizacao: 'Água Grande' },
      unsubscribeUrl: `${site}/alertas/cancelar?token=exemplo`,
    }),
  },
  { nome: 'Boas-vindas à newsletter', conteudo: welcomeEmail({ site }) },
  {
    nome: 'Candidatura espontânea (formulário de carreiras)',
    conteudo: notificationEmail({
      name: 'Ana Trindade',
      email: 'ana.trindade@exemplo.com',
      subject: 'carreira',
      subjectLabel: 'Quer juntar-se à equipa',
      message:
        'Sou designer há seis anos e acompanho o EmpregoSTP desde o lançamento.\nGostava de ajudar na experiência dos candidatos.',
    }),
  },
  {
    nome: 'Mensagem de contacto (formulário público)',
    conteudo: notificationEmail({
      name: 'João Carvalho',
      email: 'joao@exemplo.com',
      phone: '+239 991 2345',
      subject: 'empresa',
      subjectLabel: 'Sou empresa',
      message: 'Queria saber como publicar vagas para a minha empresa.',
    }),
  },
  {
    nome: 'Newsletter — nova publicação',
    conteudo: announcementEmail({
      post: {
        // Os campos são os reais das colecções `posts` e `news`: title,
        // excerpt, category, author, readTime. Antes passavam-se em português
        // e o email saía com o título genérico "Novo artigo".
        title: 'Cinco erros comuns no currículo (e como corrigi-los)',
        excerpt:
          'O que os empregadores em São Tomé notam primeiro quando abrem um CV, e as correções que fazem diferença já na próxima candidatura.',
        category: 'Carreira',
        author: 'Equipa EmpregoSTP',
        readTime: '6 min',
      },
      postId: 'artigo-de-teste',
      type: 'blog',
      site,
    }),
  },
  {
    nome: 'Newsletter — nova notícia (com formulário)',
    conteudo: announcementEmail({
      post: {
        title: 'Noite Catchupa',
        category: 'EVENTO',
        content:
          '<p>Uma noite de música, catchupa e conversa sobre trabalho na cidade. Entrada livre, inscrição pelo formulário.</p>',
        formUrl: 'https://forms.gle/exemplo',
        siteUrl: 'https://exemplo.st/noite-catchupa',
      },
      postId: 'noticia-de-teste',
      type: 'news',
      site,
    }),
  },
];

console.log(
  `\nA enviar ${amostras.length} emails de amostra para ${destino}\n`,
);

let falhas = 0;
for (const [indice, amostra] of amostras.entries()) {
  const numero = String(indice + 1).padStart(2, '0');
  try {
    const { subject, html, text } = amostra.conteudo;
    await sendEmail({
      to: destino,
      subject: `[${numero}] ${subject}`,
      html,
      text,
    });
    console.log(`  ${numero}  OK      ${amostra.nome}`);
  } catch (erro) {
    falhas += 1;
    console.error(`  ${numero}  FALHOU  ${amostra.nome} — ${erro.message}`);
  }
}

console.log(
  falhas
    ? `\n${falhas} de ${amostras.length} falharam.\n`
    : `\nTodos aceites. Confirma a entrega em https://app.brevo.com/statistics/email\n`,
);
process.exit(falhas ? 1 : 0);
