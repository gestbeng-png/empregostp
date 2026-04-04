// Sistema de Notificações Automáticas
import { getAuth } from 'firebase/auth';

async function getAuthHeaders() {
  const token = await getAuth().currentUser?.getIdToken();
  if (!token) return null;

  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`
  };
}

/**
 * Criar notificação para um usuário
 */
export async function createNotification({ userId, title, message, type = 'info', icon = '🔔', relatedId = null }) {
  try {
    const headers = await getAuthHeaders();
    if (!headers) {
      console.error('Erro ao criar notificação: usuário não autenticado');
      return false;
    }

    const response = await fetch('/api/notifications', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        userId,
        title,
        message,
        type,
        icon,
        relatedId
      })
    });

    if (!response.ok) {
      console.error('Erro ao criar notificação:', await response.text());
      return false;
    }

    console.log('✅ Notificação criada para usuário:', userId);
    return true;
  } catch (error) {
    console.error('Erro ao criar notificação:', error);
    return false;
  }
}

/**
 * Notificar sobre nova vaga
 */
export async function notifyNewJob(jobData, candidateIds) {
  const notifications = candidateIds.map(candidateId => 
    createNotification({
      userId: candidateId,
      title: 'Nova vaga disponível',
      message: `${jobData.titulo} em ${jobData.localizacao}`,
      type: 'job',
      icon: '💼',
      relatedId: jobData.id
    })
  );

  await Promise.all(notifications);
}

/**
 * Notificar candidato sobre mudança no status da candidatura
 */
export async function notifyApplicationStatus(candidateId, jobTitle, status) {
  let title, message, icon;

  if (status === 'approved') {
    title = 'Candidatura aprovada!';
    message = `Parabéns! Sua candidatura para ${jobTitle} foi aprovada.`;
    icon = '🎉';
  } else if (status === 'rejected') {
    title = 'Atualização de candidatura';
    message = `Sua candidatura para ${jobTitle} não foi selecionada desta vez.`;
    icon = '📋';
  } else if (status === 'interview') {
    title = 'Você foi selecionado para entrevista!';
    message = `Parabéns! Você foi selecionado para entrevista em ${jobTitle}.`;
    icon = '🎯';
  } else {
    title = 'Atualização de candidatura';
    message = `Sua candidatura para ${jobTitle} foi atualizada.`;
    icon = '📄';
  }

  await createNotification({
    userId: candidateId,
    title,
    message,
    type: 'application',
    icon
  });
}

/**
 * Notificar empresa sobre nova candidatura
 */
export async function notifyNewApplication(companyId, candidateName, jobTitle) {
  await createNotification({
    userId: companyId,
    title: 'Nova candidatura recebida',
    message: `${candidateName} se candidatou para ${jobTitle}`,
    type: 'application',
    icon: '👤'
  });
}


