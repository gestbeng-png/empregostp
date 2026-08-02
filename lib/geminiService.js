export async function getCareerAdvice(headline = '', token = '') {
  try {
    // Validação de entrada
    if (!headline || typeof headline !== 'string') {
      return getDefaultCareerTips();
    }

    // Fazer chamada à API de dicas de carreira
    const response = await fetch('/api/career-advice', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ headline: headline.trim() })
    });

    if (!response.ok) {
      console.error('Erro ao buscar dicas de carreira:', response.statusText);
      return getDefaultCareerTips();
    }

    const data = await response.json();
    return data.tips && Array.isArray(data.tips) ? data.tips : getDefaultCareerTips();
  } catch (error) {
    console.error('Erro ao buscar dicas de carreira:', error);
    return getDefaultCareerTips();
  }
}

function getDefaultCareerTips() {
  return [
    {
      id: '1',
      title: 'Desenvolva as suas competências técnicas',
      description: 'Invista em cursos e certificações relevantes para a sua área profissional.',
      icon: '📚'
    },
    {
      id: '2',
      title: 'Construa a sua rede profissional',
      description: 'Participe em eventos e comunidades profissionais para criar relações úteis e duradouras.',
      icon: '🤝'
    },
    {
      id: '3',
      title: 'Crie um portefólio sólido',
      description: 'Documente projetos, responsabilidades e resultados concretos para demonstrar o seu valor.',
      icon: '🎯'
    },
    {
      id: '4',
      title: 'Mantenha o perfil atualizado',
      description: 'Atualize regularmente a experiência, as competências e a disponibilidade profissional.',
      icon: '✨'
    },
    {
      id: '5',
      title: 'Procure mentoria e feedback',
      description: 'Peça orientação a profissionais experientes e transforme o feedback num plano de evolução.',
      icon: '🎓'
    },
    {
      id: '6',
      title: 'Aprenda ferramentas relevantes',
      description: 'Acompanhe as competências mais procuradas e pratique-as em projetos demonstráveis.',
      icon: '💻'
    }
  ];
}
