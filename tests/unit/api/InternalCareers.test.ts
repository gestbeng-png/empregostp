import { enforceApiRateLimit } from '../../../lib/apiRateLimit';
import { admin } from '../../../lib/firebaseAdmin';
import { MAX_CV_BYTES, validateInternalApplication } from '../../../lib/internalCareers';
import applications from '../../../pages/api/careers/applications';
import opportunities from '../../../pages/api/careers/opportunities';

jest.mock('../../../lib/firebaseAdmin', () => ({ admin: { firestore: jest.fn(), storage: jest.fn() } }));
jest.mock('../../../lib/apiRateLimit', () => ({ enforceApiRateLimit: jest.fn() }));
jest.mock('../../../lib/serverLog', () => ({ logServerError: jest.fn(), logServerWarning: jest.fn() }));

const payload = { name: 'Ana Santos', email: 'ANA@example.com', area: 'Engenharia',
  message: 'Gostaria de trabalhar com a equipa.', consent: true, consentVersion: 'careers-v1' };
const pdf = { name: 'curriculo.pdf', contentType: 'application/pdf',
  base64: Buffer.from('%PDF-1.7\nexample\n%%EOF\n').toString('base64') };
const response = () => {
  const res = { status: jest.fn(), json: jest.fn(), setHeader: jest.fn() };
  res.status.mockReturnValue(res); res.json.mockReturnValue(res); return res;
};
const request = (body: unknown = payload, headers = {}) => ({ method: 'POST', body,
  headers: { 'content-type': 'application/json', ...headers } });
const doc = (id: string, data: object) => ({ id, data: () => data });

describe('institutional careers (Firebase/Storage entirely mocked)', () => {
  let collection: jest.Mock, where: jest.Mock, getJobs: jest.Mock, create: jest.Mock;
  let save: jest.Mock, remove: jest.Mock, file: jest.Mock;
  let organization: { exists: boolean; data: () => Record<string, unknown> };
  let user: typeof organization;
  const originalId = process.env.EMPREGOSTP_ORGANIZATION_ID;
  const originalSite = process.env.NEXT_PUBLIC_SITE_URL;
  beforeEach(() => {
    jest.resetAllMocks();
    process.env.EMPREGOSTP_ORGANIZATION_ID = 'institution';
    process.env.NEXT_PUBLIC_SITE_URL = 'https://empregostp.com';
    organization = { exists: true, data: () => ({ verificationLevel: 'ORGANIZATION_VERIFIED' }) };
    user = { exists: true, data: () => ({ userType: 'empresa', verificationStatus: 'verified' }) };
    getJobs = jest.fn().mockResolvedValue({ docs: [] });
    where = jest.fn(() => ({ get: getJobs }));
    create = jest.fn().mockResolvedValue(undefined);
    collection = jest.fn((name) => {
      if (name === 'jobs') return { where };
      if (name === 'internalCareerApplications') return { doc: () => ({ id: 'application-1', create }) };
      return { doc: () => ({ get: async () => name === 'organizations' ? organization : user }) };
    });
    (admin.firestore as unknown as jest.Mock).mockReturnValue({ collection });
    Object.assign(admin.firestore, { FieldValue: { serverTimestamp: () => 'SERVER_TIME' } });
    save = jest.fn().mockResolvedValue(undefined); remove = jest.fn().mockResolvedValue(undefined);
    file = jest.fn(() => ({ save, delete: remove }));
    (admin.storage as unknown as jest.Mock).mockReturnValue({ bucket: () => ({ file }) });
    jest.mocked(enforceApiRateLimit).mockResolvedValue(true);
  });
  afterAll(() => {
    if (originalId === undefined) delete process.env.EMPREGOSTP_ORGANIZATION_ID;
    else process.env.EMPREGOSTP_ORGANIZATION_ID = originalId;
    if (originalSite === undefined) delete process.env.NEXT_PUBLIC_SITE_URL;
    else process.env.NEXT_PUBLIC_SITE_URL = originalSite;
  });

  it.each(['', ' ', 'bad/id'])('fails closed for missing/invalid ID %p without a DB read', async (id) => {
    process.env.EMPREGOSTP_ORGANIZATION_ID = id;
    const res = response(); await opportunities({ method: 'GET' }, res);
    expect(res.json).toHaveBeenCalledWith({ opportunities: [] });
    expect(admin.firestore).not.toHaveBeenCalled();
  });
  it.each(['REGISTERED', 'CONTACT_VERIFIED', ''])('requires verified organization: %p', async (level) => {
    organization.data = () => ({ verificationLevel: level });
    const res = response(); await opportunities({ method: 'GET' }, res);
    expect(res.json).toHaveBeenCalledWith({ opportunities: [] });
    expect(where).not.toHaveBeenCalled();
    expect(collection).not.toHaveBeenCalledWith('users');
  });
  it('filters exact org, expiry and status; strips internal fields and preserves actual document ID', async () => {
    getJobs.mockResolvedValue({ docs: [
      doc('real', { id: 'forged', organizationId: 'institution', status: 'active', internalSecret: 'secret', createdAt: { toDate: () => new Date('2026-01-01') } }),
      doc('other', { organizationId: 'other', companyName: 'EmpregoSTP', status: 'active' }),
      doc('alias', { companyId: 'institution', status: 'active' }),
      doc('expired', { organizationId: 'institution', dataFecho: '2000-01-01' }),
      ...['draft', 'pending_review', 'closed', 'disabled'].map(status => doc(status, { organizationId: 'institution', status })),
    ] });
    const res = response(); await opportunities({ method: 'GET' }, res);
    expect(where).toHaveBeenCalledTimes(1);
    expect(where).toHaveBeenCalledWith('organizationId', '==', 'institution');
    const result = res.json.mock.calls[0][0].opportunities;
    expect(result).toHaveLength(1); expect(result[0].id).toBe('real');
    expect(result[0].createdAt).toBe('2026-01-01T00:00:00.000Z');
    expect(result[0]).not.toHaveProperty('internalSecret');
  });
  it('uses legacy company ID only for a verified empresa when no organization exists', async () => {
    organization.exists = false;
    getJobs.mockResolvedValue({ docs: [doc('legacy', { companyId: 'institution' }),
      doc('conflict', { companyId: 'institution', organizationId: 'other' })] });
    const res = response(); await opportunities({ method: 'GET' }, res);
    expect(where).toHaveBeenCalledWith('companyId', '==', 'institution');
    expect(res.json.mock.calls[0][0].opportunities.map((job: { id: string }) => job.id)).toEqual(['legacy']);
  });
  it.each([
    { userType: 'candidato', verificationStatus: 'verified' },
    { userType: 'empresa', verificationStatus: 'pending' },
    { userType: 'empresa', verificationStatus: 'verified', organizationId: 'other' },
    { userType: 'empresa', verificationStatus: 'verified', status: 'suspended' },
  ])('rejects invalid legacy identity %p', async (data) => {
    organization.exists = false; user.data = () => data;
    const res = response(); await opportunities({ method: 'GET' }, res);
    expect(res.json).toHaveBeenCalledWith({ opportunities: [] }); expect(where).not.toHaveBeenCalled();
  });
  it('does not report configuration or service details on read failure', async () => {
    getJobs.mockRejectedValue(new Error('private project details'));
    const res = response(); await opportunities({ method: 'GET' }, res);
    expect(res.status).toHaveBeenCalledWith(503);
    expect(JSON.stringify(res.json.mock.calls)).not.toContain('private project');
  });
  it.each([opportunities, applications])('guards unsupported methods', async (handler) => {
    const res = response(); await handler({ method: 'DELETE' }, res);
    expect(res.status).toHaveBeenCalledWith(405); expect(res.setHeader).toHaveBeenCalledWith('Allow', expect.any(Array));
    expect(admin.firestore).not.toHaveBeenCalled();
  });
  it.each([
    ['name', ''], ['email', 'invalid'], ['area', ''], ['message', 'short'],
    ['consent', false], ['consent', undefined], ['consentVersion', 'old'],
    ['phone', 'not a phone'], ['portfolio', 'javascript:alert(1)'],
    ['cv', { ...pdf, base64: '%%%=' }], ['cv', { ...pdf, base64: Buffer.from('fake').toString('base64') }],
    ['cv', { ...pdf, contentType: 'image/png' }], ['cv', { ...pdf, name: '../cv.pdf' }],
  ])('rejects invalid %s before persistence', async (field, value) => {
    const res = response(); await applications(request({ ...payload, [field as string]: value }), res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json.mock.calls[0][0]).toEqual(expect.objectContaining({ field: expect.any(String), fieldErrors: expect.any(Object), error: expect.any(String) }));
    expect(create).not.toHaveBeenCalled(); expect(save).not.toHaveBeenCalled();
  });
  it('accepts a valid exactly 2 MiB PDF without regex stack overflow; rejects larger PDF', () => {
    const bytes = Buffer.alloc(MAX_CV_BYTES, 32);
    bytes.write('%PDF-1.7\n'); bytes.write('\n%%EOF', bytes.length - 6);
    expect(validateInternalApplication({ ...payload, cv: { ...pdf, base64: bytes.toString('base64') } }).cv?.buffer.length).toBe(MAX_CV_BYTES);
    expect(() => validateInternalApplication({ ...payload, cv: { ...pdf, base64: Buffer.concat([bytes, Buffer.from(' ')]).toString('base64') } })).toThrow();
  });
  it('persists normalized data, consent evidence and no client-supplied privileged fields', async () => {
    const res = response(); await applications(request({ ...payload, status: 'approved', source: 'forged' }), res);
    expect(res.status).toHaveBeenCalledWith(201);
    expect(create).toHaveBeenCalledWith(expect.objectContaining({ email: 'ana@example.com', consentVersion: 'careers-v1', consentAt: 'SERVER_TIME', status: 'new', source: 'careers', cv: null }));
    expect(save).not.toHaveBeenCalled();
  });
  it('stores private CV with no download token or public URL in response or document', async () => {
    const res = response(); await applications(request({ ...payload, cv: pdf }), res);
    expect(file).toHaveBeenCalledWith('internal-careers/application-1/cv.pdf');
    expect(save).toHaveBeenCalledWith(expect.any(Buffer), { resumable: false, metadata: {
      contentType: 'application/pdf', cacheControl: 'private, no-store', contentDisposition: 'attachment; filename="cv.pdf"',
    } });
    expect(create.mock.calls[0][0].cv).toEqual({ storagePath: 'internal-careers/application-1/cv.pdf', name: 'curriculo.pdf', contentType: 'application/pdf', size: Buffer.from(pdf.base64, 'base64').length });
    expect(JSON.stringify(res.json.mock.calls)).not.toMatch(/base64|storagePath|token|https/);
  });
  it.each(['storage', 'firestore', 'cleanup'])('fails safely on %s failure', async (service) => {
    if (service === 'storage') save.mockRejectedValue(new Error('secret'));
    else create.mockRejectedValue(new Error('secret'));
    if (service === 'cleanup') remove.mockRejectedValue(new Error('secret cleanup'));
    const res = response(); await applications(request({ ...payload, cv: pdf }), res);
    expect(res.status).toHaveBeenCalledWith(503);
    expect(remove).toHaveBeenCalledWith({ ignoreNotFound: true });
    expect(JSON.stringify(res.json.mock.calls)).not.toContain('secret');
    if (service === 'storage') expect(create).not.toHaveBeenCalled();
  });
  it.each([0, 1])('short circuits denied rate limit number %i', async (index) => {
    if (index) jest.mocked(enforceApiRateLimit).mockResolvedValueOnce(true);
    jest.mocked(enforceApiRateLimit).mockResolvedValueOnce(false);
    await applications(request(), response());
    expect(create).not.toHaveBeenCalled();
    expect(enforceApiRateLimit).toHaveBeenCalledWith(expect.anything(), expect.anything(), expect.objectContaining({ failClosed: true }));
  });
  it('hashes email rate partition and fails closed on limiter exceptions', async () => {
    await applications(request(), response());
    expect(jest.mocked(enforceApiRateLimit).mock.calls[1]?.[2]).toEqual(expect.objectContaining({ limit: 3, windowMs: 86400000, partition: expect.stringMatching(/^[a-f0-9]{64}$/) }));
    create.mockClear(); jest.mocked(enforceApiRateLimit).mockRejectedValue(new Error('unavailable'));
    const res = response(); await applications(request(), res);
    expect(res.status).toHaveBeenCalledWith(503); expect(create).not.toHaveBeenCalled();
  });
  it.each(['https://evil.example', 'null'])('rejects foreign Origin %s before DB access', async (origin) => {
    const res = response(); await applications(request(payload, { origin }), res);
    expect(res.status).toHaveBeenCalledWith(403); expect(enforceApiRateLimit).not.toHaveBeenCalled();
  });
  it('accepts same Origin and fails closed when canonical site config is missing', async () => {
    const res = response(); await applications(request(payload, { origin: 'https://empregostp.com' }), res);
    expect(res.status).toHaveBeenCalledWith(201);
    delete process.env.NEXT_PUBLIC_SITE_URL; create.mockClear();
    const unavailable = response(); await applications(request(payload, { origin: 'https://empregostp.com' }), unavailable);
    expect(unavailable.status).toHaveBeenCalledWith(503); expect(create).not.toHaveBeenCalled();
  });
  it('requires JSON content type', async () => {
    const res = response(); await applications(request(payload, { 'content-type': 'text/plain' }), res);
    expect(res.status).toHaveBeenCalledWith(415); expect(create).not.toHaveBeenCalled();
  });
});
