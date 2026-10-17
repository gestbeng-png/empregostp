import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { APPLICATION_TRANSITIONS } from '../../domain/applications/states';
import { actorMatches } from '../../domain/lifecycle/states';
import {
  candidateStatusLabel,
  CLOSED_REASONS,
} from '../../domain/applications/candidateView';
import { CLOSE_OUTCOMES } from '../../domain/applications/jobEnd';
import {
  closedReasonOptions,
  jobStatusLabel,
  recruitmentDate,
  teamRoleLabel,
} from '../../lib/recruitmentLabels';
import TeamWorkspace, { MessageTemplates } from './TeamWorkspace';
import { safeSignedUrl, apiRequest } from '../../lib/apiClient';
import {
  ActionForm,
  ActionStatus,
  InterviewControls,
  interviewFields,
  interviewBody,
  idPath,
  useAction,
} from './RecruitmentControls';
import styles from '../../styles/RecruitmentWorkspace.module.css';

const actorRole = (role) =>
  role === 'ADMIN' ? 'ORG_ADMIN' : role === 'REVIEWER' ? 'ORG_REVIEWER' : role;
const outcomeLabels = {
  HIRED_VIA_EMPREGOSTP: 'Contratado via EmpregoSTP',
  HIRED_OTHER_CHANNEL: 'Contratado por outro canal',
  NO_SUITABLE_CANDIDATE: 'Sem candidato adequado',
  POSITION_CANCELLED: 'Posição cancelada',
  POSITION_ON_HOLD: 'Posição suspensa',
  OTHER: 'Outro resultado',
};

/** R24/R88 — responsável pela análise de uma ou várias candidaturas. */
function AssignForm({
  title,
  organizationId,
  applicationIds,
  people,
  current = '',
  request,
  onSuccess,
  submit = 'Guardar responsável',
}) {
  return (
    <ActionForm
      key={`${applicationIds.join(',')}-${current}`}
      title={title}
      path="/api/applications/assignments"
      request={request}
      onSuccess={onSuccess}
      submit={submit}
      fields={[
        {
          name: 'assigneeUserId',
          label: 'Pessoa da equipa',
          placeholder: 'Sem responsável (fila comum)',
          options: people,
          value: current,
        },
      ]}
      buildBody={(values) => ({
        organizationId,
        applicationIds,
        assigneeUserId: values.assigneeUserId || null,
      })}
    />
  );
}

function ApplicationWorkspace({
  row,
  role,
  onChange,
  request,
  organizationId,
  people,
}) {
  const [view, setView] = useState(null);
  const [signed, setSigned] = useState(null);
  useEffect(() => {
    if (!signed) return undefined;
    const ttl = Date.parse(signed.expiresAt) - Date.now();
    if (!Number.isFinite(ttl) || ttl <= 0) {
      setSigned(null);
      return undefined;
    }
    const timer = setTimeout(() => setSigned(null), Math.min(ttl, 300_000));
    return () => clearTimeout(timer);
  }, [signed]);
  const action = useAction(request);
  const run = action.run;
  const base = `/api/applications/${idPath(row.id)}`;
  const load = useCallback(
    () =>
      run(base, {}, (value) => {
        setView(value);
        onChange();
      }),
    [run, base, onChange],
  );
  useEffect(() => {
    void load();
  }, [load]);
  const refresh = () => {
    setSigned(null);
    void load();
  };
  const transitions = (APPLICATION_TRANSITIONS[view?.status] || []).filter(
    (edge) =>
      !['OFFER', 'HIRED', 'INTERVIEW'].includes(edge.to) &&
      edge.actors.some((actor) => actorMatches(actorRole(role), actor)),
  );
  return (
    <section className={styles.panel}>
      <h2>
        {row.candidateName || 'Candidatura'} · {row.title}
      </h2>
      {!view ? (
        <button
          type="button"
          className="btn btn-primary"
          onClick={load}
          disabled={action.busy}
        >
          {action.busy
            ? 'A carregar candidatura…'
            : 'Tentar carregar candidatura'}
        </button>
      ) : null}
      <ActionStatus action={action} />
      {view ? (
        <div className={styles.detailGrid}>
          <div className={styles.detailMain}>
            <div className={styles.row}>
              <span className={styles.badge}>
                {candidateStatusLabel(view.status)}
              </span>
              <button
                type="button"
                className="btn btn-ghost"
                onClick={refresh}
                disabled={action.busy}
              >
                Atualizar
              </button>
            </div>
            <dl className={styles.snapshot}>
              <dt>Nome no momento da candidatura</dt>
              <dd>{view.candidate.fullName || row.candidateName}</dd>
              {[
                ['Título profissional', view.candidate.headline],
                ['Resumo', view.candidate.summary],
                ['Distrito', view.candidate.district],
                ['Localidade', view.candidate.locality],
                ['Disponibilidade', view.candidate.availability],
                ['Email partilhado', view.candidate.contacts?.email],
                ['Telefone partilhado', view.candidate.contacts?.phone],
                ['WhatsApp partilhado', view.candidate.contacts?.whatsapp],
                ['Competências', view.candidate.skills?.join(', ')],
                ['Formação', view.candidate.educationText],
              ]
                .filter(([, value]) => typeof value === 'string' && value)
                .map(([label, value]) => (
                  <div key={label}>
                    <dt>{label}</dt>
                    <dd
                      className={
                        label === 'Resumo' ? styles.preview : undefined
                      }
                    >
                      {value}
                    </dd>
                  </div>
                ))}
            </dl>
            {view.candidate.experiences?.length ? (
              <>
                <h3>Experiência profissional</h3>
                <ul>
                  {view.candidate.experiences.map((entry, index) => (
                    <li key={index}>
                      <strong>
                        {entry.title} · {entry.organizationName}
                      </strong>
                      <p>
                        {entry.startDate} —{' '}
                        {entry.current ? 'Atual' : entry.endDate} ·{' '}
                        {entry.location}
                      </p>
                      <p className={styles.preview}>{entry.description}</p>
                    </li>
                  ))}
                </ul>
              </>
            ) : null}
            {view.candidate.education?.length ? (
              <>
                <h3>Formação académica</h3>
                <ul>
                  {view.candidate.education.map((entry, index) => (
                    <li key={index}>
                      {entry.level} · {entry.field} · {entry.institution} ·{' '}
                      {entry.startYear} — {entry.endYear}
                    </li>
                  ))}
                </ul>
              </>
            ) : null}
            {view.candidate.languages?.length ? (
              <>
                <h3>Idiomas</h3>
                <ul>
                  {view.candidate.languages.map((entry, index) => (
                    <li key={index}>
                      {entry.language} · {entry.level}
                    </li>
                  ))}
                </ul>
              </>
            ) : null}
            {view.candidate.certifications?.length ? (
              <>
                <h3>Certificações</h3>
                <ul>
                  {view.candidate.certifications.map((entry, index) => (
                    <li key={index}>
                      {entry.name} · {entry.issuer}
                    </li>
                  ))}
                </ul>
              </>
            ) : null}
            {view.coverLetter ? (
              <>
                <h3>Carta de motivação</h3>
                <p className={styles.preview}>{view.coverLetter}</p>
              </>
            ) : null}
            {view.answers?.length ? (
              <>
                <h3>Respostas da candidatura</h3>
                <ul>
                  {view.answers.map((answer, index) => (
                    <li key={index}>
                      {typeof answer === 'string'
                        ? answer
                        : `${answer?.question || answer?.label || answer?.questionId || 'Resposta'}: ${String(answer?.answer ?? answer?.value ?? '')}`}
                    </li>
                  ))}
                </ul>
              </>
            ) : null}
            {view.hardRequirementsNotMet?.length ? (
              <>
                <h3>Requisitos declarados em falta</h3>
                <ul>
                  {view.hardRequirementsNotMet.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </>
            ) : null}
            {row.permissions.cv && view.cv.available ? (
              <div className={styles.row}>
                <button
                  className="btn btn-ghost"
                  type="button"
                  disabled={action.busy}
                  onClick={() =>
                    action.run(`${base}/cv`, {}, (value) =>
                      setSigned({
                        url: safeSignedUrl(value.url),
                        expiresAt: value.expiresAt,
                      }),
                    )
                  }
                >
                  Ver o CV enviado
                </button>
                {signed?.url ? (
                  <a
                    href={signed.url}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Abrir CV (ligação válida durante 5 minutos)
                  </a>
                ) : null}
              </div>
            ) : null}
            {view.history.length ? (
              <>
                <h3>Histórico do processo</h3>
                <ol>
                  {view.history.map((entry, index) => (
                    <li key={index}>
                      {candidateStatusLabel(entry.to, entry.closedReason)} ·{' '}
                      {recruitmentDate(entry.at)}
                      {entry.reason ? ` · ${entry.reason}` : ''}
                    </li>
                  ))}
                </ol>
              </>
            ) : null}
            {view.previousApplications?.length ? (
              <>
                <h3>Candidaturas anteriores nesta organização</h3>
                <ul>
                  {view.previousApplications.map((previous, index) => (
                    <li key={index}>
                      {previous.jobTitle} ·{' '}
                      {candidateStatusLabel(previous.outcome)} · {previous.date}
                    </li>
                  ))}
                </ul>
              </>
            ) : null}
          </div>
          <aside className={styles.detailSide} aria-label="Ações do processo">
            {row.permissions.transition &&
            !['HIRED', 'REJECTED', 'WITHDRAWN', 'OFFER_DECLINED'].includes(
              view.status,
            ) ? (
              <AssignForm
                title="Responsável pela análise"
                organizationId={organizationId}
                applicationIds={[row.id]}
                people={people}
                current={row.assigneeUserId || ''}
                request={request}
                onSuccess={onChange}
              />
            ) : row.assigneeName ? (
              <p>
                Responsável pela análise: <strong>{row.assigneeName}</strong>
              </p>
            ) : null}
            {row.permissions.notes ? (
              <>
                {view.notes.length ? (
                  <>
                    <h3>Notas internas</h3>
                    <ul>
                      {view.notes.map((note) => (
                        <li key={note.id}>{note.body}</li>
                      ))}
                    </ul>
                  </>
                ) : null}
                <ActionForm
                  title="Adicionar nota interna"
                  path={`${base}/notes`}
                  fields={[
                    {
                      name: 'body',
                      label: 'Nota (nunca visível ao candidato)',
                      type: 'textarea',
                      required: true,
                      maxLength: 2000,
                    },
                  ]}
                  onSuccess={refresh}
                  request={request}
                />
                <p>
                  Avaliação média:{' '}
                  {view.internals.averageRating ?? 'Sem avaliações'} ·
                  Etiquetas: {view.internals.tags.join(', ') || 'Sem etiquetas'}
                </p>
                <ActionForm
                  title="Avaliação e etiquetas internas"
                  method="PATCH"
                  path={`${base}/review`}
                  request={request}
                  onSuccess={refresh}
                  fields={[
                    {
                      name: 'rating',
                      label: 'Avaliação (1 a 5)',
                      placeholder: 'Sem avaliação',
                      options: [
                        ['1', '1'],
                        ['2', '2'],
                        ['3', '3'],
                        ['4', '4'],
                        ['5', '5'],
                      ],
                    },
                    {
                      name: 'tags',
                      label: 'Etiquetas separadas por vírgulas',
                      value: view.internals.tags.join(', '),
                    },
                  ]}
                  buildBody={(values) => ({
                    ...(values.rating ? { rating: Number(values.rating) } : {}),
                    tags: values.tags
                      .split(',')
                      .map((tag) => tag.trim())
                      .filter(Boolean),
                  })}
                />
              </>
            ) : null}
            {row.permissions.transition && transitions.length ? (
              <ActionForm
                key={`transition-${view.version}`}
                title="Alterar estado"
                path={`${base}/transition`}
                request={request}
                onSuccess={refresh}
                fields={[
                  {
                    name: 'to',
                    label: 'Novo estado',
                    options: transitions.map((edge) => [
                      edge.to,
                      edge.to === 'SHORTLISTED'
                        ? 'Pré-seleção interna'
                        : candidateStatusLabel(edge.to),
                    ]),
                  },
                  {
                    name: 'closedReason',
                    label: 'Motivo da não seleção',
                    options: closedReasonOptions(CLOSED_REASONS),
                    showWhen: { field: 'to', equals: 'REJECTED' },
                  },
                  {
                    name: 'reason',
                    label: 'Motivo da mudança (obrigatório em recuos)',
                    maxLength: 1000,
                  },
                  {
                    name: 'candidateVisibleNote',
                    label: 'Mensagem visível ao candidato',
                    type: 'textarea',
                    maxLength: 1000,
                  },
                ]}
                buildBody={(values) => ({
                  to: values.to,
                  ...(values.to === 'REJECTED'
                    ? { closedReason: values.closedReason }
                    : {}),
                  ...(values.reason.trim()
                    ? { reason: values.reason.trim() }
                    : {}),
                  ...(values.candidateVisibleNote.trim()
                    ? {
                        candidateVisibleNote:
                          values.candidateVisibleNote.trim(),
                      }
                    : {}),
                  expectedVersion: view.version,
                })}
                confirmText="Confirmo o novo estado e a mensagem apresentada ao candidato."
                submit="Confirmar mudança"
              />
            ) : null}
            {row.permissions.interview &&
            ['SUBMITTED', 'UNDER_REVIEW', 'SHORTLISTED', 'INTERVIEW'].includes(
              view.status,
            ) ? (
              <details>
                <summary>Marcar entrevista</summary>
                <ActionForm
                  title="Nova entrevista"
                  path={`${base}/interviews`}
                  fields={interviewFields}
                  buildBody={interviewBody}
                  request={request}
                  onSuccess={refresh}
                  submit="Marcar entrevista"
                />
              </details>
            ) : null}
            {row.permissions.hire &&
            !['HIRED', 'REJECTED', 'WITHDRAWN', 'DRAFT'].includes(
              view.status,
            ) ? (
              <details>
                <summary>Confirmar contratação</summary>
                <ActionForm
                  title="Contratação do candidato"
                  path={`${base}/hire`}
                  fields={[
                    {
                      name: 'startDate',
                      label: 'Data de início',
                      type: 'date',
                      required: true,
                    },
                  ]}
                  confirmText="Confirmo que esta contratação ocorreu."
                  request={request}
                  onSuccess={refresh}
                  submit="Confirmar contratação"
                />
              </details>
            ) : null}
          </aside>
        </div>
      ) : null}
    </section>
  );
}

function BulkActions({ ids, onSuccess, request, onPendingChange }) {
  const [preview, setPreview] = useState(null);
  const [preparing, setPreparing] = useState(false);
  const [remaining, setRemaining] = useState(0);
  const action = useAction(request);
  useEffect(() => {
    onPendingChange(Boolean(preview || preparing || action.busy));
  }, [preview, preparing, action.busy, onPendingChange]);
  useEffect(() => () => onPendingChange(false), [onPendingChange]);
  useEffect(() => {
    if (!preview) return undefined;
    const tick = () =>
      setRemaining(
        Math.max(
          0,
          Math.ceil((Date.parse(preview.executeAfter) - Date.now()) / 1000),
        ),
      );
    tick();
    const timer = setInterval(tick, 500);
    return () => clearInterval(timer);
  }, [preview]);
  return (
    <section className={styles.panel}>
      <h2>Ação em lote · {preview?.count ?? ids.length} selecionadas</h2>
      {!preview ? (
        <ActionForm
          title="Preparar ação em lote"
          path="/api/bulk-actions"
          request={request}
          onSuccess={(value) => {
            setRemaining(
              Math.max(
                0,
                Math.ceil((Date.parse(value.executeAfter) - Date.now()) / 1000),
              ),
            );
            setPreview(value);
          }}
          onBusyChange={setPreparing}
          submit="Pré-visualizar ação"
          fields={[
            {
              name: 'to',
              label: 'Novo estado',
              options: [
                ['UNDER_REVIEW', 'Em análise'],
                ['SHORTLISTED', 'Pré-seleção interna'],
                ['REJECTED', 'Não selecionada'],
              ],
            },
            {
              name: 'closedReason',
              label: 'Motivo da não seleção',
              options: closedReasonOptions(CLOSED_REASONS),
              showWhen: { field: 'to', equals: 'REJECTED' },
            },
            {
              name: 'message',
              label: 'Mensagem de rejeição (vazio usa o modelo guardado)',
              type: 'textarea',
              maxLength: 1500,
            },
            ...(ids.length >= 20
              ? [
                  {
                    name: 'typedCount',
                    label: `Escreva ${ids.length} para confirmar a quantidade`,
                    required: true,
                  },
                ]
              : []),
          ]}
          buildBody={(values) => ({
            ...values,
            applicationIds: ids,
            ...(values.message.trim() ? {} : { message: undefined }),
          })}
        />
      ) : (
        <>
          <p>{preview.confirmationText}</p>
          {preview.messagePreview ? (
            <p className={styles.preview}>{preview.messagePreview}</p>
          ) : null}
          <p role="status">
            {remaining
              ? `Pode desfazer. Aguarde ${remaining} segundos para executar.`
              : 'Pronto para confirmar a execução.'}
          </p>
          <div className={styles.row}>
            <button
              className="btn btn-ghost"
              type="button"
              disabled={action.busy}
              onClick={() =>
                action.run(
                  `/api/bulk-actions/${idPath(preview.bulkId)}/cancel`,
                  { method: 'POST' },
                  () => setPreview(null),
                )
              }
            >
              Desfazer ação
            </button>
            <button
              className="btn btn-primary"
              type="button"
              disabled={action.busy || remaining > 0}
              onClick={() =>
                action.run(
                  `/api/bulk-actions/${idPath(preview.bulkId)}/execute`,
                  { method: 'POST' },
                  (value) => {
                    setPreview(null);
                    onSuccess(value);
                  },
                )
              }
            >
              Confirmar execução
            </button>
          </div>
        </>
      )}
      <ActionStatus action={action} />
    </section>
  );
}

const HIRING_ROLE_LABELS = {
  LEAD_RECRUITER: 'Responsável',
  RECRUITER: 'Recrutador',
  HIRING_MANAGER: 'Hiring Manager',
  INTERVIEWER: 'Entrevistador',
  OBSERVER: 'Observador',
};

/** R7/R14/R15/R63 — «Equipa deste recrutamento». */
function HiringTeamPanel({ job, candidates, request, onSuccess }) {
  const team = job.hiringTeam;
  if (!team) return null;
  const nameOf = (userId) =>
    team.members.find((member) => member.userId === userId)?.name ||
    'Membro da equipa';
  const others = team.members.filter(
    (member) =>
      member.role !== 'LEAD_RECRUITER' && member.role !== 'HIRING_MANAGER',
  );
  const idsFor = (role) =>
    team.members
      .filter((member) => member.role === role)
      .map((member) => member.userId);
  const people = candidates.map((person) => [
    person.userId,
    person.role
      ? `${person.name} · ${teamRoleLabel(person.role)}`
      : person.name,
  ]);
  return (
    <div className={styles.hiringTeam}>
      <dl className={styles.teamFacts}>
        <div>
          <dt>Responsável</dt>
          <dd>
            {team.leadRecruiterId
              ? nameOf(team.leadRecruiterId)
              : 'Sem responsável'}
          </dd>
        </div>
        <div>
          <dt>Hiring Manager</dt>
          <dd>
            {team.hiringManagerId
              ? nameOf(team.hiringManagerId)
              : 'Não definido'}
          </dd>
        </div>
        {others.length ? (
          <div>
            <dt>Equipa</dt>
            <dd>
              {others
                .map(
                  (member) =>
                    `${member.name} (${HIRING_ROLE_LABELS[member.role]})`,
                )
                .join(', ')}
            </dd>
          </div>
        ) : null}
      </dl>
      {team.canManage && people.length ? (
        <details>
          <summary>Gerir a equipa desta vaga</summary>
          <ActionForm
            key={`team-${job.id}-${team.version}`}
            title="Equipa deste recrutamento"
            method="PATCH"
            path={`/api/jobs/${idPath(job.id)}/hiring-team`}
            request={request}
            onSuccess={onSuccess}
            submit="Guardar equipa"
            fields={[
              {
                name: 'leadRecruiterId',
                label: 'Responsável pelo processo',
                placeholder: 'Sem responsável',
                options: people,
                value: team.leadRecruiterId || '',
              },
              {
                name: 'hiringManagerId',
                label: 'Hiring Manager (quem precisa da contratação)',
                placeholder: 'Não definido',
                options: people,
                value: team.hiringManagerId || '',
              },
              {
                name: 'recruiterIds',
                label: 'Recrutadores',
                multiple: true,
                options: people,
                value: idsFor('RECRUITER'),
              },
              {
                name: 'interviewerIds',
                label: 'Entrevistadores',
                multiple: true,
                options: people,
                value: idsFor('INTERVIEWER'),
              },
              {
                name: 'observerIds',
                label: 'Observadores (só consulta)',
                multiple: true,
                options: people,
                value: idsFor('OBSERVER'),
              },
            ]}
            buildBody={(values) => ({
              leadRecruiterId: values.leadRecruiterId || null,
              hiringManagerId: values.hiringManagerId || null,
              recruiterIds: values.recruiterIds || [],
              interviewerIds: values.interviewerIds || [],
              observerIds: values.observerIds || [],
              expectedVersion: team.version,
            })}
          />
          <p className={styles.notice}>
            Cada pessoa tem uma só função nesta vaga. Um recrutador da
            organização passa a ver as candidaturas desta vaga.
          </p>
        </details>
      ) : null}
    </div>
  );
}

/** R91: o que fica por resolver antes de fechar. */
function ClosingSummary({ summary }) {
  if (!summary) return null;
  if (!summary.open)
    return (
      <p className={styles.notice}>Não há candidaturas em aberto nesta vaga.</p>
    );
  const parts = [
    summary.inReview ? `${summary.inReview} em análise` : null,
    summary.interview ? `${summary.interview} em entrevista` : null,
    summary.offer ? `${summary.offer} com proposta` : null,
  ].filter(Boolean);
  return (
    <div className={styles.closingSummary} role="note">
      <p>
        <strong>
          {summary.open}{' '}
          {summary.open === 1 ? 'candidatura fica' : 'candidaturas ficam'} por
          resolver:
        </strong>{' '}
        {parts.join(', ')}.
      </p>
      <p>
        Ao fechar, recebem a mensagem de encerramento (pode personalizá-la
        durante 7 dias). Nenhuma candidatura fica sem resposta.
      </p>
      {summary.hasActiveOffer ? (
        <p className={styles.error}>
          Há uma proposta ativa. Confirme a contratação antes de fechar, se a
          pessoa aceitou.
        </p>
      ) : null}
    </div>
  );
}

function JobControls({ job, onSuccess, request, children }) {
  const [preview, setPreview] = useState(null);
  const action = useAction(request);
  const base = `/api/jobs/${idPath(job.id)}`;
  return (
    <section className={styles.panel}>
      <div className={styles.sectionHeading}>
        <h3>{job.title}</h3>
        <span className={styles.badge}>{jobStatusLabel(job.status)}</span>
      </div>
      {job.applicationDeadline ? (
        <p className={styles.notice}>
          Candidaturas até {recruitmentDate(job.applicationDeadline)}
        </p>
      ) : null}
      {children}
      {job.canClose &&
      [
        'PUBLISHED',
        'PAUSED',
        'EXPIRED',
        'active',
        'paused',
        'expired',
      ].includes(job.status) ? (
        <details>
          <summary>Fechar o processo</summary>
          <ClosingSummary summary={job.closingSummary} />
          <ActionForm
            title="Resultado do processo"
            path={`${base}/close`}
            request={request}
            onSuccess={onSuccess}
            submit="Fechar vaga"
            confirmText="Confirmo o fecho desta vaga."
            fields={[
              {
                name: 'closeOutcome',
                label: 'Resultado',
                options: CLOSE_OUTCOMES.map((value) => [
                  value,
                  outcomeLabels[value],
                ]),
              },
              {
                name: 'otherText',
                label: 'Descrição (obrigatória se escolheu Outro)',
                maxLength: 300,
              },
              {
                name: 'improvement',
                label: 'O que podemos melhorar?',
                type: 'textarea',
                maxLength: 1000,
              },
            ]}
          />
        </details>
      ) : null}
      {job.canClose && job.fillProposed ? (
        <ActionForm
          title="Confirmar vaga preenchida"
          path={`${base}/fill`}
          request={request}
          onSuccess={onSuccess}
          confirmText="Todas as posições desta vaga estão preenchidas."
          submit="Confirmar preenchimento"
        />
      ) : null}
      {job.canClose && job.closingPending ? (
        <>
          <ActionForm
            title="Mensagem de fecho aos candidatos"
            path={`${base}/closing-message`}
            request={request}
            onSuccess={setPreview}
            fields={[
              {
                name: 'message',
                label: 'Modelo: {nome}, {vaga}, {organizacao}',
                type: 'textarea',
                maxLength: 1500,
              },
            ]}
            buildBody={(values) => ({
              confirm: false,
              ...(values.message.trim() ? { message: values.message } : {}),
            })}
            submit="Pré-visualizar mensagem"
          />
          {preview ? (
            <>
              <p className={styles.preview}>{preview.preview}</p>
              <button
                type="button"
                className="btn btn-primary"
                disabled={action.busy}
                onClick={() =>
                  action.run(
                    `${base}/closing-message`,
                    {
                      method: 'POST',
                      body: { confirm: true, message: preview.template },
                    },
                    () => {
                      setPreview(null);
                      onSuccess();
                    },
                  )
                }
              >
                Confirmar esta mensagem de fecho
              </button>
            </>
          ) : null}
          <ActionStatus action={action} />
        </>
      ) : null}
    </section>
  );
}

/** @param {{request?: typeof apiRequest, initialOrganizationId?: string, initialSection?: string, initialApplicationId?: string, onContextChange?: (context: Record<string,string>) => void}} props */
export default function RecruitmentWorkspace({
  request = apiRequest,
  initialOrganizationId = '',
  initialSection = 'applications',
  initialApplicationId = '',
  onContextChange = undefined,
}) {
  const [organizationId, setOrganizationId] = useState(initialOrganizationId);
  const [section, setSection] = useState(initialSection);
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [reload, setReload] = useState(0);
  const [selected, setSelected] = useState([]);
  const [opened, setOpened] = useState(initialApplicationId || null);
  const [result, setResult] = useState('');
  const [bulkPending, setBulkPending] = useState(false);
  const [search, setSearch] = useState('');
  const [jobFilter, setJobFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  // R16/R21: «Novas» e «paradas há > 10 dias» vêm marcadas pelo servidor.
  const [quickFilter, setQuickFilter] = useState('');
  const refresh = useCallback(() => setReload((value) => value + 1), []);
  useEffect(() => {
    setSection(initialSection);
  }, [initialSection]);
  useEffect(() => {
    setOrganizationId(initialOrganizationId);
  }, [initialOrganizationId]);
  useEffect(() => {
    setOpened(initialApplicationId || null);
  }, [initialApplicationId]);
  useEffect(() => {
    const controller = new AbortController();
    setError('');
    setLoading(true);
    const path =
      '/api/workspace' +
      (organizationId ? '?organizationId=' + idPath(organizationId) : '');
    request(path, { signal: controller.signal })
      .then((value) => {
        if (!controller.signal.aborted) {
          setData(value);
          const allowed = new Set(
            (value.workspace?.applications || [])
              .filter(
                (app) =>
                  app.permissions.transition &&
                  !['HIRED', 'WITHDRAWN'].includes(app.status),
              )
              .map((app) => app.id),
          );
          setSelected((current) => current.filter((id) => allowed.has(id)));
        }
      })
      .catch((err) => {
        if (!controller.signal.aborted)
          setError(err.message || 'Não foi possível carregar os processos.');
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [request, organizationId, reload]);
  const workspace = data?.workspace;
  const row = workspace?.applications.find((item) => item.id === opened);
  const tabs = workspace
    ? [
        ...(workspace.capabilities.ats
          ? [['applications', 'Candidaturas', workspace.applications.length]]
          : []),
        ...(workspace.capabilities.jobs
          ? [['jobs', 'Vagas', workspace.jobs.length]]
          : []),
        ...(workspace.capabilities.interviews
          ? [['interviews', 'Entrevistas', workspace.interviews.length]]
          : []),
        ...(workspace.capabilities.manageTeam
          ? [
              ['team', 'Equipa', workspace.members.length],
              ['messages', 'Mensagens', null],
            ]
          : []),
      ]
    : [];
  const activeSection = tabs.some(([key]) => key === section)
    ? section
    : tabs[0]?.[0];
  const changeSection = (value) => {
    setSection(value);
    onContextChange?.({
      organizationId: workspace?.organizationId || organizationId,
      section: value,
      applicationId: opened || '',
    });
  };
  const changeOrganization = (value) => {
    setOrganizationId(value);
    setData(null);
    setSelected([]);
    setOpened(null);
    setResult('');
    setSearch('');
    setJobFilter('');
    setStatusFilter('');
    setQuickFilter('');
    onContextChange?.({ organizationId: value, section, applicationId: '' });
  };
  const applications =
    workspace?.applications.filter(
      (app) =>
        (!jobFilter || app.jobId === jobFilter) &&
        (!statusFilter || app.status === statusFilter) &&
        (quickFilter !== 'new' || app.isNew) &&
        (quickFilter !== 'stale' || app.isStale) &&
        (quickFilter !== 'mine' || app.assigneeUserId === workspace.userId) &&
        (quickFilter !== 'unassigned' || !app.assigneeUserId) &&
        (!search.trim() ||
          (app.candidateName + ' ' + app.title)
            .toLocaleLowerCase('pt-PT')
            .includes(search.trim().toLocaleLowerCase('pt-PT'))),
    ) || [];
  const organizationName =
    data?.organizations?.find(
      (org) => org.organizationId === workspace?.organizationId,
    )?.name || 'A sua organização';
  const overview = workspace?.overview;
  const newCount =
    workspace?.applications.filter((app) => app.isNew).length || 0;
  const staleCount =
    workspace?.applications.filter((app) => app.isStale).length || 0;
  const mineCount =
    workspace?.applications.filter(
      (app) => app.assigneeUserId && app.assigneeUserId === workspace.userId,
    ).length || 0;
  const unassignedCount =
    workspace?.applications.filter((app) => !app.assigneeUserId).length || 0;
  // Quem pode receber candidaturas: membros que o servidor devolve a quem
  // gere; os restantes só se podem atribuir a si próprios (o servidor valida).
  const assignPeople = workspace
    ? workspace.teamCandidates?.length
      ? workspace.teamCandidates.map((person) => [
          person.userId,
          person.userId === workspace.userId
            ? `${person.name} (eu)`
            : person.name,
        ])
      : [[workspace.userId, 'Eu']]
    : [];
  const openAttention = (item) => {
    setSearch('');
    setJobFilter('');
    setStatusFilter('');
    setQuickFilter(item.filter || '');
    changeSection(item.section);
  };
  return (
    <div className={styles.root}>
      {error ? (
        <div className={styles.errorBox} role="alert">
          <p>{error}</p>
          <button
            className="btn btn-ghost"
            type="button"
            onClick={() => {
              changeOrganization('');
              refresh();
            }}
          >
            Voltar à minha organização
          </button>
        </div>
      ) : null}
      {loading ? (
        <p role="status">
          {data ? 'A atualizar processos…' : 'A carregar recrutamento…'}
        </p>
      ) : null}
      {data?.organizations?.length > 1 ? (
        <div className={styles.contextBar}>
          <label>
            Organização
            <select
              className="form-select"
              value={organizationId || workspace?.organizationId || ''}
              disabled={bulkPending || loading}
              onChange={(event) => changeOrganization(event.target.value)}
            >
              {data.organizations.map((org) => (
                <option key={org.organizationId} value={org.organizationId}>
                  {org.name ||
                    (org.organizationId === workspace?.userId
                      ? 'Minha empresa'
                      : 'Organização')}{' '}
                  · {teamRoleLabel(org.role)}
                </option>
              ))}
            </select>
          </label>
        </div>
      ) : data && !data.organizations?.length ? (
        <section className={styles.emptyState}>
          <h2>Ainda não pertence a uma organização</h2>
          <p>
            Entre com o email convidado e abra a ligação que recebeu para
            integrar uma equipa. A sua conta pessoal mantém-se independente.
          </p>
          <Link href="/dashboard" className="btn btn-ghost">
            Voltar ao meu painel
          </Link>
        </section>
      ) : null}
      {workspace ? (
        <section className={styles.overview} aria-label="Resumo da organização">
          <div className={styles.overviewHeader}>
            <div className={styles.overviewIntro}>
              <h2>{organizationName}</h2>
              <p>
                Acesso como {teamRoleLabel(workspace.role)}. As ações
                disponíveis dependem do seu papel.
              </p>
            </div>
            <div className={styles.row}>
              <button
                className="btn btn-ghost"
                type="button"
                onClick={refresh}
                disabled={bulkPending || loading}
              >
                Atualizar
              </button>
              {workspace.userId === workspace.organizationId ? (
                <Link
                  className="btn btn-primary"
                  href="/dashboard/empresa/vaga/criar-vaga"
                >
                  Publicar vaga
                </Link>
              ) : null}
            </div>
          </div>
          {overview ? (
            <>
              <div className={styles.metricGrid}>
                {[
                  [
                    'Novas',
                    overview.metrics.newApplications,
                    'por abrir',
                    { section: 'applications', filter: 'new' },
                  ],
                  [
                    'Por analisar',
                    overview.metrics.toReview,
                    'recebidas ou em análise',
                    { section: 'applications' },
                  ],
                  [
                    'Entrevistas',
                    overview.metrics.upcomingInterviews,
                    'nos próximos 7 dias',
                    { section: 'interviews' },
                  ],
                  [
                    'Vagas abertas',
                    overview.metrics.openJobs,
                    'a receber candidaturas',
                    { section: 'jobs' },
                  ],
                ].map(([label, value, meta, target]) => (
                  <button
                    key={label}
                    type="button"
                    className={styles.metricCard}
                    onClick={() => openAttention(target)}
                    disabled={!tabs.some(([key]) => key === target.section)}
                  >
                    <span className={styles.metricLabel}>{label}</span>
                    <strong className={styles.metricValue}>{value}</strong>
                    <span className={styles.metricMeta}>{meta}</span>
                  </button>
                ))}
              </div>
              <p className={styles.metricFootnote}>
                Contratações nos últimos 30 dias:{' '}
                <strong>{overview.metrics.hiresInPeriod}</strong>
                {overview.metrics.avgDaysToFirstReview !== null ? (
                  <>
                    {' · '}Tempo médio até à 1.ª análise:{' '}
                    <strong>
                      {String(overview.metrics.avgDaysToFirstReview).replace(
                        '.',
                        ',',
                      )}{' '}
                      dias
                    </strong>
                  </>
                ) : null}
              </p>
              <div className={styles.attention}>
                <h3>Precisa da sua atenção</h3>
                {overview.attention.length ? (
                  <ul>
                    {overview.attention.map((item) => (
                      <li key={item.key}>
                        <button
                          type="button"
                          className={styles.attentionItem}
                          onClick={() => openAttention(item)}
                          disabled={!tabs.some(([key]) => key === item.section)}
                        >
                          <span>{item.label}</span>
                          <span aria-hidden="true">→</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className={styles.notice}>
                    Está tudo em dia. Nada precisa da sua atenção agora.
                  </p>
                )}
              </div>
              {workspace.workload &&
              (workspace.workload.rows.length ||
                workspace.workload.unassignedToReview) ? (
                <div className={styles.attention}>
                  <h3>Por analisar, por pessoa</h3>
                  <p className={styles.notice}>
                    Para distribuir o trabalho da equipa. Não é uma
                    classificação.
                  </p>
                  <ul className={styles.workload}>
                    {workspace.workload.rows.map((person) => (
                      <li key={person.userId}>
                        <span>{person.name}</span>
                        <span>
                          {person.toReview} por analisar · {person.open} em
                          curso
                        </span>
                      </li>
                    ))}
                    {workspace.workload.unassignedToReview ? (
                      <li>
                        <button
                          type="button"
                          className={styles.linkButton}
                          onClick={() =>
                            openAttention({
                              section: 'applications',
                              filter: 'unassigned',
                            })
                          }
                        >
                          Sem responsável
                        </button>
                        <span>
                          {workspace.workload.unassignedToReview} por analisar
                        </span>
                      </li>
                    ) : null}
                  </ul>
                </div>
              ) : null}
            </>
          ) : null}
        </section>
      ) : null}
      {workspace && !tabs.length ? (
        <section className={styles.emptyState}>
          <h2>Este espaço ainda não está ativo</h2>
          <p>
            O recrutamento desta organização ainda não foi ativado. Pode
            continuar a usar o painel atual.
          </p>
          <Link href="/dashboard" className="btn btn-primary">
            Abrir o meu painel
          </Link>
        </section>
      ) : null}
      {workspace && tabs.length ? (
        <>
          <div
            className={styles.tabs}
            role="tablist"
            aria-label="Áreas de recrutamento"
          >
            {tabs.map(([key, label, count], index) => (
              <button
                key={key}
                id={'recruitment-tab-' + key}
                className={styles.tab}
                type="button"
                role="tab"
                aria-selected={activeSection === key}
                aria-controls={'recruitment-panel-' + key}
                tabIndex={activeSection === key ? 0 : -1}
                disabled={bulkPending}
                onClick={() => changeSection(key)}
                onKeyDown={(event) => {
                  let next;
                  if (event.key === 'ArrowRight')
                    next = (index + 1) % tabs.length;
                  if (event.key === 'ArrowLeft')
                    next = (index + tabs.length - 1) % tabs.length;
                  if (event.key === 'Home') next = 0;
                  if (event.key === 'End') next = tabs.length - 1;
                  if (next !== undefined) {
                    event.preventDefault();
                    changeSection(tabs[next][0]);
                    event.currentTarget.parentElement.children[next].focus();
                  }
                }}
              >
                {label}
                {count !== null ? (
                  <span className={styles.badge}>{count}</span>
                ) : null}
              </button>
            ))}
          </div>
          <div
            id={'recruitment-panel-' + activeSection}
            role="tabpanel"
            aria-labelledby={'recruitment-tab-' + activeSection}
            className={styles.root}
          >
            {result ? (
              <p role="status" className={styles.successBox}>
                {result}
              </p>
            ) : null}
            {activeSection === 'applications' ? (
              <>
                <section className={styles.panel}>
                  <div className={styles.sectionHeading}>
                    <div>
                      <h2>Candidaturas</h2>
                      <p className={styles.notice}>
                        Abra uma candidatura para consultar o perfil, avaliar,
                        marcar entrevista e registar o resultado.
                      </p>
                    </div>
                    <span className={styles.badge}>
                      {applications.length} de {workspace.applications.length}
                    </span>
                  </div>
                  <div
                    className={styles.quickFilters}
                    role="group"
                    aria-label="Mostrar"
                  >
                    {[
                      ['', 'Todas', workspace.applications.length],
                      ['new', 'Novas', newCount],
                      ['stale', 'Paradas há mais de 10 dias', staleCount],
                      ['mine', 'Comigo', mineCount],
                      ['unassigned', 'Sem responsável', unassignedCount],
                    ].map(([key, label, count]) => (
                      <button
                        key={key || 'all'}
                        type="button"
                        className={styles.chip}
                        aria-pressed={quickFilter === key}
                        onClick={() => setQuickFilter(key)}
                      >
                        {label}{' '}
                        <span className={styles.chipCount}>{count}</span>
                      </button>
                    ))}
                  </div>
                  <div className={styles.filters}>
                    <label>
                      Procurar candidato ou vaga
                      <input
                        className="form-input"
                        value={search}
                        onChange={(event) => setSearch(event.target.value)}
                        placeholder="Nome ou título da vaga"
                      />
                    </label>
                    <label>
                      Filtrar por vaga
                      <select
                        className="form-select"
                        value={jobFilter}
                        onChange={(event) => setJobFilter(event.target.value)}
                      >
                        <option value="">Todas as vagas</option>
                        {workspace.jobs.map((job) => (
                          <option key={job.id} value={job.id}>
                            {job.title}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      Filtrar por estado
                      <select
                        className="form-select"
                        value={statusFilter}
                        onChange={(event) =>
                          setStatusFilter(event.target.value)
                        }
                      >
                        <option value="">Todos os estados</option>
                        {[
                          ...new Set(
                            workspace.applications.map((app) => app.status),
                          ),
                        ].map((status) => (
                          <option key={status} value={status}>
                            {candidateStatusLabel(status)}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                  {!applications.length ? (
                    <div className={styles.emptyState}>
                      <h3>
                        {workspace.applications.length
                          ? 'Nenhuma candidatura corresponde aos filtros'
                          : 'Ainda não há candidaturas neste fluxo'}
                      </h3>
                      <p>
                        {workspace.applications.length
                          ? 'Altere a pesquisa, a vaga ou o estado para encontrar outros processos.'
                          : 'As candidaturas às vagas da organização aparecerão aqui. Escolha a área Vagas para consultar os seus anúncios.'}
                      </p>
                      {workspace.applications.length ? (
                        <button
                          type="button"
                          className="btn btn-ghost"
                          onClick={() => {
                            setSearch('');
                            setJobFilter('');
                            setStatusFilter('');
                            setQuickFilter('');
                          }}
                        >
                          Limpar filtros
                        </button>
                      ) : (
                        <button
                          type="button"
                          className="btn btn-ghost"
                          onClick={() => changeSection('jobs')}
                        >
                          Consultar vagas
                        </button>
                      )}
                      {workspace.userId === workspace.organizationId ? (
                        <Link href="/dashboard/empresa?tab=applications">
                          Consultar candidaturas anteriores
                        </Link>
                      ) : null}
                    </div>
                  ) : (
                    <ul className={styles.list}>
                      {applications.map((app) => (
                        <li className={styles.applicationItem} key={app.id}>
                          {app.permissions.transition &&
                          !['HIRED', 'WITHDRAWN'].includes(app.status) ? (
                            <label className={styles.selection}>
                              <input
                                type="checkbox"
                                aria-label={
                                  'Selecionar candidatura de ' +
                                  app.candidateName
                                }
                                checked={selected.includes(app.id)}
                                disabled={bulkPending}
                                onChange={(event) =>
                                  setSelected((current) =>
                                    event.target.checked
                                      ? [...current, app.id]
                                      : current.filter((id) => id !== app.id),
                                  )
                                }
                              />
                              <span className={styles.srOnly}>Selecionar</span>
                            </label>
                          ) : null}
                          <div className={styles.candidateInfo}>
                            <strong>{app.candidateName || 'Candidato'}</strong>
                            <span>
                              {app.title || 'Vaga'} ·{' '}
                              {app.assigneeName
                                ? `Responsável: ${app.assigneeName}`
                                : 'Sem responsável'}
                            </span>
                          </div>
                          {app.isNew ? (
                            <span className={styles.badgeNew}>Nova</span>
                          ) : null}
                          {app.isStale ? (
                            <span className={styles.badgeWarn}>
                              Parada há mais de 10 dias
                            </span>
                          ) : null}
                          <span className={styles.badge}>
                            {candidateStatusLabel(app.status)}
                          </span>
                          <button
                            className="btn btn-ghost"
                            type="button"
                            disabled={bulkPending}
                            onClick={() => {
                              setOpened(app.id);
                              onContextChange?.({
                                organizationId: workspace.organizationId,
                                section: 'applications',
                                applicationId: app.id,
                              });
                            }}
                          >
                            Ver processo
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>
                {selected.length ? (
                  <section className={styles.panel}>
                    <AssignForm
                      title={`Atribuir ${selected.length} ${selected.length === 1 ? 'candidatura selecionada' : 'candidaturas selecionadas'}`}
                      organizationId={workspace.organizationId}
                      applicationIds={selected}
                      people={assignPeople}
                      request={request}
                      submit="Atribuir"
                      onSuccess={(value) => {
                        setSelected([]);
                        setResult(
                          value.assigneeUserId
                            ? `${value.updated} ${value.updated === 1 ? 'candidatura atribuída' : 'candidaturas atribuídas'}.`
                            : `${value.updated} ${value.updated === 1 ? 'candidatura devolvida' : 'candidaturas devolvidas'} à fila comum.`,
                        );
                        refresh();
                      }}
                    />
                  </section>
                ) : null}
                {selected.length ? (
                  <BulkActions
                    ids={selected}
                    request={request}
                    onPendingChange={setBulkPending}
                    onSuccess={(value) => {
                      setSelected([]);
                      setResult(
                        value.updated +
                          ' atualizadas; ' +
                          value.failed +
                          ' não alteradas.',
                      );
                      refresh();
                    }}
                  />
                ) : null}
                {row ? (
                  <div className={styles.root}>
                    <div className={styles.sectionHeading}>
                      <h2>Processo selecionado</h2>
                      <button
                        className="btn btn-ghost"
                        type="button"
                        disabled={bulkPending}
                        onClick={() => {
                          setOpened(null);
                          onContextChange?.({
                            organizationId: workspace.organizationId,
                            section: 'applications',
                            applicationId: '',
                          });
                        }}
                      >
                        Fechar detalhe
                      </button>
                    </div>
                    <ApplicationWorkspace
                      key={workspace.organizationId + '-' + row.id}
                      row={row}
                      role={workspace.role}
                      request={request}
                      onChange={refresh}
                      organizationId={workspace.organizationId}
                      people={assignPeople}
                    />
                  </div>
                ) : null}
              </>
            ) : null}
            {activeSection === 'jobs' ? (
              <section className={styles.root}>
                <div className={styles.sectionHeading}>
                  <div>
                    <h2>Vagas e fecho de processos</h2>
                    <p className={styles.notice}>
                      Consulte cada vaga e registe o resultado quando o
                      recrutamento terminar.
                    </p>
                  </div>
                  {workspace.userId === workspace.organizationId ? (
                    <Link
                      className="btn btn-primary"
                      href="/dashboard/empresa/vaga/criar-vaga"
                    >
                      Publicar vaga
                    </Link>
                  ) : null}
                </div>
                {!workspace.jobs.length ? (
                  <div className={styles.emptyState}>
                    <h3>Sem vagas disponíveis</h3>
                    <p>
                      {workspace.role === 'RECRUITER'
                        ? 'Peça ao administrador para lhe atribuir uma vaga na área Equipa.'
                        : 'Publique a primeira vaga para começar a receber candidaturas.'}
                    </p>
                  </div>
                ) : (
                  <div className={styles.grid}>
                    {workspace.jobs.map((job) => (
                      <JobControls
                        key={job.id}
                        job={job}
                        request={request}
                        onSuccess={refresh}
                      >
                        <HiringTeamPanel
                          job={job}
                          candidates={workspace.teamCandidates || []}
                          request={request}
                          onSuccess={refresh}
                        />
                        <div className={styles.row}>
                          <button
                            type="button"
                            className="btn btn-primary"
                            onClick={() => {
                              setQuickFilter('');
                              setJobFilter(job.id);
                              changeSection('applications');
                            }}
                          >
                            Ver candidaturas
                          </button>
                          <Link
                            className="btn btn-ghost"
                            href={'/vaga/' + idPath(job.id)}
                          >
                            Ver anúncio
                          </Link>
                        </div>
                      </JobControls>
                    ))}
                  </div>
                )}
              </section>
            ) : null}
            {activeSection === 'interviews' ? (
              <section className={styles.root}>
                <h2>Entrevistas</h2>
                <p className={styles.notice}>
                  Marque entrevistas a partir do detalhe de uma candidatura.
                  Aqui acompanha confirmações, reagendamentos e feedback.
                </p>
                {!workspace.interviews.length ? (
                  <div className={styles.emptyState}>
                    <h3>Ainda não há entrevistas</h3>
                    <button
                      className="btn btn-ghost"
                      type="button"
                      onClick={() => changeSection('applications')}
                    >
                      Abrir candidaturas
                    </button>
                  </div>
                ) : (
                  <div className={styles.grid}>
                    {workspace.interviews.map((interview) => (
                      <InterviewControls
                        key={interview.id}
                        interview={interview}
                        request={request}
                        onSuccess={refresh}
                      />
                    ))}
                  </div>
                )}
              </section>
            ) : null}
            {activeSection === 'team' ? (
              <TeamWorkspace
                key={workspace.organizationId}
                workspace={workspace}
                request={request}
                onSuccess={refresh}
              />
            ) : null}
            {activeSection === 'messages' ? (
              <MessageTemplates
                key={workspace.organizationId}
                workspace={workspace}
                request={request}
              />
            ) : null}
          </div>
          {[workspace.applications, workspace.jobs, workspace.interviews].some(
            (list) => list.length >= workspace.limit,
          ) ? (
            <p className={styles.notice}>
              São mostrados os {workspace.limit} registos mais recentes de cada
              lista.
            </p>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
