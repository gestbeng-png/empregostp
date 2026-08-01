import { admin } from '../../../../lib/firebaseAdmin';
import { logServerError } from '../../../../lib/serverLog';

export default async function handler(req, res) {
  const { id } = req.query;

  try {
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

    const planRef = admin.firestore().collection('plans').doc(id);
    const planDoc = await planRef.get();

    if (req.method === 'GET') {
      if (!planDoc.exists) {
        return res.status(404).json({ error: 'Plano não encontrado' });
      }
      const data = planDoc.data();
      return res.status(200).json({
        id: planDoc.id,
        ...data,
        createdAt: data.createdAt ? data.createdAt.toMillis() : null,
        updatedAt: data.updatedAt ? data.updatedAt.toMillis() : null
      });
    }

    if (req.method === 'PUT') {
      const {
        name,
        price,
        priceLabel,
        duration,
        type,
        vagasLimit,
        destaque,
        curriculoDestacado,
        features,
        isActive
      } = req.body || {};

      if (!name || typeof price !== 'number' || !priceLabel || typeof duration !== 'number' || !type) {
        return res.status(400).json({ error: 'Dados do plano inválidos' });
      }
      if (!['empresa', 'candidato'].includes(type)) {
        return res.status(400).json({ error: 'Tipo de plano inválido' });
      }

      const updateData = {
        name,
        price,
        priceLabel,
        duration,
        type,
        isActive: Boolean(isActive),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      };

      if (type === 'empresa') {
        updateData.vagasLimit = vagasLimit === null || vagasLimit === undefined ? null : Number(vagasLimit);
        updateData.destaque = Boolean(destaque);
        delete updateData.curriculoDestacado;
      } else if (type === 'candidato') {
        updateData.curriculoDestacado = Boolean(curriculoDestacado);
        delete updateData.vagasLimit;
        delete updateData.destaque;
      }

      if (Array.isArray(features)) {
        updateData.features = features;
      }

      // Upsert: editar um plano canónico ainda sem documento no Firestore
      // (ex.: um dos 3 planos fixos de candidato) cria-o no id correto.
      if (!planDoc.exists) {
        updateData.createdAt = admin.firestore.FieldValue.serverTimestamp();
      }
      await planRef.set(updateData, { merge: true });
      const updated = await planRef.get();
      const d = updated.data();

      await admin.firestore().collection('activities').add({
        type: 'plan_updated',
        description: `Plano "${d.name || updated.id}" foi atualizado por um administrador`,
        planId: updated.id,
        adminId: decodedToken.uid,
        createdAt: new Date().toISOString()
      });

      return res.status(200).json({
        id: updated.id,
        ...d,
        createdAt: d.createdAt ? d.createdAt.toMillis() : null,
        updatedAt: d.updatedAt ? d.updatedAt.toMillis() : null
      });
    }

    if (req.method === 'DELETE') {
      if (!planDoc.exists) {
        return res.status(404).json({ error: 'Plano não encontrado' });
      }
      const planName = planDoc.data()?.name || id;
      await planRef.delete();

      await admin.firestore().collection('activities').add({
        type: 'plan_deleted',
        description: `Plano "${planName}" foi excluído por um administrador`,
        planId: id,
        adminId: decodedToken.uid,
        createdAt: new Date().toISOString()
      });

      return res.status(200).json({ message: 'Plano excluído com sucesso', id });
    }

    res.setHeader('Allow', ['GET', 'PUT', 'DELETE']);
    return res.status(405).json({ error: 'Método não permitido' });
  } catch (error) {
    logServerError('admin_plans_id.gerenciar_plano_failed', error);
    return res.status(500).json({ error: 'Erro interno do servidor' });
  }
}




