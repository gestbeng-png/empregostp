import { isAdminPublishedJob } from '../../../lib/adminJobManagement';

describe('identificação de vagas publicadas pelo Admin', () => {
  test('reconhece os marcadores atuais e legados de publicação administrativa', () => {
    expect(isAdminPublishedJob({ createdByRole: 'admin' })).toBe(true);
    expect(isAdminPublishedJob({ companySource: 'external' })).toBe(true);
    expect(isAdminPublishedJob({ isExternalCompany: true })).toBe(true);
    expect(isAdminPublishedJob({ createdBy: 'admin-1' }, 'admin-1')).toBe(true);
  });

  test('não classifica uma publicação normal da empresa como vaga do Admin', () => {
    expect(
      isAdminPublishedJob({
        companyId: 'company-1',
        createdBy: 'company-1',
        createdByRole: 'empresa',
      }),
    ).toBe(false);
  });
});
