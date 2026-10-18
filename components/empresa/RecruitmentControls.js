import { useCallback, useEffect, useRef, useState } from 'react';
import {
  downloadCalendar,
  safeSignedUrl,
  apiRequest,
} from '../../lib/apiClient';
import styles from '../../styles/RecruitmentWorkspace.module.css';

export const idPath = (value) => encodeURIComponent(value);
export function useAction(request = apiRequest) {
  const lock = useRef(false);
  const alive = useRef(true);
  const keys = useRef(new Map());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  const run = useCallback(
    async (path, options = {}, after) => {
      if (lock.current) return;
      lock.current = true;
      setBusy(true);
      setError('');
      setNotice('');
      const fingerprint = `${path}:${JSON.stringify(options.body || {})}`;
      try {
        let key;
        if (options.method && options.method !== 'GET') {
          key =
            keys.current.get(fingerprint) ||
            Array.from(crypto.getRandomValues(new Uint8Array(16)), (byte) =>
              byte.toString(16).padStart(2, '0'),
            ).join('');
          keys.current.set(fingerprint, key);
        }
        const value = await request(path, {
          ...options,
          ...(key ? { key } : {}),
        });
        keys.current.delete(fingerprint);
        if (alive.current) {
          // Só as escritas confirmam; uma leitura não precisa de aviso.
          if (options.method && options.method !== 'GET')
            setNotice('Alterações guardadas.');
          after?.(value);
        }
        return value;
      } catch (err) {
        if (alive.current) setError(err?.message || 'Tente novamente.');
      } finally {
        lock.current = false;
        if (alive.current) setBusy(false);
      }
    },
    [request],
  );
  return { busy, error, notice, run };
}
export function ActionStatus({ action }) {
  return (
    <>
      {action.error ? (
        <p className={styles.error} role="alert">
          {action.error}
        </p>
      ) : null}
      {action.notice ? <p role="status">{action.notice}</p> : null}
    </>
  );
}

/**
 * All writes are explicit form submissions, with synchronous double-click protection.
 * `showWhen` mostra um campo só quando outro tem um valor (ex.: o motivo só
 * quando o novo estado é «Não selecionada»); `placeholder` acrescenta uma
 * primeira opção vazia a um select.
 * @param {{title: string, path: string, method?: string, fields?: Array<{name: string, label: string, type?: string, options?: string[][], value?: string | number | string[], multiple?: boolean, required?: boolean, min?: number, max?: number, maxLength?: number, placeholder?: string, showWhen?: {field: string, equals: string}}>, buildBody?: (values: Record<string, any>) => Record<string, unknown>, onSuccess?: (value: any) => void, confirmText?: string, request?: typeof apiRequest, submit?: string, onBusyChange?: (busy: boolean) => void, resetOnSuccess?: boolean, disabled?: boolean}} props
 */
export function ActionForm({
  title,
  path,
  method = 'POST',
  fields = [],
  buildBody,
  onSuccess,
  confirmText,
  request,
  submit = 'Guardar',
  onBusyChange,
  resetOnSuccess = false,
  disabled = false,
}) {
  const action = useAction(request);
  const [watched, setWatched] = useState(() =>
    Object.fromEntries(
      fields.map((field) => [
        field.name,
        String(
          field.value ??
            (field.options && !field.placeholder
              ? field.options[0]?.[0]
              : '') ??
            '',
        ),
      ]),
    ),
  );
  useEffect(() => {
    onBusyChange?.(action.busy);
  }, [action.busy, onBusyChange]);
  const visible = (field) =>
    !field.showWhen || watched[field.showWhen.field] === field.showWhen.equals;
  return (
    <form
      className={styles.form}
      aria-label={title}
      onChange={(event) => {
        const { name, value } = event.target;
        if (name) setWatched((current) => ({ ...current, [name]: value }));
      }}
      onSubmit={(event) => {
        event.preventDefault();
        if (disabled) return;
        if (!event.currentTarget.checkValidity()) return;
        const form = event.currentTarget;
        const formData = new FormData(form);
        const values = Object.fromEntries(formData);
        for (const field of fields) {
          if (field.multiple) values[field.name] = formData.getAll(field.name);
        }
        delete values._confirmed;
        const body = buildBody ? buildBody(values) : values;
        void action.run(path, { method, body }, (value) => {
          if (resetOnSuccess) form.reset();
          onSuccess?.(value);
        });
      }}
    >
      <h3>{title}</h3>
      {fields.filter(visible).map((field) => (
        <label key={field.name}>
          {field.label}
          {field.options ? (
            <select
              className="form-select"
              name={field.name}
              multiple={field.multiple}
              defaultValue={field.value}
              required={field.required}
              disabled={action.busy || disabled}
            >
              {field.placeholder ? (
                <option value="">{field.placeholder}</option>
              ) : null}
              {field.options.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          ) : field.type === 'textarea' ? (
            <textarea
              className="form-textarea"
              name={field.name}
              defaultValue={field.value || ''}
              maxLength={field.maxLength}
              required={field.required}
              disabled={action.busy || disabled}
            />
          ) : (
            <input
              className="form-input"
              name={field.name}
              type={field.type || 'text'}
              defaultValue={field.value}
              min={field.min}
              max={field.max}
              maxLength={field.maxLength}
              required={field.required}
              disabled={action.busy || disabled}
            />
          )}
        </label>
      ))}
      {confirmText ? (
        <label className={styles.confirm}>
          <input
            type="checkbox"
            name="_confirmed"
            required
            disabled={action.busy || disabled}
          />
          <span>{confirmText}</span>
        </label>
      ) : null}
      <button
        className="btn btn-primary"
        disabled={action.busy || disabled}
        type="submit"
      >
        {action.busy ? 'A processar…' : submit}
      </button>
      <ActionStatus action={action} />
    </form>
  );
}

export const interviewFields = [
  {
    name: 'type',
    label: 'Tipo de entrevista',
    options: [
      ['PRESENCIAL', 'Presencial'],
      ['VIDEO', 'Videochamada'],
      ['TELEFONE', 'Telefone'],
    ],
  },
  {
    name: 'startsAt',
    label: 'Data e hora (São Tomé, UTC)',
    type: 'datetime-local',
    required: true,
  },
  {
    name: 'durationMin',
    label: 'Duração em minutos',
    type: 'number',
    min: 15,
    max: 240,
    value: 30,
    required: true,
  },
  {
    name: 'location',
    label: 'Local (obrigatório em entrevista presencial)',
    maxLength: 300,
  },
  {
    name: 'meetingUrl',
    label: 'Ligação HTTPS (obrigatória em videochamada)',
    type: 'url',
  },
  {
    name: 'candidateMessage',
    label: 'Mensagem visível ao candidato',
    type: 'textarea',
    maxLength: 1000,
  },
];
export const interviewBody = (values) => ({
  ...values,
  startsAt: `${values.startsAt}:00Z`,
  durationMin: Number(values.durationMin),
  timezone: 'Africa/Sao_Tome',
  interviewerUserIds: [],
});

/** @param {{interview: Record<string, any>, candidate?: boolean, onSuccess?: (value: any) => void, request?: typeof apiRequest}} props */
export function InterviewControls({
  interview,
  candidate = false,
  onSuccess,
  request,
}) {
  const calendar = useAction(request);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(timer);
  }, []);
  const active = ['SCHEDULED', 'CONFIRMED', 'RESCHEDULE_REQUESTED'].includes(
    interview.status,
  );
  const base = `/api/interviews/${idPath(interview.id)}`;
  return (
    <section
      className={styles.panel}
      aria-label={`Entrevista ${interview.when || interview.id}`}
    >
      <h3>{interview.when || 'Entrevista'}</h3>
      <p>
        {interview.status} · {interview.type}
      </p>
      {interview.location ? <p>{interview.location}</p> : null}
      {safeSignedUrl(interview.meetingUrl) ? (
        <a
          href={interview.meetingUrl}
          target="_blank"
          rel="noopener noreferrer"
        >
          Abrir videochamada
        </a>
      ) : null}
      {interview.candidateMessage ? <p>{interview.candidateMessage}</p> : null}
      <button
        className="btn btn-ghost"
        type="button"
        disabled={calendar.busy}
        onClick={() =>
          calendar.run(`${base}/ics`, { file: true }, downloadCalendar)
        }
      >
        Adicionar ao calendário
      </button>
      <ActionStatus action={calendar} />
      {candidate && interview.status === 'SCHEDULED' ? (
        <ActionForm
          title="Confirmar presença"
          path={`${base}/confirm`}
          request={request}
          onSuccess={onSuccess}
          submit="Confirmar presença"
        />
      ) : null}
      {candidate && ['SCHEDULED', 'CONFIRMED'].includes(interview.status) ? (
        <ActionForm
          title="Pedir reagendamento"
          path={`${base}/request-reschedule`}
          request={request}
          onSuccess={onSuccess}
          fields={[
            {
              name: 'proposal',
              label: 'Proposta de horário',
              required: true,
              maxLength: 500,
            },
          ]}
          submit="Enviar proposta"
        />
      ) : null}
      {!candidate && interview.canManage && active ? (
        <details>
          <summary>Reagendar entrevista</summary>
          <ActionForm
            title="Novo horário"
            path={`${base}/reschedule`}
            fields={interviewFields}
            buildBody={interviewBody}
            request={request}
            onSuccess={onSuccess}
            submit="Confirmar novo horário"
          />
        </details>
      ) : null}
      {active && (candidate || interview.canManage) ? (
        <details>
          <summary>Cancelar entrevista</summary>
          <ActionForm
            title="Cancelamento da entrevista"
            path={`${base}/cancel`}
            fields={[
              {
                name: 'reason',
                label: 'Motivo do cancelamento',
                maxLength: 500,
              },
            ]}
            confirmText="Confirmo o cancelamento desta entrevista."
            request={request}
            onSuccess={onSuccess}
            submit="Cancelar entrevista"
          />
        </details>
      ) : null}
      {!candidate &&
      interview.canManage &&
      ['SCHEDULED', 'CONFIRMED'].includes(interview.status) &&
      Date.parse(interview.startsAt) <= now ? (
        <div className={styles.grid}>
          {[
            ['complete', 'Concluir entrevista'],
            ['no-show', 'Registar falta'],
          ].map(([path, title]) => (
            <ActionForm
              key={path}
              title={title}
              path={`${base}/${path}`}
              request={request}
              onSuccess={onSuccess}
              confirmText={`Confirmo: ${title.toLowerCase()}.`}
              submit={title}
            />
          ))}
        </div>
      ) : null}
      {!candidate && interview.canFeedback ? (
        <details>
          <summary>Feedback interno</summary>
          <ActionForm
            title="Avaliação da entrevista"
            path={`${base}/feedback`}
            request={request}
            onSuccess={onSuccess}
            fields={[
              {
                name: 'recommendation',
                label: 'Recomendação',
                options: [
                  ['AVANCAR', 'Avançar'],
                  ['DUVIDA', 'Dúvida'],
                  ['NAO_AVANCAR', 'Não avançar'],
                ],
              },
              {
                name: 'notes',
                label: 'Notas internas (nunca visíveis ao candidato)',
                type: 'textarea',
                maxLength: 2000,
              },
            ]}
          />
        </details>
      ) : null}
    </section>
  );
}
