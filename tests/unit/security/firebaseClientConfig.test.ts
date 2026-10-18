import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { createFirebaseClientConfig } from '../../../lib/firebaseClientConfig';

const validEnvironment = {
  NEXT_PUBLIC_FIREBASE_API_KEY: 'fake-api-key',
  NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: 'fake-project.firebaseapp.test',
  NEXT_PUBLIC_FIREBASE_PROJECT_ID: 'fake-project',
  NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: 'fake-project.firebasestorage.test',
  NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: '123456789',
  NEXT_PUBLIC_FIREBASE_APP_ID: '1:123456789:web:fake',
  NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID: 'G-FAKE123',
};

describe('configuração Firebase do cliente', () => {
  test('mapeia apenas valores válidos para o formato do SDK', () => {
    expect(createFirebaseClientConfig(validEnvironment)).toEqual({
      apiKey: 'fake-api-key',
      authDomain: 'fake-project.firebaseapp.test',
      projectId: 'fake-project',
      storageBucket: 'fake-project.firebasestorage.test',
      messagingSenderId: '123456789',
      appId: '1:123456789:web:fake',
      measurementId: 'G-FAKE123',
    });
  });

  test('rejeita valores ausentes ou em branco numa ordem determinística', () => {
    expect(() =>
      createFirebaseClientConfig({
        ...validEnvironment,
        NEXT_PUBLIC_FIREBASE_API_KEY: ' ',
        NEXT_PUBLIC_FIREBASE_PROJECT_ID: undefined,
      }),
    ).toThrow(
      'Configuração Firebase em falta: NEXT_PUBLIC_FIREBASE_API_KEY, NEXT_PUBLIC_FIREBASE_PROJECT_ID',
    );
  });

  test('nunca inclui valores recebidos na mensagem de erro', () => {
    const canary = 'valor-secreto-canario';

    expect(() =>
      createFirebaseClientConfig({
        ...validEnvironment,
        NEXT_PUBLIC_FIREBASE_API_KEY: canary,
        NEXT_PUBLIC_FIREBASE_APP_ID: '',
      }),
    ).toThrow('NEXT_PUBLIC_FIREBASE_APP_ID');

    try {
      createFirebaseClientConfig({
        ...validEnvironment,
        NEXT_PUBLIC_FIREBASE_API_KEY: canary,
        NEXT_PUBLIC_FIREBASE_APP_ID: '',
      });
    } catch (error) {
      expect(String(error)).not.toContain(canary);
    }
  });

  test('o bootstrap e o service worker não contêm configuração inline', () => {
    const clientSource = readFileSync(
      resolve(process.cwd(), 'lib/firebaseApp.js'),
      'utf8',
    );
    const serviceWorkerSource = readFileSync(
      resolve(process.cwd(), 'public/sw.js'),
      'utf8',
    );

    expect(clientSource).toContain('createFirebaseClientConfig');
    for (const envName of Object.keys(validEnvironment)) {
      expect(clientSource).not.toMatch(
        new RegExp(`process\\.env\\.${envName}\\s*\\|\\|`),
      );
    }
    expect(serviceWorkerSource).toContain(
      "importScripts('/firebase-sw-config.js')",
    );
    expect(serviceWorkerSource).not.toMatch(/firebase\.initializeApp\(\s*\{/);
  });
});
