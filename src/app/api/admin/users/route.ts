import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { getAuthenticatedUser } from '@/lib/server-auth';

const ADMIN_EMAIL = 'neilganguly2007@gmail.com';

export async function GET(req: Request) {
  try {
    const authHeader = req.headers.get('authorization') || '';
    const idToken = authHeader.replace('Bearer ', '');
    const user = await getAuthenticatedUser(idToken as string);
    if (!user || user.email !== ADMIN_EMAIL) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const usersSnap = await adminDb.collection('users').get();
    const users: any[] = [];
    usersSnap.forEach((doc: any) => {
      const data = doc.data();
      users.push({ uid: doc.id, ...data });
    });

    // For each user, fetch credits subdoc and recent usage (limit 20)
    const usersWithCredits = await Promise.all(users.map(async (u) => {
      const creditsRef = adminDb.collection('users').doc(u.uid).collection('meta').doc('credits');
      const snap = await creditsRef.get();
      const usageSnap = await adminDb.collection('users').doc(u.uid).collection('usage').orderBy('createdAt', 'desc').limit(20).get();
      const usage: any[] = [];
      usageSnap.forEach((d: any) => {
        const data = d.data() || {};
        // Serialize Firestore Timestamp -> ISO string if present
        const createdAt = data.createdAt && typeof data.createdAt.toDate === 'function'
          ? data.createdAt.toDate().toISOString()
          : (data.createdAt ? new Date(data.createdAt).toISOString() : null);
        usage.push({ id: d.id, ...data, createdAt });
      });

      const creditsData = snap.exists ? snap.data() : { scraping: 0, video: 0, resetAt: null };
      const resetAt = creditsData?.resetAt && typeof creditsData.resetAt.toDate === 'function'
        ? creditsData.resetAt.toDate().toISOString()
        : (creditsData?.resetAt ? new Date(creditsData.resetAt).toISOString() : null);

      return { ...u, credits: { ...creditsData, resetAt }, usage };
    }));

    return NextResponse.json({ users: usersWithCredits });
  } catch (err: any) {
    return NextResponse.json({ error: String(err?.message || err) }, { status: 500 });
  }
}
