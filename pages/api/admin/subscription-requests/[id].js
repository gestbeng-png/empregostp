import { admin } from '../../../../lib/firebaseAdmin';
import { normalizeCandidatePlanId } from '../../../../lib/candidatePlanFeatures';
import { normalizeEmpresaPlanId } from '../../../../lib/empresaPlanFeatures';
import { normalizeUserType } from '../../../../lib/defaultPlans';
import { createServerNotification } from '../../../../lib/serverNotifications';
import {
  buildPlanActivationVersion,
  buildPlanExpirationTaskId
} from '../../../../lib/subscriptionLifecycle';

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
    return res.status(405).json({ error: 'Method not allowed' });
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
    const adminDoc = await admin.firestore().collection('users').doc(decodedToken.uid).get();
    if (!adminDoc.exists || adminDoc.data().userType !== 'admin') {
      return res.status(403).json({ error: 'Acesso não autorizado' });
    }

    const { id } = req.query;
    const { action } = req.body; // 'approve' ou 'reject'

    if (!['approve', 'reject'].includes(action)) {
      return res.status(400).json({ error: 'Ação inválida' });
    }

    // Buscar o pedido
    const requestDoc = await admin.firestore().collection('subscription-requests').doc(id).get();
    if (!requestDoc.exists) {
      return res.status(404).json({ error: 'Pedido não encontrado' });
    }

    const request = requestDoc.data();
    if (request.status !== 'pending') {
      if (!(action === 'approve' && request.status === 'payment_submitted') && !(action === 'reject' && request.status === 'payment_submitted')) {
        return res.status(400).json({ error: 'Pedido já foi processado' });
      }
    }

    const now = admin.firestore.Timestamp.now();
    const activationVersion = buildPlanActivationVersion(id);

    if (action === 'approve') {
      if (Number(request.price || 0) > 0 && !request.paymentProof?.url) {
        return res.status(400).json({ error: 'A aprovação exige um comprovativo de pagamento enviado pelo utilizador.' });
      }

      // Variáveis que serão usadas fora da transação
      let finalPlanName = request.planName || request.planId;
      
      await admin.firestore().runTransaction(async (transaction) => {
        const freshRequestDoc = await transaction.get(requestDoc.ref);
        if (!freshRequestDoc.exists) {
          const error = new Error('Pedido não encontrado');
          error.code = 'REQUEST_NOT_FOUND';
          throw error;
        }
        assertRequestCanBeProcessed(freshRequestDoc.data(), 'approve');

        // Buscar dados do usuário para verificar o tipo
        const userRef = admin.firestore().collection('users').doc(request.userId);
        const userDoc = await transaction.get(userRef);
        
        if (!userDoc.exists) {
          throw new Error('Usuário não encontrado');
        }
        
        const userData = userDoc.data();
        const normalizedUserType = normalizeUserType(userData.userType) || userData.userType;
        
        // Buscar nome do plano - sempre buscar da coleção plans
        let planName = request.planName || request.planId;
        let planFeatures = request.features || [];
        let planCurriculoDestacado = request.curriculoDestacado;
        let planDuration = Number(request.duration);
        let planVagasLimit = request.vagasLimit;
        let planDestaque = request.destaque;
        
        // Tentar buscar plano da coleção plans (se existir)
        if (request.planId) {
          try {
            const planRef = admin.firestore().collection('plans').doc(request.planId);
            const planDoc = await transaction.get(planRef);
            if (planDoc.exists) {
              const planData = planDoc.data();
              planName = planData.name || planName;
              planFeatures = planData.features || planFeatures || [];
              planCurriculoDestacado = planData.curriculoDestacado !== undefined ? planData.curriculoDestacado : planCurriculoDestacado;
              // Usar duração do plano se disponível
              if (planData.duration !== undefined && planData.duration !== null) {
                planDuration = Number(planData.duration);
              }
              if (planVagasLimit === undefined && planData.vagasLimit !== undefined) {
                planVagasLimit = planData.vagasLimit;
              }
              if (planDestaque === undefined && planData.destaque !== undefined) {
                planDestaque = planData.destaque;
              }
            }
          } catch (planError) {
            console.warn('Erro ao buscar plano da coleção plans, usando dados da solicitação:', planError);
          }
        }
        
        // Se ainda não tem duração, usar padrão baseado no tipo de plano
        if (isNaN(planDuration) || planDuration === null || planDuration === undefined) {
          // Planos pagos geralmente têm 30 dias, mas vamos usar o que vem da solicitação ou 30 como padrão
          planDuration = 30; // Default 30 dias para planos pagos
        }
        
        // Atualizar variável final para uso fora da transação
        finalPlanName = planName;
        const resolvedCompanyPlanTier =
          normalizedUserType === 'empresa'
            ? normalizeEmpresaPlanId(request.planId, planName, {
                vagasLimit: planVagasLimit,
                destaque: planDestaque,
                ...request
              })
            : null;
        const resolvedCandidatePlanTier =
          normalizedUserType === 'candidato'
            ? normalizeCandidatePlanId(request.planTierId || request.planId, planName, {
                ...request,
                curriculoDestacado: planCurriculoDestacado
              })
            : null;
        
        // Calcular data de término usando duração resolvida
        // durationDays === 0 significa plano ilimitado (sem expiração)
        const durationDays = Number(planDuration);
        const endDate = durationDays === 0 || durationDays === null
          ? null // Plano ilimitado (sem expiração)
          : admin.firestore.Timestamp.fromMillis(now.toMillis() + (durationDays * 24 * 60 * 60 * 1000));
        
        console.log(`Aprovando plano ${request.planId} para usuário ${request.userId}:`, {
          planName,
          durationDays,
          endDate: endDate ? endDate.toDate().toISOString() : 'Ilimitado',
          planEndDate: endDate
        });
        
        // Atualizar assinatura do usuário com dados consolidados
        const subscriptionRef = admin.firestore().collection('subscriptions').doc(request.userId);
        const subscriptionData = {
          planId: request.planId,
          planTierId: normalizedUserType === 'empresa' ? resolvedCompanyPlanTier : resolvedCandidatePlanTier,
          userId: request.userId,
          startDate: now,
          endDate: endDate,
          status: 'active',
          planName: planName,
          activationVersion
        };
        
        // Adicionar apenas campos que existem e não são undefined
        if (planFeatures && Array.isArray(planFeatures) && planFeatures.length > 0) {
          subscriptionData.features = planFeatures;
        }
        if (planVagasLimit !== undefined && planVagasLimit !== null) {
          subscriptionData.vagasLimit = planVagasLimit;
        }
        if (planDestaque !== undefined) {
          subscriptionData.destaque = Boolean(planDestaque);
        }
        if (planCurriculoDestacado !== undefined) {
          subscriptionData.curriculoDestacado = Boolean(planCurriculoDestacado);
        }
        if (!isNaN(durationDays) && durationDays > 0) {
          subscriptionData.duration = durationDays;
        }
        
        transaction.set(subscriptionRef, subscriptionData, { merge: true });
        
        // Atualizar usuário (reutilizar userRef já declarado acima)
        const userUpdate = {
          currentPlan: normalizedUserType === 'empresa' ? resolvedCompanyPlanTier : resolvedCandidatePlanTier,
          planTierId: normalizedUserType === 'empresa' ? resolvedCompanyPlanTier : resolvedCandidatePlanTier,
          planId: request.planId,
          planEndDate: endDate, // null para planos ilimitados, Timestamp para planos com prazo
          planName: planName || request.planId,
          planStartDate: now, // Adicionar data de início
          planActivationVersion: activationVersion,
          updatedAt: now
        };
        
        // Adicionar informações do plano para candidatos
        if (normalizedUserType === 'candidato') {
          // Os recursos do plano são resolvidos dinamicamente pelo getPlanSummary usando o tier normalizado.
        }
        
        // Adicionar features do plano
        if (planFeatures && Array.isArray(planFeatures) && planFeatures.length > 0) {
          userUpdate.planFeatures = planFeatures;
        }
        
        // Adicionar limite de vagas se existir (apenas para empresas)
        if (normalizedUserType === 'empresa' && planVagasLimit !== undefined && planVagasLimit !== null) {
          userUpdate.vagasLimit = planVagasLimit;
        }
        
        // Adicionar destaque se existir (apenas para empresas)
        if (normalizedUserType === 'empresa' && planDestaque !== undefined) {
          userUpdate.destaque = Boolean(planDestaque);
        }
        
        // Para candidatos, adicionar curriculoDestacado se o plano incluir
        if (normalizedUserType === 'candidato') {
          if (planCurriculoDestacado !== undefined) {
            userUpdate.curriculoDestacado = Boolean(planCurriculoDestacado);
          } else if (resolvedCandidatePlanTier && resolvedCandidatePlanTier !== 'basic_candidato') {
            // Se não foi especificado e não é plano básico, definir como true
            userUpdate.curriculoDestacado = true;
          } else {
            // Se não foi especificado e é plano básico, definir como false
            userUpdate.curriculoDestacado = false;
          }
        }
        
        // Remover campos undefined antes de atualizar
        Object.keys(userUpdate).forEach(key => {
          if (userUpdate[key] === undefined) {
            delete userUpdate[key];
          }
        });
        
        transaction.update(userRef, userUpdate);

        // Atualizar status do pedido
        transaction.update(requestDoc.ref, { 
          status: 'approved',
          paymentStatus: Number(request.price || 0) > 0 ? 'approved' : request.paymentStatus || 'not_required',
          processedAt: now,
          processedBy: decodedToken.uid,
          approvedDate: now,
          planName: planName || request.planId
        });

        // Se tem data de término, agendar reversão
        if (endDate) {
          const scheduledTaskRef = admin.firestore()
            .collection('scheduledTasks')
            .doc(buildPlanExpirationTaskId(request.userId, id));
          transaction.set(scheduledTaskRef, {
            type: 'REVERT_TO_BASIC_PLAN',
            userId: request.userId,
            requestId: id,
            planId: request.planId,
            planTierId: normalizedUserType === 'empresa' ? resolvedCompanyPlanTier : resolvedCandidatePlanTier,
            activationVersion,
            planEndDate: endDate,
            executeAt: endDate,
            created: now
          });
        }
      });

      await admin.firestore().collection('activities').add({
        type: 'subscription_approved',
        description: `Assinatura "${finalPlanName || request.planName || request.planId}" foi aprovada para o utilizador ${request.userId}`,
        userId: request.userId,
        requestId: id,
        planId: request.planId || null,
        adminId: decodedToken.uid,
        createdAt: new Date().toISOString()
      });

      // Criar notificação para o candidato informando que o plano foi ativado
      await createServerNotification(admin, {
        userId: request.userId,
        type: 'SUBSCRIPTION_APPROVED',
        title: 'Plano Ativado com Sucesso! 🎉',
        message: `Seu plano ${finalPlanName || request.planName || request.planId} foi aprovado e está ativo! Agora você tem acesso a todos os recursos premium.`,
        icon: '✅',
        relatedId: id,
        relatedType: 'subscription',
        actionUrl: request.planType === 'empresa' ? '/dashboard/empresa?tab=plans' : '/dashboard/candidato?tab=plans'
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
          paymentStatus: Number(request.price || 0) > 0 ? 'rejected' : request.paymentStatus || 'not_required',
          processedAt: now,
          processedBy: decodedToken.uid,
          rejectedDate: now
        });
      });

      await admin.firestore().collection('activities').add({
        type: 'subscription_rejected',
        description: `Assinatura "${request.planName || request.planId}" foi rejeitada para o utilizador ${request.userId}`,
        userId: request.userId,
        requestId: id,
        planId: request.planId || null,
        adminId: decodedToken.uid,
        createdAt: new Date().toISOString()
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
        actionUrl: request.planType === 'empresa' ? '/premium/empresa' : '/premium/candidatos'
      });
    }

    return res.status(200).json({
      message: action === 'approve' ? 'Assinatura aprovada com sucesso' : 'Assinatura rejeitada',
      requestId: id,
      status: action === 'approve' ? 'approved' : 'rejected'
    });

  } catch (error) {
    if (error?.code === 'REQUEST_ALREADY_PROCESSED') {
      return res.status(409).json({ error: error.message });
    }
    if (error?.code === 'REQUEST_NOT_FOUND') {
      return res.status(404).json({ error: error.message });
    }
    console.error('Erro ao processar pedido:', error);
    console.error('Stack trace:', error.stack);
    return res.status(500).json({ 
      error: 'Erro ao processar pedido',
      message: error.message || 'Erro desconhecido',
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
} 
