// Pré-carrega o .env.local antes do script alvo, via `node --import`.
//
// Fica separado do loadEnv.mjs de propósito: importar este ficheiro tem efeito
// secundário. Assim os scripts continuam a não ler o .env.local por si — o que
// os mantém testáveis com um ambiente controlado (ver
// tests/unit/security/firebaseServiceWorkerConfig.test.ts).
import { loadEnv } from './loadEnv.mjs';

loadEnv();
