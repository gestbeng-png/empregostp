export default function PremiumEmpresaRedirect() {
  return null;
}

export async function getServerSideProps() {
  return {
    redirect: {
      destination: '/dashboard/empresa?tab=plans',
      permanent: false
    }
  };
}
