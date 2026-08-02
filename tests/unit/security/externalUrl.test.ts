import { normalizeExternalUrl } from '../../../lib/externalUrl';

describe('normalização de links externos', () => {
  test('aceita HTTP(S) e acrescenta HTTPS a domínios simples', () => {
    expect(normalizeExternalUrl('example.com/perfil')).toBe(
      'https://example.com/perfil',
    );
    expect(normalizeExternalUrl('http://example.com')).toBe(
      'http://example.com/',
    );
  });

  test('rejeita esquemas executáveis e valores inválidos', () => {
    expect(normalizeExternalUrl('javascript:alert(1)')).toBe('');
    expect(normalizeExternalUrl('data:text/html,<script>')).toBe('');
    expect(normalizeExternalUrl('')).toBe('');
  });
});
