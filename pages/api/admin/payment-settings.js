import { admin } from '../../../lib/firebaseAdmin';

export default async function handler(req, res) {
  try {
    if (req.method === 'GET') {
      // GET é público - qualquer um pode ver as configurações de pagamento
      const settingsDoc = await admin.firestore().collection('settings').doc('payment').get();
      
      if (settingsDoc.exists) {
        const data = settingsDoc.data();
        return res.status(200).json({
          accountNumber: data.accountNumber || '',
          accountName: data.accountName || '',
          bankName: data.bankName || '',
          email: data.email || '',
          instructions: data.instructions || ''
        });
      }
      
      return res.status(200).json({
        accountNumber: '',
        accountName: '',
        bankName: '',
        email: '',
        instructions: ''
      });
    }

    // POST/PUT requer autenticação de admin
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Token não fornecido' });
    }

    const token = authHeader.split('Bearer ')[1];
    const decodedToken = await admin.auth().verifyIdToken(token);
    
    // Verificar se é admin
    const userDoc = await admin.firestore().collection('users').doc(decodedToken.uid).get();
    if (!userDoc.exists || userDoc.data().userType !== 'admin') {
      return res.status(403).json({ error: 'Acesso não autorizado' });
    }

    if (req.method === 'POST' || req.method === 'PUT') {
      const { accountNumber, accountName, bankName, email, instructions } = req.body;

      if (!accountNumber) {
        return res.status(400).json({ error: 'Número da conta é obrigatório' });
      }

      await admin.firestore().collection('settings').doc('payment').set({
        accountNumber,
        accountName: accountName || '',
        bankName: bankName || '',
        email: email || '',
        instructions: instructions || 'Por favor, faça a transferência para a conta indicada e envie o comprovativo pela plataforma para validação do administrador.',
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedBy: decodedToken.uid
      }, { merge: true });

      await admin.firestore().collection('activities').add({
        type: 'payment_settings_updated',
        description: 'Configurações de pagamento foram atualizadas por um administrador',
        adminId: decodedToken.uid,
        createdAt: new Date().toISOString()
      });

      return res.status(200).json({ 
        message: 'Configurações de pagamento atualizadas com sucesso',
        accountNumber,
        accountName,
        bankName,
        email,
        instructions
      });
    }

    return res.status(405).json({ error: 'Método não permitido' });
  } catch (error) {
    console.error('Erro na API de configurações de pagamento:', error);
    return res.status(500).json({ error: 'Erro interno do servidor' });
  }
}
