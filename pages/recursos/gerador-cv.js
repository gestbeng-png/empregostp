import Head from 'next/head';
import Link from 'next/link';
import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from 'react';
import AutoSaveStatus from '../../components/forms/AutoSaveStatus';
import PublicPageShell from '../../components/PublicPageShell';
import { useAuth } from '../../context/AuthContext';
import useAutoDraft from '../../hooks/useAutoDraft';
import {
  canUseCvGenerator,
  getPlanSummary,
} from '../../lib/candidatePlanFeatures';
import { resolveProfessionalResourceAccess } from '../../lib/resourcePremiumAccess';
import { slugifyFilename } from '../../lib/resourcesCatalog';
import { validarFormularioCv } from '../../lib/cvValidation';
import { formatarIntervaloAnos } from '../../lib/cvDates';
import { readLocalDraft, writeLocalDraft } from '../../lib/formDraft';
import {
  CV_LOCAL_PHOTO_MAX_DATA_URL_LENGTH,
  encodeCanvasAsStorableCvPhoto,
  isStorableLocalCvPhoto,
  mergeCvDraftWithLocalPhoto,
} from '../../lib/cvDraftPhoto';
import {
  FiUser,
  FiBriefcase,
  FiBookOpen,
  FiStar,
  FiCheck,
  FiChevronLeft,
  FiChevronRight,
  FiDownload,
  FiEye,
  FiArrowLeft,
  FiCamera,
  FiSave,
  FiTrash2,
  FiPlus,
  FiCheckCircle,
  FiX,
} from 'react-icons/fi';
import styles from '../../styles/GeradorCv.module.css';
import { redirectToLogin } from '../../lib/loginRedirect';

const STEPS = [
  {
    id: 'pessoal',
    short: 'Pessoal',
    label: 'Informações pessoais',
    icon: FiUser,
    description:
      'Comece pelos seus dados, contactos e uma apresentação profissional concisa.',
  },
  {
    id: 'experiencia',
    short: 'Experiência',
    label: 'Experiência profissional',
    icon: FiBriefcase,
    description: 'Adicione o seu percurso, começando pela função mais recente.',
  },
  {
    id: 'formacao',
    short: 'Formação',
    label: 'Formação e credenciais',
    icon: FiBookOpen,
    description:
      'Reúna formação académica, projetos relevantes e certificações.',
  },
  {
    id: 'competencias',
    short: 'Competências',
    label: 'Competências, idiomas e extras',
    icon: FiStar,
    description: 'Competências, idiomas, interesses e informação de apoio.',
  },
];

const CV_DRAFT_VERSION = 1;
const getCvDraftKey = (uid) => `empregostp:cv-draft:${uid}`;

const createId = (prefix) =>
  `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const createExperience = () => ({
  id: createId('exp'),
  role: '',
  employer: '',
  city: '',
  country: '',
  startDate: '',
  endDate: '',
  current: false,
  description: '',
  achievements: '',
});

const createEducation = () => ({
  id: createId('edu'),
  qualification: '',
  institution: '',
  city: '',
  country: '',
  startDate: '',
  endDate: '',
  details: '',
});

const createLanguage = () => ({
  id: createId('lang'),
  name: '',
  level: '',
});

const createProject = () => ({
  id: createId('project'),
  name: '',
  role: '',
  link: '',
  summary: '',
});

const createCertification = () => ({
  id: createId('cert'),
  title: '',
  issuer: '',
  year: '',
});

const initialForm = {
  photo: '',
  fullName: '',
  headline: '',
  email: '',
  phone: '',
  location: '',
  nationality: '',
  birthDate: '',
  linkedin: '',
  website: '',
  portfolio: '',
  summary: '',
  objective: '',
  technicalSkills: '',
  digitalSkills: '',
  softSkills: '',
  interests: '',
  drivingLicense: '',
  references: '',
  additionalInfo: '',
};

const isDraftObject = (value) =>
  Boolean(value && typeof value === 'object' && !Array.isArray(value));

const normalizeDraftStep = (value) => {
  const numericStep = Number(value);
  if (!Number.isInteger(numericStep)) return 0;
  return Math.max(0, Math.min(numericStep, STEPS.length - 1));
};

const normalizeCvDraft = (draft) => {
  if (!isDraftObject(draft)) return null;

  return {
    form: isDraftObject(draft.form) ? draft.form : {},
    experiences: Array.isArray(draft.experiences) ? draft.experiences : [],
    educationEntries: Array.isArray(draft.educationEntries)
      ? draft.educationEntries
      : [],
    languageEntries: Array.isArray(draft.languageEntries)
      ? draft.languageEntries
      : [],
    projectEntries: Array.isArray(draft.projectEntries)
      ? draft.projectEntries
      : [],
    certificationEntries: Array.isArray(draft.certificationEntries)
      ? draft.certificationEntries
      : [],
    currentStep: normalizeDraftStep(draft.currentStep),
  };
};

const migrateLegacyCvDraft = (legacyDraft) => {
  if (
    !isDraftObject(legacyDraft) ||
    legacyDraft.version !== CV_DRAFT_VERSION ||
    !isDraftObject(legacyDraft.form)
  ) {
    return null;
  }

  const migratedDraft = normalizeCvDraft(legacyDraft);
  const migratedForm = { ...migratedDraft.form };

  // O formato manual v1 guardava uma string vazia quando a fotografia local
  // era um data URL. Omiti-la mantém a fotografia já existente no perfil.
  if (!migratedForm.photo || String(migratedForm.photo).startsWith('data:')) {
    delete migratedForm.photo;
  }

  return {
    ...migratedDraft,
    form: migratedForm,
  };
};

const prepareCvDraftForPersistence = (draft) => {
  const preparedDraft = normalizeCvDraft(draft);
  if (!preparedDraft) return draft;

  const preparedForm = { ...preparedDraft.form };
  if (String(preparedForm.photo || '').startsWith('data:')) {
    delete preparedForm.photo;
  }

  return {
    ...preparedDraft,
    form: preparedForm,
  };
};

const prepareCvLocalDraft = (draft) => normalizeCvDraft(draft) || draft;

const nonEmpty = (...values) =>
  values.map((value) => String(value || '').trim()).filter(Boolean);

const splitItems = (value) =>
  String(value || '')
    .split(/\n|,/)
    .map((item) => item.trim())
    .filter(Boolean);

const hasExperienceContent = (item) =>
  Boolean(
    item.role ||
    item.employer ||
    item.city ||
    item.country ||
    item.startDate ||
    item.endDate ||
    item.description ||
    item.achievements,
  );

const hasEducationContent = (item) =>
  Boolean(
    item.qualification ||
    item.institution ||
    item.city ||
    item.country ||
    item.startDate ||
    item.endDate ||
    item.details,
  );

const hasLanguageContent = (item) => Boolean(item.name || item.level);
const hasProjectContent = (item) =>
  Boolean(item.name || item.role || item.link || item.summary);
const hasCertificationContent = (item) =>
  Boolean(item.title || item.issuer || item.year);

const formatBirthDate = (value) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('pt-PT', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  }).format(date);
};

const fileToDataUrl = (file) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('Falha ao processar a imagem.'));
    reader.readAsDataURL(file);
  });

const imageUrlToDataUrl = async (imageUrl) => {
  if (!imageUrl) return '';
  if (String(imageUrl).startsWith('data:image/')) return imageUrl;
  const response = await fetch(imageUrl);
  if (!response.ok)
    throw new Error('Não foi possível carregar a foto de perfil.');
  const blob = await response.blob();
  return fileToDataUrl(blob);
};

const loadImageElement = (source) =>
  new Promise((resolve, reject) => {
    const image = new window.Image();
    image.onload = () => resolve(image);
    image.onerror = () =>
      reject(new Error('Não foi possível abrir a imagem para o PDF.'));
    image.src = source;
  });

export const normalizePhotoForPdf = async (source) => {
  if (!source) return '';
  const rawDataUrl = await imageUrlToDataUrl(source);
  if (!rawDataUrl) return '';

  const image = await loadImageElement(rawDataUrl);
  const canvas = document.createElement('canvas');

  // Fotografias aceites podem ter até 3 MB. Reamostramos e reduzimos a
  // qualidade de forma progressiva para garantir que o data URL final cabe no
  // rascunho local. A imagem nunca segue no payload remoto.
  for (const dimension of [640, 512, 384, 320]) {
    canvas.width = dimension;
    canvas.height = dimension;
    const context = canvas.getContext('2d');
    if (!context) break;

    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, canvas.width, canvas.height);

    const scale = Math.max(
      canvas.width / image.width,
      canvas.height / image.height,
    );
    const width = image.width * scale;
    const height = image.height * scale;
    const x = (canvas.width - width) / 2;
    const y = (canvas.height - height) / 2;
    context.drawImage(image, x, y, width, height);

    const encoded = encodeCanvasAsStorableCvPhoto(canvas);
    if (encoded) return encoded;
  }

  if (isStorableLocalCvPhoto(rawDataUrl)) return rawDataUrl;
  throw new Error('Não foi possível otimizar a fotografia para o rascunho.');
};

const normalizeExternalUrl = (value) => {
  const raw = String(value || '').trim();
  if (!raw) return '';
  if (raw.startsWith('mailto:') || raw.startsWith('tel:')) return raw;
  if (raw.startsWith('http://') || raw.startsWith('https://')) return raw;
  if (raw.startsWith('www.')) return `https://${raw}`;
  // Ex.: linkedin.com/in/... -> https://linkedin.com/in/...
  if (!raw.includes('://') && /^[a-z0-9.-]+\\.[a-z]{2,}/i.test(raw)) {
    return `https://${raw}`;
  }
  // Evita gerar links inválidos no PDF. Mantemos o texto, mas não criamos hyperlink.
  return raw;
};

const buildCvDocument = (
  form,
  experiences,
  educationEntries,
  languages,
  projects,
  certifications,
) => {
  const parsedExperiences = experiences
    .filter(hasExperienceContent)
    .map((item) => ({
      id: item.id,
      title:
        nonEmpty(item.role, item.employer).join(' · ') ||
        'Experiência profissional',
      meta: nonEmpty(
        formatarIntervaloAnos(item.startDate, item.endDate, item.current),
        nonEmpty(item.city, item.country).join(', '),
      ).join(' • '),
      description: String(item.description || '').trim(),
      achievements: splitItems(item.achievements),
    }));

  const parsedEducation = educationEntries
    .filter(hasEducationContent)
    .map((item) => ({
      id: item.id,
      title:
        nonEmpty(item.qualification, item.institution).join(' · ') ||
        'Formação académica',
      meta: nonEmpty(
        formatarIntervaloAnos(item.startDate, item.endDate, false),
        nonEmpty(item.city, item.country).join(', '),
      ).join(' • '),
      description: String(item.details || '').trim(),
    }));

  const parsedLanguages = languages.filter(hasLanguageContent).map((item) => ({
    id: item.id,
    title: String(item.name || '').trim(),
    meta: String(item.level || '').trim(),
  }));

  const parsedProjects = projects.filter(hasProjectContent).map((item) => ({
    id: item.id,
    title: String(item.name || '').trim() || 'Projeto',
    meta: nonEmpty(item.role, item.link).join(' • '),
    description: String(item.summary || '').trim(),
  }));

  const parsedCertifications = certifications
    .filter(hasCertificationContent)
    .map((item) => ({
      id: item.id,
      title: String(item.title || '').trim() || 'Certificação',
      meta: nonEmpty(item.issuer, item.year).join(' • '),
    }));

  return {
    photo: String(form.photo || '').trim(),
    fullName: String(form.fullName || '').trim() || 'Nome Completo',
    headline: String(form.headline || '').trim(),
    summary: String(form.summary || '').trim(),
    objective: String(form.objective || '').trim(),
    personal: {
      email: String(form.email || '').trim(),
      phone: String(form.phone || '').trim(),
      location: String(form.location || '').trim(),
      nationality: String(form.nationality || '').trim(),
      birthDate: String(form.birthDate || '').trim(),
      birthDateFormatted: form.birthDate ? formatBirthDate(form.birthDate) : '',
      drivingLicense: String(form.drivingLicense || '').trim(),
      linkedin: String(form.linkedin || '').trim(),
      website: String(form.website || '').trim(),
      portfolio: String(form.portfolio || '').trim(),
    },
    contactItems: nonEmpty(form.email, form.phone, form.location),
    profileItems: nonEmpty(
      form.nationality ? `Nacionalidade: ${form.nationality}` : '',
      form.birthDate ? `Nascimento: ${formatBirthDate(form.birthDate)}` : '',
      form.drivingLicense ? `Carta de condução: ${form.drivingLicense}` : '',
    ),
    linkItems: nonEmpty(form.linkedin, form.website, form.portfolio),
    technicalSkills: splitItems(form.technicalSkills),
    digitalSkills: splitItems(form.digitalSkills),
    softSkills: splitItems(form.softSkills),
    interests: splitItems(form.interests),
    references: splitItems(form.references),
    additionalInfo: splitItems(form.additionalInfo),
    experiences: parsedExperiences,
    educationEntries: parsedEducation,
    languages: parsedLanguages,
    projects: parsedProjects,
    certifications: parsedCertifications,
  };
};

function TextField({
  label,
  value,
  onChange,
  onBlur,
  type = 'text',
  placeholder,
  error = '',
  hint = '',
}) {
  const id = useId();
  const idErro = `${id}-erro`;
  const idAjuda = `${id}-ajuda`;

  return (
    <label className={styles.field} htmlFor={id}>
      <span>{label}</span>
      <input
        id={id}
        className={`${styles.input} ${error ? styles.inputInvalid : ''}`}
        value={value}
        onChange={onChange}
        onBlur={onBlur}
        type={type}
        placeholder={placeholder}
        aria-invalid={error ? 'true' : undefined}
        aria-describedby={error ? idErro : hint ? idAjuda : undefined}
      />
      {error ? (
        <small id={idErro} className={styles.fieldError} role="alert">
          {error}
        </small>
      ) : hint ? (
        <small id={idAjuda} className={styles.characterCount}>
          {hint}
        </small>
      ) : null}
    </label>
  );
}

function TextAreaField({
  label,
  value,
  onChange,
  onBlur,
  placeholder,
  compact = false,
  maxLength,
  showCount = false,
  showChips = false,
  error = '',
}) {
  const chips = showChips ? splitItems(value) : [];

  return (
    <label className={styles.field}>
      <span>{label}</span>
      <textarea
        className={`${styles.textarea} ${compact ? styles.compactTextarea : ''} ${
          error ? styles.inputInvalid : ''
        }`}
        value={value}
        onChange={onChange}
        onBlur={onBlur}
        placeholder={placeholder}
        maxLength={maxLength}
        aria-invalid={error ? 'true' : undefined}
      />
      {error ? (
        <small className={styles.fieldError} role="alert">
          {error}
        </small>
      ) : null}
      {showCount && maxLength ? (
        <small className={styles.characterCount}>
          {String(value || '').length} / {maxLength} caracteres
        </small>
      ) : null}
      {chips.length ? (
        <span className={styles.tagRow} aria-label={`${label} adicionadas`}>
          {chips.map((chip, index) => (
            <span key={`${chip}-${index}`} className={styles.tag}>
              {chip}
            </span>
          ))}
        </span>
      ) : null}
    </label>
  );
}

function PreviewBlock({ title, children, sidebar = false }) {
  return (
    <section
      className={sidebar ? styles.previewSidebarCard : styles.previewSection}
    >
      <h3 className={styles.previewSectionTitle}>{title}</h3>
      {children}
    </section>
  );
}

function LockedState({
  title,
  description,
  ctaHref,
  ctaLabel,
  secondaryHref,
  secondaryLabel,
}) {
  return (
    <div className={styles.lockCard}>
      <h2>{title}</h2>
      <p>{description}</p>
      <div className={styles.badgeRow}>
        <span className={styles.badge}>Modelo completo estilo Europass</span>
        <span className={styles.badge}>Pré-visualização profissional</span>
        <span className={styles.badge}>Exportação PDF</span>
      </div>
      <div className={styles.actions}>
        {ctaHref ? (
          <Link href={ctaHref} className={styles.primaryButton}>
            {ctaLabel}
          </Link>
        ) : null}
        {secondaryHref ? (
          <Link href={secondaryHref} className={styles.button}>
            {secondaryLabel}
          </Link>
        ) : null}
      </div>
    </div>
  );
}

export default function GeradorCvPage() {
  const { user, loading: authLoading } = useAuth();
  const [form, setForm] = useState(initialForm);
  const [experiences, setExperiences] = useState([createExperience()]);
  const [educationEntries, setEducationEntries] = useState([createEducation()]);
  const [languageEntries, setLanguageEntries] = useState([createLanguage()]);
  const [projectEntries, setProjectEntries] = useState([createProject()]);
  const [certificationEntries, setCertificationEntries] = useState([
    createCertification(),
  ]);
  const [profileLoading, setProfileLoading] = useState(true);
  const [profileError, setProfileError] = useState('');
  const [photoError, setPhotoError] = useState('');
  const [gate, setGate] = useState({
    status: 'loading',
    message: '',
    planName: '',
  });
  const [statusMessage, setStatusMessage] = useState('');
  const [isExporting, setIsExporting] = useState(false);
  // `tocados` guarda os campos que o utilizador já visitou: só mostramos o erro
  // depois de sair do campo, para não o corrigir enquanto ainda está a escrever.
  const [tocados, setTocados] = useState({});
  const [mostrarTodosErros, setMostrarTodosErros] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [previewOpenMobile, setPreviewOpenMobile] = useState(false);
  const wizardRef = useRef(null);
  const preservedLocalPhotoRef = useRef('');

  const draftValue = useMemo(
    () => ({
      form,
      experiences,
      educationEntries,
      languageEntries,
      projectEntries,
      certificationEntries,
      currentStep,
    }),
    [
      form,
      experiences,
      educationEntries,
      languageEntries,
      projectEntries,
      certificationEntries,
      currentStep,
    ],
  );

  const restoreDraft = useCallback(
    (draft, metadata = {}) => {
      const restoredDraft = normalizeCvDraft(draft);
      if (!restoredDraft) return;

      const mergedDraft = mergeCvDraftWithLocalPhoto(
        restoredDraft,
        preservedLocalPhotoRef.current,
      );
      const restoredPhoto = mergedDraft.form.photo;
      if (isStorableLocalCvPhoto(restoredPhoto)) {
        preservedLocalPhotoRef.current = restoredPhoto;
      } else if (
        Object.prototype.hasOwnProperty.call(mergedDraft.form, 'photo')
      ) {
        preservedLocalPhotoRef.current = '';
      }

      if (
        metadata.source === 'remote' &&
        mergedDraft !== restoredDraft &&
        typeof window !== 'undefined' &&
        user?.uid
      ) {
        const savedAtMs = Date.parse(String(metadata.savedAt || ''));
        try {
          // O rascunho remoto não contém data URLs por desenho. Voltamos a
          // associar apenas a fotografia privada deste dispositivo antes que o
          // espelho remoto substitua a cópia local.
          writeLocalDraft(
            window.localStorage,
            getCvDraftKey(user.uid),
            mergedDraft,
            {
              version: CV_DRAFT_VERSION,
              allowDataUrls: true,
              maxDataUrlLength: CV_LOCAL_PHOTO_MAX_DATA_URL_LENGTH,
              ...(Number.isFinite(savedAtMs) ? { now: savedAtMs } : {}),
            },
          );
        } catch {
          // A restauração em memória continua mesmo sem localStorage disponível.
        }
      }

      setForm((previous) => {
        const restoredForm = { ...mergedDraft.form };
        const hasStoredPhoto = Object.prototype.hasOwnProperty.call(
          restoredForm,
          'photo',
        );

        return {
          ...previous,
          ...restoredForm,
          photo: hasStoredPhoto ? restoredForm.photo : previous.photo,
        };
      });
      setExperiences(mergedDraft.experiences);
      setEducationEntries(mergedDraft.educationEntries);
      setLanguageEntries(mergedDraft.languageEntries);
      setProjectEntries(mergedDraft.projectEntries);
      setCertificationEntries(mergedDraft.certificationEntries);
      setCurrentStep(mergedDraft.currentStep);
    },
    [user?.uid],
  );

  const getDraftToken = useCallback(() => user?.getIdToken(), [user]);
  const {
    status: autoSaveStatus,
    lastSavedAt: autoSaveLastSavedAt,
    isOnline: autoSaveIsOnline,
    saveNow,
  } = useAutoDraft({
    storageKey: user?.uid ? getCvDraftKey(user.uid) : '',
    scope: 'cv-generator',
    resourceId: 'default',
    value: draftValue,
    onRestore: restoreDraft,
    getToken: getDraftToken,
    enabled: Boolean(user?.uid),
    ready: gate.status === 'ready' || gate.status === 'offline',
    migrate: migrateLegacyCvDraft,
    prepareLocal: prepareCvLocalDraft,
    prepareRemote: prepareCvDraftForPersistence,
    allowLocalDataUrls: true,
    maxLocalDataUrlLength: CV_LOCAL_PHOTO_MAX_DATA_URL_LENGTH,
  });

  useEffect(() => {
    const hydrateProfile = async () => {
      if (authLoading) return;

      if (!user) {
        setGate({
          status: 'anonymous',
          message:
            'O gerador avançado de CV está disponível apenas para candidatos com plano Profissional ou Premium.',
          planName: '',
        });
        setProfileLoading(false);
        return;
      }

      try {
        setProfileLoading(true);
        setProfileError('');
        const token = await user.getIdToken();
        const response = await fetch('/api/profile', {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(
            data.error || 'Não foi possível carregar o perfil do candidato.',
          );
        }

        const profile = data.profile?.data || {};
        if (profile.userType !== 'candidato') {
          setGate({
            status: 'forbidden',
            message: 'Este recurso é exclusivo para contas de candidato.',
            planName: '',
          });
          return;
        }

        const planSummary = getPlanSummary(profile);
        const access = canUseCvGenerator(planSummary.planId);
        if (!access.allowed) {
          setGate({
            status: 'upgrade',
            message: access.reason,
            planName: planSummary.planName || 'Básico',
          });
          return;
        }

        const technicalSkillsValue = Array.isArray(profile.skillsHard)
          ? profile.skillsHard.join(', ')
          : profile.skillsHard || '';
        const digitalSkillsValue = Array.isArray(profile.digitalSkills)
          ? profile.digitalSkills.join(', ')
          : profile.digitalSkills || '';

        setForm((previous) => ({
          ...previous,
          photo: profile.photoUrl || profile.photo || previous.photo,
          fullName: profile.fullName || previous.fullName,
          headline: profile.headline || previous.headline,
          email: profile.email || previous.email,
          phone: profile.phone || previous.phone,
          location: profile.city || profile.location || previous.location,
          nationality: profile.nationality || previous.nationality,
          birthDate: profile.birthDate || previous.birthDate,
          linkedin: profile.linkedin || previous.linkedin,
          website: profile.website || previous.website,
          summary: profile.bio || previous.summary,
          objective: profile.objectiveAspiration || previous.objective,
          technicalSkills: technicalSkillsValue || previous.technicalSkills,
          digitalSkills: digitalSkillsValue || previous.digitalSkills,
          softSkills: profile.skillsSoft || previous.softSkills,
          references: previous.references,
          additionalInfo: previous.additionalInfo,
        }));

        if (Array.isArray(profile.experience) && profile.experience.length) {
          setExperiences(
            profile.experience.map((item) => ({
              ...createExperience(),
              role: item.role || '',
              employer: item.company || '',
              description: item.description || '',
              achievements: item.period || '',
            })),
          );
        }

        if (profile.languages) {
          const parsedLanguages = splitItems(profile.languages).map((item) => ({
            ...createLanguage(),
            name: item,
            level: '',
          }));
          if (parsedLanguages.length) setLanguageEntries(parsedLanguages);
        }

        if (profile.certifications) {
          const parsedCertifications = splitItems(profile.certifications).map(
            (item) => ({
              ...createCertification(),
              title: item,
              issuer: '',
              year: '',
            }),
          );
          if (parsedCertifications.length)
            setCertificationEntries(parsedCertifications);
        }

        setGate({
          status: 'ready',
          message: '',
          planName: planSummary.planName || 'Profissional',
        });
      } catch (error) {
        console.error('Erro ao carregar dados do gerador de CV:', error);
        const localDraft = readLocalDraft(
          typeof window === 'undefined' ? null : window.localStorage,
          user?.uid ? getCvDraftKey(user.uid) : '',
          { migrate: migrateLegacyCvDraft },
        );

        if (localDraft?.data) {
          setProfileError('');
          setGate({
            status: 'offline',
            message: 'A trabalhar com o rascunho guardado neste dispositivo.',
            planName: 'Offline',
          });
        } else {
          setProfileError(error.message || 'Erro ao carregar o gerador de CV.');
          setGate({ status: 'error', message: '', planName: '' });
        }
      } finally {
        setProfileLoading(false);
      }
    };

    hydrateProfile();
  }, [authLoading, user]);

  const validacao = useMemo(() => validarFormularioCv(form), [form]);

  const marcarTocado = useCallback(
    (campo) => () =>
      setTocados((anteriores) => ({ ...anteriores, [campo]: true })),
    [],
  );

  /** Erro a mostrar num campo simples: só depois de tocado ou de tentar exportar. */
  const erroDe = useCallback(
    (campo) =>
      tocados[campo] || mostrarTodosErros ? validacao.erros[campo] || '' : '',
    [tocados, mostrarTodosErros, validacao],
  );

  /** Erro a mostrar num campo de uma lista (experiências, formação, ...). */
  const erroDaLista = useCallback(
    (lista, indice, campo) => {
      const chave = `${lista}.${indice}.${campo}`;
      if (!tocados[chave] && !mostrarTodosErros) return '';
      return validacao.erros[lista]?.[indice]?.[campo] || '';
    },
    [tocados, mostrarTodosErros, validacao],
  );

  const cvDocument = useMemo(
    () =>
      buildCvDocument(
        form,
        experiences,
        educationEntries,
        languageEntries,
        projectEntries,
        certificationEntries,
      ),
    [
      form,
      experiences,
      educationEntries,
      languageEntries,
      projectEntries,
      certificationEntries,
    ],
  );

  const completedSteps = useMemo(
    () => [
      Boolean(
        String(form.fullName || '').trim() &&
        (String(form.email || '').trim() ||
          String(form.phone || '').trim() ||
          String(form.summary || '').trim()),
      ),
      experiences.some(hasExperienceContent),
      educationEntries.some(hasEducationContent) ||
        projectEntries.some(hasProjectContent) ||
        certificationEntries.some(hasCertificationContent),
      Boolean(
        String(form.technicalSkills || '').trim() ||
        String(form.digitalSkills || '').trim() ||
        String(form.softSkills || '').trim() ||
        String(form.interests || '').trim() ||
        String(form.references || '').trim() ||
        String(form.additionalInfo || '').trim() ||
        languageEntries.some(hasLanguageContent),
      ),
    ],
    [
      form,
      experiences,
      educationEntries,
      projectEntries,
      certificationEntries,
      languageEntries,
    ],
  );

  // Em telemóvel a pré-visualização ocupa o ecrã todo (ver `.previewColumnOpen`
  // no CSS): enquanto está aberta, o fundo não deve deslizar e o Escape fecha.
  useEffect(() => {
    if (typeof window === 'undefined' || !previewOpenMobile) return undefined;

    const emTelemovel = window.matchMedia('(max-width: 680px)');
    if (!emTelemovel.matches) return undefined;

    function fecharComEscape(event) {
      if (event.key === 'Escape') setPreviewOpenMobile(false);
    }

    document.body.classList.add('modal-open');
    document.addEventListener('keydown', fecharComEscape);

    return () => {
      document.body.classList.remove('modal-open');
      document.removeEventListener('keydown', fecharComEscape);
    };
  }, [previewOpenMobile]);

  const goToStep = (index) => {
    setCurrentStep(Math.max(0, Math.min(index, STEPS.length - 1)));
    if (typeof window !== 'undefined') {
      window.requestAnimationFrame(() => {
        wizardRef.current?.scrollIntoView({
          behavior: 'smooth',
          block: 'start',
        });
      });
    }
  };
  const goNext = () => goToStep(currentStep + 1);
  const goPrev = () => goToStep(currentStep - 1);

  const updateCollectionItem = (setter, id, field, value) => {
    setter((previous) =>
      previous.map((item) =>
        item.id === id ? { ...item, [field]: value } : item,
      ),
    );
  };

  const removeCollectionItem = (setter, fallbackFactory, id) => {
    setter((previous) => {
      const next = previous.filter((item) => item.id !== id);
      return next.length ? next : [fallbackFactory()];
    });
  };

  const handlePhotoUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setPhotoError('Selecione apenas ficheiros de imagem.');
      return;
    }

    if (file.size > 3 * 1024 * 1024) {
      setPhotoError('A foto deve ter no máximo 3 MB.');
      return;
    }

    try {
      const dataUrl = await fileToDataUrl(file);
      const optimizedPhoto = await normalizePhotoForPdf(dataUrl);
      preservedLocalPhotoRef.current = optimizedPhoto;
      setForm((prev) => ({ ...prev, photo: optimizedPhoto }));
      setPhotoError('');
    } catch (error) {
      setPhotoError('Não foi possível processar a imagem.');
    }
  };

  const removePhoto = () => {
    preservedLocalPhotoRef.current = '';
    setForm((prev) => ({ ...prev, photo: '' }));
    setPhotoError('');
  };

  const exportPdf = async () => {
    if (gate.status !== 'ready' && gate.status !== 'offline') return;

    // Exportar um CV com um email inválido ou datas trocadas é pior do que não
    // exportar: o candidato só descobre quando ninguém lhe responde.
    if (!validacao.valido) {
      setMostrarTodosErros(true);
      setStatusMessage(
        validacao.total === 1
          ? 'Há 1 campo por corrigir antes de exportar o PDF.'
          : `Há ${validacao.total} campos por corrigir antes de exportar o PDF.`,
      );
      wizardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      return;
    }

    try {
      setIsExporting(true);
      setStatusMessage('');
      // O desenho do PDF vive em lib/cvPdf.js: o formulário e o layout do
      // documento mudam por razões diferentes.
      const { gerarCvPdf } = await import('../../lib/cvPdf');
      const doc = await gerarCvPdf(cvDocument, {
        normalizarUrl: normalizeExternalUrl,
        // Converte URLs remotos do perfil em data URL antes do recorte.
        prepararFoto: normalizePhotoForPdf,
      });
      doc.save(
        `${slugifyFilename(cvDocument.fullName || 'cv-profissional')}.pdf`,
      );
      setStatusMessage('PDF gerado com sucesso.');
    } catch (error) {
      console.error('Erro ao gerar PDF do CV:', error);
      setStatusMessage('Não foi possível gerar o PDF agora. Tente novamente.');
    } finally {
      setIsExporting(false);
    }
  };

  const renderEuropassSectionHeader = (title) => (
    <div className={`${styles.europassRow} ${styles.europassSectionHeaderRow}`}>
      <div className={styles.europassLeft}>
        <span className={styles.europassSectionTitle}>
          {String(title).toUpperCase()}
        </span>
      </div>
      <div className={styles.europassRight}>
        <div className={styles.europassDivider} />
      </div>
    </div>
  );

  const renderEuropassFieldRow = (label, value, { href } = {}) => {
    const safeValue = String(value || '').trim();
    const safeHref = String(href || '').trim();
    const canLink = Boolean(
      safeHref &&
      (safeHref.startsWith('http://') ||
        safeHref.startsWith('https://') ||
        safeHref.startsWith('mailto:') ||
        safeHref.startsWith('tel:')),
    );
    return (
      <div className={styles.europassRow}>
        <div className={styles.europassLeft}>{label}</div>
        <div className={styles.europassRight}>
          {safeValue ? (
            canLink ? (
              <a
                className={styles.europassLink}
                href={safeHref}
                target="_blank"
                rel="noreferrer"
              >
                {safeValue}
              </a>
            ) : (
              safeValue
            )
          ) : (
            <span className={styles.europassPlaceholder}>Por preencher</span>
          )}
        </div>
      </div>
    );
  };

  const renderEuropassBulletsRow = (label, items) => {
    const safeItems = Array.isArray(items) ? items.filter(Boolean) : [];
    return (
      <div className={styles.europassRow}>
        <div className={styles.europassLeft}>{label}</div>
        <div className={styles.europassRight}>
          {safeItems.length ? (
            <ul className={styles.europassBullets}>
              {safeItems.map((item) => (
                <li key={`${label}-${item}`}>{item}</li>
              ))}
            </ul>
          ) : (
            <span className={styles.europassPlaceholder}>Por preencher</span>
          )}
        </div>
      </div>
    );
  };

  const renderEuropassEntries = (items) => {
    if (!items.length) {
      return (
        <div className={styles.europassRow}>
          <div className={styles.europassLeft} />
          <div className={styles.europassRight}>
            <span className={styles.europassPlaceholder}>
              Adicione conteúdo nesta secção para ver o resultado final.
            </span>
          </div>
        </div>
      );
    }

    return items.map((item) => {
      const metaParts = String(item.meta || '')
        .split('•')
        .map((part) => part.trim())
        .filter(Boolean);
      const dateLabel = metaParts[0] || '';
      const metaRest = metaParts.slice(1).join(' • ');
      return (
        <div key={item.id} className={styles.europassRow}>
          <div className={styles.europassLeft}>{dateLabel || ' '}</div>
          <div className={styles.europassRight}>
            <div className={styles.europassEntryTitle}>{item.title}</div>
            {metaRest ? (
              <div className={styles.europassEntryMeta}>{metaRest}</div>
            ) : null}
            {item.description ? (
              <p className={styles.europassText}>{item.description}</p>
            ) : null}
            {Array.isArray(item.achievements) && item.achievements.length ? (
              <ul className={styles.europassBullets}>
                {item.achievements.map((ach) => (
                  <li key={`${item.id}-${ach}`}>{ach}</li>
                ))}
              </ul>
            ) : null}
          </div>
        </div>
      );
    });
  };

  const activeStep = STEPS[currentStep] || STEPS[0];
  const ActiveStepIcon = activeStep.icon;

  const title =
    gate.status === 'ready' || gate.status === 'offline'
      ? 'Gerador de CV Profissional | Recursos EmpregoSTP'
      : 'Gerador de CV Premium | Recursos EmpregoSTP';

  return (
    <>
      <Head>
        <title>{title}</title>
        <meta
          name="description"
          content="Crie um currículo completo, no estilo Europass, com pré-visualização profissional e exportação em PDF no EmpregoSTP."
        />
      </Head>
      <PublicPageShell>
        <div className={styles.page}>
          <div className={styles.container}>
            <Link href="/recursos" className={styles.breadcrumb}>
              <FiArrowLeft aria-hidden="true" />
              Voltar aos recursos
            </Link>

            <section className={styles.hero}>
              <div className={styles.heroCopy}>
                <div className={styles.eyebrow}>Criador de CV</div>
                <h1 className={styles.title}>Gerador de CV profissional</h1>
                <p className={styles.subtitle}>
                  Construa o seu perfil profissional passo a passo, mantendo
                  toda a sua experiência, formação, competências e ligações num
                  currículo claro e competitivo.
                </p>
              </div>
              <aside className={styles.heroAside}>
                <h2 className={styles.heroAsideTitle}>
                  {gate.status === 'ready' || gate.status === 'offline'
                    ? gate.status === 'offline'
                      ? 'Modo offline'
                      : `Plano ${gate.planName}`
                    : 'Currículo completo'}
                </h2>
                <ul className={styles.featureList}>
                  <li>Preenchimento guiado em 4 etapas</li>
                  <li>Pré-visualização em tempo real com layout editorial</li>
                  <li>Rascunho local para continuar mais tarde</li>
                  <li>Exportação direta em PDF</li>
                </ul>
              </aside>
            </section>

            {authLoading || profileLoading ? (
              <div
                className={styles.loadingCard}
                role="status"
                aria-live="polite"
              >
                <h2>A carregar gerador de CV</h2>
                <p>
                  Estou a validar o plano do candidato e a preparar os dados do
                  perfil para pré-preenchimento.
                </p>
              </div>
            ) : null}

            {!authLoading && !profileLoading && gate.status === 'anonymous' ? (
              <LockedState
                title="Inicie sessão para criar o seu CV"
                description={gate.message}
                ctaHref="/login?redirect=/recursos/gerador-cv"
                ctaLabel="Iniciar sessão"
                secondaryHref="/premium/candidatos"
                secondaryLabel="Ver planos"
              />
            ) : null}

            {!authLoading && !profileLoading && gate.status === 'forbidden' ? (
              <LockedState
                title="Recurso exclusivo para candidatos"
                description={gate.message}
                ctaHref="/dashboard/candidato"
                ctaLabel="Ir para o painel do candidato"
                secondaryHref="/recursos"
                secondaryLabel="Voltar aos recursos"
              />
            ) : null}

            {!authLoading && !profileLoading && gate.status === 'upgrade' ? (
              <LockedState
                title="Disponível nos planos Profissional e Premium"
                description={`${gate.message}${gate.planName ? ` O seu plano atual é ${gate.planName}.` : ''}`}
                ctaHref="/premium/candidatos"
                ctaLabel="Ver planos"
                secondaryHref="/recursos"
                secondaryLabel="Voltar aos recursos"
              />
            ) : null}

            {!authLoading && !profileLoading && gate.status === 'error' ? (
              <div className={styles.errorCard} role="alert">
                <h2>Erro ao carregar o gerador</h2>
                <p>{profileError}</p>
                <div className={styles.actions}>
                  <button
                    type="button"
                    className={styles.primaryButton}
                    onClick={() => window.location.reload()}
                  >
                    Tentar novamente
                  </button>
                  <Link href="/recursos" className={styles.button}>
                    Voltar aos recursos
                  </Link>
                </div>
              </div>
            ) : null}

            {!authLoading &&
            !profileLoading &&
            (gate.status === 'ready' || gate.status === 'offline') ? (
              <div className={styles.wizard} ref={wizardRef}>
                <section className={styles.stepperCard}>
                  <div className={styles.stepperHead}>
                    <div>
                      <h2 className={styles.stepperTitle}>
                        Monte o seu CV, passo a passo
                      </h2>
                      <p className={styles.stepperSubtitle}>
                        Preencha uma etapa de cada vez. Pode voltar atrás e
                        editar sempre que quiser.
                      </p>
                    </div>
                    <div className={styles.stepperMeta}>
                      <span className={styles.badge}>
                        {gate.status === 'offline'
                          ? 'Rascunho offline'
                          : `Plano ${gate.planName}`}
                      </span>
                      <span className={styles.stepperCount}>
                        Passo {currentStep + 1} de {STEPS.length}
                      </span>
                      <strong className={styles.progressPercent}>
                        {Math.round(((currentStep + 1) / STEPS.length) * 100)}%
                      </strong>
                    </div>
                  </div>
                  <progress
                    className={styles.progressTrack}
                    max={STEPS.length}
                    value={currentStep + 1}
                    aria-label={`Progresso do currículo, passo ${currentStep + 1} de ${STEPS.length}`}
                  />
                  <div className={styles.stepper}>
                    {STEPS.map((step, index) => {
                      const StepIcon = step.icon;
                      const isActive = index === currentStep;
                      const isDone = completedSteps[index] && !isActive;
                      return (
                        <button
                          key={step.id}
                          type="button"
                          className={`${styles.stepItem} ${isActive ? styles.stepItemActive : ''} ${isDone ? styles.stepItemDone : ''}`}
                          onClick={() => goToStep(index)}
                          aria-current={isActive ? 'step' : undefined}
                          aria-label={step.label}
                        >
                          <span className={styles.stepDot} aria-hidden="true">
                            {isDone ? <FiCheck /> : <StepIcon />}
                          </span>
                          <span className={styles.stepText}>
                            <span className={styles.stepIndex}>
                              Passo {index + 1}
                            </span>
                            <span className={styles.stepLabel}>
                              {step.label}
                            </span>
                            {/* No telemóvel não cabe o rótulo completo. O
                                `aria-label` do botão já anuncia o nome longo,
                                por isso esta versão curta é decorativa. */}
                            <span
                              className={styles.stepLabelShort}
                              aria-hidden="true"
                            >
                              {step.short}
                            </span>
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </section>

                <div className={styles.layout}>
                  <div className={styles.editorColumn}>
                    <button
                      type="button"
                      className={styles.previewToggle}
                      onClick={() => setPreviewOpenMobile((value) => !value)}
                    >
                      <FiEye aria-hidden="true" />{' '}
                      {previewOpenMobile
                        ? 'Ocultar pré-visualização'
                        : 'Ver pré-visualização'}
                    </button>
                    {statusMessage ? (
                      <p
                        className={styles.statusMessage}
                        role="status"
                        aria-live="polite"
                      >
                        {statusMessage}
                      </p>
                    ) : null}

                    <div className={styles.stepIntro}>
                      <span className={styles.stepIntroIcon} aria-hidden="true">
                        <ActiveStepIcon />
                      </span>
                      <div>
                        <h2 className={styles.stepIntroTitle}>
                          {activeStep.label}
                        </h2>
                        <p className={styles.stepIntroHint}>
                          {activeStep.description}
                        </p>
                      </div>
                    </div>

                    {currentStep === 0 ? (
                      <section className={styles.panel}>
                        <div className={styles.sectionBlock}>
                          <div className={styles.photoRow}>
                            <div className={styles.photoPreviewWrap}>
                              {cvDocument.photo ? (
                                // `next/image` pode falhar em HMR com Turbopack nesta rota.
                                // Usamos `<img>` para estabilidade (a imagem pode ser dataURL).
                                // eslint-disable-next-line @next/next/no-img-element
                                <img
                                  src={cvDocument.photo}
                                  alt="Foto de perfil para CV"
                                  className={styles.photoPreview}
                                  width={92}
                                  height={92}
                                />
                              ) : (
                                <div className={styles.photoPlaceholder}>
                                  <FiCamera aria-hidden="true" />
                                  <span>Sem foto</span>
                                </div>
                              )}
                            </div>
                            <div className={styles.photoActions}>
                              <label className={styles.button}>
                                <FiCamera aria-hidden="true" />
                                Carregar foto
                                <input
                                  type="file"
                                  accept="image/png,image/jpeg,image/jpg,image/webp"
                                  onChange={handlePhotoUpload}
                                  className={styles.hiddenInput}
                                />
                              </label>
                              {cvDocument.photo ? (
                                <button
                                  type="button"
                                  className={styles.ghostButton}
                                  onClick={removePhoto}
                                >
                                  <FiTrash2 aria-hidden="true" />
                                  Remover foto
                                </button>
                              ) : null}
                              <p className={styles.helperText}>
                                A foto é opcional. Recomendamos fundo neutro,
                                proporção 1:1 e até 3 MB.
                              </p>
                              {photoError ? (
                                <p className={styles.photoError} role="alert">
                                  {photoError}
                                </p>
                              ) : null}
                            </div>
                          </div>

                          <div className={styles.grid2}>
                            <TextField
                              label="Nome completo"
                              value={form.fullName}
                              onChange={(event) =>
                                setForm((prev) => ({
                                  ...prev,
                                  fullName: event.target.value,
                                }))
                              }
                              placeholder="Ex.: Maria Graça"
                              error={erroDe('fullName')}
                              onBlur={marcarTocado('fullName')}
                            />
                            <TextField
                              label="Título profissional"
                              value={form.headline}
                              onChange={(event) =>
                                setForm((prev) => ({
                                  ...prev,
                                  headline: event.target.value,
                                }))
                              }
                              placeholder="Ex.: Analista Financeiro | Especialista em Controlo de Gestão"
                            />
                          </div>
                          <div className={styles.grid3}>
                            <TextField
                              label="Email"
                              type="email"
                              value={form.email}
                              onChange={(event) =>
                                setForm((prev) => ({
                                  ...prev,
                                  email: event.target.value,
                                }))
                              }
                              placeholder="maria@exemplo.com"
                              error={erroDe('email')}
                              onBlur={marcarTocado('email')}
                            />
                            <TextField
                              label="Telefone"
                              value={form.phone}
                              onChange={(event) =>
                                setForm((prev) => ({
                                  ...prev,
                                  phone: event.target.value,
                                }))
                              }
                              placeholder="+239 900 0000"
                              error={erroDe('phone')}
                              onBlur={marcarTocado('phone')}
                            />
                            <TextField
                              label="Localização"
                              value={form.location}
                              onChange={(event) =>
                                setForm((prev) => ({
                                  ...prev,
                                  location: event.target.value,
                                }))
                              }
                              placeholder="Cidade, País"
                            />
                          </div>
                          <div className={styles.grid3}>
                            <TextField
                              label="Nacionalidade"
                              value={form.nationality}
                              onChange={(event) =>
                                setForm((prev) => ({
                                  ...prev,
                                  nationality: event.target.value,
                                }))
                              }
                              placeholder="Ex.: São-tomense"
                            />
                            <TextField
                              label="Data de nascimento"
                              type="date"
                              value={form.birthDate}
                              onChange={(event) =>
                                setForm((prev) => ({
                                  ...prev,
                                  birthDate: event.target.value,
                                }))
                              }
                              error={erroDe('birthDate')}
                              onBlur={marcarTocado('birthDate')}
                            />
                            <TextField
                              label="Carta de condução"
                              value={form.drivingLicense}
                              onChange={(event) =>
                                setForm((prev) => ({
                                  ...prev,
                                  drivingLicense: event.target.value,
                                }))
                              }
                              placeholder="Ex.: B"
                            />
                          </div>
                          <div className={styles.grid3}>
                            <TextField
                              label="LinkedIn"
                              value={form.linkedin}
                              onChange={(event) =>
                                setForm((prev) => ({
                                  ...prev,
                                  linkedin: event.target.value,
                                }))
                              }
                              placeholder="https://www.linkedin.com/in/..."
                              error={erroDe('linkedin')}
                              onBlur={marcarTocado('linkedin')}
                            />
                            <TextField
                              label="Website"
                              value={form.website}
                              onChange={(event) =>
                                setForm((prev) => ({
                                  ...prev,
                                  website: event.target.value,
                                }))
                              }
                              placeholder="https://..."
                              error={erroDe('website')}
                              onBlur={marcarTocado('website')}
                            />
                            <TextField
                              label="Portefólio"
                              value={form.portfolio}
                              onChange={(event) =>
                                setForm((prev) => ({
                                  ...prev,
                                  portfolio: event.target.value,
                                }))
                              }
                              placeholder="Behance, GitHub, Dribbble, Notion..."
                              error={erroDe('portfolio')}
                              onBlur={marcarTocado('portfolio')}
                            />
                          </div>
                        </div>
                      </section>
                    ) : null}

                    {currentStep === 0 ? (
                      <section className={styles.panel}>
                        <div className={styles.sectionBlock}>
                          <TextAreaField
                            label="Resumo profissional"
                            value={form.summary}
                            onChange={(event) =>
                              setForm((prev) => ({
                                ...prev,
                                summary: event.target.value,
                              }))
                            }
                            placeholder="Descreva a sua experiência principal, setor, impacto e proposta de valor em 4 a 6 linhas."
                            maxLength={500}
                            showCount
                          />
                          <TextAreaField
                            label="Objetivo profissional"
                            value={form.objective}
                            onChange={(event) =>
                              setForm((prev) => ({
                                ...prev,
                                objective: event.target.value,
                              }))
                            }
                            placeholder="Ex.: Procurar uma função de gestão operacional com foco em eficiência, equipa e melhoria contínua."
                            compact
                          />
                        </div>
                      </section>
                    ) : null}

                    {currentStep === 1 ? (
                      <section className={styles.panel}>
                        <div className={styles.stepToolbar}>
                          <p className={styles.stepToolbarHint}>
                            Comece pela função mais recente. Adicione quantas
                            experiências quiser.
                          </p>
                          <button
                            type="button"
                            className={styles.button}
                            onClick={() =>
                              setExperiences((prev) => [
                                ...prev,
                                createExperience(),
                              ])
                            }
                          >
                            <FiPlus aria-hidden="true" />
                            Adicionar experiência
                          </button>
                        </div>
                        <div className={styles.sectionBlock}>
                          {experiences.map((item, index) => (
                            <div key={item.id} className={styles.entryCard}>
                              <div className={styles.entryTop}>
                                <h3 className={styles.entryTitle}>
                                  {nonEmpty(item.role, item.employer).join(
                                    ' · ',
                                  ) || `Experiência ${index + 1}`}
                                </h3>
                                <button
                                  type="button"
                                  className={styles.dangerButton}
                                  onClick={() =>
                                    removeCollectionItem(
                                      setExperiences,
                                      createExperience,
                                      item.id,
                                    )
                                  }
                                >
                                  <FiTrash2 aria-hidden="true" />
                                  Remover
                                </button>
                              </div>
                              <div className={styles.grid2}>
                                <TextField
                                  label="Cargo"
                                  value={item.role}
                                  onChange={(event) =>
                                    updateCollectionItem(
                                      setExperiences,
                                      item.id,
                                      'role',
                                      event.target.value,
                                    )
                                  }
                                  placeholder="Ex.: Desenvolvedor Front-end"
                                />
                                <TextField
                                  label="Empresa"
                                  value={item.employer}
                                  onChange={(event) =>
                                    updateCollectionItem(
                                      setExperiences,
                                      item.id,
                                      'employer',
                                      event.target.value,
                                    )
                                  }
                                  placeholder="Ex.: Tech Solutions Lda."
                                />
                              </div>
                              <div className={styles.grid2}>
                                <TextField
                                  label="Cidade"
                                  value={item.city}
                                  onChange={(event) =>
                                    updateCollectionItem(
                                      setExperiences,
                                      item.id,
                                      'city',
                                      event.target.value,
                                    )
                                  }
                                  placeholder="Ex.: São Tomé"
                                />
                                <TextField
                                  label="País"
                                  value={item.country}
                                  onChange={(event) =>
                                    updateCollectionItem(
                                      setExperiences,
                                      item.id,
                                      'country',
                                      event.target.value,
                                    )
                                  }
                                  placeholder="Ex.: São Tomé e Príncipe"
                                />
                              </div>
                              <div className={styles.grid3}>
                                <TextField
                                  label="Início"
                                  type="month"
                                  value={item.startDate}
                                  onChange={(event) =>
                                    updateCollectionItem(
                                      setExperiences,
                                      item.id,
                                      'startDate',
                                      event.target.value,
                                    )
                                  }
                                  error={erroDaLista(
                                    'experiences',
                                    index,
                                    'startDate',
                                  )}
                                  onBlur={marcarTocado(
                                    `experiences.${index}.startDate`,
                                  )}
                                />
                                <TextField
                                  label="Fim"
                                  type="month"
                                  value={item.endDate}
                                  onChange={(event) =>
                                    updateCollectionItem(
                                      setExperiences,
                                      item.id,
                                      'endDate',
                                      event.target.value,
                                    )
                                  }
                                  error={erroDaLista(
                                    'experiences',
                                    index,
                                    'endDate',
                                  )}
                                  onBlur={marcarTocado(
                                    `experiences.${index}.endDate`,
                                  )}
                                />
                                <label className={styles.checkboxRow}>
                                  <input
                                    type="checkbox"
                                    checked={item.current}
                                    onChange={(event) =>
                                      updateCollectionItem(
                                        setExperiences,
                                        item.id,
                                        'current',
                                        event.target.checked,
                                      )
                                    }
                                  />
                                  Função atual
                                </label>
                              </div>
                              <TextAreaField
                                label="Descrição da função"
                                value={item.description}
                                onChange={(event) =>
                                  updateCollectionItem(
                                    setExperiences,
                                    item.id,
                                    'description',
                                    event.target.value,
                                  )
                                }
                                placeholder="Contexto da função, equipa, escopo e principais responsabilidades."
                                compact
                              />
                              <TextAreaField
                                label="Resultados e realizações"
                                value={item.achievements}
                                onChange={(event) =>
                                  updateCollectionItem(
                                    setExperiences,
                                    item.id,
                                    'achievements',
                                    event.target.value,
                                  )
                                }
                                placeholder="Uma conquista por linha ou separada por vírgulas."
                                compact
                              />
                            </div>
                          ))}
                        </div>
                      </section>
                    ) : null}

                    {currentStep === 2 ? (
                      <section className={styles.panel}>
                        <div className={styles.stepToolbar}>
                          <p className={styles.stepToolbarHint}>
                            Inclua curso, instituição, período e notas
                            relevantes.
                          </p>
                          <button
                            type="button"
                            className={styles.button}
                            onClick={() =>
                              setEducationEntries((prev) => [
                                ...prev,
                                createEducation(),
                              ])
                            }
                          >
                            <FiPlus aria-hidden="true" />
                            Adicionar formação
                          </button>
                        </div>
                        <div className={styles.sectionBlock}>
                          {educationEntries.map((item, index) => (
                            <div key={item.id} className={styles.entryCard}>
                              <div className={styles.entryTop}>
                                <h3 className={styles.entryTitle}>
                                  {nonEmpty(
                                    item.qualification,
                                    item.institution,
                                  ).join(' · ') || `Formação ${index + 1}`}
                                </h3>
                                <button
                                  type="button"
                                  className={styles.dangerButton}
                                  onClick={() =>
                                    removeCollectionItem(
                                      setEducationEntries,
                                      createEducation,
                                      item.id,
                                    )
                                  }
                                >
                                  <FiTrash2 aria-hidden="true" />
                                  Remover
                                </button>
                              </div>
                              <div className={styles.grid2}>
                                <TextField
                                  label="Curso / Qualificação"
                                  value={item.qualification}
                                  onChange={(event) =>
                                    updateCollectionItem(
                                      setEducationEntries,
                                      item.id,
                                      'qualification',
                                      event.target.value,
                                    )
                                  }
                                  placeholder="Ex.: Licenciatura em Engenharia Informática"
                                />
                                <TextField
                                  label="Instituição"
                                  value={item.institution}
                                  onChange={(event) =>
                                    updateCollectionItem(
                                      setEducationEntries,
                                      item.id,
                                      'institution',
                                      event.target.value,
                                    )
                                  }
                                  placeholder="Ex.: Universidade de São Tomé e Príncipe"
                                />
                              </div>
                              <div className={styles.grid2}>
                                <TextField
                                  label="Cidade"
                                  value={item.city}
                                  onChange={(event) =>
                                    updateCollectionItem(
                                      setEducationEntries,
                                      item.id,
                                      'city',
                                      event.target.value,
                                    )
                                  }
                                  placeholder="Ex.: São Tomé"
                                />
                                <TextField
                                  label="País"
                                  value={item.country}
                                  onChange={(event) =>
                                    updateCollectionItem(
                                      setEducationEntries,
                                      item.id,
                                      'country',
                                      event.target.value,
                                    )
                                  }
                                  placeholder="Ex.: São Tomé e Príncipe"
                                />
                              </div>
                              <div className={styles.grid2}>
                                <TextField
                                  label="Início"
                                  type="month"
                                  value={item.startDate}
                                  onChange={(event) =>
                                    updateCollectionItem(
                                      setEducationEntries,
                                      item.id,
                                      'startDate',
                                      event.target.value,
                                    )
                                  }
                                  error={erroDaLista(
                                    'educationEntries',
                                    index,
                                    'startDate',
                                  )}
                                  onBlur={marcarTocado(
                                    `educationEntries.${index}.startDate`,
                                  )}
                                />
                                <TextField
                                  label="Fim"
                                  type="month"
                                  value={item.endDate}
                                  onChange={(event) =>
                                    updateCollectionItem(
                                      setEducationEntries,
                                      item.id,
                                      'endDate',
                                      event.target.value,
                                    )
                                  }
                                  error={erroDaLista(
                                    'educationEntries',
                                    index,
                                    'endDate',
                                  )}
                                  onBlur={marcarTocado(
                                    `educationEntries.${index}.endDate`,
                                  )}
                                />
                              </div>
                              <TextAreaField
                                label="Detalhes"
                                value={item.details}
                                onChange={(event) =>
                                  updateCollectionItem(
                                    setEducationEntries,
                                    item.id,
                                    'details',
                                    event.target.value,
                                  )
                                }
                                placeholder="Ex.: tema de dissertação, média final, módulos relevantes, distinções."
                                compact
                              />
                            </div>
                          ))}
                        </div>
                      </section>
                    ) : null}

                    {currentStep === 2 ? (
                      <section className={styles.panel}>
                        <div className={styles.sectionBlock}>
                          <div className={styles.sectionHeader}>
                            <h3>Projetos</h3>
                            <button
                              type="button"
                              className={styles.button}
                              onClick={() =>
                                setProjectEntries((prev) => [
                                  ...prev,
                                  createProject(),
                                ])
                              }
                            >
                              <FiPlus aria-hidden="true" />
                              Adicionar projeto
                            </button>
                          </div>
                          {projectEntries.map((item, index) => (
                            <div key={item.id} className={styles.entryCard}>
                              <div className={styles.entryTop}>
                                <h3 className={styles.entryTitle}>
                                  {nonEmpty(item.name, item.role).join(' · ') ||
                                    `Projeto ${index + 1}`}
                                </h3>
                                <button
                                  type="button"
                                  className={styles.dangerButton}
                                  onClick={() =>
                                    removeCollectionItem(
                                      setProjectEntries,
                                      createProject,
                                      item.id,
                                    )
                                  }
                                >
                                  <FiTrash2 aria-hidden="true" />
                                  Remover
                                </button>
                              </div>
                              <div className={styles.grid3}>
                                <TextField
                                  label="Nome do projeto"
                                  value={item.name}
                                  onChange={(event) =>
                                    updateCollectionItem(
                                      setProjectEntries,
                                      item.id,
                                      'name',
                                      event.target.value,
                                    )
                                  }
                                />
                                <TextField
                                  label="Papel desempenhado"
                                  value={item.role}
                                  onChange={(event) =>
                                    updateCollectionItem(
                                      setProjectEntries,
                                      item.id,
                                      'role',
                                      event.target.value,
                                    )
                                  }
                                />
                                <TextField
                                  label="Link"
                                  value={item.link}
                                  onChange={(event) =>
                                    updateCollectionItem(
                                      setProjectEntries,
                                      item.id,
                                      'link',
                                      event.target.value,
                                    )
                                  }
                                  placeholder="https://..."
                                  error={erroDaLista('projects', index, 'link')}
                                  onBlur={marcarTocado(
                                    `projects.${index}.link`,
                                  )}
                                />
                              </div>
                              <TextAreaField
                                label="Resumo"
                                value={item.summary}
                                onChange={(event) =>
                                  updateCollectionItem(
                                    setProjectEntries,
                                    item.id,
                                    'summary',
                                    event.target.value,
                                  )
                                }
                                placeholder="Problema, solução entregue, ferramentas utilizadas, impacto e resultados."
                                compact
                              />
                            </div>
                          ))}

                          <div className={styles.sectionHeader}>
                            <h3>Certificações</h3>
                            <button
                              type="button"
                              className={styles.button}
                              onClick={() =>
                                setCertificationEntries((prev) => [
                                  ...prev,
                                  createCertification(),
                                ])
                              }
                            >
                              <FiPlus aria-hidden="true" />
                              Adicionar certificação
                            </button>
                          </div>
                          {certificationEntries.map((item, index) => (
                            <div key={item.id} className={styles.entryCard}>
                              <div className={styles.entryTop}>
                                <h3 className={styles.entryTitle}>
                                  {nonEmpty(item.title, item.issuer).join(
                                    ' · ',
                                  ) || `Certificação ${index + 1}`}
                                </h3>
                                <button
                                  type="button"
                                  className={styles.dangerButton}
                                  onClick={() =>
                                    removeCollectionItem(
                                      setCertificationEntries,
                                      createCertification,
                                      item.id,
                                    )
                                  }
                                >
                                  <FiTrash2 aria-hidden="true" />
                                  Remover
                                </button>
                              </div>
                              <div className={styles.grid3}>
                                <TextField
                                  label="Título"
                                  value={item.title}
                                  onChange={(event) =>
                                    updateCollectionItem(
                                      setCertificationEntries,
                                      item.id,
                                      'title',
                                      event.target.value,
                                    )
                                  }
                                />
                                <TextField
                                  label="Entidade emissora"
                                  value={item.issuer}
                                  onChange={(event) =>
                                    updateCollectionItem(
                                      setCertificationEntries,
                                      item.id,
                                      'issuer',
                                      event.target.value,
                                    )
                                  }
                                />
                                <TextField
                                  label="Ano"
                                  value={item.year}
                                  onChange={(event) =>
                                    updateCollectionItem(
                                      setCertificationEntries,
                                      item.id,
                                      'year',
                                      event.target.value,
                                    )
                                  }
                                  placeholder="2026"
                                  error={erroDaLista(
                                    'certifications',
                                    index,
                                    'year',
                                  )}
                                  onBlur={marcarTocado(
                                    `certifications.${index}.year`,
                                  )}
                                />
                              </div>
                            </div>
                          ))}
                        </div>
                      </section>
                    ) : null}

                    {currentStep === 3 ? (
                      <section className={styles.panel}>
                        <div className={styles.stepToolbar}>
                          <p className={styles.stepToolbarHint}>
                            Competências, idiomas, interesses e informação de
                            apoio.
                          </p>
                          <button
                            type="button"
                            className={styles.button}
                            onClick={() =>
                              setLanguageEntries((prev) => [
                                ...prev,
                                createLanguage(),
                              ])
                            }
                          >
                            <FiPlus aria-hidden="true" />
                            Adicionar idioma
                          </button>
                        </div>
                        <div className={styles.sectionBlock}>
                          <div className={styles.grid3}>
                            <TextAreaField
                              label="Competências técnicas"
                              value={form.technicalSkills}
                              onChange={(event) =>
                                setForm((prev) => ({
                                  ...prev,
                                  technicalSkills: event.target.value,
                                }))
                              }
                              placeholder="Excel avançado, SQL, Power BI, JavaScript..."
                              compact
                              showChips
                            />
                            <TextAreaField
                              label="Competências digitais"
                              value={form.digitalSkills}
                              onChange={(event) =>
                                setForm((prev) => ({
                                  ...prev,
                                  digitalSkills: event.target.value,
                                }))
                              }
                              placeholder="Ferramentas e plataformas digitais."
                              compact
                              showChips
                            />
                            <TextAreaField
                              label="Competências interpessoais"
                              value={form.softSkills}
                              onChange={(event) =>
                                setForm((prev) => ({
                                  ...prev,
                                  softSkills: event.target.value,
                                }))
                              }
                              placeholder="Liderança, comunicação, negociação..."
                              compact
                              showChips
                            />
                          </div>

                          {languageEntries.map((item, index) => (
                            <div key={item.id} className={styles.entryCard}>
                              <div className={styles.entryTop}>
                                <h3 className={styles.entryTitle}>
                                  {nonEmpty(item.name, item.level).join(
                                    ' · ',
                                  ) || `Idioma ${index + 1}`}
                                </h3>
                                <button
                                  type="button"
                                  className={styles.dangerButton}
                                  onClick={() =>
                                    removeCollectionItem(
                                      setLanguageEntries,
                                      createLanguage,
                                      item.id,
                                    )
                                  }
                                >
                                  <FiTrash2 aria-hidden="true" />
                                  Remover
                                </button>
                              </div>
                              <div className={styles.grid2}>
                                <TextField
                                  label="Idioma"
                                  value={item.name}
                                  onChange={(event) =>
                                    updateCollectionItem(
                                      setLanguageEntries,
                                      item.id,
                                      'name',
                                      event.target.value,
                                    )
                                  }
                                  placeholder="Português"
                                />
                                <TextField
                                  label="Nível"
                                  value={item.level}
                                  onChange={(event) =>
                                    updateCollectionItem(
                                      setLanguageEntries,
                                      item.id,
                                      'level',
                                      event.target.value,
                                    )
                                  }
                                  placeholder="Nativo, C1, Intermédio..."
                                />
                              </div>
                            </div>
                          ))}

                          <div className={styles.grid3}>
                            <TextAreaField
                              label="Interesses"
                              value={form.interests}
                              onChange={(event) =>
                                setForm((prev) => ({
                                  ...prev,
                                  interests: event.target.value,
                                }))
                              }
                              placeholder="Voluntariado, leitura, eventos setoriais..."
                              compact
                            />
                            <TextAreaField
                              label="Referências"
                              value={form.references}
                              onChange={(event) =>
                                setForm((prev) => ({
                                  ...prev,
                                  references: event.target.value,
                                }))
                              }
                              placeholder="Uma referência por linha ou separada por vírgulas."
                              compact
                            />
                            <TextAreaField
                              label="Informações adicionais"
                              value={form.additionalInfo}
                              onChange={(event) =>
                                setForm((prev) => ({
                                  ...prev,
                                  additionalInfo: event.target.value,
                                }))
                              }
                              placeholder="Disponibilidade, mobilidade, prémios, publicações..."
                              compact
                            />
                          </div>
                        </div>
                      </section>
                    ) : null}

                    {mostrarTodosErros && !validacao.valido ? (
                      <div className={styles.validationSummary} role="alert">
                        <strong>
                          {validacao.total === 1
                            ? 'Falta corrigir 1 campo antes de exportar.'
                            : `Faltam corrigir ${validacao.total} campos antes de exportar.`}
                        </strong>
                        <span>
                          Os campos com problema estão assinalados a vermelho ao
                          longo dos passos do formulário.
                        </span>
                      </div>
                    ) : null}

                    <div className={styles.wizardNav}>
                      <div className={styles.navStart}>
                        {currentStep === 0 ? (
                          <Link href="/recursos" className={styles.ghostButton}>
                            <FiArrowLeft aria-hidden="true" /> Cancelar
                          </Link>
                        ) : (
                          <button
                            type="button"
                            className={styles.ghostButton}
                            onClick={goPrev}
                          >
                            <FiChevronLeft aria-hidden="true" /> Anterior
                          </button>
                        )}
                        <button
                          type="button"
                          className={styles.draftButton}
                          onClick={saveNow}
                        >
                          <FiSave aria-hidden="true" /> Guardar agora
                        </button>
                      </div>
                      <AutoSaveStatus
                        status={autoSaveStatus}
                        lastSavedAt={autoSaveLastSavedAt}
                        isOnline={autoSaveIsOnline}
                        className={styles.autoSaveStatus}
                      />
                      {currentStep < STEPS.length - 1 ? (
                        <button
                          type="button"
                          className={styles.primaryButton}
                          onClick={goNext}
                        >
                          Próximo <FiChevronRight aria-hidden="true" />
                        </button>
                      ) : (
                        <button
                          type="button"
                          className={`${styles.primaryButton} ${styles.finalButton}`}
                          onClick={exportPdf}
                          disabled={isExporting}
                        >
                          <FiCheckCircle aria-hidden="true" />{' '}
                          {isExporting
                            ? 'A gerar PDF…'
                            : 'Concluir e gerar PDF'}
                        </button>
                      )}
                    </div>
                  </div>

                  <aside
                    className={`${styles.previewColumn} ${previewOpenMobile ? styles.previewColumnOpen : ''}`}
                  >
                    <div className={styles.previewSticky}>
                      <div className={styles.previewSheetBar}>
                        <span className={styles.previewSheetTitle}>
                          Pré-visualização do CV
                        </span>
                        <button
                          type="button"
                          className={styles.previewSheetClose}
                          onClick={() => setPreviewOpenMobile(false)}
                        >
                          <FiX aria-hidden="true" />
                          Fechar
                        </button>
                      </div>
                      <section className={styles.panel}>
                        <div className={styles.previewToolbar}>
                          <div>
                            <h2 className={styles.panelTitle}>
                              Pré-visualização
                            </h2>
                            <p>
                              O PDF é gerado com base nesta estrutura e nos
                              dados preenchidos.
                            </p>
                          </div>
                          <button
                            type="button"
                            className={styles.primaryButton}
                            onClick={exportPdf}
                            disabled={isExporting}
                          >
                            <FiDownload aria-hidden="true" />
                            {isExporting ? 'A gerar PDF...' : 'Gerar PDF'}
                          </button>
                        </div>
                        <p className={styles.helperText}>
                          Dica: use frases curtas, verbos de ação e resultados
                          concretos. O melhor CV não é o mais longo, é o mais
                          preciso.
                        </p>
                      </section>

                      <div className={styles.previewShell}>
                        <div className={styles.previewPage}>
                          <header className={styles.europassHeader}>
                            <div className={styles.europassHeaderLeft}>
                              <h2 className={styles.europassName}>
                                {cvDocument.fullName}
                              </h2>
                              {cvDocument.headline ? (
                                <p className={styles.europassHeadline}>
                                  {cvDocument.headline}
                                </p>
                              ) : null}
                            </div>
                            {cvDocument.photo ? (
                              <div className={styles.europassPhotoWrap}>
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img
                                  src={cvDocument.photo}
                                  alt="Foto do candidato"
                                  className={styles.europassPhoto}
                                  width={86}
                                  height={86}
                                />
                              </div>
                            ) : null}
                          </header>

                          <div className={styles.europassRows}>
                            {renderEuropassSectionHeader('Informação pessoal')}
                            {renderEuropassFieldRow(
                              'Email',
                              cvDocument.personal?.email,
                              {
                                href: cvDocument.personal?.email
                                  ? `mailto:${cvDocument.personal.email}`
                                  : '',
                              },
                            )}
                            {renderEuropassFieldRow(
                              'Telefone',
                              cvDocument.personal?.phone,
                            )}
                            {renderEuropassFieldRow(
                              'Morada',
                              cvDocument.personal?.location,
                            )}
                            {renderEuropassFieldRow(
                              'Nacionalidade',
                              cvDocument.personal?.nationality,
                            )}
                            {renderEuropassFieldRow(
                              'Data de nascimento',
                              cvDocument.personal?.birthDateFormatted ||
                                cvDocument.personal?.birthDate,
                            )}
                            {renderEuropassFieldRow(
                              'Carta de condução',
                              cvDocument.personal?.drivingLicense,
                            )}
                            {renderEuropassFieldRow(
                              'LinkedIn',
                              cvDocument.personal?.linkedin,
                              {
                                href: normalizeExternalUrl(
                                  cvDocument.personal?.linkedin,
                                ),
                              },
                            )}
                            {renderEuropassFieldRow(
                              'Website',
                              cvDocument.personal?.website,
                              {
                                href: normalizeExternalUrl(
                                  cvDocument.personal?.website,
                                ),
                              },
                            )}
                            {renderEuropassFieldRow(
                              'Portefólio',
                              cvDocument.personal?.portfolio,
                              {
                                href: normalizeExternalUrl(
                                  cvDocument.personal?.portfolio,
                                ),
                              },
                            )}

                            {renderEuropassSectionHeader('Resumo')}
                            <div className={styles.europassRow}>
                              <div className={styles.europassLeft}>Resumo</div>
                              <div className={styles.europassRight}>
                                {cvDocument.summary ? (
                                  <p className={styles.europassText}>
                                    {cvDocument.summary}
                                  </p>
                                ) : (
                                  <span className={styles.europassPlaceholder}>
                                    Por preencher
                                  </span>
                                )}
                              </div>
                            </div>

                            {renderEuropassSectionHeader('Objetivo')}
                            <div className={styles.europassRow}>
                              <div className={styles.europassLeft}>
                                Objetivo
                              </div>
                              <div className={styles.europassRight}>
                                {cvDocument.objective ? (
                                  <p className={styles.europassText}>
                                    {cvDocument.objective}
                                  </p>
                                ) : (
                                  <span className={styles.europassPlaceholder}>
                                    Por preencher
                                  </span>
                                )}
                              </div>
                            </div>

                            {renderEuropassSectionHeader(
                              'Experiência profissional',
                            )}
                            {renderEuropassEntries(cvDocument.experiences)}

                            {renderEuropassSectionHeader('Educação e formação')}
                            {renderEuropassEntries(cvDocument.educationEntries)}

                            {renderEuropassSectionHeader('Projetos')}
                            {renderEuropassEntries(cvDocument.projects)}

                            {renderEuropassSectionHeader('Certificações')}
                            {renderEuropassEntries(cvDocument.certifications)}

                            {renderEuropassSectionHeader('Idiomas')}
                            {cvDocument.languages.length ? (
                              cvDocument.languages.map((lang) => (
                                <div
                                  key={lang.id}
                                  className={styles.europassRow}
                                >
                                  <div className={styles.europassLeft}>
                                    {lang.title || 'Idioma'}
                                  </div>
                                  <div className={styles.europassRight}>
                                    {lang.meta || (
                                      <span
                                        className={styles.europassPlaceholder}
                                      >
                                        Nível
                                      </span>
                                    )}
                                  </div>
                                </div>
                              ))
                            ) : (
                              <div className={styles.europassRow}>
                                <div className={styles.europassLeft} />
                                <div className={styles.europassRight}>
                                  <span className={styles.europassPlaceholder}>
                                    Por preencher
                                  </span>
                                </div>
                              </div>
                            )}

                            {renderEuropassSectionHeader('Competências')}
                            {renderEuropassBulletsRow(
                              'Técnicas',
                              cvDocument.technicalSkills,
                            )}
                            {renderEuropassBulletsRow(
                              'Digitais',
                              cvDocument.digitalSkills,
                            )}
                            {renderEuropassBulletsRow(
                              'Interpessoais',
                              cvDocument.softSkills,
                            )}

                            {renderEuropassSectionHeader('Interesses')}
                            {renderEuropassBulletsRow(
                              'Interesses',
                              cvDocument.interests,
                            )}

                            {renderEuropassSectionHeader('Referências')}
                            {renderEuropassBulletsRow(
                              'Referências',
                              cvDocument.references,
                            )}

                            {renderEuropassSectionHeader(
                              'Informações adicionais',
                            )}
                            {renderEuropassBulletsRow(
                              'Notas',
                              cvDocument.additionalInfo,
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </aside>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </PublicPageShell>
    </>
  );
}

// O gerador de CV é exclusivo dos planos Profissional e Premium. O gate
// existente é client-side e só decide depois de a página inteira chegar ao
// browser; este guard aplica a mesma regra no servidor, como já acontece nas
// calculadoras premium.
export async function getServerSideProps(context) {
  const access = await resolveProfessionalResourceAccess(context);

  if (!access.isAuthenticated) {
    return redirectToLogin(context);
  }

  if (!access.allowed) {
    return {
      redirect: {
        destination: access.upgradeUrl || '/premium/candidatos',
        permanent: false,
      },
    };
  }

  return { props: {} };
}
