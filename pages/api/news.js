import { admin } from '../../lib/firebaseAdmin';
import {
  safeText,
  safeTimestampToISOString,
  safeTimestampToMillis,
} from '../../lib/firestoreNormalize';
import {
  isContentVisible,
  normalizeContentStatus,
  parseContentExpiry,
} from '../../lib/contentPublication';
import { normalizeExternalUrl } from '../../lib/externalUrl';
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
        const expiry = parseContentExpiry(data.expiresAt);

        return {
          id: doc.id,
          title: safeText(data.title, 'Sem título'),
          category: safeText(data.category, 'Atualização'),
          date: safeText(
            data.date,
            createdAt ? new Date(createdAt).toLocaleDateString('pt-PT') : '',
          ),
          content: safeText(data.content, ''),
          // Links opcionais: só saem da API se forem http(s) válidos.
          siteUrl: normalizeExternalUrl(safeText(data.siteUrl, '')),
          formUrl: normalizeExternalUrl(safeText(data.formUrl, '')),
          status: normalizeContentStatus(data.status),
          // Instante exacto em que a notícia sai da timeline (vazio = sem fim).
          expiresAt: expiry ? expiry.toISOString() : '',
          createdAtMs: safeTimestampToMillis(data.createdAt),
        };
      })
      .filter((item) => isContentVisible(item))
      .sort((a, b) => (b.createdAtMs || 0) - (a.createdAtMs || 0))
      .slice(0, 5)
      .map(({ createdAtMs, ...item }) => item);

    return res.status(200).json({ news });
  } catch (error) {
    logServerError('news.fetching_news_failed', error);
    return res.status(500).json({ message: 'Erro interno do servidor' });
  }
}
