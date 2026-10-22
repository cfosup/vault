import { initializeApp, getApps } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut as firebaseSignOut,
} from 'firebase/auth';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || 'AIzaSyCowHwDuVindWDNXCQybBnD-WQWauQL-Ug',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || 'vault-cbf53.firebaseapp.com',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || 'vault-cbf53',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || 'vault-cbf53.firebasestorage.app',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '159985238588',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || '1:159985238588:web:fe413048a0ce5d7077b939',
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || 'G-RQY54PDHEP',
};

// Initialize Firebase once
export const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
export const auth = getAuth(app);

export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

/**
 * Trigger Google OAuth popup sign-in via Firebase
 */
export const signInWithGoogle = async () => {
  const result = await signInWithPopup(auth, googleProvider);
  const user = result.user;
  const idToken = await user.getIdToken();
  return {
    user,
    idToken,
    email: user.email,
    displayName: user.displayName,
    photoURL: user.photoURL,
    uid: user.uid,
  };
};

export const logoutFirebase = async () => {
  try {
    await firebaseSignOut(auth);
  } catch (err) {
    console.error('Firebase signout error:', err);
  }
};

export default app;
