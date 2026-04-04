import { admin } from '../../../../lib/firebaseAdmin';
import { DEFAULT_EMPRESA_PLANS, DEFAULT_CANDIDATO_PLANS } from '../../../../lib/defaultPlans';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Token não fornecido' });
    }

    const token = authHeader.split('Bearer ')[1];
    const decodedToken = await admin.auth().verifyIdToken(token);
    const userDoc = await admin.firestore().collection('users').doc(decodedToken.uid).get();
    if (!userDoc.exists || userDoc.data().userType !== 'admin') {
      return res.status(403).json({ error: 'Acesso não autorizado' });
    }

    const plansCollection = admin.firestore().collection('plans');
    const defaultPlans = [...DEFAULT_EMPRESA_PLANS, ...DEFAULT_CANDIDATO_PLANS];

    // Criar ou atualizar cada plano
    for (const plan of defaultPlans) {
      await plansCollection.doc(plan.id).set(plan, { merge: true });
    }

    return res.status(200).json({ message: 'Planos configurados com sucesso' });
  } catch (error) {
    console.error('Erro ao configurar planos:', error);
    return res.status(500).json({ error: 'Erro ao configurar planos' });
  }
} 
