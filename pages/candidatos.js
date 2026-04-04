import Head from 'next/head';
import { useMemo, useState } from 'react';
import Link from 'next/link';
import nookies from 'nookies';
import PublicPageShell from '../components/PublicPageShell';
import VerificationBadge from '../components/VerificationBadge';
import styles from '../styles/CandidatosPage.module.css';

function toMillis(value) {
  if (!value) return 0;
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  if (value instanceof Date) return value.getTime();
  if (typeof value.toMillis === 'function') return value.toMillis();
  if (typeof value.toDate === 'function') {
    const d = value.toDate();
    return d instanceof Date ? d.getTime() : 0;
  }
  if (typeof value.seconds === 'number') return value.seconds * 1000;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? 0 : d.getTime();
}

function toIsoDateString(value) {
  const millis = toMillis(value);
  if (!millis) return null;
  return new Date(millis).toISOString();
}

async function getViewerAccess(context, admin) {
  const baseAccess = {
    userType: 'guest',
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
    const userDoc = await admin.firestore().collection('users').doc(decoded.uid).get();
    if (!userDoc.exists) return baseAccess;

    const userData = userDoc.data() || {};
    if (userData.userType !== 'empresa') {
      return { ...baseAccess, userType: userData.userType || 'guest' };
    }

    const { getEmpresaPlanSummary } = await import('../lib/empresaPlanFeatures');
    const planSummary = getEmpresaPlanSummary(userData);
    const features = planSummary?.features || {};

    return {
      userType: 'empresa',
      isEmpresa: true,
      canViewDetailedInfo: Boolean(features.accessTalentPool),
      canContactCandidate: Boolean(features.canViewCandidateContact || features.canSendDirectMessages),
      planName: planSummary?.planName || features.name || 'Básico',
    };
  } catch (error) {
    return baseAccess;
  }
}

export async function getServerSideProps(context) {
  try {
    const { admin } = await import('../lib/firebaseAdmin');
    const db = admin.firestore();
    const viewerAccess = await getViewerAccess(context, admin);

    const maxFetch = 200;
    const [verifiedFlagSnap, verifiedStatusSnap, verifiedLegacySnap, verifiedLegacy2Snap] = await Promise.all([
      db.collection('users').where('userType', '==', 'candidato').where('verified', '==', true).limit(maxFetch).get(),
      db.collection('users').where('userType', '==', 'candidato').where('verificationStatus', '==', 'verified').limit(maxFetch).get(),
      db.collection('users').where('userType', '==', 'candidato').where('verificado', '==', true).limit(maxFetch).get(),
      db.collection('users').where('userType', '==', 'candidato').where('isVerified', '==', true).limit(maxFetch).get(),
    ]);

    const usersById = new Map();
    for (const doc of verifiedFlagSnap.docs) usersById.set(doc.id, doc);
    for (const doc of verifiedStatusSnap.docs) usersById.set(doc.id, doc);
    for (const doc of verifiedLegacySnap.docs) usersById.set(doc.id, doc);
    for (const doc of verifiedLegacy2Snap.docs) usersById.set(doc.id, doc);

    const userDocs = Array.from(usersById.values());
    const userIds = userDocs.map((doc) => doc.id);

    const profileDocs = userIds.length
      ? await db.getAll(...userIds.map((uid) => db.collection('profiles').doc(uid)))
      : [];

    const profilesMap = new Map();
    for (const doc of profileDocs) {
      if (doc.exists) profilesMap.set(doc.id, doc.data() || {});
    }

    const candidatos = userDocs
      .map((doc) => {
        const userData = doc.data() || {};
        const profileData = profilesMap.get(doc.id) || {};
        const userVerificationStatus = String(userData.verificationStatus || '').toLowerCase();
        const profileVerificationStatus = String(profileData.verificationStatus || '').toLowerCase();

        const allSkills = [
          ...(userData.skills || []),
          ...(profileData.skillsHard ? String(profileData.skillsHard).split(',').map((skill) => skill.trim()) : []),
          ...(profileData.digitalSkills || []),
        ].filter(Boolean);

        const verified = Boolean(
          userData.verified ||
            userData.verificado ||
            profileData.verificado ||
            userVerificationStatus === 'verified' ||
            userVerificationStatus === 'approved' ||
            profileData.verified ||
            profileVerificationStatus === 'verified' ||
            profileVerificationStatus === 'approved'
        );

        return {
          id: doc.id,
          fullName: userData.fullName || userData.name || profileData.fullName || 'Sem nome',
          photoUrl: userData.photoUrl || userData.photo || profileData.photoUrl || '',
          location:
            userData.cidade ||
            userData.localizacao ||
            profileData.location ||
            userData.location ||
            'Localização desconhecida',
          bio: viewerAccess.canViewDetailedInfo ? userData.bio || userData.sobre || profileData.bio || '' : '',
          skills: viewerAccess.canViewDetailedInfo ? allSkills : [],
          areasInteresse: userData.areasInteresse || userData.areas || [],
          objectiveArea: viewerAccess.canViewDetailedInfo ? profileData.objectiveArea || userData.areasInteresse?.[0] || '' : '',
          experience: profileData.experience || userData.experiencia || '',
          verified,
          destaque: userData.destaque || userData.curriculoDestacado || false,
          createdAt: toIsoDateString(userData.createdAt),
          createdAtMillis: toMillis(userData.createdAt),
        };
      })
      .filter((candidato) => candidato.verified)
      .sort((a, b) => {
        return (b.createdAtMillis || 0) - (a.createdAtMillis || 0);
      });

    return {
      props: {
        candidatos: candidatos || [],
        totalCandidatos: candidatos?.length || 0,
        viewerAccess,
      },
    };
  } catch (error) {
    console.error('Erro ao buscar candidatos:', error);
    return {
      props: {
        candidatos: [],
        totalCandidatos: 0,
        viewerAccess: {
          userType: 'guest',
          isEmpresa: false,
          canViewDetailedInfo: false,
          canContactCandidate: false,
          planName: null,
        },
      },
    };
  }
}

export default function Candidatos({ candidatos = [], totalCandidatos = 0, viewerAccess }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedArea, setSelectedArea] = useState('');
  const [sortBy, setSortBy] = useState('recentes');

  const uniqueAreas = useMemo(() => {
    const areas = new Set();
    candidatos.forEach((candidato) => {
      if (candidato.areasInteresse && Array.isArray(candidato.areasInteresse)) {
        candidato.areasInteresse.forEach((area) => areas.add(area));
      }
      if (candidato.objectiveArea) {
        areas.add(candidato.objectiveArea);
      }
    });
    return Array.from(areas).sort();
  }, [candidatos]);

  const filteredCandidatos = useMemo(() => {
    let filtered = candidatos.filter((candidato) => {
      const normalizedSearch = searchTerm.toLowerCase();
      const matchesSearch =
        !searchTerm ||
        candidato.fullName.toLowerCase().includes(normalizedSearch) ||
        candidato.location.toLowerCase().includes(normalizedSearch) ||
        candidato.skills.some((skill) => skill.toLowerCase().includes(normalizedSearch));

      const matchesArea =
        !selectedArea ||
        (candidato.areasInteresse && candidato.areasInteresse.includes(selectedArea)) ||
        candidato.objectiveArea === selectedArea;

      return matchesSearch && matchesArea;
    });

    if (sortBy === 'destaque') {
      filtered = filtered.sort((a, b) => (b.destaque ? 1 : 0) - (a.destaque ? 1 : 0));
    } else {
      filtered = filtered.sort((a, b) => {
        return (b.createdAtMillis || 0) - (a.createdAtMillis || 0);
      });
    }

    return filtered;
  }, [candidatos, searchTerm, selectedArea, sortBy]);

  const featuredCandidatesCount = useMemo(
    () => candidatos.filter((candidato) => candidato.destaque).length,
    [candidatos]
  );

  const activeFilterChips = [
    searchTerm.trim() ? `Busca: ${searchTerm.trim()}` : null,
    selectedArea ? `Área: ${selectedArea}` : null,
    sortBy === 'destaque' ? 'Ordenação: Destacados' : 'Ordenação: Mais recentes',
  ].filter(Boolean);

  function resetFilters() {
    setSearchTerm('');
    setSelectedArea('');
    setSortBy('recentes');
  }

  return (
    <>
      <Head>
        <title>Candidatos Verificados - STP Emprego</title>
        <meta name="description" content="Banco de talentos: veja apenas candidatos verificados em São Tomé e Príncipe." />
        <meta property="og:title" content="Candidatos Verificados - STP Emprego" />
        <meta property="og:type" content="website" />
      </Head>

      <PublicPageShell>
        <div className={styles.page}>
          <section className={styles.hero}>
            <div className={styles.container}>
              <div className={styles.heroContent}>
                <div className={styles.heroBadge}>Banco de talentos validado</div>
                <h1 className={styles.title}>Candidatos Verificados</h1>
                <p className={styles.subtitle}>
                  Banco de talentos com perfis validados pela plataforma.
                </p>

                <div className={styles.heroStats}>
                  <div className={styles.heroStatCard}>
                    <span className={styles.heroStatLabel}>Verificados</span>
                    <strong className={styles.heroStatValue}>{totalCandidatos}</strong>
                  </div>
                  <div className={styles.heroStatCard}>
                    <span className={styles.heroStatLabel}>Áreas</span>
                    <strong className={styles.heroStatValue}>{uniqueAreas.length}</strong>
                  </div>
                  <div className={styles.heroStatCard}>
                    <span className={styles.heroStatLabel}>Destacados</span>
                    <strong className={styles.heroStatValue}>{featuredCandidatesCount}</strong>
                  </div>
                </div>
              </div>
            </div>
          </section>

          <section className={styles.contentSection}>
            <div className={styles.container}>
              <div className={styles.filtersCard}>
                <div className={styles.filterGroup}>
                  <label className={styles.filterLabel}>Pesquisar</label>
                  <input
                    type="text"
                    placeholder="Nome, localização ou skill..."
                    value={searchTerm}
                    onChange={(event) => setSearchTerm(event.target.value)}
                    className={styles.filterControl}
                  />
                </div>

                <div className={styles.filterGroup}>
                  <label className={styles.filterLabel}>Área de Interesse</label>
                  <select
                    value={selectedArea}
                    onChange={(event) => setSelectedArea(event.target.value)}
                    className={styles.filterControl}
                  >
                    <option value="">Todas as áreas</option>
                    {uniqueAreas.map((area) => (
                      <option key={area} value={area}>
                        {area}
                      </option>
                    ))}
                  </select>
                </div>

                <div className={styles.filterGroup}>
                  <label className={styles.filterLabel}>Ordenar por</label>
                  <select
                    value={sortBy}
                    onChange={(event) => setSortBy(event.target.value)}
                    className={styles.filterControl}
                  >
                    <option value="recentes">Mais Recentes</option>
                    <option value="destaque">Destacados</option>
                  </select>
                </div>

                {activeFilterChips.length > 0 ? (
                  <div className={styles.activeFilters}>
                    {activeFilterChips.map((chip) => (
                      <span key={chip} className={styles.filterChip}>
                        {chip}
                      </span>
                    ))}
                  </div>
                ) : null}
              </div>

              <div className={styles.resultsSection}>
                {!viewerAccess?.canViewDetailedInfo ? (
                  <div className={styles.accessBanner}>
                    {viewerAccess?.isEmpresa
                      ? `Seu plano atual (${viewerAccess.planName || 'Básico'}) não permite ver informações detalhadas dos candidatos. Faça upgrade para desbloquear.`
                      : 'As informações detalhadas e o contacto dos candidatos são exclusivos para empresas com plano elegível.'}
                  </div>
                ) : null}

                {filteredCandidatos.length > 0 ? (
                  <>
                    <div className={styles.stats}>
                      Mostrando {filteredCandidatos.length} de {totalCandidatos} candidatos verificados
                    </div>

                    <div className={styles.grid}>
                      {filteredCandidatos.map((candidato) => {
                        const avatarStyle = candidato.photoUrl
                          ? { backgroundImage: `url(${candidato.photoUrl})` }
                          : undefined;

                        return (
                          <article key={candidato.id} className={styles.card}>
                            <div className={styles.cardHeader}>
                              <div
                                className={`${styles.avatar} ${!candidato.photoUrl ? styles.avatarFallback : ''}`}
                                style={avatarStyle}
                              >
                                {!candidato.photoUrl ? (
                                  <span className={styles.avatarInitial}>
                                    {candidato.fullName.charAt(0).toUpperCase()}
                                  </span>
                                ) : null}
                              </div>
                              <h3 className={styles.candidateName}>{candidato.fullName}</h3>
                              <p className={styles.location}>📍 {candidato.location}</p>
                              <div className={styles.badgeRow}>
                                {candidato.destaque ? (
                                  <span className={styles.featuredBadge}>⭐ Destacado</span>
                                ) : null}
                                <VerificationBadge verified size="sm" />
                              </div>
                            </div>

                            <div className={styles.cardContent}>
                              {candidato.bio ? (
                                <>
                                  <h4 className={styles.sectionTitle}>Sobre</h4>
                                  <p className={styles.bodyText}>{candidato.bio.substring(0, 100)}...</p>
                                </>
                              ) : null}

                              {candidato.objectiveArea ? (
                                <>
                                  <h4 className={styles.sectionTitle}>Objetivo</h4>
                                  <p className={styles.bodyText}>{candidato.objectiveArea}</p>
                                </>
                              ) : null}

                              {candidato.skills?.length ? (
                                <>
                                  <h4 className={styles.sectionTitle}>Skills</h4>
                                  <div className={styles.skills}>
                                    {candidato.skills.slice(0, 4).map((skill, index) => (
                                      <span key={`${skill}-${index}`} className={styles.skill}>
                                        {skill}
                                      </span>
                                    ))}
                                    {candidato.skills.length > 4 ? (
                                      <span className={styles.skill}>+{candidato.skills.length - 4}</span>
                                    ) : null}
                                  </div>
                                </>
                              ) : null}

                              <div className={styles.actions}>
                                <Link href={`/candidatos/${candidato.id}`} className={styles.actionButton}>
                                  {viewerAccess?.canViewDetailedInfo ? 'Ver Perfil Completo →' : 'Ver Perfil (Limitado)'}
                                </Link>

                                {viewerAccess?.canContactCandidate ? (
                                  <Link
                                    href={`/dashboard/empresa?tab=messages&candidate=${candidato.id}`}
                                    className={styles.secondaryActionButton}
                                  >
                                    Entrar em contacto
                                  </Link>
                                ) : null}
                              </div>

                              {!viewerAccess?.canViewDetailedInfo ? (
                                <div className={styles.hintText}>
                                  {viewerAccess?.isEmpresa ? (
                                    <>
                                      <Link href="/premium/empresa" className={styles.inlineLink}>
                                        Fazer upgrade do plano
                                      </Link>{' '}
                                      para ver detalhes e contactar.
                                    </>
                                  ) : (
                                    <>
                                      <Link href="/login?type=empresa" className={styles.inlineLink}>
                                        Entrar como empresa
                                      </Link>{' '}
                                      para ver detalhes e contactar.
                                    </>
                                  )}
                                </div>
                              ) : null}
                            </div>
                          </article>
                        );
                      })}
                    </div>
                  </>
                ) : (
                  <div className={styles.emptyState}>
                    <p className={styles.emptyTitle}>
                      Nenhum candidato encontrado com os critérios selecionados.
                    </p>
                    <button type="button" onClick={resetFilters} className={styles.clearButton}>
                      Limpar Filtros
                    </button>
                  </div>
                )}
              </div>
            </div>
          </section>
        </div>
      </PublicPageShell>
    </>
  );
}
