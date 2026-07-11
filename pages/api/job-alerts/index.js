import { admin } from '../../../lib/firebaseAdmin';
import { checkRateLimit } from '../../../lib/rateLimit';

// Guarda subscrições de alertas de vagas. O envio periódico dos emails é
// feito por um processo agendado à parte (ainda não configurado): esta rota
// apenas regista a intenção do utilizador e os filtros escolhidos.

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function clientIp(req) {
  return (
    req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
    req.headers['x-real-ip'] ||
    req.socket?.remoteAddress ||
    'unknown'
  );
}

function sanitize(value, max = 120) {
  if (typeof value !== 'string') return '';
  return value
    .replace(/<[^>]*>/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Método não permitido' });
  }

  // Rate limit: no máximo 3 subscrições por minuto por IP
  if (!checkRateLimit(clientIp(req), 3)) {
    return res.status(429).json({
      error: 'Demasiados pedidos. Tente novamente dentro de um minuto.',
    });
  }

  try {
    const email = sanitize(req.body?.email, 160).toLowerCase();
    if (!EMAIL_RE.test(email)) {
      return res.status(400).json({ error: 'Introduza um email válido.' });
    }

    const rawFilters = req.body?.filters || {};
    const filters = {
      search: sanitize(rawFilters.search, 120),
      localizacao: sanitize(rawFilters.localizacao),
      tipoContrato: sanitize(rawFilters.tipoContrato),
      categoria: sanitize(rawFilters.categoria),
      modalidade: sanitize(rawFilters.modalidade),
      experiencia: sanitize(rawFilters.experiencia),
      minSalary: Number.isFinite(Number(rawFilters.minSalary))
        ? Math.max(0, Math.round(Number(rawFilters.minSalary)))
        : 0,
    };

    await admin.firestore().collection('jobAlerts').add({
      email,
      filters,
      active: true,
      status: 'pending',
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      userAgent: req.headers['user-agent'] || null,
      ip: clientIp(req),
    });

    return res.status(201).json({
      message:
        'Alerta ativado! Vamos avisar-te por email assim que surgir uma vaga com estes filtros.',
    });
  } catch (error) {
    console.error('Erro ao registar alerta de vagas:', error);
    return res.status(500).json({ error: 'Não foi possível ativar o alerta.' });
  }
}
