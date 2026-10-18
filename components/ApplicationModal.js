import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  APPLICATION_FORM_LIMITS,
  APPLICATION_FORM_STEPS,
  AVAILABILITY_OPTIONS,
  EXPERIENCE_YEARS_OPTIONS,
  LANGUAGE_LEVEL_OPTIONS,
  MAX_EDUCATION_ENTRIES,
  MAX_LANGUAGE_ENTRIES,
  REFERRAL_SOURCE_OPTIONS,
  WORK_AUTHORIZATION_OPTIONS,
  firstStepWithErrors,
  validateApplicationForm,
} from '../lib/applicationForm';
import { validateApplicationDocuments } from '../lib/applicationDocuments';
import styles from '../styles/ApplicationModal.module.css';

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

function Campo({ id, label, erro, obrigatorio, ajuda, children }) {
  return (
    <div className={styles.field}>
      <label htmlFor={id} className={styles.label}>
        {label}
        {obrigatorio ? <span className={styles.required}> *</span> : null}
      </label>
      {children}
      {ajuda && !erro ? <p className={styles.hint}>{ajuda}</p> : null}
      {erro ? (
        <p className={styles.fieldError} role="alert">
          {erro}
        </p>
      ) : null}
    </div>
  );
}

export default function ApplicationModal({
  isOpen,
  onClose,
  job,
  form,
  onChange,
  onSubmit,
  submitting = false,
  errorMessage = '',
  onGenerateCoverLetter = null,
  generatingCoverLetter = false,
  documentRequirements = [],
  onUploadDocument = null,
  draftStatus = null,
  coverLetterEnabled = true,
  coverLetterLockedMessage = '',
}) {
  const modalRef = useRef(null);
  const conteudoRef = useRef(null);
  // O pai costuma passar um `onClose` novo a cada render. Se o efeito do foco
  // dependesse dessa identidade, cada tecla escrita re-corria o efeito e
  // devolvia o foco ao primeiro campo do formulario. Guardamos a versao mais
  // recente numa ref para o efeito depender so do `isOpen`.
  const onCloseRef = useRef(onClose);
  const [passo, setPasso] = useState(0);
  const [passosVisitados, setPassosVisitados] = useState(() => new Set());

  const [aCarregar, setACarregar] = useState('');
  const [erroUpload, setErroUpload] = useState('');

  const erros = useMemo(() => {
    if (!isOpen) return {};
    // Documentos em falta não bloqueiam (F2.3): passam a aviso, mostrado à
    // parte em `documentosEmFalta`.
    return validateApplicationForm(form, {
      requireCoverLetter: Boolean(job?.requireCoverLetter),
    });
  }, [isOpen, form, job]);

  const documentosEmFalta = useMemo(
    () =>
      isOpen
        ? documentRequirements
            .filter(
              (requisito) =>
                validateApplicationDocuments([requisito], form.documents)[
                  requisito.id
                ],
            )
            .map((requisito) => requisito.label)
        : [],
    [isOpen, documentRequirements, form.documents],
  );

  const passoAtual = APPLICATION_FORM_STEPS[passo];
  const errosDoPasso = useMemo(() => {
    if (!passoAtual) return {};
    return Object.fromEntries(
      Object.entries(erros).filter(([campo]) =>
        passoAtual.fields.includes(campo),
      ),
    );
  }, [erros, passoAtual]);

  // Os erros só aparecem depois de a pessoa tentar avançar: acusar campos por
  // preencher mal o modal abre é hostil e não ajuda ninguém.
  const mostrarErros = passosVisitados.has(passo);
  const errosVisiveis = mostrarErros ? errosDoPasso : {};
  const ultimoPasso = passo === APPLICATION_FORM_STEPS.length - 1;

  const definir = useCallback(
    (campo, valor) => onChange({ ...form, [campo]: valor }),
    [form, onChange],
  );

  const definirEmLista = useCallback(
    (campo, indice, chave, valor) => {
      const lista = Array.isArray(form[campo]) ? [...form[campo]] : [];
      lista[indice] = { ...lista[indice], [chave]: valor };
      onChange({ ...form, [campo]: lista });
    },
    [form, onChange],
  );

  const adicionarNaLista = useCallback(
    (campo, vazio, maximo) => {
      const lista = Array.isArray(form[campo]) ? form[campo] : [];
      if (lista.length >= maximo) return;
      onChange({ ...form, [campo]: [...lista, vazio] });
    },
    [form, onChange],
  );

  const removerDaLista = useCallback(
    (campo, indice) => {
      const lista = Array.isArray(form[campo]) ? [...form[campo]] : [];
      lista.splice(indice, 1);
      onChange({ ...form, [campo]: lista });
    },
    [form, onChange],
  );

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!isOpen) return undefined;

    const focadoAntes = document.activeElement;
    const modal = modalRef.current;

    function aoTeclar(evento) {
      if (evento.key === 'Escape') {
        evento.preventDefault();
        onCloseRef.current?.();
        return;
      }
      if (evento.key !== 'Tab' || !modal) return;

      const focaveis = [...modal.querySelectorAll(FOCUSABLE)].filter(
        (elemento) => elemento.getClientRects().length > 0,
      );
      if (!focaveis.length) {
        evento.preventDefault();
        modal.focus();
        return;
      }
      const primeiro = focaveis[0];
      const ultimo = focaveis[focaveis.length - 1];
      if (evento.shiftKey && document.activeElement === primeiro) {
        evento.preventDefault();
        ultimo.focus();
      } else if (!evento.shiftKey && document.activeElement === ultimo) {
        evento.preventDefault();
        primeiro.focus();
      }
    }

    document.body.classList.add('modal-open');
    document.addEventListener('keydown', aoTeclar);
    window.requestAnimationFrame(() => {
      modal?.querySelector('input, select, textarea')?.focus({
        preventScroll: true,
      });
    });

    return () => {
      document.body.classList.remove('modal-open');
      document.removeEventListener('keydown', aoTeclar);
      if (focadoAntes instanceof HTMLElement) {
        focadoAntes.focus({ preventScroll: true });
      }
    };
  }, [isOpen]);

  // Cada mudança de passo volta ao topo do conteúdo e anuncia o passo novo.
  useEffect(() => {
    if (!isOpen) return;
    const conteudo = conteudoRef.current;
    if (!conteudo) return;
    // `scrollTo` em elementos não existe em toda a parte (o jsdom não o tem):
    // o `scrollTop` faz o mesmo e existe sempre.
    if (typeof conteudo.scrollTo === 'function') conteudo.scrollTo({ top: 0 });
    else conteudo.scrollTop = 0;
  }, [isOpen, passo]);

  useEffect(() => {
    if (isOpen) return;
    setPasso(0);
    setPassosVisitados(new Set());
  }, [isOpen]);

  if (!isOpen) return null;

  const marcarVisitado = () =>
    setPassosVisitados((anteriores) => new Set(anteriores).add(passo));

  const avancar = () => {
    marcarVisitado();
    if (Object.keys(errosDoPasso).length > 0) return;
    setPasso((atual) => Math.min(atual + 1, APPLICATION_FORM_STEPS.length - 1));
  };

  const recuar = () => setPasso((atual) => Math.max(atual - 1, 0));

  const submeter = (evento) => {
    evento.preventDefault();
    marcarVisitado();

    const primeiroComErro = firstStepWithErrors(erros);
    if (primeiroComErro !== null) {
      setPassosVisitados(
        new Set(APPLICATION_FORM_STEPS.map((_, indice) => indice)),
      );
      setPasso(primeiroComErro);
      return;
    }
    onSubmit(form);
  };

  const educacao = Array.isArray(form.education) ? form.education : [];
  const idiomas = Array.isArray(form.languages) ? form.languages : [];
  const referencias = Array.isArray(form.references) ? form.references : [];
  const totalErros = Object.keys(erros).length;

  return (
    <div
      className={styles.overlay}
      onMouseDown={(evento) => {
        if (evento.target === evento.currentTarget) onClose();
      }}
    >
      <div
        ref={modalRef}
        className={styles.modal}
        role="dialog"
        aria-modal="true"
        aria-labelledby="application-modal-title"
        tabIndex={-1}
      >
        <header className={styles.header}>
          <div className={styles.headerCopy}>
            <span className={styles.eyebrow}>Candidatura</span>
            <h2 id="application-modal-title" className={styles.title}>
              {job?.titulo || job?.title || 'Candidatar-se a esta vaga'}
            </h2>
            {job?.companyName ? (
              <p className={styles.subtitle}>{job.companyName}</p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            className={styles.close}
            aria-label="Fechar formulário de candidatura"
          >
            ×
          </button>
        </header>

        <ol className={styles.stepper}>
          {APPLICATION_FORM_STEPS.map((definicao, indice) => {
            const estado =
              indice === passo
                ? 'atual'
                : indice < passo
                  ? 'feito'
                  : 'porFazer';
            return (
              <li
                key={definicao.id}
                className={`${styles.step} ${styles[estado]}`}
                aria-current={indice === passo ? 'step' : undefined}
              >
                <span className={styles.stepDot}>
                  {indice < passo ? '✓' : indice + 1}
                </span>
                <span className={styles.stepLabel}>{definicao.title}</span>
              </li>
            );
          })}
        </ol>

        <form onSubmit={submeter} className={styles.form} noValidate>
          <div className={styles.content} ref={conteudoRef}>
            <p className={styles.stepCounter} aria-live="polite">
              Passo {passo + 1} de {APPLICATION_FORM_STEPS.length} —{' '}
              {passoAtual.title}
            </p>

            {passo === 0 ? (
              <div className={styles.grid}>
                <Campo
                  id="ap-fullName"
                  label="Nome completo"
                  obrigatorio
                  erro={errosVisiveis.fullName}
                >
                  <input
                    id="ap-fullName"
                    className={styles.input}
                    value={form.fullName}
                    maxLength={APPLICATION_FORM_LIMITS.fullName}
                    onChange={(e) => definir('fullName', e.target.value)}
                    autoComplete="name"
                  />
                </Campo>

                <Campo
                  id="ap-email"
                  label="Email"
                  obrigatorio
                  erro={errosVisiveis.email}
                >
                  <input
                    id="ap-email"
                    type="email"
                    className={styles.input}
                    value={form.email}
                    maxLength={APPLICATION_FORM_LIMITS.email}
                    onChange={(e) => definir('email', e.target.value)}
                    autoComplete="email"
                  />
                </Campo>

                <Campo
                  id="ap-phone"
                  label="Telefone"
                  obrigatorio
                  erro={errosVisiveis.phone}
                >
                  <input
                    id="ap-phone"
                    type="tel"
                    className={styles.input}
                    value={form.phone}
                    maxLength={APPLICATION_FORM_LIMITS.phone}
                    onChange={(e) => definir('phone', e.target.value)}
                    autoComplete="tel"
                  />
                </Campo>

                <Campo
                  id="ap-location"
                  label="Localização"
                  erro={errosVisiveis.location}
                >
                  <input
                    id="ap-location"
                    className={styles.input}
                    value={form.location}
                    maxLength={APPLICATION_FORM_LIMITS.location}
                    onChange={(e) => definir('location', e.target.value)}
                  />
                </Campo>

                {/* H7/F4.5: data de nascimento e nacionalidade nunca são pedidas. */}

                <Campo
                  id="ap-workAuthorization"
                  label="Autorização de trabalho"
                  erro={errosVisiveis.workAuthorization}
                  ajuda="A sua situação legal para trabalhar em São Tomé e Príncipe."
                >
                  <select
                    id="ap-workAuthorization"
                    className={styles.input}
                    value={form.workAuthorization}
                    onChange={(e) =>
                      definir('workAuthorization', e.target.value)
                    }
                  >
                    <option value="">Selecione…</option>
                    {WORK_AUTHORIZATION_OPTIONS.map((opcao) => (
                      <option key={opcao.value} value={opcao.value}>
                        {opcao.label}
                      </option>
                    ))}
                  </select>
                </Campo>
              </div>
            ) : null}

            {passo === 1 ? (
              <>
                <fieldset className={styles.fieldset}>
                  <legend className={styles.legend}>Formação académica</legend>
                  {educacao.map((item, indice) => (
                    <div key={indice} className={styles.repeatRow}>
                      <input
                        className={styles.input}
                        placeholder="Grau (ex.: Licenciatura em Gestão)"
                        aria-label={`Grau da formação ${indice + 1}`}
                        value={item.degree || ''}
                        maxLength={APPLICATION_FORM_LIMITS.educationDegree}
                        onChange={(e) =>
                          definirEmLista(
                            'education',
                            indice,
                            'degree',
                            e.target.value,
                          )
                        }
                      />
                      <input
                        className={styles.input}
                        placeholder="Instituição"
                        aria-label={`Instituição da formação ${indice + 1}`}
                        value={item.institution || ''}
                        maxLength={APPLICATION_FORM_LIMITS.educationInstitution}
                        onChange={(e) =>
                          definirEmLista(
                            'education',
                            indice,
                            'institution',
                            e.target.value,
                          )
                        }
                      />
                      <input
                        className={`${styles.input} ${styles.inputNarrow}`}
                        placeholder="Ano"
                        aria-label={`Ano da formação ${indice + 1}`}
                        value={item.year || ''}
                        maxLength={APPLICATION_FORM_LIMITS.educationYear}
                        onChange={(e) =>
                          definirEmLista(
                            'education',
                            indice,
                            'year',
                            e.target.value,
                          )
                        }
                      />
                      {educacao.length > 1 ? (
                        <button
                          type="button"
                          className={styles.removeRow}
                          onClick={() => removerDaLista('education', indice)}
                          aria-label={`Remover formação ${indice + 1}`}
                        >
                          ×
                        </button>
                      ) : null}
                    </div>
                  ))}
                  {educacao.length < MAX_EDUCATION_ENTRIES ? (
                    <button
                      type="button"
                      className={styles.addRow}
                      onClick={() =>
                        adicionarNaLista(
                          'education',
                          { degree: '', institution: '', year: '' },
                          MAX_EDUCATION_ENTRIES,
                        )
                      }
                    >
                      + Adicionar formação
                    </button>
                  ) : null}
                  {errosVisiveis.education ? (
                    <p className={styles.fieldError} role="alert">
                      {errosVisiveis.education}
                    </p>
                  ) : null}
                </fieldset>

                <fieldset className={styles.fieldset}>
                  <legend className={styles.legend}>Idiomas</legend>
                  {idiomas.map((item, indice) => (
                    <div key={indice} className={styles.repeatRow}>
                      <input
                        className={styles.input}
                        placeholder="Idioma"
                        aria-label={`Idioma ${indice + 1}`}
                        value={item.language || ''}
                        maxLength={APPLICATION_FORM_LIMITS.languageName}
                        onChange={(e) =>
                          definirEmLista(
                            'languages',
                            indice,
                            'language',
                            e.target.value,
                          )
                        }
                      />
                      <select
                        className={styles.input}
                        aria-label={`Nível do idioma ${indice + 1}`}
                        value={item.level || ''}
                        onChange={(e) =>
                          definirEmLista(
                            'languages',
                            indice,
                            'level',
                            e.target.value,
                          )
                        }
                      >
                        <option value="">Nível…</option>
                        {LANGUAGE_LEVEL_OPTIONS.map((opcao) => (
                          <option key={opcao.value} value={opcao.value}>
                            {opcao.label}
                          </option>
                        ))}
                      </select>
                      {idiomas.length > 1 ? (
                        <button
                          type="button"
                          className={styles.removeRow}
                          onClick={() => removerDaLista('languages', indice)}
                          aria-label={`Remover idioma ${indice + 1}`}
                        >
                          ×
                        </button>
                      ) : null}
                    </div>
                  ))}
                  {idiomas.length < MAX_LANGUAGE_ENTRIES ? (
                    <button
                      type="button"
                      className={styles.addRow}
                      onClick={() =>
                        adicionarNaLista(
                          'languages',
                          { language: '', level: '' },
                          MAX_LANGUAGE_ENTRIES,
                        )
                      }
                    >
                      + Adicionar idioma
                    </button>
                  ) : null}
                  {errosVisiveis.languages ? (
                    <p className={styles.fieldError} role="alert">
                      {errosVisiveis.languages}
                    </p>
                  ) : null}
                </fieldset>
              </>
            ) : null}

            {passo === 2 ? (
              <>
                {!coverLetterEnabled ? (
                  <div className={styles.lockedBox}>
                    <strong className={styles.cvTitle}>
                      Carta de motivação
                    </strong>
                    <p className={styles.cvMissing}>
                      {coverLetterLockedMessage ||
                        'A carta de motivação personalizada está disponível nos planos Profissional e Premium. Pode candidatar-se sem ela.'}
                    </p>
                  </div>
                ) : (
                  <Campo
                    id="ap-coverLetter"
                    label="Carta de motivação"
                    obrigatorio={Boolean(job?.requireCoverLetter)}
                    erro={errosVisiveis.coverLetter}
                  >
                    <textarea
                      id="ap-coverLetter"
                      className={styles.textarea}
                      rows={8}
                      value={form.coverLetter}
                      maxLength={APPLICATION_FORM_LIMITS.coverLetter}
                      onChange={(e) => definir('coverLetter', e.target.value)}
                      placeholder="Explique por que é a pessoa certa para esta vaga."
                    />
                    <div className={styles.textareaFooter}>
                      {onGenerateCoverLetter ? (
                        <button
                          type="button"
                          className={styles.ghostButton}
                          onClick={onGenerateCoverLetter}
                          disabled={generatingCoverLetter}
                        >
                          {generatingCoverLetter
                            ? 'A gerar…'
                            : 'Gerar sugestão'}
                        </button>
                      ) : (
                        <span />
                      )}
                      <span className={styles.counter}>
                        {form.coverLetter.length}/
                        {APPLICATION_FORM_LIMITS.coverLetter}
                      </span>
                    </div>
                  </Campo>
                )}

                <div className={styles.grid}>
                  <Campo
                    id="ap-experienceYears"
                    label="Anos de experiência"
                    erro={errosVisiveis.experienceYears}
                  >
                    <select
                      id="ap-experienceYears"
                      className={styles.input}
                      value={form.experienceYears}
                      onChange={(e) =>
                        definir('experienceYears', e.target.value)
                      }
                    >
                      <option value="">Selecione…</option>
                      {EXPERIENCE_YEARS_OPTIONS.map((opcao) => (
                        <option key={opcao.value} value={opcao.value}>
                          {opcao.label}
                        </option>
                      ))}
                    </select>
                  </Campo>

                  <Campo
                    id="ap-availability"
                    label="Disponibilidade"
                    erro={errosVisiveis.availability}
                  >
                    <select
                      id="ap-availability"
                      className={styles.input}
                      value={form.availability}
                      onChange={(e) => definir('availability', e.target.value)}
                    >
                      <option value="">Selecione…</option>
                      {AVAILABILITY_OPTIONS.map((opcao) => (
                        <option key={opcao.value} value={opcao.value}>
                          {opcao.label}
                        </option>
                      ))}
                    </select>
                  </Campo>

                  <Campo
                    id="ap-salaryExpectation"
                    label="Pretensão salarial"
                    ajuda="Opcional. Valor mensal bruto em Dobras."
                    erro={errosVisiveis.salaryExpectation}
                  >
                    <input
                      id="ap-salaryExpectation"
                      className={styles.input}
                      inputMode="numeric"
                      value={form.salaryExpectation}
                      maxLength={APPLICATION_FORM_LIMITS.salaryExpectation}
                      onChange={(e) =>
                        definir(
                          'salaryExpectation',
                          e.target.value.replace(/[^\d]/g, ''),
                        )
                      }
                    />
                  </Campo>

                  <Campo
                    id="ap-referralSource"
                    label="Como soube desta vaga"
                    erro={errosVisiveis.referralSource}
                  >
                    <select
                      id="ap-referralSource"
                      className={styles.input}
                      value={form.referralSource}
                      onChange={(e) =>
                        definir('referralSource', e.target.value)
                      }
                    >
                      <option value="">Selecione…</option>
                      {REFERRAL_SOURCE_OPTIONS.map((opcao) => (
                        <option key={opcao.value} value={opcao.value}>
                          {opcao.label}
                        </option>
                      ))}
                    </select>
                  </Campo>
                </div>
              </>
            ) : null}

            {passo === 3 ? (
              <>
                <p className={styles.sectionHint}>
                  As referências são opcionais. Indique apenas pessoas que
                  autorizaram ser contactadas; a empresa só as contacta se
                  avançar com a sua candidatura.
                </p>
                {referencias.map((item, indice) => (
                  <fieldset key={indice} className={styles.fieldset}>
                    <legend className={styles.legend}>
                      Referência {indice + 1}
                      <span className={styles.optional}> (opcional)</span>
                    </legend>
                    <div className={styles.grid}>
                      <input
                        className={styles.input}
                        placeholder="Nome"
                        aria-label={`Nome da referência ${indice + 1}`}
                        value={item.name || ''}
                        maxLength={APPLICATION_FORM_LIMITS.referenceName}
                        onChange={(e) =>
                          definirEmLista(
                            'references',
                            indice,
                            'name',
                            e.target.value,
                          )
                        }
                      />
                      <input
                        className={styles.input}
                        placeholder="Cargo"
                        aria-label={`Cargo da referência ${indice + 1}`}
                        value={item.role || ''}
                        maxLength={APPLICATION_FORM_LIMITS.referenceRole}
                        onChange={(e) =>
                          definirEmLista(
                            'references',
                            indice,
                            'role',
                            e.target.value,
                          )
                        }
                      />
                      <input
                        className={styles.input}
                        placeholder="Empresa"
                        aria-label={`Empresa da referência ${indice + 1}`}
                        value={item.company || ''}
                        maxLength={APPLICATION_FORM_LIMITS.referenceCompany}
                        onChange={(e) =>
                          definirEmLista(
                            'references',
                            indice,
                            'company',
                            e.target.value,
                          )
                        }
                      />
                      <input
                        className={styles.input}
                        placeholder="Email ou telefone"
                        aria-label={`Contacto da referência ${indice + 1}`}
                        value={item.contact || ''}
                        maxLength={APPLICATION_FORM_LIMITS.referenceContact}
                        onChange={(e) =>
                          definirEmLista(
                            'references',
                            indice,
                            'contact',
                            e.target.value,
                          )
                        }
                      />
                    </div>
                  </fieldset>
                ))}
                {errosVisiveis.references ? (
                  <p className={styles.fieldError} role="alert">
                    {errosVisiveis.references}
                  </p>
                ) : null}
              </>
            ) : null}

            {passo === 4 ? (
              <>
                {documentRequirements.length ? (
                  <fieldset className={styles.fieldset}>
                    <legend className={styles.legend}>
                      Documentos exigidos por esta vaga
                    </legend>
                    {documentRequirements.map((requisito) => {
                      const entregue = form.documents?.[requisito.id];
                      const ficheiros = Array.isArray(entregue)
                        ? entregue
                        : entregue
                          ? [entregue]
                          : [];

                      return (
                        <div key={requisito.id} className={styles.docRow}>
                          <div className={styles.docCopy}>
                            <strong className={styles.docLabel}>
                              {requisito.label}
                              {requisito.needsUpload ? (
                                <span className={styles.required}> *</span>
                              ) : null}
                            </strong>
                            {requisito.satisfiedByProfile ? (
                              <span className={styles.docFromProfile}>
                                ✓ {requisito.reason}
                              </span>
                            ) : (
                              <span className={styles.docHint}>
                                {requisito.reason || requisito.hint}
                              </span>
                            )}
                            {ficheiros.map((ficheiro, indice) => (
                              <span key={indice} className={styles.docFile}>
                                📎 {ficheiro.name}
                              </span>
                            ))}
                          </div>

                          {requisito.needsUpload ? (
                            <label className={styles.docUpload}>
                              <span className={styles.ghostButton}>
                                {aCarregar === requisito.id
                                  ? 'A enviar…'
                                  : ficheiros.length
                                    ? 'Substituir'
                                    : 'Escolher ficheiro'}
                              </span>
                              <input
                                type="file"
                                className={styles.visuallyHidden}
                                accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                                disabled={Boolean(aCarregar)}
                                aria-label={`Enviar ${requisito.label}`}
                                onChange={async (evento) => {
                                  const ficheiro = evento.target.files?.[0];
                                  evento.target.value = '';
                                  if (!ficheiro || !onUploadDocument) return;

                                  setErroUpload('');
                                  setACarregar(requisito.id);
                                  try {
                                    const enviado = await onUploadDocument(
                                      requisito.id,
                                      ficheiro,
                                    );
                                    if (enviado) {
                                      const anteriores =
                                        requisito.id === 'certificates'
                                          ? [...ficheiros, enviado]
                                          : enviado;
                                      onChange({
                                        ...form,
                                        documents: {
                                          ...form.documents,
                                          [requisito.id]: anteriores,
                                        },
                                      });
                                    }
                                  } catch (erro) {
                                    setErroUpload(
                                      erro?.message ||
                                        'Não foi possível enviar o ficheiro.',
                                    );
                                  } finally {
                                    setACarregar('');
                                  }
                                }}
                              />
                            </label>
                          ) : null}
                        </div>
                      );
                    })}
                    {erroUpload ? (
                      <p className={styles.fieldError} role="alert">
                        {erroUpload}
                      </p>
                    ) : null}
                    {errosVisiveis.documents ? (
                      <p className={styles.fieldError} role="alert">
                        {errosVisiveis.documents}
                      </p>
                    ) : null}
                    {documentosEmFalta.length ? (
                      <p className={styles.sectionHint} aria-live="polite">
                        A empresa pede: {documentosEmFalta.join(', ')}. Pode
                        candidatar-se na mesma; a empresa verá que estes
                        documentos não foram enviados.
                      </p>
                    ) : null}
                  </fieldset>
                ) : null}

                <fieldset className={styles.fieldset}>
                  <legend className={styles.legend}>Declaração</legend>
                  <label className={styles.check}>
                    <input
                      type="checkbox"
                      checked={form.consentTruthful}
                      onChange={(e) =>
                        definir('consentTruthful', e.target.checked)
                      }
                    />
                    <span>
                      Confirmo que toda a informação prestada é verdadeira e
                      completa.<span className={styles.required}> *</span>
                    </span>
                  </label>
                  {errosVisiveis.consentTruthful ? (
                    <p className={styles.fieldError} role="alert">
                      {errosVisiveis.consentTruthful}
                    </p>
                  ) : null}

                  <label className={styles.check}>
                    <input
                      type="checkbox"
                      checked={form.consentDataProcessing}
                      onChange={(e) =>
                        definir('consentDataProcessing', e.target.checked)
                      }
                    />
                    <span>
                      Autorizo que os meus dados sejam partilhados com esta
                      empresa para efeitos de recrutamento.
                      <span className={styles.required}> *</span>
                    </span>
                  </label>
                  {errosVisiveis.consentDataProcessing ? (
                    <p className={styles.fieldError} role="alert">
                      {errosVisiveis.consentDataProcessing}
                    </p>
                  ) : null}

                  <label className={styles.check}>
                    <input
                      type="checkbox"
                      checked={form.consentSimilarJobs}
                      onChange={(e) =>
                        definir('consentSimilarJobs', e.target.checked)
                      }
                    />
                    <span>
                      Aceito ser contactado sobre vagas semelhantes desta
                      empresa.
                    </span>
                  </label>
                </fieldset>

                {mostrarErros && totalErros > 0 ? (
                  <p className={styles.summaryError} role="alert">
                    Faltam {totalErros} campo{totalErros === 1 ? '' : 's'} por
                    preencher noutros passos.
                  </p>
                ) : null}
              </>
            ) : null}

            {errorMessage ? (
              <p className={styles.submitError} role="alert">
                {errorMessage}
              </p>
            ) : null}
          </div>

          <footer className={styles.footer}>
            <div className={styles.footerMeta}>{draftStatus}</div>
            <div className={styles.footerActions}>
              {passo > 0 ? (
                <button
                  type="button"
                  className={styles.secondaryButton}
                  onClick={recuar}
                  disabled={submitting}
                >
                  Voltar
                </button>
              ) : (
                <button
                  type="button"
                  className={styles.secondaryButton}
                  onClick={onClose}
                  disabled={submitting}
                >
                  Cancelar
                </button>
              )}

              {ultimoPasso ? (
                <button
                  type="submit"
                  className={styles.primaryButton}
                  disabled={submitting}
                  aria-busy={submitting}
                >
                  {submitting ? 'A enviar…' : 'Enviar candidatura'}
                </button>
              ) : (
                <button
                  type="button"
                  className={styles.primaryButton}
                  onClick={avancar}
                >
                  Seguinte
                </button>
              )}
            </div>
          </footer>
        </form>
      </div>
    </div>
  );
}
