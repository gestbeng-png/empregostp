import { render, screen } from '@testing-library/react';

import ApplicationModal from '../../../components/ApplicationModal';
import {
  stripExcludedApplicationFields,
  validateApplicationForm,
} from '../../../lib/applicationForm';

const minimal = {
  fullName: 'Ana Costa',
  email: 'ana@example.st',
  phone: '+239 991 2345',
  consentTruthful: true,
  consentDataProcessing: true,
};

describe('F2.3/H7 — formulário de candidatura', () => {
  test('não exige data de nascimento, nacionalidade, referências nem carta', () => {
    expect(validateApplicationForm(minimal)).toEqual({});
  });

  test('exige nome, contactos válidos e os dois consentimentos', () => {
    expect(Object.keys(validateApplicationForm({})).sort()).toEqual([
      'consentDataProcessing',
      'consentTruthful',
      'email',
      'fullName',
      'phone',
    ]);
    expect(
      Object.keys(
        validateApplicationForm({
          ...minimal,
          email: 'x',
          consentDataProcessing: false,
        }),
      ).sort(),
    ).toEqual(['consentDataProcessing', 'email']);
  });

  test('a carta só é obrigatória se a vaga a pedir', () => {
    expect(
      validateApplicationForm(minimal, { requireCoverLetter: true }),
    ).toEqual({
      coverLetter: 'Esta vaga pede uma carta de motivação.',
    });
  });

  test('data de nascimento e nacionalidade nunca são guardadas', () => {
    expect(
      stripExcludedApplicationFields({
        ...minimal,
        birthDate: '1990-01-01',
        nationality: 'ST',
      }),
    ).toEqual(minimal);
  });

  test('o modal não mostra os campos sensíveis', () => {
    const form = {
      fullName: '',
      email: '',
      phone: '',
      location: '',
      nationality: '',
      birthDate: '',
      workAuthorization: '',
      education: [],
      languages: [],
      coverLetter: '',
      experienceYears: '',
      availability: '',
      salaryExpectation: '',
      referralSource: '',
      references: [],
      consentTruthful: false,
      consentDataProcessing: false,
      consentSimilarJobs: false,
      documents: {},
    };
    render(
      <ApplicationModal
        isOpen
        onClose={() => undefined}
        job={{ titulo: 'Motorista' }}
        form={form}
        onChange={() => undefined}
        onSubmit={() => undefined}
      />,
    );
    expect(screen.queryByLabelText(/Data de nascimento/)).toBeNull();
    expect(screen.queryByLabelText(/Nacionalidade/)).toBeNull();
    expect(screen.getByLabelText(/Nome completo/)).toBeTruthy();
  });
});
