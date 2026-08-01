import {
  createPaymentProofFileName,
  parsePaymentProofDataUrl,
} from '../../../lib/paymentProofFile';

function toDataUrl(contentType: string, content: Buffer) {
  return `data:${contentType};base64,${content.toString('base64')}`;
}

describe('validação binária de comprovativos', () => {
  const validFiles = [
    {
      bytes: Buffer.from('%PDF-1.7\nconteúdo de teste'),
      contentType: 'application/pdf',
      extension: 'pdf',
    },
    {
      bytes: Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]),
      contentType: 'image/jpeg',
      extension: 'jpg',
    },
    {
      bytes: Buffer.from([
        0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00,
      ]),
      contentType: 'image/png',
      extension: 'png',
    },
  ];

  test.each(validFiles)(
    'aceita $contentType quando MIME e assinatura coincidem',
    ({ bytes, contentType, extension }) => {
      const parsed = parsePaymentProofDataUrl({
        contentType,
        fileBase64: toDataUrl(contentType, bytes),
      });

      expect(parsed).toMatchObject({ contentType, extension });
      expect(parsed.buffer).toEqual(bytes);
    },
  );

  test('normaliza image/jpg para JPEG', () => {
    const bytes = Buffer.from([0xff, 0xd8, 0xff, 0xe0]);

    expect(
      parsePaymentProofDataUrl({
        contentType: 'image/jpg',
        fileBase64: toDataUrl('image/jpg', bytes),
      }),
    ).toMatchObject({ contentType: 'image/jpeg', extension: 'jpg' });
  });

  test.each(['image/svg+xml', 'image/gif', 'image/webp'])(
    'rejeita o tipo não permitido %s',
    (contentType) => {
      expect(() =>
        parsePaymentProofDataUrl({
          contentType,
          fileBase64: toDataUrl(contentType, Buffer.from('<svg></svg>')),
        }),
      ).toThrow('Formato não suportado. Envie PDF, JPG ou PNG.');
    },
  );

  test('rejeita assinatura binária diferente do MIME', () => {
    const html = Buffer.from('<html>conteúdo malicioso</html>');

    expect(() =>
      parsePaymentProofDataUrl({
        contentType: 'image/png',
        fileBase64: toDataUrl('image/png', html),
      }),
    ).toThrow('O tipo do comprovativo não corresponde ao ficheiro.');
  });

  test('rejeita divergência entre MIME declarado e Data URL', () => {
    const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

    expect(() =>
      parsePaymentProofDataUrl({
        contentType: 'image/jpeg',
        fileBase64: toDataUrl('image/png', png),
      }),
    ).toThrow('O tipo do comprovativo não corresponde ao ficheiro.');
  });

  test.each([
    'data:application/pdf;base64,***',
    'data:application/pdf;base64,',
    'data:application/pdf,JVBERi0=',
  ])('rejeita Data URL/Base64 inválido', (fileBase64) => {
    expect(() => parsePaymentProofDataUrl({ fileBase64 })).toThrow(
      'Formato do comprovativo inválido',
    );
  });

  test('rejeita o ficheiro pelo tamanho real descodificado', () => {
    const pdf = Buffer.from('%PDF-123456');

    expect(() =>
      parsePaymentProofDataUrl({
        fileBase64: toDataUrl('application/pdf', pdf),
        maxFileSize: 4,
      }),
    ).toThrow('O comprovativo deve ter no máximo 10MB.');
  });

  test('gera nome seguro com extensão canónica', () => {
    expect(createPaymentProofFileName('../recibo.exe', 'pdf', 123)).toBe(
      'recibo.pdf',
    );
    expect(createPaymentProofFileName('', 'png', 123)).toBe(
      'comprovativo-123.png',
    );
  });
});
