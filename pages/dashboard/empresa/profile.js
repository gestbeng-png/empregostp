import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import Link from 'next/link';
import { useAuth } from '../../../context/AuthContext';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from '../../../lib/firebase';
import { getFirebaseStorageErrorMessage } from '../../../lib/firebaseStorageError';
import styles from '../../../styles/EmpresaProfilePage.module.css';

const COMPANY_SIZES = [
  '1-10 funcionários',
  '11-50 funcionários',
  '51-200 funcionários',
  '201-500 funcionários',
  '501-1000 funcionários',
  '1001+ funcionários'
];

const INDUSTRY_SECTORS = [
  'Tecnologia',
  'Saúde',
  'Educação',
  'Finanças',
  'Varejo',
  'Indústria',
  'Serviços',
  'Alimentação',
  'Construção',
  'Turismo',
  'Outro'
];

export default function CompanyProfilePage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [uploadingCover, setUploadingCover] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

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
    instagram: ''
  });

  const uploading = uploadingLogo || uploadingCover;

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.push('/login');
      return;
    }

    const fetchProfile = async () => {
      try {
        const token = await user.getIdToken();
        const response = await fetch('/api/empresa', {
          headers: {
            Authorization: `Bearer ${token}`
          }
        });

        if (!response.ok) {
          throw new Error('Erro ao carregar perfil');
        }

        const result = await response.json();
        const data = result.profile || {};
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
          instagram: data.socialMedia?.instagram || data.instagram || ''
        });
      } catch (e) {
        setError('Erro ao carregar perfil');
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
  }, [user, authLoading, router]);

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
          instagram: form.instagram
        },
        updatedAt: new Date().toISOString()
      };

      const token = await user.getIdToken();
      const response = await fetch('/api/empresa', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(dataToUpdate)
      });

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.message || 'Erro ao salvar perfil');
      }

      setSuccess('✅ Perfil atualizado com sucesso!');

      setTimeout(() => {
        router.push('/dashboard/empresa');
      }, 2000);
    } catch (e) {
      let errorMessage = 'Erro ao salvar perfil. ';

      if (e.code === 'permission-denied') {
        errorMessage += 'Sem permissão para atualizar. Verifique as regras do Firestore.';
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
        `Erro ao enviar ${isLogo ? 'logo' : 'imagem de capa'}.`
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
        : [...prev.industrySectors, sector]
    }));
  }

  if (authLoading || loading) {
    return (
      <>
        <Head>
          <title>Perfil da Empresa - EmpregoSTP</title>
        </Head>
        <main className={styles.loadingPage}>
          <div className={styles.loadingSpinner} aria-hidden="true" />
          <p className={styles.loadingText}>Carregando perfil...</p>
        </main>
      </>
    );
  }

  return (
    <>
      <Head>
        <title>Perfil da Empresa - EmpregoSTP</title>
      </Head>

      <main className={styles.page}>
        <div className={styles.container}>
          <header className={styles.hero}>
            <Link href="/dashboard/empresa" className={styles.backLink}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <path d="M19 12H5M12 19l-7-7 7-7" />
              </svg>
              <span>Voltar ao Dashboard</span>
            </Link>

            <div className={styles.heroCopy}>
              <span className={styles.eyebrow}>Marca empregadora</span>
              <h1 className={styles.title}>Perfil da Empresa</h1>
              <p className={styles.description}>Atualize as informações da sua empresa para atrair os melhores talentos</p>
            </div>
          </header>

          {success ? (
            <div className={`${styles.banner} ${styles.bannerSuccess}`}>
              <span>✅</span>
              <span>{success}</span>
            </div>
          ) : null}

          {error ? (
            <div className={`${styles.banner} ${styles.bannerError}`}>
              <span>⚠️</span>
              <span>{error}</span>
            </div>
          ) : null}

          <form className={styles.formLayout} onSubmit={handleSave}>
            <FormSection title="Imagens da Empresa">
              <div className={styles.mediaGrid}>
                <UploadCard
                  title="Logo da Empresa"
                  note="Formatos: JPG, PNG. Máximo: 5MB"
                  imageUrl={form.logoUrl}
                  imageAlt="Logo"
                  imageClassName={styles.logoPreview}
                  buttonTone="green"
                  buttonLabel={uploadingLogo ? 'Enviando...' : 'Escolher Logo'}
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
                  note="Formatos: JPG, PNG. Máximo: 5MB. Recomendado: 1200x400px"
                  imageUrl={form.coverImageUrl}
                  imageAlt="Capa"
                  imageClassName={styles.coverPreview}
                  buttonTone="blue"
                  buttonLabel={uploadingCover ? 'Enviando...' : 'Escolher Capa'}
                >
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => handleFileUpload(e, 'coverImageUrl')}
                    className={styles.hiddenInput}
                    disabled={uploadingCover}
                  />
                </UploadCard>
              </div>
            </FormSection>

            <FormSection title="Informações Básicas">
              <div className={styles.gridTwo}>
                <InputField
                  label="Nome da Empresa *"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Nome da sua empresa"
                />
                <InputField label="Email" type="email" value={form.email} disabled />
                <InputField
                  label="Telefone *"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  placeholder="+239 XXX XXXX"
                />
                <SelectField
                  label="Tamanho da Empresa"
                  value={form.companySize}
                  onChange={(e) => setForm({ ...form, companySize: e.target.value })}
                  options={[{ value: '', label: 'Selecione...' }, ...COMPANY_SIZES.map((size) => ({ value: size, label: size }))]}
                />
                <InputField
                  label="Website"
                  value={form.website}
                  onChange={(e) => setForm({ ...form, website: e.target.value })}
                  placeholder="https://..."
                />
                <InputField
                  label="Localização *"
                  value={form.location}
                  onChange={(e) => setForm({ ...form, location: e.target.value })}
                  placeholder="Cidade, Distrito"
                />
              </div>

              <TextAreaField
                label="Sobre a Empresa *"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="Conte sobre a história, missão e valores da sua empresa..."
                rows={6}
              />
            </FormSection>

            <FormSection title="Setores de Atuação">
              <div className={styles.sectorGrid}>
                {INDUSTRY_SECTORS.map((sector) => {
                  const active = form.industrySectors.includes(sector);
                  return (
                    <label
                      key={sector}
                      className={`${styles.sectorChip} ${active ? styles.sectorChipActive : ''}`}
                      onClick={() => toggleSector(sector)}
                    >
                      <input
                        type="checkbox"
                        checked={active}
                        onChange={() => {}}
                        className={styles.sectorInput}
                      />
                      <span>{sector}</span>
                    </label>
                  );
                })}
              </div>
            </FormSection>

            <FormSection title="Redes Sociais">
              <div className={styles.gridThree}>
                <InputField
                  label="LinkedIn"
                  value={form.linkedin}
                  onChange={(e) => setForm({ ...form, linkedin: e.target.value })}
                  placeholder="https://linkedin.com/company/..."
                />
                <InputField
                  label="Facebook"
                  value={form.facebook}
                  onChange={(e) => setForm({ ...form, facebook: e.target.value })}
                  placeholder="https://facebook.com/..."
                />
                <InputField
                  label="Instagram"
                  value={form.instagram}
                  onChange={(e) => setForm({ ...form, instagram: e.target.value })}
                  placeholder="https://instagram.com/..."
                />
              </div>
            </FormSection>

            <div className={styles.footerActions}>
              <Link href="/dashboard/empresa" className={styles.secondaryAction}>
                Cancelar
              </Link>
              <button type="submit" disabled={saving || uploading} className={styles.primaryAction}>
                {saving ? 'Salvando...' : uploading ? 'Aguarde o upload...' : 'Salvar Perfil'}
              </button>
            </div>
          </form>
        </div>
      </main>
    </>
  );
}

function FormSection({ title, children }) {
  return (
    <section className={styles.section}>
      <h2 className={styles.sectionTitle}>{title}</h2>
      <div className={styles.sectionBody}>{children}</div>
    </section>
  );
}

function UploadCard({ title, note, imageUrl, imageAlt, imageClassName, buttonTone, buttonLabel, children }) {
  return (
    <div className={styles.uploadCard}>
      <div className={styles.uploadHeader}>
        <h3 className={styles.uploadTitle}>{title}</h3>
        <p className={styles.uploadNote}>{note}</p>
      </div>

      {imageUrl ? (
        <img src={imageUrl} alt={imageAlt} className={`${styles.uploadPreview} ${imageClassName}`} loading="lazy" />
      ) : (
        <div className={`${styles.uploadPlaceholder} ${imageClassName}`}>Sem imagem carregada</div>
      )}

      <label className={`${styles.uploadButton} ${buttonTone === 'green' ? styles.uploadButtonGreen : styles.uploadButtonBlue}`}>
        <span>{buttonLabel}</span>
        {children}
      </label>
    </div>
  );
}

function InputField({ label, value, onChange, type = 'text', placeholder = '', disabled = false }) {
  return (
    <div className={styles.field}>
      <label className={styles.label}>{label}</label>
      <input
        type={type}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        disabled={disabled}
        className={`${styles.input} ${disabled ? styles.inputDisabled : ''}`}
      />
    </div>
  );
}

function SelectField({ label, value, onChange, options }) {
  return (
    <div className={styles.field}>
      <label className={styles.label}>{label}</label>
      <select value={value} onChange={onChange} className={styles.input}>
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
}

function TextAreaField({ label, value, onChange, placeholder = '', rows = 4 }) {
  return (
    <div className={styles.field}>
      <label className={styles.label}>{label}</label>
      <textarea
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        rows={rows}
        className={`${styles.input} ${styles.textarea}`}
      />
    </div>
  );
}
