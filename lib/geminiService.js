export async function getCareerAdvice(headline = '') {
  try {
    // Validação de entrada
    if (!headline || typeof headline !== 'string') {
      return getDefaultCareerTips();
    }

    // Fazer chamada à API de dicas de carreira
    const response = await fetch('/api/career-advice', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
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
