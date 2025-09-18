import { NextResponse } from 'next/server';
import { generateVideo } from '@/lib/actions/videoActions';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { profileId, script, idToken } = body;
    if (!profileId || !script || !idToken) {
      return NextResponse.json({ error: 'profileId, script and idToken are required' }, { status: 400 });
    }
    await generateVideo({ profileId, script, idToken });
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error('API /api/video/generate error:', err);
    return NextResponse.json({ error: err?.message || 'Internal error' }, { status: 500 });
  }
}
