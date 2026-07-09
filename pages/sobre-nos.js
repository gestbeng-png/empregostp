import Head from 'next/head';
import Image from 'next/image';
import Link from 'next/link';
import {
  FiBriefcase,
  FiFeather,
  FiTrendingUp,
  FiUser,
} from 'react-icons/fi';
import PublicPageShell from '../components/PublicPageShell';
import styles from '../styles/SobreNosPage.module.css';

const TEAM = [
  {
    name: 'Edmir dos Santos',
    role: 'Engenheiro Físico e Programador',
    description:
      'Lidera a visão tecnológica do Emprego STP, unindo engenharia, produto e programação para construir uma plataforma simples, útil e preparada para crescer.',
    image: '/assets/imagens/edmir.jpeg',
    imagePosition: 'center center',
  },
  {
    name: 'Joel Almeida',
    role: 'Gestor',
    description:
      'Acompanha a organização operacional e a relação com parceiros, ajudando a transformar necessidades reais em processos claros para candidatos e empresas.',
    image: '/assets/imagens/joel.jpeg',
    imagePosition: 'center center',
  },
  {
    name: 'Mauro Viegas',
    role: 'Gestor',
    description:
      'Contribui para a gestão estratégica da plataforma, com foco em crescimento, credibilidade e criação de valor para o mercado de trabalho nacional.',
    image: '/assets/imagens/mauro.jpeg',
    imagePosition: 'center top',
  },
];

const COMMUNITY = [
  {
    title: 'Candidatos',
    description: 'Perfis, candidaturas e crescimento profissional',
    Icon: FiUser,
  },
  {
    title: 'Empresas',
    description: 'Vagas, triagem e recrutamento com confiança',
    Icon: FiBriefcase,
  },
  {
    title: 'Comunidade',
    description: 'Respeito, entreajuda e oportunidades para todos',
    Icon: FiFeather,
  },
  {
    title: 'Futuro',
    description: 'Cada vaga, uma árvore e um compromisso com o país',
    Icon: FiTrendingUp,
  },
];

export default function SobreNos() {
  return (
    <>
      <Head>
        <title>Sobre o Emprego STP</title>
        <meta
          name="description"
          content="Conheça a missão, visão e valores que guiam o Emprego STP."
        />
      </Head>

      <PublicPageShell>
        <main className={styles.page}>
          <section className={styles.hero}>
            <div className={styles.container}>
              <p className={styles.eyebrow}>Sobre o Emprego STP</p>
              <h1 className={styles.heroTitle}>
                Oportunidades reais, acessíveis e humanas
              </h1>
              <p className={styles.heroText}>
                Conheça a missão, visão e valores que guiam o Emprego STP.
              </p>

              <div className={styles.heroActions}>
                <Link href="/vagas" className={`${styles.button} ${styles.buttonPrimary}`}>
                  Pesquisar vagas
                </Link>
                <Link href="/empresas" className={`${styles.button} ${styles.buttonLight}`}>
                  Para empresas
                </Link>
                <Link href="/register" className={`${styles.button} ${styles.buttonSoft}`}>
                  Junte-se a nós
                </Link>
              </div>
            </div>
          </section>

          <section className={styles.mottoSection}>
            <div className={styles.container}>
              <div className={styles.mottoCopy}>
                <p className={styles.mottoEyebrow}>O nosso lema</p>
                <h2>&ldquo;Cada vaga, uma árvore.&rdquo;</h2>
                <p>
                  Acreditamos que progresso não é só ganhar mais. É cuidar melhor. Por isso, a cada vaga
                  publicada, assumimos um compromisso com o futuro. Transformar oportunidades em impacto real.
                  Para as pessoas e para o ambiente.
                </p>
              </div>
            </div>
          </section>

          <section className={styles.teamSection} aria-labelledby="team-title">
            <div className={styles.container}>
              <div className={styles.teamHeader}>
                <div>
                  <p className={styles.blueEyebrow}>A nossa equipa</p>
                  <h2 id="team-title">Pessoas focadas em aproximar talento e oportunidade</h2>
                </div>
                <Link href="/register" className={`${styles.button} ${styles.buttonPrimary}`}>
                  Junte-se a nós
                </Link>
              </div>

              <div className={styles.teamGrid}>
                {TEAM.map((member) => (
                  <article key={member.name} className={styles.teamCard}>
                    <div className={styles.teamAvatar}>
                      <Image
                        src={member.image}
                        alt={member.name}
                        fill
                        sizes="(max-width: 900px) 160px, 192px"
                        style={{ objectPosition: member.imagePosition }}
                      />
                    </div>
                    <div className={styles.teamBody}>
                      <h3>{member.name}</h3>
                      <strong>{member.role}</strong>
                      <p>{member.description}</p>
                    </div>
                  </article>
                ))}
              </div>
            </div>
          </section>

          <section className={styles.communitySection} aria-labelledby="community-title">
            <div className={styles.container}>
              <div className={styles.leftIntro}>
                <h2 id="community-title">A nossa comunidade</h2>
                <p>
                  Queremos aproximar quem precisa de trabalhar de quem precisa de contratar, com tecnologia
                  simples e uma comunidade que se ajuda.
                </p>
              </div>

              <div className={styles.communityList}>
                {COMMUNITY.map(({ title, description, Icon }) => (
                  <article key={title} className={styles.communityRow}>
                    <span className={styles.communityIcon} aria-hidden="true">
                      <Icon />
                    </span>
                    <div>
                      <h3>{title}</h3>
                      <p>{description}</p>
                    </div>
                  </article>
                ))}
              </div>
            </div>
          </section>
        </main>
      </PublicPageShell>
    </>
  );
}
