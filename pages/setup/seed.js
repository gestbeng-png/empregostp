import { useState } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { FiAlertTriangle, FiArrowLeft, FiDatabase, FiPlay } from 'react-icons/fi';
import { useAuth } from '../../context/AuthContext';
import { requireAdminPageAuth } from '../../lib/adminPageGuard';
import { addDocument, setDocument } from '../../lib/db';
import styles from '../../styles/SeedPage.module.css';

const FEATURED_POST = {
    id: 'featured-1',
    category: '🎉 Novidades',
    title: 'EmpregoSTP atinge marca historica de 10.000 candidatos registrados',
    excerpt: 'Celebramos um marco importante! Nossa plataforma conectou milhares de profissionais santomenses com oportunidades de trabalho em diversos setores. Este crescimento reflete a confianca depositada por candidatos e empresas na transformacao digital do mercado de trabalho em STP.',
    author: 'Equipa EmpregoSTP',
    date: '2 Fev 2026',
    readTime: '5 min',
    views: '4.8k',
    image: '/assets/people/team-working.webp'
};

const POSTS = [
    {
        category: '🤝 Parcerias',
        title: 'Parceria com Ministerio do Trabalho fortalece mercado de emprego',
        excerpt: 'Nova colaboracao institucional vai digitalizar processos de recrutamento e facilitar acesso a oportunidades formais em todo o pais.',
        author: 'Equipa EmpregoSTP',
        date: '30 Jan 2026',
        readTime: '4 min',
        views: '2.3k',
        color: '#6366f1'
    },
    {
        category: '⭐ Historias de Sucesso',
        title: 'Maria encontrou emprego como gestora em apenas 7 dias',
        excerpt: 'Profissional da diaspora retornou a STP e conseguiu recolocacao rapida atraves da plataforma. Conheca sua historia inspiradora.',
        author: 'Equipa EmpregoSTP',
        date: '28 Jan 2026',
        readTime: '6 min',
        views: '3.1k',
        color: '#10b981'
    },
    {
        category: '🔧 Atualizacoes',
        title: 'Nova funcionalidade: Match inteligente candidato-vaga',
        excerpt: 'Algoritmo de IA agora sugere as melhores vagas baseado no seu perfil, economizando tempo e aumentando suas chances de sucesso.',
        author: 'Equipa Tecnica',
        date: '25 Jan 2026',
        readTime: '5 min',
        views: '1.9k',
        color: '#f59e0b'
    },
    {
        category: '🎓 Eventos',
        title: 'Workshop de preparacao para entrevistas reuniu 200 participantes',
        excerpt: 'Evento gratuito ajudou dezenas de candidatos a aperfeicoarem suas tecnicas e ganharem confianca para processos seletivos.',
        author: 'Equipa EmpregoSTP',
        date: '22 Jan 2026',
        readTime: '4 min',
        views: '1.7k',
        color: '#ec4899'
    },
    {
        category: '📊 Estatisticas',
        title: '+500 vagas publicadas em Janeiro: recorde mensal da plataforma',
        excerpt: 'Crescimento de 35% em relacao ao mes anterior mostra aquecimento do mercado e confianca das empresas na economia santomense.',
        author: 'Equipa EmpregoSTP',
        date: '20 Jan 2026',
        readTime: '3 min',
        views: '2.5k',
        color: '#8b5cf6'
    },
    {
        category: '🎉 Novidades',
        title: 'Lancamento do app mobile EmpregoSTP para iOS e Android',
        excerpt: 'Agora voce pode buscar vagas, candidatar-se e acompanhar suas aplicacoes direto do seu smartphone. Disponivel nas lojas de apps.',
        author: 'Equipa Tecnica',
        date: '18 Jan 2026',
        readTime: '4 min',
        views: '3.8k',
        color: '#14b8a6'
    }
];

const PLATFORM_STATS = [
    {
        id: 's1',
        label: 'Candidatos Registrados',
        value: '10.000+',
        growth: '+23%',
        icon: 'users',
        color: '#6366f1'
    },
    {
        id: 's2',
        label: 'Vagas Publicadas',
        value: '2.500+',
        growth: '+35%',
        icon: 'trending',
        color: '#10b981'
    },
    {
        id: 's3',
        label: 'Empresas Parceiras',
        value: '450+',
        growth: '+18%',
        icon: 'briefcase',
        color: '#f59e0b'
    },
    {
        id: 's4',
        label: 'Contratacoes Realizadas',
        value: '1.200+',
        growth: '+42%',
        icon: 'check',
        color: '#ec4899'
    }
];

const NEWS = [
    {
        category: 'Destaques',
        title: 'Plataforma bateu recorde de acessos em Janeiro',
        excerpt: 'Mais de 50.000 visitas registradas, consolidando EmpregoSTP como lider do setor.',
        date: '1 Fev 2026'
    },
    {
        category: 'Proximos Eventos',
        title: 'Workshop de CV acontece dia 15 de Fevereiro',
        excerpt: 'Inscricoes abertas para evento gratuito no Centro Cultural de Sao Tome.',
        date: '30 Jan 2026'
    },
    {
        category: 'Campanhas',
        title: 'Programa de Estagios 2026 com 50 vagas',
        excerpt: 'Empresas parceiras oferecem oportunidades para jovens talentos santomenses.',
        date: '28 Jan 2026'
    },
    {
        category: 'Mercado',
        title: 'Setor de turismo lidera contratacoes no trimestre',
        excerpt: 'Hoteis e resorts aumentam equipes para alta temporada turistica.',
        date: '25 Jan 2026'
    }
];

const TEMPLATES = [
    {
        category: 'CV',
        title: 'Curriculo Classico',
        description: 'Template limpo e profissional, ideal para areas tradicionais como financas e administracao.',
        format: 'DOCX',
        downloads: 2453,
        color: '#6366f1'
    },
    {
        category: 'CV',
        title: 'Curriculo Moderno',
        description: 'Design contemporaneo com secoes bem definidas, perfeito para tecnologia e marketing.',
        format: 'PDF',
        downloads: 3124,
        color: '#6366f1'
    },
    {
        category: 'CV',
        title: 'Curriculo Criativo',
        description: 'Layout diferenciado para profissionais de design, arte e comunicacao.',
        format: 'DOCX',
        downloads: 1876,
        color: '#6366f1'
    },
    {
        category: 'Carta',
        title: 'Carta de Motivacao',
        description: 'Modelo estruturado para acompanhar sua candidatura com impacto.',
        format: 'PDF',
        downloads: 2918,
        color: '#10b981'
    },
    {
        category: 'Carta',
        title: 'Carta de Recomendacao',
        description: 'Template para gestores emitirem recomendacoes profissionais.',
        format: 'DOCX',
        downloads: 1245,
        color: '#10b981'
    },
    {
        category: 'Contrato',
        title: 'Contrato de Trabalho',
        description: 'Modelo basico de contrato seguindo a legislacao de STP.',
        format: 'PDF',
        downloads: 1567,
        color: '#f59e0b'
    },
    {
        category: 'Contrato',
        title: 'Contrato de Estagio',
        description: 'Template para formalizacao de estagios curriculares e profissionais.',
        format: 'DOCX',
        downloads: 987,
        color: '#f59e0b'
    },
    {
        category: 'Freelancer',
        title: 'Contrato de Prestacao de Servicos',
        description: 'Modelo completo para trabalhos freelance e projetos pontuais.',
        format: 'PDF',
        downloads: 1432,
        color: '#ec4899'
    }
];

const GUIDES = [
    {
        title: 'Guia Completo de Entrevistas',
        description: 'Preparacao, postura, perguntas comuns e como causar uma otima primeira impressao.',
        readTime: '15 min',
        pages: 24,
        category: 'Carreira',
        color: '#6366f1',
        popular: true
    },
    {
        title: 'Direitos do Trabalhador em STP',
        description: 'Entenda seus direitos sobre ferias, salarios, subsidios e demissao.',
        readTime: '20 min',
        pages: 32,
        category: 'Legislacao',
        color: '#10b981',
        popular: false
    },
    {
        title: 'Como Negociar Salario',
        description: 'Estrategias e scripts para negociar sua remuneracao com confianca.',
        readTime: '12 min',
        pages: 18,
        category: 'Carreira',
        color: '#f59e0b',
        popular: true
    },
    {
        title: 'Trabalho Remoto Internacional',
        description: 'Como encontrar, candidatar-se e gerenciar trabalhos remotos do exterior.',
        readTime: '18 min',
        pages: 28,
        category: 'Freelancer',
        color: '#ec4899',
        popular: false
    }
];

const TOOLS = [
    {
        id: 'tool1',
        icon: 'calculator',
        title: 'Calculadora Salarial',
        description: 'Descubra o salario medio para sua funcao e nivel de experiencia em STP.',
        color: '#6366f1',
        link: '#'
    },
    {
        id: 'tool2',
        icon: 'document',
        title: 'Gerador de CV',
        description: 'Crie seu curriculo profissional em minutos com nosso gerador online.',
        color: '#10b981',
        link: '#'
    },
    {
        id: 'tool3',
        icon: 'scale',
        title: 'Calculadora de Impostos',
        description: 'Estime seus impostos e contribuicoes como trabalhador ou freelancer.',
        color: '#f59e0b',
        link: '#'
    }
];

const FAQS = [
    {
        id: 'faq1',
        question: 'Como me candidatar a uma vaga no EmpregoSTP?',
        answer: 'Crie uma conta gratuita, complete seu perfil e CV, navegue pelas vagas disponiveis e clique em "Candidatar-me" nas oportunidades que lhe interessam. O empregador recebera sua candidatura automaticamente.'
    },
    {
        id: 'faq2',
        question: 'Quanto custa usar a plataforma?',
        answer: 'Para candidatos, a plataforma e 100% gratuita. Voce pode criar perfil, candidatar-se a vagas e usar recursos basicos sem qualquer custo. Oferecemos planos premium com recursos adicionais para quem deseja mais visibilidade.'
    },
    {
        id: 'faq3',
        question: 'Como sei se minha candidatura foi vista?',
        answer: 'No seu dashboard, voce pode acompanhar o status de todas as suas candidaturas. Quando um empregador visualiza seu perfil ou altera o status, voce recebe uma notificacao automatica.'
    },
    {
        id: 'faq4',
        question: 'Posso editar minha candidatura depois de enviar?',
        answer: 'Voce pode atualizar seu CV e perfil a qualquer momento. As alteracoes ficam disponiveis para todos os empregadores. No entanto, mensagens enviadas junto com candidaturas nao podem ser editadas.'
    },
    {
        id: 'faq5',
        question: 'Como funciona a verificacao de perfil?',
        answer: 'A verificacao confirma sua identidade e aumenta sua credibilidade. Voce pode verificar seu email, telefone e documentos. Perfis verificados tem ate 3x mais visualizacoes de empregadores.'
    },
    {
        id: 'faq6',
        question: 'Quanto tempo as vagas ficam ativas?',
        answer: 'As vagas ficam ativas por 30 dias por padrao, mas os empregadores podem estender ou encerrar antes. Recomendamos candidatar-se o mais rapido possivel as oportunidades interessantes.'
    }
];

const SERVICES = [
    {
        id: 'coaching',
        icon: 'users',
        title: 'Career Coaching Premium',
        description: 'Sessoes individuais com especialistas de RH para definir seu roadmap profissional, otimizar seu perfil e acelerar sua carreira.',
        features: ['Diagnostico de carreira', 'Plano de acao personalizado', 'Simulacao de entrevista', 'Revisao de LinkedIn', 'Acompanhamento mensal'],
        price: '150',
        priceNote: 'por sessao',
        duration: '90 min',
        popular: true,
        color: '#6366f1',
        cta: 'Agendar Sessao'
    },
    {
        id: 'repatriacao',
        icon: 'plane',
        title: 'Apoio a Repatriacao',
        description: 'Servico completo para profissionais da Diaspora que desejam regressar a STP com transicao suave e conexoes diretas.',
        features: ['Guia completo de mudanca', 'Equivalencia de diplomas', 'Assessoria fiscal', 'Networking com empresas', 'Suporte logistico'],
        price: '300',
        priceNote: 'pacote completo',
        duration: '3 meses',
        popular: false,
        color: '#10b981',
        cta: 'Solicitar Consulta'
    },
    {
        id: 'executivo',
        icon: 'star',
        title: 'Recolocacao Executiva',
        description: 'Acompanhamento premium para profissionais seniores: posicionamento estrategico, acesso a rede C-level e negociacao.',
        features: ['Diagnostico executivo', 'Personal branding', 'Preparacao para boards', 'Negociacao salarial', 'Acesso exclusivo a vagas'],
        price: '500',
        priceNote: 'programa completo',
        duration: '6 meses',
        popular: false,
        color: '#ec4899',
        cta: 'Falar com Especialista'
    },
    {
        id: 'freelancer',
        icon: 'laptop',
        title: 'Apoio ao Freelancer',
        description: 'Orientacao completa sobre trabalho remoto internacional: abertura de atividade, impostos em STP e contratos seguros.',
        features: ['Guia fiscal digital', 'Modelos de contrato', 'Pagamentos internacionais', 'Protecao legal', 'Networking remoto'],
        price: '200',
        priceNote: 'consultoria completa',
        duration: '2 sessoes',
        popular: false,
        color: '#f59e0b',
        cta: 'Iniciar Consultoria'
    },
    {
        id: 'branding',
        icon: 'lightbulb',
        title: 'Marca Pessoal',
        description: 'Construimos seu posicionamento profissional com portfolio moderno, narrativa clara e presenca digital forte.',
        features: ['Storytelling profissional', 'Portfolio visual', 'Perfil otimizado', 'Estrategia de conteudo', 'Sessao fotografica'],
        price: '250',
        priceNote: 'pacote completo',
        duration: '4 semanas',
        popular: false,
        color: '#8b5cf6',
        cta: 'Montar Portfolio'
    },
    {
        id: 'empresa',
        icon: 'briefcase',
        title: 'Recrutamento para Empresas',
        description: 'Servico dedicado para empresas: apoio no recrutamento, triagem de candidatos e campanhas de atracao de talentos.',
        features: ['Shortlist qualificada', 'Entrevistas guiadas', 'Relatorio final', 'Suporte continuo', 'Employer branding'],
        price: 'Sob consulta',
        priceNote: 'por vaga',
        duration: 'Variavel',
        popular: false,
        color: '#14b8a6',
        cta: 'Solicitar Proposta'
    }
];

const COURSES = [
    {
        title: 'Dominando Entrevistas de Emprego',
        description: 'Aprenda tecnicas avancadas para se destacar em qualquer entrevista.',
        modules: 8,
        duration: '4h 30min',
        students: 342,
        rating: 4.9,
        price: '49',
        color: '#6366f1',
        badge: 'Mais Vendido'
    },
    {
        title: 'CV e Carta de Motivacao Perfeitos',
        description: 'Crie documentos que chamam atencao dos recrutadores.',
        modules: 6,
        duration: '3h 15min',
        students: 289,
        rating: 4.8,
        price: '39',
        color: '#10b981',
        badge: null
    },
    {
        title: 'LinkedIn para Profissionais',
        description: 'Otimize seu perfil e construa uma rede de contactos poderosa.',
        modules: 5,
        duration: '2h 45min',
        students: 198,
        rating: 4.7,
        price: '35',
        color: '#f59e0b',
        badge: 'Novo'
    },
    {
        title: 'Negociacao Salarial',
        description: 'Aprenda a negociar salarios e beneficios com confianca.',
        modules: 4,
        duration: '2h 00min',
        students: 156,
        rating: 4.9,
        price: '45',
        color: '#ec4899',
        badge: null
    }
];

const MENTORS = [
    {
        name: 'Ana Costa',
        role: 'HR Director',
        company: 'TechSTP',
        experience: '15 anos',
        specialty: 'Tecnologia',
        sessions: 120,
        rating: 5.0,
        available: true
    },
    {
        name: 'Pedro Dias',
        role: 'CEO',
        company: 'StartUp STP',
        experience: '20 anos',
        specialty: 'Empreendedorismo',
        sessions: 85,
        rating: 4.9,
        available: true
    },
    {
        name: 'Maria Santos',
        role: 'Finance Manager',
        company: 'BancoSTP',
        experience: '12 anos',
        specialty: 'Financas',
        sessions: 95,
        rating: 4.8,
        available: false
    }
];

const TESTIMONIALS = [
    {
        name: 'Joao Fernandes',
        role: 'Software Developer',
        text: 'O coaching de carreira mudou completamente minha abordagem profissional. Consegui uma promocao em apenas 3 meses!',
        rating: 5
    },
    {
        name: 'Carla Neves',
        role: 'Marketing Manager',
        text: 'O servico de repatriacao foi fundamental para minha volta a STP. Apoio completo em todas as etapas.',
        rating: 5
    },
    {
        name: 'Miguel Santos',
        role: 'Freelancer',
        text: 'Com a consultoria para freelancers, consegui regularizar minha situacao fiscal e expandir meus clientes internacionais.',
        rating: 5
    }
];

const LINKS = [
    {
        title: 'Ministerio do Trabalho STP',
        description: 'Portal oficial com informacoes sobre legislacao e servicos publicos.',
        url: 'https://governo.st',
        category: 'Governo'
    },
    {
        title: 'Camara de Comercio STP',
        description: 'Informacoes sobre empresas, negocios e oportunidades comerciais.',
        url: 'https://ccistp.st',
        category: 'Negocios'
    },
    {
        title: 'Instituto de Seguranca Social',
        description: 'Informacoes sobre contribuicoes, beneficios e pensoes.',
        url: 'https://inss.st',
        category: 'Governo'
    }
];

export default function SeedDataPage() {
    const { user, loading: authLoading } = useAuth();
    const [logs, setLogs] = useState([]);
    const [isSeeding, setIsSeeding] = useState(false);
    const [confirmed, setConfirmed] = useState(false);

    const log = (message) => {
        setLogs(prev => [...prev, `${new Date().toLocaleTimeString()}: ${message}`]);
    };

    const seedData = async () => {
        if (!user) {
            log('Sessão de administrador indisponível.');
            return;
        }

        setIsSeeding(true);
        log('A iniciar a preparação dos dados.');

        try {
            // 1. Featured Post
            await setDocument('posts', FEATURED_POST.id, FEATURED_POST);
            log('Artigo em destaque preparado.');

            // 2. Posts
            for (const post of POSTS) {
                await addDocument('posts', post);
            }
            log(`${POSTS.length} artigos preparados.`);

            // 3. Platform Stats
            for (const stat of PLATFORM_STATS) {
                await setDocument('platform_stats', stat.id, stat);
            }
            log('Estatísticas da plataforma preparadas.');

            // 4. News
            for (const item of NEWS) {
                await addDocument('news', item);
            }
            log('Notícias preparadas.');

            // 5. Templates
            for (const item of TEMPLATES) {
                await addDocument('resources_templates', item);
            }
            log('Modelos preparados.');

            // 6. Guides
            for (const item of GUIDES) {
                await addDocument('resources_guides', item);
            }
            log('Guias preparados.');

            // 7. Tools
            for (const item of TOOLS) {
                await setDocument('resources_tools', item.id, item);
            }
            log('Ferramentas preparadas.');

            // 8. FAQs
            for (const item of FAQS) {
                await setDocument('resources_faqs', item.id, item);
            }
            log('Perguntas frequentes preparadas.');

            // 9. Services
            for (const item of SERVICES) {
                await setDocument('resources_services', item.id, item);
            }
            log('Serviços preparados.');

            // 10. Courses
            for (const item of COURSES) {
                await addDocument('resources_courses', item);
            }
            log('Cursos preparados.');

            // 11. Mentors
            for (const item of MENTORS) {
                await addDocument('resources_mentors', item);
            }
            log('Mentores preparados.');

            // 12. Testimonials
            for (const item of TESTIMONIALS) {
                await addDocument('resources_testimonials', item);
            }
            log('Testemunhos preparados.');

            // 13. Links
            for (const item of LINKS) {
                await addDocument('resources_links', item);
            }
            log('Ligações úteis preparadas.');

            log('Preparação de dados concluída com sucesso.');
            setConfirmed(false);
        } catch (error) {
            log(`Erro ao preparar os dados: ${error.message}`);
            console.error(error);
        } finally {
            setIsSeeding(false);
        }
    };

    return (
        <>
            <Head>
                <title>Preparar dados de desenvolvimento | EmpregoSTP</title>
            </Head>
            <main className={styles.page}>
                <div className={styles.container}>
                    <Link href="/dashboard/admin" className={styles.backLink}>
                        <FiArrowLeft aria-hidden="true" />
                        Voltar ao painel de administração
                    </Link>

                    <header className={styles.header}>
                        <span className={styles.eyebrow}>
                            <FiDatabase aria-hidden="true" />
                            Ferramenta interna
                        </span>
                        <h1>Preparar dados de desenvolvimento</h1>
                        <p>Cria ou atualiza o conjunto de demonstração usado nas áreas públicas da plataforma.</p>
                    </header>

                    <section className={styles.controls} aria-labelledby="seed-controls-title">
                        <div className={styles.warning}>
                            <FiAlertTriangle aria-hidden="true" />
                            <div>
                                <h2 id="seed-controls-title">Confirme antes de executar</h2>
                                <p>Algumas coleções recebem novos documentos em cada execução. Utilize esta ferramenta apenas no ambiente de desenvolvimento.</p>
                            </div>
                        </div>

                        <p className={styles.session}>
                            {authLoading ? 'A validar a sessão…' : user ? `Administrador: ${user.email}` : 'Sessão não disponível.'}
                        </p>

                        <label className={styles.confirmation}>
                            <input
                                type="checkbox"
                                checked={confirmed}
                                onChange={(event) => setConfirmed(event.target.checked)}
                            />
                            Confirmo que estou num ambiente de desenvolvimento.
                        </label>

                        <button
                            type="button"
                            onClick={seedData}
                            disabled={authLoading || !user || !confirmed || isSeeding}
                            className={styles.primaryButton}
                        >
                            <FiPlay aria-hidden="true" />
                            {isSeeding ? 'A preparar dados…' : 'Preparar dados'}
                        </button>
                    </section>

                    <section className={styles.logPanel} aria-labelledby="seed-log-title">
                        <h2 id="seed-log-title">Registo da execução</h2>
                        <div className={styles.log} role="log" aria-live="polite" aria-relevant="additions">
                            {logs.map((entry, index) => (
                                <p key={`${entry}-${index}`} className={entry.includes('Erro') ? styles.logError : undefined}>
                                    {entry}
                                </p>
                            ))}
                            {logs.length === 0 ? <p className={styles.logEmpty}>Os passos da execução aparecem aqui.</p> : null}
                        </div>
                    </section>
                </div>
            </main>
        </>
    );
}

export async function getServerSideProps(context) {
  if (process.env.ENABLE_DEV_SEED_PAGE !== 'true') {
    return { notFound: true };
  }

  const authResult = await requireAdminPageAuth(context);
  if (!authResult.ok) {
    return { redirect: authResult.redirect };
  }

  return {
    props: {}
  };
}
