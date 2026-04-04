import Head from 'next/head';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import LandingHeader from '../../components/LandingHeader';
import Footer from '../../components/home/Footer';
import { useAuth } from '../../context/AuthContext';
import { canUseCvGenerator, getPlanSummary } from '../../lib/candidatePlanFeatures';
import { slugifyFilename } from '../../lib/resourcesCatalog';
import styles from '../../styles/GeradorCv.module.css';

const createId = (prefix) => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

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
  achievements: ''
});

const createEducation = () => ({
  id: createId('edu'),
  qualification: '',
  institution: '',
  city: '',
  country: '',
  startDate: '',
  endDate: '',
  details: ''
});

const createLanguage = () => ({
  id: createId('lang'),
  name: '',
  level: ''
});

const createProject = () => ({
  id: createId('project'),
  name: '',
  role: '',
  link: '',
  summary: ''
});

const createCertification = () => ({
  id: createId('cert'),
  title: '',
  issuer: '',
  year: ''
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
  additionalInfo: ''
};

const nonEmpty = (...values) => values.map((value) => String(value || '').trim()).filter(Boolean);

const splitItems = (value) => String(value || '')
  .split(/\n|,/)
  .map((item) => item.trim())
  .filter(Boolean);

const hasExperienceContent = (item) => Boolean(
  item.role || item.employer || item.city || item.country || item.startDate || item.endDate || item.description || item.achievements
);

const hasEducationContent = (item) => Boolean(
  item.qualification || item.institution || item.city || item.country || item.startDate || item.endDate || item.details
);

const hasLanguageContent = (item) => Boolean(item.name || item.level);
const hasProjectContent = (item) => Boolean(item.name || item.role || item.link || item.summary);
const hasCertificationContent = (item) => Boolean(item.title || item.issuer || item.year);

const formatMonthYear = (value) => {
  if (!value) return '';
  const [year, month] = String(value).split('-');
  const numericYear = Number(year);
  const numericMonth = Number(month);
  if (!numericYear || !numericMonth) return value;

  return new Intl.DateTimeFormat('pt-PT', {
    month: 'short',
    year: 'numeric'
  }).format(new Date(numericYear, numericMonth - 1, 1));
};

const formatDateRange = (startDate, endDate, current = false) => {
  const start = formatMonthYear(startDate);
  const end = current ? 'Atual' : formatMonthYear(endDate);
  if (!start && !end) return '';
  if (!start) return end;
  if (!end) return start;
  return `${start} - ${end}`;
};

const formatBirthDate = (value) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('pt-PT', {
    day: '2-digit',
    month: 'long',
    year: 'numeric'
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
  if (!response.ok) throw new Error('Nao foi possivel carregar a foto de perfil.');
  const blob = await response.blob();
  return fileToDataUrl(blob);
};

const loadImageElement = (source) =>
  new Promise((resolve, reject) => {
    const image = new window.Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('Nao foi possivel abrir a imagem para o PDF.'));
    image.src = source;
  });

const normalizePhotoForPdf = async (source) => {
  if (!source) return '';
  const rawDataUrl = await imageUrlToDataUrl(source);
  if (!rawDataUrl) return '';

  const image = await loadImageElement(rawDataUrl);
  const canvas = document.createElement('canvas');
  canvas.width = 640;
  canvas.height = 640;
  const context = canvas.getContext('2d');
  if (!context) return rawDataUrl;

  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, canvas.width, canvas.height);

  const scale = Math.max(canvas.width / image.width, canvas.height / image.height);
  const width = image.width * scale;
  const height = image.height * scale;
  const x = (canvas.width - width) / 2;
  const y = (canvas.height - height) / 2;
  context.drawImage(image, x, y, width, height);

  return canvas.toDataURL('image/jpeg', 0.92);
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

const buildCvDocument = (form, experiences, educationEntries, languages, projects, certifications) => {
  const parsedExperiences = experiences
    .filter(hasExperienceContent)
    .map((item) => ({
      id: item.id,
      title: nonEmpty(item.role, item.employer).join(' · ') || 'Experiência profissional',
      meta: nonEmpty(formatDateRange(item.startDate, item.endDate, item.current), nonEmpty(item.city, item.country).join(', ')).join(' • '),
      description: String(item.description || '').trim(),
      achievements: splitItems(item.achievements)
    }));

  const parsedEducation = educationEntries
    .filter(hasEducationContent)
    .map((item) => ({
      id: item.id,
      title: nonEmpty(item.qualification, item.institution).join(' · ') || 'Formação académica',
      meta: nonEmpty(formatDateRange(item.startDate, item.endDate, false), nonEmpty(item.city, item.country).join(', ')).join(' • '),
      description: String(item.details || '').trim()
    }));

  const parsedLanguages = languages
    .filter(hasLanguageContent)
    .map((item) => ({
      id: item.id,
      title: String(item.name || '').trim(),
      meta: String(item.level || '').trim()
    }));

  const parsedProjects = projects
    .filter(hasProjectContent)
    .map((item) => ({
      id: item.id,
      title: String(item.name || '').trim() || 'Projeto',
      meta: nonEmpty(item.role, item.link).join(' • '),
      description: String(item.summary || '').trim()
    }));

  const parsedCertifications = certifications
    .filter(hasCertificationContent)
    .map((item) => ({
      id: item.id,
      title: String(item.title || '').trim() || 'Certificação',
      meta: nonEmpty(item.issuer, item.year).join(' • ')
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
      portfolio: String(form.portfolio || '').trim()
    },
    contactItems: nonEmpty(form.email, form.phone, form.location),
    profileItems: nonEmpty(
      form.nationality ? `Nacionalidade: ${form.nationality}` : '',
      form.birthDate ? `Nascimento: ${formatBirthDate(form.birthDate)}` : '',
      form.drivingLicense ? `Carta de condução: ${form.drivingLicense}` : ''
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
    certifications: parsedCertifications
  };
};

function TextField({ label, value, onChange, type = 'text', placeholder }) {
  return (
    <div className={styles.field}>
      <span>{label}</span>
      <input className={styles.input} value={value} onChange={onChange} type={type} placeholder={placeholder} />
    </div>
  );
}

function TextAreaField({ label, value, onChange, placeholder, compact = false }) {
  return (
    <div className={styles.field}>
      <span>{label}</span>
      <textarea
        className={`${styles.textarea} ${compact ? styles.compactTextarea : ''}`}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
      />
    </div>
  );
}

function PreviewBlock({ title, children, sidebar = false }) {
  return (
    <section className={sidebar ? styles.previewSidebarCard : styles.previewSection}>
      <h3 className={styles.previewSectionTitle}>{title}</h3>
      {children}
    </section>
  );
}

function LockedState({ title, description, ctaHref, ctaLabel, secondaryHref, secondaryLabel }) {
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
        {ctaHref ? <Link href={ctaHref} className={styles.primaryButton}>{ctaLabel}</Link> : null}
        {secondaryHref ? <Link href={secondaryHref} className={styles.button}>{secondaryLabel}</Link> : null}
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
  const [certificationEntries, setCertificationEntries] = useState([createCertification()]);
  const [profileLoading, setProfileLoading] = useState(true);
  const [profileError, setProfileError] = useState('');
  const [photoError, setPhotoError] = useState('');
  const [gate, setGate] = useState({ status: 'loading', message: '', planName: '' });
  const [statusMessage, setStatusMessage] = useState('');
  const [isExporting, setIsExporting] = useState(false);

  useEffect(() => {
    const hydrateProfile = async () => {
      if (authLoading) return;

      if (!user) {
        setGate({
          status: 'anonymous',
          message: 'O gerador avançado de CV está disponível apenas para candidatos com plano Profissional ou Premium.',
          planName: ''
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
            Authorization: `Bearer ${token}`
          }
        });

        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(data.error || 'Não foi possível carregar o perfil do candidato.');
        }

        const profile = data.profile?.data || {};
        if (profile.userType !== 'candidato') {
          setGate({
            status: 'forbidden',
            message: 'Este recurso é exclusivo para contas de candidato.',
            planName: ''
          });
          return;
        }

        const planSummary = getPlanSummary(profile);
        const access = canUseCvGenerator(planSummary.planId);
        if (!access.allowed) {
          setGate({
            status: 'upgrade',
            message: access.reason,
            planName: planSummary.planName || 'Básico'
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
          additionalInfo: previous.additionalInfo
        }));

        if (Array.isArray(profile.experience) && profile.experience.length) {
          setExperiences(profile.experience.map((item) => ({
            ...createExperience(),
            role: item.role || '',
            employer: item.company || '',
            description: item.description || '',
            achievements: item.period || ''
          })));
        }

        if (profile.languages) {
          const parsedLanguages = splitItems(profile.languages).map((item) => ({
            ...createLanguage(),
            name: item,
            level: ''
          }));
          if (parsedLanguages.length) setLanguageEntries(parsedLanguages);
        }

        if (profile.certifications) {
          const parsedCertifications = splitItems(profile.certifications).map((item) => ({
            ...createCertification(),
            title: item,
            issuer: '',
            year: ''
          }));
          if (parsedCertifications.length) setCertificationEntries(parsedCertifications);
        }

        setGate({
          status: 'ready',
          message: '',
          planName: planSummary.planName || 'Profissional'
        });
      } catch (error) {
        console.error('Erro ao carregar dados do gerador de CV:', error);
        setProfileError(error.message || 'Erro ao carregar o gerador de CV.');
        setGate({ status: 'error', message: '', planName: '' });
      } finally {
        setProfileLoading(false);
      }
    };

    hydrateProfile();
  }, [authLoading, user]);

  const cvDocument = useMemo(
    () => buildCvDocument(form, experiences, educationEntries, languageEntries, projectEntries, certificationEntries),
    [form, experiences, educationEntries, languageEntries, projectEntries, certificationEntries]
  );

  const updateCollectionItem = (setter, id, field, value) => {
    setter((previous) => previous.map((item) => (item.id === id ? { ...item, [field]: value } : item)));
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
      setPhotoError('A foto deve ter no maximo 3MB.');
      return;
    }

    try {
      const dataUrl = await fileToDataUrl(file);
      setForm((prev) => ({ ...prev, photo: dataUrl }));
      setPhotoError('');
    } catch (error) {
      setPhotoError('Nao foi possivel processar a imagem.');
    }
  };

  const removePhoto = () => {
    setForm((prev) => ({ ...prev, photo: '' }));
    setPhotoError('');
  };

  const exportPdf = async () => {
    if (gate.status !== 'ready') return;
    if (!String(form.fullName || '').trim()) {
      setStatusMessage('Preencha pelo menos o nome completo antes de exportar o PDF.');
      return;
    }

    try {
      setIsExporting(true);
      setStatusMessage('');
      const { jsPDF } = await import('jspdf');
      const doc = new jsPDF({ unit: 'pt', format: 'a4' });
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const marginX = 44;
      const marginY = 54;
      const bottomY = pageHeight - marginY;
      const leftColWidth = 158; // coluna de rótulos (estilo Europass)
      const colGap = 16;
      const rightX = marginX + leftColWidth + colGap;
      const rightWidth = pageWidth - marginX - rightX;
      const colors = {
        ink: [15, 23, 42],
        muted: [71, 85, 105],
        light: [148, 163, 184],
        divider: [226, 232, 240],
        primary: [29, 78, 216]
      };
      let cursorY = marginY;
      let photoDataUrl = '';

      if (cvDocument.photo) {
        try {
          photoDataUrl = await normalizePhotoForPdf(cvDocument.photo);
        } catch (error) {
          photoDataUrl = '';
        }
      }

      const ensureSpace = (needed = 24, { forceNewPage = false } = {}) => {
        if (!forceNewPage && cursorY + needed <= bottomY) return;
        doc.addPage();
        cursorY = marginY;
        // Cabeçalho repetido simples (ajuda a leitura em múltiplas páginas).
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9);
        doc.setTextColor(...colors.muted);
        doc.text(cvDocument.fullName, pageWidth - marginX, marginY - 22, { align: 'right' });
        doc.setDrawColor(...colors.divider);
        doc.setLineWidth(1);
        doc.line(marginX, marginY - 14, pageWidth - marginX, marginY - 14);
      };

      const split = (text, width) => doc.splitTextToSize(String(text || ''), width);

      const drawSectionHeader = (title) => {
        ensureSpace(34);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(9.4);
        doc.setTextColor(...colors.primary);
        doc.text(String(title).toUpperCase(), marginX, cursorY);
        doc.setDrawColor(...colors.divider);
        doc.setLineWidth(1);
        doc.line(rightX, cursorY + 2, pageWidth - marginX, cursorY + 2);
        cursorY += 18;
      };

      const drawKeyValueRow = (label, value, { url } = {}) => {
        const safeValue = String(value || '').trim();
        if (!safeValue) return;

        const labelLines = split(label, leftColWidth);
        const valueLines = split(safeValue, rightWidth);
        const labelSize = 9.2;
        const valueSize = 10.2;
        const labelLineHeight = 12.6;
        const valueLineHeight = 14.2;
        const rowHeight = Math.max(labelLines.length * labelLineHeight, valueLines.length * valueLineHeight) + 2;

        ensureSpace(rowHeight);

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(labelSize);
        doc.setTextColor(...colors.muted);
        labelLines.forEach((line, idx) => {
          doc.text(line, marginX, cursorY + idx * labelLineHeight);
        });

        const normalizedUrl = normalizeExternalUrl(url || safeValue);
        const canLink = Boolean(
          normalizedUrl &&
          (normalizedUrl.startsWith('http://') ||
            normalizedUrl.startsWith('https://') ||
            normalizedUrl.startsWith('mailto:') ||
            normalizedUrl.startsWith('tel:'))
        );

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(valueSize);
        doc.setTextColor(...(canLink ? colors.primary : colors.ink));
        valueLines.forEach((line, idx) => {
          const y = cursorY + idx * valueLineHeight;
          if (canLink) {
            doc.textWithLink(line, rightX, y, { url: normalizedUrl });
          } else {
            doc.text(line, rightX, y);
          }
        });

        cursorY += rowHeight;
      };

      const drawParagraphRow = (label, text) => {
        const safeText = String(text || '').trim();
        if (!safeText) return;

        const labelLines = split(label, leftColWidth);
        const textLines = split(safeText, rightWidth);
        const labelLineHeight = 12.6;
        const textLineHeight = 14.4;
        const rowHeight = Math.max(labelLines.length * labelLineHeight, textLines.length * textLineHeight) + 2;
        ensureSpace(rowHeight);

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(9.2);
        doc.setTextColor(...colors.muted);
        labelLines.forEach((line, idx) => doc.text(line, marginX, cursorY + idx * labelLineHeight));

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(10.2);
        doc.setTextColor(...colors.ink);
        textLines.forEach((line, idx) => doc.text(line, rightX, cursorY + idx * textLineHeight));

        cursorY += rowHeight;
      };

      const drawBulletsRow = (label, bullets) => {
        const items = Array.isArray(bullets) ? bullets.filter(Boolean) : [];
        if (!items.length) return;

        const bulletLines = [];
        items.forEach((item) => {
          const wrapped = split(`• ${String(item).trim()}`, rightWidth);
          bulletLines.push(...wrapped);
        });

        const labelLines = split(label, leftColWidth);
        const labelLineHeight = 12.6;
        const textLineHeight = 14.4;
        const rowHeight = Math.max(labelLines.length * labelLineHeight, bulletLines.length * textLineHeight) + 2;
        ensureSpace(rowHeight);

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(9.2);
        doc.setTextColor(...colors.muted);
        labelLines.forEach((line, idx) => doc.text(line, marginX, cursorY + idx * labelLineHeight));

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(10.2);
        doc.setTextColor(...colors.ink);
        bulletLines.forEach((line, idx) => doc.text(line, rightX, cursorY + idx * textLineHeight));

        cursorY += rowHeight;
      };

      const drawEntryBlock = (leftLabel, item) => {
        const titleLines = split(item.title || '', rightWidth);
        const metaLines = item.meta ? split(item.meta, rightWidth) : [];
        const descLines = item.description ? split(item.description, rightWidth) : [];
        const bulletLines = [];
        (item.achievements || []).forEach((ach) => bulletLines.push(...split(`• ${ach}`, rightWidth)));

        const leftLines = split(leftLabel || '', leftColWidth);
        const lhLeft = 12.6;
        const lhTitle = 14.6;
        const lhText = 14.2;

        const rightHeight =
          titleLines.length * lhTitle +
          (metaLines.length ? (metaLines.length * 12.8 + 2) : 0) +
          (descLines.length ? (descLines.length * lhText + 2) : 0) +
          (bulletLines.length ? (bulletLines.length * lhText + 2) : 0) +
          6;
        const leftHeight = leftLines.length * lhLeft;
        const blockHeight = Math.max(leftHeight, rightHeight);

        ensureSpace(blockHeight);

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(9.2);
        doc.setTextColor(...colors.muted);
        leftLines.forEach((line, idx) => doc.text(line, marginX, cursorY + idx * lhLeft));

        let y = cursorY;
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(10.6);
        doc.setTextColor(...colors.ink);
        titleLines.forEach((line, idx) => doc.text(line, rightX, y + idx * lhTitle));
        y += titleLines.length * lhTitle;

        if (metaLines.length) {
          y += 1;
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(9.4);
          doc.setTextColor(...colors.muted);
          metaLines.forEach((line, idx) => doc.text(line, rightX, y + idx * 12.8));
          y += metaLines.length * 12.8;
        }

        if (descLines.length) {
          y += 3;
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(10.2);
          doc.setTextColor(...colors.ink);
          descLines.forEach((line, idx) => doc.text(line, rightX, y + idx * lhText));
          y += descLines.length * lhText;
        }

        if (bulletLines.length) {
          y += 3;
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(10.2);
          doc.setTextColor(...colors.ink);
          bulletLines.forEach((line, idx) => doc.text(line, rightX, y + idx * lhText));
        }

        cursorY += blockHeight;
      };

      // Header (nome + headline + foto)
      const headerTop = cursorY;
      const photoSize = photoDataUrl ? 88 : 0;
      const photoX = photoDataUrl ? pageWidth - marginX - photoSize : 0;
      const nameMaxWidth = photoDataUrl ? (photoX - 14 - marginX) : (pageWidth - marginX * 2);

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(22);
      doc.setTextColor(...colors.ink);
      const nameLines = split(cvDocument.fullName, nameMaxWidth);
      nameLines.forEach((line, idx) => doc.text(line, marginX, cursorY + idx * 24));
      cursorY += nameLines.length * 24;

      if (cvDocument.headline) {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(11.2);
        doc.setTextColor(...colors.primary);
        const headlineLines = split(cvDocument.headline, nameMaxWidth);
        headlineLines.forEach((line, idx) => doc.text(line, marginX, cursorY + idx * 15.2));
        cursorY += headlineLines.length * 15.2;
      }

      if (photoDataUrl) {
        const photoY = headerTop - 2;
        doc.setDrawColor(...colors.divider);
        doc.setLineWidth(1);
        doc.rect(photoX, photoY, photoSize, photoSize);
        doc.addImage(photoDataUrl, 'JPEG', photoX + 1, photoY + 1, photoSize - 2, photoSize - 2, undefined, 'FAST');
        cursorY = Math.max(cursorY, photoY + photoSize + 10);
      } else {
        cursorY += 8;
      }

      // Secções (estilo Europass: coluna de rótulos à esquerda)
      const personal = cvDocument.personal || {};
      drawSectionHeader('Informação pessoal');
      drawKeyValueRow('Email', personal.email, { url: personal.email && personal.email.includes('@') ? `mailto:${personal.email}` : '' });
      drawKeyValueRow('Telefone', personal.phone);
      drawKeyValueRow('Morada', personal.location);
      drawKeyValueRow('Nacionalidade', personal.nationality);
      drawKeyValueRow('Data de nascimento', personal.birthDateFormatted || personal.birthDate);
      drawKeyValueRow('Carta de condução', personal.drivingLicense);
      drawKeyValueRow('LinkedIn', personal.linkedin, { url: personal.linkedin });
      drawKeyValueRow('Website', personal.website, { url: personal.website });
      drawKeyValueRow('Portefólio', personal.portfolio, { url: personal.portfolio });

      if (cvDocument.summary) {
        drawSectionHeader('Resumo');
        drawParagraphRow('Resumo', cvDocument.summary);
      }

      if (cvDocument.objective) {
        drawSectionHeader('Objetivo');
        drawParagraphRow('Objetivo', cvDocument.objective);
      }

      if (cvDocument.experiences.length) {
        drawSectionHeader('Experiência profissional');
        cvDocument.experiences.forEach((item) => {
          drawEntryBlock(String(item.meta || '').split('•')[0].trim() || '', item);
          cursorY += 6;
        });
      }

      if (cvDocument.educationEntries.length) {
        drawSectionHeader('Educação e formação');
        cvDocument.educationEntries.forEach((item) => {
          drawEntryBlock(String(item.meta || '').split('•')[0].trim() || '', item);
          cursorY += 6;
        });
      }

      if (cvDocument.projects.length) {
        drawSectionHeader('Projetos');
        cvDocument.projects.forEach((item) => {
          drawEntryBlock('', item);
          cursorY += 6;
        });
      }

      if (cvDocument.certifications.length) {
        drawSectionHeader('Certificações');
        cvDocument.certifications.forEach((item) => {
          drawEntryBlock('', item);
          cursorY += 6;
        });
      }

      if (cvDocument.languages.length) {
        drawSectionHeader('Idiomas');
        cvDocument.languages.forEach((lang) => {
          drawKeyValueRow(lang.title || 'Idioma', lang.meta || '');
        });
      }

      if (cvDocument.technicalSkills.length || cvDocument.digitalSkills.length || cvDocument.softSkills.length) {
        drawSectionHeader('Competências');
        drawBulletsRow('Técnicas', cvDocument.technicalSkills);
        drawBulletsRow('Digitais', cvDocument.digitalSkills);
        drawBulletsRow('Interpessoais', cvDocument.softSkills);
      }

      if (cvDocument.interests.length) {
        drawSectionHeader('Interesses');
        drawBulletsRow('Interesses', cvDocument.interests);
      }

      if (cvDocument.references.length) {
        drawSectionHeader('Referências');
        drawBulletsRow('Referências', cvDocument.references);
      }

      if (cvDocument.additionalInfo.length) {
        drawSectionHeader('Informações adicionais');
        drawBulletsRow('Notas', cvDocument.additionalInfo);
      }

      doc.setProperties({
        title: `CV - ${cvDocument.fullName}`,
        subject: 'Currículo gerado no EmpregoSTP',
        author: cvDocument.fullName,
        creator: 'EmpregoSTP'
      });
      doc.save(`${slugifyFilename(cvDocument.fullName || 'cv-profissional')}.pdf`);
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
        <span className={styles.europassSectionTitle}>{String(title).toUpperCase()}</span>
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
      (safeHref.startsWith('http://') || safeHref.startsWith('https://') || safeHref.startsWith('mailto:') || safeHref.startsWith('tel:'))
    );
    return (
      <div className={styles.europassRow}>
        <div className={styles.europassLeft}>{label}</div>
        <div className={styles.europassRight}>
          {safeValue ? (
            canLink ? <a className={styles.europassLink} href={safeHref} target="_blank" rel="noreferrer">{safeValue}</a> : safeValue
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
              {safeItems.map((item) => <li key={`${label}-${item}`}>{item}</li>)}
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
            <span className={styles.europassPlaceholder}>Adicione conteúdo nesta secção para ver o resultado final.</span>
          </div>
        </div>
      );
    }

    return items.map((item) => {
      const metaParts = String(item.meta || '').split('•').map((part) => part.trim()).filter(Boolean);
      const dateLabel = metaParts[0] || '';
      const metaRest = metaParts.slice(1).join(' • ');
      return (
        <div key={item.id} className={styles.europassRow}>
          <div className={styles.europassLeft}>{dateLabel || ' '}</div>
          <div className={styles.europassRight}>
            <div className={styles.europassEntryTitle}>{item.title}</div>
            {metaRest ? <div className={styles.europassEntryMeta}>{metaRest}</div> : null}
            {item.description ? <p className={styles.europassText}>{item.description}</p> : null}
            {Array.isArray(item.achievements) && item.achievements.length ? (
              <ul className={styles.europassBullets}>
                {item.achievements.map((ach) => <li key={`${item.id}-${ach}`}>{ach}</li>)}
              </ul>
            ) : null}
          </div>
        </div>
      );
    });
  };

  const title = gate.status === 'ready'
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
      <div className={styles.page}>
        <LandingHeader />
        <main className={styles.container}>
          <Link href="/recursos" className={styles.breadcrumb}>
            {'<-'} Voltar para Recursos
          </Link>

          <section className={styles.hero}>
            <div className={styles.heroCopy}>
              <div className={styles.eyebrow}>CV Builder Premium</div>
              <h1 className={styles.title}>Gerador de CV completo, estruturado e pronto para PDF.</h1>
              <p className={styles.subtitle}>
                Preencha um currículo robusto, com experiência, formação, projetos, competências, idiomas e links profissionais.
                O layout foi pensado para um resultado formal, claro e competitivo, no nível de um CV Europass moderno.
              </p>
            </div>
            <aside className={styles.heroAside}>
              <h2 className={styles.heroAsideTitle}>Inclui nesta versão</h2>
              <ul className={styles.featureList}>
                <li>Formulário completo com múltiplas secções profissionais</li>
                <li>Pré-visualização em tempo real com layout editorial</li>
                <li>Exportação direta em PDF para candidatura imediata</li>
                <li>Disponível apenas para candidatos Profissional ou Premium</li>
              </ul>
            </aside>
          </section>

          {authLoading || profileLoading ? (
            <div className={styles.loadingCard}>
              <h2>A carregar gerador de CV</h2>
              <p>Estou a validar o plano do candidato e a preparar os dados do perfil para pré-preenchimento.</p>
            </div>
          ) : null}

          {!authLoading && !profileLoading && gate.status === 'anonymous' ? (
            <LockedState
              title="Inicie sessão para usar o gerador premium"
              description={gate.message}
              ctaHref="/login?redirect=/recursos/gerador-cv"
              ctaLabel="Entrar como candidato"
              secondaryHref="/premium/candidatos"
              secondaryLabel="Ver planos"
            />
          ) : null}

          {!authLoading && !profileLoading && gate.status === 'forbidden' ? (
            <LockedState
              title="Recurso exclusivo para candidatos"
              description={gate.message}
              ctaHref="/dashboard/candidato"
              ctaLabel="Ir para dashboard candidato"
              secondaryHref="/recursos"
              secondaryLabel="Voltar aos recursos"
            />
          ) : null}

          {!authLoading && !profileLoading && gate.status === 'upgrade' ? (
            <LockedState
              title="Disponível no plano Profissional"
              description={`${gate.message}${gate.planName ? ` O seu plano atual é ${gate.planName}.` : ''}`}
              ctaHref="/premium/candidatos"
              ctaLabel="Fazer upgrade"
              secondaryHref="/recursos"
              secondaryLabel="Voltar aos recursos"
            />
          ) : null}

          {!authLoading && !profileLoading && gate.status === 'error' ? (
            <div className={styles.errorCard}>
              <h2>Erro ao carregar o gerador</h2>
              <p>{profileError}</p>
              <div className={styles.actions}>
                <button type="button" className={styles.primaryButton} onClick={() => window.location.reload()}>
                  Tentar novamente
                </button>
                <Link href="/recursos" className={styles.button}>Voltar aos recursos</Link>
              </div>
            </div>
          ) : null}

          {!authLoading && !profileLoading && gate.status === 'ready' ? (
            <div className={styles.layout}>
              <div className={styles.editorColumn}>
                <section className={styles.panel}>
                  <div className={styles.sectionHeader}>
                    <div>
                      <h2 className={styles.panelTitle}>Dados pessoais</h2>
                      <p className={styles.panelDescription}>Informações base do cabeçalho do currículo e canais de contacto.</p>
                    </div>
                    <span className={styles.badge}>Plano {gate.planName}</span>
                  </div>

                  <div className={styles.sectionBlock}>
                    <div className={styles.photoRow}>
                      <div className={styles.photoPreviewWrap}>
                        {cvDocument.photo ? (
                          // `next/image` pode falhar em HMR com Turbopack nesta rota.
                          // Usamos `<img>` para estabilidade (a imagem pode ser dataURL).
                          <img
                            src={cvDocument.photo}
                            alt="Foto de perfil para CV"
                            className={styles.photoPreview}
                            width={92}
                            height={92}
                          />
                        ) : (
                          <div className={styles.photoPlaceholder}>Sem foto</div>
                        )}
                      </div>
                      <div className={styles.photoActions}>
                        <label className={styles.button}>
                          Carregar foto
                          <input
                            type="file"
                            accept="image/png,image/jpeg,image/jpg,image/webp"
                            onChange={handlePhotoUpload}
                            className={styles.hiddenInput}
                          />
                        </label>
                        {cvDocument.photo ? (
                          <button type="button" className={styles.ghostButton} onClick={removePhoto}>
                            Remover foto
                          </button>
                        ) : null}
                        <p className={styles.helperText}>Foto opcional. Recomendado: fundo neutro, proporção 1:1 e até 3MB.</p>
                        {photoError ? <p className={styles.photoError}>{photoError}</p> : null}
                      </div>
                    </div>

                    <div className={styles.grid2}>
                      <TextField label="Nome completo" value={form.fullName} onChange={(event) => setForm((prev) => ({ ...prev, fullName: event.target.value }))} />
                      <TextField label="Título profissional" value={form.headline} onChange={(event) => setForm((prev) => ({ ...prev, headline: event.target.value }))} placeholder="Ex.: Analista Financeiro | Especialista em Controlo de Gestão" />
                    </div>
                    <div className={styles.grid3}>
                      <TextField label="Email" type="email" value={form.email} onChange={(event) => setForm((prev) => ({ ...prev, email: event.target.value }))} />
                      <TextField label="Telefone" value={form.phone} onChange={(event) => setForm((prev) => ({ ...prev, phone: event.target.value }))} />
                      <TextField label="Localização" value={form.location} onChange={(event) => setForm((prev) => ({ ...prev, location: event.target.value }))} placeholder="Cidade, País" />
                    </div>
                    <div className={styles.grid3}>
                      <TextField label="Nacionalidade" value={form.nationality} onChange={(event) => setForm((prev) => ({ ...prev, nationality: event.target.value }))} />
                      <TextField label="Data de nascimento" type="date" value={form.birthDate} onChange={(event) => setForm((prev) => ({ ...prev, birthDate: event.target.value }))} />
                      <TextField label="Carta de condução" value={form.drivingLicense} onChange={(event) => setForm((prev) => ({ ...prev, drivingLicense: event.target.value }))} placeholder="Ex.: B" />
                    </div>
                    <div className={styles.grid3}>
                      <TextField label="LinkedIn" value={form.linkedin} onChange={(event) => setForm((prev) => ({ ...prev, linkedin: event.target.value }))} placeholder="https://www.linkedin.com/in/..." />
                      <TextField label="Website" value={form.website} onChange={(event) => setForm((prev) => ({ ...prev, website: event.target.value }))} placeholder="https://..." />
                      <TextField label="Portefólio" value={form.portfolio} onChange={(event) => setForm((prev) => ({ ...prev, portfolio: event.target.value }))} placeholder="Behance, GitHub, Dribbble, Notion..." />
                    </div>
                  </div>
                </section>

                <section className={styles.panel}>
                  <h2 className={styles.panelTitle}>Resumo e objetivo</h2>
                  <p className={styles.panelDescription}>Escreva um resumo executivo e indique a direção profissional que pretende seguir.</p>
                  <div className={styles.sectionBlock}>
                    <TextAreaField
                      label="Resumo profissional"
                      value={form.summary}
                      onChange={(event) => setForm((prev) => ({ ...prev, summary: event.target.value }))}
                      placeholder="Descreva a sua experiência principal, setor, impacto e proposta de valor em 4 a 6 linhas."
                    />
                    <TextAreaField
                      label="Objetivo profissional"
                      value={form.objective}
                      onChange={(event) => setForm((prev) => ({ ...prev, objective: event.target.value }))}
                      placeholder="Ex.: Procurar uma função de gestão operacional com foco em eficiência, equipa e melhoria contínua."
                      compact
                    />
                  </div>
                </section>

                <section className={styles.panel}>
                  <div className={styles.sectionHeader}>
                    <div>
                      <h2 className={styles.panelTitle}>Experiência profissional</h2>
                      <p className={styles.panelDescription}>Organize a carreira por cargo, entidade, período, contexto e resultados.</p>
                    </div>
                    <button type="button" className={styles.button} onClick={() => setExperiences((prev) => [...prev, createExperience()])}>Adicionar experiência</button>
                  </div>
                  <div className={styles.sectionBlock}>
                    {experiences.map((item, index) => (
                      <div key={item.id} className={styles.entryCard}>
                        <div className={styles.entryTop}>
                          <h3 className={styles.entryTitle}>Experiência {index + 1}</h3>
                          <button type="button" className={styles.dangerButton} onClick={() => removeCollectionItem(setExperiences, createExperience, item.id)}>
                            Remover
                          </button>
                        </div>
                        <div className={styles.grid2}>
                          <TextField label="Cargo" value={item.role} onChange={(event) => updateCollectionItem(setExperiences, item.id, 'role', event.target.value)} />
                          <TextField label="Empresa" value={item.employer} onChange={(event) => updateCollectionItem(setExperiences, item.id, 'employer', event.target.value)} />
                        </div>
                        <div className={styles.grid2}>
                          <TextField label="Cidade" value={item.city} onChange={(event) => updateCollectionItem(setExperiences, item.id, 'city', event.target.value)} />
                          <TextField label="País" value={item.country} onChange={(event) => updateCollectionItem(setExperiences, item.id, 'country', event.target.value)} />
                        </div>
                        <div className={styles.grid3}>
                          <TextField label="Início" type="month" value={item.startDate} onChange={(event) => updateCollectionItem(setExperiences, item.id, 'startDate', event.target.value)} />
                          <TextField label="Fim" type="month" value={item.endDate} onChange={(event) => updateCollectionItem(setExperiences, item.id, 'endDate', event.target.value)} />
                          <label className={styles.checkboxRow}>
                            <input type="checkbox" checked={item.current} onChange={(event) => updateCollectionItem(setExperiences, item.id, 'current', event.target.checked)} />
                            Função atual
                          </label>
                        </div>
                        <TextAreaField
                          label="Descrição da função"
                          value={item.description}
                          onChange={(event) => updateCollectionItem(setExperiences, item.id, 'description', event.target.value)}
                          placeholder="Contexto da função, equipa, escopo e principais responsabilidades."
                          compact
                        />
                        <TextAreaField
                          label="Resultados e realizações"
                          value={item.achievements}
                          onChange={(event) => updateCollectionItem(setExperiences, item.id, 'achievements', event.target.value)}
                          placeholder="Uma conquista por linha ou separada por vírgulas."
                          compact
                        />
                      </div>
                    ))}
                  </div>
                </section>

                <section className={styles.panel}>
                  <div className={styles.sectionHeader}>
                    <div>
                      <h2 className={styles.panelTitle}>Formação académica</h2>
                      <p className={styles.panelDescription}>Inclua curso, instituição, período e notas relevantes.</p>
                    </div>
                    <button type="button" className={styles.button} onClick={() => setEducationEntries((prev) => [...prev, createEducation()])}>Adicionar formação</button>
                  </div>
                  <div className={styles.sectionBlock}>
                    {educationEntries.map((item, index) => (
                      <div key={item.id} className={styles.entryCard}>
                        <div className={styles.entryTop}>
                          <h3 className={styles.entryTitle}>Formação {index + 1}</h3>
                          <button type="button" className={styles.dangerButton} onClick={() => removeCollectionItem(setEducationEntries, createEducation, item.id)}>
                            Remover
                          </button>
                        </div>
                        <div className={styles.grid2}>
                          <TextField label="Curso / Qualificação" value={item.qualification} onChange={(event) => updateCollectionItem(setEducationEntries, item.id, 'qualification', event.target.value)} />
                          <TextField label="Instituição" value={item.institution} onChange={(event) => updateCollectionItem(setEducationEntries, item.id, 'institution', event.target.value)} />
                        </div>
                        <div className={styles.grid2}>
                          <TextField label="Cidade" value={item.city} onChange={(event) => updateCollectionItem(setEducationEntries, item.id, 'city', event.target.value)} />
                          <TextField label="País" value={item.country} onChange={(event) => updateCollectionItem(setEducationEntries, item.id, 'country', event.target.value)} />
                        </div>
                        <div className={styles.grid2}>
                          <TextField label="Início" type="month" value={item.startDate} onChange={(event) => updateCollectionItem(setEducationEntries, item.id, 'startDate', event.target.value)} />
                          <TextField label="Fim" type="month" value={item.endDate} onChange={(event) => updateCollectionItem(setEducationEntries, item.id, 'endDate', event.target.value)} />
                        </div>
                        <TextAreaField
                          label="Detalhes"
                          value={item.details}
                          onChange={(event) => updateCollectionItem(setEducationEntries, item.id, 'details', event.target.value)}
                          placeholder="Ex.: tema de dissertação, média final, módulos relevantes, distinções."
                          compact
                        />
                      </div>
                    ))}
                  </div>
                </section>

                <section className={styles.panel}>
                  <div className={styles.sectionHeader}>
                    <div>
                      <h2 className={styles.panelTitle}>Projetos e certificações</h2>
                      <p className={styles.panelDescription}>Mostre entregas relevantes, links de prova e credenciais adicionais.</p>
                    </div>
                  </div>
                  <div className={styles.sectionBlock}>
                    <div className={styles.sectionHeader}>
                      <h3>Projetos</h3>
                      <button type="button" className={styles.button} onClick={() => setProjectEntries((prev) => [...prev, createProject()])}>Adicionar projeto</button>
                    </div>
                    {projectEntries.map((item, index) => (
                      <div key={item.id} className={styles.entryCard}>
                        <div className={styles.entryTop}>
                          <h3 className={styles.entryTitle}>Projeto {index + 1}</h3>
                          <button type="button" className={styles.dangerButton} onClick={() => removeCollectionItem(setProjectEntries, createProject, item.id)}>
                            Remover
                          </button>
                        </div>
                        <div className={styles.grid3}>
                          <TextField label="Nome do projeto" value={item.name} onChange={(event) => updateCollectionItem(setProjectEntries, item.id, 'name', event.target.value)} />
                          <TextField label="Papel desempenhado" value={item.role} onChange={(event) => updateCollectionItem(setProjectEntries, item.id, 'role', event.target.value)} />
                          <TextField label="Link" value={item.link} onChange={(event) => updateCollectionItem(setProjectEntries, item.id, 'link', event.target.value)} placeholder="https://..." />
                        </div>
                        <TextAreaField
                          label="Resumo"
                          value={item.summary}
                          onChange={(event) => updateCollectionItem(setProjectEntries, item.id, 'summary', event.target.value)}
                          placeholder="Problema, solução entregue, stack, impacto e resultados."
                          compact
                        />
                      </div>
                    ))}

                    <div className={styles.sectionHeader}>
                      <h3>Certificações</h3>
                      <button type="button" className={styles.button} onClick={() => setCertificationEntries((prev) => [...prev, createCertification()])}>Adicionar certificação</button>
                    </div>
                    {certificationEntries.map((item, index) => (
                      <div key={item.id} className={styles.entryCard}>
                        <div className={styles.entryTop}>
                          <h3 className={styles.entryTitle}>Certificação {index + 1}</h3>
                          <button type="button" className={styles.dangerButton} onClick={() => removeCollectionItem(setCertificationEntries, createCertification, item.id)}>
                            Remover
                          </button>
                        </div>
                        <div className={styles.grid3}>
                          <TextField label="Título" value={item.title} onChange={(event) => updateCollectionItem(setCertificationEntries, item.id, 'title', event.target.value)} />
                          <TextField label="Entidade emissora" value={item.issuer} onChange={(event) => updateCollectionItem(setCertificationEntries, item.id, 'issuer', event.target.value)} />
                          <TextField label="Ano" value={item.year} onChange={(event) => updateCollectionItem(setCertificationEntries, item.id, 'year', event.target.value)} placeholder="2026" />
                        </div>
                      </div>
                    ))}
                  </div>
                </section>

                <section className={styles.panel}>
                  <div className={styles.sectionHeader}>
                    <div>
                      <h2 className={styles.panelTitle}>Competências, idiomas e informação adicional</h2>
                      <p className={styles.panelDescription}>Complete as secções laterais do currículo com conteúdo de suporte.</p>
                    </div>
                    <button type="button" className={styles.button} onClick={() => setLanguageEntries((prev) => [...prev, createLanguage()])}>Adicionar idioma</button>
                  </div>
                  <div className={styles.sectionBlock}>
                    <div className={styles.grid3}>
                      <TextAreaField label="Competências técnicas" value={form.technicalSkills} onChange={(event) => setForm((prev) => ({ ...prev, technicalSkills: event.target.value }))} placeholder="Excel avançado, SQL, Power BI, JavaScript..." compact />
                      <TextAreaField label="Competências digitais" value={form.digitalSkills} onChange={(event) => setForm((prev) => ({ ...prev, digitalSkills: event.target.value }))} placeholder="Ferramentas, plataformas e stack digital." compact />
                      <TextAreaField label="Competências interpessoais" value={form.softSkills} onChange={(event) => setForm((prev) => ({ ...prev, softSkills: event.target.value }))} placeholder="Liderança, comunicação, negociação..." compact />
                    </div>

                    {languageEntries.map((item, index) => (
                      <div key={item.id} className={styles.entryCard}>
                        <div className={styles.entryTop}>
                          <h3 className={styles.entryTitle}>Idioma {index + 1}</h3>
                          <button type="button" className={styles.dangerButton} onClick={() => removeCollectionItem(setLanguageEntries, createLanguage, item.id)}>
                            Remover
                          </button>
                        </div>
                        <div className={styles.grid2}>
                          <TextField label="Idioma" value={item.name} onChange={(event) => updateCollectionItem(setLanguageEntries, item.id, 'name', event.target.value)} placeholder="Português" />
                          <TextField label="Nível" value={item.level} onChange={(event) => updateCollectionItem(setLanguageEntries, item.id, 'level', event.target.value)} placeholder="Nativo, C1, Intermédio..." />
                        </div>
                      </div>
                    ))}

                    <div className={styles.grid3}>
                      <TextAreaField label="Interesses" value={form.interests} onChange={(event) => setForm((prev) => ({ ...prev, interests: event.target.value }))} placeholder="Voluntariado, leitura, eventos setoriais..." compact />
                      <TextAreaField label="Referências" value={form.references} onChange={(event) => setForm((prev) => ({ ...prev, references: event.target.value }))} placeholder="Uma referência por linha ou separada por vírgulas." compact />
                      <TextAreaField label="Informações adicionais" value={form.additionalInfo} onChange={(event) => setForm((prev) => ({ ...prev, additionalInfo: event.target.value }))} placeholder="Disponibilidade, mobilidade, prémios, publicações..." compact />
                    </div>
                  </div>
                </section>
              </div>

              <aside className={styles.previewColumn}>
                <div className={styles.previewSticky}>
                  <section className={styles.panel}>
                    <div className={styles.previewToolbar}>
                      <div>
                        <h2 className={styles.panelTitle}>Pré-visualização</h2>
                        <p>O PDF é gerado com base nesta estrutura e nos dados preenchidos.</p>
                      </div>
                      <button type="button" className={styles.primaryButton} onClick={exportPdf} disabled={isExporting}>
                        {isExporting ? 'A gerar PDF...' : 'Gerar PDF'}
                      </button>
                    </div>
                    {statusMessage ? <p className={styles.statusMessage}>{statusMessage}</p> : null}
                    <p className={styles.helperText}>
                      Dica: use frases curtas, verbos de ação e resultados concretos. O melhor CV não é o mais longo, é o mais preciso.
                    </p>
                  </section>

                  <div className={styles.previewShell}>
                    <div className={styles.previewPage}>
                      <header className={styles.europassHeader}>
                        <div className={styles.europassHeaderLeft}>
                          <h2 className={styles.europassName}>{cvDocument.fullName}</h2>
                          {cvDocument.headline ? <p className={styles.europassHeadline}>{cvDocument.headline}</p> : null}
                        </div>
                        {cvDocument.photo ? (
                          <div className={styles.europassPhotoWrap}>
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
                        {renderEuropassFieldRow('Email', cvDocument.personal?.email, { href: cvDocument.personal?.email ? `mailto:${cvDocument.personal.email}` : '' })}
                        {renderEuropassFieldRow('Telefone', cvDocument.personal?.phone)}
                        {renderEuropassFieldRow('Morada', cvDocument.personal?.location)}
                        {renderEuropassFieldRow('Nacionalidade', cvDocument.personal?.nationality)}
                        {renderEuropassFieldRow('Data de nascimento', cvDocument.personal?.birthDateFormatted || cvDocument.personal?.birthDate)}
                        {renderEuropassFieldRow('Carta de condução', cvDocument.personal?.drivingLicense)}
                        {renderEuropassFieldRow('LinkedIn', cvDocument.personal?.linkedin, { href: normalizeExternalUrl(cvDocument.personal?.linkedin) })}
                        {renderEuropassFieldRow('Website', cvDocument.personal?.website, { href: normalizeExternalUrl(cvDocument.personal?.website) })}
                        {renderEuropassFieldRow('Portefólio', cvDocument.personal?.portfolio, { href: normalizeExternalUrl(cvDocument.personal?.portfolio) })}

                        {renderEuropassSectionHeader('Resumo')}
                        <div className={styles.europassRow}>
                          <div className={styles.europassLeft}>Resumo</div>
                          <div className={styles.europassRight}>
                            {cvDocument.summary ? <p className={styles.europassText}>{cvDocument.summary}</p> : <span className={styles.europassPlaceholder}>Por preencher</span>}
                          </div>
                        </div>

                        {renderEuropassSectionHeader('Objetivo')}
                        <div className={styles.europassRow}>
                          <div className={styles.europassLeft}>Objetivo</div>
                          <div className={styles.europassRight}>
                            {cvDocument.objective ? <p className={styles.europassText}>{cvDocument.objective}</p> : <span className={styles.europassPlaceholder}>Por preencher</span>}
                          </div>
                        </div>

                        {renderEuropassSectionHeader('Experiência profissional')}
                        {renderEuropassEntries(cvDocument.experiences)}

                        {renderEuropassSectionHeader('Educação e formação')}
                        {renderEuropassEntries(cvDocument.educationEntries)}

                        {renderEuropassSectionHeader('Projetos')}
                        {renderEuropassEntries(cvDocument.projects)}

                        {renderEuropassSectionHeader('Certificações')}
                        {renderEuropassEntries(cvDocument.certifications)}

                        {renderEuropassSectionHeader('Idiomas')}
                        {cvDocument.languages.length
                          ? cvDocument.languages.map((lang) => (
                            <div key={lang.id} className={styles.europassRow}>
                              <div className={styles.europassLeft}>{lang.title || 'Idioma'}</div>
                              <div className={styles.europassRight}>{lang.meta || <span className={styles.europassPlaceholder}>Nível</span>}</div>
                            </div>
                          ))
                          : (
                            <div className={styles.europassRow}>
                              <div className={styles.europassLeft} />
                              <div className={styles.europassRight}><span className={styles.europassPlaceholder}>Por preencher</span></div>
                            </div>
                          )}

                        {renderEuropassSectionHeader('Competências')}
                        {renderEuropassBulletsRow('Técnicas', cvDocument.technicalSkills)}
                        {renderEuropassBulletsRow('Digitais', cvDocument.digitalSkills)}
                        {renderEuropassBulletsRow('Interpessoais', cvDocument.softSkills)}

                        {renderEuropassSectionHeader('Interesses')}
                        {renderEuropassBulletsRow('Interesses', cvDocument.interests)}

                        {renderEuropassSectionHeader('Referências')}
                        {renderEuropassBulletsRow('Referências', cvDocument.references)}

                        {renderEuropassSectionHeader('Informações adicionais')}
                        {renderEuropassBulletsRow('Notas', cvDocument.additionalInfo)}
                      </div>
                    </div>
                  </div>
                </div>
              </aside>
            </div>
          ) : null}
        </main>
        <Footer />
      </div>
    </>
  );
}
