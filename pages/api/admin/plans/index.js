import { admin } from '../../../../lib/firebaseAdmin';

export default async function handler(req, res) {
  try {
    // Verificar token
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Token não fornecido' });
    }

    const token = authHeader.split('Bearer ')[1];
    const decodedToken = await admin.auth().verifyIdToken(token);
    
    // Verificar se é admin
    const userDoc = await admin.firestore().collection('users').doc(decodedToken.uid).get();
    if (!userDoc.exists || userDoc.data().userType !== 'admin') {
      return res.status(403).json({ error: 'Acesso não autorizado' });
    }

    if (req.method === 'GET') {
      const plansSnapshot = await admin.firestore().collection('plans').get();
      const plans = plansSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt ? doc.data().createdAt.toMillis() : null,
        updatedAt: doc.data().updatedAt ? doc.data().updatedAt.toMillis() : null
      }));
      
      return res.status(200).json({ plans });
    }

    if (req.method === 'POST') {
      const planData = {
        ...req.body,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      };

      const docRef = await admin.firestore().collection('plans').add(planData);
      const newPlan = await docRef.get();
      const newPlanData = newPlan.data() || {};

      await admin.firestore().collection('activities').add({
        type: 'plan_created',
        description: `Plano "${newPlanData.name || docRef.id}" foi criado por um administrador`,
        planId: docRef.id,
        adminId: decodedToken.uid,
        createdAt: new Date().toISOString()
      });
      
      const responseData = {
        id: newPlan.id,
        ...newPlanData,
        createdAt: newPlanData.createdAt ? newPlanData.createdAt.toMillis() : null,
        updatedAt: newPlanData.updatedAt ? newPlanData.updatedAt.toMillis() : null
      };

      return res.status(201).json({ plan: responseData });
    }

    return res.status(405).json({ error: 'Método não permitido' });
  } catch (error) {
    console.error('Erro ao processar requisição:', error);
    return res.status(500).json({ error: 'Erro interno do servidor' });
  }
} 
