// Firebase client SDK is used only for Google Sign-In (to obtain an ID token).
// All Firestore reads/writes go through our backend API using that token.
// No API keys are exposed beyond the Firebase config, which is intentionally public.
// See: https://firebase.google.com/docs/projects/api-keys

import { initializeApp } from 'https://www.gstatic.com/firebasejs/11.6.0/firebase-app.js';
import { getAnalytics, logEvent } from 'https://www.gstatic.com/firebasejs/11.6.0/firebase-analytics.js';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
} from 'https://www.gstatic.com/firebasejs/11.6.0/firebase-auth.js';

const firebaseConfig = {
  apiKey: 'AIzaSyArocGWG-2_IghSnKOAbgIDf_sPZI63D9g',
  authDomain: 'voteiq-494318.firebaseapp.com',
  projectId: 'voteiq-494318',
  storageBucket: 'voteiq-494318.firebasestorage.app',
  messagingSenderId: '253912636167',
  appId: '1:253912636167:web:f76d94bb33ff32b49783a2',
  measurementId: 'G-MT8PWBTD0Z',
};

const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
const auth = getAuth(app);
const provider = new GoogleAuthProvider();

async function signInWithGoogle() {
  try {
    await signInWithPopup(auth, provider);
  } catch (err) {
    console.error('Sign-in error:', err.message);
  }
}

async function signOutUser() {
  await signOut(auth);
  logEvent(analytics, 'logout');
}

function trackEvent(name, params = {}) {
  logEvent(analytics, name, params);
}

/** Get the current user's ID token for backend calls. */
async function getIdToken() {
  const user = auth.currentUser;
  if (!user) return null;
  return user.getIdToken();
}

/** Save a chat message via backend API (uses Firebase Admin SDK server-side). */
async function saveMessage(userId, persona, role, text) {
  try {
    const token = await getIdToken();
    if (!token) return;
    await fetch('/api/history/save', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({ persona, role, text }),
    });
  } catch (err) {
    console.error('Save message error:', err.message);
  }
}

/** Load chat history via backend API. */
async function loadChatHistory(userId, persona) {
  try {
    const token = await getIdToken();
    if (!token) return [];
    const res = await fetch(`/api/history?persona=${encodeURIComponent(persona)}`, {
      headers: { 'Authorization': `Bearer ${token}` },
    });
    if (!res.ok) return [];
    const { history } = await res.json();
    return history || [];
  } catch (err) {
    console.error('Load history error:', err.message);
    return [];
  }
}

// Notify app.js of auth state changes
onAuthStateChanged(auth, user => {
  document.dispatchEvent(new CustomEvent('firebase:authchange', { detail: { user } }));
});

window.firebase_api = { signInWithGoogle, signOutUser, trackEvent, saveMessage, loadChatHistory };
