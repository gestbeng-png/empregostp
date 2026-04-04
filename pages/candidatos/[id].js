import Head from 'next/head';
import Link from 'next/link';
import nookies from 'nookies';
import LandingHeader from '../../components/LandingHeader';
import Footer from '../../components/home/Footer';
import VerificationBadge from '../../components/VerificationBadge';

async function getViewerAccess(context, admin) {
  const baseAccess = {
    userType: 'guest',
    isEmpresa: false,
    canViewDetailedInfo: false,
    canContactCandidate: false,
    planName: null
  };

  try {
    const cookies = nookies.get(context);
    const token = cookies?.token;
    if (!token) return baseAccess;

    const decoded = await admin.auth().verifyIdToken(token);
    const userDoc = await admin.firestore().collection('users').doc(decoded.uid).get();
    if (!userDoc.exists) return baseAccess;

    const userData = userDoc.data() || {};
    if (userData.userType !== 'empresa') {
      return { ...baseAccess, userType: userData.userType || 'guest' };
    }

    const { getEmpresaPlanSummary } = await import('../../lib/empresaPlanFeatures');
    const planSummary = getEmpresaPlanSummary(userData);
    const features = planSummary?.features || {};

    return {
      userType: 'empresa',
      isEmpresa: true,
      canViewDetailedInfo: Boolean(features.accessTalentPool),
      canContactCandidate: Boolean(features.canViewCandidateContact || features.canSendDirectMessages),
      planName: planSummary?.planName || features.name || 'Básico'
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

    const toArray = (value) => {
      if (!value) return [];
      return Array.isArray(value) ? value : [value];
    };

    const toPlainText = (value) => {
      if (value === null || value === undefined) return '';
      if (typeof value === 'string') return value.trim();
      if (typeof value === 'number' || typeof value === 'boolean') return String(value);
      if (Array.isArray(value)) {
        return value.map((item) => toPlainText(item)).filter(Boolean).join(' • ');
      }
      if (typeof value === 'object') {
        const preferred = ['description', 'role', 'company', 'period', 'title', 'name', 'value'];
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
            return text ? { company: '', role: '', period: '', description: text } : null;
          }
          if (entry && typeof entry === 'object') {
            const company = toPlainText(entry.company || entry.empresa);
            const role = toPlainText(entry.role || entry.cargo || entry.title);
            const period = toPlainText(entry.period || entry.periodo || entry.dateRange);
            const description = toPlainText(entry.description || entry.resumo || entry.details || entry);
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
        return Object.values(value).map((item) => toPlainText(item)).filter(Boolean);
      }
      return [];
    };

    const allSkills = [
      ...(u.skills || []),
      ...(p.skillsHard ? String(p.skillsHard).split(',').map(s => s.trim()).filter(Boolean) : []),
      ...(p.digitalSkills || []),
    ].filter(Boolean);

    const softSkills = p.skillsSoft
      ? String(p.skillsSoft).split(',').map(s => s.trim()).filter(Boolean)
      : [];

    const experiences = normalizeExperienceList(p.experiences || p.experience || []);
    const education = normalizeStringList(p.education);
    const languages = normalizeStringList(p.languages);

    const userVerificationStatus = String(u.verificationStatus || '').toLowerCase();
    const profileVerificationStatus = String(p.verificationStatus || '').toLowerCase();
    const verified = Boolean(
      u.verified || p.verified ||
      u.verificado || p.verificado ||
      u.isVerified || p.isVerified ||
      userVerificationStatus === 'verified' ||
      userVerificationStatus === 'approved' ||
      profileVerificationStatus === 'verified' ||
      profileVerificationStatus === 'approved'
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
      bio: viewerAccess.canViewDetailedInfo ? (u.bio || u.sobre || p.bio || '') : '',
      objectiveArea: viewerAccess.canViewDetailedInfo ? (p.objectiveArea || u.areasInteresse?.[0] || '') : '',
      objectiveType: viewerAccess.canViewDetailedInfo ? (p.objectiveType || '') : '',
      skills: viewerAccess.canViewDetailedInfo ? allSkills : [],
      softSkills: viewerAccess.canViewDetailedInfo ? softSkills : [],
      experiences: viewerAccess.canViewDetailedInfo ? experiences : [],
      education: viewerAccess.canViewDetailedInfo ? education : [],
      languages: viewerAccess.canViewDetailedInfo ? languages : [],
      linkedin: viewerAccess.canViewDetailedInfo ? (p.linkedin || '') : '',
      website: viewerAccess.canViewDetailedInfo ? (p.website || '') : '',
      destaque: Boolean(u.destaque || u.curriculoDestacado),
      verified,
      cvUrl: viewerAccess.canViewDetailedInfo ? (p.cvUrl || u.cvUrl || '') : '',
      email: viewerAccess.canContactCandidate ? (u.email || p.email || '') : '',
      phone: viewerAccess.canContactCandidate ? (u.phone || p.phone || '') : '',
    };

    return { props: { candidato, viewerAccess } };
  } catch (err) {
    console.error('Erro ao carregar perfil público:', err);
    return { notFound: true };
  }
}

export default function PublicCandidatoProfile({ candidato, viewerAccess }) {
  const initials = candidato.fullName?.[0]?.toUpperCase() || '?';

  return (
    <>
      <Head>
        <title>{candidato.fullName} | Candidato — EmpregoSTP</title>
        <meta name="description" content={candidato.bio || `Perfil profissional de ${candidato.fullName} em São Tomé e Príncipe.`} />
      </Head>

      <div style={{ minHeight: '100vh', backgroundColor: '#0a0a0f' }}>
        <LandingHeader />

        <main style={{ maxWidth: '960px', margin: '0 auto', padding: '2.5rem 1.5rem' }}>

          {/* Back */}
          <Link href="/candidatos" style={{
            display: 'inline-flex', alignItems: 'center', gap: '0.4rem',
            color: '#10b981', textDecoration: 'none', fontWeight: 600,
            fontSize: '0.9rem', marginBottom: '2rem',
          }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M19 12H5M12 19l-7-7 7-7" />
            </svg>
            Candidatos Verificados
          </Link>

          {/* Profile Header */}
          <div style={{
            background: 'rgba(255,255,255,0.03)',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: '20px',
            padding: '2rem',
            marginBottom: '1.5rem',
            display: 'flex',
            gap: '2rem',
            alignItems: 'flex-start',
            flexWrap: 'wrap',
          }}>
            {/* Avatar */}
            <div style={{ position: 'relative', flexShrink: 0 }}>
              {candidato.photoUrl ? (
                <img
                  src={candidato.photoUrl}
                  alt={candidato.fullName}
                  style={{
                    width: '110px', height: '110px', borderRadius: '50%',
                    objectFit: 'cover', border: '3px solid rgba(16,185,129,0.4)',
                  }}
                />
              ) : (
                <div style={{
                  width: '110px', height: '110px', borderRadius: '50%',
                  background: 'linear-gradient(135deg, #10b981 0%, #34d399 100%)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '2.5rem', color: 'white', fontWeight: 800,
                  border: '3px solid rgba(16,185,129,0.3)',
                }}>
                  {initials}
                </div>
              )}
              {candidato.verified && (
                <div style={{
                  position: 'absolute', bottom: 4, right: 4,
                  background: '#1d4ed8', borderRadius: '50%',
                  width: '28px', height: '28px',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  border: '2px solid #0a0a0f',
                }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="white">
                    <polyline points="20 6 9 17 4 12" strokeWidth="3" stroke="white" fill="none" />
                  </svg>
                </div>
              )}
            </div>

            {/* Info */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '0.35rem' }}>
                <h1 style={{ margin: 0, fontSize: '1.75rem', fontWeight: 800, color: 'white' }}>
                  {candidato.fullName}
                </h1>
                {candidato.verified && (
                  <VerificationBadge verified={true} size="md" variant="badge" />
                )}
                {candidato.destaque && (
                  <span style={{
                    padding: '0.25rem 0.65rem', borderRadius: '20px',
                    background: 'rgba(245,158,11,0.15)', color: '#fbbf24',
                    fontSize: '0.75rem', fontWeight: 700, border: '1px solid rgba(245,158,11,0.3)',
                  }}>
                    Destaque
                  </span>
                )}
              </div>

              {candidato.objectiveArea && (
                <p style={{ margin: '0 0 0.5rem', color: '#10b981', fontWeight: 600, fontSize: '1rem' }}>
                  {candidato.objectiveArea}
                  {candidato.objectiveType && <span style={{ color: '#6ee7b7', fontWeight: 400 }}> · {candidato.objectiveType}</span>}
                </p>
              )}

              {candidato.location && (
                <p style={{ margin: '0 0 1rem', color: '#71717a', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z" />
                    <circle cx="12" cy="10" r="3" />
                  </svg>
                  {candidato.location}
                </p>
              )}

              {/* Social links */}
              <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                {candidato.linkedin && (
                  <a href={candidato.linkedin} target="_blank" rel="noopener noreferrer" style={{
                    display: 'inline-flex', alignItems: 'center', gap: '0.4rem',
                    padding: '0.5rem 1rem', borderRadius: '8px',
                    background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.25)',
                    color: '#60a5fa', textDecoration: 'none', fontSize: '0.85rem', fontWeight: 600,
                  }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
                    </svg>
                    LinkedIn
                  </a>
                )}
                {candidato.website && (
                  <a href={candidato.website} target="_blank" rel="noopener noreferrer" style={{
                    display: 'inline-flex', alignItems: 'center', gap: '0.4rem',
                    padding: '0.5rem 1rem', borderRadius: '8px',
                    background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.25)',
                    color: '#a5b4fc', textDecoration: 'none', fontSize: '0.85rem', fontWeight: 600,
                  }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <circle cx="12" cy="12" r="10" /><line x1="2" y1="12" x2="22" y2="12" />
                      <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
                    </svg>
                    Website
                  </a>
                )}
              </div>
            </div>
          </div>

          {!viewerAccess?.canViewDetailedInfo && (
            <div style={{
              marginBottom: '1.25rem',
              border: '1px solid rgba(99,102,241,0.35)',
              background: 'rgba(99,102,241,0.08)',
              color: '#c4b5fd',
              borderRadius: '12px',
              padding: '1rem 1.25rem',
              fontSize: '0.9rem',
              lineHeight: 1.5,
            }}>
              {viewerAccess?.isEmpresa
                ? `Seu plano atual (${viewerAccess.planName || 'Básico'}) não permite ver informações detalhadas deste candidato.`
                : 'Informações detalhadas deste candidato são exclusivas para empresas com plano elegível.'}
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: '1.5rem', alignItems: 'start' }}>
            {/* Left column */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

              {/* Bio */}
              {candidato.bio && (
                <Section title="Sobre">
                  <p style={{ margin: 0, color: '#a1a1aa', lineHeight: 1.7, fontSize: '0.95rem' }}>
                    {candidato.bio}
                  </p>
                </Section>
              )}

              {/* Experience */}
              {candidato.experiences.length > 0 && (
                <Section title="Experiência Profissional">
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                    {candidato.experiences.map((exp, i) => (
                      <div key={i} style={{
                        paddingLeft: '1rem',
                        borderLeft: '2px solid rgba(16,185,129,0.3)',
                      }}>
                        {exp.role && (
                          <p style={{ margin: '0 0 0.15rem', fontWeight: 700, color: 'white', fontSize: '0.95rem' }}>
                            {exp.role}
                          </p>
                        )}
                        {exp.company && (
                          <p style={{ margin: '0 0 0.15rem', color: '#10b981', fontSize: '0.875rem', fontWeight: 600 }}>
                            {exp.company}
                          </p>
                        )}
                        {exp.period && (
                          <p style={{ margin: '0 0 0.5rem', color: '#71717a', fontSize: '0.8rem' }}>
                            {exp.period}
                          </p>
                        )}
                        {exp.description && (
                          <p style={{ margin: 0, color: '#a1a1aa', fontSize: '0.875rem', lineHeight: 1.6 }}>
                            {exp.description}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </Section>
              )}

              {/* Education */}
              {candidato.education.length > 0 && (
                <Section title="Formação Académica">
                  <ul style={{ margin: 0, padding: '0 0 0 1.25rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    {candidato.education.map((item, i) => (
                      <li key={i} style={{ color: '#a1a1aa', fontSize: '0.9rem', lineHeight: 1.5 }}>{item}</li>
                    ))}
                  </ul>
                </Section>
              )}
            </div>

            {/* Right column */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

              {/* Skills */}
              {candidato.skills.length > 0 && (
                <Section title="Competências">
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                    {candidato.skills.map((skill, i) => (
                      <span key={i} style={{
                        padding: '0.35rem 0.8rem',
                        background: 'rgba(16,185,129,0.1)',
                        border: '1px solid rgba(16,185,129,0.2)',
                        color: '#34d399', borderRadius: '6px',
                        fontSize: '0.8rem', fontWeight: 600,
                      }}>
                        {skill}
                      </span>
                    ))}
                  </div>
                </Section>
              )}

              {/* Soft Skills */}
              {candidato.softSkills.length > 0 && (
                <Section title="Soft Skills">
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                    {candidato.softSkills.map((skill, i) => (
                      <span key={i} style={{
                        padding: '0.35rem 0.8rem',
                        background: 'rgba(99,102,241,0.1)',
                        border: '1px solid rgba(99,102,241,0.2)',
                        color: '#a5b4fc', borderRadius: '6px',
                        fontSize: '0.8rem', fontWeight: 600,
                      }}>
                        {skill}
                      </span>
                    ))}
                  </div>
                </Section>
              )}

              {/* Languages */}
              {candidato.languages.length > 0 && (
                <Section title="Idiomas">
                  <ul style={{ margin: 0, padding: '0 0 0 1.25rem', display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                    {candidato.languages.map((lang, i) => (
                      <li key={i} style={{ color: '#a1a1aa', fontSize: '0.875rem' }}>{lang}</li>
                    ))}
                  </ul>
                </Section>
              )}

              {/* CTA */}
              <div style={{
                background: 'linear-gradient(135deg, rgba(16,185,129,0.1) 0%, rgba(59,130,246,0.05) 100%)',
                border: '1px solid rgba(16,185,129,0.2)',
                borderRadius: '16px',
                padding: '1.5rem',
                textAlign: 'center',
              }}>
                <p style={{ margin: '0 0 1rem', color: 'rgba(255,255,255,0.7)', fontSize: '0.9rem', lineHeight: 1.6 }}>
                  Interessado em contratar este candidato?
                </p>
                {viewerAccess?.canContactCandidate ? (
                  <>
                    <Link href={`/dashboard/empresa?tab=messages&candidate=${candidato.id}`} style={{
                      display: 'block',
                      padding: '0.75rem 1.25rem',
                      background: '#10b981',
                      color: 'white',
                      borderRadius: '10px',
                      fontWeight: 700,
                      textDecoration: 'none',
                      fontSize: '0.9rem',
                      transition: 'opacity 0.2s',
                    }}>
                      Entrar em contacto
                    </Link>
                    {(candidato.email || candidato.phone) && (
                      <div style={{ marginTop: '0.85rem', color: '#d1fae5', fontSize: '0.85rem', lineHeight: 1.5 }}>
                        {candidato.email && <div>Email: {candidato.email}</div>}
                        {candidato.phone && <div>Telefone: {candidato.phone}</div>}
                      </div>
                    )}
                  </>
                ) : viewerAccess?.isEmpresa ? (
                  <Link href="/premium/empresa" style={{
                    display: 'block',
                    padding: '0.75rem 1.25rem',
                    background: '#6366f1',
                    color: 'white',
                    borderRadius: '10px',
                    fontWeight: 700,
                    textDecoration: 'none',
                    fontSize: '0.9rem',
                    transition: 'opacity 0.2s',
                  }}>
                    Fazer upgrade para contactar
                  </Link>
                ) : (
                  <Link href="/login?type=empresa" style={{
                    display: 'block',
                    padding: '0.75rem 1.25rem',
                    background: '#10b981',
                    color: 'white',
                    borderRadius: '10px',
                    fontWeight: 700,
                    textDecoration: 'none',
                    fontSize: '0.9rem',
                    transition: 'opacity 0.2s',
                  }}>
                    Entrar como Empresa
                  </Link>
                )}
              </div>

            </div>
          </div>
        </main>

        <Footer />
      </div>
    </>
  );
}

function Section({ title, children }) {
  return (
    <div style={{
      background: 'rgba(255,255,255,0.02)',
      border: '1px solid rgba(255,255,255,0.06)',
      borderRadius: '14px',
      padding: '1.5rem',
    }}>
      <h2 style={{ margin: '0 0 1rem', fontSize: '1rem', fontWeight: 700, color: 'white' }}>
        {title}
      </h2>
      {children}
    </div>
  );
}
