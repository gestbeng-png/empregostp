import { render, screen } from '@testing-library/react';

import VerificationReviewModal from '../../../components/admin/VerificationReviewModal';

test('o admin consulta a descrição antes do respetivo link e mantém documentos antigos', () => {
  render(
    <VerificationReviewModal
      selectedVerification={{
        candidateName: 'Candidato de teste',
        candidateEmail: 'candidate@example.com',
        verificationMethod: 'competencies',
        status: 'pending',
        verificationItems: {
          competencies: {
            requested: true,
            label: 'Competências',
            status: 'pending',
            evidence: [
              {
                url: 'https://example.com/projeto',
                description: 'Sistema de stock que desenvolvi.',
                label: 'Link de prova 1',
              },
              {
                url: 'https://example.com/artigo',
                description: 'Artigo técnico sobre testes.',
                label: 'Link de prova 2',
              },
              {
                url: 'https://example.com/certificado.pdf',
                label: 'Certificado antigo.pdf',
              },
              { url: 'javascript:alert(1)', label: 'Link inseguro' },
            ],
          },
        },
      }}
      closeModal={jest.fn()}
      reviewReason=""
      setReviewReason={jest.fn()}
      processAction={jest.fn()}
      processingKey=""
    />,
  );
  const first = screen.getByRole('link', { name: 'Link de prova 1' });
  const second = screen.getByRole('link', { name: 'Link de prova 2' });
  expect(first).toHaveAttribute('href', 'https://example.com/projeto');
  expect(first.previousElementSibling).toHaveTextContent(
    'Sistema de stock que desenvolvi.',
  );
  expect(second.previousElementSibling).toHaveTextContent(
    'Artigo técnico sobre testes.',
  );
  expect(first.closest('li')).not.toHaveTextContent(
    'Artigo técnico sobre testes.',
  );
  expect(
    screen.getByRole('link', { name: 'Certificado antigo.pdf' }),
  ).toHaveAttribute('href', 'https://example.com/certificado.pdf');
  expect(
    screen.queryByRole('link', { name: 'Link inseguro' }),
  ).not.toBeInTheDocument();
});
