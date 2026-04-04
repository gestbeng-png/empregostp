export default function PremiumCandidatosRedirect() {
  return null;
}

export async function getServerSideProps() {
  return {
    redirect: {
      destination: '/dashboard/candidato?tab=plans',
      permanent: false
    }
  };
}
