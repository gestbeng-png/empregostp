import { admin } from '../../../../lib/firebaseAdmin';
import { logServerError } from '../../../../lib/serverLog';

function toDateInputIso(value) {
  if (!value) return '';
  if (value.includes('T')) return value;
  return `${value}T00:00:00.000Z`;
}

function toEndOfDayIso(value) {
  if (!value) return '';
  if (value.includes('T')) return value;
  return `${value}T23:59:59.999Z`;
}

function normalizeDateField(value) {
  if (!value) return null;
  if (typeof value?.toDate === 'function') {
    return value.toDate().toISOString();
  }
  if (value instanceof Date) {
    return value.toISOString();
  }
  if (typeof value === 'string') {
    return value;
  }
  return null;
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Método não permitido' });
  }

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
      return res.status(401).json({ message: 'Token de autorização ausente ou inválido' });
    }

    const decodedToken = await admin.auth().verifyIdToken(token);
    const adminDoc = await admin.firestore().collection('users').doc(decodedToken.uid).get();
    if (!adminDoc.exists || adminDoc.data().userType !== 'admin') {
      return res.status(403).json({ message: 'Acesso negado. Apenas administradores.' });
    }

    // Query params
    const { type, startDate, endDate, search, pageSize = '50', cursorId } = req.query;
    const limitN = Math.min(parseInt(pageSize, 10) || 50, 200);
    const startDateIso = startDate ? toDateInputIso(String(startDate)) : '';
    const endDateIso = endDate ? toEndOfDayIso(String(endDate)) : '';
    const searchText = String(search || '').trim().toLowerCase();

    const buildBaseQuery = () => {
      let q = admin.firestore().collection('activities');
      if (type && type !== 'all') {
        q = q.where('type', '==', type);
      }
      if (startDateIso) {
        q = q.where('createdAt', '>=', startDateIso);
      }
      if (endDateIso) {
        q = q.where('createdAt', '<=', endDateIso);
      }
      return q.orderBy('createdAt', 'desc');
    };

    const fallbackFilter = (docData) => {
      const normalizedCreatedAt = normalizeDateField(docData.createdAt);
      if (type && type !== 'all' && docData.type !== type) return false;
      if (startDateIso && (!normalizedCreatedAt || normalizedCreatedAt < startDateIso)) return false;
      if (endDateIso && (!normalizedCreatedAt || normalizedCreatedAt > endDateIso)) return false;
      return true;
    };

    let q;
    let isFallback = false;
    try {
      q = buildBaseQuery();
    } catch (error) {
      isFallback = true;
      q = admin.firestore().collection('activities').orderBy('createdAt', 'desc');
    }

    let cursorDoc = null;
    if (cursorId) {
      const cursorSnap = await admin.firestore().collection('activities').doc(String(cursorId)).get();
      if (cursorSnap.exists) {
        cursorDoc = cursorSnap;
        q = q.startAfter(cursorSnap);
      }
    }

    let snapshot;
    try {
      snapshot = await q.limit(limitN + 1).get();
    } catch (error) {
      // Composite index may not exist yet. Fallback to broad query and filter in-memory.
      if (error?.code !== 9) throw error;
      isFallback = true;
      let fallbackQuery = admin.firestore().collection('activities').orderBy('createdAt', 'desc');
      if (cursorDoc) {
        fallbackQuery = fallbackQuery.startAfter(cursorDoc);
      }
      snapshot = await fallbackQuery.limit((limitN + 1) * 3).get();
    }

    let rawDocs = snapshot.docs;
    if (isFallback) {
      rawDocs = rawDocs.filter((doc) => fallbackFilter(doc.data() || {}));
    }

    let hasMore = rawDocs.length > limitN;
    if (hasMore) {
      rawDocs = rawDocs.slice(0, limitN);
    }

    let activities = rawDocs.map((doc) => {
      const data = doc.data() || {};
      return {
        id: doc.id,
        type: data.type || '',
        description: data.description || '',
        userId: data.userId || null,
        adminId: data.adminId || null,
        createdAt: normalizeDateField(data.createdAt),
        meta: data.meta || null
      };
    });

    if (searchText) {
      activities = activities.filter((a) =>
        (a.description && a.description.toLowerCase().includes(searchText)) ||
        (a.type && a.type.toLowerCase().includes(searchText)) ||
        (a.userId && a.userId.toLowerCase().includes(searchText)) ||
        (a.adminId && a.adminId.toLowerCase().includes(searchText))
      );
      // With free-text filtering the backend cannot accurately paginate without full scan.
      hasMore = false;
    }

    // Enrich with user and admin names
    const uids = new Set();
    activities.forEach(a => {
      if (a.userId) uids.add(a.userId);
      if (a.adminId) uids.add(a.adminId);
    });

    const userMap = {};
    if (uids.size > 0) {
      await Promise.all(
        [...uids].map(async uid => {
          try {
            const userDoc = await admin.firestore().collection('users').doc(uid).get();
            if (userDoc.exists) {
              const d = userDoc.data();
              userMap[uid] = d.name || d.fullName || d.email || uid;
            }
          } catch (_) {}
        })
      );
    }

    activities = activities.map(a => ({
      ...a,
      userName: a.userId ? (userMap[a.userId] || a.userId) : null,
      adminName: a.adminId ? (userMap[a.adminId] || a.adminId) : null,
    }));

    // Activity type counts for stats
    const typeCounts = {};
    activities.forEach(a => {
      typeCounts[a.type] = (typeCounts[a.type] || 0) + 1;
    });

    let total = null;
    if (!searchText) {
      try {
        const countQuery = isFallback ? null : buildBaseQuery();
        if (!countQuery) {
          total = activities.length;
        } else {
          const agg = await countQuery.count().get();
          total = Number(agg.data()?.count || 0);
        }
      } catch (_) {
        total = activities.length;
      }
    } else {
      total = activities.length;
    }

    const nextCursorId = hasMore && rawDocs.length > 0 ? rawDocs[rawDocs.length - 1].id : null;

    return res.status(200).json({
      activities,
      total,
      typeCounts,
      hasMore,
      nextCursorId
    });
  } catch (error) {
    logServerError('admin_activities.buscar_atividades_failed', error);
    return res.status(500).json({ message: 'Erro interno do servidor', error: error.message });
  }
}
