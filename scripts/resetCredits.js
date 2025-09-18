/*
Simple script to reset credits for all users.
Run with: `node scripts/resetCredits.js`
Requires env vars: FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY, NEXT_PUBLIC_FIREBASE_PROJECT_ID
*/

const admin = require('firebase-admin');

const projectId = process.env['NEXT_PUBLIC_FIREBASE_PROJECT_ID'];
const clientEmail = process.env['FIREBASE_CLIENT_EMAIL'];
const privateKey = process.env['FIREBASE_PRIVATE_KEY'] && process.env['FIREBASE_PRIVATE_KEY'].replace(/\\n/g, '\n');

if (!projectId || !clientEmail || !privateKey) {
  console.error('Missing Firebase admin env vars. Please set NEXT_PUBLIC_FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL and FIREBASE_PRIVATE_KEY');
  process.exit(1);
}

admin.initializeApp({
  credential: admin.credential.cert({ projectId, clientEmail, privateKey }),
});

const db = admin.firestore();

(async () => {
  try {
    const usersSnap = await db.collection('users').get();
    const batch = db.batch();
    const now = new Date();
    usersSnap.forEach(doc => {
      const creditsRef = db.collection('users').doc(doc.id).collection('meta').doc('credits');
      batch.set(creditsRef, { scraping: 0, video: 0, resetAt: now }, { merge: true });
    });
    await batch.commit();
    console.log('Credits reset for', usersSnap.size, 'users');
    process.exit(0);
  } catch (e) {
    console.error('Failed to reset credits:', e);
    process.exit(2);
  }
})();
