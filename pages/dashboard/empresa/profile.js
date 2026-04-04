import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import Link from 'next/link';
import { useAuth } from '../../../context/AuthContext';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from '../../../lib/firebase';

const COMPANY_SIZES = [
  '1-10 funcionários',
  '11-50 funcionários',
  '51-200 funcionários',
  '201-500 funcionários',
  '501-1000 funcionários',
  '1001+ funcionários'
];

const INDUSTRY_SECTORS = [
  'Tecnologia', 'Saúde', 'Educação', 'Finanças', 'Varejo',
  'Indústria', 'Serviços', 'Alimentação', 'Construção', 'Turismo', 'Outro'
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
    
    console.log('💾 Iniciando salvamento do perfil...');
    
    if (!user) {
      console.log('❌ Usuário não autenticado');
      setError('Você precisa estar logado');
      return;
    }
    
    console.log('👤 Usuário:', user.uid);
    console.log('📝 Dados do formulário:', form);
    
    // Validar campos obrigatórios
    if (!form.name || !form.phone) {
      console.log('❌ Campos obrigatórios vazios');
      setError('Por favor, preencha nome e telefone');
      return;
    }
    
    setSaving(true);
    setError('');
    setSuccess('');
    
    try {
      console.log('🔄 Atualizando documento no Firestore...');
      
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
      
      console.log('📦 Dados a serem salvos:', dataToUpdate);
      
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
      
      console.log('✅ Perfil atualizado no Firestore!');
      setSuccess('✅ Perfil atualizado com sucesso!');
      
      // Redirecionar após 2 segundos
      setTimeout(() => {
        router.push('/dashboard/empresa');
      }, 2000);
      
    } catch (e) {
      console.error('❌ Erro ao salvar perfil:', e);
      console.error('Código do erro:', e.code);
      console.error('Mensagem:', e.message);
      
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
      console.log('❌ Usuário não autenticado');
      setError('Você precisa estar logado para fazer upload');
      return;
    }
    
    const isLogo = field === 'logoUrl';
    console.log(`📤 Iniciando upload de ${isLogo ? 'logo' : 'capa'}...`);
    
    if (isLogo) {
      setUploadingLogo(true);
    } else {
      setUploadingCover(true);
    }
    
    try {
      const file = e.target.files[0];
      if (!file) {
        console.log('❌ Nenhum arquivo selecionado');
        if (isLogo) setUploadingLogo(false);
        else setUploadingCover(false);
        return;
      }

      console.log('📁 Arquivo selecionado:', {
        name: file.name,
        size: `${(file.size / 1024 / 1024).toFixed(2)}MB`,
        type: file.type
      });

      // Validar tamanho do arquivo (5MB max)
      if (file.size > 5 * 1024 * 1024) {
        console.log('❌ Arquivo muito grande');
        setError('Arquivo muito grande. Máximo: 5MB');
        if (isLogo) setUploadingLogo(false);
        else setUploadingCover(false);
        setTimeout(() => setError(''), 3000);
        return;
      }

      // Validar tipo de arquivo
      if (!file.type.startsWith('image/')) {
        console.log('❌ Tipo de arquivo inválido');
        setError('Por favor, envie apenas imagens');
        if (isLogo) setUploadingLogo(false);
        else setUploadingCover(false);
        setTimeout(() => setError(''), 3000);
        return;
      }
      
      const folderName = isLogo ? 'company-logos' : 'company-covers';
      const fileName = `${Date.now()}_${file.name.replace(/[^a-zA-Z0-9.]/g, '_')}`;
      const storagePath = `${folderName}/${user.uid}/${fileName}`;
      
      console.log('☁️ Criando referência do Storage:', storagePath);
      const storageRef = ref(storage, storagePath);
      
      console.log('⬆️ Fazendo upload...');
      const uploadResult = await uploadBytes(storageRef, file);
      console.log('✅ Upload concluído:', uploadResult.metadata.fullPath);
      
      console.log('🔗 Obtendo URL de download...');
      const url = await getDownloadURL(storageRef);
      console.log('✅ URL obtida:', url);
      
      setForm(prev => ({ ...prev, [field]: url }));
      setSuccess(`${isLogo ? 'Logo' : 'Imagem de capa'} enviado com sucesso!`);
      setTimeout(() => setSuccess(''), 3000);
      
      console.log('✅ Upload completo!');
    } catch (err) {
      console.error('❌ Erro ao enviar arquivo:', err);
      console.error('Código do erro:', err.code);
      console.error('Mensagem do erro:', err.message);
      
      let errorMessage = `Erro ao enviar ${isLogo ? 'logo' : 'imagem de capa'}.`;
      
      if (err.code === 'storage/unauthorized') {
        errorMessage = 'Sem permissão para fazer upload. Verifique as regras do Firebase Storage.';
      } else if (err.code === 'storage/canceled') {
        errorMessage = 'Upload cancelado.';
      } else if (err.code === 'storage/unknown') {
        errorMessage = 'Erro desconhecido. Tente novamente.';
      }
      
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
    setForm(prev => ({
      ...prev,
      industrySectors: prev.industrySectors.includes(sector)
        ? prev.industrySectors.filter(s => s !== sector)
        : [...prev.industrySectors, sector]
    }));
  }

  if (authLoading || loading) {
    return (
      <>
        <Head>
          <title>Perfil da Empresa - EmpregoSTP</title>
          <style>{`
            body {
              background: #0a0a0f;
              min-height: 100vh;
            }
          `}</style>
        </Head>
        <div style={{ padding: '4rem 2rem', textAlign: 'center' }}>
          <div style={{ 
            width: '50px', 
            height: '50px', 
            margin: '0 auto 1.5rem', 
            border: '4px solid rgba(255, 255, 255, 0.1)',
            borderTop: '4px solid #6366f1',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite'
          }}></div>
          <style jsx>{`
            @keyframes spin {
              0% { transform: rotate(0deg); }
              100% { transform: rotate(360deg); }
            }
          `}</style>
          <p style={{ color: 'rgba(255, 255, 255, 0.8)', fontSize: '1.1rem' }}>Carregando perfil...</p>
        </div>
      </>
    );
  }

  return (
    <>
      <Head>
        <title>Perfil da Empresa - EmpregoSTP</title>
        <style>{`
          body {
            background: #0a0a0f;
            min-height: 100vh;
          }
        `}</style>
      </Head>

      <div style={{ maxWidth: '1100px', margin: '0 auto', padding: '2rem' }}>
        
        {/* Header */}
        <div style={{ marginBottom: '2rem' }}>
          <Link href="/dashboard/empresa" style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.5rem',
            color: '#60a5fa',
            textDecoration: 'none',
            fontWeight: '600',
            marginBottom: '1rem'
          }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M19 12H5M12 19l-7-7 7-7"/>
            </svg>
            Voltar ao Dashboard
          </Link>
          <h1 style={{ margin: '0 0 0.5rem 0', fontSize: '2.5rem', color: 'white', fontWeight: '900' }}>
            Perfil da Empresa
          </h1>
          <p style={{ margin: 0, color: 'rgba(255, 255, 255, 0.7)', fontSize: '1.05rem' }}>
            Atualize as informações da sua empresa para atrair os melhores talentos
          </p>
        </div>

        {/* Mensagens */}
        {success && (
          <div style={{
            background: 'rgba(16, 185, 129, 0.15)',
            border: '1px solid rgba(16, 185, 129, 0.3)',
            borderRadius: '12px',
            padding: '1rem 1.25rem',
            marginBottom: '1.5rem',
            color: '#6ee7b7',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem'
          }}>
            <span>✅</span>
            <span>{success}</span>
                    </div>
                )}

        {error && (
          <div style={{
            background: 'rgba(239, 68, 68, 0.15)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            borderRadius: '12px',
            padding: '1rem 1.25rem',
            marginBottom: '1.5rem',
            color: '#fca5a5',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem'
          }}>
            <span>⚠️</span>
            <span>{error}</span>
                </div>
            )}

        {/* Formulário */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
          
          {/* Imagens */}
          <FormSection title="Imagens da Empresa">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '2rem' }}>
              {/* Logo */}
              <div>
                <label style={{ display: 'block', color: 'rgba(255, 255, 255, 0.9)', fontWeight: '600', marginBottom: '1rem' }}>
                  Logo da Empresa
                </label>
                {form.logoUrl && (
                  <img 
                    src={form.logoUrl} 
                    alt="Logo" 
                    style={{ 
                      width: '150px', 
                      height: '150px', 
                      borderRadius: '12px', 
                      objectFit: 'cover',
                      border: '3px solid #10b981',
                      marginBottom: '1rem'
                    }} 
                  />
                )}
                <label style={{
                  display: 'inline-block',
                  padding: '0.75rem 1.5rem',
                  background: 'rgba(16, 185, 129, 0.15)',
                  border: '2px solid rgba(16, 185, 129, 0.3)',
                  borderRadius: '12px',
                  color: '#34d399',
                  fontWeight: '600',
                  cursor: 'pointer',
                  transition: 'all 0.3s ease'
                }}>
                  {uploadingLogo ? 'Enviando...' : 'Escolher Logo'}
                                <input
                                    type="file"
                                    accept="image/*"
                    onChange={(e) => handleFileUpload(e, 'logoUrl')}
                    style={{ display: 'none' }}
                    disabled={uploadingLogo}
                                />
                                </label>
                <p style={{ marginTop: '0.5rem', color: 'rgba(255, 255, 255, 0.6)', fontSize: '0.85rem' }}>
                  Formatos: JPG, PNG. Máximo: 5MB
                </p>
                    </div>

              {/* Capa */}
              <div>
                <label style={{ display: 'block', color: 'rgba(255, 255, 255, 0.9)', fontWeight: '600', marginBottom: '1rem' }}>
                  Imagem de Capa
                </label>
                {form.coverImageUrl && (
                  <img 
                    src={form.coverImageUrl} 
                    alt="Capa" 
                    style={{ 
                      width: '100%', 
                      height: '150px', 
                      borderRadius: '12px', 
                      objectFit: 'cover',
                      border: '2px solid rgba(59, 130, 246, 0.3)',
                      marginBottom: '1rem'
                    }} 
                  />
                )}
                <label style={{
                  display: 'inline-block',
                  padding: '0.75rem 1.5rem',
                  background: 'rgba(59, 130, 246, 0.15)',
                  border: '2px solid rgba(59, 130, 246, 0.3)',
                  borderRadius: '12px',
                  color: '#60a5fa',
                  fontWeight: '600',
                  cursor: 'pointer'
                }}>
                  {uploadingCover ? 'Enviando...' : 'Escolher Capa'}
                                <input
                                    type="file"
                                    accept="image/*"
                    onChange={(e) => handleFileUpload(e, 'coverImageUrl')}
                    style={{ display: 'none' }}
                    disabled={uploadingCover}
                                />
                                </label>
                <p style={{ marginTop: '0.5rem', color: 'rgba(255, 255, 255, 0.6)', fontSize: '0.85rem' }}>
                  Formatos: JPG, PNG. Máximo: 5MB. Recomendado: 1200x400px
                </p>
                    </div>
                </div>
          </FormSection>

          {/* Informações Básicas */}
          <FormSection title="Informações Básicas">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1.5rem' }}>
              <InputField
                label="Nome da Empresa *"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Nome da sua empresa"
              />
              <InputField
                label="Email"
                type="email"
                value={form.email}
                disabled
              />
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
                options={[
                  { value: '', label: 'Selecione...' },
                  ...COMPANY_SIZES.map(size => ({ value: size, label: size }))
                ]}
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

          {/* Setores de Atuação */}
          <FormSection title="Setores de Atuação">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '1rem' }}>
                            {INDUSTRY_SECTORS.map(sector => (
                <label key={sector} style={{
                  display: 'flex',
                  alignItems: 'center',
                  padding: '0.75rem 1rem',
                  background: form.industrySectors.includes(sector) ? 'rgba(16, 185, 129, 0.2)' : 'rgba(255, 255, 255, 0.05)',
                  border: form.industrySectors.includes(sector) ? '2px solid #10b981' : '1px solid rgba(255, 255, 255, 0.1)',
                  borderRadius: '12px',
                  cursor: 'pointer',
                  transition: 'all 0.3s ease',
                  color: form.industrySectors.includes(sector) ? '#34d399' : 'rgba(255, 255, 255, 0.8)',
                  fontWeight: '600',
                  fontSize: '0.9rem'
                }}
                onClick={() => toggleSector(sector)}>
                                    <input
                                        type="checkbox"
                    checked={form.industrySectors.includes(sector)}
                    onChange={() => {}}
                    style={{
                      marginRight: '0.5rem',
                      width: '18px',
                      height: '18px',
                      accentColor: '#10b981',
                      cursor: 'pointer'
                    }}
                  />
                  {sector}
                                </label>
                            ))}
                        </div>
          </FormSection>

          {/* Redes Sociais */}
          <FormSection title="Redes Sociais">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1.5rem' }}>
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

          {/* Botões de Ação */}
          <div style={{
            display: 'flex',
            gap: '1rem',
            justifyContent: 'flex-end',
            paddingTop: '2rem',
            borderTop: '1px solid rgba(255, 255, 255, 0.1)'
          }}>
            <Link href="/dashboard/empresa" style={{
              padding: '1rem 2rem',
              background: 'rgba(255, 255, 255, 0.1)',
              border: '1px solid rgba(255, 255, 255, 0.2)',
              borderRadius: '12px',
              color: 'white',
              textDecoration: 'none',
              fontWeight: '600'
            }}>
              Cancelar
            </Link>
            <button 
              type="button"
              onClick={handleSave}
              disabled={saving || uploading}
              style={{
                padding: '1rem 2rem',
                background: saving ? 'rgba(16, 185, 129, 0.5)' : 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                border: 'none',
                borderRadius: '12px',
                color: 'white',
                fontWeight: '700',
                fontSize: '1rem',
                cursor: (saving || uploading) ? 'not-allowed' : 'pointer',
                boxShadow: '0 4px 20px rgba(16, 185, 129, 0.4)',
                opacity: (saving || uploading) ? 0.6 : 1
              }}
              onMouseEnter={(e) => {
                if (!saving && !uploading) {
                  e.currentTarget.style.transform = 'translateY(-2px)';
                  e.currentTarget.style.boxShadow = '0 8px 30px rgba(16, 185, 129, 0.5)';
                }
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = '0 4px 20px rgba(16, 185, 129, 0.4)';
              }}
            >
              {saving ? 'Salvando...' : uploading ? 'Aguarde o upload...' : 'Salvar Perfil'}
            </button>
                    </div>

                        </div>
                    </div>
    </>
  );
}

// Componentes de Formulário
function FormSection({ title, children }) {
  return (
    <div style={{
      background: 'rgba(255, 255, 255, 0.05)',
      backdropFilter: 'blur(10px)',
      border: '1px solid rgba(255, 255, 255, 0.1)',
      borderRadius: '16px',
      padding: '2rem'
    }}>
      <h2 style={{ margin: '0 0 1.5rem 0', fontSize: '1.5rem', color: 'white', fontWeight: '800' }}>
        {title}
      </h2>
      {children}
                        </div>
  );
}

function InputField({ label, value, onChange, type = 'text', placeholder = '', disabled = false }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
      <label style={{ color: 'rgba(255, 255, 255, 0.9)', fontWeight: '600', fontSize: '0.9rem' }}>
        {label}
      </label>
                            <input
        type={type}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        disabled={disabled}
        style={{
          padding: '0.75rem 1rem',
          background: disabled ? 'rgba(255, 255, 255, 0.02)' : 'rgba(255, 255, 255, 0.05)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          borderRadius: '12px',
          color: disabled ? 'rgba(255, 255, 255, 0.5)' : 'white',
          fontSize: '0.95rem',
          transition: 'all 0.3s ease',
          cursor: disabled ? 'not-allowed' : 'text'
        }}
        onFocus={(e) => {
          if (!disabled) {
            e.currentTarget.style.borderColor = '#60a5fa';
            e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)';
          }
        }}
        onBlur={(e) => {
          e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.1)';
          e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
        }}
      />
        </div>
    );
}

function SelectField({ label, value, onChange, options }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
      <label style={{ color: 'rgba(255, 255, 255, 0.9)', fontWeight: '600', fontSize: '0.9rem' }}>
        {label}
      </label>
      <select
        value={value}
        onChange={onChange}
        style={{
          padding: '0.75rem 1rem',
          background: 'rgba(255, 255, 255, 0.05)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          borderRadius: '12px',
          color: 'white',
          fontSize: '0.95rem',
          cursor: 'pointer'
        }}
      >
        {options.map(opt => (
          <option key={opt.value} value={opt.value} style={{ background: '#1e293b' }}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
}

function TextAreaField({ label, value, onChange, placeholder = '', rows = 4 }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
      <label style={{ color: 'rgba(255, 255, 255, 0.9)', fontWeight: '600', fontSize: '0.9rem' }}>
        {label}
      </label>
      <textarea
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        rows={rows}
        style={{
          padding: '0.75rem 1rem',
          background: 'rgba(255, 255, 255, 0.05)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          borderRadius: '12px',
          color: 'white',
          fontSize: '0.95rem',
          resize: 'vertical',
          fontFamily: 'inherit',
          lineHeight: 1.6,
          transition: 'all 0.3s ease'
        }}
        onFocus={(e) => {
          e.currentTarget.style.borderColor = '#60a5fa';
          e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)';
        }}
        onBlur={(e) => {
          e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.1)';
          e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
        }}
      />
    </div>
  );
}
