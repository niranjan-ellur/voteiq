'use strict';

const admin = require('firebase-admin');

if (!admin.apps.length) {
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey,
    }),
  });
}

const db = admin.firestore();
const auth = admin.auth();

/** Verify a Firebase ID token and return the decoded claims. */
async function verifyIdToken(idToken) {
  return auth.verifyIdToken(idToken);
}

/** Save a chat message to Firestore. */
async function saveMessage(userId, persona, role, text) {
  await db.collection('chats').add({
    userId,
    persona,
    role,
    text,
    timestamp: admin.firestore.FieldValue.serverTimestamp(),
  });
}

/** Load chat history for a user/persona, newest 40 messages. */
async function loadChatHistory(userId, persona) {
  const snap = await db
    .collection('chats')
    .where('userId', '==', userId)
    .where('persona', '==', persona)
    .orderBy('timestamp', 'asc')
    .limit(40)
    .get();
  return snap.docs.map(d => ({ role: d.data().role, text: d.data().text }));
}

module.exports = { verifyIdToken, saveMessage, loadChatHistory };
