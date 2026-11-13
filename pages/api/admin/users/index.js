import { admin } from '../../../../lib/firebaseAdmin';
import { logServerError } from '../../../../lib/serverLog';
import { isUserAccountActive } from '../../../../lib/userStatus';
import { normalizeEmail } from '../../../../lib/validation';
import {
  resolveBaseUrl,
  sendResetPasswordEmail,
} from '../../../../lib/email/authEmails';

export default async function handler(req, res) {
  try {
    // Auth
    const authHeader = req.headers.authorization;
    let token;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.split('Bearer ')[1];
    } else if (req.cookies && req.cookies.token) {
      token = req.cookies.token;
    }

    if (!token) {
      return res
        .status(401)
        .json({ message: 'Token de autorização ausente ou inválido' });
    }

    let decodedToken;
    try {
      decodedToken = await admin.auth().verifyIdToken(token, true);
    } catch {
      return res
        .status(401)
        .json({ message: 'Token de autorização inválido ou expirado' });
    }
    const adminDoc = await admin
      .firestore()
      .collection('users')
      .doc(decodedToken.uid)
      .get();
    if (!adminDoc.exists || adminDoc.data().userType !== 'admin') {
      return res
        .status(403)
        .json({ message: 'Acesso negado. Apenas administradores.' });
    }
    if (!isUserAccountActive(adminDoc.data())) {
      return res.status(403).json({
        code: 'ACCOUNT_BLOCKED',
        message: 'Esta conta está suspensa ou inativa.',
      });
    }

    if (req.method === 'GET') {
      const { userType, status, search, pageSize = '100' } = req.query;
      const limitN = Math.min(parseInt(pageSize, 10) || 100, 500);

      let q = admin
        .firestore()
        .collection('users')
        .orderBy('createdAt', 'desc')
        .limit(limitN);

      if (userType && userType !== 'all') {
        q = admin
          .firestore()
          .collection('users')
          .where('userType', '==', userType)
          .orderBy('createdAt', 'desc')
          .limit(limitN);
      }

      if (status && status !== 'all') {
        q = admin
          .firestore()
          .collection('users')
          .where('status', '==', status)
          .orderBy('createdAt', 'desc')
          .limit(limitN);
      }

      const snapshot = await q.get();
      let users = snapshot.docs.map((doc) => {
        const data = doc.data();
        return {
          id: doc.id,
          name: data.name || data.fullName || '',
          email: data.email || '',
          userType: data.userType || '',
          status: data.status || 'active',
          phone: data.phone || '',
          createdAt: data.createdAt || null,
          updatedAt: data.updatedAt || null,
          photoURL: data.photoURL || null,
        };
      });

      if (search) {
        const s = search.toLowerCase();
        users = users.filter(
          (u) =>
            u.name.toLowerCase().includes(s) ||
            u.email.toLowerCase().includes(s) ||
            u.phone.toLowerCase().includes(s),
        );
      }

      const stats = {
        total: users.length,
        candidatos: users.filter((u) => u.userType === 'candidato').length,
        empresas: users.filter((u) => u.userType === 'empresa').length,
        admins: users.filter((u) => u.userType === 'admin').length,
        active: users.filter((u) => !u.status || u.status === 'active').length,
        suspended: users.filter((u) => u.status === 'suspended').length,
        inactive: users.filter((u) => u.status === 'inactive').length,
      };

      return res.status(200).json({ users, stats });
    } else if (req.method === 'POST') {
      // Create or invite an admin/support user
      const { name, userType } = req.body;
      const email = normalizeEmail(req.body?.email);
      if (!name || !email) {
        return res
          .status(400)
          .json({ message: 'Nome e email são obrigatórios' });
      }
      if (!['admin', 'suporte'].includes(userType)) {
        return res.status(400).json({
          message:
            'Tipo de utilizador inválido para criação manual. Use admin ou suporte.',
        });
      }

      // Check if user already exists
      const existing = await admin
        .firestore()
        .collection('users')
        .where('email', '==', email)
        .limit(1)
        .get();

      if (!existing.empty) {
        return res
          .status(409)
          .json({ message: 'Já existe um utilizador com este email' });
      }

      // Create Firebase Auth user. A conta nasce sem senha: só se define pelo
      // link enviado para este email, o que já prova a posse do endereço —
      // sem `emailVerified` o login (que o exige) deixava a pessoa à porta.
      let authUser;
      try {
        authUser = await admin
          .auth()
          .createUser({ email, displayName: name, emailVerified: true });
      } catch (authError) {
        return res.status(400).json({
          message: 'Erro ao criar autenticação: ' + authError.message,
        });
      }

      await admin.firestore().collection('users').doc(authUser.uid).set({
        name,
        email,
        userType,
        status: 'active',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        createdBy: decodedToken.uid,
      });

      // A pessoa define a senha pelo email da EmpregoSTP, com link para o nosso
      // domínio — nunca o link padrão do Firebase (que antes vinha na resposta
      // e ninguém enviava). Falhar o email não desfaz a conta: pode sempre usar
      // «Recuperar senha» no login.
      let passwordEmailSent = false;
      try {
        await sendResetPasswordEmail({ email, baseUrl: resolveBaseUrl(req) });
        passwordEmailSent = true;
      } catch (emailError) {
        logServerError('admin_users.enviar_email_senha_failed', emailError);
      }

      await admin
        .firestore()
        .collection('activities')
        .add({
          type: 'user_created',
          description: `Utilizador ${name} (${userType}) foi criado por um administrador`,
          userId: authUser.uid,
          adminId: decodedToken.uid,
          createdAt: new Date().toISOString(),
        });

      return res.status(201).json({
        message: 'Utilizador criado com sucesso',
        id: authUser.uid,
        passwordEmailSent,
      });
    } else {
      res.setHeader('Allow', ['GET', 'POST']);
      return res.status(405).json({ message: 'Método não permitido' });
    }
  } catch (error) {
    logServerError('admin_users.api_de_utilizadores_failed', error);
    return res
      .status(500)
      .json({ message: 'Erro interno do servidor', error: error.message });
  }
}
