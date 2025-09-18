import { NextResponse } from 'next/server';
import { scrapeProfiles } from '@/lib/actions/profileActions';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { profileUrls, idToken } = body;
    if (!profileUrls || !Array.isArray(profileUrls)) {
      return NextResponse.json({ error: 'profileUrls must be provided' }, { status: 400 });
    }
    await scrapeProfiles({ profileUrls, idToken });
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error('API /api/scrapeProfiles error:', err);
    return NextResponse.json({ error: err?.message || 'Internal error' }, { status: 500 });
  }
}
