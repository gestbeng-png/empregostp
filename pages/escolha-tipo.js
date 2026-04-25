import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import Head from "next/head";
import nookies from "nookies";
import Image from "next/image";
import { useAuth } from "../context/AuthContext";
import AuthShell from "../components/auth/AuthShell";
import styles from "../styles/EscolhaTipo.module.css";

export default function EscolhaTipoPage() {
  const router = useRouter();
  const googleQuery = Array.isArray(router.query.google)
    ? router.query.google[0]
    : router.query.google;
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [isGoogleFlow, setIsGoogleFlow] = useState(false);

  useEffect(() => {
    setIsGoogleFlow(googleQuery === "true");
  }, [googleQuery]);

  const handleTypeSelection = async (type) => {
    if (!isGoogleFlow || !user) {
      router.push(`/register?type=${type}`);
      return;
    }

    setLoading(true);
    try {
      const token = await user.getIdToken();
      nookies.set(null, "token", token, {
        maxAge: 30 * 24 * 60 * 60,
        path: "/",
        secure: process.env.NODE_ENV === "production",
      });

      const response = await fetch("/api/auth/setup-user", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          userType: type,
          fullName: user.displayName || "",
          photoUrl: user.photoURL || "",
          provider: "google",
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Erro ao configurar conta");
      }

      if (type === "empresa") {
        window.location.href = "/dashboard/empresa";
      } else {
        window.location.href = "/dashboard/candidato";
      }
    } catch (err) {
      console.error("Erro ao atualizar tipo:", err);
      setLoading(false);
      alert("Erro ao configurar conta. Tente novamente.");
    }
  };

  return (
    <>
      <Head>
        <title>Escolha seu tipo de conta - empregoSTP</title>
        <meta
          name="description"
          content="Escolha entre criar uma conta como candidato ou como empregador no empregoSTP."
        />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <AuthShell
        tone={isGoogleFlow ? "blue" : "green"}
        eyebrow={
          isGoogleFlow && user ? "Conta conectada" : "Configuração inicial"
        }
        panelTitle={
          isGoogleFlow && user
            ? "Falta só definir o tipo de conta"
            : "Escolha como quer entrar na plataforma"
        }
        panelDescription={
          isGoogleFlow && user
            ? "A sua conta Google já está ligada. Agora selecione o perfil certo para concluir a configuração."
            : "Selecione o tipo de conta que corresponde à forma como vai usar a plataforma."
        }
        chips={
          isGoogleFlow
            ? ["Google", "Candidato", "Empresa"]
            : ["Candidato", "Empresa", "Onboarding"]
        }
      >
        <div className={styles.wrapper}>
          {isGoogleFlow && user ? (
            <div className={styles.notice}>
              <h3>Conta Google conectada com sucesso</h3>
              <p>Agora escolha o tipo de conta para continuar</p>
            </div>
          ) : null}

          <div className={styles.intro}>
            <h2>Escolha o seu tipo de conta</h2>
            <p>Selecione a opção certa para continuar.</p>
          </div>

          <section className={styles.grid}>
            <article className={`${styles.panel} ${styles.candidate}`}>
              <div className={styles.visual}>
                <Image
                  src="/assets/candidate-illustration.svg"
                  alt="Ilustração de candidato"
                  width={400}
                  height={300}
                  className={styles.visualImage}
                />
              </div>

              <div className={styles.content}>
                <div className={styles.copy}>
                  <span className={styles.kicker}>Candidato</span>
                  <h3>Ser um Candidato</h3>
                  <p>
                    Crie seu perfil, envie seu currículo e candidate-se às
                    melhores vagas disponíveis em São Tomé e Príncipe. Encontre
                    a oportunidade perfeita para sua carreira.
                  </p>
                </div>

                <button
                  onClick={() => handleTypeSelection("candidato")}
                  className={styles.action}
                  disabled={loading}
                >
                  {loading ? "Aguarde..." : "INSCREVER-SE"}
                </button>
              </div>
            </article>

            <article className={`${styles.panel} ${styles.employer}`}>
              <div className={styles.visual}>
                <Image
                  src="/assets/employer-illustration.svg"
                  alt="Ilustração de empregador"
                  width={400}
                  height={300}
                  className={styles.visualImage}
                />
              </div>

              <div className={styles.content}>
                <div className={styles.copy}>
                  <span className={styles.kicker}>Empregador</span>
                  <h3>Ser um Empregador</h3>
                  <p>
                    Crie sua conta empresarial, publique vagas e encontre os
                    melhores talentos para sua empresa. Simplifique seu processo
                    de recrutamento e seleção.
                  </p>
                </div>

                <button
                  onClick={() => handleTypeSelection("empresa")}
                  className={styles.action}
                  disabled={loading}
                >
                  {loading ? "Aguarde..." : "CRIAR CONTA"}
                </button>
              </div>
            </article>
          </section>
        </div>
      </AuthShell>
    </>
  );
}
