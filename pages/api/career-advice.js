import { GoogleGenerativeAI } from '@google/generative-ai';
import { admin } from '../../lib/firebaseAdmin';
import { consumeFirestoreRateLimit } from '../../lib/firestoreRateLimit';
import { logServerError } from '../../lib/serverLog';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const MAX_HEADLINE_LENGTH = 160;

function normalizeTips(value) {
  if (!Array.isArray(value)) return [];

  return value
    .slice(0, 6)
    .map((tip, index) => ({
      id: String(tip?.id || index + 1),
      title: String(tip?.title || '')
        .trim()
        .slice(0, 100),
      description: String(tip?.description || '')
        .trim()
        .slice(0, 360),
      icon: String(tip?.icon || '💡')
        .trim()
        .slice(0, 8),
    }))
    .filter((tip) => tip.title && tip.description);
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: 'Método não permitido' });
  }

  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Inicie sessão para obter dicas.' });
    }

    let decoded;
    try {
      decoded = await admin
        .auth()
        .verifyIdToken(authHeader.slice('Bearer '.length));
    } catch (error) {
      return res.status(401).json({ error: 'A sessão já não é válida.' });
    }
    const userDoc = await admin
      .firestore()
      .collection('users')
      .doc(decoded.uid)
      .get();
    if (!userDoc.exists || userDoc.data()?.userType !== 'candidato') {
      return res
        .status(403)
        .json({ error: 'Esta funcionalidade é exclusiva para candidatos.' });
    }

    const rateLimit = await consumeFirestoreRateLimit({
      firestore: admin.firestore(),
      key: `career_advice_${decoded.uid}`,
      limit: 5,
      windowMs: 60_000,
    });
    res.setHeader('X-RateLimit-Remaining', String(rateLimit.remaining));
    if (!rateLimit.allowed) {
      res.setHeader('Retry-After', String(rateLimit.retryAfterSeconds));
      return res.status(429).json({
        error: 'Demasiados pedidos. Tente novamente dentro de um minuto.',
      });
    }

    const headline = String(req.body?.headline || '').trim();

    if (!headline || headline.length > MAX_HEADLINE_LENGTH) {
      return res.status(400).json({
        error: `A descrição profissional deve ter entre 1 e ${MAX_HEADLINE_LENGTH} caracteres.`,
      });
    }

    if (!process.env.GEMINI_API_KEY) {
      return res
        .status(200)
        .json({ tips: getDefaultTips(), source: 'default' });
    }

    const prompt = `É especialista em desenvolvimento de carreira. Com base na descrição profissional "${headline}", forneça 5 a 6 recomendações práticas e motivacionais em português europeu.

Forneça a resposta em formato JSON com este exato padrão:
{
  "tips": [
    {
      "id": "1",
      "title": "Título da dica",
      "description": "Descrição detalhada da dica",
      "icon": "🎯"
    }
  ]
}

As dicas devem ser:
- Específicas para a profissão mencionada
- Práticas e acionáveis
- Inspiradoras e motivacionais
- Em português europeu, com linguagem natural
- Com ícones emoji apropriados`;

    const model = genAI.getGenerativeModel({
      model: 'gemini-2.5-flash',
      generationConfig: {
        responseMimeType: 'application/json',
        temperature: 0.5,
      },
    });
    const result = await model.generateContent(prompt);
    const responseText = result.response.text();

    const parsedResponse = JSON.parse(responseText);
    const tips = normalizeTips(parsedResponse?.tips);
    if (tips.length < 3) {
      return res
        .status(200)
        .json({ tips: getDefaultTips(), source: 'default' });
    }

    return res.status(200).json({ tips, source: 'ai' });
  } catch (error) {
    logServerError('career_advice.gerar_dicas_de_carreira_failed', error);
    return res.status(200).json({ tips: getDefaultTips(), source: 'default' });
  }
}

function getDefaultTips() {
  return [
    {
      id: '1',
      title: 'Desenvolva as suas competências técnicas',
      description:
        'Invista em cursos e certificações relevantes para a sua área profissional.',
      icon: '📚',
    },
    {
      id: '2',
      title: 'Construa a sua rede profissional',
      description:
        'Participe em eventos e comunidades profissionais para criar relações úteis e duradouras.',
      icon: '🤝',
    },
    {
      id: '3',
      title: 'Crie um portefólio sólido',
      description:
        'Documente projetos, responsabilidades e resultados concretos para demonstrar o seu valor.',
      icon: '🎯',
    },
    {
      id: '4',
      title: 'Mantenha o perfil atualizado',
      description:
        'Atualize regularmente a experiência, as competências e a disponibilidade profissional.',
      icon: '✨',
    },
    {
      id: '5',
      title: 'Procure mentoria e feedback',
      description:
        'Peça orientação a profissionais experientes e transforme o feedback num plano de evolução.',
      icon: '🎓',
    },
    {
      id: '6',
      title: 'Aprenda ferramentas relevantes',
      description:
        'Acompanhe as competências mais procuradas e pratique-as em projetos demonstráveis.',
      icon: '💻',
    },
  ];
}
