import admin from '../../lib/firebaseAdmin';
import { logServerError } from '../../lib/serverLog';

const STRING_PROFILE_FIELDS = [
  'phone',
  'description',
  'companySize',
  'website',
  'location',
  'logoUrl',
  'coverImageUrl',
];

const SOCIAL_PROFILE_FIELDS = ['linkedin', 'facebook', 'instagram'];

const hasOwn = (value, key) =>
  Object.prototype.hasOwnProperty.call(value, key);

function normalizeString(value) {
  return typeof value === 'string' ? value.trim() : null;
}

/**
 * Build the only fields a company is allowed to change through its profile.
 * Account role, plan, verification and billing fields must remain exclusively
 * server/admin controlled.
 */
export function buildCompanyProfileUpdate(body = {}) {
  const source = body && typeof body === 'object' ? body : {};
  const update = {};

  if (hasOwn(source, 'name') || hasOwn(source, 'fullName')) {
    const normalizedName = normalizeString(
      hasOwn(source, 'name') ? source.name : source.fullName,
    );
    if (normalizedName) {
      update.name = normalizedName;
      update.fullName = normalizedName;
      update.companyName = normalizedName;
    }
  }

  STRING_PROFILE_FIELDS.forEach((field) => {
    if (!hasOwn(source, field)) return;
    const normalizedValue = normalizeString(source[field]);
    if (normalizedValue !== null) update[field] = normalizedValue;
  });

  if (hasOwn(source, 'industrySectors') && Array.isArray(source.industrySectors)) {
    update.industrySectors = [
      ...new Set(
        source.industrySectors
          .filter((sector) => typeof sector === 'string')
          .map((sector) => sector.trim())
          .filter(Boolean),
      ),
    ];
  }

  const nestedSocial =
    source.socialMedia &&
    typeof source.socialMedia === 'object' &&
    !Array.isArray(source.socialMedia)
      ? source.socialMedia
      : {};

  SOCIAL_PROFILE_FIELDS.forEach((field) => {
    const hasTopLevelValue = hasOwn(source, field);
    const hasNestedValue = hasOwn(nestedSocial, field);
    if (!hasTopLevelValue && !hasNestedValue) return;

    const normalizedValue = normalizeString(
      hasTopLevelValue ? source[field] : nestedSocial[field],
    );
    if (normalizedValue === null) return;

    update[field] = normalizedValue;
    update[`socialMedia.${field}`] = normalizedValue;
  });

  return update;
}

export default async function handler(req, res) {
  const { method } = req;

  // First, verify the user's token
  const { authorization } = req.headers;
  if (!authorization || !authorization.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Authorization token missing or invalid.' });
  }

  const token = authorization.split('Bearer ')[1];
  let decodedToken;
  try {
    decodedToken = await admin.auth().verifyIdToken(token);
  } catch (error) {
    return res.status(401).json({ message: 'Invalid token.' });
  }

  const { uid } = decodedToken;
  const db = admin.firestore();
  const userDocRef = db.collection('users').doc(uid);
  const userDoc = await userDocRef.get();

  if (!userDoc.exists || userDoc.data().userType !== 'empresa') {
    return res.status(403).json({ message: 'Acesso permitido apenas para empresas.' });
  }

  const companyDocRef = userDocRef;

  switch (method) {
    case 'GET':
      try {
        const doc = await companyDocRef.get();
        if (!doc.exists) {
          return res.status(404).json({ message: 'Company not found.' });
        }
        res.status(200).json({ profile: doc.data() });
      } catch (error) {
        logServerError('empresa.perfil_leitura_failed', error);
        res.status(500).json({ message: 'Error fetching company data.' });
      }
      break;

    case 'PUT':
      try {
        const updateData = buildCompanyProfileUpdate(req.body);
        if (Object.keys(updateData).length === 0) {
          return res.status(400).json({
            message: 'Nenhum campo de perfil válido foi fornecido.',
          });
        }

        await companyDocRef.update({
          ...updateData,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        res.status(200).json({ message: 'Profile updated successfully.' });
      } catch (error) {
        logServerError('empresa.perfil_atualizacao_failed', error);
        res.status(500).json({ message: 'Error updating company data.' });
      }
      break;

    default:
      res.setHeader('Allow', ['GET', 'PUT']);
      res.status(405).json({ message: 'Método não permitido' });
  }
}
