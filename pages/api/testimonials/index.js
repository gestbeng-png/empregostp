import { admin } from '../../../lib/firebaseAdmin';
import { enforceApiRateLimit, getClientIp } from '../../../lib/apiRateLimit';
import { logServerError } from '../../../lib/serverLog';

const MAX_PUBLIC = 60;

// Limites de validação
const LIMITS = {
  name: { min: 2, max: 60 },
  role: { max: 80 },
  message: { min: 12, max: 600 },
};

// Remove tags HTML e espaços supérfluos
function sanitize(value) {
  if (typeof value !== 'string') return '';
  return value
    .replace(/<[^>]*>/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function toIso(value) {
  if (!value) return null;
  if (typeof value?.toDate === 'function') return value.toDate().toISOString();
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'string') return value;
  return null;
}

export default async function handler(req, res) {
  if (req.method === 'GET') {
    try {
      const snapshot = await admin
        .firestore()
        .collection('testimonials')
        .where('status', '==', 'approved')
        .limit(MAX_PUBLIC)
        .get();

      const testimonials = snapshot.docs
        .map((doc) => {
          const data = doc.data();
          return {
            id: doc.id,
            name: data.name || '',
            role: data.role || '',
            message: data.message || '',
            rating: data.rating || null,
            createdAt: toIso(data.approvedAt) || toIso(data.createdAt),
          };
        })
        // Ordena em memória para evitar índice composto (status + createdAt)
        .sort((a, b) =>
          String(b.createdAt || '').localeCompare(String(a.createdAt || '')),
        );

      return res.status(200).json({ testimonials });
    } catch (error) {
      logServerError('testimonials.buscar_testemunhos_failed', error);
      return res.status(500).json({ error: 'Erro ao carregar testemunhos' });
    }
  }

  if (req.method === 'POST') {
    // Rate limit: no máximo 3 submissões por minuto por IP
    if (
      !(await enforceApiRateLimit(req, res, {
        scope: 'testimonials',
        limit: 3,
        message: 'Demasiadas submissões. Tente novamente dentro de um minuto.',
      }))
    ) {
      return;
    }

    try {
      const name = sanitize(req.body?.name);
      const role = sanitize(req.body?.role);
      const message = sanitize(req.body?.message);
      const ratingRaw = Number(req.body?.rating);
      const rating =
        Number.isInteger(ratingRaw) && ratingRaw >= 1 && ratingRaw <= 5
          ? ratingRaw
          : null;

      if (name.length < LIMITS.name.min || name.length > LIMITS.name.max) {
        return res
          .status(400)
          .json({
            error: `O nome deve ter entre ${LIMITS.name.min} e ${LIMITS.name.max} caracteres.`,
          });
      }
      if (role.length > LIMITS.role.max) {
        return res
          .status(400)
          .json({
            error: `O cargo/função é demasiado longo (máx. ${LIMITS.role.max} caracteres).`,
          });
      }
      if (
        message.length < LIMITS.message.min ||
        message.length > LIMITS.message.max
      ) {
        return res.status(400).json({
          error: `O testemunho deve ter entre ${LIMITS.message.min} e ${LIMITS.message.max} caracteres.`,
        });
      }

      await admin
        .firestore()
        .collection('testimonials')
        .add({
          name,
          role: role || null,
          message,
          rating,
          status: 'pending',
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          userAgent: req.headers['user-agent'] || null,
          ip: getClientIp(req),
        });

      return res.status(201).json({
        message:
          'Obrigado! O seu testemunho foi enviado e será publicado após revisão.',
      });
    } catch (error) {
      logServerError('testimonials.registar_testemunho_failed', error);
      return res.status(500).json({ error: 'Erro ao enviar o testemunho.' });
    }
  }

  res.setHeader('Allow', ['GET', 'POST']);
  return res.status(405).json({ error: 'Método não permitido' });
}
