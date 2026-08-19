import { buildJobAlertEmail } from '../../../lib/jobAlertEmail';
import {
  buildJobAlertFilterKey,
  buildJobAlertId,
  buildJobAlertUnsubscribeUrl,
  createJobAlertUnsubscribeToken,
  findEquivalentActiveJobAlert,
  hashJobAlertUnsubscribeToken,
  isValidJobAlertUnsubscribeToken,
} from '../../../lib/jobAlertSubscription';

describe('subscrições seguras de alertas de vagas', () => {
  test('normaliza filtros equivalentes e gera uma identidade determinística', () => {
    const first = {
      search: '  Gestor   de Projeto ',
      localizacao: 'São Tomé',
      tipoContrato: 'FULL-TIME',
      minSalary: '3500',
    };
    const second = {
      search: 'gestor de projeto',
      localizacao: 'SÃO TOMÉ',
      tipoContrato: 'full-time',
      minSalary: 3500,
    };

    expect(buildJobAlertFilterKey(first)).toBe(
      buildJobAlertFilterKey(second),
    );
    expect(buildJobAlertId('Pessoa@EXAMPLE.com', first)).toBe(
      buildJobAlertId('pessoa@example.com', second),
    );
  });

  test('deteta subscrição equivalente ativa, mas permite reativar uma cancelada', () => {
    const active = {
      id: 'active',
      data: () => ({
        active: true,
        filters: { search: 'Programador', modalidade: 'Remoto' },
      }),
    };
    const inactive = {
      id: 'inactive',
      data: () => ({
        active: false,
        status: 'unsubscribed',
        filters: { search: 'Designer' },
      }),
    };

    expect(
      findEquivalentActiveJobAlert([inactive, active], {
        search: ' programador ',
        modalidade: 'remoto',
      }),
    ).toBe(active);
    expect(
      findEquivalentActiveJobAlert([inactive], { search: 'designer' }),
    ).toBeNull();
  });

  test('usa token aleatório, guarda apenas o hash e compara em tempo constante', () => {
    const firstToken = createJobAlertUnsubscribeToken();
    const secondToken = createJobAlertUnsubscribeToken();
    const hash = hashJobAlertUnsubscribeToken(firstToken);

    expect(firstToken).toHaveLength(43);
    expect(secondToken).not.toBe(firstToken);
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
    expect(hash).not.toContain(firstToken);
    expect(isValidJobAlertUnsubscribeToken(firstToken, hash)).toBe(true);
    expect(isValidJobAlertUnsubscribeToken(secondToken, hash)).toBe(false);
    expect(isValidJobAlertUnsubscribeToken('token-curto', hash)).toBe(false);
  });

  test('mantém o token no fragmento e inclui cancelamento no HTML e texto', () => {
    const token = createJobAlertUnsubscribeToken();
    const url = buildJobAlertUnsubscribeUrl(
      'alert-1',
      token,
      'https://empregostp.test',
    );
    const parsed = new URL(url);

    expect(parsed.search).toBe('');
    expect(parsed.hash).toContain(`token=${token}`);
    expect(parsed.pathname).toBe('/alertas/cancelar');

    const email = buildJobAlertEmail({
      jobs: [],
      baseUrl: 'https://empregostp.test',
      unsubscribeUrl: url,
    });
    expect(email.html).toContain('Cancelar este alerta');
    expect(email.html).toContain(url.replace(/&/g, '&amp;'));
    expect(email.text).toContain(url);
  });
});
