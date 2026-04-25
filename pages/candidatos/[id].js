import Head from "next/head";
import Link from "next/link";
import nookies from "nookies";
import PublicPageShell from "../../components/PublicPageShell";
import VerificationBadge from "../../components/VerificationBadge";
import styles from "../../styles/PublicCandidateProfilePage.module.css";

async function getViewerAccess(context, admin) {
  const baseAccess = {
    userType: "guest",
    isEmpresa: false,
    canViewDetailedInfo: false,
    canContactCandidate: false,
    planName: null,
  };

  try {
    const cookies = nookies.get(context);
    const token = cookies?.token;
    if (!token) return baseAccess;

    const decoded = await admin.auth().verifyIdToken(token);
    const userDoc = await admin
      .firestore()
      .collection("users")
      .doc(decoded.uid)
      .get();
    if (!userDoc.exists) return baseAccess;

    const userData = userDoc.data() || {};
    if (userData.userType !== "empresa") {
      return { ...baseAccess, userType: userData.userType || "guest" };
    }

    const { getEmpresaPlanSummary } =
      await import("../../lib/empresaPlanFeatures");
    const planSummary = getEmpresaPlanSummary(userData);
    const features = planSummary?.features || {};

    return {
      userType: "empresa",
      isEmpresa: true,
      canViewDetailedInfo: Boolean(features.accessTalentPool),
      canContactCandidate: Boolean(
        features.canViewCandidateContact || features.canSendDirectMessages,
      ),
      planName: planSummary?.planName || features.name || "Básico",
    };
  } catch (error) {
    return baseAccess;
  }
}

export async function getServerSideProps(context) {
  try {
    const { id } = context.params;

    // Import server-side only (avoid bundling admin SDK into the client build).
    const { admin } = await import("../../lib/firebaseAdmin");
    const viewerAccess = await getViewerAccess(context, admin);

    const [userDoc, profileDoc] = await Promise.all([
      admin.firestore().collection("users").doc(id).get(),
      admin.firestore().collection("profiles").doc(id).get(),
    ]);

    if (!userDoc.exists || userDoc.data().userType !== "candidato") {
      return { notFound: true };
    }

    const u = userDoc.data();
    const p = profileDoc.exists ? profileDoc.data() : {};

    const toArray = (value) => {
      if (!value) return [];
      return Array.isArray(value) ? value : [value];
    };

    const toPlainText = (value) => {
      if (value === null || value === undefined) return "";
      if (typeof value === "string") return value.trim();
      if (typeof value === "number" || typeof value === "boolean")
        return String(value);
      if (Array.isArray(value)) {
        return value
          .map((item) => toPlainText(item))
          .filter(Boolean)
          .join(" • ");
      }
      if (typeof value === "object") {
        const preferred = [
          "description",
          "role",
          "company",
          "period",
          "title",
          "name",
          "value",
        ];
        const prioritizedText = preferred
          .map((key) => toPlainText(value[key]))
          .filter(Boolean);
        if (prioritizedText.length > 0) return prioritizedText.join(" • ");

        const anyText = Object.values(value)
          .map((item) => toPlainText(item))
          .filter(Boolean);
        return anyText.join(" • ");
      }
      return "";
    };

    const normalizeExperienceList = (experienceSource) => {
      return toArray(experienceSource)
        .map((entry) => {
          if (typeof entry === "string") {
            const text = toPlainText(entry);
            return text
              ? { company: "", role: "", period: "", description: text }
              : null;
          }
          if (entry && typeof entry === "object") {
            const company = toPlainText(entry.company || entry.empresa);
            const role = toPlainText(entry.role || entry.cargo || entry.title);
            const period = toPlainText(
              entry.period || entry.periodo || entry.dateRange,
            );
            const description = toPlainText(
              entry.description || entry.resumo || entry.details || entry,
            );
            if (!company && !role && !period && !description) return null;
            return { company, role, period, description };
          }
          return null;
        })
        .filter(Boolean);
    };

    const normalizeStringList = (value) => {
      if (!value) return [];
      if (Array.isArray(value)) {
        return value.map((item) => toPlainText(item)).filter(Boolean);
      }
      if (typeof value === "string") {
        return value
          .split("\n")
          .map((item) => item.trim())
          .filter(Boolean);
      }
      if (typeof value === "object") {
        return Object.values(value)
          .map((item) => toPlainText(item))
          .filter(Boolean);
      }
      return [];
    };

    const allSkills = [
      ...(u.skills || []),
      ...(p.skillsHard
        ? String(p.skillsHard)
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean)
        : []),
      ...(p.digitalSkills || []),
    ].filter(Boolean);

    const softSkills = p.skillsSoft
      ? String(p.skillsSoft)
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean)
      : [];

    const experiences = normalizeExperienceList(
      p.experiences || p.experience || [],
    );
    const education = normalizeStringList(p.education);
    const languages = normalizeStringList(p.languages);

    const userVerificationStatus = String(
      u.verificationStatus || "",
    ).toLowerCase();
    const profileVerificationStatus = String(
      p.verificationStatus || "",
    ).toLowerCase();
    const verified = Boolean(
      u.verified ||
      p.verified ||
      u.verificado ||
      p.verificado ||
      u.isVerified ||
      p.isVerified ||
      userVerificationStatus === "verified" ||
      userVerificationStatus === "approved" ||
      profileVerificationStatus === "verified" ||
      profileVerificationStatus === "approved",
    );

    // Public listing should expose only verified candidates.
    if (!verified) {
      return { notFound: true };
    }

    const candidato = {
      id,
      fullName: u.fullName || u.name || p.fullName || "Candidato",
      photoUrl: u.photoUrl || u.photo || p.photoUrl || "",
      location: u.cidade || u.localizacao || p.location || u.location || "",
      bio: viewerAccess.canViewDetailedInfo
        ? u.bio || u.sobre || p.bio || ""
        : "",
      objectiveArea: viewerAccess.canViewDetailedInfo
        ? p.objectiveArea || u.areasInteresse?.[0] || ""
        : "",
      objectiveType: viewerAccess.canViewDetailedInfo
        ? p.objectiveType || ""
        : "",
      skills: viewerAccess.canViewDetailedInfo ? allSkills : [],
      softSkills: viewerAccess.canViewDetailedInfo ? softSkills : [],
      experiences: viewerAccess.canViewDetailedInfo ? experiences : [],
      education: viewerAccess.canViewDetailedInfo ? education : [],
      languages: viewerAccess.canViewDetailedInfo ? languages : [],
      linkedin: viewerAccess.canViewDetailedInfo ? p.linkedin || "" : "",
      website: viewerAccess.canViewDetailedInfo ? p.website || "" : "",
      destaque: Boolean(u.destaque || u.curriculoDestacado),
      verified,
      cvUrl: viewerAccess.canViewDetailedInfo ? p.cvUrl || u.cvUrl || "" : "",
      email: viewerAccess.canContactCandidate ? u.email || p.email || "" : "",
      phone: viewerAccess.canContactCandidate ? u.phone || p.phone || "" : "",
    };

    return { props: { candidato, viewerAccess } };
  } catch (err) {
    console.error("Erro ao carregar perfil público:", err);
    return { notFound: true };
  }
}

export default function PublicCandidatoProfile({ candidato, viewerAccess }) {
  const initials = candidato.fullName?.[0]?.toUpperCase() || "?";

  return (
    <>
      <Head>
        <title>{candidato.fullName} | Candidato — EmpregoSTP</title>
        <meta
          name="description"
          content={
            candidato.bio ||
            `Perfil profissional de ${candidato.fullName} em São Tomé e Príncipe.`
          }
        />
      </Head>

      <PublicPageShell headerVariant="light">
        <main className={styles.page}>
          <Link href="/candidatos" className={styles.backLink}>
            <svg
              className={styles.backIcon}
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M19 12H5M12 19l-7-7 7-7" />
            </svg>
            Candidatos Verificados
          </Link>

          <section className={styles.heroCard}>
            <div className={styles.avatarWrap}>
              {candidato.photoUrl ? (
                <img
                  src={candidato.photoUrl}
                  alt={candidato.fullName}
                  className={styles.avatar}
                />
              ) : (
                <div className={styles.avatarFallback}>{initials}</div>
              )}
              {candidato.verified && (
                <div className={styles.verifiedMark}>
                  <svg viewBox="0 0 24 24" fill="white">
                    <polyline
                      points="20 6 9 17 4 12"
                      strokeWidth="3"
                      stroke="white"
                      fill="none"
                    />
                  </svg>
                </div>
              )}
            </div>

            <div className={styles.heroBody}>
              <div className={styles.titleRow}>
                <h1 className={styles.title}>{candidato.fullName}</h1>
                {candidato.verified && (
                  <VerificationBadge
                    verified={true}
                    size="md"
                    variant="badge"
                  />
                )}
                {candidato.destaque && (
                  <span className={styles.highlightBadge}>Destaque</span>
                )}
              </div>

              {candidato.objectiveArea && (
                <p className={styles.objective}>
                  {candidato.objectiveArea}
                  {candidato.objectiveType && (
                    <span className={styles.objectiveType}>
                      {" "}
                      · {candidato.objectiveType}
                    </span>
                  )}
                </p>
              )}

              {candidato.location && (
                <p className={styles.location}>
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z" />
                    <circle cx="12" cy="10" r="3" />
                  </svg>
                  {candidato.location}
                </p>
              )}

              <div className={styles.socialLinks}>
                {candidato.linkedin && (
                  <a
                    href={candidato.linkedin}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={styles.socialLink}
                  >
                    <svg viewBox="0 0 24 24" fill="currentColor">
                      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
                    </svg>
                    LinkedIn
                  </a>
                )}
                {candidato.website && (
                  <a
                    href={candidato.website}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={styles.socialLink}
                  >
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <circle cx="12" cy="12" r="10" />
                      <line x1="2" y1="12" x2="22" y2="12" />
                      <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
                    </svg>
                    Website
                  </a>
                )}
              </div>
            </div>
          </section>

          {!viewerAccess?.canViewDetailedInfo && (
            <div className={styles.notice}>
              {viewerAccess?.isEmpresa
                ? `Seu plano atual (${viewerAccess.planName || "Básico"}) não permite ver informações detalhadas deste candidato.`
                : "Informações detalhadas deste candidato são exclusivas para empresas com plano elegível."}
            </div>
          )}

          <div className={styles.mainGrid}>
            <div className={styles.mainColumn}>
              {candidato.bio && (
                <Section title="Sobre">
                  <p className={styles.text}>{candidato.bio}</p>
                </Section>
              )}

              {candidato.experiences.length > 0 && (
                <Section title="Experiência Profissional">
                  <div className={styles.experienceList}>
                    {candidato.experiences.map((exp, i) => (
                      <div key={i} className={styles.experienceItem}>
                        {exp.role && (
                          <p className={styles.experienceRole}>{exp.role}</p>
                        )}
                        {exp.company && (
                          <p className={styles.experienceCompany}>
                            {exp.company}
                          </p>
                        )}
                        {exp.period && (
                          <p className={styles.experiencePeriod}>
                            {exp.period}
                          </p>
                        )}
                        {exp.description && (
                          <p className={styles.experienceDescription}>
                            {exp.description}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </Section>
              )}

              {candidato.education.length > 0 && (
                <Section title="Formação Académica">
                  <ul className={styles.list}>
                    {candidato.education.map((item, i) => (
                      <li key={i}>{item}</li>
                    ))}
                  </ul>
                </Section>
              )}
            </div>

            <div className={styles.sideColumn}>
              {candidato.skills.length > 0 && (
                <Section title="Competências">
                  <div className={styles.chipList}>
                    {candidato.skills.map((skill, i) => (
                      <span key={i} className={styles.chip}>
                        {skill}
                      </span>
                    ))}
                  </div>
                </Section>
              )}

              {candidato.softSkills.length > 0 && (
                <Section title="Soft Skills">
                  <div className={styles.chipList}>
                    {candidato.softSkills.map((skill, i) => (
                      <span
                        key={i}
                        className={`${styles.chip} ${styles.chipAlt}`}
                      >
                        {skill}
                      </span>
                    ))}
                  </div>
                </Section>
              )}

              {candidato.languages.length > 0 && (
                <Section title="Idiomas">
                  <ul className={styles.list}>
                    {candidato.languages.map((lang, i) => (
                      <li key={i}>{lang}</li>
                    ))}
                  </ul>
                </Section>
              )}

              <div className={styles.ctaCard}>
                <p className={styles.ctaText}>
                  Interessado em contratar este candidato?
                </p>
                {viewerAccess?.canContactCandidate ? (
                  <>
                    <Link
                      href={`/dashboard/empresa?tab=messages&candidate=${candidato.id}`}
                      className={styles.ctaButton}
                    >
                      Entrar em contacto
                    </Link>
                    {(candidato.email || candidato.phone) && (
                      <div className={styles.ctaContact}>
                        {candidato.email && <div>Email: {candidato.email}</div>}
                        {candidato.phone && (
                          <div>Telefone: {candidato.phone}</div>
                        )}
                      </div>
                    )}
                  </>
                ) : viewerAccess?.isEmpresa ? (
                  <Link href="/premium/empresa" className={styles.ctaButton}>
                    Fazer upgrade para contactar
                  </Link>
                ) : (
                  <Link href="/login?type=empresa" className={styles.ctaButton}>
                    Entrar como Empresa
                  </Link>
                )}
                {!viewerAccess?.canContactCandidate ? (
                  <p className={styles.ctaHint}>
                    O contacto direto é reservado a empresas com acesso elegível
                    ao banco de talentos.
                  </p>
                ) : null}
              </div>
            </div>
          </div>
        </main>
      </PublicPageShell>
    </>
  );
}

function Section({ title, children }) {
  return (
    <section className={styles.card}>
      <h2 className={styles.cardTitle}>{title}</h2>
      {children}
    </section>
  );
}
