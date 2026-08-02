export default function CandidateVagaRedirect() {
  return null;
}

export async function getServerSideProps() {
  return {
    redirect: {
      destination: '/dashboard/candidato?tab=saved',
      permanent: false,
    },
  };
}











