import { admin } from '../../lib/firebaseAdmin';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido' });
  }

  try {
    const { jobId, userId, source } = req.body;

    if (!jobId) {
      return res.status(400).json({ error: 'jobId é obrigatório' });
    }

    console.log('📊 Registrando visualização:', { jobId, userId, source });

    // Buscar vaga
    const jobRef = admin.firestore().collection('jobs').doc(jobId);
    const jobDoc = await jobRef.get();

    if (!jobDoc.exists) {
      return res.status(404).json({ error: 'Vaga não encontrada' });
    }

    // Incrementar contador de views
    await jobRef.update({
      views: admin.firestore.FieldValue.increment(1),
      lastViewedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    // Registrar visualização detalhada (para analytics)
    await admin.firestore().collection('jobViews').add({
      jobId,
      userId: userId || null,
      source: source || 'web',
      userAgent: req.headers['user-agent'] || null,
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
      ip: req.headers['x-forwarded-for'] || req.connection.remoteAddress || null
    });

    console.log('✅ Visualização registrada');

    return res.status(200).json({ 
      message: 'Visualização registrada com sucesso' 
    });

  } catch (error) {
    console.error('Erro ao registrar visualização:', error);
    return res.status(500).json({ error: 'Erro interno do servidor' });
  }
}



