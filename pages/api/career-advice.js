import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: 'Método não permitido' });
  }

  try {
    const { headline } = req.body;

    if (!headline || typeof headline !== 'string') {
      return res.status(400).json({ error: 'Headline is required' });
    }

    if (!process.env.GEMINI_API_KEY) {
      console.error('Gemini API key not configured');
      return res.status(200).json({ tips: getDefaultTips() });
    }

    const prompt = `Você é um especialista em desenvolvimento de carreira. Com base na descrição profissional "${headline}", forneça 5-6 dicas práticas e motivacionais de carreira em português.

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
- Em português brasileira
- Com ícones emoji apropriados`;

    const model = genAI.getGenerativeModel({ model: 'gemini-pro' });
    const result = await model.generateContent(prompt);
    const responseText = result.response.text();

    // Tentar extrair JSON da resposta
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return res.status(200).json({ tips: getDefaultTips() });
    }

    const parsedResponse = JSON.parse(jsonMatch[0]);
    
    // Validar estrutura
    if (!parsedResponse.tips || !Array.isArray(parsedResponse.tips)) {
      return res.status(200).json({ tips: getDefaultTips() });
    }

    // Limitar a 6 dicas
    const tips = parsedResponse.tips.slice(0, 6);
    
    return res.status(200).json({ tips });
  } catch (error) {
    console.error('Erro ao gerar dicas de carreira:', error);
    // Retornar dicas padrão em caso de erro
    return res.status(200).json({ tips: getDefaultTips() });
  }
}

function getDefaultTips() {
  return [
    {
      id: '1',
      title: 'Desenvolva suas habilidades técnicas',
      description: 'Invista em cursos online e certificações relevantes para sua área de atuação.',
      icon: '📚'
    },
    {
      id: '2',
      title: 'Construa sua rede profissional',
      description: 'Participe de eventos, conferências e grupos de networking para expandir suas conexões.',
      icon: '🤝'
    },
    {
      id: '3',
      title: 'Crie um portfólio forte',
      description: 'Documente seus projetos e conquistas para impressionar potenciais empregadores.',
      icon: '🎯'
    },
    {
      id: '4',
      title: 'Mantenha seu perfil atualizado',
      description: 'Atualize regularmente suas informações profissionais e experiências recentes.',
      icon: '✨'
    },
    {
      id: '5',
      title: 'Busque mentoria e feedback',
      description: 'Encontre mentores na sua área para orientação e desenvolvimento profissional contínuo.',
      icon: '🎓'
    },
    {
      id: '6',
      title: 'Aprenda novas linguagens e ferramentas',
      description: 'Mantenha-se atualizado com as tecnologias mais procuradas no mercado de trabalho.',
      icon: '💻'
    }
  ];
}
