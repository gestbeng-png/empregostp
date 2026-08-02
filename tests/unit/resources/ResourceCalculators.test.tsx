import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';

import CalculadoraImpostosPage from '../../../pages/recursos/calculadora-impostos';
import CalculadoraSalarialPage from '../../../pages/recursos/calculadora-salarial';

jest.mock('../../../components/PublicPageShell', () => ({
  __esModule: true,
  default: ({ children }: { children: ReactNode }) => <main>{children}</main>,
}));

jest.mock('../../../lib/firebaseAdmin', () => ({
  admin: {},
}));

jest.mock('../../../lib/resourcePremiumAccess', () => ({
  resolveProfessionalResourceAccess: jest.fn(),
}));

const marketData = {
  categories: [
    {
      id: 'tecnologia',
      medianMax: 9000,
      medianMin: 6000,
      name: 'Tecnologia',
      sampleSize: 8,
    },
  ],
  currency: 'Db',
  employerContributionRate: 0.06,
  minimumWageEffectiveDate: '2025-01-01',
  minWageMonthly: 2500,
  overallMedianMax: 9000,
  overallMedianMin: 6000,
  totalJobsWithSalary: 8,
};

describe('calculadoras profissionais de recursos', () => {
  test('atualiza a perspetiva e a estimativa salarial', async () => {
    const user = userEvent.setup();
    render(<CalculadoraSalarialPage marketData={marketData} />);

    expect(
      screen.getByRole('heading', { level: 1, name: 'Calculadora salarial' }),
    ).toBeVisible();
    expect(screen.getByLabelText('Área profissional')).toBeVisible();
    expect(screen.getByLabelText('Nível')).toBeVisible();
    expect(screen.getByLabelText('Anos de experiência')).toBeVisible();
    expect(screen.getByLabelText('Modelo de trabalho')).toBeVisible();

    const candidateMode = screen.getByRole('button', { name: 'Candidato' });
    const companyMode = screen.getByRole('button', { name: 'Empresa' });
    expect(candidateMode).toHaveAttribute('aria-pressed', 'true');

    await user.click(companyMode);
    expect(candidateMode).toHaveAttribute('aria-pressed', 'false');
    expect(companyMode).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByText('Orçamento mensal com encargos')).toBeVisible();

    const initialMinimum = screen.getByLabelText(
      'Faixa mínima mensal',
    ).textContent;
    const experience = screen.getByLabelText('Anos de experiência');
    await user.clear(experience);
    await user.type(experience, '10');
    expect(screen.getByLabelText('Faixa mínima mensal').textContent).not.toBe(
      initialMinimum,
    );
  });

  test('recalcula impostos e apresenta a contribuição independente', async () => {
    const user = userEvent.setup();
    render(<CalculadoraImpostosPage />);

    expect(
      screen.getByRole('heading', {
        level: 1,
        name: 'Calculadora de impostos',
      }),
    ).toBeVisible();
    expect(screen.getByLabelText('Salário bruto mensal, Db')).toBeVisible();
    expect(screen.getByLabelText('Tipo de vínculo')).toBeVisible();
    expect(screen.getByLabelText('Perfil da taxa do INSS')).toBeVisible();
    expect(screen.getByLabelText('Meses de referência anual')).toBeVisible();

    const initialNet = screen.getByLabelText(
      'Salário líquido mensal',
    ).textContent;
    const salary = screen.getByLabelText('Salário bruto mensal, Db');
    await user.clear(salary);
    await user.type(salary, '6000');
    expect(
      screen.getByLabelText('Salário líquido mensal').textContent,
    ).not.toBe(initialNet);

    await user.selectOptions(
      screen.getByLabelText('Tipo de vínculo'),
      'independente',
    );
    expect(
      screen.getByLabelText('Contribuição social manual, %'),
    ).toBeVisible();
  });
});
