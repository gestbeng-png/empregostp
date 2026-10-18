const requiredEnvironment = {
  NEXT_PUBLIC_FIREBASE_API_KEY: 'fake-api-key',
  NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: 'fake-project.firebaseapp.test',
  NEXT_PUBLIC_FIREBASE_PROJECT_ID: 'fake-project',
  NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: 'fake-project.firebasestorage.test',
  NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: '123456789',
  NEXT_PUBLIC_FIREBASE_APP_ID: '1:123456789:web:fake',
  NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID: 'G-FAKE123',
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
  const setPersistence = jest.fn();

  jest.doMock('firebase/app', () => ({ initializeApp, getApp, getApps }));
  jest.doMock('firebase/analytics', () => ({ getAnalytics }));
  jest.doMock('firebase/auth', () => ({
    browserLocalPersistence: 'local',
    getAuth,
    setPersistence,
  }));
  jest.doMock('firebase/firestore', () => ({
    getFirestore,
  }));
  jest.doMock('firebase/storage', () => ({
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
    expect(mocks.setPersistence).toHaveBeenCalledWith(mocks.auth, 'local');
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

  test('autenticação isolada partilha app e persistência sem inicializar Firestore/Storage', () => {
    const mocks: FirebaseMocks = installFirebaseMocks();
    let authOnly: Record<string, unknown> = {};
    jest.isolateModules(() => {
      authOnly = jest.requireActual('../../../lib/firebaseAuth');
    });
    expect(authOnly.default).toBe(mocks.auth);
    expect(authOnly.auth).toBe(mocks.auth);
    expect(mocks.initializeApp).toHaveBeenCalledTimes(1);
    expect(mocks.setPersistence).toHaveBeenCalledWith(mocks.auth, 'local');
    expect(mocks.getFirestore).not.toHaveBeenCalled();
    expect(mocks.getStorage).not.toHaveBeenCalled();
  });

  describe('Google Analytics adiado', () => {
    // O `import()` dinâmico resolve em microtarefas; esperar algumas voltas.
    const flush = async () => {
      for (let i = 0; i < 5; i += 1) await Promise.resolve();
    };

    beforeEach(() => jest.useFakeTimers());
    afterEach(() => {
      jest.useRealTimers();
      window.history.replaceState(null, '', '/');
    });

    test('não carrega antes de interação nem do tempo de reserva', async () => {
      const mocks: FirebaseMocks = installFirebaseMocks();
      loadFirebaseModule();
      jest.advanceTimersByTime(4000);
      await flush();
      expect(mocks.getAnalytics).not.toHaveBeenCalled();
    });

    test('carrega na primeira interação', async () => {
      const mocks: FirebaseMocks = installFirebaseMocks();
      loadFirebaseModule();
      window.dispatchEvent(new Event('pointerdown'));
      await flush();
      expect(mocks.getAnalytics).toHaveBeenCalledWith(mocks.app);
    });

    test('sem interação, carrega ao fim de 5 s', async () => {
      const mocks: FirebaseMocks = installFirebaseMocks();
      loadFirebaseModule();
      jest.advanceTimersByTime(5000);
      await flush();
      expect(mocks.getAnalytics).toHaveBeenCalledTimes(1);
    });

    test('nunca carrega na página de convite da equipa', async () => {
      window.history.replaceState(null, '', '/equipa/convite');
      const mocks: FirebaseMocks = installFirebaseMocks();
      loadFirebaseModule();
      window.dispatchEvent(new Event('pointerdown'));
      jest.advanceTimersByTime(5000);
      await flush();
      expect(mocks.getAnalytics).not.toHaveBeenCalled();
    });
  });
});
