// Fonte única da instância Firestore client-side. Manter uma segunda chamada
// a getFirestore noutra fachada pode misturar instâncias no bundle do Next e
// causar: "Expected first argument to collection()...".
import { db } from './firebase';

export default db;
