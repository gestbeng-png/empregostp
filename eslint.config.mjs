import nextVitals from 'eslint-config-next/core-web-vitals';
import eslintConfigPrettier from 'eslint-config-prettier';
import importPlugin from 'eslint-plugin-import';
import globals from 'globals';
import tseslint from 'typescript-eslint';

const typeScriptStrict = tseslint.configs.strict.map((config) => ({
  ...config,
  files: ['**/*.{ts,tsx}'],
}));

const config = [
  ...nextVitals,
  ...typeScriptStrict,
  {
    // `no-undef` não estava activa e deixou passar dois erros que só apareciam
    // em runtime: `buildLoginUrl` usado sem import no painel da empresa (o
    // logout rebentava) e `styles` em vez de `adminStyles` no detalhe de
    // utilizador. Nos ficheiros TypeScript o compilador já garante isto, por
    // isso a regra fica apenas para JS/JSX.
    files: ['**/*.{js,jsx,mjs}'],
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node,
        ...globals.jest,
      },
    },
    rules: {
      'no-undef': 'error',
    },
  },
  {
    // O service worker corre noutro contexto: `importScripts`, `clients` e o
    // `firebase` carregado por script não existem no ambiente do browser.
    files: ['public/**/*.js'],
    languageOptions: {
      globals: {
        ...globals.serviceworker,
        firebase: 'readonly',
      },
    },
  },
  {
    files: ['**/*.{ts,tsx}'],
    plugins: {
      import: importPlugin,
    },
    rules: {
      '@typescript-eslint/consistent-type-imports': [
        'error',
        { prefer: 'type-imports' },
      ],
      '@typescript-eslint/explicit-module-boundary-types': 'error',
      '@typescript-eslint/no-explicit-any': 'error',
      'import/order': [
        'error',
        {
          alphabetize: { order: 'asc', caseInsensitive: true },
          groups: [
            'builtin',
            'external',
            'internal',
            'parent',
            'sibling',
            'index',
          ],
          'newlines-between': 'always',
          pathGroups: [
            {
              pattern: '@/**',
              group: 'internal',
              position: 'before',
            },
          ],
          pathGroupsExcludedImportTypes: ['builtin'],
        },
      ],
      'no-console': ['error', { allow: ['warn', 'error'] }],
    },
  },
  {
    // Artefactos gerados. `tmp/`, `private/` e `.next-mobile-build-final/` são
    // builds de Next produzidos por execuções de auditoria: sem os ignorar, o
    // ESLint analisa código compilado e devolve centenas de erros que não são
    // do código-fonte, tornando `npm run lint` inutilizável como gate.
    // Builds do Next (incluindo os dist dirs alternativos usados pelo E2E e
    // por execuções de auditoria, via NEXT_DIST_DIR) e artefactos gerados.
    // Analisar código compilado enche o relatório de erros que não são do
    // código-fonte e torna `npm run lint` inútil como gate.
    ignores: [
      '.next/**',
      '.next-*/**',
      'node_modules/**',
      'coverage/**',
      'tmp/**',
      'private/**',
    ],
  },
  {
    rules: {
      'react-hooks/set-state-in-effect': 'off',
    },
  },
  eslintConfigPrettier,
];

export default config;
