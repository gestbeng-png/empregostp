import Head from 'next/head';
import { useState } from 'react';
import Link from 'next/link';
import LandingHeader from '../components/LandingHeader';
import Footer from '../components/home/Footer';

const icons = {
  users: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" />
    </svg>
  ),
  target: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="10" />
      <circle cx="12" cy="12" r="6" />
      <circle cx="12" cy="12" r="2" />
    </svg>
  ),
  mic: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="9" y="2" width="6" height="11" rx="3" />
      <path d="M5 10a7 7 0 0014 0" />
      <line x1="12" y1="19" x2="12" y2="22" />
    </svg>
  ),
  document: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
      <path d="M14 2v6h6M16 13H8M16 17H8M10 9H8" />
    </svg>
  ),
  briefcase: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="2" y="7" width="20" height="14" rx="2" />
      <path d="M16 7V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v2" />
    </svg>
  ),
  trending: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
      <polyline points="17 6 23 6 23 12" />
    </svg>
  ),
  star: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
    </svg>
  ),
  plane: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" />
    </svg>
  ),
  laptop: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="2" y="3" width="20" height="14" rx="2" />
      <path d="M2 20h20" />
    </svg>
  ),
  lightbulb: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M9 18h6M10 22h4" />
      <path d="M15.09 14c.18-.98.65-1.74 1.41-2.5A5.5 5.5 0 1 0 8.5 14c.76.76 1.23 1.52 1.41 2.5" />
    </svg>
  ),
  check: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  ),
  arrow: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <line x1="5" y1="12" x2="19" y2="12" />
      <polyline points="12 5 19 12 12 19" />
    </svg>
  ),
  calendar: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  ),
  award: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="8" r="6" />
      <path d="M15.477 12.89L17 22l-5-3-5 3 1.523-9.11" />
    </svg>
  ),
  clock: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  )
};

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
    id: 'c1',
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
    id: 'c2',
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
    id: 'c3',
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
    id: 'c4',
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
    id: 'm1',
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
    id: 'm2',
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
    id: 'm3',
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
    id: 't1',
    name: 'Joao Fernandes',
    role: 'Software Developer',
    text: 'O coaching de carreira mudou completamente minha abordagem profissional. Consegui uma promocao em apenas 3 meses!',
    rating: 5
  },
  {
    id: 't2',
    name: 'Carla Neves',
    role: 'Marketing Manager',
    text: 'O servico de repatriacao foi fundamental para minha volta a STP. Apoio completo em todas as etapas.',
    rating: 5
  },
  {
    id: 't3',
    name: 'Miguel Santos',
    role: 'Freelancer',
    text: 'Com a consultoria para freelancers, consegui regularizar minha situacao fiscal e expandir meus clientes internacionais.',
    rating: 5
  }
];

export default function CarreiraPage() {
  const [activeService, setActiveService] = useState('coaching');

  const styles = {
    page: {
      minHeight: '100vh',
      backgroundColor: '#09090b'
    },
    hero: {
      background: 'linear-gradient(135deg, #09090b 0%, #18181b 100%)',
      padding: '5rem 0 4rem',
      position: 'relative',
      overflow: 'hidden'
    },
    heroGlow1: {
      position: 'absolute',
      top: '-20%',
      right: '10%',
      width: '600px',
      height: '600px',
      background: 'radial-gradient(circle, rgba(99, 102, 241, 0.1) 0%, transparent 70%)',
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
      background: 'radial-gradient(circle, rgba(16, 185, 129, 0.08) 0%, transparent 70%)',
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
      marginBottom: '3rem'
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
      margin: '0 auto 2rem',
      maxWidth: '700px',
      fontSize: '1.1rem',
      color: '#a1a1aa',
      lineHeight: 1.7
    },
    heroStats: {
      display: 'flex',
      justifyContent: 'center',
      gap: '3rem',
      flexWrap: 'wrap'
    },
    heroStat: {
      textAlign: 'center'
    },
    heroStatValue: {
      display: 'block',
      fontSize: '2rem',
      fontWeight: 700,
      color: '#fafafa'
    },
    heroStatLabel: {
      fontSize: '0.85rem',
      color: '#71717a'
    },
    section: {
      padding: '4rem 0'
    },
    sectionHeader: {
      textAlign: 'center',
      marginBottom: '3rem'
    },
    sectionTitle: {
      margin: '0 0 0.75rem',
      fontSize: '2rem',
      fontWeight: 700,
      color: '#fafafa'
    },
    sectionSubtitle: {
      margin: 0,
      color: '#71717a',
      fontSize: '1rem'
    },
    servicesGrid: {
      display: 'grid',
      gridTemplateColumns: 'repeat(3, 1fr)',
      gap: '1.5rem'
    },
    serviceCard: {
      background: 'rgba(255, 255, 255, 0.02)',
      border: '1px solid rgba(255, 255, 255, 0.06)',
      borderRadius: '20px',
      padding: '2rem',
      position: 'relative',
      transition: 'all 0.3s ease',
      cursor: 'pointer',
      display: 'flex',
      flexDirection: 'column'
    },
    serviceCardHover: {
      background: 'rgba(255, 255, 255, 0.04)',
      borderColor: 'rgba(99, 102, 241, 0.3)',
      transform: 'translateY(-4px)'
    },
    popularBadge: {
      position: 'absolute',
      top: '-12px',
      right: '1.5rem',
      padding: '0.4rem 1rem',
      background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
      borderRadius: '100px',
      color: '#fff',
      fontSize: '0.7rem',
      fontWeight: 700,
      textTransform: 'uppercase',
      letterSpacing: '0.05em'
    },
    serviceIcon: {
      width: '56px',
      height: '56px',
      borderRadius: '14px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: '1.5rem'
    },
    serviceIconSvg: {
      width: '28px',
      height: '28px'
    },
    serviceTitle: {
      margin: '0 0 0.75rem',
      fontSize: '1.25rem',
      fontWeight: 700,
      color: '#fafafa'
    },
    serviceDescription: {
      margin: '0 0 1.5rem',
      color: '#a1a1aa',
      fontSize: '0.9rem',
      lineHeight: 1.6,
      flex: 1
    },
    serviceFeatures: {
      display: 'flex',
      flexDirection: 'column',
      gap: '0.5rem',
      marginBottom: '1.5rem'
    },
    serviceFeature: {
      display: 'flex',
      alignItems: 'center',
      gap: '0.5rem',
      color: '#a1a1aa',
      fontSize: '0.85rem'
    },
    serviceFeatureIcon: {
      width: '16px',
      height: '16px',
      color: '#10b981'
    },
    servicePricing: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'flex-end',
      paddingTop: '1.5rem',
      borderTop: '1px solid rgba(255, 255, 255, 0.06)'
    },
    servicePrice: {
      display: 'flex',
      flexDirection: 'column'
    },
    servicePriceValue: {
      fontSize: '1.5rem',
      fontWeight: 700,
      color: '#fafafa'
    },
    servicePriceNote: {
      fontSize: '0.75rem',
      color: '#71717a'
    },
    serviceButton: {
      padding: '0.75rem 1.25rem',
      border: 'none',
      borderRadius: '10px',
      fontSize: '0.85rem',
      fontWeight: 600,
      cursor: 'pointer',
      transition: 'all 0.2s ease'
    },
    coursesGrid: {
      display: 'grid',
      gridTemplateColumns: 'repeat(4, 1fr)',
      gap: '1.25rem'
    },
    courseCard: {
      background: 'rgba(255, 255, 255, 0.02)',
      border: '1px solid rgba(255, 255, 255, 0.06)',
      borderRadius: '16px',
      padding: '1.5rem',
      transition: 'all 0.2s ease'
    },
    courseBadge: {
      display: 'inline-block',
      padding: '0.3rem 0.75rem',
      borderRadius: '6px',
      fontSize: '0.65rem',
      fontWeight: 700,
      textTransform: 'uppercase',
      letterSpacing: '0.05em',
      marginBottom: '1rem'
    },
    courseTitle: {
      margin: '0 0 0.5rem',
      fontSize: '1rem',
      fontWeight: 600,
      color: '#fafafa',
      lineHeight: 1.4
    },
    courseDescription: {
      margin: '0 0 1rem',
      color: '#71717a',
      fontSize: '0.85rem',
      lineHeight: 1.5
    },
    courseMeta: {
      display: 'flex',
      gap: '0.75rem',
      flexWrap: 'wrap',
      marginBottom: '1rem'
    },
    courseMetaItem: {
      display: 'flex',
      alignItems: 'center',
      gap: '0.3rem',
      color: '#52525b',
      fontSize: '0.75rem'
    },
    courseMetaIcon: {
      width: '14px',
      height: '14px'
    },
    courseFooter: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingTop: '1rem',
      borderTop: '1px solid rgba(255, 255, 255, 0.04)'
    },
    coursePrice: {
      fontSize: '1.25rem',
      fontWeight: 700,
      color: '#fafafa'
    },
    courseButton: {
      padding: '0.5rem 1rem',
      background: 'rgba(99, 102, 241, 0.15)',
      border: 'none',
      borderRadius: '8px',
      color: '#a5b4fc',
      fontSize: '0.8rem',
      fontWeight: 600,
      cursor: 'pointer'
    },
    mentorsGrid: {
      display: 'grid',
      gridTemplateColumns: 'repeat(3, 1fr)',
      gap: '1.5rem'
    },
    mentorCard: {
      background: 'rgba(255, 255, 255, 0.02)',
      border: '1px solid rgba(255, 255, 255, 0.06)',
      borderRadius: '16px',
      padding: '1.5rem',
      textAlign: 'center'
    },
    mentorAvatar: {
      width: '80px',
      height: '80px',
      borderRadius: '50%',
      background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      margin: '0 auto 1rem',
      fontSize: '2rem',
      fontWeight: 700,
      color: '#fff'
    },
    mentorName: {
      margin: '0 0 0.25rem',
      fontSize: '1.1rem',
      fontWeight: 600,
      color: '#fafafa'
    },
    mentorRole: {
      margin: '0 0 0.25rem',
      color: '#a5b4fc',
      fontSize: '0.85rem'
    },
    mentorCompany: {
      margin: '0 0 1rem',
      color: '#71717a',
      fontSize: '0.8rem'
    },
    mentorStats: {
      display: 'flex',
      justifyContent: 'center',
      gap: '1.5rem',
      marginBottom: '1rem'
    },
    mentorStat: {
      textAlign: 'center'
    },
    mentorStatValue: {
      display: 'block',
      fontWeight: 600,
      color: '#e4e4e7',
      fontSize: '0.9rem'
    },
    mentorStatLabel: {
      fontSize: '0.7rem',
      color: '#52525b'
    },
    mentorStatus: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: '0.4rem',
      padding: '0.4rem 0.875rem',
      borderRadius: '100px',
      fontSize: '0.75rem',
      fontWeight: 600
    },
    statusAvailable: {
      background: 'rgba(16, 185, 129, 0.15)',
      color: '#34d399'
    },
    statusUnavailable: {
      background: 'rgba(113, 113, 122, 0.15)',
      color: '#71717a'
    },
    testimonials: {
      background: 'rgba(255, 255, 255, 0.02)',
      borderRadius: '20px',
      padding: '3rem'
    },
    testimonialsGrid: {
      display: 'grid',
      gridTemplateColumns: 'repeat(3, 1fr)',
      gap: '1.5rem'
    },
    testimonialCard: {
      padding: '1.5rem',
      background: 'rgba(255, 255, 255, 0.02)',
      border: '1px solid rgba(255, 255, 255, 0.06)',
      borderRadius: '14px'
    },
    testimonialText: {
      margin: '0 0 1rem',
      color: '#e4e4e7',
      fontSize: '0.95rem',
      lineHeight: 1.6,
      fontStyle: 'italic'
    },
    testimonialAuthor: {
      display: 'flex',
      alignItems: 'center',
      gap: '0.75rem'
    },
    testimonialAvatar: {
      width: '40px',
      height: '40px',
      borderRadius: '50%',
      background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontSize: '1rem',
      fontWeight: 600,
      color: '#fff'
    },
    testimonialName: {
      margin: 0,
      fontSize: '0.9rem',
      fontWeight: 600,
      color: '#fafafa'
    },
    testimonialRole: {
      margin: 0,
      fontSize: '0.75rem',
      color: '#71717a'
    },
    cta: {
      background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.15) 0%, rgba(139, 92, 246, 0.1) 100%)',
      border: '1px solid rgba(99, 102, 241, 0.2)',
      borderRadius: '24px',
      padding: '4rem',
      textAlign: 'center',
      marginTop: '4rem'
    },
    ctaTitle: {
      margin: '0 0 1rem',
      fontSize: '2rem',
      fontWeight: 700,
      color: '#fafafa'
    },
    ctaText: {
      margin: '0 auto 2rem',
      maxWidth: '600px',
      color: '#a1a1aa',
      fontSize: '1.1rem',
      lineHeight: 1.7
    },
    ctaButtons: {
      display: 'flex',
      gap: '1rem',
      justifyContent: 'center',
      flexWrap: 'wrap'
    },
    ctaButtonPrimary: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: '0.5rem',
      padding: '1rem 2rem',
      background: '#6366f1',
      color: '#fff',
      border: 'none',
      borderRadius: '12px',
      fontSize: '1rem',
      fontWeight: 600,
      cursor: 'pointer',
      transition: 'all 0.2s ease'
    },
    ctaButtonSecondary: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: '0.5rem',
      padding: '1rem 2rem',
      background: 'transparent',
      color: '#a5b4fc',
      border: '1px solid rgba(99, 102, 241, 0.3)',
      borderRadius: '12px',
      fontSize: '1rem',
      fontWeight: 600,
      cursor: 'pointer',
      transition: 'all 0.2s ease'
    }
  };

  return (
    <>
      <Head>
        <title>Servicos de Carreira | EmpregoSTP - Coaching, Cursos e Mentoria</title>
        <meta name="description" content="Servicos profissionais de desenvolvimento de carreira: coaching, mentoria, cursos online e apoio a repatriacao em Sao Tome e Principe." />
      </Head>

      <div style={styles.page}>
        <LandingHeader />

        {/* Hero */}
        <section style={styles.hero}>
          <div style={styles.heroGlow1} />
          <div style={styles.heroGlow2} />
          
          <div style={styles.container}>
            <div style={styles.heroContent}>
              <div style={styles.badge}>
                <span style={styles.badgeIcon}>{icons.trending}</span>
                <span style={styles.badgeText}>Servicos de Carreira</span>
              </div>
              
              <h1 style={styles.title}>Acelere sua Carreira com Apoio Profissional</h1>
              <p style={styles.subtitle}>
                Coaching personalizado, cursos online e mentoria com especialistas.
                Invista no seu desenvolvimento profissional e alcance seus objetivos.
              </p>

              <div style={styles.heroStats}>
                <div style={styles.heroStat}>
                  <span style={styles.heroStatValue}>500+</span>
                  <span style={styles.heroStatLabel}>Profissionais atendidos</span>
                </div>
                <div style={styles.heroStat}>
                  <span style={styles.heroStatValue}>95%</span>
                  <span style={styles.heroStatLabel}>Taxa de satisfacao</span>
                </div>
                <div style={styles.heroStat}>
                  <span style={styles.heroStatValue}>20+</span>
                  <span style={styles.heroStatLabel}>Mentores especialistas</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Services */}
        <section style={styles.section}>
          <div style={styles.container}>
            <div style={styles.sectionHeader}>
              <h2 style={styles.sectionTitle}>Servicos Premium</h2>
              <p style={styles.sectionSubtitle}>Escolha o servico ideal para o seu momento profissional</p>
            </div>

            <div style={styles.servicesGrid}>
              {SERVICES.map(service => (
                <div key={service.id} style={styles.serviceCard}>
                  {service.popular && <span style={styles.popularBadge}>Mais Popular</span>}
                  <div style={{ ...styles.serviceIcon, background: `${service.color}15` }}>
                    <span style={{ ...styles.serviceIconSvg, color: service.color }}>{icons[service.icon]}</span>
                  </div>
                  <h3 style={styles.serviceTitle}>{service.title}</h3>
                  <p style={styles.serviceDescription}>{service.description}</p>
                  <div style={styles.serviceFeatures}>
                    {service.features.slice(0, 4).map((feature, i) => (
                      <span key={i} style={styles.serviceFeature}>
                        <span style={styles.serviceFeatureIcon}>{icons.check}</span>
                        {feature}
                      </span>
                    ))}
                  </div>
                  <div style={styles.servicePricing}>
                    <div style={styles.servicePrice}>
                      <span style={styles.servicePriceValue}>
                        {typeof service.price === 'number' || !isNaN(service.price) ? `€${service.price}` : service.price}
                      </span>
                      <span style={styles.servicePriceNote}>{service.priceNote}</span>
                    </div>
                    <button type="button" style={{ ...styles.serviceButton, background: service.color, color: '#fff' }}>
                      {service.cta}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Courses */}
        <section style={{ ...styles.section, background: 'rgba(255, 255, 255, 0.01)' }}>
          <div style={styles.container}>
            <div style={styles.sectionHeader}>
              <h2 style={styles.sectionTitle}>Cursos Online</h2>
              <p style={styles.sectionSubtitle}>Aprenda no seu ritmo com nossos cursos gravados</p>
            </div>

            <div style={styles.coursesGrid}>
              {COURSES.map(course => (
                <div key={course.id} style={styles.courseCard}>
                  {course.badge && (
                    <span style={{ ...styles.courseBadge, background: `${course.color}15`, color: course.color }}>
                      {course.badge}
                    </span>
                  )}
                  <h3 style={styles.courseTitle}>{course.title}</h3>
                  <p style={styles.courseDescription}>{course.description}</p>
                  <div style={styles.courseMeta}>
                    <span style={styles.courseMetaItem}>
                      <span style={styles.courseMetaIcon}>{icons.document}</span>
                      {course.modules} modulos
                    </span>
                    <span style={styles.courseMetaItem}>
                      <span style={styles.courseMetaIcon}>{icons.clock}</span>
                      {course.duration}
                    </span>
                    <span style={styles.courseMetaItem}>
                      <span style={styles.courseMetaIcon}>{icons.star}</span>
                      {course.rating}
                    </span>
                  </div>
                  <div style={styles.courseFooter}>
                    <span style={styles.coursePrice}>€{course.price}</span>
                    <button type="button" style={styles.courseButton}>Ver Curso</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Mentors */}
        <section style={styles.section}>
          <div style={styles.container}>
            <div style={styles.sectionHeader}>
              <h2 style={styles.sectionTitle}>Nossos Mentores</h2>
              <p style={styles.sectionSubtitle}>Conecte-se com profissionais experientes de Sao Tome e Principe</p>
            </div>

            <div style={styles.mentorsGrid}>
              {MENTORS.map(mentor => (
                <div key={mentor.id} style={styles.mentorCard}>
                  <div style={styles.mentorAvatar}>{mentor.name[0]}</div>
                  <h3 style={styles.mentorName}>{mentor.name}</h3>
                  <p style={styles.mentorRole}>{mentor.role}</p>
                  <p style={styles.mentorCompany}>{mentor.company}</p>
                  <div style={styles.mentorStats}>
                    <div style={styles.mentorStat}>
                      <span style={styles.mentorStatValue}>{mentor.experience}</span>
                      <span style={styles.mentorStatLabel}>Experiencia</span>
                    </div>
                    <div style={styles.mentorStat}>
                      <span style={styles.mentorStatValue}>{mentor.sessions}</span>
                      <span style={styles.mentorStatLabel}>Sessoes</span>
                    </div>
                    <div style={styles.mentorStat}>
                      <span style={styles.mentorStatValue}>{mentor.rating}</span>
                      <span style={styles.mentorStatLabel}>Rating</span>
                    </div>
                  </div>
                  <span style={{
                    ...styles.mentorStatus,
                    ...(mentor.available ? styles.statusAvailable : styles.statusUnavailable)
                  }}>
                    {mentor.available ? 'Disponivel' : 'Indisponivel'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Testimonials */}
        <section style={{ ...styles.section, paddingBottom: '2rem' }}>
          <div style={styles.container}>
            <div style={styles.testimonials}>
              <div style={{ ...styles.sectionHeader, marginBottom: '2rem' }}>
                <h2 style={styles.sectionTitle}>O que dizem nossos clientes</h2>
              </div>
              <div style={styles.testimonialsGrid}>
                {TESTIMONIALS.map(t => (
                  <div key={t.id} style={styles.testimonialCard}>
                    <p style={styles.testimonialText}>&quot;{t.text}&quot;</p>
                    <div style={styles.testimonialAuthor}>
                      <div style={styles.testimonialAvatar}>{t.name[0]}</div>
                      <div>
                        <p style={styles.testimonialName}>{t.name}</p>
                        <p style={styles.testimonialRole}>{t.role}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* CTA */}
        <section style={styles.section}>
          <div style={styles.container}>
            <div style={styles.cta}>
              <h2 style={styles.ctaTitle}>Pronto para dar o proximo passo?</h2>
              <p style={styles.ctaText}>
                Agende uma consulta gratuita de 15 minutos para descobrir qual servico
                e o ideal para o seu momento profissional.
              </p>
              <div style={styles.ctaButtons}>
                <button type="button" style={styles.ctaButtonPrimary}>
                  Agendar Consulta Gratuita
                  <span style={{ width: '18px', height: '18px' }}>{icons.calendar}</span>
                </button>
                <Link href="/recursos" style={styles.ctaButtonSecondary}>
                  Ver Recursos Gratuitos
                  <span style={{ width: '18px', height: '18px' }}>{icons.arrow}</span>
                </Link>
              </div>
            </div>
          </div>
        </section>

        <Footer />
      </div>

      <style jsx>{`
        @media (max-width: 1024px) {
          .services-grid { grid-template-columns: repeat(2, 1fr) !important; }
          .courses-grid { grid-template-columns: repeat(2, 1fr) !important; }
        }
        @media (max-width: 768px) {
          .services-grid { grid-template-columns: 1fr !important; }
          .courses-grid { grid-template-columns: 1fr !important; }
          .mentors-grid { grid-template-columns: 1fr !important; }
          .testimonials-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </>
  );
}
