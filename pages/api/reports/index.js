import { admin as adminApp } from '../../../lib/firebaseAdmin';
import { requireActiveApiUser } from '../../../lib/apiUserAuth';
import { logServerError } from '../../../lib/serverLog';
import { getSubmitReport } from '../../../infrastructure/firebase/reports/createSubmitReport';
import { getFeatureEnvironment } from '../../../infrastructure/firebase/marketplace/environment';
import { REPORT_MESSAGES } from '../../../domain/reports/policy';
import { permissionRoleOf } from '../../../domain/permissions/legacyRole';

const ERRORS = {
  FEATURE_DISABLED: [404, 'Esta funcionalidade ainda não está disponível.'],
  FORBIDDEN: [403, 'Esta conta não pode enviar denúncias.'],
  INVALID_INPUT: [400, 'A denúncia contém dados inválidos.'],
  NOT_FOUND: [404, 'O conteúdo denunciado não foi encontrado.'],
  RATE_LIMITED: [
    429,
    'Fez muitas denúncias hoje. Tente novamente amanhã ou contacte o EmpregoSTP.',
  ],
};

/**
 * POST /api/reports — E9/F1.8 («Pediram-me dinheiro»). A resposta nunca diz
 * se o conteúdo foi ocultado: o denunciante recebe só a confirmação.
 */
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({
      error: { code: 'METHOD_NOT_ALLOWED', message: 'Método não permitido.' },
    });
  }
  try {
    const authResult = await requireActiveApiUser(req, res, {
      adminApp,
      missingTokenMessage: 'Inicie sessão para denunciar.',
    });
    if (!authResult) return;
    const body = req.body || {};
    const result = await getSubmitReport().execute(
      {
        reporterUserId: authResult.uid,
        reporterRole: permissionRoleOf(authResult.userData),
        targetType: body.targetType,
        targetId: body.targetId,
        reason: body.reason,
        details: body.details,
      },
      { environment: getFeatureEnvironment() },
    );
    if (!result.ok) {
      const [status, message] = ERRORS[result.code] || [
        400,
        'Pedido inválido.',
      ];
      return res.status(status).json({ error: { code: result.code, message } });
    }
    return res.status(result.alreadyReported ? 200 : 201).json({
      reportId: result.reportId,
      message: result.alreadyReported
        ? REPORT_MESSAGES.ALREADY_REPORTED
        : REPORT_MESSAGES.RECEIVED,
    });
  } catch (error) {
    logServerError('reports.submeter_failed', error);
    return res.status(500).json({
      error: {
        code: 'INTERNAL',
        message: 'Não foi possível enviar a denúncia. Tente novamente.',
      },
    });
  }
}
