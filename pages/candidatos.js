import { useRouter } from "next/router";
import CandidateMarketPage from "../components/candidates/CandidateMarketPage";

export default function CandidatosPage() {
  const router = useRouter();
  const market =
    router.query?.internacional !== undefined ? "international" : "national";

  return <CandidateMarketPage market={market} />;
}
