import { admin } from '../../../lib/firebaseAdmin';
import { logServerError } from '../../../lib/serverLog';

const COLLECTION = 'affiliateApplications';

// Limites de validação dos campos do formulário de afiliado
const LIMITS = {
  fullName: { min: 2, max: 80 },
  email: { max: 120 },
  phone: { min: 5, max: 30 },
  location: { max: 80 },
  occupation: { max: 100 },
  channels: { max: 400 },
  motivation: { min: 10, max: 900 },
};

// Estados que impedem uma nova submissão (já existe pedido em curso)
const BLOCKING_STATUSES = ['pending', 'approved', 'contacted'];

function sanitize(value) {
  if (typeof value !== 'string') return '';
  return value
    .replace(/<[^>]*>/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function toIso(value) {
  if (!value) return null;
  if (typeof value?.toDate === 'function') return value.toDate().toISOString();
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'string') return value;
  return null;
}

function serialize(doc) {
  const data = doc.data() || {};
  return {
    id: doc.id,
    fullName: data.fullName || '',
    email: data.email || '',
    phone: data.phone || '',
    location: data.location || '',
    occupation: data.occupation || '',
    channels: data.channels || '',
    motivation: data.motivation || '',
    role: data.role || 'candidato',
    status: data.status || 'pending',
    createdAt: toIso(data.createdAt),
    updatedAt: toIso(data.updatedAt),
  };
}

export default async function handler(req, res) {
  try {
    const token = req.headers.authorization?.split('Bearer ')[1];
    if (!token) {
      return res.status(401).json({ error: 'Token não fornecido' });
    }

    let decodedToken;
    try {
      decodedToken = await admin.auth().verifyIdToken(token);
    } catch (err) {
      return res.status(401).json({ error: 'Token inválido ou expirado' });
    }

    const uid = decodedToken.uid;
    const docRef = admin.firestore().collection(COLLECTION).doc(uid);

    if (req.method === 'GET') {
      const snap = await docRef.get();
      return res
        .status(200)
        .json({ application: snap.exists ? serialize(snap) : null });
    }

    if (req.method === 'POST') {
      // Papel do utilizador (candidato/empresa) obtido do próprio registo
      const userSnap = await admin.firestore().collection('users').doc(uid).get();
      const userType = userSnap.exists ? userSnap.data().userType : null;
      const role = userType === 'empresa' ? 'empresa' : 'candidato';

      const fullName = sanitize(req.body?.fullName);
      const email = sanitize(req.body?.email).toLowerCase();
      const phone = sanitize(req.body?.phone);
      const location = sanitize(req.body?.location);
      const occupation = sanitize(req.body?.occupation);
      const channels = sanitize(req.body?.channels);
      const motivation = sanitize(req.body?.motivation);

      if (fullName.length < LIMITS.fullName.min || fullName.length > LIMITS.fullName.max) {
        return res.status(400).json({
          error: `O nome deve ter entre ${LIMITS.fullName.min} e ${LIMITS.fullName.max} caracteres.`,
        });
      }
      if (!email || !isValidEmail(email) || email.length > LIMITS.email.max) {
        return res.status(400).json({ error: 'Indique um email válido.' });
      }
      if (phone.length < LIMITS.phone.min || phone.length > LIMITS.phone.max) {
        return res.status(400).json({ error: 'Indique um telefone/WhatsApp válido.' });
      }
      if (location.length > LIMITS.location.max) {
        return res.status(400).json({ error: 'A localização é demasiado longa.' });
      }
      if (occupation.length > LIMITS.occupation.max) {
        return res.status(400).json({ error: 'O campo de atividade é demasiado longo.' });
      }
      if (channels.length > LIMITS.channels.max) {
        return res.status(400).json({ error: 'A descrição dos canais é demasiado longa.' });
      }
      if (motivation.length < LIMITS.motivation.min || motivation.length > LIMITS.motivation.max) {
        return res.status(400).json({
          error: `A motivação deve ter entre ${LIMITS.motivation.min} e ${LIMITS.motivation.max} caracteres.`,
        });
      }

      const existing = await docRef.get();
      if (existing.exists && BLOCKING_STATUSES.includes(existing.data().status)) {
        return res.status(409).json({
          error: 'Já existe uma candidatura de afiliado registada.',
          application: serialize(existing),
        });
      }

      const now = admin.firestore.FieldValue.serverTimestamp();
      const payload = {
        uid,
        role,
        userType: userType || role,
        accountEmail: decodedToken.email || '',
        fullName,
        email,
        phone,
        location: location || null,
        occupation: occupation || null,
        channels: channels || null,
        motivation,
        status: 'pending',
        updatedAt: now,
      };

      if (existing.exists) {
        // Reenvio após rejeição: preserva a data de criação original
        await docRef.set(payload, { merge: true });
      } else {
        await docRef.set({ ...payload, createdAt: now });
      }

      const saved = await docRef.get();
      return res.status(201).json({
        message: 'Candidatura de afiliado enviada com sucesso. A nossa equipa entrará em contacto.',
        application: serialize(saved),
      });
    }

    res.setHeader('Allow', 'GET, POST');
    return res.status(405).json({ error: 'Método não permitido' });
  } catch (error) {
    logServerError('affiliate_apply.api_de_afiliados_failed', error);
    return res.status(500).json({ error: 'Erro interno do servidor' });
  }
}
