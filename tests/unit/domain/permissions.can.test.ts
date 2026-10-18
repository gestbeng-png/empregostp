import type {
  PermissionAction,
  PermissionActor,
  PermissionResource,
  PermissionRole,
} from '@/domain/permissions/can';
import { can } from '@/domain/permissions/can';

/**
 * Matriz H3 de docs/regranegocio.md, transcrita à mão e independente da tabela do
 * código: se as duas divergirem, este teste falha. Cada célula é um caso.
 *
 * ✓ sim · P próprio · O da organização · O* organização + entitlement ·
 * A atribuídas (ou todas, por configuração) · M com motivo · — não
 */
type Cell = '✓' | 'P' | 'O' | 'O*' | 'A' | 'M' | '—';

const COLUMNS: readonly PermissionRole[] = [
  'CANDIDATE',
  'OWNER',
  'ORG_ADMIN',
  'RECRUITER',
  'ORG_REVIEWER',
  'MODERATOR',
  'REVIEWER',
  'ADMIN',
];

const SPEC: Record<PermissionAction, readonly Cell[]> = {
  view_published_job: ['✓', '✓', '✓', '✓', '✓', '✓', '✓', '✓'],
  create_job: ['—', 'O', 'O', 'O', '—', '—', '—', 'M'],
  publish_close_job: ['—', 'O', 'O', 'O', '—', '—', '—', 'M'],
  moderate_job: ['—', '—', '—', '—', '—', '✓', '—', '✓'],
  apply: ['P', '—', '—', '—', '—', '—', '—', '—'],
  view_application: ['P', 'O', 'O', 'A', 'O', 'M', '—', 'M'],
  download_application_cv: ['P', 'O', 'O', 'O', 'O', 'M', '—', 'M'],
  change_application_status: ['P', 'O', 'O', 'O', '—', '—', '—', 'M'],
  reverse_rejection: ['—', 'O', 'O', '—', '—', '—', '—', 'M'],
  internal_notes: ['—', 'O', 'O', 'O', 'O', 'M', '—', 'M'],
  interview_offer: ['—', 'O', 'O', 'O', '—', '—', '—', '—'],
  confirm_hire: ['—', 'O', 'O', 'O', '—', '—', '—', 'M'],
  talent_search: ['—', 'O*', 'O*', 'O*', '—', '—', '—', 'M'],
  talent_invite: ['—', 'O*', 'O*', 'O*', '—', '—', '—', '—'],
  export_applications: ['—', 'O*', 'O*', '—', '—', '—', '—', 'M'],
  manage_members: ['—', 'O', 'O', '—', '—', '—', '—', 'M'],
  transfer_ownership: ['—', 'O', '—', '—', '—', '—', '—', 'M'],
  billing: ['—', 'O', 'O', '—', '—', '—', '—', '✓'],
  view_verification_documents: ['P', 'O', 'O', '—', '—', '—', '✓', 'M'],
  decide_verification: ['—', '—', '—', '—', '—', '—', '✓', '✓'],
  report: ['✓', '✓', '✓', '✓', '✓', '—', '—', '—'],
  decide_report_suspend: ['—', '—', '—', '—', '—', '✓', '—', '✓'],
  merge_organizations: ['—', '—', '—', '—', '—', '—', '—', '✓'],
  view_audit: ['—', 'O', 'O', '—', '—', '—', '—', '✓'],
  export_personal_data: ['P', '—', '—', '—', '—', '—', '—', '—'],
  delete_account: ['P', 'P', 'P', 'P', 'P', '—', '—', 'M'],
};

const ALL_ENTITLEMENTS = ['TALENT_SEARCH', 'INVITES_MONTHLY', 'EXPORT'];

function actorFor(
  role: PermissionRole,
  overrides: Partial<PermissionActor> = {},
): PermissionActor {
  return {
    userId: 'u-actor',
    role,
    active: true,
    organizationId: 'org-a',
    membershipActive: true,
    assignedJobIds: ['job-1'],
    entitlements: ALL_ENTITLEMENTS,
    organizationContactVerified: true,
    ...overrides,
  };
}

// O cenário mais favorável possível: o próprio recurso, da própria
// organização, publicado, com motivo e entitlements. Uma célula "—" tem de
// recusar mesmo assim.
function favourableResource(action: PermissionAction): PermissionResource {
  return {
    ownerUserId: 'u-actor',
    candidateUserId: 'u-actor',
    organizationId: 'org-a',
    jobId: 'job-1',
    published: true,
    requestedStatus:
      action === 'change_application_status' ? 'WITHDRAWN' : undefined,
  };
}

const cases = (Object.keys(SPEC) as PermissionAction[]).flatMap((action) =>
  COLUMNS.map((role, index) => [action, role, SPEC[action][index]] as const),
);

describe('can() cobre a matriz H3 célula a célula', () => {
  test.each(cases)('%s × %s = %s', (action, role, cell) => {
    const withReason = actorFor(role, { reason: 'Denúncia #42' });
    const allowedInBestCase = can(
      withReason,
      action,
      favourableResource(action),
    );

    if (cell === '—') {
      expect(allowedInBestCase).toBe(false);
      return;
    }
    expect(allowedInBestCase).toBe(true);

    if (action === 'view_published_job') {
      expect(can(actorFor(role), action, { published: false })).toBe(false);
      return;
    }

    if (cell === 'M') {
      expect(can(actorFor(role), action, favourableResource(action))).toBe(
        false,
      );
    }
    if (cell === 'P') {
      expect(
        can(withReason, action, {
          ...favourableResource(action),
          ownerUserId: 'u-other',
          candidateUserId: 'u-other',
        }),
      ).toBe(false);
    }
    if (cell === 'O' || cell === 'O*' || cell === 'A') {
      // IDOR: o mesmo pedido sobre um recurso de outra organização.
      expect(
        can(withReason, action, {
          ...favourableResource(action),
          organizationId: 'org-b',
        }),
      ).toBe(false);
      expect(
        can(
          actorFor(role, { membershipActive: false }),
          action,
          favourableResource(action),
        ),
      ).toBe(false);
    }
    if (cell === 'O*') {
      expect(
        can(
          actorFor(role, { entitlements: [] }),
          action,
          favourableResource(action),
        ),
      ).toBe(false);
    }
    if (cell === 'A') {
      expect(
        can(actorFor(role), action, {
          ...favourableResource(action),
          jobId: 'job-2',
        }),
      ).toBe(false);
      expect(
        can(actorFor(role, { recruiterCanViewAllJobs: true }), action, {
          ...favourableResource(action),
          jobId: 'job-2',
        }),
      ).toBe(true);
    }
  });

  test.each(
    (Object.keys(SPEC) as PermissionAction[]).filter(
      (a) => a !== 'view_published_job',
    ),
  )('SUPPORT e NONE nunca podem %s', (action) => {
    for (const role of ['SUPPORT', 'NONE'] as const) {
      expect(
        can(
          actorFor(role, { reason: 'motivo' }),
          action,
          favourableResource(action),
        ),
      ).toBe(false);
    }
  });
});

describe('regras adicionais da H3', () => {
  it('contas inativas ou sem utilizador não fazem nada', () => {
    expect(
      can(actorFor('OWNER', { active: false }), 'create_job', {
        organizationId: 'org-a',
      }),
    ).toBe(false);
    expect(
      can(actorFor('OWNER', { userId: undefined }), 'create_job', {
        organizationId: 'org-a',
      }),
    ).toBe(false);
  });

  it('o candidato só pode mudar a candidatura para retirada', () => {
    const resource = {
      candidateUserId: 'u-actor',
      requestedStatus: 'SHORTLISTED',
    };
    expect(
      can(actorFor('CANDIDATE'), 'change_application_status', resource),
    ).toBe(false);
  });

  it('um ADMIN da organização não pode promover alguém a OWNER', () => {
    expect(
      can(actorFor('ORG_ADMIN'), 'manage_members', {
        organizationId: 'org-a',
        requestedMemberRole: 'OWNER',
      }),
    ).toBe(false);
    expect(
      can(actorFor('OWNER'), 'manage_members', {
        organizationId: 'org-a',
        requestedMemberRole: 'OWNER',
      }),
    ).toBe(true);
  });

  it('o único OWNER com subscrição ativa não pode apagar a conta', () => {
    expect(
      can(actorFor('OWNER'), 'delete_account', {
        ownerUserId: 'u-actor',
        soleOwnerWithActiveSubscription: true,
      }),
    ).toBe(false);
  });

  it('pesquisa de talentos exige contacto da organização verificado', () => {
    expect(
      can(
        actorFor('RECRUITER', { organizationContactVerified: false }),
        'talent_search',
        {
          organizationId: 'org-a',
        },
      ),
    ).toBe(false);
  });
});
