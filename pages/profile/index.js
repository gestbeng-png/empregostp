import { useEffect } from "react";
import { useRouter } from "next/router";
import Head from "next/head";
import { doc, getDoc } from "firebase/firestore";
import { useAuth } from "../../context/AuthContext";
import { db } from "../../lib/firebase";
import RedirectGate from "../../components/auth/RedirectGate";

export default function ProfileRedirect() {
  const router = useRouter();
  const { user, loading } = useAuth();

  useEffect(() => {
    async function redirectUser() {
      if (!user) {
        router.push("/login");
        return;
      }

      try {
        const userRef = doc(db, "users", user.uid);
        const userSnap = await getDoc(userRef);

        if (userSnap.exists()) {
          const userData = userSnap.data();
          const userType = userData.userType;

          if (userType === "empresa") {
            router.push("/dashboard/empresa/profile");
          } else if (userType === "candidato") {
            router.push("/dashboard/candidato");
          } else if (userType === "admin") {
            router.push("/dashboard/admin");
          } else {
            console.error("Tipo de usuário desconhecido:", userType);
            router.push("/");
          }
        } else {
          console.error("Usuário não encontrado no Firestore");
          router.push("/");
        }
      } catch (error) {
        console.error("Erro ao buscar informações do usuário:", error);
        router.push("/");
      }
    }

    if (!loading) {
      redirectUser();
    }
  }, [user, loading, router]);

  return (
    <>
      <Head>
        <title>Redirecionando - EmpregoSTP</title>
      </Head>
      <RedirectGate
        title="Redirecionando"
        description="Redirecionando para seu perfil..."
      />
    </>
  );
}
