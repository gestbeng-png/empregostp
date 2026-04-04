import { admin } from '../../../lib/firebaseAdmin';
import { createServerNotification } from '../../../lib/serverNotifications';

const BASIC_PLAN_FALLBACKS = {
  empresa: {
    id: 'basic_empresa',
    name: 'Básico',
    features: ['1 vaga por mês', 'Visualização de candidatos', 'Suporte básico'],
    vagasLimit: 1,
    destaque: false
  },
  candidato: {
    id: 'basic_candidato',
    name: 'Básico',
    features: ['3 candidaturas por mês', 'Cadastro de currículo', 'Candidatura a vagas básicas', 'Suporte básico'],
    curriculoDestacado: false
  }
};

/**
 * Cron job to check and update expired plans
 * Run daily to downgrade users with expired subscriptions to basic plan
 * 
 * Setup: Use CRON_SECRET environment variable for security
 * Example: curl -X POST https://yoursite.com/api/cron/check-plan-expiration -H "Authorization: Bearer YOUR_CRON_SECRET"
 */
export default async function handler(req, res) {
  // Verify cron job secret
  const cronSecret = process.env.CRON_SECRET;
  const providedSecret = req.headers['authorization']?.split('Bearer ')[1];

  if (!cronSecret || providedSecret !== cronSecret) {
    return res.status(401).json({
      error: 'Unauthorized - Invalid cron secret',
      message: 'Set CRON_SECRET environment variable'
    });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed. Use POST.' });
  }

  try {
    const now = new Date();
    let updatedCount = 0;
    let errorCount = 0;

    console.log(`[${now.toISOString()}] Starting plan expiration check...`);

    // Método 1: Buscar tarefas agendadas (existente)
    const tasksSnapshot = await admin.firestore()
      .collection('scheduledTasks')
      .where('type', '==', 'REVERT_TO_BASIC_PLAN')
      .where('executeAt', '<=', admin.firestore.Timestamp.now())
      .get();

    const batch = admin.firestore().batch();

    for (const doc of tasksSnapshot.docs) {
      try {
        const task = doc.data();
        const userId = task.userId;
        const userRef = admin.firestore().collection('users').doc(userId);
        const userDoc = await userRef.get();

        if (!userDoc.exists) {
          console.error(`Usuário ${userId} não encontrado`);
          continue;
        }

        const userData = userDoc.data();
        const userType = userData.userType === 'empresa' ? 'empresa' : 'candidato';
        const basicPlanId = userType === 'empresa' ? 'basic_empresa' : 'basic_candidato';

        // Buscar o plano básico
        const basicPlanDoc = await admin.firestore().collection('plans').doc(basicPlanId).get();
        const basicPlan = basicPlanDoc.exists ? basicPlanDoc.data() : BASIC_PLAN_FALLBACKS[userType];

        // Atualizar usuário para o plano básico
        const userUpdate = {
          currentPlan: basicPlanId,
          planId: basicPlanId,
          planName: basicPlan.name || 'Básico',
          planEndDate: null,
          planFeatures: basicPlan.features,
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        };

        if (userType === 'empresa') {
          userUpdate.vagasLimit = basicPlan.vagasLimit ?? 1;
          userUpdate.destaque = Boolean(basicPlan.destaque);
        } else {
          userUpdate.curriculoDestacado = Boolean(basicPlan.curriculoDestacado);
          userUpdate.destaque = Boolean(basicPlan.curriculoDestacado);
        }

        batch.update(userRef, userUpdate);

        // Atualizar assinatura
        const subscriptionRef = admin.firestore().collection('subscriptions').doc(userId);
        batch.set(subscriptionRef, {
          planId: basicPlanId,
          planName: basicPlan.name || 'Básico',
          userId,
          startDate: admin.firestore.Timestamp.now(),
          endDate: null,
          status: 'active',
          features: basicPlan.features,
          ...(userType === 'empresa'
            ? {
                vagasLimit: basicPlan.vagasLimit ?? 1,
                destaque: Boolean(basicPlan.destaque)
              }
            : {
                curriculoDestacado: Boolean(basicPlan.curriculoDestacado)
              })
        });

        // Marcar tarefa como concluída
        batch.delete(doc.ref);

        updatedCount++;
        console.log(`✓ User ${userId}: reverted to basic plan`);
      } catch (error) {
        errorCount++;
        console.error(`✗ Error updating user:`, error);
      }
    }

    if (updatedCount > 0) {
      await batch.commit();
    }

    // Também criar notificação para usuários que foram downgraciados
    for (const doc of tasksSnapshot.docs) {
      try {
        const task = doc.data();
        await createServerNotification(admin, {
          userId: task.userId,
          type: 'plan_expired',
          title: '📋 Seu Plano Expirou',
          message: 'Seu plano expirou e foi downgraciado para o plano Básico. Renove sua assinatura para continuar com recursos premium.',
          actionUrl: '/premium/candidatos'
        });
      } catch (error) {
        console.error('Error creating notification:', error);
      }
    }

    console.log(`[${now.toISOString()}] Plan expiration check completed:`, {
      processed: tasksSnapshot.docs.length,
      updated: updatedCount,
      errors: errorCount
    });

    return res.status(200).json({
      success: true,
      message: `${updatedCount} users reverted to basic plan`,
      stats: {
        processed: tasksSnapshot.docs.length,
        updated: updatedCount,
        errors: errorCount
      },
      timestamp: now.toISOString()
    });

  } catch (error) {
    console.error('Critical error in plan expiration check:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
} 
