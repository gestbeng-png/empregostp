import { useState, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';

/**
 * Hook para gerenciar verificações de perfil
 */
export function useVerification() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const requestVerification = useCallback(async (documents, metadata = {}) => {
    if (!user) {
      setError('Utilizador não autenticado');
      return { success: false };
    }

    setLoading(true);
    setError(null);

    try {
      const token = await user.getIdToken();

      const response = await fetch('/api/verifications', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          uid: user.uid,
          documents,
          ...metadata,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Erro ao solicitar verificação');
      }

      const data = await response.json();
      return { success: true, data };
    } catch (err) {
      const errorMessage = err.message || 'Erro desconhecido';
      setError(errorMessage);
      return { success: false, error: errorMessage };
    } finally {
      setLoading(false);
    }
  }, [user]);

  const getVerificationStatus = useCallback(async (uid) => {
    if (!user) {
      setError('Utilizador não autenticado');
      return null;
    }

    setLoading(true);
    setError(null);

    try {
      const token = await user.getIdToken();
      const targetUid = uid || user.uid;

      const response = await fetch(`/api/verifications?uid=${targetUid}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Erro ao buscar status');
      }

      const data = await response.json();
      return data.verifications?.[0] || null;
    } catch (err) {
      setError(err.message);
      return null;
    } finally {
      setLoading(false);
    }
  }, [user]);

  const getAllVerifications = useCallback(async (filterStatus = null) => {
    if (!user) {
      setError('Utilizador não autenticado');
      return [];
    }

    setLoading(true);
    setError(null);

    try {
      const token = await user.getIdToken();
      const query = filterStatus ? `?status=${filterStatus}` : '';

      const response = await fetch(`/api/verifications${query}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Erro ao buscar verificações');
      }

      const data = await response.json();
      return data.verifications || [];
    } catch (err) {
      setError(err.message);
      return [];
    } finally {
      setLoading(false);
    }
  }, [user]);

  const updateVerificationStatus = useCallback(async (verificationId, status, reason = '', verificationType = null) => {
    if (!user) {
      setError('Utilizador não autenticado');
      return false;
    }

    if (!['approved', 'rejected'].includes(status)) {
      setError('Status inválido');
      return false;
    }

    setLoading(true);
    setError(null);

    try {
      const token = await user.getIdToken();

      const response = await fetch('/api/verifications', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          id: verificationId,
          status,
          reason,
          verificationType,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Erro ao atualizar verificação');
      }

      return true;
    } catch (err) {
      setError(err.message);
      return false;
    } finally {
      setLoading(false);
    }
  }, [user]);

  return {
    requestVerification,
    getVerificationStatus,
    getAllVerifications,
    updateVerificationStatus,
    loading,
    error,
  };
}
