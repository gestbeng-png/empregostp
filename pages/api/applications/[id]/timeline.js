import { admin as adminApp } from '../../../../lib/firebaseAdmin';
import { requireActiveApiUser } from '../../../../lib/apiUserAuth';
import { logServerError } from '../../../../lib/serverLog';
import { buildCandidateApplicationView } from '../../../../application/applications/candidateApplicationView';
import { candidateInterviewView } from '../../../../domain/interviews/schedule';

const NOT_FOUND = {
  error: { code: 'NOT_FOUND', message: 'Candidatura não encontrada.' },
};

/**
 * GET /api/applications/[id]/timeline — linha temporal do candidato (E4).
 * IDOR: candidatura de outra pessoa responde 404, como uma inexistente.
 */
export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({
      error: { code: 'METHOD_NOT_ALLOWED', message: 'Método não permitido.' },
    });
  }
  res.setHeader('Cache-Control', 'private, no-store');
  try {
    const authResult = await requireActiveApiUser(req, res, { adminApp });
    if (!authResult) return;
    const { uid } = authResult;
    const id = String(req.query?.id || '');
    if (!/^[A-Za-z0-9_-]{1,300}$/.test(id))
      return res.status(404).json(NOT_FOUND);
    const snapshot = await adminApp
      .firestore()
      .collection('applications')
      .doc(id)
      .get();
    const application = snapshot.exists ? snapshot.data() : null;
    if (
      !application ||
      (application.candidateUserId !== uid && application.candidateId !== uid)
    ) {
      return res.status(404).json(NOT_FOUND);
    }
    if (typeof application.v2Status !== 'string') {
      return res.status(409).json({
        error: {
          code: 'LEGACY_APPLICATION',
          message: 'Esta candidatura usa o acompanhamento anterior.',
        },
      });
    }
    const db = adminApp.firestore();
    const [history, interviews, hire] = await Promise.all([
      db
        .collection('applicationsStatusHistory')
        .where('entityId', '==', id)
        .get(),
      db.collection('interviews').where('applicationId', '==', id).get(),
      db.collection('hires').doc(id).get(),
    ]);
    const hireData = hire.exists ? hire.data() : null;
    return res.status(200).json({
      ...buildCandidateApplicationView(
        id,
        application,
        history.docs.map((doc) => doc.data()),
        new Date(),
      ),
      // E6: só os campos visíveis ao candidato, com hora no fuso explícito.
      interviews: interviews.docs.map((doc) =>
        candidateInterviewView({ id: doc.id, ...doc.data() }),
      ),
      // E5.3: «Começou a trabalhar?» só depois do pedido aos 30 dias.
      hireConfirmation:
        hireData &&
        hireData.status === 'ACTIVE' &&
        hireData.confirmationRequestedAt &&
        ['PENDING', 'NO_RESPONSE'].includes(hireData.candidateConfirmation)
          ? { hireId: id, question: 'Começou a trabalhar nesta organização?' }
          : null,
    });
  } catch (error) {
    logServerError('applications.timeline_failed', error);
    return res.status(500).json({
      error: {
        code: 'INTERNAL',
        message: 'Não foi possível carregar a candidatura. Tente novamente.',
      },
    });
  }
}
