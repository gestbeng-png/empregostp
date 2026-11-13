import { getFirebaseStorageErrorMessage } from './firebaseStorageError';

export async function submitCompetencyVerification(values) {
  const { getAuth } = await import('firebase/auth');
  const user = getAuth().currentUser;
  if (!user) throw new Error('A sessão expirou. Inicie sessão novamente.');
  let competencyDocument = null;
  if (values.proof) {
    const { ref, uploadBytes, getDownloadURL } =
      await import('firebase/storage');
    const { storage } = await import('./firebase');
    const fileRef = ref(
      storage,
      `verification/competencies/${user.uid}/${Date.now()}_${values.proof.name}`,
    );
    try {
      await uploadBytes(fileRef, values.proof);
      competencyDocument = {
        url: await getDownloadURL(fileRef),
        fileName: values.proof.name,
        label: values.proof.name,
      };
    } catch (error) {
      throw new Error(
        getFirebaseStorageErrorMessage(
          error,
          'Não foi possível enviar o comprovativo. Tente novamente.',
        ),
      );
    }
  }
  const token = await user.getIdToken();
  const response = await fetch('/api/verifications', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      uid: user.uid,
      verificationMethod: 'competencies',
      documents: {
        requestedTypes: ['competencies'],
        contact: { email: values.email, phone: values.phone },
        experienceSummary: values.experience,
        educationSummary: values.education,
        competencyNotes: values.skills,
        supportingLinks: values.links || [],
        portfolioUrl: values.portfolio || '',
        competencyDocument,
      },
    }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok)
    throw new Error(
      data.error || 'Não foi possível enviar o pedido. Tente novamente.',
    );
  return data.verification;
}
