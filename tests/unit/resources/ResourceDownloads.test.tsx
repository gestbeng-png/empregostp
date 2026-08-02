import { render, screen } from '@testing-library/react';
import type { ComponentType, ReactNode } from 'react';

import {
  DEFAULT_GUIDES,
  DEFAULT_TEMPLATES,
  DEFAULT_TOOLS,
} from '../../../lib/resourcesCatalog';
import RecursosPage from '../../../pages/recursos';

const TestableRecursosPage = RecursosPage as unknown as ComponentType<{
  faqs: Array<{ answer: string; id: string; question: string }>;
  guides: typeof DEFAULT_GUIDES;
  professionalAccess: { allowed: boolean };
  templates: typeof DEFAULT_TEMPLATES;
  tools: typeof DEFAULT_TOOLS;
}>;

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

describe('catálogo público de recursos', () => {
  test('disponibiliza para descarga todos os modelos incluídos na aplicação', () => {
    render(
      <TestableRecursosPage
        templates={DEFAULT_TEMPLATES}
        guides={DEFAULT_GUIDES}
        tools={DEFAULT_TOOLS}
        faqs={[]}
        professionalAccess={{ allowed: true }}
      />,
    );

    const downloadLinks = screen.getAllByRole('link', {
      name: /descarregar/i,
    });

    for (const template of DEFAULT_TEMPLATES) {
      expect(
        downloadLinks.some(
          (link) =>
            link.getAttribute('href')?.includes('kind=template') &&
            link.getAttribute('href')?.includes(`id=${template.id}`),
        ),
      ).toBe(true);
    }

    expect(screen.queryByText('Em breve')).not.toBeInTheDocument();
  });
});
