import { admin } from '../../../../lib/firebaseAdmin';
import { logServerError } from '../../../../lib/serverLog';

/**
 * Alinha o Firebase Auth com o estado administrativo da conta.
 *
 * Uma conta suspensa ou inactiva fica desactivada no Auth e vê os seus tokens
 * revogados, para que as sessões já abertas caiam de imediato. Reactivar
 * devolve o acesso. As falhas são registadas mas não revertem a escrita no
 * Firestore: os guards do servidor já negam pelo `status`, e é preferível a
 * suspensão ficar parcialmente aplicada a ficar por aplicar.
 */
async function syncAuthAccess(uid, status) {
  const deveBloquear = status !== 'active';
  try {
    await admin.auth().updateUser(uid, { disabled: deveBloquear });
    if (deveBloquear) {
      await admin.auth().revokeRefreshTokens(uid);
    }
  } catch (error) {
    logServerError('admin_users_id.sincronizar_acesso_auth_failed', error);
  }
}

export default async function handler(req, res) {
  const { id } = req.query;

  // Verificar o token de autenticação
  try {
    const authHeader = req.headers.authorization;
    let token;

    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.split('Bearer ')[1];
    } else {
      // Se não tiver no header, tenta buscar dos cookies
      const cookies = req.cookies;
      if (cookies && cookies.token) {
        token = cookies.token;
      }
    }

    if (!token) {
      return res
        .status(401)
        .json({ message: 'Token de autorização ausente ou inválido' });
    }

    const decodedToken = await admin.auth().verifyIdToken(token);
    const adminUid = decodedToken.uid;

    // Verificar se o usuário é um administrador
    const adminDoc = await admin
      .firestore()
      .collection('users')
      .doc(adminUid)
      .get();
    if (!adminDoc.exists) {
      return res
        .status(404)
        .json({ message: 'Usuário administrador não encontrado' });
    }

    const adminData = adminDoc.data();
    if (adminData.userType !== 'admin') {
      return res
        .status(403)
        .json({
          message:
            'Acesso negado. Apenas administradores podem acessar esta API',
        });
    }

    // Verificar se o usuário a ser gerenciado existe
    const userDoc = await admin.firestore().collection('users').doc(id).get();
    if (!userDoc.exists) {
      return res.status(404).json({ message: 'Usuário não encontrado' });
    }

    // Métodos permitidos
    if (req.method === 'GET') {
      // Retorna os dados do usuário
      return res.status(200).json({
        id: userDoc.id,
        ...userDoc.data(),
      });
    } else if (req.method === 'PUT') {
      // Atualiza os dados do usuário
      const { name, userType, status } = req.body;

      // Validar dados
      if (!name) {
        return res.status(400).json({ message: 'Nome é obrigatório' });
      }

      if (!['candidato', 'empresa', 'admin'].includes(userType)) {
        return res.status(400).json({ message: 'Tipo de usuário inválido' });
      }

      if (!['active', 'suspended', 'inactive'].includes(status)) {
        return res.status(400).json({ message: 'Status inválido' });
      }

      const targetData = userDoc.data() || {};
      const perdeAcessoAdmin =
        targetData.userType === 'admin' &&
        (userType !== 'admin' || status !== 'active');

      if (perdeAcessoAdmin) {
        // Sem isto era possível ficar sem nenhum administrador activo, e
        // deixar a plataforma sem quem a gerisse.
        if (String(id) === String(adminUid)) {
          return res.status(409).json({
            message:
              'Não pode remover nem suspender o seu próprio acesso de administrador.',
            code: 'ADMIN_SELF_LOCKOUT',
          });
        }

        const adminsSnapshot = await admin
          .firestore()
          .collection('users')
          .where('userType', '==', 'admin')
          .get();
        if ((adminsSnapshot.size ?? adminsSnapshot.docs.length) <= 1) {
          return res.status(409).json({
            message:
              'Este é o último administrador activo. Promova outro antes de o alterar.',
            code: 'LAST_ADMIN',
          });
        }
      }

      // Atualizar no Firestore
      await admin.firestore().collection('users').doc(id).update({
        name,
        userType,
        status,
        updatedAt: new Date().toISOString(),
        updatedBy: adminUid,
      });

      // O Firestore sozinho não chega: os guards leem `status` a cada pedido,
      // mas enquanto a conta continuasse activa no Firebase Auth o utilizador
      // podia autenticar-se e usar o SDK cliente. Desactivar e revogar fecha
      // também as sessões já emitidas.
      await syncAuthAccess(id, status);

      // Registrar atividade
      await admin
        .firestore()
        .collection('activities')
        .add({
          type: 'user_updated',
          description: `Usuário ${name} (${userType}) foi atualizado por um administrador`,
          userId: id,
          adminId: adminUid,
          createdAt: new Date().toISOString(),
        });

      return res.status(200).json({
        message: 'Usuário atualizado com sucesso',
        id,
      });
    } else if (req.method === 'DELETE') {
      // Não permitimos exclusão real de usuários, apenas inativação
      await admin.firestore().collection('users').doc(id).update({
        status: 'inactive',
        updatedAt: new Date().toISOString(),
        updatedBy: adminUid,
      });

      await syncAuthAccess(id, 'inactive');

      // Registrar atividade
      const userData = userDoc.data();
      await admin
        .firestore()
        .collection('activities')
        .add({
          type: 'user_deactivated',
          description: `Usuário ${userData.name || userData.email} foi desativado por um administrador`,
          userId: id,
          adminId: adminUid,
          createdAt: new Date().toISOString(),
        });

      return res.status(200).json({
        message: 'Usuário desativado com sucesso',
        id,
      });
    } else {
      res.setHeader('Allow', ['GET', 'PUT', 'DELETE']);
      return res.status(405).json({ message: 'Método não permitido' });
    }
  } catch (error) {
    logServerError('admin_users_id.gerenciar_usuario_failed', error);
    return res
      .status(500)
      .json({ message: 'Erro interno do servidor', error: error.message });
  }
}
