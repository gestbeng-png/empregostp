import CandidateMarketPage from '../../components/candidates/CandidateMarketPage';
import { getVerifiedCandidatesProps } from '../../lib/verifiedCandidatesPage';

export default function CandidatosNacionaisPage({ verifiedCandidates = [] }) {
  return (
    <CandidateMarketPage
      market="national"
      verifiedCandidates={verifiedCandidates}
    />
  );
}

export const getServerSideProps = getVerifiedCandidatesProps;
