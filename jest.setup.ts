import { TextDecoder, TextEncoder } from 'util';

import '@testing-library/jest-dom';

// ADR-019: «Recrutamento e equipa» está desligado por defeito no site; os
// testes dos handlers e da UI correm com a área ligada. O estado desligado tem
// teste próprio (tests/unit/security/recruitmentRetired.test.ts).
process.env.NEXT_PUBLIC_RECRUITMENT_WORKSPACE_ENABLED = 'true';

// jsdom's global sandbox doesn't include TextEncoder/TextDecoder even though
// Node has provided them globally since v11. Server-only modules pulled in
// transitively by page-level imports (firebase-admin -> jwks-rsa -> jose)
// reference them at module load time and crash without this polyfill.
if (typeof globalThis.TextEncoder === 'undefined') {
  globalThis.TextEncoder =
    TextEncoder as unknown as typeof globalThis.TextEncoder;
}
if (typeof globalThis.TextDecoder === 'undefined') {
  globalThis.TextDecoder =
    TextDecoder as unknown as typeof globalThis.TextDecoder;
}

Object.defineProperty(window, 'matchMedia', {
  configurable: true,
  value: (query: string): MediaQueryList => ({
    addEventListener: jest.fn(),
    addListener: jest.fn(),
    dispatchEvent: jest.fn(),
    matches: false,
    media: query,
    onchange: null,
    removeEventListener: jest.fn(),
    removeListener: jest.fn(),
  }),
  writable: true,
});
