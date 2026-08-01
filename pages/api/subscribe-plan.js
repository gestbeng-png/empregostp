import { admin } from '../../lib/firebaseAdmin';
import { enforceApiRateLimit } from '../../lib/apiRateLimit';
import { getEmpresaPlanFeatures, normalizeEmpresaPlanId } from '../../lib/empresaPlanFeatures';
import { normalizeCandidatePlanId } from '../../lib/candidatePlanFeatures';
import { DEFAULT_EMPRESA_PLANS, DEFAULT_CANDIDATO_PLANS, normalizeUserType } from '../../lib/defaultPlans';
import { logServerError, logServerWarning } from '../../lib/serverLog';
import {
  buildPlanActivationVersion,
  buildPlanExpirationTaskId,
  normalizePlanDurationDays,
  normalizePlanPrice,
} from '../../lib/subscriptionLifecycle';
import { sendPushToUser } from '../../lib/serverNotifications';

const STANDARD_EMPRESA_PLANS = DEFAULT_EMPRESA_PLANS.reduce((acc, plan) => {
  acc[plan.id] = plan;
  return acc;
}, {});

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Método não permitido' });
  }

  // Rate limit: no máximo 10 pedidos de subscrição por minuto por IP
  if (
    !(await enforceApiRateLimit(req, res, {
      scope: 'subscribe_plan',
      limit: 10,
    }))
  ) {
    return;
  }
  return handleSubscription(req, res);
}

async function handleSubscription(req, res) {
  try {
    // Verificar o token de autenticação
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ message: 'Token de autenticação não fornecido' });
    }

    const token = authHeader.split('Bearer ')[1];
    const decodedToken = await admin.auth().verifyIdToken(token);
    const uid = decodedToken.uid;

    // Obter dados do corpo da requisição
    const { planId } = req.body;
    if (!planId) {
      return res.status(400).json({ message: 'ID do plano não fornecido' });
    }

    // Buscar o usuário
    const userDoc = await admin.firestore().collection('users').doc(uid).get();
    if (!userDoc.exists) {
      return res.status(404).json({ message: 'Usuário não encontrado' });
    }
    const userData = userDoc.data();
    const normalizedUserType = normalizeUserType(userData.userType) || 'empresa';

    const existingOpenRequestsSnapshot = await admin.firestore()
      .collection('subscription-requests')
      .where('userId', '==', uid)
      .get();
    const existingOpenRequest = existingOpenRequestsSnapshot.docs.find((doc) => {
      const status = doc.data()?.status;
      return status === 'pending' || status === 'payment_submitted';
    });
    if (existingOpenRequest) {
      return res.status(400).json({
        message: 'Já existe uma solicitação de plano em aberto. Envie o comprovativo pendente ou aguarde a decisão do administrador.',
        code: 'OPEN_SUBSCRIPTION_REQUEST',
        requestId: existingOpenRequest.id
      });
    }

    // Buscar o plano
    const planDoc = await admin.firestore().collection('plans').doc(planId).get();
    let plan;
    
    // Verificar se é um plano personalizado ou padrão
    if (planDoc.exists) {
      plan = { id: planDoc.id, ...planDoc.data() };
      if (plan.isActive === false) {
        return res.status(400).json({ message: 'Este plano está desativado no momento' });
      }
      if (STANDARD_EMPRESA_PLANS[plan.id]) {
        // Os valores do admin (documento no Firestore) têm prioridade;
        // o plano padrão apenas preenche campos em falta.
        plan = {
          ...STANDARD_EMPRESA_PLANS[plan.id],
          ...plan,
          id: plan.id,
          type: 'empresa',
          isActive: plan.isActive !== false
        };
      }
    } else {
      // Verificar planos padrão
      const defaults = normalizedUserType === 'empresa' ? DEFAULT_EMPRESA_PLANS : DEFAULT_CANDIDATO_PLANS;
      plan = defaults.find((p) => p.id === planId);
      if (!plan) {
        return res.status(404).json({ message: 'Plano não encontrado' });
      }
    }

    // Verificar se o plano é do tipo correto para o usuário
    const normalizedPlanType = normalizeUserType(plan.type) || '';
    const planIdStr = String(plan.id || '');
    const normalizedRequestedEmpresaPlanId = normalizedUserType === 'empresa'
      ? normalizeEmpresaPlanId(plan.id, plan.name, plan)
      : null;
    const normalizedRequestedCandidatePlanId = normalizedUserType === 'candidato'
      ? normalizeCandidatePlanId(plan.id, plan.name, plan)
      : null;
    const idHint =
      planIdStr.includes('_empresa') ? 'empresa' :
      planIdStr.includes('_candidato') ? 'candidato' :
      '';
    const inferredPlanType = idHint || normalizedPlanType || (normalizedRequestedEmpresaPlanId ? 'empresa' : (planIdStr ? 'candidato' : ''));
    if (inferredPlanType !== normalizedUserType) {
      return res.status(400).json({ 
        message: 'Este plano não está disponível para o seu tipo de usuário' 
      });
    }

    // Enforce allowed tiers to avoid legacy/duplicate plans showing up across the product.
    const allowedCandidatePlans = new Set(['basic_candidato', 'verification_candidato', 'professional_candidato', 'unlimited_candidato']);
    const allowedCompanyPlans = new Set(['basic_empresa', 'professional_empresa', 'unlimited_empresa']);
    if (normalizedUserType === 'candidato' && !allowedCandidatePlans.has(normalizedRequestedCandidatePlanId || planIdStr)) {
      return res.status(400).json({ message: 'Plano não suportado. Selecione um dos planos atuais.' });
    }
    if (normalizedUserType === 'empresa' && !allowedCompanyPlans.has(normalizedRequestedEmpresaPlanId || planIdStr)) {
      return res.status(400).json({ message: 'Plano não suportado. Selecione um dos planos atuais.' });
    }

    // Preço e duração são normalizados uma única vez; todas as decisões
    // gratuito/pago e datas de expiração derivam destes dois valores.
    const planPrice = normalizePlanPrice(plan.price);
    const planDurationDays = normalizePlanDurationDays(plan.duration);
    if (planPrice === null || planDurationDays === null) {
      logServerWarning('subscription.plan_config_invalid', undefined);
      return res.status(400).json({
        message: 'A configuração deste plano está inválida. Contacte o suporte.',
      });
    }
    const isFreePlan = planPrice === 0;

    // Verificar se o usuário já tem um plano ativo
    const requestedEmpresaTierId = normalizedRequestedEmpresaPlanId;
    const requestedCandidateTierId = normalizedRequestedCandidatePlanId;
    const currentPlanIdRaw = userData.currentPlan || (normalizedUserType === 'candidato' ? 'basic_candidato' : 'basic_empresa');
    const currentPlanId = normalizedUserType === 'empresa'
      ? normalizeEmpresaPlanId(currentPlanIdRaw, userData.planName, userData)
      : normalizeCandidatePlanId(currentPlanIdRaw, userData.planName, userData);
    const requestedPlanIdForRules = normalizedUserType === 'empresa' ? requestedEmpresaTierId : requestedCandidateTierId;
    const { isPlanActive } = await import('../../lib/candidatePlanFeatures');
    
    // Verificar se o plano atual está ativo
    // Planos básicos sempre estão ativos, planos pagos precisam verificar data de término
    const isBasicPlan = currentPlanId === 'basic_candidato' || currentPlanId === 'basic_empresa';
    const hasActivePlan = !isBasicPlan && isPlanActive(userData.planEndDate);

    // O plano Básico já ativo não precisa de novo pedido, notificação ou escrita.
    if (isBasicPlan && currentPlanId === requestedPlanIdForRules) {
      return res.status(200).json({
        message: 'Plano já está ativo',
        status: 'approved'
      });
    }
    
    // Se já tem plano ativo e está tentando assinar o mesmo plano, bloquear
    if (hasActivePlan && currentPlanId === requestedPlanIdForRules) {
      const currentPlanName = userData.planName || currentPlanId;
      return res.status(400).json({ 
        message: `Você já possui o plano ${currentPlanName} ativo. Não é possível assinar o mesmo plano novamente.`,
        code: 'PLAN_ALREADY_ACTIVE',
        currentPlan: currentPlanId,
        currentPlanName: currentPlanName
      });
    }
    
    // Verificar se é um upgrade válido
    // Candidatos:
    // - básico -> verificação/profissional/premium
    // - verificação -> profissional/premium
    // - profissional -> premium
    const isUpgrade = (
      // Candidatos
      (currentPlanId === 'basic_candidato' && (requestedPlanIdForRules === 'verification_candidato' || requestedPlanIdForRules === 'professional_candidato' || requestedPlanIdForRules === 'unlimited_candidato')) ||
      (currentPlanId === 'verification_candidato' && (requestedPlanIdForRules === 'professional_candidato' || requestedPlanIdForRules === 'unlimited_candidato')) ||
      (currentPlanId === 'professional_candidato' && requestedPlanIdForRules === 'unlimited_candidato') ||
      // Empresas
      (currentPlanId === 'basic_empresa' && (requestedPlanIdForRules === 'professional_empresa' || requestedPlanIdForRules === 'unlimited_empresa')) ||
      (currentPlanId === 'professional_empresa' && requestedPlanIdForRules === 'unlimited_empresa')
    );
    
    // Se tem plano ativo e não é upgrade válido, bloquear
    if (hasActivePlan && !isUpgrade && currentPlanId !== requestedPlanIdForRules) {
      const currentPlanName = userData.planName || currentPlanId;
      return res.status(400).json({ 
        message: `Você já possui um plano ativo (${currentPlanName}). Só é possível fazer upgrade para um plano superior ou aguardar a expiração do plano atual.`,
        code: 'UPGRADE_ONLY',
        currentPlan: currentPlanId,
        currentPlanName: currentPlanName
      });
    }

    // Calcular a data de término do plano
    const now = admin.firestore.Timestamp.now();
    const isRequestedBasicPlan = requestedPlanIdForRules === 'basic_candidato'
      || requestedPlanIdForRules === 'basic_empresa';
    const planEndDate = isRequestedBasicPlan
      ? null
      : new admin.firestore.Timestamp(
          now.seconds + (planDurationDays * 24 * 60 * 60),
          now.nanoseconds
        );

    // Criar solicitação de assinatura
    const subscriptionRequest = {
      userId: uid,
      userEmail: userData.email,
      userName: userData.name || userData.fullName || 'Usuário',
      planId: plan.id,
      planTierId: normalizedUserType === 'empresa' ? requestedEmpresaTierId : requestedCandidateTierId,
      planName: plan.name,
      planType: inferredPlanType,
      price: planPrice,
      duration: planDurationDays,
      status: isFreePlan ? 'approved' : 'pending',
      requestDate: now,
      createdAt: now,
      updatedAt: now,
      // Incluir recursos do plano
      features: plan.features || [],
      // Campos específicos de empresa (apenas se existirem)
      ...(plan.vagasLimit !== undefined && { vagasLimit: plan.vagasLimit }),
      ...(plan.destaque !== undefined && { destaque: plan.destaque }),
      // Campos específicos de candidato (apenas se existirem)
      ...(plan.curriculoDestacado !== undefined && { curriculoDestacado: plan.curriculoDestacado }),
      paymentInstructions: null // Será preenchido com dados do admin se necessário
    };
    
    // Remover campos undefined do objeto
    Object.keys(subscriptionRequest).forEach(key => {
      if (subscriptionRequest[key] === undefined) {
        delete subscriptionRequest[key];
      }
    });
    


    // Se for plano PAGO, buscar admins ANTES da transação
    let adminIds = [];
    let paymentSettings = null;
    
    if (!isFreePlan) {
      const adminsSnapshot = await admin.firestore()
        .collection('users')
        .where('userType', '==', 'admin')
        .get();
      adminIds = adminsSnapshot.docs.map(doc => doc.id);
      
      // Buscar configurações de pagamento
      try {
        const paymentSettingsDoc = await admin.firestore().collection('settings').doc('payment').get();
        if (paymentSettingsDoc.exists) {
          paymentSettings = paymentSettingsDoc.data();
        }
      } catch (err) {
        logServerWarning('subscription.payment_settings_lookup_failed', err);
      }
    }

    const resolvedPaymentInstructions = !isFreePlan ? {
      amount: planPrice,
      currency: 'Dobras',
      accountNumber: paymentSettings?.accountNumber || '',
      accountName: paymentSettings?.accountName || '',
      bankName: paymentSettings?.bankName || '',
      email: paymentSettings?.email || '',
      message: paymentSettings?.instructions || 'Faça a transferência para a conta indicada e envie o comprovativo pela plataforma para validação.'
    } : null;

    let subscriptionRequestId = null;

    // Iniciar transação
    await admin.firestore().runTransaction(async (transaction) => {
      // Criar solicitação de assinatura
      const subscriptionRef = admin.firestore().collection('subscription-requests').doc();
      subscriptionRequestId = subscriptionRef.id;
      const requestPayload = {
        ...subscriptionRequest,
        paymentInstructions: resolvedPaymentInstructions,
        paymentStatus: !isFreePlan ? 'awaiting_proof' : 'not_required',
        priceLabel: plan.priceLabel || '',
        ...(isFreePlan && {
          approvedDate: now,
          autoApproved: true,
          processedAt: now
        })
      };
      transaction.set(subscriptionRef, requestPayload);

      // Se for plano PAGO, criar notificação para ADMIN
      if (!isFreePlan && adminIds.length > 0) {
        // Criar notificação para cada admin (dentro da transação)
        adminIds.forEach(adminId => {
          const adminNotificationRef = admin.firestore().collection('notifications').doc();
          transaction.set(adminNotificationRef, {
            userId: adminId,
            type: 'SUBSCRIPTION_REQUEST',
            title: 'Nova Solicitação de Plano',
            message: `${userData.fullName || userData.name || userData.email} (${userData.email}) solicitou o plano ${plan.name} (${plan.priceLabel}). Clique para aprovar ou rejeitar.`,
            icon: '💳',
            read: false,
            relatedId: subscriptionRef.id,
            relatedType: 'subscription_request',
            createdAt: now,
            priority: 'high',
            actionUrl: `/dashboard/admin/subscription-requests`
          });
        });
      }

      // Se for plano gratuito, atualizar usuário imediatamente
      if (isFreePlan) {
        const userRef = admin.firestore().collection('users').doc(uid);
        const resolvedEmpresaPlanId = normalizedUserType === 'empresa'
          ? requestedEmpresaTierId
          : null;
        const resolvedEmpresaFeatures = normalizedUserType === 'empresa'
          ? getEmpresaPlanFeatures(resolvedEmpresaPlanId, plan.name, plan)
          : null;
        // O Básico é vitalício e não versionado; um tier com prazo ativado
        // gratuitamente recebe o mesmo lifecycle versionado do fluxo pago,
        // para que o cron de expiração o consiga reverter com segurança.
        const activationVersion = isRequestedBasicPlan
          ? null
          : buildPlanActivationVersion(subscriptionRef.id);
        const resolvedTierId = normalizedUserType === 'empresa'
          ? resolvedEmpresaPlanId
          : requestedCandidateTierId;
        const updateData = {
          currentPlan: resolvedTierId,
          planTierId: resolvedTierId,
          planId: plan.id,
          planName: plan.name,
          planEndDate: planEndDate,
          planActivationVersion: activationVersion,
          planFeatures: plan.features || [],
          updatedAt: now
        };

        // Para empresas, atualizar limite de vagas
        if (normalizedUserType === 'empresa') {
          updateData.vagasLimit = plan.vagasLimit !== undefined
            ? plan.vagasLimit
            : resolvedEmpresaFeatures.maxActiveJobs;
          updateData.destaque = plan.destaque !== undefined
            ? Boolean(plan.destaque)
            : Boolean(resolvedEmpresaFeatures.canHighlightJobs);
        }

        // Para candidatos, atualizar status do currículo
        if (normalizedUserType === 'candidato') {
          updateData.curriculoDestacado = plan.curriculoDestacado || false;
          updateData.destaque = plan.curriculoDestacado || false;
        }

        transaction.update(userRef, updateData);

        const subscriptionMirrorRef = admin.firestore()
          .collection('subscriptions')
          .doc(uid);
        const subscriptionMirror = {
          planId: plan.id,
          planTierId: resolvedTierId,
          planName: plan.name,
          userId: uid,
          startDate: now,
          endDate: planEndDate,
          status: 'active',
          features: plan.features || [],
          activationVersion,
          ...(normalizedUserType === 'empresa' && {
            vagasLimit: updateData.vagasLimit,
            destaque: updateData.destaque
          }),
          ...(normalizedUserType === 'candidato' && {
            curriculoDestacado: updateData.curriculoDestacado
          })
        };
        transaction.set(subscriptionMirrorRef, subscriptionMirror, { merge: true });

        if (!isRequestedBasicPlan && planEndDate) {
          const scheduledTaskRef = admin.firestore()
            .collection('scheduledTasks')
            .doc(buildPlanExpirationTaskId(uid, subscriptionRef.id));
          transaction.set(scheduledTaskRef, {
            type: 'REVERT_TO_BASIC_PLAN',
            userId: uid,
            requestId: subscriptionRef.id,
            planId: plan.id,
            planTierId: resolvedTierId,
            activationVersion,
            planEndDate,
            executeAt: planEndDate,
            created: now
          });
        }
      }

      // Criar notificação para o usuário
      const notificationRef = admin.firestore().collection('notifications').doc();
      let notificationMessage = '';
      let notificationTitle = '';
      
      if (isFreePlan) {
        notificationTitle = 'Plano Ativado';
        notificationMessage = `Seu plano ${plan.name} foi ativado com sucesso!`;
      } else if (hasActivePlan && isUpgrade) {
        // Upgrade de plano
        notificationTitle = 'Upgrade de Plano Solicitado';
        const currentPlanName = userData.planName || currentPlanId;
        if (paymentSettings && paymentSettings.accountNumber) {
          notificationMessage = `Você solicitou upgrade do plano ${currentPlanName} para ${plan.name}. Faça a transferência de ${planPrice} Dobras para a conta ${paymentSettings.accountNumber}${paymentSettings.accountName ? ` (${paymentSettings.accountName})` : ''}${paymentSettings.bankName ? ` - ${paymentSettings.bankName}` : ''} e envie o comprovativo na plataforma. Seu plano atual permanecerá ativo até a aprovação do upgrade.`;
        } else {
          notificationMessage = `Você solicitou upgrade do plano ${currentPlanName} para ${plan.name}. Aguarde instruções de pagamento do administrador. Seu plano atual permanecerá ativo até a aprovação do upgrade.`;
        }
      } else {
        notificationTitle = 'Aguardando Pagamento';
        // Usar configurações de pagamento buscadas antes da transação
        if (paymentSettings && paymentSettings.accountNumber) {
          notificationMessage = `Sua solicitação do plano ${plan.name} foi recebida. Faça a transferência de ${planPrice} Dobras para a conta ${paymentSettings.accountNumber}${paymentSettings.accountName ? ` (${paymentSettings.accountName})` : ''}${paymentSettings.bankName ? ` - ${paymentSettings.bankName}` : ''} e envie o comprovativo na plataforma para revisão.`;
        } else {
          notificationMessage = `Sua solicitação do plano ${plan.name} foi recebida. Aguarde instruções de pagamento do administrador.`;
        }
      }
      
      const notification = {
        userId: uid,
        type: 'SUBSCRIPTION_REQUEST',
        title: notificationTitle,
        message: notificationMessage,
        createdAt: now,
        read: false
      };
      transaction.set(notificationRef, notification);
    });

    if (!isFreePlan && adminIds.length > 0) {
      await Promise.all(adminIds.map((adminId) => sendPushToUser(admin, adminId, {
        title: 'Nova Solicitação de Plano',
        message: `${userData.fullName || userData.name || userData.email} (${userData.email}) solicitou o plano ${plan.name} (${plan.priceLabel}).`,
        type: 'SUBSCRIPTION_REQUEST',
        relatedId: subscriptionRequestId,
        relatedType: 'subscription_request',
        actionUrl: '/dashboard/admin/subscription-requests'
      })));
    }

    if (!isFreePlan) {
      let notificationTitle = '';
      let notificationMessage = '';
      if (hasActivePlan && isUpgrade) {
        notificationTitle = 'Upgrade de Plano Solicitado';
        const currentPlanName = userData.planName || currentPlanId;
        notificationMessage = paymentSettings && paymentSettings.accountNumber
          ? `Você solicitou upgrade do plano ${currentPlanName} para ${plan.name}. Faça a transferência e envie o comprovativo na plataforma.`
          : `Você solicitou upgrade do plano ${currentPlanName} para ${plan.name}. Aguarde instruções de pagamento do administrador.`;
      } else {
        notificationTitle = 'Aguardando Pagamento';
        notificationMessage = paymentSettings && paymentSettings.accountNumber
          ? `Sua solicitação do plano ${plan.name} foi recebida. Faça a transferência e envie o comprovativo na plataforma para revisão.`
          : `Sua solicitação do plano ${plan.name} foi recebida. Aguarde instruções de pagamento do administrador.`;
      }

      await sendPushToUser(admin, uid, {
        title: notificationTitle,
        message: notificationMessage,
        type: 'SUBSCRIPTION_REQUEST',
        relatedId: subscriptionRequestId,
        relatedType: 'subscription_request',
        actionUrl: normalizedUserType === 'empresa' ? '/dashboard/empresa?tab=plans' : '/dashboard/candidato?tab=plans'
      });
    }
    
    // Buscar configurações de pagamento se for plano pago
    const paymentInstructions = resolvedPaymentInstructions;

    // Retornar resposta apropriada
    if (isFreePlan) {
      return res.status(200).json({
        message: 'Plano ativado com sucesso',
        status: 'approved'
      });
    } else {
      return res.status(200).json({
        message: 'Solicitação de assinatura enviada com sucesso',
        status: 'awaiting_payment',
        requestId: subscriptionRequestId,
        paymentInstructions: paymentInstructions || {
          amount: planPrice,
          currency: 'Dobras',
          email: 'empregoSTP@gmail.com',
          message: 'Faça a transferência e envie o comprovativo pela plataforma.'
        }
      });
    }

  } catch (error) {
    logServerError('subscription.request_failed', error);
    const errorMessage = 'Erro ao processar solicitação de assinatura';
    return res.status(500).json({ 
      error: errorMessage,
      message: errorMessage
    });
  }
} 
