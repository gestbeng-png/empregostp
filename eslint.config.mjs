import nextVitals from 'eslint-config-next/core-web-vitals';
import eslintConfigPrettier from 'eslint-config-prettier';
import importPlugin from 'eslint-plugin-import';
import tseslint from 'typescript-eslint';

const typeScriptStrict = tseslint.configs.strict.map((config) => ({
  ...config,
  files: ['**/*.{ts,tsx}'],
}));

const config = [
  ...nextVitals,
  ...typeScriptStrict,
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
    ignores: [
      '.next/**',
      '.next-e2e/**',
      '.next-mobile-build-final/**',
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
