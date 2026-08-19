import { useCallback, useMemo, useState } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import Link from 'next/link';
import nookies from 'nookies';
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import {
  FiArrowLeft,
  FiFileText,
  FiTrash2,
  FiUploadCloud,
} from 'react-icons/fi';
import { auth, storage } from '../../../../lib/firebase';
import { admin } from '../../../../lib/firebaseAdmin';
import { getFirebaseStorageErrorMessage } from '../../../../lib/firebaseStorageError';
import adminStyles from '../../../../styles/AdminPanel.module.css';
import { redirectToLogin } from '../../../../lib/loginRedirect';
import { useAuth } from '../../../../context/AuthContext';
import AutoSaveStatus from '../../../../components/forms/AutoSaveStatus';
import useAutoDraft from '../../../../hooks/useAutoDraft';
import { createFormDraftKey } from '../../../../lib/formDraft';

const EMPLOYMENT_TYPES = [
  'Tempo Integral',
  'Meio Período',
  'Contrato',
  'Estágio',
  'Freelance',
  'Voluntariado',
];

const EXPERIENCE_LEVELS = [
  'Júnior (0-2 anos)',
  'Pleno (2-5 anos)',
  'Sénior (5+ anos)',
  'Especialista',
  'Gestão',
];

const EDUCATION_LEVELS = [
  'Ensino Básico',
  'Ensino Secundário',
  'Licenciatura',
  'Mestrado',
  'Doutoramento',
  'Não exigido',
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
  'Atendimento',
  'Outros',
];

/**
 * @param {{ companies?: Array<{ id: string, name: string, logo?: string }> }} props
 */
export default function AdminJobCreate({ companies = [] }) {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [currentStep, setCurrentStep] = useState(1);
  const [uploadingTDR, setUploadingTDR] = useState(false);

  const [jobData, setJobData] = useState({
    companySource: companies.length > 0 ? 'registered' : 'external',
    companyId: '',
    companyName: '',
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
    vagasDisponiveis: 1,
    palavrasChave: '',
    categoria: '',
    tdrUrl: '',
    tdrFileName: '',
  });

  const draftOwnerId = user?.uid || '';
  const jobDraftKey = useMemo(
    () =>
      createFormDraftKey({
        scope: 'admin-job',
        ownerId: draftOwnerId,
        resourceId: 'new',
      }),
    [draftOwnerId],
  );
  const jobDraftValue = useMemo(
    () => ({ jobData, currentStep }),
    [currentStep, jobData],
  );

  const getDraftToken = useCallback(async () => {
    if (!user) return '';
    return user.getIdToken();
  }, [user]);

  const restoreJobDraft = useCallback((draft) => {
    if (!draft || typeof draft !== 'object') return;

    if (draft.jobData && typeof draft.jobData === 'object') {
      setJobData((current) => ({ ...current, ...draft.jobData }));
    }

    const restoredStep = Number(draft.currentStep);
    if (Number.isFinite(restoredStep)) {
      setCurrentStep(Math.max(1, Math.min(4, Math.trunc(restoredStep))));
    }
  }, []);

  const {
    status: jobDraftStatus,
    lastSavedAt: jobDraftSavedAt,
    isOnline: jobDraftIsOnline,
    clearDraft: clearJobDraft,
  } = useAutoDraft({
    storageKey: jobDraftKey,
    scope: 'admin-job',
    resourceId: 'new',
    value: jobDraftValue,
    onRestore: restoreJobDraft,
    getToken: getDraftToken,
    enabled: Boolean(draftOwnerId),
    ready: router.isReady && !authLoading && Boolean(draftOwnerId),
  });

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setJobData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
  };

  const handleTDRUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const allowedTypes = new Set([
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ]);
    const extensionIsAllowed = /\.(pdf|doc|docx)$/i.test(file.name);

    if (!allowedTypes.has(file.type) && !extensionIsAllowed) {
      setError('Envie o TDR em formato PDF ou Word');
      event.target.value = '';
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      setError('O ficheiro TDR deve ter no máximo 10 MB');
      event.target.value = '';
      return;
    }

    setUploadingTDR(true);
    setError('');

    try {
      const user = auth.currentUser;
      if (!user) {
        throw new Error(
          'Sessão expirada. Inicie sessão novamente para enviar o TDR.',
        );
      }

      const safeFileName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
      const storageRef = ref(
        storage,
        `job-tdr/${user.uid}/${Date.now()}_${safeFileName}`,
      );

      await uploadBytes(storageRef, file);
      const downloadUrl = await getDownloadURL(storageRef);

      setJobData((previous) => ({
        ...previous,
        tdrFileName: file.name,
        tdrUrl: downloadUrl,
      }));
      setSuccess('TDR enviado com sucesso.');
    } catch (uploadError) {
      setError(
        getFirebaseStorageErrorMessage(
          uploadError,
          'Não foi possível enviar o TDR',
        ),
      );
    } finally {
      setUploadingTDR(false);
      event.target.value = '';
    }
  };

  const removeTDR = () => {
    setJobData((previous) => ({
      ...previous,
      tdrFileName: '',
      tdrUrl: '',
    }));
    setSuccess('');
  };

  const nextStep = () => {
    if (currentStep === 1) {
      const hasCompany =
        jobData.companySource === 'registered'
          ? Boolean(jobData.companyId)
          : Boolean(jobData.companyName.trim());

      if (
        !hasCompany ||
        !jobData.titulo.trim() ||
        !jobData.descricao.trim() ||
        !jobData.requisitos.trim() ||
        !jobData.categoria
      ) {
        setError(
          'Indique a empresa, a categoria, o título, a descrição e os requisitos para continuar',
        );
        return;
      }
    }
    if (
      currentStep === 2 &&
      (!jobData.localizacao.trim() || !jobData.tipoContrato)
    ) {
      setError('Preencha a localização e o tipo de contrato para continuar');
      return;
    }
    if (currentStep === 2) {
      const salaryFrom =
        jobData.salarioDe === '' ? null : Number(jobData.salarioDe);
      const salaryTo =
        jobData.salarioAte === '' ? null : Number(jobData.salarioAte);
      if (
        (salaryFrom !== null &&
          (!Number.isFinite(salaryFrom) || salaryFrom <= 0)) ||
        (salaryTo !== null && (!Number.isFinite(salaryTo) || salaryTo <= 0))
      ) {
        setError(
          'Indique valores salariais positivos ou deixe ambos os campos vazios',
        );
        return;
      }
      if (salaryFrom !== null && salaryTo !== null && salaryTo < salaryFrom) {
        setError('O salário máximo não pode ser inferior ao salário mínimo');
        return;
      }
    }
    if (currentStep === 3) {
      if (uploadingTDR) {
        setError('Aguarde a conclusão do envio do TDR');
        return;
      }
      if (!jobData.dataFecho) {
        setError('Indique a data de fecho para continuar');
        return;
      }
    }
    setError('');
    setCurrentStep((prev) => Math.min(prev + 1, 4));
  };

  const prevStep = () => {
    setError('');
    setCurrentStep((prev) => Math.max(prev - 1, 1));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');
    setSuccess('');

    try {
      if (uploadingTDR) throw new Error('Aguarde a conclusão do envio do TDR');
      const hasCompany =
        jobData.companySource === 'registered'
          ? Boolean(jobData.companyId)
          : Boolean(jobData.companyName.trim());
      if (!hasCompany) throw new Error('Empresa é obrigatória');

      const response = await fetch('/api/admin/jobs', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...jobData,
          companyId:
            jobData.companySource === 'registered' ? jobData.companyId : '',
          companyName:
            jobData.companySource === 'external'
              ? jobData.companyName.trim()
              : '',
          palavrasChave: jobData.palavrasChave
            .split(',')
            .map((k) => k.trim())
            .filter(Boolean),
          vagasDisponiveis: parseInt(jobData.vagasDisponiveis, 10) || 1,
        }),
      });

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.message || 'Erro ao criar vaga');
      }

      await clearJobDraft();
      setSuccess('Vaga criada com sucesso!');
      setTimeout(() => {
        router.push('/dashboard/admin/jobs');
      }, 2000);
    } catch (error) {
      console.error('Erro ao criar vaga:', error);
      setError(`Erro ao criar vaga: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const styles = {
    page: {
      minHeight: '100vh',
      background: 'linear-gradient(180deg, #0a0e1a 0%, #1a1f35 100%)',
      color: '#fff',
    },
    container: {
      maxWidth: '900px',
      margin: '0 auto',
      padding: '2rem',
    },
  };

  const selectedCompanyName =
    jobData.companySource === 'external'
      ? jobData.companyName.trim() || 'Não indicado'
      : companies.find((c) => c.id === jobData.companyId)?.name ||
        'Nenhuma selecionada';

  return (
    <>
      <Head>
        <title>Criar Vaga (Admin) | EmpregoSTP</title>
      </Head>
      <div className={adminStyles.legacyPage} style={styles.page}>
        <div className={adminStyles.jobCreateLayout} style={styles.container}>
          <div className={adminStyles.jobCreateHeader}>
            <Link
              href="/dashboard/admin/jobs"
              className={adminStyles.jobBackLink}
            >
              <FiArrowLeft aria-hidden="true" />
              Voltar à gestão de vagas
            </Link>
            <h1
              id="admin-job-create-title"
              style={{ fontSize: '2rem', fontWeight: 800 }}
            >
              Nova vaga
            </h1>
            <p style={{ margin: 0 }}>
              Publique uma oportunidade em nome de uma empresa cadastrada ou
              parceira.
            </p>
            <AutoSaveStatus
              status={jobDraftStatus}
              lastSavedAt={jobDraftSavedAt}
              isOnline={jobDraftIsOnline}
            />
          </div>

          <ol
            className={adminStyles.jobStepList}
            aria-label={`Etapa ${currentStep} de 4`}
          >
            {['Vaga', 'Condições', 'Publicação', 'Revisão'].map(
              (label, index) => (
                <li
                  key={label}
                  className={`${adminStyles.jobStep} ${currentStep >= index + 1 ? adminStyles.jobStepActive : ''}`}
                  aria-current={currentStep === index + 1 ? 'step' : undefined}
                >
                  {label}
                </li>
              ),
            )}
          </ol>

          {error && (
            <div
              className={`${adminStyles.alert} ${adminStyles.alertError}`}
              role="alert"
            >
              {error}
            </div>
          )}
          {success && (
            <div
              className={`${adminStyles.alert} ${adminStyles.alertSuccess}`}
              role="status"
              aria-live="polite"
            >
              {success}
            </div>
          )}

          <form
            onSubmit={handleSubmit}
            className={adminStyles.jobFormSurface}
            aria-labelledby="admin-job-create-title"
          >
            {currentStep === 1 && (
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '1.5rem',
                }}
              >
                <fieldset
                  style={{
                    margin: 0,
                    padding: 0,
                    border: 0,
                    display: 'grid',
                    gap: '0.75rem',
                  }}
                >
                  <legend style={{ marginBottom: '0.75rem', fontWeight: 700 }}>
                    Empresa responsável *
                  </legend>
                  <div className={adminStyles.jobChoiceGrid}>
                    <label
                      className={`${adminStyles.jobChoiceCard} ${jobData.companySource === 'registered' ? adminStyles.jobChoiceCardActive : ''}`}
                    >
                      <input
                        type="radio"
                        name="companySource"
                        value="registered"
                        checked={jobData.companySource === 'registered'}
                        onChange={handleChange}
                        disabled={companies.length === 0}
                        style={{ marginTop: '0.2rem' }}
                      />
                      <span>
                        <strong style={{ display: 'block' }}>
                          Empresa cadastrada
                        </strong>
                        <small>Associar a vaga a uma conta existente.</small>
                      </span>
                    </label>
                    <label
                      className={`${adminStyles.jobChoiceCard} ${jobData.companySource === 'external' ? adminStyles.jobChoiceCardActive : ''}`}
                    >
                      <input
                        type="radio"
                        name="companySource"
                        value="external"
                        checked={jobData.companySource === 'external'}
                        onChange={handleChange}
                        style={{ marginTop: '0.2rem' }}
                      />
                      <span>
                        <strong style={{ display: 'block' }}>
                          Empresa não cadastrada
                        </strong>
                        <small>Publicar informando o nome manualmente.</small>
                      </span>
                    </label>
                  </div>

                  {jobData.companySource === 'registered' ? (
                    <div
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '0.5rem',
                      }}
                    >
                      <label htmlFor="companyId" style={{ fontWeight: 600 }}>
                        Selecionar empresa
                      </label>
                      <select
                        id="companyId"
                        name="companyId"
                        value={jobData.companyId}
                        onChange={handleChange}
                        style={{
                          padding: '0.8rem',
                          background: 'rgba(255,255,255,0.1)',
                          border: '1px solid rgba(255,255,255,0.2)',
                          borderRadius: '8px',
                          color: 'white',
                        }}
                      >
                        <option value="">Selecione a empresa...</option>
                        {companies.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  ) : (
                    <div
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '0.5rem',
                      }}
                    >
                      <label htmlFor="companyName" style={{ fontWeight: 600 }}>
                        Nome da empresa *
                      </label>
                      <input
                        id="companyName"
                        type="text"
                        name="companyName"
                        value={jobData.companyName}
                        onChange={handleChange}
                        maxLength={120}
                        autoComplete="organization"
                        placeholder="Ex.: Empresa Nacional de Serviços"
                        style={{
                          padding: '0.8rem',
                          background: 'rgba(255,255,255,0.1)',
                          border: '1px solid rgba(255,255,255,0.2)',
                          borderRadius: '8px',
                          color: 'white',
                        }}
                      />
                      <small style={{ color: '#94a3b8' }}>
                        A vaga será publicada com este nome, sem criar uma conta
                        empresarial.
                      </small>
                    </div>
                  )}
                </fieldset>

                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
                    gap: '1rem',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.5rem',
                    }}
                  >
                    <label htmlFor="titulo" style={{ fontWeight: 600 }}>
                      Título / nome da vaga *
                    </label>
                    <input
                      id="titulo"
                      type="text"
                      name="titulo"
                      value={jobData.titulo}
                      onChange={handleChange}
                      maxLength={140}
                      placeholder="Ex.: Técnico de Contabilidade"
                      style={{
                        padding: '0.8rem',
                        background: 'rgba(255,255,255,0.1)',
                        border: '1px solid rgba(255,255,255,0.2)',
                        borderRadius: '8px',
                        color: 'white',
                      }}
                    />
                  </div>
                  <div
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.5rem',
                    }}
                  >
                    <label htmlFor="categoria" style={{ fontWeight: 600 }}>
                      Categoria *
                    </label>
                    <select
                      id="categoria"
                      name="categoria"
                      value={jobData.categoria}
                      onChange={handleChange}
                      style={{
                        padding: '0.8rem',
                        background: 'rgba(255,255,255,0.1)',
                        border: '1px solid rgba(255,255,255,0.2)',
                        borderRadius: '8px',
                        color: 'white',
                      }}
                    >
                      <option value="">Selecione categoria...</option>
                      {JOB_CATEGORIES.map((cat) => (
                        <option key={cat} value={cat}>
                          {cat}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.5rem',
                  }}
                >
                  <label htmlFor="descricao" style={{ fontWeight: 600 }}>
                    Descrição *
                  </label>
                  <textarea
                    id="descricao"
                    name="descricao"
                    value={jobData.descricao}
                    onChange={handleChange}
                    rows={5}
                    placeholder="Apresente a função, os objetivos e o contexto da oportunidade."
                    style={{
                      padding: '0.8rem',
                      background: 'rgba(255,255,255,0.1)',
                      border: '1px solid rgba(255,255,255,0.2)',
                      borderRadius: '8px',
                      color: 'white',
                    }}
                  />
                </div>

                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.5rem',
                  }}
                >
                  <label htmlFor="requisitos" style={{ fontWeight: 600 }}>
                    Requisitos *
                  </label>
                  <textarea
                    id="requisitos"
                    name="requisitos"
                    value={jobData.requisitos}
                    onChange={handleChange}
                    rows={4}
                    placeholder="Indique formação, experiência, competências e outros critérios essenciais."
                    style={{
                      padding: '0.8rem',
                      background: 'rgba(255,255,255,0.1)',
                      border: '1px solid rgba(255,255,255,0.2)',
                      borderRadius: '8px',
                      color: 'white',
                    }}
                  />
                </div>

                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.5rem',
                  }}
                >
                  <label
                    htmlFor="responsabilidades"
                    style={{ fontWeight: 600 }}
                  >
                    Responsabilidades
                  </label>
                  <textarea
                    id="responsabilidades"
                    name="responsabilidades"
                    value={jobData.responsabilidades}
                    onChange={handleChange}
                    rows={4}
                    placeholder="Liste as principais tarefas e responsabilidades da função."
                    style={{
                      padding: '0.8rem',
                      background: 'rgba(255,255,255,0.1)',
                      border: '1px solid rgba(255,255,255,0.2)',
                      borderRadius: '8px',
                      color: 'white',
                    }}
                  />
                </div>
              </div>
            )}

            {currentStep === 2 && (
              <div style={{ display: 'grid', gap: '1.5rem' }}>
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
                    gap: '1rem',
                  }}
                >
                  <div>
                    <label
                      htmlFor="localizacao"
                      style={{ display: 'block', marginBottom: '0.5rem' }}
                    >
                      Localização *
                    </label>
                    <input
                      id="localizacao"
                      type="text"
                      name="localizacao"
                      value={jobData.localizacao}
                      onChange={handleChange}
                      style={{
                        width: '100%',
                        padding: '0.8rem',
                        background: 'rgba(255,255,255,0.1)',
                        border: '1px solid rgba(255,255,255,0.2)',
                        borderRadius: '8px',
                        color: 'white',
                      }}
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="tipoContrato"
                      style={{ display: 'block', marginBottom: '0.5rem' }}
                    >
                      Tipo de contrato *
                    </label>
                    <select
                      id="tipoContrato"
                      name="tipoContrato"
                      value={jobData.tipoContrato}
                      onChange={handleChange}
                      style={{
                        width: '100%',
                        padding: '0.8rem',
                        background: 'rgba(255,255,255,0.1)',
                        border: '1px solid rgba(255,255,255,0.2)',
                        borderRadius: '8px',
                        color: 'white',
                      }}
                    >
                      <option value="">Selecione...</option>
                      {EMPLOYMENT_TYPES.map((t) => (
                        <option key={t} value={t}>
                          {t}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
                    gap: '1rem',
                  }}
                >
                  <div>
                    <label
                      htmlFor="salarioDe"
                      style={{ display: 'block', marginBottom: '0.5rem' }}
                    >
                      Salário mínimo (STN)
                    </label>
                    <input
                      id="salarioDe"
                      type="number"
                      name="salarioDe"
                      value={jobData.salarioDe}
                      onChange={handleChange}
                      min="1"
                      step="1"
                      inputMode="numeric"
                      placeholder="Ex.: 6000"
                      style={{
                        width: '100%',
                        padding: '0.8rem',
                        background: 'rgba(255,255,255,0.1)',
                        border: '1px solid rgba(255,255,255,0.2)',
                        borderRadius: '8px',
                        color: 'white',
                      }}
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="salarioAte"
                      style={{ display: 'block', marginBottom: '0.5rem' }}
                    >
                      Salário máximo (STN)
                    </label>
                    <input
                      id="salarioAte"
                      type="number"
                      name="salarioAte"
                      value={jobData.salarioAte}
                      onChange={handleChange}
                      min="1"
                      step="1"
                      inputMode="numeric"
                      placeholder="Ex.: 9000"
                      style={{
                        width: '100%',
                        padding: '0.8rem',
                        background: 'rgba(255,255,255,0.1)',
                        border: '1px solid rgba(255,255,255,0.2)',
                        borderRadius: '8px',
                        color: 'white',
                      }}
                    />
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '2rem' }}>
                  <label
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                      cursor: 'pointer',
                    }}
                  >
                    <input
                      type="checkbox"
                      name="remoto"
                      checked={jobData.remoto}
                      onChange={handleChange}
                      style={{ width: '18px', height: '18px' }}
                    />
                    Remoto
                  </label>
                  <label
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                      cursor: 'pointer',
                    }}
                  >
                    <input
                      type="checkbox"
                      name="destaque"
                      checked={jobData.destaque}
                      onChange={handleChange}
                      style={{ width: '18px', height: '18px' }}
                    />
                    Destaque
                  </label>
                </div>

                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.5rem',
                  }}
                >
                  <label htmlFor="beneficios" style={{ fontWeight: 600 }}>
                    Benefícios
                  </label>
                  <textarea
                    id="beneficios"
                    name="beneficios"
                    value={jobData.beneficios}
                    onChange={handleChange}
                    rows={4}
                    placeholder="Ex.: seguro de saúde, subsídio de transporte, formação e prémios."
                    style={{
                      padding: '0.8rem',
                      background: 'rgba(255,255,255,0.1)',
                      border: '1px solid rgba(255,255,255,0.2)',
                      borderRadius: '8px',
                      color: 'white',
                    }}
                  />
                  <small style={{ color: '#94a3b8' }}>
                    Opcional. Separe os benefícios por linha para facilitar a
                    leitura.
                  </small>
                </div>
              </div>
            )}

            {currentStep === 3 && (
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '1.5rem',
                }}
              >
                <div
                  style={{
                    display: 'grid',
                    gap: '0.75rem',
                    padding: '1.25rem',
                    border: '1px solid rgba(255,255,255,0.14)',
                    borderRadius: '8px',
                    background: 'rgba(255,255,255,0.04)',
                  }}
                >
                  <div>
                    <strong
                      style={{ display: 'block', marginBottom: '0.25rem' }}
                    >
                      Termos de Referência (TDR)
                    </strong>
                    <small style={{ color: '#cbd5e1' }}>
                      Documento opcional em PDF ou Word, com o máximo de 10 MB.
                    </small>
                  </div>

                  {jobData.tdrUrl ? (
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '1rem',
                        flexWrap: 'wrap',
                        padding: '1rem',
                        border: '1px solid rgba(218,255,69,0.35)',
                        borderRadius: '8px',
                        background: 'rgba(218,255,69,0.08)',
                      }}
                    >
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.75rem',
                          minWidth: 0,
                        }}
                      >
                        <FiFileText
                          aria-hidden="true"
                          size={24}
                          color="#daff45"
                        />
                        <div style={{ minWidth: 0 }}>
                          <strong
                            style={{
                              display: 'block',
                              overflowWrap: 'anywhere',
                            }}
                          >
                            {jobData.tdrFileName}
                          </strong>
                          <a
                            href={jobData.tdrUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{ color: '#69c8ff', fontSize: '0.875rem' }}
                          >
                            Ver documento
                          </a>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={removeTDR}
                        aria-label="Remover TDR"
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.4rem',
                          padding: '0.65rem 0.85rem',
                          border: '1px solid rgba(248,113,113,0.45)',
                          background: 'rgba(239,68,68,0.12)',
                          color: '#fecaca',
                          cursor: 'pointer',
                        }}
                      >
                        <FiTrash2 aria-hidden="true" />
                        Remover
                      </button>
                    </div>
                  ) : (
                    <label
                      htmlFor="tdrFile"
                      style={{
                        minHeight: '150px',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '0.5rem',
                        padding: '1.25rem',
                        border: '1px dashed rgba(105,200,255,0.7)',
                        borderRadius: '8px',
                        background: 'rgba(59,130,246,0.08)',
                        color: 'white',
                        textAlign: 'center',
                        cursor: uploadingTDR ? 'wait' : 'pointer',
                        opacity: uploadingTDR ? 0.65 : 1,
                      }}
                    >
                      <FiUploadCloud
                        aria-hidden="true"
                        size={32}
                        color="#69c8ff"
                      />
                      <strong>
                        {uploadingTDR
                          ? 'A enviar TDR...'
                          : 'Selecionar ficheiro TDR'}
                      </strong>
                      <small style={{ color: '#cbd5e1' }}>
                        PDF, DOC ou DOCX
                      </small>
                      <input
                        id="tdrFile"
                        type="file"
                        accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                        onChange={handleTDRUpload}
                        disabled={uploadingTDR}
                        aria-label="Carregar ficheiro TDR"
                        style={{
                          position: 'absolute',
                          width: '1px',
                          height: '1px',
                          opacity: 0,
                          pointerEvents: 'none',
                        }}
                      />
                    </label>
                  )}
                </div>

                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
                    gap: '1rem',
                  }}
                >
                  <div>
                    <label
                      htmlFor="dataAbertura"
                      style={{ display: 'block', marginBottom: '0.5rem' }}
                    >
                      Data de abertura
                    </label>
                    <input
                      id="dataAbertura"
                      type="date"
                      name="dataAbertura"
                      value={jobData.dataAbertura}
                      onChange={handleChange}
                      style={{
                        width: '100%',
                        padding: '0.8rem',
                        background: 'rgba(255,255,255,0.1)',
                        border: '1px solid rgba(255,255,255,0.2)',
                        borderRadius: '8px',
                        color: 'white',
                      }}
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="dataFecho"
                      style={{ display: 'block', marginBottom: '0.5rem' }}
                    >
                      Data de fecho *
                    </label>
                    <input
                      id="dataFecho"
                      type="date"
                      name="dataFecho"
                      value={jobData.dataFecho}
                      onChange={handleChange}
                      style={{
                        width: '100%',
                        padding: '0.8rem',
                        background: 'rgba(255,255,255,0.1)',
                        border: '1px solid rgba(255,255,255,0.2)',
                        borderRadius: '8px',
                        color: 'white',
                      }}
                    />
                  </div>
                </div>
              </div>
            )}

            {currentStep === 4 && (
              <div style={{ color: 'rgba(255,255,255,0.8)' }}>
                <h3>Revisão</h3>
                <p>
                  <strong>Empresa:</strong> {selectedCompanyName}
                </p>
                <p>
                  <strong>Origem:</strong>{' '}
                  {jobData.companySource === 'external'
                    ? 'Empresa não cadastrada'
                    : 'Empresa cadastrada'}
                </p>
                <p>
                  <strong>Título:</strong> {jobData.titulo}
                </p>
                <p>
                  <strong>Local:</strong> {jobData.localizacao}{' '}
                  {jobData.remoto ? '(Remoto)' : ''}
                </p>
                <p>
                  <strong>Salário:</strong>{' '}
                  {jobData.salarioDe || jobData.salarioAte
                    ? `${jobData.salarioDe || '—'} a ${jobData.salarioAte || '—'} STN`
                    : 'Não informado'}
                </p>
                <p style={{ whiteSpace: 'pre-line' }}>
                  <strong>Requisitos:</strong> {jobData.requisitos}
                </p>
                <p style={{ whiteSpace: 'pre-line' }}>
                  <strong>Benefícios:</strong>{' '}
                  {jobData.beneficios || 'Não informados'}
                </p>
                <p>
                  <strong>TDR:</strong> {jobData.tdrFileName || 'Não anexado'}
                </p>
              </div>
            )}

            <div className={adminStyles.jobFormActions}>
              {currentStep > 1 ? (
                <button
                  type="button"
                  onClick={prevStep}
                  className={`${adminStyles.buttonBase} ${adminStyles.buttonGhost}`}
                >
                  Anterior
                </button>
              ) : (
                <div />
              )}

              {currentStep < 4 ? (
                <button
                  type="button"
                  onClick={nextStep}
                  disabled={currentStep === 3 && uploadingTDR}
                  className={`${adminStyles.buttonBase} ${adminStyles.buttonPrimary}`}
                >
                  {currentStep === 3 && uploadingTDR
                    ? 'A enviar TDR...'
                    : 'Próximo'}
                </button>
              ) : (
                <button
                  type="submit"
                  disabled={isLoading || uploadingTDR}
                  className={`${adminStyles.buttonBase} ${adminStyles.buttonSuccess}`}
                >
                  {isLoading ? 'A criar...' : 'Confirmar e criar vaga'}
                </button>
              )}
            </div>
          </form>
        </div>
      </div>
    </>
  );
}

export async function getServerSideProps(context) {
  try {
    const cookies = nookies.get(context);
    if (!cookies.token) {
      return redirectToLogin(context);
    }

    const token = await admin.auth().verifyIdToken(cookies.token);
    const { uid } = token;

    // Check if admin
    const userDoc = await admin.firestore().collection('users').doc(uid).get();
    if (!userDoc.exists || userDoc.data().userType !== 'admin') {
      return { redirect: { destination: '/dashboard', permanent: false } };
    }

    // Fetch All Companies
    const companiesSnapshot = await admin
      .firestore()
      .collection('users')
      .where('userType', '==', 'empresa')
      .get();

    const companies = companiesSnapshot.docs.map((doc) => ({
      id: doc.id,
      name: doc.data().name || doc.data().empresaNome || 'Empresa sem nome',
      logo: doc.data().logo || '',
    }));

    return {
      props: { companies },
    };
  } catch (error) {
    console.error('Error in admin job create props:', error);
    return redirectToLogin(context);
  }
}
