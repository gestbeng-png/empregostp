import { useEffect, useRef, useState } from 'react';

const jobId = (job) => job.jobId || job.vagaId || job.id;

export default function useSavedJobActions(setJobs, uid) {
  const [busyId, setBusyId] = useState('');
  const [error, setError] = useState('');
  const [removed, setRemoved] = useState(null);
  const lock = useRef(false);
  const owner = useRef(uid);
  owner.current = uid;
  useEffect(() => { setRemoved(null); setError(''); }, [uid]);

  const change = async (job, restoring = false) => {
    if (lock.current) return;
    lock.current = true;
    const expectedOwner = uid;
    const id = jobId(job);
    setBusyId(id);
    setError('');
    try {
      if (typeof navigator !== 'undefined' && navigator.onLine === false) {
        throw new Error('Precisa de ligação para alterar as vagas guardadas. Tente novamente quando estiver online.');
      }
      const { auth } = await import('../../lib/firebaseAuth');
      if (!expectedOwner || auth.currentUser?.uid !== expectedOwner) throw new Error('Inicie sessão para continuar.');
      const token = await auth.currentUser.getIdToken();
      const response = await fetch('/api/saved-jobs', {
        method: restoring ? 'POST' : 'DELETE',
        cache: 'no-store',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobId: id }),
      });
      if (!response.ok) throw new Error('Não foi possível alterar as vagas guardadas. Tente novamente.');
      if (owner.current !== expectedOwner) return;
      setJobs((current) => restoring
        ? current.some((entry) => jobId(entry) === id) ? current : [job, ...current]
        : current.filter((entry) => jobId(entry) !== id));
      setRemoved(restoring ? null : job);
    } catch (failure) {
      if (owner.current === expectedOwner) setError(failure.message || 'Não foi possível concluir o pedido. Tente novamente.');
    } finally {
      lock.current = false;
      setBusyId('');
    }
  };
  return { busyId, error, removed, remove: (job) => change(job), undo: () => removed && change(removed, true) };
}
