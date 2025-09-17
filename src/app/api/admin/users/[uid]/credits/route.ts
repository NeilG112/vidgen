import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { getAuthenticatedUser } from '@/lib/server-auth';

const ADMIN_EMAIL = 'neilganguly2007@gmail.com';

export async function GET(req: Request, { params }: { params: any }) {
  try {
    const authHeader = req.headers.get('authorization') || '';
    const idToken = authHeader.replace('Bearer ', '');
    const user = await getAuthenticatedUser(idToken as string);
    if (!user || user.email !== ADMIN_EMAIL) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    const resolvedParams = await params;
    const uid = resolvedParams.uid;

    const creditsRef = adminDb.collection('users').doc(uid).collection('meta').doc('credits');
    const snap = await creditsRef.get();
    return NextResponse.json({ credits: snap.exists ? snap.data() : { scraping: 0, video: 0, resetAt: null } });
  } catch (err: any) {
    return NextResponse.json({ error: String(err?.message || err) }, { status: 500 });
  }
}

export async function PATCH(req: Request, { params }: { params: any }) {
  try {
    const authHeader = req.headers.get('authorization') || '';
    const idToken = authHeader.replace('Bearer ', '');
    const user = await getAuthenticatedUser(idToken as string);
    if (!user || user.email !== ADMIN_EMAIL) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await req.json();
    const { scraping, video } = body;
    if (scraping == null && video == null) {
      return NextResponse.json({ error: 'No credit fields provided' }, { status: 400 });
    }

  const resolvedParams = await params;
  const uid = resolvedParams.uid;

  const creditsRef = adminDb.collection('users').doc(uid).collection('meta').doc('credits');
    const update: any = {};
    if (typeof scraping === 'number') update.scraping = scraping;
    if (typeof video === 'number') update.video = video;
    update.resetAt = update.resetAt || null;

    await creditsRef.set(update, { merge: true });
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ error: String(err?.message || err) }, { status: 500 });
  }
}
