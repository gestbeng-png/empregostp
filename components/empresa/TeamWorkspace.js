import { useEffect, useState } from 'react';
import {
  canAssignRole,
  canManageMember,
} from '../../domain/memberships/teamRules';
import {
  invitationPath,
  recruitmentDate,
  teamRoleDescription,
  teamRoleLabel,
} from '../../lib/recruitmentLabels';
import {
  ActionForm,
  ActionStatus,
  idPath,
  useAction,
} from './RecruitmentControls';
import styles from '../../styles/RecruitmentWorkspace.module.css';

const roles = ['ADMIN', 'RECRUITER', 'REVIEWER'];

/** R57: o que o membro tem a cargo antes de sair. */
function MemberResponsibilities({ member }) {
  const r = member.responsibilities;
  if (!r) return null;
  const items = [
    r.leadJobs
      ? `Responsável por ${r.leadJobs} ${r.leadJobs === 1 ? 'vaga' : 'vagas'}`
      : null,
    r.applications
      ? `${r.applications} ${r.applications === 1 ? 'candidatura atribuída' : 'candidaturas atribuídas'}`
      : null,
    r.interviews
      ? `${r.interviews} ${r.interviews === 1 ? 'entrevista futura' : 'entrevistas futuras'}`
      : null,
    r.supportJobs
      ? `Participa na equipa de ${r.supportJobs} ${r.supportJobs === 1 ? 'vaga' : 'vagas'} (termina com a saída)`
      : null,
  ].filter(Boolean);
  if (!items.length)
    return (
      <p className={styles.notice}>
        Não tem processos a cargo. Pode ser removido sem transferências.
      </p>
    );
  return (
    <div className={styles.closingSummary} role="note">
      <p>
        <strong>Antes de remover:</strong>
      </p>
      <ul>
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
      {r.mustTransfer ? (
        <p>
          Vagas, candidaturas e entrevistas passam para a pessoa que escolher
          abaixo, que ganha acesso a essas vagas.
        </p>
      ) : null}
    </div>
  );
}

function ShareInvitation({ path, email }) {
  const [message, setMessage] = useState('');
  const valid = invitationPath(path);
  if (!valid) return null;
  const url =
    typeof window === 'undefined' ? valid : `${window.location.origin}${valid}`;
  return (
    <div className={styles.shareBox}>
      <label>
        Ligação para {email || 'o convidado'}
        <input
          className="form-input"
          readOnly
          value={url}
          onFocus={(event) => event.target.select()}
        />
      </label>
      <button
        className="btn btn-ghost"
        type="button"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(url);
            setMessage(
              'Ligação copiada. Partilhe-a apenas com a pessoa convidada.',
            );
          } catch {
            setMessage('Selecione a ligação acima e copie-a manualmente.');
          }
        }}
      >
        Copiar ligação
      </button>
      <p className={styles.notice}>
        Só a conta do email convidado, com email verificado, pode aceitar.
      </p>
      {message ? <p role="status">{message}</p> : null}
    </div>
  );
}

export default function TeamWorkspace({ workspace, request, onSuccess }) {
  const [links, setLinks] = useState({});
  const [created, setCreated] = useState(null);
  useEffect(() => {
    const valid = new Set(workspace.invitations.map((invite) => invite.id));
    setCreated((current) =>
      current?.invitationId && !valid.has(current.invitationId)
        ? null
        : current,
    );
    setLinks((current) =>
      Object.fromEntries(
        Object.entries(current).filter(([id]) => valid.has(id)),
      ),
    );
  }, [workspace.invitations]);
  const action = useAction(request);
  const base = `/api/organizations/${idPath(workspace.organizationId)}`;
  const roleOptions = roles
    .filter((role) => canAssignRole(workspace.role, role))
    .map((role) => [role, teamRoleLabel(role)]);
  const jobs = workspace.jobs.map((job) => [
    job.id,
    job.title || 'Vaga sem título',
  ]);
  const full =
    workspace.team?.seatLimit !== null &&
    workspace.team?.seatLimit !== undefined &&
    workspace.team.usedSeats >= workspace.team.seatLimit;
  const jobField = {
    name: 'assignedJobIds',
    label: 'Vagas que o recrutador pode ver (Ctrl ou Cmd para escolher várias)',
    multiple: true,
    value: [],
    options: jobs,
    showWhen: { field: 'role', equals: 'RECRUITER' },
  };
  return (
    <div className={styles.root}>
      <section className={styles.panel}>
        <div className={styles.sectionHeading}>
          <div>
            <h2>A sua equipa</h2>
            <p className={styles.notice}>
              O seu papel: {teamRoleLabel(workspace.role)}.{' '}
              {teamRoleDescription(workspace.role)}
            </p>
          </div>
          {workspace.team ? (
            <span className={styles.badge}>
              {workspace.team.usedSeats} /{' '}
              {workspace.team.seatLimit ?? 'sem limite'} lugares
            </span>
          ) : null}
        </div>
        {workspace.team?.inviteConfigured === false ? (
          <p role="alert">
            Os convites ainda não estão configurados neste ambiente. Contacte o
            administrador antes de criar um convite.
          </p>
        ) : (
          <>
            {workspace.team?.emailProcessorEnabled === false ? (
              <p className={styles.notice}>
                O envio automático de emails está desligado. Depois de criar o
                convite, copie e partilhe a ligação com a pessoa convidada.
              </p>
            ) : null}
            <details
              className={styles.disclosure}
              open={!workspace.invitations.length}
            >
              <summary>Convidar uma pessoa</summary>
              <p>
                Escolha o email usado para entrar no EmpregoSTP e o acesso que
                esta pessoa terá.
              </p>
              <ul className={styles.roleGuide}>
                {roles.map((role) => (
                  <li key={role}>
                    <strong>{teamRoleLabel(role)}</strong> —{' '}
                    {teamRoleDescription(role)}
                  </li>
                ))}
              </ul>
              {full ? (
                <p role="status">
                  Todos os lugares estão ocupados. Revogue um convite pendente
                  ou remova um membro antes de convidar outra pessoa.
                </p>
              ) : null}
              <ActionForm
                title="Convidar membro"
                path={`${base}/invitations`}
                request={request}
                disabled={full}
                resetOnSuccess
                fields={[
                  {
                    name: 'email',
                    label: 'Email do convidado',
                    type: 'email',
                    required: true,
                  },
                  { name: 'role', label: 'Papel', options: roleOptions },
                  ...(jobs.length ? [jobField] : []),
                ]}
                buildBody={(values) => ({
                  email: values.email,
                  role: values.role,
                  ...(values.role === 'RECRUITER'
                    ? { assignedJobIds: values.assignedJobIds || [] }
                    : {}),
                })}
                onSuccess={(value) => {
                  setCreated({
                    invitationId: value.invitationId,
                    email: value.email,
                    path: value.acceptPath,
                    expiresAt: value.expiresAt,
                  });
                  if (value.invitationId && invitationPath(value.acceptPath))
                    setLinks((current) => ({
                      ...current,
                      [value.invitationId]: value.acceptPath,
                    }));
                  onSuccess();
                }}
                submit="Criar convite"
              />
            </details>
          </>
        )}
        {created && invitationPath(created.path) ? (
          <div className={styles.successBox} role="status">
            <strong>Convite criado.</strong>
            <p>
              Válido até {recruitmentDate(created.expiresAt)} (hora de São
              Tomé).
            </p>
            <ShareInvitation path={created.path} email={created.email} />
          </div>
        ) : null}
      </section>
      <section className={styles.panel}>
        <h2>
          Convites pendentes{' '}
          <span className={styles.badge}>{workspace.invitations.length}</span>
        </h2>
        {!workspace.invitations.length ? (
          <p className={styles.notice}>
            Não há convites pendentes. Quando a pessoa aceitar, aparecerá nos
            membros ativos.
          </p>
        ) : (
          <ul className={styles.list}>
            {workspace.invitations.map((invite) => (
              <li key={invite.id} className={styles.item}>
                <div className={styles.sectionHeading}>
                  <div>
                    <strong>{invite.email}</strong>
                    <p>
                      {teamRoleLabel(invite.role)} · Expira em{' '}
                      {recruitmentDate(invite.expiresAt)}
                    </p>
                  </div>
                  <button
                    className="btn btn-ghost"
                    type="button"
                    disabled={action.busy}
                    onClick={() =>
                      action.run(
                        `/api/invitations/${idPath(invite.id)}`,
                        {},
                        (value) =>
                          setLinks((current) => ({
                            ...current,
                            [invite.id]: value.acceptPath,
                          })),
                      )
                    }
                  >
                    Obter ligação do convite
                  </button>
                </div>
                {links[invite.id] ? (
                  <ShareInvitation
                    path={links[invite.id]}
                    email={invite.email}
                  />
                ) : null}
                <details className={styles.disclosure}>
                  <summary>Revogar convite</summary>
                  <ActionForm
                    title={`Revogar convite para ${invite.email}`}
                    path={`/api/invitations/${idPath(invite.id)}/revoke`}
                    request={request}
                    onSuccess={onSuccess}
                    confirmText="Confirmo a revogação deste convite."
                    submit="Revogar convite"
                  />
                </details>
              </li>
            ))}
          </ul>
        )}
        <ActionStatus action={action} />
      </section>
      <section className={styles.panel}>
        <h2>
          Membros ativos{' '}
          <span className={styles.badge}>{workspace.members.length}</span>
        </h2>
        {!workspace.members.length ? (
          <p className={styles.notice}>
            A sua conta gere esta organização. Os membros convidados aparecerão
            aqui depois de aceitarem.
          </p>
        ) : (
          <ul className={styles.list}>
            {workspace.members.map((member) => (
              <li key={member.userId} className={styles.item}>
                <div className={styles.sectionHeading}>
                  <div>
                    <strong>
                      {member.name ||
                        member.email ||
                        (member.userId === workspace.userId
                          ? 'A sua conta'
                          : 'Membro da equipa')}
                    </strong>
                    {member.email ? <p>{member.email}</p> : null}
                    <p>{teamRoleDescription(member.role)}</p>
                  </div>
                  <span className={styles.badge}>
                    {teamRoleLabel(member.role)}
                    {member.userId === workspace.userId ? ' · A sua conta' : ''}
                  </span>
                </div>
                {member.role === 'RECRUITER' ? (
                  <p className={styles.notice}>
                    {member.assignedJobIds?.length
                      ? `Vagas atribuídas: ${member.assignedJobIds.map((id) => workspace.jobs.find((job) => job.id === id)?.title || 'Vaga indisponível').join(', ')}`
                      : 'Sem vagas atribuídas. Não tem acesso a processos até receber uma atribuição.'}
                  </p>
                ) : null}
                {canManageMember(
                  { userId: workspace.userId, role: workspace.role },
                  member,
                ) ? (
                  <details className={styles.disclosure}>
                    <summary>Gerir este membro</summary>
                    <ActionForm
                      title="Alterar papel do membro"
                      path={`${base}/members/${idPath(member.userId)}`}
                      method="PATCH"
                      request={request}
                      onSuccess={onSuccess}
                      fields={[
                        {
                          name: 'role',
                          label: 'Novo papel',
                          options: roleOptions,
                          value: member.role,
                        },
                        ...(jobs.length
                          ? [
                              {
                                ...jobField,
                                value: member.assignedJobIds || [],
                              },
                            ]
                          : []),
                      ]}
                      buildBody={(values) => ({
                        role: values.role,
                        ...(values.role === 'RECRUITER'
                          ? { assignedJobIds: values.assignedJobIds || [] }
                          : {}),
                      })}
                    />
                    <MemberResponsibilities member={member} />
                    <ActionForm
                      title="Remover membro"
                      path={`${base}/members/${idPath(member.userId)}`}
                      method="PATCH"
                      fields={
                        member.responsibilities?.mustTransfer
                          ? [
                              {
                                name: 'transferToUserId',
                                label: 'Quem fica com estas responsabilidades',
                                placeholder: 'Escolha uma pessoa',
                                required: true,
                                options: workspace.members
                                  .filter(
                                    (other) =>
                                      other.userId !== member.userId &&
                                      ['OWNER', 'ADMIN', 'RECRUITER'].includes(
                                        other.role,
                                      ),
                                  )
                                  .map((other) => [
                                    other.userId,
                                    `${other.name || other.email} · ${teamRoleLabel(other.role)}`,
                                  ]),
                              },
                            ]
                          : []
                      }
                      buildBody={(values) => ({
                        remove: true,
                        ...(values.transferToUserId
                          ? { transferToUserId: values.transferToUserId }
                          : {}),
                      })}
                      request={request}
                      onSuccess={onSuccess}
                      confirmText="Confirmo a remoção deste membro. O histórico e a autoria das notas mantêm-se."
                      submit="Remover membro"
                    />
                  </details>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>
      {workspace.role === 'OWNER' &&
      workspace.members.some((member) => member.role === 'ADMIN') ? (
        <details className={styles.panel}>
          <summary>Transferir propriedade da organização</summary>
          <ActionForm
            title="Propor transferência de propriedade"
            path={`${base}/ownership-transfer`}
            request={request}
            onSuccess={onSuccess}
            confirmText="A propriedade só será transferida quando o administrador escolhido aceitar."
            submit="Propor transferência"
            fields={[
              {
                name: 'targetUserId',
                label: 'Administrador que receberá a propriedade',
                options: workspace.members
                  .filter((member) => member.role === 'ADMIN')
                  .map((member) => [
                    member.userId,
                    member.name || member.email || 'Administrador',
                  ]),
              },
            ]}
          />
        </details>
      ) : null}
      {workspace.ownershipTransfer?.canAccept ? (
        <ActionForm
          title="Aceitar propriedade da organização"
          path={`${base}/ownership-transfer/accept`}
          request={request}
          onSuccess={onSuccess}
          confirmText="Aceito tornar-me proprietário desta organização."
          submit="Aceitar propriedade"
        />
      ) : null}
    </div>
  );
}

export function MessageTemplates({ workspace, request }) {
  const [templates, setTemplates] = useState(null);
  const action = useAction(request);
  const path = `/api/organizations/${idPath(workspace.organizationId)}/message-templates`;
  return (
    <section className={styles.panel}>
      <h2>Mensagens aos candidatos</h2>
      <p className={styles.notice}>
        Defina os textos usados ao rejeitar candidaturas ou encerrar processos.
        As notas internas nunca são partilhadas.
      </p>
      <button
        className="btn btn-ghost"
        type="button"
        disabled={action.busy}
        onClick={() => action.run(path, {}, setTemplates)}
      >
        Editar modelos de mensagens
      </button>
      <ActionStatus action={action} />
      {templates ? (
        <ActionForm
          title="Modelos de mensagens"
          path={path}
          method="PATCH"
          request={request}
          onSuccess={() => setTemplates(null)}
          fields={[
            {
              name: 'NOT_SELECTED',
              label: 'Não selecionado: {nome}, {vaga}, {organizacao}',
              type: 'textarea',
              value: templates.NOT_SELECTED,
              required: true,
              maxLength: 1500,
            },
            {
              name: 'PROCESS_CLOSED',
              label: 'Processo encerrado: {nome}, {vaga}, {organizacao}',
              type: 'textarea',
              value: templates.PROCESS_CLOSED,
              required: true,
              maxLength: 1500,
            },
          ]}
        />
      ) : null}
    </section>
  );
}
