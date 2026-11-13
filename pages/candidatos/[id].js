import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '../../context/AuthContext';
import Head from 'next/head';
import Image from 'next/image';
import Link from '../../components/auth/AccountActionLink';
import nookies from 'nookies';
import {
  FiArrowLeft,
  FiAward,
  FiBookOpen,
  FiBriefcase,
  FiClock,
  FiEdit3,
  FiExternalLink,
  FiFileText,
  FiGlobe,
  FiLinkedin,
  FiLock,
  FiMail,
  FiMapPin,
  FiMessageSquare,
  FiPhone,
} from 'react-icons/fi';
import PublicPageShell from '../../components/PublicPageShell';
import VerificationBadge from '../../components/VerificationBadge';
import {
  canIndexCandidateProfile,
  canViewerAccessCandidate,
  getCandidatePrivacy,
} from '../../lib/candidatePrivacy';
import { normalizeExternalUrl } from '../../lib/externalUrl';
import { buildCandidateVisibility } from '../../lib/candidateProfileInsights';
import { openCandidateCv } from '../../lib/candidateCvClient';
import { redirectToLogin } from '../../lib/loginRedirect';
import { setPrivatePageHeaders } from '../../lib/privatePageCache';
import { logServerError } from '../../lib/serverLog';
import { isUserAccountActive } from '../../lib/userStatus';
import styles from '../../styles/PublicCandidateProfilePage.module.css';

async function getViewerAccess(context, admin) {
  const baseAccess = {
    userType: 'guest',
    uid: null,
    isEmpresa: false,
    isAdmin: false,
    isOwner: false,
    canViewDetailedInfo: false,
    // Contactar pela plataforma depende só do plano; ver email/telefone/CV
    // depende do plano *e* da privacidade escolhida pelo candidato.
    canMessageCandidate: false,
    canViewContactDetails: false,
    planName: null,
  };

  try {
    const cookies = nookies.get(context);
    const token = cookies?.token;
    if (!token) return baseAccess;

    const decoded = await admin.auth().verifyIdToken(token, true);
    const userDoc = await admin
      .firestore()
      .collection('users')
      .doc(decoded.uid)
      .get();
    if (!userDoc.exists) return baseAccess;

    const userData = userDoc.data() || {};
    if (!isUserAccountActive(userData)) return baseAccess;
    if (userData.userType !== 'empresa') {
      const isAdmin = userData.userType === 'admin';
      return {
        ...baseAccess,
        uid: decoded.uid,
        userType: userData.userType || 'guest',
        isAdmin,
        canViewDetailedInfo: isAdmin,
        canMessageCandidate: isAdmin,
        canViewContactDetails: isAdmin,
      };
    }

    const { getEmpresaPlanSummary } =
      await import('../../lib/empresaPlanFeatures');
    const planSummary = getEmpresaPlanSummary(userData);
    const features = planSummary?.features || {};

    // O `baseAccess` tem de entrar aqui também: sem ele faltavam `isAdmin` e
    // `isOwner`, e o Next recusava serializar as props com um "undefined
    // cannot be serialized" assim que uma empresa abria um perfil.
    return {
      ...baseAccess,
      userType: 'empresa',
      uid: decoded.uid,
      isEmpresa: true,
      canViewDetailedInfo: Boolean(features.accessTalentPool),
      canMessageCandidate: Boolean(features.canSendDirectMessages),
      canViewContactDetails: Boolean(features.canViewCandidateContact),
      planName: planSummary?.planName || features.name || 'Básico',
    };
  } catch (error) {
    return baseAccess;
  }
}

export async function getServerSideProps(context) {
  // O mesmo URL pode incluir contactos para uma empresa/admin e ocultá-los
  // a um visitante. Nunca partilhar estas respostas entre sessões.
  setPrivatePageHeaders(context);
  try {
    const id = context.params?.id;
    if (typeof id !== 'string' || !id.trim() || id.includes('/')) {
      return { notFound: true };
    }

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
    const visibility = buildCandidateVisibility(u, p);
    const verified = visibility.verified;
    if (!verified) return { notFound: true };
    const privacy = getCandidatePrivacy(p);
    const resolvedViewerAccess = {
      ...viewerAccess,
      isOwner: viewerAccess.uid === id,
    };

    if (!canViewerAccessCandidate(privacy, resolvedViewerAccess)) {
      if (
        privacy.profileVisibility === 'recruiters' &&
        viewerAccess.userType === 'guest'
      ) {
        // O perfil existe: falta autenticar o visitante (ou restaurar o
        // cookie expirado). Não alterar a privacidade nem fingir um 404.
        return redirectToLogin(
          context.resolvedUrl || `/candidatos/${encodeURIComponent(id)}`,
        );
      }
      if (privacy.profileVisibility === 'recruiters') {
        // Sessão de candidato: um 404 parecia avaria a quem vinha dos perfis
        // verificados. Explicamos quem o pode abrir, sem enviar dados dele.
        return { props: { restricted: true } };
      }
      return { notFound: true };
    }

    const canViewDetailedInfo =
      resolvedViewerAccess.isOwner ||
      resolvedViewerAccess.isAdmin ||
      resolvedViewerAccess.canViewDetailedInfo;
    const isPrivileged =
      resolvedViewerAccess.isOwner || resolvedViewerAccess.isAdmin;

    // O botão de mensagem só depende do plano: é a mesma regra do dashboard
    // da empresa, onde `messagingLocked` ignora a privacidade do candidato.
    const canMessageCandidate =
      isPrivileged || resolvedViewerAccess.canMessageCandidate;

    // Email, telefone, links e CV são o que o candidato pode esconder. Quando
    // é ele a esconder, não faz sentido empurrar um upgrade de plano.
    const contactHiddenByCandidate = !isPrivileged && !privacy.showContactInfo;
    const canViewContactDetails =
      isPrivileged ||
      (privacy.showContactInfo && resolvedViewerAccess.canViewContactDetails);

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
    const certifications = normalizeStringList(p.certifications);

    const candidato = {
      id,
      fullName: u.fullName || u.name || p.fullName || 'Candidato',
      // O título profissional já aparece no carrossel público da home, por
      // isso não é um detalhe reservado a planos.
      headline: toPlainText(p.headline || u.headline || ''),
      photoUrl: u.photoUrl || u.photo || p.photoUrl || '',
      // O formulário do candidato grava a localização em `profiles.city`.
      // Ler apenas `p.location` deixava este campo sempre vazio.
      location:
        p.city || p.location || u.cidade || u.localizacao || u.location || '',
      bio: canViewDetailedInfo ? u.bio || u.sobre || p.bio || '' : '',
      objectiveArea: canViewDetailedInfo
        ? p.objectiveArea || u.areasInteresse?.[0] || ''
        : '',
      objectiveType: canViewDetailedInfo ? p.objectiveType || '' : '',
      objectiveAspiration: canViewDetailedInfo
        ? toPlainText(p.objectiveAspiration)
        : '',
      skills: canViewDetailedInfo ? allSkills : [],
      softSkills: canViewDetailedInfo ? softSkills : [],
      experiences: canViewDetailedInfo ? experiences : [],
      education: canViewDetailedInfo ? education : [],
      languages: canViewDetailedInfo ? languages : [],
      certifications: canViewDetailedInfo ? certifications : [],
      linkedin: canViewContactDetails ? normalizeExternalUrl(p.linkedin) : '',
      website: canViewContactDetails ? normalizeExternalUrl(p.website) : '',
      // F2.1/K1: sem selo de destaque pago.
      destaque: false,
      verified,
      verificationTypes: visibility.verificationTypes,
      verificationType: visibility.verificationType,
      paidVerified: visibility.paidVerified,
      qualifiedVerified: visibility.qualifiedVerified,
      qualificationScore: visibility.qualificationScore,
      qualificationLabel: visibility.qualificationLabel,
      // O CV nunca viaja no payload SSR: ficaria no __NEXT_DATA__ do HTML
      // como URL de leitura permanente. A página pública sinaliza apenas a
      // existência; o download passa por /api/files/candidate-cv.
      hasCv: canViewContactDetails && Boolean(p.cvUrl || u.cvUrl),
      email: canViewContactDetails ? u.email || p.email || '' : '',
      phone: canViewContactDetails ? u.phone || p.phone || '' : '',
    };

    return {
      props: {
        candidato,
        viewerAccess: {
          // `null` em vez de `undefined`: o Next só serializa JSON válido.
          userType: resolvedViewerAccess.userType || 'guest',
          isEmpresa: Boolean(resolvedViewerAccess.isEmpresa),
          isAdmin: Boolean(resolvedViewerAccess.isAdmin),
          isOwner: Boolean(resolvedViewerAccess.isOwner),
          canViewDetailedInfo: Boolean(canViewDetailedInfo),
          canMessageCandidate: Boolean(canMessageCandidate),
          canViewContactDetails: Boolean(canViewContactDetails),
          contactHiddenByCandidate: Boolean(contactHiddenByCandidate),
          planName: resolvedViewerAccess.planName || null,
        },
        allowSearchIndexing: canIndexCandidateProfile(privacy),
      },
    };
  } catch (err) {
    logServerError('candidate.public_profile_failed', err);
    // Indisponibilidade do serviço não significa que o candidato foi apagado.
    throw new Error('Não foi possível carregar o perfil. Tente novamente.');
  }
}

// "Português (nativo)" → { name: 'Português', level: 'nativo' }.
function splitLanguage(value) {
  const match = String(value).match(/^(.+?)\s*(?:\((.+)\)|[-–—:]\s*(.+))$/);
  if (!match) return { name: String(value).trim(), level: '' };
  return { name: match[1].trim(), level: (match[2] || match[3] || '').trim() };
}

function getInitials(name) {
  const parts = String(name || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (parts.length === 0) return '?';
  const first = parts[0][0];
  const last = parts.length > 1 ? parts[parts.length - 1][0] : '';
  return `${first}${last}`.toUpperCase();
}

function PublicCandidatoProfile({
  candidato,
  viewerAccess,
  allowSearchIndexing = false,
}) {
  const [cvState, setCvState] = useState({ loading: false, error: '' });
  const router = useRouter();
  const { user, sessionReady } = useAuth() || {};
  const refreshedForSession = useRef(false);

  // O servidor viu um visitante (cookie expirado), mas o browser tem sessão:
  // assim que o AuthProvider renova o cookie, recarregamos as props uma vez
  // para a página mostrar o acesso real em vez de parecer sessão perdida.
  useEffect(() => {
    if (refreshedForSession.current) return;
    if (!user || !sessionReady || viewerAccess?.userType !== 'guest') return;
    refreshedForSession.current = true;
    router.replace(router.asPath, undefined, { scroll: false });
  }, [user, sessionReady, viewerAccess?.userType, router]);

  const initials = getInitials(candidato.fullName);
  // O motivo do bloqueio muda a mensagem: sugerir um upgrade a quem já tem o
  // plano certo — e está apenas a bater na privacidade do candidato — é o que
  // fazia a página parecer avariada.
  const contactHint = !viewerAccess?.canMessageCandidate
    ? 'O contacto direto é reservado a empresas com acesso elegível ao banco de talentos.'
    : viewerAccess?.contactHiddenByCandidate
      ? 'Este candidato optou por não mostrar email, telefone e CV. Fale com ele por mensagem na plataforma.'
      : !viewerAccess?.canViewContactDetails
        ? 'O seu plano permite mensagens, mas não mostrar email, telefone e CV do candidato.'
        : '';

  // Premium primeiro nas pílulas e no cartão de verificações.
  const badgeTypes = candidato.verificationTypes?.length
    ? [...candidato.verificationTypes].sort((a, b) =>
        a === 'paid' ? -1 : b === 'paid' ? 1 : 0,
      )
    : ['paid'];

  const languages = candidato.languages.map(splitLanguage);
  const facts = [
    candidato.location && {
      icon: FiMapPin,
      label: 'Localização',
      value: candidato.location,
    },
    candidato.objectiveArea && {
      icon: FiBriefcase,
      label: 'Área de interesse',
      value: candidato.objectiveArea,
    },
    candidato.objectiveType && {
      icon: FiClock,
      label: 'Disponibilidade',
      value: candidato.objectiveType,
    },
    languages.length > 0 && {
      icon: FiGlobe,
      label: 'Idiomas',
      value: languages.map((lang) => lang.name).join(', '),
    },
  ].filter(Boolean);

  // A ação principal do cabeçalho: o dono edita, quem pode escreve, os
  // restantes veem o caminho para lá chegar.
  const primaryAction = viewerAccess?.isOwner
    ? {
        href: '/dashboard/candidato?tab=profile',
        label: 'Editar o meu perfil',
        icon: FiEdit3,
      }
    : viewerAccess?.canMessageCandidate
      ? {
          href: `/dashboard/empresa?tab=messages&candidate=${candidato.id}`,
          label: 'Enviar mensagem',
          icon: FiMessageSquare,
        }
      : viewerAccess?.isEmpresa
        ? {
            href: '/premium/empresa',
            label: 'Ver planos para contactar',
            icon: FiLock,
          }
        : {
            href: '/login?type=empresa',
            label: 'Contactar candidato',
            icon: FiMessageSquare,
          };
  const PrimaryIcon = primaryAction.icon;

  const hasContactDetails = Boolean(
    candidato.email || candidato.phone || candidato.hasCv,
  );
  const showContactPanel = hasContactDetails || Boolean(contactHint);

  const handleOpenCv = async () => {
    setCvState({ loading: true, error: '' });
    const result = await openCandidateCv(candidato.id);
    setCvState({ loading: false, error: result.success ? '' : result.error });
  };

  return (
    <>
      <Head>
        <title>{`${candidato.fullName} | Candidato — EmpregoSTP`}</title>
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
          <Link href="/verificados" className={styles.backLink}>
            <FiArrowLeft className={styles.backIcon} aria-hidden="true" />
            Candidatos verificados
          </Link>

          <header className={styles.hero}>
            <div className={styles.heroBanner} aria-hidden="true" />

            <div className={styles.heroMain}>
              <div className={styles.avatarWrap}>
                {candidato.photoUrl ? (
                  <Image
                    src={candidato.photoUrl}
                    alt={candidato.fullName}
                    className={styles.avatar}
                    width={120}
                    height={120}
                    sizes="120px"
                    unoptimized
                  />
                ) : (
                  <div className={styles.avatarFallback} aria-hidden="true">
                    {initials}
                  </div>
                )}
              </div>

              <div className={styles.identity}>
                <h1 className={styles.name}>
                  {candidato.fullName}
                  {candidato.verified && (
                    <span className={styles.nameSeal}>
                      <VerificationBadge
                        verified
                        verificationTypes={badgeTypes}
                        size="xl"
                        variant="seal"
                      />
                    </span>
                  )}
                </h1>

                {candidato.headline && (
                  <p className={styles.headline}>{candidato.headline}</p>
                )}

                {candidato.verified && (
                  <div className={styles.badgeRow}>
                    {badgeTypes.map((type) => (
                      <VerificationBadge
                        key={type}
                        verified
                        type={type}
                        size="sm"
                        variant="badge"
                      />
                    ))}
                  </div>
                )}
              </div>

              <div className={styles.heroActions}>
                <Link href={primaryAction.href} className={styles.mainAction}>
                  <PrimaryIcon aria-hidden="true" />
                  {primaryAction.label}
                </Link>
                {(candidato.linkedin || candidato.website) && (
                  <div className={styles.iconActions}>
                    {candidato.linkedin && (
                      <a
                        href={candidato.linkedin}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={styles.iconAction}
                        aria-label="LinkedIn (abre noutro separador)"
                        title="LinkedIn"
                      >
                        <FiLinkedin aria-hidden="true" />
                      </a>
                    )}
                    {candidato.website && (
                      <a
                        href={candidato.website}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={styles.iconAction}
                        aria-label="Site pessoal (abre noutro separador)"
                        title="Site pessoal"
                      >
                        <FiExternalLink aria-hidden="true" />
                      </a>
                    )}
                  </div>
                )}
              </div>
            </div>

            {facts.length > 0 && (
              <dl className={styles.facts}>
                {facts.map(({ icon: Icon, label, value }) => (
                  <div key={label} className={styles.fact}>
                    <dt className={styles.factLabel}>
                      <Icon aria-hidden="true" />
                      {label}
                    </dt>
                    <dd className={styles.factValue}>{value}</dd>
                  </div>
                ))}
              </dl>
            )}
          </header>

          <div className={styles.layout}>
            <div className={styles.mainColumn}>
              {!viewerAccess?.canViewDetailedInfo && (
                <section className={styles.lockedPanel}>
                  <span className={styles.lockedIcon} aria-hidden="true">
                    <FiLock />
                  </span>
                  <h2 className={styles.lockedTitle}>
                    Perfil completo reservado a empresas
                  </h2>
                  <p className={styles.lockedText}>
                    {viewerAccess?.isEmpresa
                      ? `O seu plano atual (${viewerAccess.planName || 'Básico'}) não inclui o percurso, as competências e a experiência deste candidato.`
                      : 'O percurso, as competências e a experiência deste candidato estão disponíveis para empresas com plano elegível.'}
                  </p>
                  <Link
                    href={
                      viewerAccess?.isEmpresa
                        ? '/premium/empresa'
                        : '/login?type=empresa'
                    }
                    className={styles.lockedLink}
                  >
                    {viewerAccess?.isEmpresa
                      ? 'Comparar planos'
                      : 'Iniciar sessão como empresa'}
                  </Link>
                </section>
              )}

              {candidato.bio && (
                <Section title="Sobre">
                  <p className={styles.text}>{candidato.bio}</p>
                </Section>
              )}

              {candidato.objectiveAspiration && (
                <Section title="Objetivo de carreira">
                  <p className={styles.text}>{candidato.objectiveAspiration}</p>
                </Section>
              )}

              {candidato.experiences.length > 0 && (
                <Section
                  title="Experiência profissional"
                  count={candidato.experiences.length}
                >
                  <ol className={styles.timeline}>
                    {candidato.experiences.map((exp, i) => (
                      <li key={i} className={styles.timelineItem}>
                        <span className={styles.orgMark} aria-hidden="true">
                          {getInitials(exp.company || exp.role)}
                        </span>
                        <div className={styles.timelineBody}>
                          {exp.role && (
                            <h3 className={styles.itemTitle}>{exp.role}</h3>
                          )}
                          {(exp.company || exp.period) && (
                            <p className={styles.itemMeta}>
                              {exp.company && (
                                <span className={styles.itemOrg}>
                                  {exp.company}
                                </span>
                              )}
                              {exp.company && exp.period && (
                                <span aria-hidden="true"> · </span>
                              )}
                              {exp.period && <span>{exp.period}</span>}
                            </p>
                          )}
                          {exp.description && (
                            <p className={styles.itemText}>{exp.description}</p>
                          )}
                        </div>
                      </li>
                    ))}
                  </ol>
                </Section>
              )}

              {candidato.education.length > 0 && (
                <Section title="Formação académica">
                  <ul className={styles.iconList}>
                    {candidato.education.map((item, i) => (
                      <li key={i} className={styles.iconListItem}>
                        <span
                          className={styles.iconListMark}
                          aria-hidden="true"
                        >
                          <FiBookOpen />
                        </span>
                        <span className={styles.iconListText}>{item}</span>
                      </li>
                    ))}
                  </ul>
                </Section>
              )}

              {candidato.certifications.length > 0 && (
                <Section title="Certificações">
                  <ul className={styles.iconList}>
                    {candidato.certifications.map((item, i) => (
                      <li key={i} className={styles.iconListItem}>
                        <span
                          className={styles.iconListMark}
                          aria-hidden="true"
                        >
                          <FiAward />
                        </span>
                        <span className={styles.iconListText}>{item}</span>
                      </li>
                    ))}
                  </ul>
                </Section>
              )}
            </div>

            <aside className={styles.sideColumn}>
              {showContactPanel && (
                <section className={styles.contactPanel}>
                  <h2 className={styles.contactTitle}>Contacto</h2>
                  {hasContactDetails && (
                    <ul className={styles.contactList}>
                      {candidato.email && (
                        <li>
                          <FiMail aria-hidden="true" />
                          <a href={`mailto:${candidato.email}`}>
                            {candidato.email}
                          </a>
                        </li>
                      )}
                      {candidato.phone && (
                        <li>
                          <FiPhone aria-hidden="true" />
                          <a
                            href={`tel:${candidato.phone.replace(/\s+/g, '')}`}
                          >
                            {candidato.phone}
                          </a>
                        </li>
                      )}
                    </ul>
                  )}
                  {candidato.hasCv && (
                    <button
                      type="button"
                      className={styles.cvAction}
                      onClick={handleOpenCv}
                      disabled={cvState.loading}
                    >
                      <FiFileText aria-hidden="true" />
                      {cvState.loading ? 'A abrir o CV…' : 'Ver currículo'}
                    </button>
                  )}
                  {cvState.error && (
                    <p className={styles.contactError} role="alert">
                      {cvState.error}
                    </p>
                  )}
                  {contactHint && (
                    <p className={styles.contactHint}>{contactHint}</p>
                  )}
                </section>
              )}

              {candidato.verified && (
                <Section title="Verificações">
                  <ul className={styles.verificationList}>
                    {badgeTypes.map((type) => (
                      <li key={type} className={styles.verificationItem}>
                        <VerificationBadge
                          verified
                          type={type}
                          size="sm"
                          variant="badge"
                        />
                        <p className={styles.verificationText}>
                          {type === 'qualified'
                            ? 'A equipa EmpregoSTP avaliou o perfil, o CV e as competências declaradas.'
                            : 'A equipa EmpregoSTP confirmou a identidade e os documentos deste candidato.'}
                        </p>
                      </li>
                    ))}
                  </ul>
                </Section>
              )}

              {(candidato.skills.length > 0 ||
                candidato.softSkills.length > 0) && (
                <Section title="Competências">
                  {candidato.skills.length > 0 && (
                    <div className={styles.tagGroup}>
                      {candidato.softSkills.length > 0 && (
                        <h3 className={styles.tagGroupTitle}>Técnicas</h3>
                      )}
                      <ul className={styles.tagList}>
                        {candidato.skills.map((skill, i) => (
                          <li key={i} className={styles.tag}>
                            {skill}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {candidato.softSkills.length > 0 && (
                    <div className={styles.tagGroup}>
                      <h3 className={styles.tagGroupTitle}>Comportamentais</h3>
                      <ul className={styles.tagList}>
                        {candidato.softSkills.map((skill, i) => (
                          <li
                            key={i}
                            className={`${styles.tag} ${styles.tagSoft}`}
                          >
                            {skill}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </Section>
              )}

              {languages.length > 0 && (
                <Section title="Idiomas">
                  <ul className={styles.languageList}>
                    {languages.map((lang, i) => (
                      <li key={i} className={styles.languageItem}>
                        <span className={styles.languageName}>{lang.name}</span>
                        {lang.level && (
                          <span className={styles.languageLevel}>
                            {lang.level}
                          </span>
                        )}
                      </li>
                    ))}
                  </ul>
                </Section>
              )}
            </aside>
          </div>
        </div>
      </PublicPageShell>
    </>
  );
}

function Section({ title, count, children }) {
  return (
    <section className={styles.panel}>
      <h2 className={styles.panelTitle}>
        {title}
        {count > 1 && <span className={styles.panelCount}>{count}</span>}
      </h2>
      {children}
    </section>
  );
}

/** Perfil existente, visível só para empresas, aberto por outra conta. */
function RestrictedCandidateProfile() {
  return (
    <>
      <Head>
        <title>Perfil reservado a empresas | EmpregoSTP</title>
        <meta name="robots" content="noindex, nofollow" />
      </Head>
      <PublicPageShell headerVariant="light">
        <div className={styles.page}>
          <Link href="/verificados" className={styles.backLink}>
            <FiArrowLeft className={styles.backIcon} aria-hidden="true" />
            Voltar aos perfis verificados
          </Link>
          <section className={styles.restrictedPanel}>
            <span className={styles.restrictedEyebrow}>Perfil reservado</span>
            <h1 className={styles.restrictedTitle}>
              Este perfil está visível apenas para empresas
            </h1>
            <p className={styles.restrictedText}>
              O candidato escolheu mostrar o percurso completo só a empresas
              registadas. Com uma conta de candidato não é possível abrir este
              perfil.
            </p>
            <div className={styles.restrictedActions}>
              <Link href="/verificados" className={styles.restrictedPrimary}>
                Ver outros perfis verificados
              </Link>
            </div>
          </section>
        </div>
      </PublicPageShell>
    </>
  );
}

export default function CandidateProfilePage(props) {
  return props.restricted ? (
    <RestrictedCandidateProfile />
  ) : (
    <PublicCandidatoProfile {...props} />
  );
}
