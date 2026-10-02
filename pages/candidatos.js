import { useRouter } from 'next/router';
import CandidateMarketPage from '../components/candidates/CandidateMarketPage';
import { getVerifiedCandidatesProps } from '../lib/verifiedCandidatesPage';

export default function CandidatosPage({ verifiedCandidates = [] }) {
  const router = useRouter();
  const market =
    router.query?.internacional !== undefined ? 'international' : 'national';

  return (
    <CandidateMarketPage
      market={market}
      verifiedCandidates={verifiedCandidates}
    />
  );
}

export const getServerSideProps = getVerifiedCandidatesProps;
