import {
  CV_FRESHNESS_MONTHS,
  isCvFresh,
  normalizeRequiredDocuments,
  resolveDocumentRequirements,
  validateApplicationDocuments,
} from '../../../lib/applicationDocuments';

const AGORA = new Date('2026-08-26T00:00:00Z');
const mesesAtras = (n: number) => {
  const data = new Date(AGORA);
  data.setMonth(data.getMonth() - n);
  return data.toISOString();
};

describe('o que a empresa exige na vaga', () => {
  test('CV e certificados entram sempre, mesmo que a vaga não os peça', () => {
    expect(normalizeRequiredDocuments({ types: [] }).types).toEqual([
      'cv',
      'certificates',
    ]);
  });

  test('os opcionais só entram quando a empresa os escolhe', () => {
    const { types } = normalizeRequiredDocuments({
      types: ['criminal_record', 'id_document'],
    });

    expect(types).toEqual([
      'cv',
      'certificates',
      'criminal_record',
      'id_document',
    ]);
    expect(types).not.toContain('medical_certificate');
  });

  test('um tipo inventado é descartado', () => {
    expect(
      normalizeRequiredDocuments({ types: ['nota_da_mae'] }).types,
    ).not.toContain('nota_da_mae');
  });

  test('a descrição livre só sobrevive com "outros" ligado', () => {
    expect(
      normalizeRequiredDocuments({ types: ['other'], otherLabel: '  Carta  de condução  ' })
        .otherLabel,
    ).toBe('Carta de condução');
    expect(
      normalizeRequiredDocuments({ types: [], otherLabel: 'Carta' }).otherLabel,
    ).toBe('');
  });
});

describe('CV atualizado', () => {
  test.each([
    [mesesAtras(1), true],
    [mesesAtras(CV_FRESHNESS_MONTHS - 1), true],
    [mesesAtras(CV_FRESHNESS_MONTHS + 1), false],
    ['', false],
    [null, false],
    ['nao-e-data', false],
  ])('%s -> %s', (valor, esperado) => {
    expect(isCvFresh(valor as string, AGORA)).toBe(esperado);
  });
});

describe('o que ainda falta entregar', () => {
  const vaga = { requiredDocuments: { types: ['criminal_record'] } };

  test('um CV recente no perfil não é pedido outra vez', () => {
    const requisitos = resolveDocumentRequirements({
      job: vaga,
      profile: { cvUrl: 'https://x/cv.pdf', cvUpdatedAt: mesesAtras(2) },
      agora: AGORA,
    });

    const cv = requisitos.find((item) => item.id === 'cv');
    expect(cv?.satisfiedByProfile).toBe(true);
    expect(cv?.needsUpload).toBe(false);
  });

  test('um CV antigo volta a ser pedido, e diz porquê', () => {
    const requisitos = resolveDocumentRequirements({
      job: vaga,
      profile: { cvUrl: 'https://x/cv.pdf', cvUpdatedAt: mesesAtras(14) },
      agora: AGORA,
    });

    const cv = requisitos.find((item) => item.id === 'cv');
    expect(cv?.needsUpload).toBe(true);
    expect(cv?.reason).toMatch(/mais de 6 meses/);
  });

  test('certificados já no perfil não são pedidos outra vez', () => {
    const requisitos = resolveDocumentRequirements({
      job: vaga,
      profile: { certificateFiles: ['https://x/a.pdf', 'https://x/b.pdf'] },
      agora: AGORA,
    });

    const certificados = requisitos.find(
      (item) => item.id === 'certificates',
    );
    expect(certificados?.satisfiedByProfile).toBe(true);
    expect(certificados?.reason).toMatch(/2 certificados/);
  });

  test('o registo criminal só aparece porque a vaga o exige', () => {
    const comRegisto = resolveDocumentRequirements({ job: vaga, agora: AGORA });
    const semRegisto = resolveDocumentRequirements({
      job: { requiredDocuments: { types: [] } },
      agora: AGORA,
    });

    expect(comRegisto.map((i) => i.id)).toContain('criminal_record');
    expect(semRegisto.map((i) => i.id)).not.toContain('criminal_record');
  });

  test('"outros documentos" mostra a descrição escrita pela empresa', () => {
    const requisitos = resolveDocumentRequirements({
      job: {
        requiredDocuments: {
          types: ['other'],
          otherLabel: 'Carta de condução categoria B',
        },
      },
      agora: AGORA,
    });

    expect(requisitos.find((i) => i.id === 'other')?.label).toBe(
      'Carta de condução categoria B',
    );
  });
});

describe('validação da entrega', () => {
  const requisitos = resolveDocumentRequirements({
    job: { requiredDocuments: { types: ['criminal_record'] } },
    profile: { cvUrl: 'https://x/cv.pdf', cvUpdatedAt: mesesAtras(1) },
    agora: AGORA,
  });

  test('acusa os documentos em falta pelo nome', () => {
    const erros = validateApplicationDocuments(requisitos, {});

    expect(erros.cv).toBeUndefined(); // veio do perfil
    expect(erros.certificates).toMatch(/Certificados/);
    expect(erros.criminal_record).toMatch(/Registo criminal/);
  });

  test('aceita quando tudo o que faltava foi entregue', () => {
    const erros = validateApplicationDocuments(requisitos, {
      certificates: [{ url: 'https://x/c.pdf', name: 'c.pdf' }],
      criminal_record: { url: 'https://x/r.pdf', name: 'r.pdf' },
    });

    expect(erros).toEqual({});
  });

  test('um objeto sem URL não conta como entregue', () => {
    const erros = validateApplicationDocuments(requisitos, {
      criminal_record: { name: 'r.pdf' },
    });

    expect(erros.criminal_record).toBeDefined();
  });
});
