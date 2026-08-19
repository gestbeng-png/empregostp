import { admin } from '../../../../lib/firebaseAdmin';
import nookies from 'nookies';
import Link from 'next/link';
import Head from 'next/head';
import Image from 'next/image';
import { useRouter } from 'next/router';
import { useState } from 'react';
import {
  openCandidateCertificate,
  openCandidateCv,
} from '../../../../lib/candidateCvClient';
import { getEmpresaPlanSummary } from '../../../../lib/empresaPlanFeatures';
import {
  canViewerAccessCandidate,
  getCandidatePrivacy,
} from '../../../../lib/candidatePrivacy';
import { collectCompanyApplicationHistory } from '../../../../lib/applicationOwnership';
import { normalizeExternalUrl } from '../../../../lib/externalUrl';
import styles from '../../../../styles/EmpresaCandidateProfilePage.module.css';
import { redirectToLogin } from '../../../../lib/loginRedirect';
import { isUserAccountActive } from '../../../../lib/userStatus';

const APPLICATION_HISTORY_LIMIT = 20;
const APPLICATION_HISTORY_PAGE_SIZE = 100;

function safeTimestampToMillis(timestamp) {
  if (!timestamp) return null;
  if (typeof timestamp.toMillis === 'function') return timestamp.toMillis();
  if (typeof timestamp === 'number') return timestamp;
  if (typeof timestamp === 'string') return new Date(timestamp).getTime();
  return null;
}

function toPlainText(value) {
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
    const orderedKeys = [
      'description',
      'role',
      'company',
      'period',
      'title',
      'name',
      'value',
    ];
    const prioritized = orderedKeys
      .map((key) => toPlainText(value[key]))
      .filter(Boolean);
    if (prioritized.length > 0) return prioritized.join(' • ');

    return Object.values(value)
      .map((item) => toPlainText(item))
      .filter(Boolean)
      .join(' • ');
  }
  return '';
}

function normalizeStringList(value) {
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
}

function normalizeExperienceList(value) {
  if (!value) return [];
  const source = Array.isArray(value) ? value : [value];
  return source
    .map((entry) => {
      if (typeof entry === 'string') {
        const text = toPlainText(entry);
        return text
          ? { company: '', role: '', period: '', description: text }
          : null;
      }
      if (!entry || typeof entry !== 'object') return null;

      const company = toPlainText(entry.company || entry.empresa);
      const role = toPlainText(entry.role || entry.cargo || entry.title);
      const period = toPlainText(
        entry.period || entry.periodo || entry.dateRange,
      );
      const description = toPlainText(
        entry.description || entry.resumo || entry.details || '',
      );

      if (!company && !role && !period && !description) {
        const fallback = toPlainText(entry);
        return fallback
          ? { company: '', role: '', period: '', description: fallback }
          : null;
      }

      return { company, role, period, description };
    })
    .filter(Boolean);
}

export default function PerfilCandidato({
  candidato,
  applications,
  contactLocked = false,
  contactHiddenByCandidate = false,
  messagingLocked = false,
}) {
  const router = useRouter();
  const [cvOpening, setCvOpening] = useState(false);
  const [cvError, setCvError] = useState('');
  const [certificateOpeningIndex, setCertificateOpeningIndex] = useState(null);
  const [certificateError, setCertificateError] = useState('');

  const handleOpenCv = async () => {
    setCvError('');
    setCvOpening(true);
    const result = await openCandidateCv(candidato.id);
    if (!result.success) {
      setCvError(result.error);
    }
    setCvOpening(false);
  };

  const handleOpenCertificate = async (certificateIndex) => {
    setCertificateError('');
    setCertificateOpeningIndex(certificateIndex);
    const result = await openCandidateCertificate(
      candidato.id,
      certificateIndex,
    );
    if (!result.success) {
      setCertificateError(result.error);
    }
    setCertificateOpeningIndex(null);
  };

  if (!candidato) {
    return (
      <>
        <Head>
          <title>Candidato não encontrado - EmpregoSTP</title>
        </Head>
        <div className={styles.notFoundPage}>
          <h2 className={styles.notFoundTitle}>Candidato não encontrado</h2>
          <Link
            href="/dashboard/empresa?tab=candidates"
            className={styles.notFoundLink}
          >
            Voltar ao banco de talentos
          </Link>
        </div>
      </>
    );
  }

  const hardSkills = Array.isArray(candidato.skillsHard)
    ? candidato.skillsHard.map((item) => toPlainText(item)).filter(Boolean)
    : candidato.skillsHard
      ? String(candidato.skillsHard)
          .split(',')
          .map((t) => t.trim())
          .filter(Boolean)
      : [];

  const softSkills = Array.isArray(candidato.skillsSoft)
    ? candidato.skillsSoft.map((item) => toPlainText(item)).filter(Boolean)
    : candidato.skillsSoft
      ? String(candidato.skillsSoft)
          .split(',')
          .map((t) => t.trim())
          .filter(Boolean)
      : [];

  const languages = normalizeStringList(candidato.languages);
  const education = normalizeStringList(candidato.education);
  const experience = normalizeExperienceList(candidato.experience);

  return (
    <>
      <Head>
        <title>{candidato.fullName || 'Candidato'} - EmpregoSTP</title>
      </Head>

      <div className={styles.page}>
        <div className={styles.container}>
          <Link
            href="/dashboard/empresa?tab=candidates"
            className={styles.backLink}
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              aria-hidden="true"
            >
              <path d="M19 12H5M12 19l-7-7 7-7" />
            </svg>
            <span>Voltar ao banco de talentos</span>
          </Link>

          <section className={styles.hero}>
            {candidato.photoUrl ? (
              <Image
                src={candidato.photoUrl}
                alt={`Fotografia de ${candidato.fullName || candidato.name || 'candidato'}`}
                className={styles.avatarImage}
                width="120"
                height="120"
                sizes="120px"
                unoptimized
              />
            ) : (
              <div className={styles.avatarFallback}>
                {(candidato.fullName || candidato.name || '?')[0].toUpperCase()}
              </div>
            )}

            <div className={styles.heroCopy}>
              <span className={styles.eyebrow}>Perfil de talento</span>
              <h1 className={styles.title}>
                {candidato.fullName || candidato.name || 'Nome não informado'}
              </h1>
              {candidato.location ? (
                <p className={styles.subtitle}>{candidato.location}</p>
              ) : null}
              {candidato.objectiveArea ? (
                <p className={styles.metaText}>
                  Área de interesse: {candidato.objectiveArea}
                </p>
              ) : null}
              {candidato.birthDate ? (
                <p className={styles.metaSmall}>
                  Data de nascimento: {candidato.birthDate}
                </p>
              ) : null}
            </div>

            <div className={styles.actions}>
              {!contactLocked && candidato.hasCv ? (
                <button
                  type="button"
                  onClick={handleOpenCv}
                  disabled={cvOpening}
                  aria-busy={cvOpening}
                  className={`${styles.actionButton} ${styles.actionPrimary}`}
                >
                  {cvOpening ? 'A abrir CV…' : 'Baixar CV'}
                </button>
              ) : null}

              {contactLocked && !contactHiddenByCandidate && candidato.hasCv ? (
                <button
                  type="button"
                  onClick={() => router.push('/premium/empresa')}
                  className={`${styles.actionButton} ${styles.actionWarning}`}
                >
                  Desbloquear CV
                </button>
              ) : null}

              {!contactLocked && candidato.email ? (
                <a
                  href={`mailto:${candidato.email}`}
                  className={`${styles.actionButton} ${styles.actionSecondary}`}
                >
                  Enviar email
                </a>
              ) : null}

              {!messagingLocked ? (
                <Link
                  href={`/dashboard/empresa?tab=messages&candidate=${candidato.id}`}
                  className={`${styles.actionButton} ${styles.actionAccent}`}
                >
                  Enviar mensagem
                </Link>
              ) : (
                <button
                  type="button"
                  onClick={() => router.push('/premium/empresa')}
                  className={`${styles.actionButton} ${styles.actionMuted}`}
                >
                  Desbloquear mensagens
                </button>
              )}
            </div>

            {cvError ? (
              <p className={styles.actionError} role="alert">
                {cvError}{' '}
                <button
                  type="button"
                  onClick={handleOpenCv}
                  className={styles.actionRetry}
                >
                  Tentar novamente
                </button>
              </p>
            ) : null}
          </section>

          <div className={styles.layout}>
            {(candidato.phone ||
              candidato.email ||
              candidato.linkedin ||
              candidato.website ||
              contactLocked) && (
              <InfoSection title="Informações de contacto">
                {contactHiddenByCandidate ? (
                  <div className={styles.lockBanner}>
                    O candidato optou por não partilhar os seus contactos.
                  </div>
                ) : contactLocked ? (
                  <div className={styles.lockBanner}>
                    O plano atual não inclui os contactos deste candidato.
                    Atualize o plano para consultar telefone, email e currículo.
                  </div>
                ) : null}

                <div className={styles.infoGrid}>
                  {!contactLocked && candidato.phone ? (
                    <InfoItem label="Telefone" value={candidato.phone} />
                  ) : null}
                  {!contactLocked && candidato.email ? (
                    <InfoItem label="Email" value={candidato.email} />
                  ) : null}
                  {candidato.linkedin ? (
                    <ExternalItem
                      label="LinkedIn"
                      href={candidato.linkedin}
                      text="Ver perfil"
                    />
                  ) : null}
                  {candidato.website ? (
                    <ExternalItem
                      label="Website/Portfólio"
                      href={candidato.website}
                      text="Visitar site"
                    />
                  ) : null}
                </div>
              </InfoSection>
            )}

            {candidato.objectiveArea || candidato.objectiveAspiration ? (
              <InfoSection title="Objetivo profissional">
                {candidato.objectiveArea ? (
                  <div className={styles.stack}>
                    <div className={styles.infoLabel}>Área de interesse</div>
                    <div className={styles.infoValue}>
                      {candidato.objectiveArea}
                      {candidato.objectiveType
                        ? ` — ${candidato.objectiveType}`
                        : ''}
                    </div>
                  </div>
                ) : null}
                {candidato.objectiveAspiration ? (
                  <div className={styles.stack}>
                    <div className={styles.infoLabel}>Aspirações</div>
                    <p className={styles.longText}>
                      {candidato.objectiveAspiration}
                    </p>
                  </div>
                ) : null}
              </InfoSection>
            ) : null}

            {candidato.certificateCount > 0 ? (
              <InfoSection title="Certificados">
                <div className={styles.fileList}>
                  {Array.from(
                    { length: candidato.certificateCount },
                    (_, i) => (
                      <button
                        key={`certificate-${i}`}
                        type="button"
                        onClick={() => handleOpenCertificate(i)}
                        disabled={certificateOpeningIndex !== null}
                        className={styles.fileCard}
                      >
                        <svg
                          width="18"
                          height="18"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          aria-hidden="true"
                        >
                          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                          <polyline points="14 2 14 8 20 8" />
                          <line x1="16" y1="13" x2="8" y2="13" />
                          <line x1="16" y1="17" x2="8" y2="17" />
                        </svg>
                        <span>
                          {certificateOpeningIndex === i
                            ? 'A abrir certificado…'
                            : `Certificado ${i + 1}`}
                        </span>
                      </button>
                    ),
                  )}
                </div>
                {certificateError ? (
                  <p className={styles.actionError} role="alert">
                    {certificateError}
                  </p>
                ) : null}
              </InfoSection>
            ) : null}

            {education.length > 0 ? (
              <InfoSection title="Formação académica">
                <div className={styles.recordList}>
                  {education.map((edu, i) => (
                    <div
                      key={i}
                      className={`${styles.recordCard} ${styles.recordBlue}`}
                    >
                      <div className={styles.recordText}>{edu}</div>
                    </div>
                  ))}
                </div>
              </InfoSection>
            ) : null}

            {experience.length > 0 ? (
              <InfoSection title="Experiência profissional">
                <div className={styles.recordList}>
                  {experience.map((exp, i) => (
                    <div
                      key={i}
                      className={`${styles.recordCard} ${styles.recordGreen}`}
                    >
                      {exp.role ? (
                        <div className={styles.recordTitle}>{exp.role}</div>
                      ) : null}
                      {exp.company ? (
                        <div className={styles.recordAccent}>{exp.company}</div>
                      ) : null}
                      {exp.period ? (
                        <div className={styles.recordMeta}>{exp.period}</div>
                      ) : null}
                      {exp.description ? (
                        <div className={styles.recordText}>
                          {exp.description}
                        </div>
                      ) : null}
                    </div>
                  ))}
                </div>
              </InfoSection>
            ) : null}

            {candidato.birthDate ||
            candidato.nationality ||
            candidato.gender ||
            candidato.maritalStatus ? (
              <InfoSection title="Dados pessoais">
                <div className={styles.infoGridCompact}>
                  {candidato.birthDate ? (
                    <InfoItem
                      label="Data de nascimento"
                      value={candidato.birthDate}
                    />
                  ) : null}
                  {candidato.nationality ? (
                    <InfoItem
                      label="Nacionalidade"
                      value={candidato.nationality}
                    />
                  ) : null}
                  {candidato.gender ? (
                    <InfoItem label="Género" value={candidato.gender} />
                  ) : null}
                  {candidato.maritalStatus ? (
                    <InfoItem
                      label="Estado civil"
                      value={candidato.maritalStatus}
                    />
                  ) : null}
                </div>
              </InfoSection>
            ) : null}

            <div className={styles.twoColumnGrid}>
              {hardSkills.length > 0 ? (
                <InfoSection title="Hard Skills">
                  <SkillList items={hardSkills} tone="blue" />
                </InfoSection>
              ) : null}

              {softSkills.length > 0 ? (
                <InfoSection title="Soft Skills">
                  <SkillList items={softSkills} tone="green" />
                </InfoSection>
              ) : null}
            </div>

            <div className={styles.twoColumnGrid}>
              {candidato.digitalSkills && candidato.digitalSkills.length > 0 ? (
                <InfoSection title="Competências digitais">
                  <SkillList items={candidato.digitalSkills} tone="violet" />
                </InfoSection>
              ) : null}

              {languages.length > 0 ? (
                <InfoSection title="Idiomas">
                  <div className={styles.languageList}>
                    {languages.map((lang, i) => (
                      <div key={i} className={styles.languageItem}>
                        {lang}
                      </div>
                    ))}
                  </div>
                </InfoSection>
              ) : null}
            </div>

            {candidato.bio ? (
              <InfoSection title="Sobre o candidato">
                <p className={styles.longText}>{candidato.bio}</p>
              </InfoSection>
            ) : null}

            {candidato.certifications ? (
              <InfoSection title="Certificações">
                <div className={styles.recordList}>
                  {(typeof candidato.certifications === 'string'
                    ? candidato.certifications.split('\n').filter(Boolean)
                    : candidato.certifications
                  ).map((cert, i) => (
                    <div
                      key={i}
                      className={`${styles.recordCard} ${styles.recordGold}`}
                    >
                      <div className={styles.recordText}>{cert}</div>
                    </div>
                  ))}
                </div>
              </InfoSection>
            ) : null}

            <InfoSection title="Histórico de candidaturas">
              {applications.length > 0 ? (
                <div className={styles.applicationList}>
                  {applications.map((app, i) => (
                    <div key={i} className={styles.applicationCard}>
                      <div className={styles.applicationCopy}>
                        <div className={styles.applicationTitle}>
                          {app.jobTitle || 'Vaga não especificada'}
                        </div>
                        {app.createdAt ? (
                          <div className={styles.applicationDate}>
                            {new Date(app.createdAt).toLocaleDateString(
                              'pt-PT',
                              {
                                day: '2-digit',
                                month: 'long',
                                year: 'numeric',
                              },
                            )}
                          </div>
                        ) : null}
                      </div>
                      <div
                        className={`${styles.statusBadge} ${
                          styles[
                            `status${String(app.status || 'pending')
                              .charAt(0)
                              .toUpperCase()}${String(app.status || 'pending').slice(1)}`
                          ] || styles.statusPending
                        }`}
                      >
                        {app.status === 'pending'
                          ? 'Pendente'
                          : app.status === 'approved'
                            ? 'Aprovada'
                            : app.status === 'rejected'
                              ? 'Rejeitada'
                              : app.status}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className={styles.emptyText}>
                  Ainda não existem candidaturas registadas.
                </p>
              )}
            </InfoSection>
          </div>
        </div>
      </div>
    </>
  );
}

function InfoSection({ title, children }) {
  return (
    <section className={styles.section}>
      <h3 className={styles.sectionTitle}>{title}</h3>
      {children}
    </section>
  );
}

function InfoItem({ label, value }) {
  return (
    <div className={styles.infoCard}>
      <div className={styles.infoLabel}>{label}</div>
      <div className={styles.infoValue}>{value}</div>
    </div>
  );
}

function ExternalItem({ label, href, text }) {
  return (
    <div className={styles.infoCard}>
      <div className={styles.infoLabel}>{label}</div>
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className={styles.externalLink}
      >
        {text}
      </a>
    </div>
  );
}

function SkillList({ items, tone }) {
  return (
    <div className={styles.skillList}>
      {items.map((skill, i) => (
        <span
          key={`${skill}-${i}`}
          className={`${styles.skillChip} ${styles[`skill${tone[0].toUpperCase()}${tone.slice(1)}`]}`}
        >
          {skill}
        </span>
      ))}
    </div>
  );
}

export async function getServerSideProps(context) {
  const { id } = context.params;

  try {
    const cookies = nookies.get(context);

    if (!cookies.token) {
      return redirectToLogin(context);
    }

    const token = await admin.auth().verifyIdToken(cookies.token, true);
    const uid = token.uid;

    const userDoc = await admin.firestore().collection('users').doc(uid).get();
    if (!userDoc.exists || !isUserAccountActive(userDoc.data())) {
      return { redirect: { destination: '/dashboard', permanent: false } };
    }

    const userData = userDoc.data();
    if (userData.userType !== 'empresa' && userData.userType !== 'admin') {
      return { redirect: { destination: '/dashboard', permanent: false } };
    }

    const candidatoDoc = await admin
      .firestore()
      .collection('users')
      .doc(id)
      .get();
    if (!candidatoDoc.exists) {
      return { notFound: true };
    }

    const candidatoData = candidatoDoc.data();

    if (candidatoData.userType !== 'candidato') {
      return { notFound: true };
    }

    const profileDoc = await admin
      .firestore()
      .collection('profiles')
      .doc(id)
      .get();
    const profileData = profileDoc.exists ? profileDoc.data() : {};
    const privacy = getCandidatePrivacy(profileData);
    const isAdmin = userData.userType === 'admin';
    const isEmpresa = userData.userType === 'empresa';

    const planSummary =
      userData.userType === 'empresa' ? getEmpresaPlanSummary(userData) : null;
    const contactHiddenByCandidate =
      userData.userType === 'empresa' && !privacy.showContactInfo;
    const contactLocked =
      userData.userType === 'empresa' &&
      (contactHiddenByCandidate ||
        !planSummary?.features?.canViewCandidateContact);
    const messagingLocked =
      userData.userType === 'empresa' &&
      !planSummary?.features?.canSendDirectMessages;

    const candidato = {
      id,
      fullName: candidatoData.fullName || candidatoData.name || '',
      name: candidatoData.name || '',
      email: contactLocked ? '' : candidatoData.email || '',
      phone: contactLocked ? '' : candidatoData.phone || '',
      photoUrl: candidatoData.photoUrl || '',
      location: profileData.location || candidatoData.location || '',
      objectiveArea: profileData.objectiveArea || '',
      objectiveType: profileData.objectiveType || '',
      objectiveAspiration: profileData.objectiveAspiration || '',
      birthDate: profileData.birthDate || '',
      nationality: profileData.nationality || '',
      gender: profileData.gender || '',
      maritalStatus: profileData.maritalStatus || '',
      linkedin: contactLocked ? '' : normalizeExternalUrl(profileData.linkedin),
      website: contactLocked ? '' : normalizeExternalUrl(profileData.website),
      skillsHard: profileData.skillsHard || [],
      skillsSoft: profileData.skillsSoft || [],
      digitalSkills: profileData.digitalSkills || [],
      languages: profileData.languages || [],
      education: profileData.education || [],
      experience: profileData.experience || [],
      bio: profileData.bio || '',
      certifications: profileData.certifications || [],
      // O cliente só conhece a quantidade. Os URLs permanentes permanecem no
      // servidor e cada abertura passa pela rota autenticada de curta duração.
      certificateCount:
        !contactLocked && Array.isArray(profileData.certificateFiles)
          ? profileData.certificateFiles.filter(
              (value) => typeof value === 'string' && value.trim(),
            ).length
          : 0,
      // Só a existência: o download passa por /api/files/candidate-cv, que
      // reavalia a permissão e devolve um URL assinado de curta duração.
      hasCv: Boolean(profileData.cvUrl || candidatoData.cvUrl),
    };

    const firestore = admin.firestore();
    const applicationsCollection = firestore.collection('applications');
    const applicationsQuery = applicationsCollection.where(
      'candidateId',
      '==',
      id,
    );

    let rawApplications = [];

    try {
      if (isAdmin) {
        const applicationsSnapshot = await applicationsQuery
          .orderBy('createdAt', 'desc')
          .limit(APPLICATION_HISTORY_LIMIT)
          .get();

        rawApplications = applicationsSnapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
      } else {
        rawApplications = await collectCompanyApplicationHistory({
          companyId: uid,
          limit: APPLICATION_HISTORY_LIMIT,
          fetchPage: async (cursor) => {
            let query = applicationsQuery
              .orderBy('createdAt', 'desc')
              .limit(APPLICATION_HISTORY_PAGE_SIZE);

            if (cursor) {
              query = query.startAfter(cursor);
            }

            const snapshot = await query.get();
            const lastDocument =
              snapshot.docs[snapshot.docs.length - 1] || null;

            return {
              applications: snapshot.docs.map((doc) => ({
                id: doc.id,
                ...doc.data(),
              })),
              cursor: lastDocument,
              hasMore: snapshot.docs.length === APPLICATION_HISTORY_PAGE_SIZE,
            };
          },
          fetchJob: async (jobId) => {
            const jobDoc = await firestore.collection('jobs').doc(jobId).get();
            return jobDoc.exists ? jobDoc.data() || {} : {};
          },
        });
      }
    } catch (historyError) {
      console.error(
        'Erro ao carregar histórico de candidaturas do candidato:',
        historyError,
      );
      rawApplications = [];
    }

    const applications = rawApplications.map((application) => ({
      id: application.id,
      jobTitle: application.jobTitle || '',
      status: application.status || 'pending',
      createdAt: safeTimestampToMillis(application.createdAt),
    }));

    // Uma empresa pode sempre ver o perfil de quem se candidatou às suas vagas,
    // mesmo com o perfil privado — a candidatura é o consentimento de partilha.
    const hasCompanyApplication = isEmpresa && applications.length > 0;
    if (
      !isAdmin &&
      !hasCompanyApplication &&
      !canViewerAccessCandidate(privacy, { isAdmin, isEmpresa })
    ) {
      return { notFound: true };
    }

    // Só contabilizar uma visualização depois de todas as regras de acesso
    // terem autorizado a página. Um pedido recusado por privacidade não deve
    // aparecer ao candidato como uma visita real ao seu perfil.
    if (isEmpresa) {
      const dayKey = new Date().toISOString().slice(0, 10);
      const viewRef = admin
        .firestore()
        .collection('candidateProfileViews')
        .doc(`${id}_${uid}_${dayKey}`);
      await viewRef.set(
        {
          candidateId: id,
          companyId: uid,
          companyName: userData.name || userData.fullName || 'Empresa',
          dayKey,
          viewedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true },
      );
    }

    return {
      props: {
        candidato,
        applications,
        contactLocked,
        contactHiddenByCandidate,
        messagingLocked,
      },
    };
  } catch (error) {
    console.error('Erro ao carregar candidato:', error);
    return { notFound: true };
  }
}
