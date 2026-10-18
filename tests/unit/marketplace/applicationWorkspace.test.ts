import {
  normalizeTags,
  parseInternalNote,
} from '@/domain/applications/employerWorkspace';
import { FirestoreApplicationWorkspace } from '@/infrastructure/firebase/applications/FirestoreApplicationWorkspace';
import { membershipId } from '@/infrastructure/firebase/marketplace/identifiers';

import { createFakeFirestore } from '../../helpers/fakeFirestore';

jest.mock('firebase-admin/firestore', () => ({
  Timestamp: {
    fromMillis: (ms: number) => ({
      ms,
      toMillis: () => ms,
      toDate: () => new Date(ms),
    }),
  },
}));

const NOW = 1_960_000_000_000;
const company = 'company-1';

function setup(
  app: Record<string, unknown> = {},
  extra: Record<string, Record<string, unknown>> = {},
) {
  const fake = createFakeFirestore({
    [`users/${company}`]: { userType: 'empresa' },
    'users/other': { userType: 'empresa' },
    'users/cand-1': { userType: 'candidato' },
    'users/rev-1': { userType: 'empresa' },
    [`organizationMemberships/${membershipId('rev-1', company)}`]: {
      userId: 'rev-1',
      organizationId: company,
      role: 'REVIEWER',
      status: 'ACTIVE',
    },
    'applications/app-1': {
      v2Status: 'SUBMITTED',
      status: 'pending',
      version: 1,
      organizationId: company,
      candidateUserId: 'cand-1',
      jobId: 'job-1',
      candidateSnapshot: { fullName: 'Ana Costa' },
      jobSnapshot: { titulo: 'Motorista' },
      cvSnapshotKey: 'applicationSnapshots/app-1/x/cv.pdf',
      timeline: [],
      ...app,
    },
    'applications/old-1': {
      v2Status: 'REJECTED',
      organizationId: company,
      candidateUserId: 'cand-1',
      jobSnapshot: { titulo: 'Cozinheiro' },
    },
    'applications/elsewhere': {
      v2Status: 'HIRED',
      organizationId: 'org-b',
      candidateUserId: 'cand-1',
    },
    ...extra,
  });
  const workspace = new FirestoreApplicationWorkspace(fake.db, () => NOW);
  return { ...fake, workspace };
}

describe('Fase 3 — espaço de trabalho da empresa (F3.1/F3.5/H4)', () => {
  test('1.ª abertura passa a «Em análise» pelo sistema e mostra o snapshot', async () => {
    const { workspace, docs } = setup();
    const view = await workspace.view(company, 'app-1');
    expect(view).toMatchObject({
      ok: true,
      value: {
        status: 'UNDER_REVIEW',
        candidate: { fullName: 'Ana Costa' },
        cv: { available: true },
      },
    });
    expect(docs.get('applications/app-1')).toMatchObject({
      v2Status: 'UNDER_REVIEW',
      status: 'analysis',
    });
    const history = [...docs.entries()]
      .filter(([p]) => p.startsWith('applicationsStatusHistory/'))
      .map(([, d]) => d);
    expect(history).toEqual([
      expect.objectContaining({ to: 'UNDER_REVIEW', actorType: 'SYSTEM' }),
    ]);
    // F2.7: candidatura anterior à MESMA organização; a de outra organização não aparece.
    expect(view.ok && view.value.previousApplications).toEqual([
      { jobTitle: 'Cozinheiro', outcome: 'REJECTED', date: null },
    ]);
    // A vista nunca expõe o caminho do ficheiro.
    expect(JSON.stringify(view)).not.toContain('applicationSnapshots/');
  });

  test('outra empresa, candidato e candidatura legada não acedem', async () => {
    const { workspace } = setup();
    expect(await workspace.view('other', 'app-1')).toMatchObject({
      ok: false,
      error: { code: 'FORBIDDEN' },
    });
    expect(await workspace.view('cand-1', 'app-1')).toMatchObject({
      ok: false,
      error: { code: 'FORBIDDEN' },
    });
    const legacy = setup({ v2Status: undefined });
    expect(await legacy.workspace.view(company, 'app-1')).toMatchObject({
      ok: false,
      error: { code: 'NOT_FOUND' },
    });
  });

  test('notas internas com menções só de membros; revisor da organização pode comentar', async () => {
    const { workspace, docs } = setup();
    expect(
      await workspace.addNote(
        'rev-1',
        'app-1',
        'Bom perfil @[company-1] @[intruso]',
      ),
    ).toMatchObject({ ok: true });
    const note = [...docs.entries()].find(([p]) =>
      p.startsWith('applicationNotes/'),
    )?.[1];
    expect(note).toMatchObject({
      authorId: 'rev-1',
      mentions: ['company-1'],
      visibility: 'INTERNAL',
      organizationId: company,
    });
    // As notas nunca vão para o documento que o candidato lê.
    expect(JSON.stringify(docs.get('applications/app-1'))).not.toContain(
      'Bom perfil',
    );
    expect(await workspace.addNote(company, 'app-1', '   ')).toMatchObject({
      ok: false,
      error: { code: 'INVALID_INPUT' },
    });
  });

  test('avaliação por recrutador e etiquetas ficam em applicationInternals', async () => {
    const { workspace, docs } = setup();
    expect(
      await workspace.review(company, 'app-1', {
        rating: 4,
        tags: ['Carta B', 'carta b', 'Urgente'],
      }),
    ).toMatchObject({ ok: true });
    expect(
      await workspace.review('rev-1', 'app-1', { rating: 2 }),
    ).toMatchObject({ ok: true });
    expect(docs.get('applicationInternals/app-1')).toMatchObject({
      ratings: { [company]: 4, 'rev-1': 2 },
      tags: ['carta b', 'urgente'],
    });
    expect(
      await workspace.review(company, 'app-1', { rating: 6 }),
    ).toMatchObject({ ok: false });
    const view = await workspace.view(company, 'app-1');
    expect(view.ok && view.value.internals.averageRating).toBe(3);
  });

  test('CV: URL assinada de 5 min e AuditLog por acesso (H4)', async () => {
    const { workspace, docs } = setup();
    const sign = jest.fn(
      async (path: string, expires: number) =>
        `https://signed/${path}?e=${expires}`,
    );
    const result = await workspace.cvUrl(company, 'app-1', sign);
    expect(sign).toHaveBeenCalledWith(
      'applicationSnapshots/app-1/x/cv.pdf',
      NOW + 300_000,
    );
    expect(result).toMatchObject({
      ok: true,
      value: { expiresAt: new Date(NOW + 300_000).toISOString() },
    });
    const audit = [...docs.entries()].find(([p]) =>
      p.startsWith('auditLogs/'),
    )?.[1];
    expect(audit).toMatchObject({
      action: 'application_cv_downloaded',
      resourceId: 'app-1',
      organizationId: company,
    });
    expect(await workspace.cvUrl('other', 'app-1', sign)).toMatchObject({
      ok: false,
      error: { code: 'FORBIDDEN' },
    });
    expect(sign).toHaveBeenCalledTimes(1);
  });

  test('validadores puros', () => {
    expect(parseInternalNote('x'.repeat(2001), [])).toEqual({ ok: false });
    expect(
      normalizeTags(Array.from({ length: 11 }, (_, i) => `t${i}`)),
    ).toBeNull();
    expect(normalizeTags('não é lista')).toBeNull();
  });
});
