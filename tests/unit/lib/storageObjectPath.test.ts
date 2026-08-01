import {
  extractStorageObjectPath,
  isPathOwnedBy,
  resolveOwnedStorageObjectPath,
} from '../../../lib/storageObjectPath';

describe('extractStorageObjectPath', () => {
  test('extrai e descodifica o caminho de um download URL do Firebase', () => {
    expect(
      extractStorageObjectPath(
        'https://firebasestorage.googleapis.com/v0/b/empregostp.firebasestorage.app/o/cvUrl%2Fuser-1%2F1700000000_cv.pdf?alt=media&token=abc',
      ),
    ).toBe('cvUrl/user-1/1700000000_cv.pdf');
  });

  test('suporta o host alternativo e caminhos com espaços', () => {
    expect(
      extractStorageObjectPath(
        'https://storage.googleapis.com/v0/b/bucket/o/certificados%2Fuser-1%2Fmeu%20diploma.pdf?alt=media',
      ),
    ).toBe('certificados/user-1/meu diploma.pdf');
  });

  test('aceita um caminho de storage já em formato simples', () => {
    expect(extractStorageObjectPath('cvUrl/user-1/cv.pdf')).toBe(
      'cvUrl/user-1/cv.pdf',
    );
  });

  test('rejeita hosts que não são do Firebase Storage', () => {
    expect(
      extractStorageObjectPath(
        'https://atacante.example.com/v0/b/bucket/o/cvUrl%2Fuser-1%2Fcv.pdf',
      ),
    ).toBeNull();
    expect(extractStorageObjectPath('https://example.com/cv.pdf')).toBeNull();
  });

  test('rejeita valores vazios, não-string e travessia de diretórios', () => {
    expect(extractStorageObjectPath('')).toBeNull();
    expect(extractStorageObjectPath(null)).toBeNull();
    expect(extractStorageObjectPath(42)).toBeNull();
    expect(extractStorageObjectPath('cvUrl/user-1/../../secret.pdf')).toBeNull();
    expect(
      extractStorageObjectPath(
        'https://firebasestorage.googleapis.com/v0/b/bucket/o/cvUrl%2F..%2Fpayment-proofs%2Fvitima%2Fproof.pdf',
      ),
    ).toBeNull();
  });
});

describe('isPathOwnedBy', () => {
  test('aceita apenas o prefixo e o dono exatos', () => {
    expect(isPathOwnedBy('cvUrl/user-1/cv.pdf', 'cvUrl', 'user-1')).toBe(true);
    expect(isPathOwnedBy('cvUrl/user-2/cv.pdf', 'cvUrl', 'user-1')).toBe(false);
    expect(
      isPathOwnedBy('payment-proofs/user-1/p.pdf', 'cvUrl', 'user-1'),
    ).toBe(false);
  });

  test('não é enganado por um uid que seja prefixo de outro', () => {
    expect(isPathOwnedBy('cvUrl/user-10/cv.pdf', 'cvUrl', 'user-1')).toBe(
      false,
    );
  });

  test('exige um ficheiro para lá do diretório do dono', () => {
    expect(isPathOwnedBy('cvUrl/user-1/', 'cvUrl', 'user-1')).toBe(false);
    expect(isPathOwnedBy('cvUrl/user-1', 'cvUrl', 'user-1')).toBe(false);
  });
});

describe('resolveOwnedStorageObjectPath', () => {
  test('devolve o caminho quando pertence ao dono declarado', () => {
    expect(
      resolveOwnedStorageObjectPath({
        ownerUid: 'user-1',
        prefix: 'cvUrl',
        value:
          'https://firebasestorage.googleapis.com/v0/b/bucket/o/cvUrl%2Fuser-1%2Fcv.pdf?alt=media&token=t',
      }),
    ).toBe('cvUrl/user-1/cv.pdf');
  });

  test('recusa um URL que aponta para o ficheiro de outro utilizador', () => {
    expect(
      resolveOwnedStorageObjectPath({
        ownerUid: 'atacante',
        prefix: 'cvUrl',
        value:
          'https://firebasestorage.googleapis.com/v0/b/bucket/o/cvUrl%2Fvitima%2Fcv.pdf?alt=media&token=t',
      }),
    ).toBeNull();
  });

  test('recusa um URL que aponta para outra área do bucket', () => {
    expect(
      resolveOwnedStorageObjectPath({
        ownerUid: 'atacante',
        prefix: 'cvUrl',
        value:
          'https://firebasestorage.googleapis.com/v0/b/bucket/o/payment-proofs%2Fatacante%2Fproof.pdf?alt=media&token=t',
      }),
    ).toBeNull();
  });

  test('aceita qualquer um dos prefixos permitidos quando recebe uma lista', () => {
    expect(
      resolveOwnedStorageObjectPath({
        ownerUid: 'user-1',
        prefix: ['cvUrl', 'certificados'],
        value: 'certificados/user-1/diploma.pdf',
      }),
    ).toBe('certificados/user-1/diploma.pdf');
  });
});
