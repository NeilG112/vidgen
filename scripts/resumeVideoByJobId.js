/*
  Usage:
  node scripts/resumeVideoByJobId.js <jobId> <profileId>

  Requires env vars:
  - NEXT_PUBLIC_FIREBASE_PROJECT_ID
  - FIREBASE_CLIENT_EMAIL
  - FIREBASE_PRIVATE_KEY
  - NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET
  - HEYGEN_API_KEY
*/

require('dotenv').config();

const { initializeApp, cert, getApps } = require('firebase-admin/app');
const { getFirestore, FieldValue, FieldPath } = require('firebase-admin/firestore');
const { getStorage } = require('firebase-admin/storage');

async function main() {
  const [jobId, profileId, directVideoUrl] = process.argv.slice(2);
  if (!jobId || !profileId) {
    console.error('Usage: node scripts/resumeVideoByJobId.js <jobId> <profileId> [videoUrl]');
    process.exit(1);
  }

  const heygenApiKey = process.env['HEYGEN_API_KEY'];

  if (getApps().length === 0) {
    const rawBucket = process.env['NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET'] || '';
    const normalizedBucket = rawBucket.includes('firebasestorage.app')
      ? `${process.env['NEXT_PUBLIC_FIREBASE_PROJECT_ID']}.appspot.com`
      : rawBucket;
    initializeApp({
      credential: cert({
        projectId: process.env['NEXT_PUBLIC_FIREBASE_PROJECT_ID'],
        clientEmail: process.env['FIREBASE_CLIENT_EMAIL'],
        privateKey: (process.env['FIREBASE_PRIVATE_KEY'] || '').replace(/\\n/g, '\n'),
      }),
      storageBucket: normalizedBucket,
    });
  }

  const db = getFirestore();
  const storage = getStorage();

  // Find the job across all users by scanning recent jobs
  const jobsCg = db.collectionGroup('jobs')
    .limit(500);
  const jobsSnap = await jobsCg.get();
  let jobDoc = null;
  for (const d of jobsSnap.docs) {
    if (d.id === jobId) { jobDoc = d; break; }
  }
  if (!jobDoc) {
    throw new Error('Job not found among recent documents: ' + jobId);
  }
  const jobData = jobDoc.data();
  const userId = jobDoc.ref.parent.parent.id;

  // Extract videoId from metadata (supports array or object)
  let videoId;
  if (Array.isArray(jobData?.metadata)) {
    for (const entry of jobData.metadata) {
      if (entry && typeof entry === 'object' && entry.videoId) {
        videoId = entry.videoId;
      }
    }
  } else if (jobData?.metadata && jobData.metadata.videoId) {
    videoId = jobData.metadata.videoId;
  }

  // If direct URL provided, skip needing videoId/polling
  if (!directVideoUrl && !videoId) {
    throw new Error('No videoId found on the job metadata and no direct videoUrl provided. Cannot resume.');
  }

  console.log('Resuming job', { jobId, userId, profileId, videoId, direct: !!directVideoUrl });

  // Mark running
  await jobDoc.ref.update({
    status: 'running',
    updatedAt: FieldValue.serverTimestamp(),
    metadata: FieldValue.arrayUnion({ resume: true, at: new Date().toISOString() })
  });

  let videoUrl = directVideoUrl || '';
  if (!videoUrl) {
    if (!heygenApiKey) {
      throw new Error('HEYGEN_API_KEY is not set');
    }
    // Poll HeyGen for completion
    let videoStatus = '';
    const maxRetries = 60;
    let retries = 0;
    while (videoStatus !== 'completed' && retries < maxRetries) {
      retries++;
      const statusResponse = await fetch(`https://api.heygen.com/v1/video_status.get?video_id=${videoId}`, {
        headers: {
          'X-Api-Key': heygenApiKey,
          'accept': 'application/json',
        },
      });
      if (!statusResponse.ok) {
        await new Promise(r => setTimeout(r, 10000));
        continue;
      }
      const statusData = await statusResponse.json();
      videoStatus = statusData.data?.status;
      console.log(`Poll ${retries}: status=${videoStatus}`);
      if (videoStatus === 'completed') {
        videoUrl = statusData.data.video_url;
        break;
      }
      if (videoStatus === 'failed') {
        const errorData = statusData.data?.error;
        throw new Error('HeyGen failed: ' + (JSON.stringify(errorData) || 'Unknown error'));
      }
      await new Promise(r => setTimeout(r, 10000));
    }
    if (!videoUrl) {
      throw new Error('Timed out waiting for HeyGen video to complete');
    }
  }

  // Download
  const resp = await fetch(videoUrl, { headers: { accept: 'application/json' } });
  if (!resp.ok) {
    throw new Error('Failed to download video: ' + resp.status);
  }
  const buf = Buffer.from(await resp.arrayBuffer());

  // Upload to storage (sanitize path). If bucket missing, fall back to storing direct URL.
  const safeProfileId = String(profileId).replace(/[^a-zA-Z0-9_-]/g, '_');
  const storagePath = `videos/${userId}/${safeProfileId}/${jobId}.mp4`;
  let downloadUrl = '';
  try {
    const file = storage.bucket().file(storagePath);
    await file.save(buf, { metadata: { contentType: 'video/mp4' } });
    const signed = await file.getSignedUrl({ action: 'read', expires: '03-09-2491' });
    downloadUrl = signed[0];
  } catch (e) {
    console.warn('Storage upload failed, falling back to direct URL on profile:', e && e.message ? e.message : e);
    downloadUrl = videoUrl; // fall back to provided/completed URL
  }

  // Update profile
  const profileRef = db.doc(`users/${userId}/profiles/${profileId}`);
  await profileRef.update({
    video: {
      storagePath,
      downloadUrl,
      createdAt: FieldValue.serverTimestamp(),
    },
  });

  // Mark job success
  await jobDoc.ref.update({
    status: 'succeeded',
    updatedAt: FieldValue.serverTimestamp(),
    metadata: FieldValue.arrayUnion({ resumed: true, storagePath, downloadUrl })
  });

  console.log('Resume completed:', { storagePath, downloadUrl });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});


