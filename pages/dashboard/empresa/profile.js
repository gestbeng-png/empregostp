import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import Image from 'next/image';
import Link from 'next/link';
import { useAuth } from '../../../context/AuthContext';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from '../../../lib/firebase';
import { getFirebaseStorageErrorMessage } from '../../../lib/firebaseStorageError';
import {
  FiAlertCircle,
  FiArrowLeft,
  FiBriefcase,
  FiCheckCircle,
  FiEye,
  FiFacebook,
  FiFileText,
  FiGlobe,
  FiImage,
  FiInstagram,
  FiLinkedin,
  FiMail,
  FiMapPin,
  FiPhone,
  FiSave,
  FiShare2,
  FiUploadCloud,
  FiUsers,
  FiX,
} from 'react-icons/fi';
import DashboardShell from '../../../components/dashboard/DashboardShell';
import AutoSaveStatus from '../../../components/forms/AutoSaveStatus';
import useAutoDraft from '../../../hooks/useAutoDraft';
import { COMPANY_SIZES, INDUSTRY_SECTORS } from '../../../lib/companyOptions';
import { createFormDraftKey } from '../../../lib/formDraft';
import styles from '../../../styles/EmpresaProfilePage.module.css';
import { requireCompanySession } from '../../../lib/serverSession';
import { buildLoginUrl } from '../../../lib/loginRedirect';

function prepareCompanyProfileDraft(value) {
  if (!value || typeof value !== 'object') return {};

  const draft = { ...value };
  delete draft.email;
  return draft;
}

export default function CompanyProfilePage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [uploadingCover, setUploadingCover] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [profileUpdatedAt, setProfileUpdatedAt] = useState('');

  const [form, setForm] = useState({
    name: '',
    email: '',
    phone: '',
    description: '',
    companySize: '',
    website: '',
    industrySectors: [],
    location: '',
    logoUrl: '',
    coverImageUrl: '',
    linkedin: '',
    facebook: '',
    instagram: '',
  });

  const uploading = uploadingLogo || uploadingCover;
  const draftOwnerId = user?.uid || '';
  const profileDraftKey = useMemo(
    () =>
      createFormDraftKey({
        scope: 'company-profile',
        ownerId: draftOwnerId,
        resourceId: 'default',
      }),
    [draftOwnerId],
  );

  const getDraftToken = useCallback(async () => {
    if (!user) return '';
    return user.getIdToken();
  }, [user]);

  const restoreProfileDraft = useCallback((draft) => {
    const restoredFields = prepareCompanyProfileDraft(draft);
    setForm((current) => ({ ...current, ...restoredFields }));
  }, []);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.push(buildLoginUrl(router.asPath));
      return;
    }

    const fetchProfile = async () => {
      try {
        const token = await user.getIdToken();
        const response = await fetch('/api/empresa', {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (!response.ok) {
          throw new Error('Erro ao carregar perfil');
        }

        const result = await response.json();
        const data = result.profile || {};
        setProfileUpdatedAt(data.updatedAt || '');
        setForm({
          name: data.name || data.fullName || '',
          email: data.email || user.email || '',
          phone: data.phone || '',
          description: data.description || '',
          companySize: data.companySize || '',
          website: data.website || '',
          industrySectors: data.industrySectors || [],
          location: data.location || data.address?.district || '',
          logoUrl: data.logoUrl || '',
          coverImageUrl: data.coverImageUrl || '',
          linkedin: data.socialMedia?.linkedin || data.linkedin || '',
          facebook: data.socialMedia?.facebook || data.facebook || '',
          instagram: data.socialMedia?.instagram || data.instagram || '',
        });
      } catch (e) {
        setError('Erro ao carregar perfil');
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
  }, [user, authLoading, router]);

  const {
    status: profileDraftStatus,
    lastSavedAt: profileDraftSavedAt,
    isOnline: profileDraftIsOnline,
    clearDraft: clearProfileDraft,
  } = useAutoDraft({
    storageKey: profileDraftKey,
    scope: 'company-profile',
    resourceId: 'default',
    value: form,
    onRestore: restoreProfileDraft,
    getToken: getDraftToken,
    enabled: Boolean(draftOwnerId),
    ready: !loading,
    baseUpdatedAt: profileUpdatedAt,
    prepareLocal: prepareCompanyProfileDraft,
    prepareRemote: prepareCompanyProfileDraft,
  });

  async function handleSave(e) {
    e?.preventDefault();

    if (!user) {
      setError('Você precisa estar logado');
      return;
    }

    if (!form.name || !form.phone) {
      setError('Por favor, preencha nome e telefone');
      return;
    }

    setSaving(true);
    setError('');
    setSuccess('');

    try {
      const dataToUpdate = {
        name: form.name,
        fullName: form.name,
        phone: form.phone,
        description: form.description,
        companySize: form.companySize,
        website: form.website,
        industrySectors: form.industrySectors,
        location: form.location,
        logoUrl: form.logoUrl,
        coverImageUrl: form.coverImageUrl,
        linkedin: form.linkedin,
        facebook: form.facebook,
        instagram: form.instagram,
        socialMedia: {
          linkedin: form.linkedin,
          facebook: form.facebook,
          instagram: form.instagram,
        },
        updatedAt: new Date().toISOString(),
      };

      const token = await user.getIdToken();
      const response = await fetch('/api/empresa', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(dataToUpdate),
      });

      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(result.message || 'Erro ao salvar perfil');
      }

      await clearProfileDraft();
      setProfileUpdatedAt(dataToUpdate.updatedAt);
      setSuccess('Perfil atualizado com sucesso.');
    } catch (e) {
      let errorMessage = 'Erro ao salvar perfil. ';

      if (e.code === 'permission-denied') {
        errorMessage +=
          'Sem permissão para atualizar. Verifique as regras do Firestore.';
      } else if (e.code === 'not-found') {
        errorMessage += 'Documento não encontrado.';
      } else {
        errorMessage += e.message;
      }

      setError(errorMessage);
      setTimeout(() => setError(''), 5000);
    } finally {
      setSaving(false);
    }
  }

  async function handleFileUpload(e, field) {
    if (!user) {
      setError('Você precisa estar logado para fazer upload');
      return;
    }

    const isLogo = field === 'logoUrl';

    if (isLogo) {
      setUploadingLogo(true);
    } else {
      setUploadingCover(true);
    }

    try {
      const file = e.target.files[0];
      if (!file) {
        if (isLogo) setUploadingLogo(false);
        else setUploadingCover(false);
        return;
      }

      if (file.size > 5 * 1024 * 1024) {
        setError('Arquivo muito grande. Máximo: 5MB');
        if (isLogo) setUploadingLogo(false);
        else setUploadingCover(false);
        setTimeout(() => setError(''), 3000);
        return;
      }

      if (!file.type.startsWith('image/')) {
        setError('Por favor, envie apenas imagens');
        if (isLogo) setUploadingLogo(false);
        else setUploadingCover(false);
        setTimeout(() => setError(''), 3000);
        return;
      }

      const folderName = isLogo ? 'company-logos' : 'company-covers';
      const fileName = `${Date.now()}_${file.name.replace(/[^a-zA-Z0-9.]/g, '_')}`;
      const storagePath = `${folderName}/${user.uid}/${fileName}`;
      const storageRef = ref(storage, storagePath);

      await uploadBytes(storageRef, file);
      const url = await getDownloadURL(storageRef);

      setForm((prev) => ({ ...prev, [field]: url }));
      setSuccess(`${isLogo ? 'Logo' : 'Imagem de capa'} enviado com sucesso!`);
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      const errorMessage = getFirebaseStorageErrorMessage(
        err,
        `Erro ao enviar ${isLogo ? 'logo' : 'imagem de capa'}.`,
      );

      setError(errorMessage);
      setTimeout(() => setError(''), 5000);
    } finally {
      if (isLogo) {
        setUploadingLogo(false);
      } else {
        setUploadingCover(false);
      }
    }
  }

  function toggleSector(sector) {
    setForm((prev) => ({
      ...prev,
      industrySectors: prev.industrySectors.includes(sector)
        ? prev.industrySectors.filter((s) => s !== sector)
        : [...prev.industrySectors, sector],
    }));
  }

  if (authLoading || loading) {
    return (
      <>
        <Head>
          <title>Perfil da Empresa - EmpregoSTP</title>
        </Head>
        <div className={styles.loadingPage} aria-busy="true">
          <div className={styles.loadingSpinner} aria-hidden="true" />
          <p className={styles.loadingText} role="status">
            A carregar perfil...
          </p>
        </div>
      </>
    );
  }

  return (
    <>
      <Head>
        <title>Perfil da Empresa - EmpregoSTP</title>
      </Head>

      <DashboardShell
        role="empresa"
        active="company-profile"
        title="Perfil empresa"
        subtitle="Perfil público da empresa"
        profile={{
          name: form.name || user?.displayName || 'Empresa',
          role: 'Empresa',
          avatarUrl: form.logoUrl,
        }}
      >
        <div className="dash-page">
          <header className={styles.pageHeader}>
            <div className={styles.pageHeaderCopy}>
              <Link href="/dashboard/empresa" className={styles.backLink}>
                <FiArrowLeft aria-hidden="true" />
                Voltar ao dashboard
              </Link>
              <span className={styles.eyebrow}>Configurações da empresa</span>
              <h1 className={styles.title}>Perfil da empresa</h1>
              <p className={styles.description}>
                Gira a presença da sua empresa no portal. Estas informações
                serão apresentadas aos candidatos.
              </p>
              <AutoSaveStatus
                status={profileDraftStatus}
                lastSavedAt={profileDraftSavedAt}
                isOnline={profileDraftIsOnline}
              />
            </div>

            {user?.uid ? (
              <Link
                href={`/empresas/${user.uid}`}
                className={styles.publicProfileAction}
              >
                <FiEye aria-hidden="true" />
                Ver perfil público
              </Link>
            ) : null}
          </header>

          {success ? (
            <div
              className={`${styles.banner} ${styles.bannerSuccess}`}
              role="status"
              aria-live="polite"
            >
              <FiCheckCircle className={styles.bannerIcon} aria-hidden="true" />
              <span>{success}</span>
            </div>
          ) : null}

          {error ? (
            <div
              className={`${styles.banner} ${styles.bannerError}`}
              role="alert"
            >
              <FiAlertCircle className={styles.bannerIcon} aria-hidden="true" />
              <span>{error}</span>
            </div>
          ) : null}

          <form className={styles.formLayout} onSubmit={handleSave}>
            <nav
              className={styles.sectionNav}
              aria-label="Secções do perfil da empresa"
            >
              <a href="#marca">
                <FiImage aria-hidden="true" />
                Marca
              </a>
              <a href="#informacoes-basicas">
                <FiBriefcase aria-hidden="true" />
                Informações básicas
              </a>
              <a href="#sobre-a-empresa">
                <FiFileText aria-hidden="true" />
                Sobre a empresa
              </a>
              <a href="#redes-sociais">
                <FiShare2 aria-hidden="true" />
                Redes sociais
              </a>
            </nav>

            <div className={styles.formColumns}>
              <aside className={styles.brandColumn}>
                <FormSection
                  id="marca"
                  title="Gestão de marca"
                  description="Mantenha a identidade visual da empresa atualizada."
                  icon={FiImage}
                >
                  <UploadCard
                    title="Logo da Empresa"
                    note="JPG ou PNG quadrado. Máximo 5 MB."
                    imageUrl={form.logoUrl}
                    imageAlt={`Logo de ${form.name || 'empresa'}`}
                    variant="logo"
                    buttonLabel={uploadingLogo ? 'A enviar...' : 'Alterar logo'}
                  >
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => handleFileUpload(e, 'logoUrl')}
                      className={styles.hiddenInput}
                      disabled={uploadingLogo}
                    />
                  </UploadCard>

                  <UploadCard
                    title="Imagem de Capa"
                    note="Recomendado: 1200 x 400 px. Máximo 5 MB."
                    imageUrl={form.coverImageUrl}
                    imageAlt={`Capa de ${form.name || 'empresa'}`}
                    variant="cover"
                    buttonLabel={
                      uploadingCover ? 'A enviar...' : 'Carregar imagem'
                    }
                  >
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => handleFileUpload(e, 'coverImageUrl')}
                      className={styles.hiddenInput}
                      disabled={uploadingCover}
                    />
                  </UploadCard>
                </FormSection>
              </aside>

              <div className={styles.detailsColumn}>
                <FormSection
                  id="informacoes-basicas"
                  title="Informações básicas"
                  description="Dados principais usados no perfil público e nas vagas."
                  icon={FiBriefcase}
                >
                  <div className={styles.gridTwo}>
                    <InputField
                      label="Nome da empresa *"
                      value={form.name}
                      onChange={(e) =>
                        setForm({ ...form, name: e.target.value })
                      }
                      placeholder="Nome da sua empresa"
                      required
                      icon={FiBriefcase}
                      className={styles.spanTwo}
                    />
                    <InputField
                      label="Email de contacto"
                      type="email"
                      value={form.email}
                      disabled
                      icon={FiMail}
                    />
                    <InputField
                      label="Telefone *"
                      value={form.phone}
                      onChange={(e) =>
                        setForm({ ...form, phone: e.target.value })
                      }
                      placeholder="+239 XXX XXXX"
                      required
                      icon={FiPhone}
                    />
                    <SelectField
                      label="Tamanho da empresa"
                      value={form.companySize}
                      onChange={(e) =>
                        setForm({ ...form, companySize: e.target.value })
                      }
                      options={[
                        { value: '', label: 'Selecione...' },
                        ...COMPANY_SIZES.map((size) => ({
                          value: size,
                          label: size,
                        })),
                      ]}
                      icon={FiUsers}
                    />
                    <InputField
                      label="Website"
                      value={form.website}
                      onChange={(e) =>
                        setForm({ ...form, website: e.target.value })
                      }
                      placeholder="https://..."
                      icon={FiGlobe}
                    />
                    <InputField
                      label="Localização"
                      value={form.location}
                      onChange={(e) =>
                        setForm({ ...form, location: e.target.value })
                      }
                      placeholder="Cidade, distrito"
                      icon={FiMapPin}
                      className={styles.spanTwo}
                    />
                  </div>
                </FormSection>

                <FormSection
                  id="sobre-a-empresa"
                  title="Sobre a empresa"
                  description="Apresente a organização, a cultura e os seus principais setores."
                  icon={FiFileText}
                >
                  <TextAreaField
                    id="company-description"
                    label="Descrição"
                    value={form.description}
                    onChange={(e) =>
                      setForm({ ...form, description: e.target.value })
                    }
                    placeholder="Conte sobre a história, missão e valores da sua empresa..."
                    rows={6}
                    maxLength={2000}
                  />

                  <div className={styles.sectorGroup}>
                    <div className={styles.subsectionHeader}>
                      <div>
                        <h3>Setores de atuação</h3>
                        <p>
                          Selecione as áreas que melhor representam a empresa.
                        </p>
                      </div>
                      <span>{form.industrySectors.length} selecionado(s)</span>
                    </div>

                    <div className={styles.sectorGrid}>
                      {INDUSTRY_SECTORS.map((sector) => {
                        const active = form.industrySectors.includes(sector);
                        return (
                          <label
                            key={sector}
                            className={`${styles.sectorChip} ${active ? styles.sectorChipActive : ''}`}
                          >
                            <input
                              type="checkbox"
                              checked={active}
                              onChange={() => toggleSector(sector)}
                              className={styles.sectorInput}
                            />
                            <span>{sector}</span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                </FormSection>

                <FormSection
                  id="redes-sociais"
                  title="Redes sociais"
                  description="Adicione apenas os canais oficiais da empresa."
                  icon={FiShare2}
                >
                  <div className={styles.socialGrid}>
                    <InputField
                      label="LinkedIn"
                      value={form.linkedin}
                      onChange={(e) =>
                        setForm({ ...form, linkedin: e.target.value })
                      }
                      placeholder="https://linkedin.com/company/..."
                      icon={FiLinkedin}
                    />
                    <InputField
                      label="Facebook"
                      value={form.facebook}
                      onChange={(e) =>
                        setForm({ ...form, facebook: e.target.value })
                      }
                      placeholder="https://facebook.com/..."
                      icon={FiFacebook}
                    />
                    <InputField
                      label="Instagram"
                      value={form.instagram}
                      onChange={(e) =>
                        setForm({ ...form, instagram: e.target.value })
                      }
                      placeholder="https://instagram.com/..."
                      icon={FiInstagram}
                    />
                  </div>
                </FormSection>
              </div>
            </div>

            <div className={styles.footerActions}>
              <Link
                href="/dashboard/empresa"
                className={styles.secondaryAction}
              >
                <FiX aria-hidden="true" />
                Cancelar
              </Link>
              <button
                type="submit"
                disabled={saving || uploading}
                className={styles.primaryAction}
              >
                <FiSave aria-hidden="true" />
                {saving
                  ? 'A guardar...'
                  : uploading
                    ? 'Aguarde o upload...'
                    : 'Guardar alterações'}
              </button>
            </div>
          </form>
        </div>
      </DashboardShell>
    </>
  );
}

function FormSection({ id, title, description, icon: Icon, children }) {
  return (
    <section id={id} className={styles.section} aria-labelledby={`${id}-title`}>
      <header className={styles.sectionHeader}>
        <span className={styles.sectionIcon} aria-hidden="true">
          <Icon />
        </span>
        <div>
          <h2 id={`${id}-title`} className={styles.sectionTitle}>
            {title}
          </h2>
          <p className={styles.sectionDescription}>{description}</p>
        </div>
      </header>
      <div className={styles.sectionBody}>{children}</div>
    </section>
  );
}

function UploadCard({
  title,
  note,
  imageUrl,
  imageAlt,
  variant,
  buttonLabel,
  children,
}) {
  const isLogo = variant === 'logo';

  return (
    <div className={styles.uploadField}>
      <div className={styles.uploadHeader}>
        <h3 className={styles.uploadTitle}>{title}</h3>
      </div>

      <div
        className={isLogo ? styles.logoUploadLayout : styles.coverUploadLayout}
      >
        <div
          className={`${styles.uploadPreviewFrame} ${isLogo ? styles.logoFrame : styles.coverFrame}`}
        >
          {imageUrl ? (
            <Image
              src={imageUrl}
              alt={imageAlt}
              width={isLogo ? 320 : 1200}
              height={isLogo ? 320 : 400}
              sizes={isLogo ? '112px' : '(max-width: 1040px) 100vw, 320px'}
              className={`${styles.uploadPreview} ${isLogo ? styles.logoPreview : styles.coverPreview}`}
              unoptimized
            />
          ) : (
            <div className={styles.uploadPlaceholder}>
              <FiImage aria-hidden="true" />
              <span>Sem imagem</span>
            </div>
          )}
        </div>

        <div className={styles.uploadActions}>
          <p className={styles.uploadNote}>{note}</p>
          <label className={styles.uploadButton}>
            <FiUploadCloud aria-hidden="true" />
            <span>{buttonLabel}</span>
            {children}
          </label>
        </div>
      </div>
    </div>
  );
}

function InputField({
  label,
  value,
  onChange,
  type = 'text',
  placeholder = '',
  disabled = false,
  required = false,
  icon: Icon,
  className = '',
}) {
  return (
    <label className={`${styles.field} ${className}`}>
      <span className={styles.label}>{label}</span>
      <span className={styles.inputShell}>
        {Icon ? <Icon className={styles.fieldIcon} aria-hidden="true" /> : null}
        <input
          type={type}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          disabled={disabled}
          required={required}
          aria-required={required || undefined}
          className={`${styles.input} ${Icon ? styles.inputWithIcon : ''} ${disabled ? styles.inputDisabled : ''}`}
        />
      </span>
    </label>
  );
}

function SelectField({ label, value, onChange, options, icon: Icon }) {
  return (
    <label className={styles.field}>
      <span className={styles.label}>{label}</span>
      <span className={styles.inputShell}>
        {Icon ? <Icon className={styles.fieldIcon} aria-hidden="true" /> : null}
        <select
          value={value}
          onChange={onChange}
          className={`${styles.input} ${Icon ? styles.inputWithIcon : ''}`}
        >
          {options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </span>
    </label>
  );
}

function TextAreaField({
  id,
  label,
  value,
  onChange,
  placeholder = '',
  rows = 4,
  maxLength,
}) {
  return (
    <div className={styles.field}>
      <label className={styles.label} htmlFor={id}>
        {label}
      </label>
      <textarea
        id={id}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        rows={rows}
        maxLength={maxLength}
        className={`${styles.input} ${styles.textarea}`}
      />
      {maxLength ? (
        <span className={styles.characterCount}>
          {value.length} / {maxLength} caracteres
        </span>
      ) : null}
    </div>
  );
}


// Painel da empresa: o guard corre no servidor para ninguém sem sessão de
// empresa chegar a ver a página.
export async function getServerSideProps(context) {
  const guard = await requireCompanySession(context);
  if (guard) return guard;

  return { props: {} };
}
