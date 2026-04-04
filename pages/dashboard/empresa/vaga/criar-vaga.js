import { useState } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import Link from 'next/link';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { auth, storage } from '../../../../lib/firebase';
import { normalizeSkillsAssessmentInput } from '../../../../lib/skillsAssessment';

const EMPLOYMENT_TYPES = [
  'Tempo Integral',
  'Meio Período',
  'Contrato',
  'Estágio',
  'Freelance',
  'Voluntariado'
];

const EXPERIENCE_LEVELS = [
  'Júnior (0-2 anos)',
  'Pleno (2-5 anos)',
  'Sénior (5+ anos)',
  'Especialista',
  'Gestão'
];

const EDUCATION_LEVELS = [
  'Ensino Básico',
  'Ensino Secundário',
  'Licenciatura',
  'Mestrado',
  'Doutoramento',
  'Não exigido'
];

const JOB_CATEGORIES = [
  'Marketing Digital',
  'Programação',
  'Design',
  'Gestão e Administração',
  'Vendas',
  'Educação',
  'Saúde',
  'Engenharia',
  'Finanças',
  'Recursos Humanos',
  'Jurídico',
  'Atendimento'
];

export default function CriarVaga() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [uploadingTDR, setUploadingTDR] = useState(false);
  const [error, setError] = useState('');
  const [errorAction, setErrorAction] = useState(null);
  const [success, setSuccess] = useState('');
  const [currentStep, setCurrentStep] = useState(1);

  const [jobData, setJobData] = useState({
    titulo: '',
    descricao: '',
    requisitos: '',
    responsabilidades: '',
    localizacao: '',
    tipoContrato: '',
    nivelExperiencia: '',
    escolaridade: '',
    salarioDe: '',
    salarioAte: '',
    beneficios: '',
    dataAbertura: new Date().toISOString().split('T')[0],
    dataFecho: '',
    remoto: false,
    destaque: false,
    tdrUrl: '',
    tdrFileName: '',
    vagasDisponiveis: 1,
    palavrasChave: '',
    categoria: '',
    skillsAssessment: {
      enabled: false,
      passingScore: 70,
      questions: []
    }
  });

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setJobData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
  };

  const handleTDRUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (!file.type.includes('pdf') && !file.type.includes('document')) {
      setError('Por favor, envie apenas ficheiros PDF ou Word');
      setErrorAction(null);
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      setError('O ficheiro TDR deve ter no máximo 10MB');
      setErrorAction(null);
      return;
    }

    setUploadingTDR(true);
    setError('');
    setErrorAction(null);

    try {
      const user = auth.currentUser;
      if (!user) {
        setError('Você precisa estar logado');
        setErrorAction(null);
        setUploadingTDR(false);
        return;
      }

      const fileName = `${Date.now()}_${file.name.replace(/[^a-zA-Z0-9.]/g, '_')}`;
      const storagePath = `job-tdr/${user.uid}/${fileName}`;
      const storageRef = ref(storage, storagePath);

      await uploadBytes(storageRef, file);
      const url = await getDownloadURL(storageRef);

      setJobData(prev => ({
        ...prev,
        tdrUrl: url,
        tdrFileName: file.name
      }));
      setSuccess('TDR enviado com sucesso!');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      console.error('Erro ao enviar TDR:', err);
      setError('Erro ao enviar o ficheiro TDR');
      setErrorAction(null);
    } finally {
      setUploadingTDR(false);
    }
  };

  const removeTDR = () => {
    setJobData(prev => ({ ...prev, tdrUrl: '', tdrFileName: '' }));
  };

  const handleAssessmentToggle = () => {
    setJobData((prev) => ({
      ...prev,
      skillsAssessment: {
        ...prev.skillsAssessment,
        enabled: !prev.skillsAssessment.enabled
      }
    }));
  };

  const handleAssessmentPassingScoreChange = (value) => {
    setJobData((prev) => ({
      ...prev,
      skillsAssessment: {
        ...prev.skillsAssessment,
        passingScore: value
      }
    }));
  };

  const handleAddAssessmentQuestion = () => {
    setJobData((prev) => ({
      ...prev,
      skillsAssessment: {
        ...prev.skillsAssessment,
        enabled: true,
        questions: [
          ...prev.skillsAssessment.questions,
          {
            id: `q${Date.now()}`,
            prompt: '',
            options: ['', ''],
            correctOptionIndex: 0
          }
        ]
      }
    }));
  };

  const handleRemoveAssessmentQuestion = (questionIndex) => {
    setJobData((prev) => ({
      ...prev,
      skillsAssessment: {
        ...prev.skillsAssessment,
        questions: prev.skillsAssessment.questions.filter((_, index) => index !== questionIndex)
      }
    }));
  };

  const handleAssessmentQuestionChange = (questionIndex, field, value) => {
    setJobData((prev) => ({
      ...prev,
      skillsAssessment: {
        ...prev.skillsAssessment,
        questions: prev.skillsAssessment.questions.map((question, index) =>
          index === questionIndex ? { ...question, [field]: value } : question
        )
      }
    }));
  };

  const handleAssessmentOptionChange = (questionIndex, optionIndex, value) => {
    setJobData((prev) => ({
      ...prev,
      skillsAssessment: {
        ...prev.skillsAssessment,
        questions: prev.skillsAssessment.questions.map((question, index) => {
          if (index !== questionIndex) return question;
          const options = [...question.options];
          options[optionIndex] = value;
          return { ...question, options };
        })
      }
    }));
  };

  const handleAddAssessmentOption = (questionIndex) => {
    setJobData((prev) => ({
      ...prev,
      skillsAssessment: {
        ...prev.skillsAssessment,
        questions: prev.skillsAssessment.questions.map((question, index) =>
          index === questionIndex ? { ...question, options: [...question.options, ''] } : question
        )
      }
    }));
  };

  const handleRemoveAssessmentOption = (questionIndex, optionIndex) => {
    setJobData((prev) => ({
      ...prev,
      skillsAssessment: {
        ...prev.skillsAssessment,
        questions: prev.skillsAssessment.questions.map((question, index) => {
          if (index !== questionIndex || question.options.length <= 2) return question;
          const options = question.options.filter((_, currentIndex) => currentIndex !== optionIndex);
          const nextCorrectIndex = question.correctOptionIndex >= options.length ? options.length - 1 : question.correctOptionIndex;
          return {
            ...question,
            options,
            correctOptionIndex: nextCorrectIndex
          };
        })
      }
    }));
  };

  const nextStep = () => {
    if (currentStep === 1 && (!jobData.titulo || !jobData.descricao || !jobData.categoria)) {
      setError('Preencha o título, a descrição e selecione uma categoria para continuar');
      setErrorAction(null);
      return;
    }
    if (currentStep === 2 && (!jobData.localizacao || !jobData.tipoContrato)) {
      setError('Preencha a localização e o tipo de contrato');
      setErrorAction(null);
      return;
    }
    if (currentStep === 3 && jobData.skillsAssessment.enabled) {
      const normalizedAssessment = normalizeSkillsAssessmentInput(jobData.skillsAssessment);
      if (!normalizedAssessment.questions.length) {
        setError('Adicione pelo menos uma pergunta válida ao teste de habilidades ou desative o teste.');
        setErrorAction(null);
        return;
      }
      if (normalizedAssessment.questions.length !== jobData.skillsAssessment.questions.length) {
        setError('Revise o teste de habilidades. Todas as perguntas precisam de enunciado, pelo menos 2 opções e uma resposta correta.');
        setErrorAction(null);
        return;
      }
    }
    setError('');
    setErrorAction(null);
    setCurrentStep(prev => Math.min(prev + 1, 4));
  };

  const prevStep = () => {
    setError('');
    setErrorAction(null);
    setCurrentStep(prev => Math.max(prev - 1, 1));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!jobData.titulo || !jobData.descricao || !jobData.localizacao || !jobData.tipoContrato || !jobData.dataFecho) {
      setError('Por favor, preencha todos os campos obrigatórios');
      setErrorAction(null);
      return;
    }

    setIsLoading(true);
    setError('');
    setErrorAction(null);
    setSuccess('');

    try {
      const user = auth.currentUser;
      if (!user) {
        setError('Você precisa estar logado');
        setErrorAction(null);
        setIsLoading(false);
        return;
      }

      const vagaData = {
        ...jobData,
        palavrasChave: jobData.palavrasChave.split(',').map(k => k.trim()).filter(Boolean),
        vagasDisponiveis: parseInt(jobData.vagasDisponiveis, 10) || 1,
        skillsAssessment: normalizeSkillsAssessmentInput(jobData.skillsAssessment)
      };

      const createResponse = await fetch('/api/jobs', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${await user.getIdToken()}`
        },
        body: JSON.stringify(vagaData)
      });

      const createData = await createResponse.json();
      if (!createResponse.ok) {
        const businessMessage =
          createData.reason ||
          createData.error ||
          createData.message ||
          'Não foi possível criar a vaga neste momento.';

        setError(businessMessage);
        setErrorAction(
          createData.upgradeUrl
            ? {
              label: createData.upgradeMessage || 'Ver planos disponíveis',
              href: createData.upgradeUrl
            }
            : null
        );
        return;
      }

      try {
        await fetch('/api/notify-candidates', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${await user.getIdToken()}`
          },
          body: JSON.stringify({
            jobId: createData.job?.id,
            jobTitle: createData.job?.titulo || vagaData.titulo,
            jobLocation: createData.job?.localizacao || vagaData.localizacao
          })
        });
      } catch (notifError) {
        console.error('Aviso: Erro ao enviar notificações (não crítico):', notifError);
      }

      setSuccess(createData.warning ? `Vaga criada com sucesso! ${createData.warning}` : 'Vaga criada com sucesso!');

      setTimeout(() => {
        router.push('/dashboard/empresa');
      }, 2000);

    } catch (error) {
      console.error('Erro ao criar vaga:', error);
      setError('Não foi possível criar a vaga. Tente novamente em instantes.');
      setErrorAction(null);
    } finally {
      setIsLoading(false);
    }
  };

  const steps = [
    { num: 1, label: 'Informações' },
    { num: 2, label: 'Detalhes' },
    { num: 3, label: 'Documentos' },
    { num: 4, label: 'Revisão' }
  ];

  return (
    <>
      <Head>
        <title>Criar Vaga - EmpregoSTP</title>
        <style>{`
          body {
            background: #0a0a0f;
            min-height: 100vh;
          }
        `}</style>
      </Head>

      <div style={{ maxWidth: '900px', margin: '0 auto', padding: '2rem' }}>

        {/* Header */}
        <div style={{ marginBottom: '2rem' }}>
          <Link href="/dashboard/empresa" style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.5rem',
            color: '#6366f1',
            textDecoration: 'none',
            fontWeight: '600',
            marginBottom: '1rem'
          }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M19 12H5M12 19l-7-7 7-7" />
            </svg>
            Voltar ao Dashboard
          </Link>
          <h1 style={{ margin: '0 0 0.5rem 0', fontSize: '2rem', color: 'white', fontWeight: '700' }}>
            Criar Nova Vaga
          </h1>
          <p style={{ margin: 0, color: '#71717a', fontSize: '0.95rem' }}>
            Preencha os detalhes da vaga para atrair os melhores candidatos
          </p>
        </div>

        {/* Step Indicator */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          marginBottom: '2rem',
          background: 'rgba(255,255,255,0.03)',
          borderRadius: '12px',
          padding: '1rem'
        }}>
          {steps.map((step, i) => (
            <div key={step.num} style={{ display: 'flex', alignItems: 'center', flex: 1 }}>
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                flex: 1
              }}>
                <div style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '50%',
                  background: currentStep >= step.num ? '#6366f1' : 'rgba(255,255,255,0.1)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: currentStep >= step.num ? 'white' : '#71717a',
                  fontWeight: '600',
                  fontSize: '0.9rem',
                  marginBottom: '0.5rem'
                }}>
                  {currentStep > step.num ? '✓' : step.num}
                </div>
                <span style={{
                  fontSize: '0.75rem',
                  color: currentStep >= step.num ? '#e4e4e7' : '#71717a',
                  fontWeight: '500'
                }}>
                  {step.label}
                </span>
              </div>
              {i < steps.length - 1 && (
                <div style={{
                  height: '2px',
                  flex: 1,
                  background: currentStep > step.num ? '#6366f1' : 'rgba(255,255,255,0.1)',
                  marginBottom: '1.5rem'
                }} />
              )}
            </div>
          ))}
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
            fontWeight: '600'
          }}>
            {success}
          </div>
        )}

        {error && (
          <div style={{
            background: 'rgba(239, 68, 68, 0.15)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            borderRadius: '12px',
            padding: '1rem 1.25rem',
            marginBottom: '1.5rem',
            color: '#fca5a5'
          }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
              <span>{error}</span>
              {errorAction?.href && (
                <div>
                  <Link
                    href={errorAction.href}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      padding: '0.75rem 1rem',
                      borderRadius: '10px',
                      textDecoration: 'none',
                      fontWeight: '700',
                      color: '#fff',
                      background: 'rgba(99, 102, 241, 0.85)'
                    }}
                  >
                    {errorAction.label}
                  </Link>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Formulário */}
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>

          {/* Step 1: Informações Básicas */}
          {currentStep === 1 && (
            <FormSection title="Informações Básicas">
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <InputField
                  label="Título da Vaga *"
                  name="titulo"
                  value={jobData.titulo}
                  onChange={handleChange}
                  placeholder="Ex: Desenvolvedor Full Stack"
                />

                <SelectField
                  label="Categoria *"
                  name="categoria"
                  value={jobData.categoria}
                  onChange={handleChange}
                  options={[
                    { value: '', label: 'Selecione...' },
                    ...JOB_CATEGORIES.map(cat => ({ value: cat, label: cat }))
                  ]}
                />
              </div>

              <TextAreaField
                label="Descrição da Vaga *"
                name="descricao"
                value={jobData.descricao}
                onChange={handleChange}
                placeholder="Descreva as responsabilidades e o que a pessoa fará no dia a dia..."
                rows={5}
              />

              <TextAreaField
                label="Responsabilidades"
                name="responsabilidades"
                value={jobData.responsabilidades}
                onChange={handleChange}
                placeholder="Liste as principais responsabilidades do cargo..."
                rows={4}
              />

              <TextAreaField
                label="Requisitos"
                name="requisitos"
                value={jobData.requisitos}
                onChange={handleChange}
                placeholder="Liste os requisitos separados por vírgula: JavaScript, React, Node.js, etc."
                rows={3}
              />
            </FormSection>
          )}

          {/* Step 2: Detalhes */}
          {currentStep === 2 && (
            <FormSection title="Detalhes da Vaga">
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.5rem' }}>
                <InputField
                  label="Localização *"
                  name="localizacao"
                  value={jobData.localizacao}
                  onChange={handleChange}
                  placeholder="Cidade, Distrito"
                />

                <SelectField
                  label="Tipo de Contrato *"
                  name="tipoContrato"
                  value={jobData.tipoContrato}
                  onChange={handleChange}
                  options={[
                    { value: '', label: 'Selecione...' },
                    ...EMPLOYMENT_TYPES.map(type => ({ value: type, label: type }))
                  ]}
                />

                <SelectField
                  label="Nível de Experiência"
                  name="nivelExperiencia"
                  value={jobData.nivelExperiencia}
                  onChange={handleChange}
                  options={[
                    { value: '', label: 'Selecione...' },
                    ...EXPERIENCE_LEVELS.map(level => ({ value: level, label: level }))
                  ]}
                />

                <SelectField
                  label="Escolaridade Mínima"
                  name="escolaridade"
                  value={jobData.escolaridade}
                  onChange={handleChange}
                  options={[
                    { value: '', label: 'Selecione...' },
                    ...EDUCATION_LEVELS.map(level => ({ value: level, label: level }))
                  ]}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '1.5rem', marginTop: '1.5rem' }}>
                <InputField
                  label="Salário Mínimo (Db)"
                  name="salarioDe"
                  type="number"
                  value={jobData.salarioDe}
                  onChange={handleChange}
                  placeholder="Ex: 5000"
                />

                <InputField
                  label="Salário Máximo (Db)"
                  name="salarioAte"
                  type="number"
                  value={jobData.salarioAte}
                  onChange={handleChange}
                  placeholder="Ex: 8000"
                />

                <InputField
                  label="Vagas Disponíveis"
                  name="vagasDisponiveis"
                  type="number"
                  value={jobData.vagasDisponiveis}
                  onChange={handleChange}
                  placeholder="1"
                />
              </div>

              <div style={{ display: 'flex', gap: '2rem', marginTop: '1.5rem' }}>
                <label style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.75rem',
                  color: 'rgba(255, 255, 255, 0.9)',
                  fontWeight: '600',
                  cursor: 'pointer'
                }}>
                  <input
                    type="checkbox"
                    name="remoto"
                    checked={jobData.remoto}
                    onChange={handleChange}
                    style={{ width: '20px', height: '20px', accentColor: '#6366f1', cursor: 'pointer' }}
                  />
                  Trabalho Remoto
                </label>

                <label style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.75rem',
                  color: 'rgba(255, 255, 255, 0.9)',
                  fontWeight: '600',
                  cursor: 'pointer'
                }}>
                  <input
                    type="checkbox"
                    name="destaque"
                    checked={jobData.destaque}
                    onChange={handleChange}
                    style={{ width: '20px', height: '20px', accentColor: '#f59e0b', cursor: 'pointer' }}
                  />
                  Vaga em Destaque
                </label>
              </div>

              <TextAreaField
                label="Benefícios"
                name="beneficios"
                value={jobData.beneficios}
                onChange={handleChange}
                placeholder="Vale alimentação, Plano de saúde, Bônus anual, etc."
                rows={3}
              />
            </FormSection>
          )}

          {/* Step 3: Documentos e Datas */}
          {currentStep === 3 && (
            <FormSection title="Documentos e Período">
              {/* TDR Upload */}
              <div style={{ marginBottom: '1.5rem' }}>
                <label style={{ display: 'block', color: 'rgba(255, 255, 255, 0.9)', fontWeight: '600', fontSize: '0.9rem', marginBottom: '0.75rem' }}>
                  Termos de Referência (TDR)
                </label>
                <p style={{ color: '#71717a', fontSize: '0.85rem', marginBottom: '1rem' }}>
                  Envie um documento PDF ou Word com os termos de referência detalhados da vaga (opcional)
                </p>

                {jobData.tdrUrl ? (
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '1rem',
                    background: 'rgba(16, 185, 129, 0.1)',
                    border: '1px solid rgba(16, 185, 129, 0.3)',
                    borderRadius: '12px'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2">
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                        <polyline points="14 2 14 8 20 8" />
                      </svg>
                      <div>
                        <p style={{ margin: 0, color: '#34d399', fontWeight: '600' }}>{jobData.tdrFileName}</p>
                        <a href={jobData.tdrUrl} target="_blank" rel="noopener noreferrer" style={{ color: '#6ee7b7', fontSize: '0.85rem' }}>
                          Ver documento
                        </a>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={removeTDR}
                      style={{
                        padding: '0.5rem 1rem',
                        background: 'rgba(239, 68, 68, 0.2)',
                        border: '1px solid rgba(239, 68, 68, 0.3)',
                        borderRadius: '8px',
                        color: '#fca5a5',
                        fontWeight: '600',
                        cursor: 'pointer'
                      }}
                    >
                      Remover
                    </button>
                  </div>
                ) : (
                  <label style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '2rem',
                    background: 'rgba(255, 255, 255, 0.03)',
                    border: '2px dashed rgba(255, 255, 255, 0.1)',
                    borderRadius: '12px',
                    cursor: uploadingTDR ? 'not-allowed' : 'pointer',
                    transition: 'all 0.3s ease'
                  }}>
                    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#6366f1" strokeWidth="2" style={{ marginBottom: '1rem' }}>
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                      <polyline points="17 8 12 3 7 8" />
                      <line x1="12" y1="3" x2="12" y2="15" />
                    </svg>
                    <span style={{ color: '#e4e4e7', fontWeight: '600', marginBottom: '0.25rem' }}>
                      {uploadingTDR ? 'A enviar...' : 'Clique para enviar TDR'}
                    </span>
                    <span style={{ color: '#71717a', fontSize: '0.85rem' }}>PDF ou Word (máx. 10MB)</span>
                    <input
                      type="file"
                      accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                      onChange={handleTDRUpload}
                      style={{ display: 'none' }}
                      disabled={uploadingTDR}
                    />
                  </label>
                )}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.5rem' }}>
                <InputField
                  label="Data de Abertura *"
                  name="dataAbertura"
                  type="date"
                  value={jobData.dataAbertura}
                  onChange={handleChange}
                  min={new Date().toISOString().split('T')[0]}
                />

                <InputField
                  label="Data de Encerramento *"
                  name="dataFecho"
                  type="date"
                  value={jobData.dataFecho}
                  onChange={handleChange}
                  min={jobData.dataAbertura || new Date().toISOString().split('T')[0]}
                />
              </div>

              <InputField
                label="Palavras-chave"
                name="palavrasChave"
                value={jobData.palavrasChave}
                onChange={handleChange}
                placeholder="Separe por vírgula: marketing, vendas, gestão..."
              />

              <div style={{
                padding: '1.25rem',
                background: 'rgba(99, 102, 241, 0.08)',
                border: '1px solid rgba(99, 102, 241, 0.18)',
                borderRadius: '12px'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', alignItems: 'flex-start', marginBottom: '1rem', flexWrap: 'wrap' }}>
                  <div>
                    <h3 style={{ margin: '0 0 0.35rem 0', color: 'white', fontSize: '1rem' }}>Teste de habilidades</h3>
                    <p style={{ margin: 0, color: '#a5b4fc', fontSize: '0.9rem' }}>
                      Adicione perguntas rápidas para filtrar melhor os candidatos antes da entrevista.
                    </p>
                  </div>
                  <label style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.6rem',
                    color: 'white',
                    fontWeight: '600',
                    cursor: 'pointer'
                  }}>
                    <input
                      type="checkbox"
                      checked={jobData.skillsAssessment.enabled}
                      onChange={handleAssessmentToggle}
                      style={{ width: '18px', height: '18px', accentColor: '#6366f1' }}
                    />
                    Ativar teste
                  </label>
                </div>

                {jobData.skillsAssessment.enabled && (
                  <div style={{ display: 'grid', gap: '1rem' }}>
                    <InputField
                      label="Nota mínima para aprovação (%)"
                      name="assessmentPassingScore"
                      type="number"
                      value={jobData.skillsAssessment.passingScore}
                      onChange={(event) => handleAssessmentPassingScoreChange(event.target.value)}
                      min={0}
                    />

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
                      <span style={{ color: '#e4e4e7', fontWeight: '600' }}>
                        {jobData.skillsAssessment.questions.length} pergunta(s)
                      </span>
                      <button
                        type="button"
                        onClick={handleAddAssessmentQuestion}
                        style={{
                          padding: '0.65rem 1rem',
                          background: 'rgba(255, 255, 255, 0.06)',
                          border: '1px solid rgba(255, 255, 255, 0.1)',
                          borderRadius: '10px',
                          color: '#fff',
                          fontWeight: '600',
                          cursor: 'pointer'
                        }}
                      >
                        Adicionar pergunta
                      </button>
                    </div>

                    {jobData.skillsAssessment.questions.map((question, questionIndex) => (
                      <div
                        key={question.id}
                        style={{
                          display: 'grid',
                          gap: '0.85rem',
                          padding: '1rem',
                          borderRadius: '12px',
                          background: 'rgba(255, 255, 255, 0.04)',
                          border: '1px solid rgba(255, 255, 255, 0.08)'
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', alignItems: 'center' }}>
                          <strong style={{ color: '#fff' }}>Pergunta {questionIndex + 1}</strong>
                          <button
                            type="button"
                            onClick={() => handleRemoveAssessmentQuestion(questionIndex)}
                            style={{
                              padding: '0.45rem 0.7rem',
                              background: 'rgba(239, 68, 68, 0.18)',
                              border: '1px solid rgba(239, 68, 68, 0.25)',
                              borderRadius: '8px',
                              color: '#fca5a5',
                              cursor: 'pointer'
                            }}
                          >
                            Remover
                          </button>
                        </div>

                        <TextAreaField
                          label="Enunciado"
                          name={`assessmentPrompt-${questionIndex}`}
                          value={question.prompt}
                          onChange={(event) => handleAssessmentQuestionChange(questionIndex, 'prompt', event.target.value)}
                          rows={2}
                          placeholder="Ex.: Qual prática reduz regressões em produção?"
                        />

                        <div style={{ display: 'grid', gap: '0.75rem' }}>
                          {question.options.map((option, optionIndex) => (
                            <div key={`${question.id}-${optionIndex}`} style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                              <input
                                type="radio"
                                name={`correct-option-${question.id}`}
                                checked={Number(question.correctOptionIndex) === optionIndex}
                                onChange={() => handleAssessmentQuestionChange(questionIndex, 'correctOptionIndex', optionIndex)}
                              />
                              <input
                                type="text"
                                value={option}
                                onChange={(event) => handleAssessmentOptionChange(questionIndex, optionIndex, event.target.value)}
                                placeholder={`Opção ${optionIndex + 1}`}
                                style={{
                                  flex: 1,
                                  padding: '0.7rem 0.9rem',
                                  background: 'rgba(255, 255, 255, 0.05)',
                                  border: '1px solid rgba(255, 255, 255, 0.1)',
                                  borderRadius: '10px',
                                  color: 'white'
                                }}
                              />
                              {question.options.length > 2 && (
                                <button
                                  type="button"
                                  onClick={() => handleRemoveAssessmentOption(questionIndex, optionIndex)}
                                  style={{
                                    padding: '0.5rem 0.7rem',
                                    background: 'rgba(239, 68, 68, 0.15)',
                                    border: '1px solid rgba(239, 68, 68, 0.24)',
                                    borderRadius: '8px',
                                    color: '#fca5a5',
                                    cursor: 'pointer'
                                  }}
                                >
                                  ×
                                </button>
                              )}
                            </div>
                          ))}
                        </div>

                        {question.options.length < 5 && (
                          <button
                            type="button"
                            onClick={() => handleAddAssessmentOption(questionIndex)}
                            style={{
                              justifySelf: 'flex-start',
                              padding: '0.6rem 0.9rem',
                              background: 'transparent',
                              border: '1px dashed rgba(255, 255, 255, 0.2)',
                              borderRadius: '10px',
                              color: '#c7d2fe',
                              cursor: 'pointer'
                            }}
                          >
                            Adicionar opção
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </FormSection>
          )}

          {/* Step 4: Revisão */}
          {currentStep === 4 && (
            <FormSection title="Revisão Final">
              <div style={{ display: 'grid', gap: '1.5rem' }}>
                <ReviewItem label="Título" value={jobData.titulo} />
                <ReviewItem label="Descrição" value={jobData.descricao} />
                <ReviewItem label="Localização" value={jobData.localizacao} />
                <ReviewItem label="Tipo de Contrato" value={jobData.tipoContrato} />
                <ReviewItem label="Nível" value={jobData.nivelExperiencia || 'Não especificado'} />
                <ReviewItem label="Salário" value={jobData.salarioDe && jobData.salarioAte ? `${jobData.salarioDe} - ${jobData.salarioAte} Db` : 'Não especificado'} />
                <ReviewItem label="Período" value={`${jobData.dataAbertura} até ${jobData.dataFecho}`} />
                <ReviewItem label="Remoto" value={jobData.remoto ? 'Sim' : 'Não'} />
                <ReviewItem label="TDR" value={jobData.tdrFileName || 'Não enviado'} />
                <ReviewItem label="Teste de habilidades" value={jobData.skillsAssessment.enabled ? `${jobData.skillsAssessment.questions.length} pergunta(s)` : 'Não ativado'} />
              </div>
            </FormSection>
          )}

          {/* Botões de Navegação */}
          <div style={{
            display: 'flex',
            gap: '1rem',
            justifyContent: 'space-between',
            paddingTop: '1.5rem',
            borderTop: '1px solid rgba(255, 255, 255, 0.06)'
          }}>
            <div>
              {currentStep > 1 && (
                <button
                  type="button"
                  onClick={prevStep}
                  style={{
                    padding: '0.875rem 1.5rem',
                    background: 'rgba(255, 255, 255, 0.05)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    borderRadius: '10px',
                    color: '#e4e4e7',
                    fontWeight: '600',
                    cursor: 'pointer'
                  }}
                >
                  Voltar
                </button>
              )}
            </div>
            <div style={{ display: 'flex', gap: '1rem' }}>
              <Link href="/dashboard/empresa" style={{
                padding: '0.875rem 1.5rem',
                background: 'transparent',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                borderRadius: '10px',
                color: '#a1a1aa',
                textDecoration: 'none',
                fontWeight: '600'
              }}>
                Cancelar
              </Link>
              {currentStep < 4 ? (
                <button
                  type="button"
                  onClick={nextStep}
                  style={{
                    padding: '0.875rem 1.5rem',
                    background: '#6366f1',
                    border: 'none',
                    borderRadius: '10px',
                    color: 'white',
                    fontWeight: '600',
                    cursor: 'pointer'
                  }}
                >
                  Continuar
                </button>
              ) : (
                <button
                  type="submit"
                  disabled={isLoading}
                  style={{
                    padding: '0.875rem 2rem',
                    background: isLoading ? 'rgba(16, 185, 129, 0.5)' : '#10b981',
                    border: 'none',
                    borderRadius: '10px',
                    color: 'white',
                    fontWeight: '600',
                    cursor: isLoading ? 'not-allowed' : 'pointer',
                    opacity: isLoading ? 0.6 : 1
                  }}
                >
                  {isLoading ? 'A criar...' : 'Publicar Vaga'}
                </button>
              )}
            </div>
          </div>

        </form>
      </div>
    </>
  );
}

// Review Item Component
function ReviewItem({ label, value }) {
  return (
    <div style={{
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      padding: '0.75rem 0',
      borderBottom: '1px solid rgba(255,255,255,0.04)'
    }}>
      <span style={{ color: '#71717a', fontWeight: '500' }}>{label}</span>
      <span style={{
        color: '#e4e4e7',
        fontWeight: '500',
        maxWidth: '60%',
        textAlign: 'right',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        display: '-webkit-box',
        WebkitLineClamp: 2,
        WebkitBoxOrient: 'vertical'
      }}>
        {value || '-'}
      </span>
    </div>
  );
}

// Componentes de Formulário
function FormSection({ title, children }) {
  return (
    <div style={{
      background: 'rgba(255, 255, 255, 0.03)',
      border: '1px solid rgba(255, 255, 255, 0.06)',
      borderRadius: '14px',
      padding: '1.75rem'
    }}>
      <h2 style={{ margin: '0 0 1.5rem 0', fontSize: '1.25rem', color: 'white', fontWeight: '600' }}>
        {title}
      </h2>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
        {children}
      </div>
    </div>
  );
}

function InputField({ label, name, value, onChange, type = 'text', placeholder = '', required = false, min }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
      <label style={{ color: 'rgba(255, 255, 255, 0.9)', fontWeight: '600', fontSize: '0.875rem' }}>
        {label}
      </label>
      <input
        type={type}
        name={name}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        required={required}
        min={min}
        style={{
          padding: '0.75rem 1rem',
          background: 'rgba(255, 255, 255, 0.05)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          borderRadius: '10px',
          color: 'white',
          fontSize: '0.9rem',
          transition: 'all 0.2s ease'
        }}
        onFocus={(e) => {
          e.currentTarget.style.borderColor = '#6366f1';
          e.currentTarget.style.background = 'rgba(255, 255, 255, 0.06)';
        }}
        onBlur={(e) => {
          e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.1)';
          e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
        }}
      />
    </div>
  );
}

function SelectField({ label, name, value, onChange, options, required = false }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
      <label style={{ color: 'rgba(255, 255, 255, 0.9)', fontWeight: '600', fontSize: '0.875rem' }}>
        {label}
      </label>
      <select
        name={name}
        value={value}
        onChange={onChange}
        required={required}
        style={{
          padding: '0.75rem 1rem',
          background: 'rgba(255, 255, 255, 0.05)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          borderRadius: '10px',
          color: 'white',
          fontSize: '0.9rem',
          cursor: 'pointer',
          appearance: 'none',
          backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%2371717a' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e")`,
          backgroundPosition: 'right 0.75rem center',
          backgroundRepeat: 'no-repeat',
          backgroundSize: '1.25rem 1.25rem',
          paddingRight: '2.5rem'
        }}
      >
        {options.map(opt => (
          <option key={opt.value} value={opt.value} style={{ background: '#18181b', color: 'white' }}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
}

function TextAreaField({ label, name, value, onChange, placeholder = '', rows = 4, required = false }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
      <label style={{ color: 'rgba(255, 255, 255, 0.9)', fontWeight: '600', fontSize: '0.875rem' }}>
        {label}
      </label>
      <textarea
        name={name}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        rows={rows}
        required={required}
        style={{
          padding: '0.75rem 1rem',
          background: 'rgba(255, 255, 255, 0.05)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          borderRadius: '10px',
          color: 'white',
          fontSize: '0.9rem',
          resize: 'vertical',
          fontFamily: 'inherit',
          lineHeight: 1.5,
          transition: 'all 0.2s ease'
        }}
        onFocus={(e) => {
          e.currentTarget.style.borderColor = '#6366f1';
          e.currentTarget.style.background = 'rgba(255, 255, 255, 0.06)';
        }}
        onBlur={(e) => {
          e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.1)';
          e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
        }}
      />
    </div>
  );
}
