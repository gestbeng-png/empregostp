import { buildCandidateVisibility } from '../../../lib/candidateProfileInsights';
import { buildVerificationRecord } from '../../../lib/candidateVerification';
import { admin } from '../../../lib/firebaseAdmin';
import { createServerNotification } from '../../../lib/serverNotifications';
import adminListHandler from '../../../pages/api/admin/verifications';
import verifyActionHandler from '../../../pages/api/admin/verify-action';
import verificationHandler from '../../../pages/api/verifications';

jest.mock('../../../lib/firebaseAdmin', () => ({
  admin: {
    auth: jest.fn(),
    firestore: Object.assign(jest.fn(), {
      FieldValue: { serverTimestamp: () => '2026-10-22T12:00:00.000Z' },
    }),
  },
}));
jest.mock('../../../lib/serverLog', () => ({ logServerError: jest.fn() }));
jest.mock('../../../lib/serverNotifications', () => ({
  createServerNotification: jest.fn().mockResolvedValue({}),
}));

function response() {
  const res = { status: jest.fn(), json: jest.fn(), setHeader: jest.fn() };
  res.status.mockReturnValue(res);
  res.json.mockReturnValue(res);
  return res;
}

function pendingRecord() {
  return buildVerificationRecord({
    uid: 'candidate-1',
    documents: {
      requestedTypes: ['identity'],
      contact: { email: 'candidate@example.com', phone: '1234567' },
      idDocument: { url: 'https://example.com/id.pdf' },
      selfieDocument: { url: 'https://example.com/selfie.jpg' },
    },
  });
}

// Staged writes only become visible at commit, so a failed commit models the
// all-or-nothing Firestore contract rather than independently resolving sets.
type StoredData = Record<string, unknown> & {
  verificationItems?: { identity: { status: string } };
};
type TestRef = {
  id: string | undefined;
  path: string;
  get: jest.Mock;
  set: jest.Mock;
};
type Query = {
  where: (field: string, op: string, value: unknown) => Query;
  get: () => Promise<{
    docs: Array<{
      id: string | undefined;
      ref: TestRef;
      exists: boolean;
      data: () => StoredData;
    }>;
  }>;
};
class TestStore extends Map<string, StoredData> {
  override get(path: string): StoredData {
    return super.get(path) || {};
  }
}
function installStore() {
  const store = new TestStore([
    ['users/admin-1', { userType: 'admin', status: 'active' }],
    [
      'users/candidate-1',
      {
        userType: 'candidato',
        currentPlan: 'verification_candidato',
        cvUrl: 'https://example.com/cv.pdf',
      },
    ],
    ['profiles/candidate-1', {}],
    ['verifications/v1', pendingRecord()],
  ]);
  let generated = 0;
  const directSet = jest.fn();
  const ref = (path: string): TestRef => ({
    id: path.split('/')[1],
    path,
    get: jest.fn(async () => ({
      id: path.split('/')[1],
      ref: ref(path),
      exists: store.has(path),
      data: () => store.get(path),
    })),
    set: directSet,
  });
  const collection = (name: string) => {
    const query = (filters: Array<[string, unknown]> = []): Query => ({
      where: (field: string, _op: string, value: unknown) =>
        query([...filters, [field, value]]),
      get: async () => ({
        docs: [...store.entries()]
          .filter(
            ([path, data]) =>
              path.startsWith(`${name}/`) &&
              filters.every(([field, value]) => data[field] === value),
          )
          .map(([path]) => ({
            id: path.split('/')[1],
            ref: ref(path),
            exists: true,
            data: () => store.get(path),
          })),
      }),
    });
    return {
      ...query(),
      doc: (id = `generated-${++generated}`) => ref(`${name}/${id}`),
    };
  };
  const staged: Array<[TestRef, StoredData, { merge?: boolean } | undefined]> =
    [];
  const batchSet = jest.fn(
    (target: TestRef, data: StoredData, options?: { merge?: boolean }) =>
      staged.push([target, data, options]),
  );
  const commit = jest.fn(async () => {
    staged.forEach(([target, data, options]) =>
      store.set(
        target.path,
        options?.merge ? { ...store.get(target.path), ...data } : data,
      ),
    );
  });
  (admin.firestore as unknown as jest.Mock).mockReturnValue({
    collection,
    batch: () => ({ set: batchSet, commit }),
  });
  (admin.auth as unknown as jest.Mock).mockReturnValue({
    verifyIdToken: jest.fn().mockResolvedValue({ uid: 'admin-1' }),
  });
  return { store, batchSet, commit, directSet };
}

async function request(
  handler: typeof verificationHandler,
  method: string,
  body = {},
  query = {},
) {
  const res = response();
  await handler(
    { method, body, query, headers: { authorization: 'Bearer valid-token' } },
    res,
  );
  return res;
}

describe('verification API state consistency', () => {
  beforeEach(() => jest.clearAllMocks());

  test('guarda todos os links e descrições e entrega-os na revisão do admin', async () => {
    const { store } = installStore();
    store.delete('verifications/v1');
    store.get('users/candidate-1').currentPlan = 'basic_candidato';
    const supportingLinks = [
      {
        url: 'https://example.com/projeto',
        description: 'Sistema de stock que desenvolvi.',
      },
      {
        url: 'https://example.com/artigo',
        description: 'Artigo sobre testes de software.',
      },
    ];
    const sent = await request(verificationHandler, 'POST', {
      uid: 'candidate-1',
      verificationMethod: 'competencies',
      documents: {
        requestedTypes: ['competencies'],
        contact: { email: 'candidate@example.com', phone: '9900000' },
        experienceSummary:
          'Cinco anos de experiência profissional em desenvolvimento de software.',
        competencyNotes:
          'Desenvolvimento de aplicações web e testes de software.',
        supportingLinks,
      },
    });
    expect(sent.status).toHaveBeenCalledWith(201);
    const saved = sent.json.mock.calls[0][0].verification;
    expect(saved.documents.supportingLinks).toEqual(supportingLinks);
    expect(saved.summary.publicVerified).toBe(false);
    const list = await request(adminListHandler, 'GET');
    const item = list.json.mock.calls[0][0].verifications[0];
    expect(item.approvalEligibility.allowed).toBe(true);
    expect(
      item.verificationItems.competencies.evidence.filter(
        (entry: { type: string }) => entry.type === 'link',
      ),
    ).toEqual(
      supportingLinks.map((link, index) =>
        expect.objectContaining({
          ...link,
          label: `Link de prova ${index + 1}`,
          type: 'link',
          source: 'submission',
        }),
      ),
    );
  });

  test.each([
    { links: [{ url: 'javascript:alert(1)', description: 'URL inseguro' }] },
    { links: [{ url: '', description: 'Descrição sem link' }] },
    { links: [{ url: 'https://example.com', description: 'a'.repeat(501) }] },
    {
      links: Array.from({ length: 11 }, (_, index) => ({
        url: `https://example.com/${index}`,
      })),
    },
  ])(
    'recusa provas com links inválidos sem gravar dados: %j',
    async ({ links }) => {
      const { commit } = installStore();
      const result = await request(verificationHandler, 'POST', {
        uid: 'candidate-1',
        verificationMethod: 'competencies',
        documents: { supportingLinks: links },
      });
      expect(result.status).toHaveBeenCalledWith(400);
      expect(commit).not.toHaveBeenCalled();
    },
  );

  test('pedido gratuito por competências chega ao admin e só recebe selo após aprovação', async () => {
    const { store } = installStore();
    store.delete('verifications/v1');
    store.get('users/candidate-1').currentPlan = 'basic_candidato';
    (admin.auth as unknown as jest.Mock).mockReturnValue({
      verifyIdToken: jest.fn().mockResolvedValue({ uid: 'candidate-1' }),
    });
    const sent = await request(verificationHandler, 'POST', {
      uid: 'candidate-1',
      verificationMethod: 'competencies',
      documents: {
        requestedTypes: ['competencies'],
        contact: { email: 'candidate@example.com', phone: '9900000' },
        experienceSummary:
          'Trabalho em desenvolvimento de sistemas e gestão de projetos há cinco anos.',
        competencyNotes:
          'Desenvolvimento de aplicações web, testes e bases de dados.',
        portfolioUrl: 'https://example.com/portfolio',
      },
    });
    expect(sent.status).toHaveBeenCalledWith(201);
    const created = sent.json.mock.calls[0][0];
    expect(created.verification.summary.publicVerified).toBe(false);
    expect(created.verification.summary.pendingCount).toBe(1);
    expect(store.get('users/candidate-1').verified).toBe(false);
    const duplicate = await request(verificationHandler, 'POST', {
      uid: 'candidate-1',
      verificationMethod: 'competencies',
      documents: {
        requestedTypes: ['competencies'],
        contact: { email: 'candidate@example.com', phone: '9900000' },
        experienceSummary:
          'Trabalho em desenvolvimento de sistemas e gestão de projetos há cinco anos.',
        competencyNotes:
          'Desenvolvimento de aplicações web, testes e bases de dados.',
        portfolioUrl: 'https://example.com/portfolio',
      },
    });
    expect(duplicate.status).toHaveBeenCalledWith(409);
    (admin.auth as unknown as jest.Mock).mockReturnValue({
      verifyIdToken: jest.fn().mockResolvedValue({ uid: 'admin-1' }),
    });
    const list = await request(adminListHandler, 'GET');
    expect(list.json.mock.calls[0][0].verifications[0]).toMatchObject({
      verificationMethod: 'competencies',
      approvalEligibility: { allowed: true },
    });
    const approved = await request(verifyActionHandler, 'POST', {
      uid: 'candidate-1',
      verificationId: created.id,
      action: 'approve',
    });
    expect(approved.status).toHaveBeenCalledWith(200);
    for (const collection of ['users', 'profiles']) {
      expect(store.get(`${collection}/candidate-1`)).toMatchObject({
        verified: true,
        verificationType: 'qualified',
        verificationTypes: ['qualified'],
      });
    }
    const revoked = await request(verifyActionHandler, 'POST', {
      uid: 'candidate-1',
      verificationId: created.id,
      action: 'revoke',
    });
    expect(revoked.status).toHaveBeenCalledWith(200);
    expect(store.get('users/candidate-1')).toMatchObject({
      verified: false,
      verificationType: null,
      verificationTypes: [],
    });
  });

  test.each([
    [
      'admin action',
      verifyActionHandler,
      { action: 'approve', uid: 'candidate-1', verificationId: 'v1' },
      'POST',
    ],
    [
      'legacy PUT',
      verificationHandler,
      { status: 'approved', id: 'v1' },
      'PUT',
    ],
  ])(
    '%s checks missing CV, expired plans, and the profile CV fallback',
    async (_name, handler, body, method) => {
      const { store, commit } = installStore();
      const user = store.get('users/candidate-1');
      user.cvUrl = '';
      let res = await request(handler, method as string, body);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ code: 'VERIFICATION_MISSING_CV' }),
      );
      expect(commit).not.toHaveBeenCalled();
      store.set('profiles/candidate-1', {
        cvUrl: 'https://example.com/profile-cv.pdf',
      });
      user.planEndDate = '2000-01-01';
      res = await request(handler, method as string, body);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ code: 'VERIFICATION_PLAN_NOT_ELIGIBLE' }),
      );
      expect(commit).not.toHaveBeenCalled();
      user.planEndDate = null;
      res = await request(handler, method as string, body);
      expect(res.status).toHaveBeenCalledWith(200);
      expect(commit).toHaveBeenCalledTimes(1);
      expect(
        store.get('verifications/v1').verificationItems?.identity.status,
      ).toBe('approved');
      for (const collection of ['users', 'profiles']) {
        expect(store.get(`${collection}/candidate-1`)).toMatchObject({
          verificationId: 'v1',
          verificationType: 'paid',
          verificationTypes: ['paid'],
          verified: true,
          verificado: true,
          isVerified: true,
        });
      }
    },
  );

  test.each([
    [
      'admin action',
      verifyActionHandler,
      { action: 'reject', uid: 'candidate-1', verificationId: 'v1' },
      'POST',
    ],
    [
      'legacy PUT',
      verificationHandler,
      { status: 'rejected', id: 'v1' },
      'PUT',
    ],
    [
      'submission',
      verificationHandler,
      { uid: 'candidate-1', documents: pendingRecord().documents },
      'POST',
    ],
  ])(
    '%s leaves all state untouched if its batch fails',
    async (_name, handler, body, method) => {
      const { store, commit, directSet, batchSet } = installStore();
      const before = JSON.stringify([...store.entries()]);
      commit.mockRejectedValueOnce(new Error('Commit failed'));
      const res = await request(handler, method as string, body);
      expect(res.status).toHaveBeenCalledWith(500);
      expect(batchSet).toHaveBeenCalledTimes(4);
      expect(directSet).not.toHaveBeenCalled();
      expect(JSON.stringify([...store.entries()])).toBe(before);
      expect(createServerNotification).not.toHaveBeenCalled();
    },
  );

  test.each([
    [
      verifyActionHandler,
      'POST',
      { action: 'approve', uid: 'candidate-1', verificationId: 'v1' },
    ],
    [verificationHandler, 'PUT', { status: 'approved', id: 'v1' }],
    [adminListHandler, 'GET', {}],
  ])(
    'rejects suspended admins before reading or writing verification state',
    async (handler, method, body) => {
      const { store, batchSet } = installStore();
      store.get('users/admin-1').status = 'suspended';
      const res = await request(handler, method as string, body);
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ code: 'ACCOUNT_BLOCKED' }),
      );
      expect(batchSet).not.toHaveBeenCalled();
    },
  );

  test('revoke and reactivate synchronize every paid and legacy field in both public documents', async () => {
    const { store } = installStore();
    store.get('users/candidate-1').currentPlan = 'unlimited_candidato';
    await request(verifyActionHandler, 'POST', {
      action: 'approve',
      uid: 'candidate-1',
      verificationId: 'v1',
    });
    const revoked = await request(verifyActionHandler, 'POST', {
      action: 'revoke',
      uid: 'candidate-1',
      verificationId: 'v1',
    });
    expect(revoked.status).toHaveBeenCalledWith(200);
    for (const collection of ['users', 'profiles']) {
      expect(store.get(`${collection}/candidate-1`)).toMatchObject({
        verificationType: null,
        verificationTypes: [],
        verified: false,
        verificado: false,
        isVerified: false,
        verifiedAt: null,
        verificationDisabled: true,
      });
    }
    expect(
      buildCandidateVisibility(
        store.get('users/candidate-1'),
        store.get('profiles/candidate-1'),
      ).verified,
    ).toBe(false);
    const active = await request(verifyActionHandler, 'POST', {
      action: 'reactivate',
      verificationType: 'identity',
      uid: 'candidate-1',
      verificationId: 'v1',
    });
    expect(active.status).toHaveBeenCalledWith(200);
    expect(store.get('users/candidate-1').verificationStatus).toBe('verified');
    expect(store.get('profiles/candidate-1').verificationStatus).toBe(
      'verified',
    );
    expect(store.get('users/candidate-1').verificationDisabled).toBe(false);
    expect(
      buildCandidateVisibility(
        store.get('users/candidate-1'),
        store.get('profiles/candidate-1'),
      ).premiumVerified,
    ).toBe(true);
  });

  test('an empty selection cannot resubmit historical requested items', async () => {
    const { commit } = installStore();
    const res = await request(verificationHandler, 'POST', {
      uid: 'candidate-1',
      documents: { requestedTypes: [] },
    });
    expect(res.status).toHaveBeenCalledWith(400);
    expect(commit).not.toHaveBeenCalled();
  });

  test('both lists choose the latest record when ISO dates are mixed with Firestore timestamps', async () => {
    const { store } = installStore();
    store.get('verifications/v1').updatedAt = {
      toDate: () => new Date('2025-01-01'),
    };
    store.set('verifications/v2', {
      ...pendingRecord(),
      updatedAt: '2026-10-01T10:00:00.000Z',
    });
    let res = await request(
      verificationHandler,
      'GET',
      {},
      { uid: 'candidate-1' },
    );
    expect(
      res.json.mock.calls[0][0].verifications.map(
        (item: { id: string }) => item.id,
      ),
    ).toEqual(['v2']);
    res = await request(adminListHandler, 'GET');
    expect(
      res.json.mock.calls[0][0].verifications.map(
        (item: { id: string }) => item.id,
      ),
    ).toEqual(['v2']);
  });
});
