import { admin } from '../../../../lib/firebaseAdmin';
import nookies from 'nookies';
import Link from 'next/link';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { getEmpresaPlanSummary } from '../../../../lib/empresaPlanFeatures';

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
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (Array.isArray(value)) {
    return value.map((item) => toPlainText(item)).filter(Boolean).join(' • ');
  }
  if (typeof value === 'object') {
    const orderedKeys = ['description', 'role', 'company', 'period', 'title', 'name', 'value'];
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
    return Object.values(value).map((item) => toPlainText(item)).filter(Boolean);
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
        return text ? { company: '', role: '', period: '', description: text } : null;
      }
      if (!entry || typeof entry !== 'object') return null;

      const company = toPlainText(entry.company || entry.empresa);
      const role = toPlainText(entry.role || entry.cargo || entry.title);
      const period = toPlainText(entry.period || entry.periodo || entry.dateRange);
      const description = toPlainText(entry.description || entry.resumo || entry.details || '');

      if (!company && !role && !period && !description) {
        const fallback = toPlainText(entry);
        return fallback ? { company: '', role: '', period: '', description: fallback } : null;
      }

      return { company, role, period, description };
    })
    .filter(Boolean);
}

export default function PerfilCandidato({ candidato, applications, contactLocked = false, messagingLocked = false }) {
  const router = useRouter();

  if (!candidato) {
    return (
      <>
        <Head>
          <style>{`
            body {
              background: #0a0a0f;
              min-height: 100vh;
            }
          `}</style>
        </Head>
        <main style={{ maxWidth: 900, margin: '2.5rem auto', padding: '0 1.5rem', textAlign: 'center' }}>
          <h2 style={{ color: 'white' }}>Candidato não encontrado</h2>
          <Link href="/dashboard/empresa" style={{ color: '#6366f1' }}>Voltar ao Dashboard</Link>
        </main>
      </>
    );
  }

  const hardSkills = Array.isArray(candidato.skillsHard) 
    ? candidato.skillsHard.map((item) => toPlainText(item)).filter(Boolean)
    : (candidato.skillsHard ? String(candidato.skillsHard).split(',').map(t => t.trim()).filter(Boolean) : []);
  
  const softSkills = Array.isArray(candidato.skillsSoft) 
    ? candidato.skillsSoft.map((item) => toPlainText(item)).filter(Boolean)
    : (candidato.skillsSoft ? String(candidato.skillsSoft).split(',').map(t => t.trim()).filter(Boolean) : []);

  const languages = normalizeStringList(candidato.languages);
  
  const education = normalizeStringList(candidato.education);
  
  const experience = normalizeExperienceList(candidato.experience);

  return (
    <>
      <Head>
        <title>{candidato.fullName || 'Candidato'} - EmpregoSTP</title>
        <style>{`
          body {
            background: #0a0a0f;
            min-height: 100vh;
          }
        `}</style>
      </Head>
      
      <main style={{ maxWidth: '1200px', margin: '0 auto', padding: '2rem', minHeight: '100vh' }}>
        
        {/* Header */}
        <Link href="/dashboard/empresa" style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '0.5rem',
          color: '#60a5fa',
          textDecoration: 'none',
          fontWeight: '600',
          marginBottom: '2rem'
        }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M19 12H5M12 19l-7-7 7-7"/>
          </svg>
          Voltar ao Dashboard
          </Link>

        {/* Header do Perfil */}
        <div style={{ 
          background: 'rgba(255, 255, 255, 0.05)',
          backdropFilter: 'blur(10px)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          borderRadius: '20px',
          padding: '2rem', 
          marginBottom: '2rem',
          display: 'flex',
          alignItems: 'center',
          gap: '2rem',
          flexWrap: 'wrap'
        }}>
          {candidato.photoUrl ? (
              <img 
                src={candidato.photoUrl} 
                alt="Foto de perfil" 
                style={{
                width: '120px',
                height: '120px',
                  borderRadius: '50%',
                border: '3px solid #3b82f6',
                objectFit: 'cover',
                boxShadow: '0 4px 15px rgba(59, 130, 246, 0.3)'
              }}
            />
          ) : (
            <div style={{
              width: '120px',
              height: '120px',
              borderRadius: '50%',
              background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '3rem',
              color: 'white',
              fontWeight: '900',
              border: '3px solid rgba(59, 130, 246, 0.5)'
            }}>
              {(candidato.fullName || candidato.name || '?')[0].toUpperCase()}
            </div>
          )}
          <div style={{ flex: 1 }}>
            <h1 style={{ margin: '0 0 0.5rem 0', fontSize: '2.5rem', color: 'white', fontWeight: '900' }}>
              {candidato.fullName || candidato.name || 'Nome não informado'}
            </h1>
            {candidato.location && (
              <p style={{ margin: '0 0 0.5rem 0', color: 'rgba(255, 255, 255, 0.7)', fontSize: '1.05rem' }}>
                {candidato.location}
              </p>
            )}
            {candidato.objectiveArea && (
              <p style={{ margin: 0, color: 'rgba(255, 255, 255, 0.6)', fontSize: '0.95rem' }}>
                Área de interesse: {candidato.objectiveArea}
              </p>
            )}
            {candidato.birthDate && (
              <p style={{ margin: '0.5rem 0 0 0', color: 'rgba(255, 255, 255, 0.6)', fontSize: '0.85rem' }}>
                Nascimento: {candidato.birthDate}
                </p>
              )}
            </div>
          
          {/* Botões de Ação */}
          <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
            {!contactLocked && candidato.cvUrl && (
              <a
                href={candidato.cvUrl}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  padding: '0.875rem 1.75rem',
                  background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                  border: 'none',
                  borderRadius: '12px',
                  color: 'white',
                  textDecoration: 'none',
                  fontWeight: '700',
                  fontSize: '0.95rem',
                  boxShadow: '0 4px 15px rgba(16, 185, 129, 0.4)',
                  whiteSpace: 'nowrap',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.5rem'
                }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                  <polyline points="7 10 12 15 17 10"></polyline>
                  <line x1="12" y1="15" x2="12" y2="3"></line>
                </svg>
                Baixar CV
              </a>
            )}
            {contactLocked && candidato.cvUrl && (
              <button
                type="button"
                onClick={() => router.push('/premium/empresa')}
                style={{
                  padding: '0.875rem 1.75rem',
                  background: 'rgba(245, 158, 11, 0.16)',
                  border: '1px solid rgba(245, 158, 11, 0.35)',
                  borderRadius: '12px',
                  color: '#fbbf24',
                  fontWeight: '700',
                  fontSize: '0.95rem',
                  cursor: 'pointer'
                }}
              >
                Desbloquear CV
              </button>
            )}
            {!contactLocked && candidato.email && (
              <a
                href={`mailto:${candidato.email}`}
                style={{
                  padding: '0.875rem 1.75rem',
                  background: 'rgba(59, 130, 246, 0.2)',
                  border: '2px solid rgba(59, 130, 246, 0.3)',
                  borderRadius: '12px',
                  color: '#60a5fa',
                  textDecoration: 'none',
                  fontWeight: '700',
                  fontSize: '0.95rem',
                  whiteSpace: 'nowrap'
                }}
              >
                Enviar Email
              </a>
            )}
            {!messagingLocked ? (
              <Link
                href={`/dashboard/empresa?tab=messages&candidate=${candidato.id}`}
                style={{
                  padding: '0.875rem 1.75rem',
                  background: 'rgba(99, 102, 241, 0.18)',
                  border: '2px solid rgba(99, 102, 241, 0.35)',
                  borderRadius: '12px',
                  color: '#c4b5fd',
                  textDecoration: 'none',
                  fontWeight: '700',
                  fontSize: '0.95rem',
                  whiteSpace: 'nowrap'
                }}
              >
                Enviar Mensagem
              </Link>
            ) : (
              <button
                type="button"
                onClick={() => router.push('/premium/empresa')}
                style={{
                  padding: '0.875rem 1.75rem',
                  background: 'rgba(99, 102, 241, 0.08)',
                  border: '1px solid rgba(99, 102, 241, 0.25)',
                  borderRadius: '12px',
                  color: '#a5b4fc',
                  fontWeight: '700',
                  fontSize: '0.95rem',
                  cursor: 'pointer'
                }}
              >
                Desbloquear Mensagens
              </button>
            )}
          </div>
        </div>

        <div style={{ display: 'grid', gap: '2rem' }}>
          
          {/* Contatos */}
          {(candidato.phone || candidato.email || candidato.linkedin || candidato.website || contactLocked) && (
            <InfoSection title="Informações de Contato">
            {contactLocked && (
              <div style={{
                marginBottom: '1.5rem',
                padding: '1rem',
                borderRadius: '12px',
                background: 'rgba(251, 146, 60, 0.12)',
                border: '1px solid rgba(251, 146, 60, 0.25)',
                color: '#fdba74'
              }}>
                O seu plano atual não permite ver telefone e email do candidato. Faça upgrade para desbloquear este recurso.
              </div>
            )}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1.5rem' }}>
              {!contactLocked && candidato.phone && <InfoItem label="Telefone" value={candidato.phone} />}
              {!contactLocked && candidato.email && <InfoItem label="Email" value={candidato.email} />}
              {candidato.linkedin && (
                <div>
                  <div style={{ color: 'rgba(255, 255, 255, 0.7)', fontSize: '0.85rem', marginBottom: '0.5rem', fontWeight: '600' }}>
                    LinkedIn
                  </div>
                  <a href={candidato.linkedin} target="_blank" rel="noopener noreferrer" style={{ color: '#60a5fa', textDecoration: 'none', fontWeight: '600' }}>
                    Ver perfil
                  </a>
                </div>
              )}
              {candidato.website && (
                <div>
                  <div style={{ color: 'rgba(255, 255, 255, 0.7)', fontSize: '0.85rem', marginBottom: '0.5rem', fontWeight: '600' }}>
                    Website/Portfólio
                  </div>
                  <a href={candidato.website} target="_blank" rel="noopener noreferrer" style={{ color: '#60a5fa', textDecoration: 'none', fontWeight: '600' }}>
                    Visitar site
                  </a>
                </div>
              )}
            </div>
          </InfoSection>
          )}

          {/* Objetivo Profissional */}
          {(candidato.objectiveArea || candidato.objectiveAspiration) && (
            <InfoSection title="Objetivo Profissional">
              {candidato.objectiveArea && (
                <div style={{ marginBottom: '1rem' }}>
                  <div style={{ color: 'rgba(255, 255, 255, 0.7)', fontSize: '0.85rem', marginBottom: '0.5rem', fontWeight: '600' }}>
                    Área de Interesse
                  </div>
                  <div style={{ color: 'white', fontSize: '1rem' }}>
                    {candidato.objectiveArea}
                    {candidato.objectiveType && ` — ${candidato.objectiveType}`}
                  </div>
                </div>
              )}
              {candidato.objectiveAspiration && (
                <div>
                  <div style={{ color: 'rgba(255, 255, 255, 0.7)', fontSize: '0.85rem', marginBottom: '0.5rem', fontWeight: '600' }}>
                    Aspirações
                  </div>
                  <p style={{ margin: 0, color: 'rgba(255, 255, 255, 0.8)', lineHeight: 1.6 }}>
                    {candidato.objectiveAspiration}
            </p>
          </div>
              )}
            </InfoSection>
          )}
          
          {/* Certificados PDF */}
          {candidato.certificateFiles && candidato.certificateFiles.length > 0 && (
            <InfoSection title="Certificados">
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {candidato.certificateFiles.map((certUrl, i) => (
                  <a
                    key={i}
                    href={certUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.75rem',
                      padding: '1rem',
                      background: 'rgba(251, 191, 36, 0.15)',
                      border: '1px solid rgba(251, 191, 36, 0.3)',
                      borderRadius: '12px',
                      textDecoration: 'none',
                      color: '#fcd34d',
                      fontWeight: '600',
                      transition: 'all 0.3s ease'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = 'rgba(251, 191, 36, 0.25)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = 'rgba(251, 191, 36, 0.15)';
                    }}
                  >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                      <polyline points="14 2 14 8 20 8"></polyline>
                      <line x1="16" y1="13" x2="8" y2="13"></line>
                      <line x1="16" y1="17" x2="8" y2="17"></line>
                      <polyline points="10 9 9 9 8 9"></polyline>
                    </svg>
                    Certificado {i + 1}
                  </a>
                ))}
        </div>
            </InfoSection>
          )}
          
          {/* Formação Acadêmica */}
          {education.length > 0 && (
            <InfoSection title="Formação Acadêmica">
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {education.map((edu, i) => (
                  <div key={i} style={{
                    padding: '1rem',
                    background: 'rgba(255, 255, 255, 0.05)',
                    borderRadius: '10px',
                    borderLeft: '3px solid #3b82f6'
                  }}>
                    <div style={{ color: 'white', lineHeight: 1.6 }}>{edu}</div>
                  </div>
                ))}
              </div>
            </InfoSection>
            )}

          {/* Experiência Profissional */}
          {experience.length > 0 && (
            <InfoSection title="Experiência Profissional">
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {experience.map((exp, i) => (
                  <div key={i} style={{
                    padding: '1rem',
                    background: 'rgba(255, 255, 255, 0.05)',
                    borderRadius: '10px',
                    borderLeft: '3px solid #10b981'
                  }}>
                    {exp.role && (
                      <div style={{ color: 'white', fontWeight: 700, marginBottom: '0.25rem' }}>{exp.role}</div>
                    )}
                    {exp.company && (
                      <div style={{ color: '#34d399', marginBottom: '0.25rem' }}>{exp.company}</div>
                    )}
                    {exp.period && (
                      <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.85rem', marginBottom: '0.35rem' }}>{exp.period}</div>
                    )}
                    {exp.description && (
                      <div style={{ color: 'white', lineHeight: 1.6 }}>{exp.description}</div>
                    )}
                  </div>
                ))}
              </div>
            </InfoSection>
          )}

          {/* Dados Pessoais Adicionais */}
          {(candidato.birthDate || candidato.nationality || candidato.gender || candidato.maritalStatus) && (
            <InfoSection title="Dados Pessoais">
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.5rem' }}>
                {candidato.birthDate && <InfoItem label="Data de Nascimento" value={candidato.birthDate} />}
                {candidato.nationality && <InfoItem label="Nacionalidade" value={candidato.nationality} />}
                {candidato.gender && <InfoItem label="Gênero" value={candidato.gender} />}
                {candidato.maritalStatus && <InfoItem label="Estado Civil" value={candidato.maritalStatus} />}
              </div>
            </InfoSection>
          )}

          {/* Habilidades */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '2rem' }}>
            
            {hardSkills.length > 0 && (
              <InfoSection title="Hard Skills">
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem' }}>
                {hardSkills.map((skill, i) => (
                  <span key={i} style={{
                      padding: '0.6rem 1.2rem',
                      background: 'rgba(59, 130, 246, 0.2)',
                      color: '#93c5fd',
                    borderRadius: '20px',
                    fontSize: '0.9rem',
                      fontWeight: '600',
                      border: '1px solid rgba(59, 130, 246, 0.3)'
                  }}>
                    {skill}
                  </span>
                ))}
              </div>
              </InfoSection>
            )}

            {softSkills.length > 0 && (
              <InfoSection title="Soft Skills">
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem' }}>
                {softSkills.map((skill, i) => (
                  <span key={i} style={{
                      padding: '0.6rem 1.2rem',
                      background: 'rgba(16, 185, 129, 0.2)',
                      color: '#6ee7b7',
                    borderRadius: '20px',
                    fontSize: '0.9rem',
                      fontWeight: '600',
                      border: '1px solid rgba(16, 185, 129, 0.3)'
                  }}>
                    {skill}
                  </span>
                ))}
              </div>
              </InfoSection>
            )}
        </div>

        {/* Competências Digitais e Idiomas */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '2rem' }}>
            
            {candidato.digitalSkills && candidato.digitalSkills.length > 0 && (
              <InfoSection title="Competências Digitais">
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem' }}>
                  {candidato.digitalSkills.map((skill, i) => (
                  <span key={i} style={{
                      padding: '0.6rem 1.2rem',
                      background: 'rgba(139, 92, 246, 0.2)',
                      color: '#c4b5fd',
                    borderRadius: '20px',
                    fontSize: '0.9rem',
                      fontWeight: '600',
                      border: '1px solid rgba(139, 92, 246, 0.3)'
                  }}>
                    {skill}
                  </span>
                  ))}
                </div>
              </InfoSection>
            )}

            {languages.length > 0 && (
              <InfoSection title="Idiomas">
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  {languages.map((lang, i) => (
                    <div key={i} style={{
                      padding: '0.75rem 1rem',
                      background: 'rgba(255, 255, 255, 0.05)',
                      borderRadius: '10px',
                      color: 'rgba(255, 255, 255, 0.9)'
                    }}>
                      {lang}
                    </div>
                  ))}
              </div>
              </InfoSection>
            )}
          </div>

          {/* Bio/Sobre */}
          {candidato.bio && (
            <InfoSection title="Sobre o Candidato">
              <p style={{ margin: 0, color: 'rgba(255, 255, 255, 0.8)', lineHeight: 1.7, fontSize: '1rem' }}>
                {candidato.bio}
              </p>
            </InfoSection>
          )}

          {/* Certificações (Texto) */}
          {candidato.certifications && (
            <InfoSection title="Certificações">
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {(typeof candidato.certifications === 'string' 
                  ? candidato.certifications.split('\n').filter(Boolean)
                  : candidato.certifications
                ).map((cert, i) => (
                  <div key={i} style={{
                    padding: '0.75rem 1rem',
                    background: 'rgba(255, 255, 255, 0.05)',
                    borderRadius: '10px',
                    borderLeft: '3px solid #fbbf24',
                    color: 'rgba(255, 255, 255, 0.9)'
                  }}>
                    {cert}
                  </div>
                ))}
              </div>
            </InfoSection>
          )}

          {/* Histórico de Candidaturas */}
          <InfoSection title="Histórico de Candidaturas">
            {applications.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {applications.map((app, i) => (
                  <div key={i} style={{
                    background: 'rgba(255, 255, 255, 0.05)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
            borderRadius: '12px',
                    padding: '1.25rem',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    gap: '1rem'
                  }}>
                    <div>
                      <div style={{ color: 'white', fontWeight: '700', fontSize: '1.05rem', marginBottom: '0.5rem' }}>
                        {app.jobTitle || 'Vaga não especificada'}
            </div>
                      {app.createdAt && (
                        <div style={{ color: 'rgba(255, 255, 255, 0.6)', fontSize: '0.85rem' }}>
                          {new Date(app.createdAt).toLocaleDateString('pt-PT', {
                            day: '2-digit',
                            month: 'long',
                            year: 'numeric'
                          })}
          </div>
        )}
                    </div>
        <div style={{
                      padding: '0.5rem 1.25rem',
          borderRadius: '12px',
                      fontWeight: '700',
                      fontSize: '0.9rem',
                      background: app.status === 'approved' ? 'rgba(16, 185, 129, 0.2)' : 
                                 app.status === 'rejected' ? 'rgba(239, 68, 68, 0.2)' : 'rgba(245, 158, 11, 0.2)',
                      color: app.status === 'approved' ? '#34d399' : 
                             app.status === 'rejected' ? '#fca5a5' : '#fbbf24',
                      border: `2px solid ${app.status === 'approved' ? 'rgba(16, 185, 129, 0.3)' : 
                                          app.status === 'rejected' ? 'rgba(239, 68, 68, 0.3)' : 'rgba(245, 158, 11, 0.3)'}`
                        }}>
                          {app.status === 'pending' ? 'Pendente' : 
                           app.status === 'approved' ? 'Aprovada' : 
                           app.status === 'rejected' ? 'Rejeitada' : app.status}
                    </div>
                  </div>
                  ))}
            </div>
          ) : (
              <p style={{ margin: 0, color: 'rgba(255, 255, 255, 0.6)', fontStyle: 'italic' }}>
                Nenhuma candidatura encontrada
            </p>
          )}
          </InfoSection>

        </div>
      </main>
    </>
  );
}

function InfoSection({ title, children }) {
  return (
    <div style={{
      background: 'rgba(255, 255, 255, 0.05)',
      backdropFilter: 'blur(10px)',
      border: '1px solid rgba(255, 255, 255, 0.1)',
      borderRadius: '16px',
      padding: '2rem'
    }}>
      <h3 style={{ margin: '0 0 1.5rem 0', color: 'white', fontSize: '1.3rem', fontWeight: '800' }}>
        {title}
      </h3>
      {children}
    </div>
  );
}

function InfoItem({ label, value }) {
  return (
    <div>
      <div style={{ color: 'rgba(255, 255, 255, 0.7)', fontSize: '0.85rem', marginBottom: '0.5rem', fontWeight: '600' }}>
        {label}
      </div>
      <div style={{ color: 'white', fontSize: '1rem', fontWeight: '600' }}>
        {value}
      </div>
    </div>
  );
}

export async function getServerSideProps(context) {
  const { id } = context.params;

  try {
    const cookies = nookies.get(context);

    if (!cookies.token) {
      return { redirect: { destination: '/login', permanent: false } };
    }

    const token = await admin.auth().verifyIdToken(cookies.token);
    const uid = token.uid;

    const userDoc = await admin.firestore().collection('users').doc(uid).get();
    if (!userDoc.exists) {
      return { redirect: { destination: '/dashboard', permanent: false } };
    }
    
    const userData = userDoc.data();
    const planSummary = userData.userType === 'empresa' ? getEmpresaPlanSummary(userData) : null;
    const contactLocked = userData.userType === 'empresa' && !planSummary?.features?.canViewCandidateContact;
    const messagingLocked = userData.userType === 'empresa' && !planSummary?.features?.canSendDirectMessages;
    
    // Permitir acesso para empresas E admins
    if (userData.userType !== 'empresa' && userData.userType !== 'admin') {
      console.log('❌ Acesso negado. UserType:', userData.userType);
      return { redirect: { destination: '/dashboard', permanent: false } };
    }

    console.log('✅ Acesso permitido para:', userData.userType);

    if (userData.userType === 'empresa') {
      const dayKey = new Date().toISOString().slice(0, 10);
      const viewRef = admin.firestore().collection('candidateProfileViews').doc(`${id}_${uid}_${dayKey}`);
      await viewRef.set({
        candidateId: id,
        companyId: uid,
        companyName: userData.name || userData.fullName || 'Empresa',
        dayKey,
        viewedAt: admin.firestore.FieldValue.serverTimestamp()
      }, { merge: true });
    }

    const candidatoDoc = await admin.firestore().collection('users').doc(id).get();
    if (!candidatoDoc.exists) {
      return { notFound: true };
    }

    const candidatoData = candidatoDoc.data();
    
    if (candidatoData.userType !== 'candidato') {
      return { notFound: true };
    }

    const profileDoc = await admin.firestore().collection('profiles').doc(id).get();
    const profileData = profileDoc.exists ? profileDoc.data() : {};

    const candidato = {
      id,
      // Informações Básicas
      fullName: candidatoData.fullName || candidatoData.name || '',
      name: candidatoData.name || '',
      email: contactLocked ? '' : (candidatoData.email || ''),
      phone: contactLocked ? '' : (profileData.phone || candidatoData.phone || ''),
      photoUrl: profileData.photoUrl || candidatoData.photoUrl || '',
      location: profileData.location || candidatoData.location || candidatoData.cidade || '',
      
      // Dados Pessoais
      birthDate: profileData.birthDate || '',
      nationality: profileData.nationality || '',
      gender: profileData.gender || '',
      maritalStatus: profileData.maritalStatus || '',
      
      // Links
      linkedin: profileData.linkedin || candidatoData.linkedin || '',
      website: profileData.website || candidatoData.website || '',
      
      // Documentos
      cvUrl: profileData.cvUrl || candidatoData.cvUrl || '',
      certificateFiles: profileData.certificateFiles || candidatoData.certificateFiles || [],
      
      // Objetivo
      objectiveArea: profileData.objectiveArea || candidatoData.objectiveArea || '',
      objectiveType: profileData.objectiveType || candidatoData.objectiveType || '',
      objectiveAspiration: profileData.objectiveAspiration || candidatoData.objectiveAspiration || '',
      
      // Habilidades
      skillsHard: profileData.skillsHard || candidatoData.skillsHard || '',
      skillsSoft: profileData.skillsSoft || candidatoData.skillsSoft || '',
      digitalSkills: profileData.digitalSkills || candidatoData.digitalSkills || [],
      
      // Idiomas
      languages: profileData.languages || candidatoData.languages || '',
      
      // Formação e Experiência
      education: profileData.education || candidatoData.education || '',
      experience: profileData.experiences || profileData.experience || candidatoData.experiences || candidatoData.experience || '',
      
      // Certificações
      certifications: profileData.certifications || candidatoData.certifications || '',
      
      // Bio
      bio: profileData.bio || candidatoData.bio || candidatoData.sobre || ''
    };

    const applicationsSnap = await admin.firestore()
      .collection('applications')
      .where('candidateId', '==', id)
      .get();

    const applications = applicationsSnap.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        jobTitle: data.jobTitle || '',
        companyName: data.company || '',
        status: data.status || 'pending',
        createdAt: safeTimestampToMillis(data.createdAt) ? new Date(safeTimestampToMillis(data.createdAt)).toISOString() : null
      };
    });

    applications.sort((a, b) => {
      if (!a.createdAt) return 1;
      if (!b.createdAt) return -1;
      return new Date(b.createdAt) - new Date(a.createdAt);
    });

    return {
      props: {
        candidato,
        applications,
        contactLocked,
        messagingLocked
      }
    };

  } catch (error) {
    console.error('Erro ao carregar perfil do candidato:', error);
    return { redirect: { destination: '/login', permanent: false } };
  }
} 
