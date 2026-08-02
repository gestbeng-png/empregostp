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
  testMatch: ['<rootDir>/tests/unit/**/*.test.{ts,tsx}'],
};

export default createJestConfig(config);
