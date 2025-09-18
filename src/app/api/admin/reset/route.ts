import { NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase/admin';
import { getAuthenticatedUser } from '@/lib/server-auth';

const ADMIN_EMAIL = 'neilganguly2007@gmail.com';

export async function POST(req: Request) {
  try {
    const authHeader = req.headers.get('authorization') || '';
    const idToken = authHeader.replace('Bearer ', '');
    const user = await getAuthenticatedUser(idToken as string);
    if (!user || user.email !== ADMIN_EMAIL) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const adminDb = getAdminDb();
    const usersSnap = await adminDb.collection('users').get();
    const batch = adminDb.batch();
    const now = new Date();

    usersSnap.forEach((doc: any) => {
      const creditsRef = adminDb.collection('users').doc(doc.id).collection('meta').doc('credits');
      batch.set(creditsRef, { scraping: 0, video: 0, resetAt: now }, { merge: true });
    });

    await batch.commit();
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ error: String(err?.message || err) }, { status: 500 });
  }
}
