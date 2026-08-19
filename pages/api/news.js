import { admin } from '../../lib/firebaseAdmin';
import {
  safeText,
  safeTimestampToISOString,
  safeTimestampToMillis,
} from '../../lib/firestoreNormalize';
import {
  isContentPublished,
  normalizeContentStatus,
} from '../../lib/contentPublication';
import { logServerError } from '../../lib/serverLog';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({ message: 'Método não permitido' });
  }

  try {
    res.setHeader(
      'Cache-Control',
      'public, s-maxage=60, stale-while-revalidate=300',
    );

    const collectionRef = admin.firestore().collection('news');
    let snapshot;
    try {
      snapshot = await collectionRef.orderBy('createdAt', 'desc').get();
    } catch (error) {
      snapshot = await collectionRef.get();
    }

    const news = snapshot.docs
      .map((doc) => {
        const data = doc.data() || {};
        const createdAt = safeTimestampToISOString(data.createdAt);

        return {
          id: doc.id,
          title: safeText(data.title, 'Sem título'),
          category: safeText(data.category, 'Atualização'),
          date: safeText(
            data.date,
            createdAt ? new Date(createdAt).toLocaleDateString('pt-PT') : '',
          ),
          content: safeText(data.content, ''),
          status: normalizeContentStatus(data.status),
          createdAtMs: safeTimestampToMillis(data.createdAt),
        };
      })
      .filter((item) => isContentPublished(item.status))
      .sort((a, b) => (b.createdAtMs || 0) - (a.createdAtMs || 0))
      .slice(0, 5)
      .map(({ createdAtMs, ...item }) => item);

    return res.status(200).json({ news });
  } catch (error) {
    logServerError('news.fetching_news_failed', error);
    return res.status(500).json({ message: 'Erro interno do servidor' });
  }
}
