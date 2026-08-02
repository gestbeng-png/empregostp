import type { Config } from 'jest';
import nextJest from 'next/jest.js';

const createJestConfig = nextJest({ dir: './' });

const config: Config = {
  clearMocks: true,
  collectCoverageFrom: [
    'application/**/*.{ts,tsx}',
    'domain/**/*.{ts,tsx}',
    'infrastructure/**/*.{ts,tsx}',
    'presentation/**/*.{ts,tsx}',
    '!**/*.d.ts',
  ],
  coverageDirectory: 'coverage',
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
  },
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
  testEnvironment: 'jsdom',
  // jsdom makes Jest resolve package "exports" with the `browser` condition.
  // Some server-only transitive deps (e.g. `jose`, pulled in by
  // firebase-admin -> jwks-rsa) only ship ESM under that condition, which
  // Jest can't parse since node_modules isn't transformed by default. An
  // empty condition list falls back to plain `require`/`main` resolution,
  // matching what actually runs in Node/Next.js server code.
  testEnvironmentOptions: {
    customExportConditions: [''],
  },
  testMatch: ['<rootDir>/tests/unit/**/*.test.{ts,tsx}'],
};

export default createJestConfig(config);
