import Head from 'next/head';
import Image from 'next/image';
import Link from 'next/link';
import nookies from 'nookies';
import {
  FiArrowLeft,
  FiCheck,
  FiGlobe,
  FiLinkedin,
  FiMapPin,
} from 'react-icons/fi';
import PublicPageShell from '../../components/PublicPageShell';
import VerificationBadge from '../../components/VerificationBadge';
import {
  canIndexCandidateProfile,
  canViewerAccessCandidate,
  getCandidatePrivacy,
} from '../../lib/candidatePrivacy';
import { normalizeExternalUrl } from '../../lib/externalUrl';
import styles from '../../styles/PublicCandidateProfilePage.module.css';

async function getViewerAccess(context, admin) {
  const baseAccess = {
    userType: 'guest',
    uid: null,
    isEmpresa: false,
    isAdmin: false,
    isOwner: false,
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
      .collection('users')
      .doc(decoded.uid)
      .get();
    if (!userDoc.exists) return baseAccess;

    const userData = userDoc.data() || {};
    if (userData.userType !== 'empresa') {
      const isAdmin = userData.userType === 'admin';
      return {
        ...baseAccess,
        uid: decoded.uid,
        userType: userData.userType || 'guest',
        isAdmin,
        canViewDetailedInfo: isAdmin,
        canContactCandidate: isAdmin,
      };
    }

    const { getEmpresaPlanSummary } =
      await import('../../lib/empresaPlanFeatures');
    const planSummary = getEmpresaPlanSummary(userData);
    const features = planSummary?.features || {};

    return {
      userType: 'empresa',
      uid: decoded.uid,
      isEmpresa: true,
      canViewDetailedInfo: Boolean(features.accessTalentPool),
      canContactCandidate: Boolean(
        features.canViewCandidateContact || features.canSendDirectMessages,
      ),
      planName: planSummary?.planName || features.name || 'Básico',
    };
  } catch (error) {
    return baseAccess;
  }
}

export async function getServerSideProps(context) {
  try {
    const { id } = context.params;

    // Import server-side only (avoid bundling admin SDK into the client build).
    const { admin } = await import('../../lib/firebaseAdmin');
    const viewerAccess = await getViewerAccess(context, admin);

    const [userDoc, profileDoc] = await Promise.all([
      admin.firestore().collection('users').doc(id).get(),
      admin.firestore().collection('profiles').doc(id).get(),
    ]);

    if (!userDoc.exists || userDoc.data().userType !== 'candidato') {
      return { notFound: true };
    }

    const u = userDoc.data();
    const p = profileDoc.exists ? profileDoc.data() : {};
    const privacy = getCandidatePrivacy(p);
    const resolvedViewerAccess = {
      ...viewerAccess,
      isOwner: viewerAccess.uid === id,
    };

    if (!canViewerAccessCandidate(privacy, resolvedViewerAccess)) {
      return { notFound: true };
    }

    const canViewDetailedInfo =
      resolvedViewerAccess.isOwner ||
      resolvedViewerAccess.isAdmin ||
      resolvedViewerAccess.canViewDetailedInfo;
    const canContactCandidate =
      resolvedViewerAccess.isOwner ||
      resolvedViewerAccess.isAdmin ||
      (privacy.showContactInfo &&
        resolvedViewerAccess.canContactCandidate);

    const toArray = (value) => {
      if (!value) return [];
      return Array.isArray(value) ? value : [value];
    };

    const toPlainText = (value) => {
      if (value === null || value === undefined) return '';
      if (typeof value === 'string') return value.trim();
      if (typeof value === 'number' || typeof value === 'boolean')
        return String(value);
      if (Array.isArray(value)) {
        return value
          .map((item) => toPlainText(item))
          .filter(Boolean)
          .join(' • ');
      }
      if (typeof value === 'object') {
        const preferred = [
          'description',
          'role',
          'company',
          'period',
          'title',
          'name',
          'value',
        ];
        const prioritizedText = preferred
          .map((key) => toPlainText(value[key]))
          .filter(Boolean);
        if (prioritizedText.length > 0) return prioritizedText.join(' • ');

        const anyText = Object.values(value)
          .map((item) => toPlainText(item))
          .filter(Boolean);
        return anyText.join(' • ');
      }
      return '';
    };

    const normalizeExperienceList = (experienceSource) => {
      return toArray(experienceSource)
        .map((entry) => {
          if (typeof entry === 'string') {
            const text = toPlainText(entry);
            return text
              ? { company: '', role: '', period: '', description: text }
              : null;
          }
          if (entry && typeof entry === 'object') {
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
      if (typeof value === 'string') {
        return value
          .split('\n')
          .map((item) => item.trim())
          .filter(Boolean);
      }
      if (typeof value === 'object') {
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
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean)
        : []),
      ...(p.digitalSkills || []),
    ].filter(Boolean);

    const softSkills = p.skillsSoft
      ? String(p.skillsSoft)
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean)
      : [];

    const experiences = normalizeExperienceList(
      p.experiences || p.experience || [],
    );
    const education = normalizeStringList(p.education);
    const languages = normalizeStringList(p.languages);

    const userVerificationStatus = String(
      u.verificationStatus || '',
    ).toLowerCase();
    const profileVerificationStatus = String(
      p.verificationStatus || '',
    ).toLowerCase();
    const verified = Boolean(
      u.verified ||
      p.verified ||
      u.verificado ||
      p.verificado ||
      u.isVerified ||
      p.isVerified ||
      userVerificationStatus === 'verified' ||
      userVerificationStatus === 'approved' ||
      profileVerificationStatus === 'verified' ||
      profileVerificationStatus === 'approved',
    );

    // Public listing should expose only verified candidates.
    if (!verified) {
      return { notFound: true };
    }

    const candidato = {
      id,
      fullName: u.fullName || u.name || p.fullName || 'Candidato',
      photoUrl: u.photoUrl || u.photo || p.photoUrl || '',
      location: u.cidade || u.localizacao || p.location || u.location || '',
      bio: canViewDetailedInfo
        ? u.bio || u.sobre || p.bio || ''
        : '',
      objectiveArea: canViewDetailedInfo
        ? p.objectiveArea || u.areasInteresse?.[0] || ''
        : '',
      objectiveType: canViewDetailedInfo
        ? p.objectiveType || ''
        : '',
      skills: canViewDetailedInfo ? allSkills : [],
      softSkills: canViewDetailedInfo ? softSkills : [],
      experiences: canViewDetailedInfo ? experiences : [],
      education: canViewDetailedInfo ? education : [],
      languages: canViewDetailedInfo ? languages : [],
      linkedin: canContactCandidate
        ? normalizeExternalUrl(p.linkedin)
        : '',
      website: canContactCandidate
        ? normalizeExternalUrl(p.website)
        : '',
      destaque: Boolean(u.destaque || u.curriculoDestacado),
      verified,
      // O CV nunca viaja no payload SSR: ficaria no __NEXT_DATA__ do HTML
      // como URL de leitura permanente. A página pública sinaliza apenas a
      // existência; o download passa por /api/files/candidate-cv.
      hasCv: canContactCandidate && Boolean(p.cvUrl || u.cvUrl),
      email: canContactCandidate ? u.email || p.email || '' : '',
      phone: canContactCandidate ? u.phone || p.phone || '' : '',
    };

    return {
      props: {
        candidato,
        viewerAccess: {
          userType: resolvedViewerAccess.userType,
          isEmpresa: resolvedViewerAccess.isEmpresa,
          isAdmin: resolvedViewerAccess.isAdmin,
          isOwner: resolvedViewerAccess.isOwner,
          canViewDetailedInfo,
          canContactCandidate,
          planName: resolvedViewerAccess.planName,
        },
        allowSearchIndexing: canIndexCandidateProfile(privacy),
      },
    };
  } catch (err) {
    console.error('Erro ao carregar perfil público:', err);
    return { notFound: true };
  }
}

export default function PublicCandidatoProfile({
  candidato,
  viewerAccess,
  allowSearchIndexing = false,
}) {
  const initials = candidato.fullName?.[0]?.toUpperCase() || '?';
  const hasMainContent = Boolean(
    candidato.bio ||
    candidato.experiences.length > 0 ||
    candidato.education.length > 0,
  );

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
        <meta
          name="robots"
          content={allowSearchIndexing ? 'index,follow' : 'noindex,nofollow'}
        />
      </Head>

      <PublicPageShell headerVariant="light">
        <div className={styles.page}>
          <Link href="/candidatos" className={styles.backLink}>
            <FiArrowLeft className={styles.backIcon} aria-hidden="true" />
            Candidatos verificados
          </Link>

          <section className={styles.heroCard}>
            <div className={styles.avatarWrap}>
              {candidato.photoUrl ? (
                <Image
                  src={candidato.photoUrl}
                  alt={candidato.fullName}
                  className={styles.avatar}
                  width={112}
                  height={112}
                  sizes="112px"
                  unoptimized
                />
              ) : (
                <div className={styles.avatarFallback}>{initials}</div>
              )}
              {candidato.verified && (
                <div className={styles.verifiedMark}>
                  <FiCheck aria-hidden="true" />
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
                      {' '}
                      · {candidato.objectiveType}
                    </span>
                  )}
                </p>
              )}

              {candidato.location && (
                <p className={styles.location}>
                  <FiMapPin aria-hidden="true" />
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
                    <FiLinkedin aria-hidden="true" />
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
                    <FiGlobe aria-hidden="true" />
                    Site
                  </a>
                )}
              </div>
            </div>
          </section>

          {!viewerAccess?.canViewDetailedInfo && (
            <div className={styles.notice}>
              {viewerAccess?.isEmpresa
                ? `O seu plano atual (${viewerAccess.planName || 'Básico'}) não permite ver informações detalhadas deste candidato.`
                : 'Informações detalhadas deste candidato são exclusivas para empresas com plano elegível.'}
            </div>
          )}

          <div
            className={`${styles.mainGrid} ${!hasMainContent ? styles.mainGridCompact : ''}`}
          >
            {hasMainContent ? (
              <div className={styles.mainColumn}>
                {candidato.bio && (
                  <Section title="Sobre">
                    <p className={styles.text}>{candidato.bio}</p>
                  </Section>
                )}

                {candidato.experiences.length > 0 && (
                  <Section title="Experiência profissional">
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
                  <Section title="Formação académica">
                    <ul className={styles.list}>
                      {candidato.education.map((item, i) => (
                        <li key={i}>{item}</li>
                      ))}
                    </ul>
                  </Section>
                )}
              </div>
            ) : null}

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
                <Section title="Competências comportamentais">
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
                  Pretende contactar este candidato?
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
                    Escolher um plano para contactar
                  </Link>
                ) : (
                  <Link href="/login?type=empresa" className={styles.ctaButton}>
                    Iniciar sessão como empresa
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
        </div>
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
