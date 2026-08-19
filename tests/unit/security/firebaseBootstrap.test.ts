const requiredEnvironment = {
  NEXT_PUBLIC_FIREBASE_API_KEY: 'fake-api-key',
  NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: 'fake-project.firebaseapp.test',
  NEXT_PUBLIC_FIREBASE_PROJECT_ID: 'fake-project',
  NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: 'fake-project.firebasestorage.test',
  NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: '123456789',
  NEXT_PUBLIC_FIREBASE_APP_ID: '1:123456789:web:fake',
  NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID: 'G-FAKE123',
  NEXT_PUBLIC_USE_FIREBASE_EMULATORS: 'false',
};

type FirebaseMocks = ReturnType<typeof installFirebaseMocks>;

function installFirebaseMocks(existingApp = false) {
  const app = { name: 'fake-app' };
  const auth = { name: 'fake-auth' };
  const db = { name: 'fake-firestore' };
  const storage = { name: 'fake-storage' };
  const initializeApp = jest.fn(() => app);
  const getApp = jest.fn(() => app);
  const getApps = jest.fn(() => (existingApp ? [app] : []));
  const getAuth = jest.fn(() => auth);
  const getFirestore = jest.fn(() => db);
  const getStorage = jest.fn(() => storage);
  const getAnalytics = jest.fn();
  const connectAuthEmulator = jest.fn();
  const connectFirestoreEmulator = jest.fn();
  const connectStorageEmulator = jest.fn();
  const setPersistence = jest.fn();

  jest.doMock('firebase/app', () => ({ initializeApp, getApp, getApps }));
  jest.doMock('firebase/analytics', () => ({ getAnalytics }));
  jest.doMock('firebase/auth', () => ({
    browserLocalPersistence: 'local',
    connectAuthEmulator,
    getAuth,
    setPersistence,
  }));
  jest.doMock('firebase/firestore', () => ({
    connectFirestoreEmulator,
    getFirestore,
  }));
  jest.doMock('firebase/storage', () => ({
    connectStorageEmulator,
    getStorage,
  }));

  return {
    app,
    auth,
    db,
    storage,
    initializeApp,
    getApp,
    getAuth,
    getAnalytics,
    getFirestore,
    getStorage,
    connectAuthEmulator,
    connectFirestoreEmulator,
    connectStorageEmulator,
    setPersistence,
  };
}

function loadFirebaseModule(): Record<string, unknown> {
  let loadedModule: Record<string, unknown> | undefined;

  jest.isolateModules(() => {
    loadedModule = jest.requireActual('../../../lib/firebase');
  });

  if (!loadedModule) {
    throw new Error('Módulo Firebase não carregado');
  }

  return loadedModule;
}

describe('bootstrap Firebase do cliente', () => {
  const originalEnvironment = { ...process.env };

  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    process.env = { ...originalEnvironment, ...requiredEnvironment };
    delete (
      window as Window & {
        __EMPREGOSTP_FIREBASE_EMULATORS_CONNECTED__?: boolean;
      }
    ).__EMPREGOSTP_FIREBASE_EMULATORS_CONNECTED__;
  });

  afterAll(() => {
    process.env = originalEnvironment;
  });

  test('falha antes de inicializar o SDK quando falta configuração', () => {
    delete process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
    const mocks: FirebaseMocks = installFirebaseMocks();

    expect(() => loadFirebaseModule()).toThrow(
      'Configuração Firebase em falta: NEXT_PUBLIC_FIREBASE_API_KEY',
    );
    expect(mocks.initializeApp).not.toHaveBeenCalled();
  });

  test('inicializa o SDK apenas com a configuração explícita', () => {
    const mocks: FirebaseMocks = installFirebaseMocks();
    const loadedModule = loadFirebaseModule();

    expect(mocks.initializeApp).toHaveBeenCalledWith({
      apiKey: 'fake-api-key',
      authDomain: 'fake-project.firebaseapp.test',
      projectId: 'fake-project',
      storageBucket: 'fake-project.firebasestorage.test',
      messagingSenderId: '123456789',
      appId: '1:123456789:web:fake',
      measurementId: 'G-FAKE123',
    });
    expect(loadedModule).toMatchObject({
      app: mocks.app,
      auth: mocks.auth,
      db: mocks.db,
      storage: mocks.storage,
    });
  });

  test('reutiliza a aplicação Firebase existente', () => {
    const mocks: FirebaseMocks = installFirebaseMocks(true);

    loadFirebaseModule();

    expect(mocks.initializeApp).not.toHaveBeenCalled();
    expect(mocks.getApp).toHaveBeenCalledTimes(1);
  });

  test('isola Auth, Firestore e Storage e não inicia Analytics/Installations no modo emulador', () => {
    process.env.NEXT_PUBLIC_USE_FIREBASE_EMULATORS = 'true';
    process.env.NEXT_PUBLIC_FIREBASE_AUTH_EMULATOR_HOST = 'localhost:19099';
    process.env.NEXT_PUBLIC_FIRESTORE_EMULATOR_HOST = 'localhost:18080';
    process.env.NEXT_PUBLIC_FIREBASE_STORAGE_EMULATOR_HOST = 'localhost:19199';
    const mocks: FirebaseMocks = installFirebaseMocks();

    loadFirebaseModule();

    expect(mocks.connectAuthEmulator).toHaveBeenCalledWith(
      mocks.auth,
      'http://localhost:19099',
      { disableWarnings: true },
    );
    expect(mocks.connectFirestoreEmulator).toHaveBeenCalledWith(
      mocks.db,
      'localhost',
      18080,
    );
    expect(mocks.connectStorageEmulator).toHaveBeenCalledWith(
      mocks.storage,
      'localhost',
      19199,
    );
    expect(mocks.getAnalytics).not.toHaveBeenCalled();
    expect(mocks.setPersistence).toHaveBeenCalledWith(mocks.auth, 'local');
  });
});
