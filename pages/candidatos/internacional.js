import CandidateMarketPage from '../../components/candidates/CandidateMarketPage';
import { getVerifiedCandidatesProps } from '../../lib/verifiedCandidatesPage';

export default function CandidatosInternacionaisPage({
  verifiedCandidates = [],
}) {
  return (
    <CandidateMarketPage
      market="international"
      verifiedCandidates={verifiedCandidates}
    />
  );
}

export const getServerSideProps = getVerifiedCandidatesProps;
