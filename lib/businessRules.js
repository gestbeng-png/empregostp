/**
 * Sistema Unificado de Regras de Negocio - EmpregoSTP
 * 
 * Centraliza todas as regras de negocio da plataforma
 */

import { PLAN_FEATURES, getCandidatePlanFeatures, getPlanSummary } from './candidatePlanFeatures';
import { EMPRESA_PLAN_FEATURES, getEmpresaPlanFeatures, getEmpresaPlanSummary } from './empresaPlanFeatures';

// ==========================================
// CONFIGURACOES GERAIS DO SISTEMA
// ==========================================

export const SYSTEM_CONFIG = {
  // Moeda do sistema
  currency: 'Dobras',
  currencySymbol: 'STD',
  
  // Limites gerais
  maxFileSize: 5 * 1024 * 1024, // 5MB
  allowedFileTypes: ['pdf', 'doc', 'docx'],
  allowedImageTypes: ['jpg', 'jpeg', 'png', 'webp'],
  maxImageSize: 2 * 1024 * 1024, // 2MB
  
  // Duracao padrao de planos (em dias)
  defaultPlanDuration: 30,
  
  // Notificacoes
  notificationRetentionDays: 90, // Manter notificacoes por 90 dias
  
  // Vagas
  minJobDescriptionLength: 50,
  maxJobDescriptionLength: 5000,
  
  // Perfis
  minBioLength: 20,
  maxBioLength: 1000,
  
  // Mensagens
  maxMessageLength: 2000,
  
  // Contato do suporte
  supportEmail: 'empregoSTP@gmail.com',
  supportPhone: '+239 9XX XXXX',
};

// ==========================================
// STATUS DE CANDIDATURAS
// ==========================================

export const APPLICATION_STATUS = {
  pending: {
    id: 'pending',
    label: 'Pendente',
    color: '#f59e0b',
    description: 'Aguardando analise da empresa'
  },
  analysis: {
    id: 'analysis',
    label: 'Em Analise',
    color: '#3b82f6',
    description: 'Candidatura em analise pela empresa'
  },
  interview: {
    id: 'interview',
    label: 'Entrevista',
    color: '#8b5cf6',
    description: 'Candidato selecionado para entrevista'
  },
  approved: {
    id: 'approved',
    label: 'Aprovado',
    color: '#10b981',
    description: 'Candidato aprovado para a vaga'
  },
  rejected: {
    id: 'rejected',
    label: 'Rejeitado',
    color: '#ef4444',
    description: 'Candidatura nao selecionada'
  }
};

// ==========================================
// STATUS DE VAGAS
// ==========================================

export const JOB_STATUS = {
  draft: {
    id: 'draft',
    label: 'Rascunho',
    color: '#6b7280',
    description: 'Vaga ainda nao publicada'
  },
  pending_review: {
    id: 'pending_review',
    label: 'Em Revisao',
    color: '#f59e0b',
    description: 'Aguardando aprovacao do admin'
  },
  active: {
    id: 'active',
    label: 'Ativa',
    color: '#10b981',
    description: 'Vaga publicada e aceitando candidaturas'
  },
  paused: {
    id: 'paused',
    label: 'Pausada',
    color: '#6b7280',
    description: 'Vaga temporariamente pausada'
  },
  filled: {
    id: 'filled',
    label: 'Preenchida',
    color: '#3b82f6',
    description: 'Vaga preenchida com sucesso'
  },
  expired: {
    id: 'expired',
    label: 'Expirada',
    color: '#ef4444',
    description: 'Vaga expirou'
  },
  closed: {
    id: 'closed',
    label: 'Fechada',
    color: '#6b7280',
    description: 'Vaga encerrada'
  }
};

// ==========================================
// TIPOS DE USUARIO
// ==========================================

export const USER_TYPES = {
  candidato: {
    id: 'candidato',
    label: 'Candidato',
    description: 'Pessoa procurando emprego',
    defaultPlan: 'basic_candidato',
    dashboardPath: '/dashboard/candidato'
  },
  empresa: {
    id: 'empresa',
    label: 'Empresa',
    description: 'Empresa contratando',
    defaultPlan: 'basic_empresa',
    dashboardPath: '/dashboard/empresa'
  },
  admin: {
    id: 'admin',
    label: 'Administrador',
    description: 'Administrador do sistema',
    defaultPlan: null,
    dashboardPath: '/dashboard/admin'
  }
};

// ==========================================
// CATEGORIAS DE VAGAS
// ==========================================

export const JOB_CATEGORIES = [
  { id: 'tecnologia', label: 'Tecnologia', icon: 'laptop' },
  { id: 'saude', label: 'Saude', icon: 'heart' },
  { id: 'educacao', label: 'Educacao', icon: 'book' },
  { id: 'comercio', label: 'Comercio', icon: 'shop' },
  { id: 'turismo', label: 'Turismo', icon: 'plane' },
  { id: 'construcao', label: 'Construcao', icon: 'building' },
  { id: 'agricultura', label: 'Agricultura', icon: 'leaf' },
  { id: 'financas', label: 'Financas', icon: 'wallet' },
  { id: 'servicos', label: 'Servicos', icon: 'briefcase' },
  { id: 'industria', label: 'Industria', icon: 'factory' },
  { id: 'outros', label: 'Outros', icon: 'more' }
];

// ==========================================
// TIPOS DE CONTRATO
// ==========================================

export const CONTRACT_TYPES = [
  { id: 'tempo_inteiro', label: 'Tempo Inteiro' },
  { id: 'meio_periodo', label: 'Meio Periodo' },
  { id: 'temporario', label: 'Temporario' },
  { id: 'estagio', label: 'Estagio' },
  { id: 'freelancer', label: 'Freelancer' },
  { id: 'remoto', label: 'Remoto' }
];

// ==========================================
// NIVEIS DE EXPERIENCIA
// ==========================================

export const EXPERIENCE_LEVELS = [
  { id: 'junior', label: 'Junior (0-2 anos)', years: '0-2' },
  { id: 'pleno', label: 'Pleno (2-5 anos)', years: '2-5' },
  { id: 'senior', label: 'Senior (5+ anos)', years: '5+' },
  { id: 'gerente', label: 'Gerente/Lider', years: '5+' },
  { id: 'diretor', label: 'Diretor/Executivo', years: '10+' }
];

// ==========================================
// FUNCOES DE VALIDACAO
// ==========================================

/**
 * Valida email
 */
export function isValidEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Valida telefone de Sao Tome e Principe
 */
export function isValidPhone(phone) {
  // Formato: +239 9XX XXXX ou 9XX XXXX
  const phoneRegex = /^(\+239\s?)?9\d{2}\s?\d{4}$/;
  return phoneRegex.test(phone.replace(/\s/g, ''));
}

/**
 * Valida tamanho de arquivo
 */
export function isValidFileSize(size, maxSize = SYSTEM_CONFIG.maxFileSize) {
  return size <= maxSize;
}

/**
 * Valida tipo de arquivo
 */
export function isValidFileType(filename, allowedTypes = SYSTEM_CONFIG.allowedFileTypes) {
  const extension = filename.split('.').pop().toLowerCase();
  return allowedTypes.includes(extension);
}

/**
 * Valida descricao de vaga
 */
export function isValidJobDescription(description) {
  if (!description) return { valid: false, error: 'Descricao obrigatoria' };
  if (description.length < SYSTEM_CONFIG.minJobDescriptionLength) {
    return { valid: false, error: `Descricao deve ter no minimo ${SYSTEM_CONFIG.minJobDescriptionLength} caracteres` };
  }
  if (description.length > SYSTEM_CONFIG.maxJobDescriptionLength) {
    return { valid: false, error: `Descricao deve ter no maximo ${SYSTEM_CONFIG.maxJobDescriptionLength} caracteres` };
  }
  return { valid: true };
}

// ==========================================
// FUNCOES DE PLANOS
// ==========================================

/**
 * Obtem plano do usuario baseado no tipo
 */
export function getUserPlanFeatures(userData) {
  if (userData.userType === 'candidato') {
    return getCandidatePlanFeatures(userData.currentPlan || 'basic_candidato');
  }
  if (userData.userType === 'empresa') {
    return getEmpresaPlanFeatures(userData.currentPlan || 'basic_empresa');
  }
  return null;
}

/**
 * Obtem resumo do plano do usuario
 */
export function getUserPlanSummary(userData) {
  if (userData.userType === 'candidato') {
    return getPlanSummary(userData);
  }
  if (userData.userType === 'empresa') {
    return getEmpresaPlanSummary(userData);
  }
  return null;
}

/**
 * Verifica se o usuario pode fazer upgrade
 */
export function canUpgrade(currentPlanId, newPlanId, userType) {
  const upgradePaths = {
    candidato: {
      basic_candidato: ['professional_candidato', 'unlimited_candidato'],
      professional_candidato: ['unlimited_candidato'],
      unlimited_candidato: []
    },
    empresa: {
      basic_empresa: ['professional_empresa', 'unlimited_empresa'],
      professional_empresa: ['unlimited_empresa'],
      unlimited_empresa: []
    }
  };

  const paths = upgradePaths[userType];
  if (!paths) return false;

  const availableUpgrades = paths[currentPlanId] || [];
  return availableUpgrades.includes(newPlanId);
}

// ==========================================
// FUNCOES DE NOTIFICACAO
// ==========================================

/**
 * Tipos de notificacao
 */
export const NOTIFICATION_TYPES = {
  APPLICATION_RECEIVED: {
    id: 'APPLICATION_RECEIVED',
    title: 'Nova candidatura recebida',
    icon: '👤',
    forUserType: 'empresa'
  },
  APPLICATION_SENT: {
    id: 'APPLICATION_SENT',
    title: 'Candidatura enviada',
    icon: '✅',
    forUserType: 'candidato'
  },
  APPLICATION_STATUS_CHANGED: {
    id: 'APPLICATION_STATUS_CHANGED',
    title: 'Status da candidatura atualizado',
    icon: '📝',
    forUserType: 'candidato'
  },
  INTERVIEW_SCHEDULED: {
    id: 'INTERVIEW_SCHEDULED',
    title: 'Entrevista agendada',
    icon: '📅',
    forUserType: 'candidato'
  },
  JOB_APPROVED: {
    id: 'JOB_APPROVED',
    title: 'Vaga aprovada',
    icon: '✅',
    forUserType: 'empresa'
  },
  JOB_REJECTED: {
    id: 'JOB_REJECTED',
    title: 'Vaga rejeitada',
    icon: '❌',
    forUserType: 'empresa'
  },
  PLAN_ACTIVATED: {
    id: 'PLAN_ACTIVATED',
    title: 'Plano ativado',
    icon: '🎉',
    forUserType: 'all'
  },
  PLAN_EXPIRING: {
    id: 'PLAN_EXPIRING',
    title: 'Plano expirando',
    icon: '⚠️',
    forUserType: 'all'
  },
  PLAN_EXPIRED: {
    id: 'PLAN_EXPIRED',
    title: 'Plano expirado',
    icon: '📅',
    forUserType: 'all'
  },
  NEW_MESSAGE: {
    id: 'NEW_MESSAGE',
    title: 'Nova mensagem',
    icon: '💬',
    forUserType: 'all'
  },
  PROFILE_VIEWED: {
    id: 'PROFILE_VIEWED',
    title: 'Perfil visualizado',
    icon: '👁️',
    forUserType: 'candidato'
  },
  SUBSCRIPTION_REQUEST: {
    id: 'SUBSCRIPTION_REQUEST',
    title: 'Solicitacao de plano',
    icon: '💳',
    forUserType: 'admin'
  }
};

/**
 * Cria objeto de notificacao
 */
export function createNotificationObject(type, userId, message, relatedData = {}) {
  const notificationType = NOTIFICATION_TYPES[type];
  if (!notificationType) {
    throw new Error(`Tipo de notificacao invalido: ${type}`);
  }

  return {
    userId,
    type,
    title: notificationType.title,
    message,
    icon: notificationType.icon,
    read: false,
    createdAt: new Date(),
    ...relatedData
  };
}

// ==========================================
// FUNCOES DE CALCULO
// ==========================================

/**
 * Calcula dias restantes de um plano
 */
export function calculateDaysRemaining(planEndDate) {
  if (!planEndDate) return null;
  
  try {
    const endDate = planEndDate.toDate ? planEndDate.toDate() : new Date(planEndDate);
    const now = new Date();
    const diff = endDate.getTime() - now.getTime();
    return Math.ceil(diff / (1000 * 60 * 60 * 24));
  } catch (error) {
    return null;
  }
}

/**
 * Calcula porcentagem de perfil completo
 */
export function calculateProfileCompletion(profile, userType) {
  const requiredFields = {
    candidato: ['fullName', 'email', 'phone', 'bio', 'skills', 'experience', 'education', 'cvUrl'],
    empresa: ['companyName', 'email', 'phone', 'description', 'industry', 'website', 'address', 'logo']
  };

  const fields = requiredFields[userType] || [];
  if (fields.length === 0) return 100;

  let filledCount = 0;
  fields.forEach(field => {
    const value = profile[field];
    if (value && (Array.isArray(value) ? value.length > 0 : value.toString().trim() !== '')) {
      filledCount++;
    }
  });

  return Math.round((filledCount / fields.length) * 100);
}

/**
 * Formata preco em Dobras
 */
export function formatPrice(price) {
  if (price === 0) return 'Gratis';
  return `${price} ${SYSTEM_CONFIG.currency}`;
}

/**
 * Formata data para exibicao
 */
export function formatDate(date, format = 'short') {
  if (!date) return '';
  
  const dateObj = date.toDate ? date.toDate() : new Date(date);
  
  const options = {
    short: { day: '2-digit', month: '2-digit', year: 'numeric' },
    long: { day: 'numeric', month: 'long', year: 'numeric' },
    full: { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }
  };

  return dateObj.toLocaleDateString('pt-PT', options[format] || options.short);
}

// ==========================================
// EXPORTACAO UNIFICADA
// ==========================================

export {
  PLAN_FEATURES,
  EMPRESA_PLAN_FEATURES,
  getCandidatePlanFeatures,
  getEmpresaPlanFeatures,
  getPlanSummary,
  getEmpresaPlanSummary
};
