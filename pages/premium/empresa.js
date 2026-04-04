import { useEffect, useMemo, useState } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { getAuth } from 'firebase/auth';
import nookies from 'nookies';
import LandingHeader from '../../components/LandingHeader';
import EmpresaPlansCatalog from '../../components/EmpresaPlansCatalog';
import { fetchActiveEmpresaPlans, getEmpresaPlanCatalog, serializeFirestoreValue } from '../../lib/empresaPlansCatalog';

export default function PremiumEmpresa({ plans = [], profile }) {
  const router = useRouter();
  const [loading, setLoading] = useState('');
  const [error, setError] = useState(null);
  const [paymentInstructions, setPaymentInstructions] = useState(null);
  const [pendingPaymentRequest, setPendingPaymentRequest] = useState(null);
  const [currentPlanTier, setCurrentPlanTier] = useState(profile?.planTierId || profile?.currentPlan || null);
  const [currentPlanName, setCurrentPlanName] = useState(profile?.planName || null);

  useEffect(() => {
    async function fetchPlanState() {
      try {
        const auth = getAuth();
        const user = auth.currentUser;
        if (!user) return;
        const token = await user.getIdToken();
        const [profileRes, requestRes] = await Promise.all([
          fetch('/api/profile', { headers: { Authorization: `Bearer ${token}` } }),
          fetch('/api/subscription-requests/current', { headers: { Authorization: `Bearer ${token}` } })
        ]);

        if (profileRes.ok) {
          const data = await profileRes.json();
          const userData = data.profile?.data || {};
          const tier = userData.planTierId || userData.currentPlan || null;
          if (tier) setCurrentPlanTier(tier);
          if (userData.planName) setCurrentPlanName(userData.planName);
        }

        if (requestRes.ok) {
          const requestData = await requestRes.json();
          setPendingPaymentRequest(requestData.request || null);
          setPaymentInstructions(requestData.request?.paymentInstructions || null);
        }
      } catch (err) {
        // Non-blocking: plan buttons still work.
      }
    }
    fetchPlanState();
  }, []);

  const relevantPlans = useMemo(() => getEmpresaPlanCatalog(plans), [plans]);

  const handleSubscribe = async (planId) => {
    try {
      setLoading(planId);
      setError(null);
      setPaymentInstructions(null);

      const auth = getAuth();
      const token = await auth.currentUser?.getIdToken();
      
      if (!token) {
        router.push('/login');
        return;
      }

      const res = await fetch('/api/subscribe-plan', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ planId })
      });

      let data;
      try {
        data = await res.json();
      } catch (e) {
        const text = await res.text();
        throw new Error(text || 'Erro desconhecido');
      }

      if (!res.ok) {
        // Common plan rules; keep message but don't crash the whole UI flow.
        const msg = data?.message || 'Erro ao solicitar assinatura';
        setError(msg);
        return;
      }

      if (data.status === 'approved') {
        router.push('/dashboard');
      } else if (data.status === 'awaiting_payment') {
        setPaymentInstructions(data.paymentInstructions);
        setPendingPaymentRequest({
          id: data.requestId,
          planId,
          planName: relevantPlans.find((plan) => plan.id === planId)?.name || planId,
          price: relevantPlans.find((plan) => plan.id === planId)?.price || 0,
          status: 'pending',
          paymentInstructions: data.paymentInstructions
        });
      }
    } catch (error) {
      setError(error.message || 'Erro ao processar sua solicitação');
    } finally {
      setLoading('');
    }
  };

  return (
    <>
      <Head>
        <title>Planos para Empresas - EmpregoSTP</title>
        <style>{`
          body {
            background: linear-gradient(180deg, #09090f 0%, #111827 100%);
            min-height: 100vh;
          }
        `}</style>
      </Head>
      <LandingHeader />
      <main style={{ maxWidth: 1280, margin: '0 auto', padding: '2rem 1rem 4rem', minHeight: '100vh' }}>
        <EmpresaPlansCatalog
          plans={relevantPlans}
          currentPlanId={currentPlanTier}
          currentPlanName={currentPlanName}
          loadingPlanId={loading}
          error={error}
          paymentInstructions={paymentInstructions}
          pendingPaymentRequest={pendingPaymentRequest}
          onPaymentProofSubmitted={setPendingPaymentRequest}
          onSubscribe={handleSubscribe}
        />
      </main>
    </>
  );
}

export async function getServerSideProps(context) {
  try {
    const { admin } = await import('../../lib/firebaseAdmin');
    const customPlans = await fetchActiveEmpresaPlans(admin);
    let profile = null;
    const cookies = nookies.get(context);
    if (cookies.token) {
      try {
        const token = await admin.auth().verifyIdToken(cookies.token);
        const userDoc = await admin.firestore().collection('users').doc(token.uid).get();
        if (userDoc.exists) {
          profile = serializeFirestoreValue(userDoc.data());
        }
      } catch (error) {}
    }
    return {
      props: {
        plans: customPlans,
        profile
      }
    };
  } catch (error) {
    return {
      props: {
        plans: [],
        profile: null
      }
    };
  }
} 
