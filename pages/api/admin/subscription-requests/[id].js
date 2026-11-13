import { admin } from '../../../../lib/firebaseAdmin';
import { createServerNotification } from '../../../../lib/serverNotifications';
import { logServerError } from '../../../../lib/serverLog';
import { approveSubscriptionRequest } from '../../../../lib/subscriptionActivation';

function assertRequestCanBeProcessed(request, action) {
  const allowedStatuses =
    action === 'approve'
      ? ['pending', 'payment_submitted']
      : ['pending', 'payment_submitted'];
  if (!allowedStatuses.includes(request?.status)) {
    const error = new Error('Pedido já foi processado');
    error.code = 'REQUEST_ALREADY_PROCESSED';
    throw error;
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: 'Método não permitido' });
  }

  try {
    // Verificar se é admin
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Token não fornecido' });
    }

    const token = authHeader.split(' ')[1];
    const decodedToken = await admin.auth().verifyIdToken(token);

    // Verificar se o usuário é admin
    const adminDoc = await admin
      .firestore()
      .collection('users')
      .doc(decodedToken.uid)
      .get();
    if (!adminDoc.exists || adminDoc.data().userType !== 'admin') {
      return res.status(403).json({ error: 'Acesso não autorizado' });
    }

    const { id } = req.query;
    const { action } = req.body; // 'approve' ou 'reject'

    if (!['approve', 'reject'].includes(action)) {
      return res.status(400).json({ error: 'Ação inválida' });
    }

    // Buscar o pedido
    const requestDoc = await admin
      .firestore()
      .collection('subscription-requests')
      .doc(id)
      .get();
    if (!requestDoc.exists) {
      return res.status(404).json({ error: 'Pedido não encontrado' });
    }

    const request = requestDoc.data();
    if (request.status !== 'pending') {
      if (
        !(action === 'approve' && request.status === 'payment_submitted') &&
        !(action === 'reject' && request.status === 'payment_submitted')
      ) {
        return res.status(400).json({ error: 'Pedido já foi processado' });
      }
    }

    const now = admin.firestore.Timestamp.now();

    if (action === 'approve') {
      if (Number(request.price || 0) > 0 && !request.paymentProof?.url) {
        return res.status(400).json({
          error:
            'A aprovação exige um comprovativo de pagamento enviado pelo utilizador.',
        });
      }

      await approveSubscriptionRequest({
        requestId: id,
        processedBy: decodedToken.uid,
      });
    } else {
      // Rejeitar pedido
      await admin.firestore().runTransaction(async (transaction) => {
        const freshRequestDoc = await transaction.get(requestDoc.ref);
        if (!freshRequestDoc.exists) {
          const error = new Error('Pedido não encontrado');
          error.code = 'REQUEST_NOT_FOUND';
          throw error;
        }
        assertRequestCanBeProcessed(freshRequestDoc.data(), 'reject');

        // Atualizar status do pedido
        transaction.update(requestDoc.ref, {
          status: 'rejected',
          paymentStatus:
            Number(request.price || 0) > 0
              ? 'rejected'
              : request.paymentStatus || 'not_required',
          processedAt: now,
          processedBy: decodedToken.uid,
          rejectedDate: now,
        });
      });

      await admin
        .firestore()
        .collection('activities')
        .add({
          type: 'subscription_rejected',
          description: `Assinatura "${request.planName || request.planId}" foi rejeitada para o utilizador ${request.userId}`,
          userId: request.userId,
          requestId: id,
          planId: request.planId || null,
          adminId: decodedToken.uid,
          createdAt: new Date().toISOString(),
        });

      // Criar notificação para o candidato informando que o plano foi rejeitado
      await createServerNotification(admin, {
        userId: request.userId,
        type: 'SUBSCRIPTION_REJECTED',
        title: 'Solicitação de Plano Rejeitada',
        message: `Sua solicitação do plano ${request.planName} foi rejeitada. Entre em contato conosco para mais informações.`,
        icon: '❌',
        relatedId: id,
        relatedType: 'subscription',
        actionUrl:
          request.planType === 'empresa'
            ? '/premium/empresa'
            : '/premium/candidatos',
      });
    }

    return res.status(200).json({
      message:
        action === 'approve'
          ? 'Assinatura aprovada com sucesso'
          : 'Assinatura rejeitada',
      requestId: id,
      status: action === 'approve' ? 'approved' : 'rejected',
    });
  } catch (error) {
    if (error?.code === 'REQUEST_ALREADY_PROCESSED') {
      return res.status(409).json({ error: error.message });
    }
    if (error?.code === 'REQUEST_NOT_FOUND') {
      return res.status(404).json({ error: error.message });
    }
    logServerError(
      'admin_subscription_requests_id.processar_pedido_failed',
      error,
    );
    return res.status(500).json({
      error: 'Erro ao processar pedido',
      message: 'Erro ao processar pedido',
    });
  }
}
