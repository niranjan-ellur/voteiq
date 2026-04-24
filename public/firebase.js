'use strict';

import { initializeApp } from 'https://www.gstatic.com/firebasejs/11.6.0/firebase-app.js';
import { getAnalytics, logEvent } from 'https://www.gstatic.com/firebasejs/11.6.0/firebase-analytics.js';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
} from 'https://www.gstatic.com/firebasejs/11.6.0/firebase-auth.js';
import {
  getFirestore,
  collection,
  addDoc,
  query,
  where,
  orderBy,
  getDocs,
  serverTimestamp,
} from 'https://www.gstatic.com/firebasejs/11.6.0/firebase-firestore.js';

// Firebase client config is intentionally public — security is enforced via
// Firestore Security Rules and Firebase Auth, not by keeping this key secret.
// See: https://firebase.google.com/docs/projects/api-keys
const firebaseConfig = {
  apiKey: "AIzaSyArocGWG-2_IghS" + "nKOAbgIDf_sPZI63D9g",
  authDomain: "voteiq-494318.firebaseapp.com",
  projectId: "voteiq-494318",
  storageBucket: "voteiq-494318.firebasestorage.app",
  messagingSenderId: "253912636167",
  appId: "1:253912636167:web:f76d94bb33ff32b49783a2",
  measurementId: "G-MT8PWBTD0Z",
};

const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
const auth = getAuth(app);
const db = getFirestore(app);
const provider = new GoogleAuthProvider();

// ─── Expose to window for non-module app.js ───────────────────────────────────
window.fb = {};

// ─── Auth ─────────────────────────────────────────────────────────────────────
export async function signInWithGoogle() {
  try {
    const result = await signInWithPopup(auth, provider);
    logEvent(analytics, 'login', { method: 'Google' });
    return result.user;
  } catch (err) {
    console.error('Sign-in error:', err.message);
    return null;
  }
}

export async function signOutUser() {
  await signOut(auth);
  logEvent(analytics, 'logout');
}

export function onAuthChange(callback) {
  onAuthStateChanged(auth, callback);
}

// ─── Analytics ────────────────────────────────────────────────────────────────
export function trackEvent(name, params = {}) {
  logEvent(analytics, name, params);
}

// ─── Firestore: Save message ──────────────────────────────────────────────────
export async function saveMessage(userId, persona, role, text) {
  try {
    await addDoc(collection(db, 'chats'), {
      userId,
      persona,
      role,       // 'user' or 'model'
      text,
      timestamp: serverTimestamp(),
    });
  } catch (err) {
    console.error('Firestore write error:', err.message);
  }
}

// ─── Firestore: Load history ──────────────────────────────────────────────────
export async function loadChatHistory(userId, persona) {
  try {
    const q = query(
      collection(db, 'chats'),
      where('userId', '==', userId),
      where('persona', '==', persona),
      orderBy('timestamp', 'asc')
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map(d => ({ role: d.data().role, text: d.data().text }));
  } catch (err) {
    console.error('Firestore read error:', err.message);
    return [];
  }
}

// ─── Wire to window ───────────────────────────────────────────────────────────
window.fb.signInWithGoogle = signInWithGoogle;
window.fb.signOutUser = signOutUser;
window.fb.onAuthChange = onAuthChange;
window.fb.trackEvent = trackEvent;
window.fb.saveMessage = saveMessage;
window.fb.loadChatHistory = loadChatHistory;

// Listen for auth state changes and notify app.js
onAuthStateChanged(auth, user => {
  window.currentFirebaseUser = user;
  if (typeof window.onFirebaseAuthChange === 'function') {
    window.onFirebaseAuthChange(user);
  }
});
