import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import app from './firebaseApp';
import auth from './firebaseAuth';

// Backward-compatible facade for routes that actually use these services.
// Auth-only consumers import firebaseAuth and do not load Firestore/Storage.
const db = getFirestore(app);
const storage = getStorage(app);

export { auth, db, app, storage };
export default app;
