import {
  browserLocalPersistence,
  getAuth,
  setPersistence,
} from 'firebase/auth';
import app from './firebaseApp';

const auth = getAuth(app);
if (typeof window !== 'undefined') {
  setPersistence(auth, browserLocalPersistence);
}

export { auth };
export default auth;
