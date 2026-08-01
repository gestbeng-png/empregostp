import { admin } from '../../../lib/firebaseAdmin';
import { getDefaultBasicPlanForUserType } from '../../../lib/defaultPlans';
import { createServerNotification } from '../../../lib/serverNotifications';
import { evaluatePlanExpirationTask } from '../../../lib/subscriptionLifecycle';

/**
 * Cron job to check and update expired plans
 * Run daily to downgrade users with expired subscriptions to basic plan
 * 
 * Setup: Use CRON_SECRET environment variable for security
 * Vercel Cron invokes this route with GET. POST remains available for manual runs.
 * Example: curl https://yoursite.com/api/cron/check-plan-expiration -H "Authorization: Bearer YOUR_CRON_SECRET"
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

  if (req.method !== 'GET' && req.method !== 'POST') {
    res.setHeader('Allow', ['GET', 'POST']);
    return res.status(405).json({ error: 'Method not allowed. Use GET or POST.' });
  }

  try {
    const now = new Date();
    const nowTimestamp = admin.firestore.Timestamp.now();
    let updatedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;

    console.log(`[${now.toISOString()}] Starting plan expiration check...`);

    // Método 1: Buscar tarefas agendadas (existente)
    const tasksSnapshot = await admin.firestore()
      .collection('scheduledTasks')
      .where('type', '==', 'REVERT_TO_BASIC_PLAN')
      .where('executeAt', '<=', nowTimestamp)
      .get();

    for (const doc of tasksSnapshot.docs) {
      try {
        const outcome = await admin.firestore().runTransaction(async (transaction) => {
          const freshTaskDoc = await transaction.get(doc.ref);
          if (!freshTaskDoc.exists) {
            return { status: 'skipped', reason: 'task_already_processed' };
          }

          const task = freshTaskDoc.data() || {};
          const userId = task.userId;
          if (!userId) {
            transaction.delete(doc.ref);
            return { status: 'skipped', reason: 'task_without_user' };
          }

          const userRef = admin.firestore().collection('users').doc(userId);
          const userDoc = await transaction.get(userRef);
          if (!userDoc.exists) {
            transaction.delete(doc.ref);
            return { status: 'skipped', reason: 'user_not_found' };
          }

          const subscriptionRef = admin.firestore().collection('subscriptions').doc(userId);
          const subscriptionDoc = await transaction.get(subscriptionRef);
          const userData = userDoc.data() || {};
          const subscriptionData = subscriptionDoc.exists
            ? subscriptionDoc.data()
            : null;
          const eligibility = evaluatePlanExpirationTask({
            task,
            user: userData,
            subscription: subscriptionData,
            now: nowTimestamp
          });

          if (!eligibility.eligible) {
            transaction.delete(doc.ref);
            return {
              status: 'skipped',
              reason: eligibility.reason,
              userId
            };
          }

          const userType = userData.userType === 'empresa' ? 'empresa' : 'candidato';
          const basicPlanId = userType === 'empresa' ? 'basic_empresa' : 'basic_candidato';
          const basicPlanRef = admin.firestore().collection('plans').doc(basicPlanId);
          const basicPlanDoc = await transaction.get(basicPlanRef);
          const basicPlan = basicPlanDoc.exists
            ? basicPlanDoc.data()
            : getDefaultBasicPlanForUserType(userType);

          const userUpdate = {
            currentPlan: basicPlanId,
            planId: basicPlanId,
            planTierId: basicPlanId,
            planName: basicPlan.name || 'Básico',
            planEndDate: null,
            planActivationVersion: null,
            planFeatures: basicPlan.features || [],
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
          };

          if (userType === 'empresa') {
            userUpdate.vagasLimit = basicPlan.vagasLimit ?? 1;
            userUpdate.destaque = Boolean(basicPlan.destaque);
          } else {
            userUpdate.curriculoDestacado = Boolean(basicPlan.curriculoDestacado);
            userUpdate.destaque = Boolean(basicPlan.curriculoDestacado);
          }

          transaction.update(userRef, userUpdate);
          transaction.set(subscriptionRef, {
            planId: basicPlanId,
            planTierId: basicPlanId,
            planName: basicPlan.name || 'Básico',
            userId,
            startDate: nowTimestamp,
            endDate: null,
            status: 'active',
            activationVersion: null,
            features: basicPlan.features || [],
            ...(userType === 'empresa'
              ? {
                  vagasLimit: basicPlan.vagasLimit ?? 1,
                  destaque: Boolean(basicPlan.destaque)
                }
              : {
                  curriculoDestacado: Boolean(basicPlan.curriculoDestacado)
                })
          });
          transaction.delete(doc.ref);

          return {
            status: 'downgraded',
            userId,
            userType
          };
        });

        if (outcome.status !== 'downgraded') {
          skippedCount++;
          console.log(`↷ Skipped plan expiration task ${doc.id}: ${outcome.reason}`);
          continue;
        }

        updatedCount++;
        console.log(`✓ User ${outcome.userId}: reverted to basic plan`);

        try {
          await createServerNotification(admin, {
            userId: outcome.userId,
            type: 'plan_expired',
            title: '📋 Seu Plano Expirou',
            message: 'Seu plano expirou e foi alterado para o plano Básico. Renove a sua subscrição para continuar com os recursos premium.',
            actionUrl: outcome.userType === 'empresa' ? '/premium/empresa' : '/premium/candidatos'
          });
        } catch (notificationError) {
          console.error('Error creating plan expiration notification:', notificationError);
        }
      } catch (error) {
        errorCount++;
        console.error(`✗ Error processing plan expiration task ${doc.id}:`, error);
      }
    }

    console.log(`[${now.toISOString()}] Plan expiration check completed:`, {
      processed: tasksSnapshot.docs.length,
      updated: updatedCount,
      skipped: skippedCount,
      errors: errorCount
    });

    return res.status(200).json({
      success: true,
      message: `${updatedCount} users reverted to basic plan`,
      stats: {
        processed: tasksSnapshot.docs.length,
        updated: updatedCount,
        skipped: skippedCount,
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
