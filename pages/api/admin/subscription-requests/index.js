import { admin } from '../../../../lib/firebaseAdmin';
import { serializeFirestoreValue } from '../../../../lib/empresaPlansCatalog';

export default async function handler(req, res) {
  try {
    // Verificar token
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

    if (req.method === 'GET') {
      const { status = 'all', pageSize = '40', cursorId } = req.query;
      const limitN = Math.min(parseInt(pageSize, 10) || 40, 120);
      const normalizedStatus = String(status || 'all').trim().toLowerCase();

      const buildQuery = () => {
        let q = admin.firestore().collection('subscription-requests');
        if (normalizedStatus !== 'all') {
          q = q.where('status', '==', normalizedStatus);
        }
        return q.orderBy('requestDate', 'desc');
      };

      let q = buildQuery();
      let cursorDoc = null;
      if (cursorId) {
        const cursorSnap = await admin.firestore().collection('subscription-requests').doc(String(cursorId)).get();
        if (cursorSnap.exists) {
          cursorDoc = cursorSnap;
          q = q.startAfter(cursorSnap);
        }
      }

      let snapshot;
      try {
        snapshot = await q.limit(limitN + 1).get();
      } catch (error) {
        // Handle older datasets without expected index/orderBy support.
        if (error?.code !== 9) throw error;
        let fallbackQuery = admin.firestore().collection('subscription-requests').orderBy('createdAt', 'desc');
        if (cursorDoc) {
          fallbackQuery = fallbackQuery.startAfter(cursorDoc);
        }
        try {
          if (normalizedStatus !== 'all') {
            fallbackQuery = fallbackQuery.where('status', '==', normalizedStatus);
          }
          snapshot = await fallbackQuery.limit(limitN + 1).get();
        } catch (fallbackError) {
          if (fallbackError?.code !== 9) throw fallbackError;
          // Last fallback: broad query and in-memory filter by status.
          let broadQuery = admin.firestore().collection('subscription-requests').orderBy('createdAt', 'desc');
          if (cursorDoc) {
            broadQuery = broadQuery.startAfter(cursorDoc);
          }
          const broadSnapshot = await broadQuery.limit((limitN + 1) * 3).get();
          const filteredDocs = normalizedStatus === 'all'
            ? broadSnapshot.docs
            : broadSnapshot.docs.filter((doc) => String(doc.data()?.status || '').toLowerCase() === normalizedStatus);
          snapshot = {
            docs: filteredDocs
          };
        }
      }

      let docs = snapshot.docs;
      const hasMore = docs.length > limitN;
      if (hasMore) {
        docs = docs.slice(0, limitN);
      }

      const userIds = [...new Set(docs.map((doc) => doc.data()?.userId).filter(Boolean))];
      const planIds = [...new Set(docs.map((doc) => doc.data()?.planId).filter(Boolean))];

      const [userDocs, planDocs] = await Promise.all([
        Promise.all(userIds.map(async (id) => {
          const docSnap = await admin.firestore().collection('users').doc(id).get();
          return [id, docSnap.exists ? docSnap.data() : null];
        })),
        Promise.all(planIds.map(async (id) => {
          const docSnap = await admin.firestore().collection('plans').doc(id).get();
          return [id, docSnap.exists ? docSnap.data() : null];
        }))
      ]);

      const userMap = new Map(userDocs);
      const planMap = new Map(planDocs);

      const requests = docs.map((doc) => {
        const data = doc.data() || {};
        const userData = userMap.get(data.userId) || null;
        const planData = planMap.get(data.planId) || null;

        return {
          id: doc.id,
          ...data,
          userName: userData?.name || userData?.fullName || 'Usuário não encontrado',
          userEmail: userData?.email || '',
          userType: userData?.userType || '',
          planName: planData?.name || data.planName || data.planId || 'Plano não encontrado',
          priceLabel: planData?.priceLabel || data.priceLabel || '',
          paymentInstructions: serializeFirestoreValue(data.paymentInstructions || null),
          paymentProof: serializeFirestoreValue(data.paymentProof || null),
          paymentStatus: data.paymentStatus || null,
          requestDate: data.requestDate ? serializeFirestoreValue(data.requestDate) : null,
          approvedDate: data.approvedDate ? serializeFirestoreValue(data.approvedDate) : null,
          rejectedDate: data.rejectedDate ? serializeFirestoreValue(data.rejectedDate) : null
        };
      });

      const nextCursorId = hasMore && docs.length > 0 ? docs[docs.length - 1].id : null;

      return res.status(200).json({
        requests,
        hasMore,
        nextCursorId
      });
    }

    return res.status(405).json({ error: 'Método não permitido' });
  } catch (error) {
    console.error('Erro ao processar requisição:', error);
    return res.status(500).json({ error: 'Erro interno do servidor' });
  }
} 
