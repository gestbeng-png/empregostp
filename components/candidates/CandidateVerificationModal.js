import { useEffect, useRef, useState } from 'react';

import {
  MAX_COMPETENCY_LINKS,
  MAX_COMPETENCY_LINK_DESCRIPTION,
  MAX_COMPETENCY_LINK_URL,
  validateCompetencyLinks,
} from '../../lib/candidateVerificationLinks';
import styles from '../../styles/CandidateVerificationModal.module.css';

export default function CandidateVerificationModal({
  profile,
  verificationIncluded = false,
  onClose,
  onPremium,
  onSubmit,
}) {
  const [step, setStep] = useState('choice');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [values, setValues] = useState({
    email: profile?.email || '',
    phone: profile?.phone || '',
    skills: '',
    experience: '',
    education: profile?.education || '',
    links: [
      {
        id: 0,
        url: profile?.website || profile?.linkedin || '',
        description: '',
      },
    ],
    proof: null,
  });
  const nextLinkId = useRef(1);
  const linkToFocus = useRef(null);
  const addLinkButton = useRef(null);
  const panel = useRef(null);
  const initialFocus = useRef(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  const busyRef = useRef(false);
  busyRef.current = busy;

  useEffect(() => {
    const previous = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    initialFocus.current?.focus();
    const onKeyDown = (event) => {
      if (event.key === 'Escape' && !busyRef.current) {
        event.preventDefault();
        closeRef.current();
      }
      if (event.key !== 'Tab') return;
      const controls = [
        ...(panel.current?.querySelectorAll(
          'button:not(:disabled), input:not(:disabled), textarea:not(:disabled), a[href]',
        ) || []),
      ];
      const first = controls[0];
      const last = controls[controls.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', onKeyDown);
      previous?.focus?.();
    };
  }, []);
  useEffect(() => {
    if (step === 'form') panel.current?.querySelector('input')?.focus();
  }, [step]);
  useEffect(() => {
    if (linkToFocus.current === null) return;
    panel.current
      ?.querySelector(`#competency-link-description-${linkToFocus.current}`)
      ?.focus();
    linkToFocus.current = null;
  }, [values.links]);

  const set = (name, value) =>
    setValues((current) => ({ ...current, [name]: value }));
  const setLink = (id, name, value) =>
    setValues((current) => ({
      ...current,
      links: current.links.map((link) =>
        link.id === id ? { ...link, [name]: value } : link,
      ),
    }));
  const addLink = () => {
    const id = nextLinkId.current++;
    linkToFocus.current = id;
    setValues((current) =>
      current.links.length >= MAX_COMPETENCY_LINKS
        ? current
        : {
            ...current,
            links: [...current.links, { id, url: '', description: '' }],
          },
    );
  };
  const removeLink = (id) => {
    setValues((current) => ({
      ...current,
      links: current.links.filter((link) => link.id !== id),
    }));
    addLinkButton.current?.focus();
  };
  const submit = async (event) => {
    event.preventDefault();
    if (busyRef.current) return;
    setError('');
    if (!profile?.cvUrl) {
      setError('Adicione o seu CV em Meu perfil antes de enviar o pedido.');
      return;
    }
    if (
      values.skills.trim().length < 20 ||
      values.experience.trim().length < 30
    ) {
      setError(
        'Descreva as suas competências (mínimo 20 caracteres) e experiência (mínimo 30 caracteres).',
      );
      return;
    }
    const validatedLinks = validateCompetencyLinks(values.links);
    if (validatedLinks.error) {
      setError(validatedLinks.error);
      return;
    }
    if (!validatedLinks.links.length && !values.proof) {
      setError('Inclua um link profissional ou anexe um comprovativo.');
      return;
    }
    if (
      values.proof &&
      (values.proof.size >= 10 * 1024 * 1024 ||
        !['application/pdf', 'image/jpeg', 'image/png', 'image/webp'].includes(
          values.proof.type,
        ))
    ) {
      setError(
        'O comprovativo deve ser PDF, JPG, PNG ou WebP com menos de 10 MB.',
      );
      return;
    }
    busyRef.current = true;
    setBusy(true);
    try {
      await onSubmit({ ...values, links: validatedLinks.links });
      closeRef.current();
    } catch (failure) {
      setError(
        failure.message || 'Não foi possível enviar o pedido. Tente novamente.',
      );
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  };

  return (
    <div className={styles.overlay} onClick={() => !busy && onClose()}>
      <section
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby="verification-choice-title"
        aria-busy={busy}
        className={styles.panel}
        onClick={(event) => event.stopPropagation()}
      >
        <header className={styles.header}>
          <div>
            <h2 id="verification-choice-title">
              {step === 'choice'
                ? 'Como quer verificar o seu perfil?'
                : 'Provar as minhas competências'}
            </h2>
            <p>
              {step === 'choice'
                ? 'Escolha a opção que faz sentido para si.'
                : 'A equipa analisa o seu percurso e os comprovativos antes de atribuir o selo.'}
            </p>
          </div>
          <button
            ref={initialFocus}
            type="button"
            disabled={busy}
            onClick={onClose}
            aria-label="Fechar modal"
          >
            ×
          </button>
        </header>
        {step === 'choice' ? (
          <div className={styles.choices}>
            <button
              type="button"
              className={styles.choice}
              onClick={() => setStep('form')}
            >
              <span className={styles.tag}>
                Sem custo · sujeito a aprovação
              </span>
              <strong>Provar as minhas competências</strong>
              <span>
                Envie a sua experiência, formação e comprovativos para avaliação
                do administrador.
              </span>
              <span className={styles.action}>Preencher pedido →</span>
            </button>
            <button type="button" className={styles.choice} onClick={onPremium}>
              <span className={styles.tag}>
                {verificationIncluded
                  ? 'Incluído no seu plano'
                  : 'Plano Premium'}
              </span>
              <strong>
                {verificationIncluded
                  ? 'Usar a verificação do meu plano'
                  : 'Tornar-me verificado com Premium'}
              </strong>
              <span>
                {verificationIncluded
                  ? 'A verificação documental já está incluída, sem pagamento adicional. Envie os documentos para análise da equipa.'
                  : 'Ative o Premium com verificação do perfil incluída, sem pagamento adicional por este serviço.'}
              </span>
              <span className={styles.action}>
                {verificationIncluded ? 'Enviar documentos →' : 'Ver planos →'}
              </span>
            </button>
          </div>
        ) : (
          <form onSubmit={submit} className={styles.form}>
            <fieldset disabled={busy}>
              <label htmlFor="competency-email">Email de contacto</label>
              <input
                id="competency-email"
                type="email"
                required
                maxLength={254}
                value={values.email}
                onChange={(e) => set('email', e.target.value)}
              />
              <label htmlFor="competency-phone">Telefone</label>
              <input
                id="competency-phone"
                type="tel"
                required
                maxLength={30}
                value={values.phone}
                onChange={(e) => set('phone', e.target.value)}
              />
              <label htmlFor="competency-skills">
                Competências e exemplos de trabalhos
              </label>
              <textarea
                id="competency-skills"
                required
                minLength={20}
                maxLength={4000}
                rows={3}
                value={values.skills}
                onChange={(e) => set('skills', e.target.value)}
              />
              <label htmlFor="competency-experience">
                Experiência profissional e projetos
              </label>
              <textarea
                id="competency-experience"
                required
                minLength={30}
                maxLength={4000}
                rows={3}
                value={values.experience}
                onChange={(e) => set('experience', e.target.value)}
              />
              <label htmlFor="competency-education">
                Formação e certificações (opcional)
              </label>
              <textarea
                id="competency-education"
                maxLength={3000}
                rows={2}
                value={values.education}
                onChange={(e) => set('education', e.target.value)}
              />
              <section
                aria-labelledby="competency-links-title"
                className={styles.links}
              >
                <h3 id="competency-links-title">
                  Links para comprovar competências
                </h3>
                <p>
                  Adicione até {MAX_COMPETENCY_LINKS} links de portefólio,
                  LinkedIn ou trabalhos realizados. Pode explicar brevemente o
                  que cada link demonstra.
                </p>
                {values.links.map((link, index) => (
                  <div
                    key={link.id}
                    className={styles.linkEntry}
                    role="group"
                    aria-label={`Prova ${index + 1}`}
                  >
                    <label htmlFor={`competency-link-description-${link.id}`}>
                      Breve descrição do link {index + 1} (opcional)
                    </label>
                    <textarea
                      id={`competency-link-description-${link.id}`}
                      rows={2}
                      maxLength={MAX_COMPETENCY_LINK_DESCRIPTION}
                      placeholder="Ex.: Projeto de gestão de stock que desenvolvi."
                      value={link.description}
                      onChange={(e) =>
                        setLink(link.id, 'description', e.target.value)
                      }
                    />
                    <label htmlFor={`competency-link-url-${link.id}`}>
                      Link de prova {index + 1}
                    </label>
                    <input
                      id={`competency-link-url-${link.id}`}
                      type="url"
                      maxLength={MAX_COMPETENCY_LINK_URL}
                      placeholder="https://"
                      value={link.url}
                      onChange={(e) => setLink(link.id, 'url', e.target.value)}
                    />
                    <button
                      type="button"
                      className={styles.removeLink}
                      aria-label={`Remover link ${index + 1}`}
                      onClick={() => removeLink(link.id)}
                    >
                      Remover link
                    </button>
                  </div>
                ))}
                <button
                  ref={addLinkButton}
                  type="button"
                  onClick={addLink}
                  disabled={values.links.length >= MAX_COMPETENCY_LINKS}
                >
                  Adicionar link
                </button>
              </section>
              <label htmlFor="competency-proof">
                Comprovativo (alternativa aos links)
              </label>
              <input
                id="competency-proof"
                type="file"
                accept=".pdf,.jpg,.jpeg,.png,.webp"
                onChange={(e) => set('proof', e.target.files?.[0] || null)}
              />
              <p>
                PDF ou imagem até 10 MB. O CV guardado no seu perfil acompanha o
                pedido.
              </p>
            </fieldset>
            {!profile?.cvUrl && (
              <p role="status">
                Adicione o seu CV em Meu perfil para concluir o envio.
              </p>
            )}
            {error && <p role="alert">{error}</p>}
            <footer className={styles.footer}>
              <button
                type="button"
                disabled={busy}
                onClick={() => setStep('choice')}
              >
                Voltar
              </button>
              <button
                type="submit"
                className={styles.primary}
                disabled={busy || !profile?.cvUrl}
              >
                {busy ? 'A enviar pedido…' : 'Enviar para análise'}
              </button>
            </footer>
          </form>
        )}
      </section>
    </div>
  );
}
