"use server";

import { z } from "zod";
import { getAuthenticatedUser } from "@/lib/server-auth";
import { getAdminDb, getAdminStorage } from "@/lib/firebase/admin";
import { FieldValue } from "firebase-admin/firestore";
import { createJob, updateJob } from "./jobActions";

const generateVideoSchema = z.object({
  profileId: z.string(),
  script: z.string().min(10).max(1000),
  idToken: z.string(),
});

const delay = (ms: number) => new Promise(res => setTimeout(res, ms));

export async function generateVideo(input: { profileId: string, script: string, idToken: string }) {
  const validation = generateVideoSchema.safeParse(input);
  if (!validation.success) throw new Error("Invalid input.");

  const { profileId, script, idToken } = validation.data;
  
  let user;
  try {
    user = await getAuthenticatedUser(idToken);
  } catch (error) {
    console.error("Firebase Auth Error in generateVideo:", error);
    throw new Error("Server-side authentication failed.");
  }

  if (!user) {
    throw new Error("Authentication failed.");
  }

  const jobId = await createJob({
    userId: user.uid,
    type: "video_generation",
    status: "pending",
    metadata: { profileId },
  });

  try {
    await updateJob({ userId: user.uid, jobId, status: "running" });

    // TODO: set in .env
  const heygenApiKey = process.env['HEYGEN_API_KEY'];
  const heygenAvatarId = process.env['HEYGEN_AVATAR_ID'];
  const heygenVoiceId = process.env['HEYGEN_VOICE_ID'];

    if (!heygenApiKey || !heygenAvatarId || !heygenVoiceId) {
      throw new Error("HeyGen configuration is missing on the server.");
    }
    
    // 1. Generate video with HeyGen (matching n8n workflow)
    const generateResponse = await fetch("https://api.heygen.com/v2/video/generate", {
      method: "POST",
      headers: {
        "X-Api-Key": heygenApiKey,
        "Content-Type": "application/json",
        "accept": "application/json",
      },
      body: JSON.stringify({
        video_inputs: [
          {
            character: { 
              type: "avatar", 
              avatar_id: heygenAvatarId, 
              avatar_style: "normal" 
            },
            voice: { 
              type: "text", 
              voice_id: heygenVoiceId, 
              input_text: script,
              speed: 1.1 
            }
          }
        ],
        dimension: { width: 1280, height: 720 },
      }),
    });

    if (!generateResponse.ok) {
      const errorText = await generateResponse.text();
      console.error(`HeyGen generate API error: ${generateResponse.status} - ${errorText}`);
      
      // Try to parse error response for specific error codes
      try {
        const errorData = JSON.parse(errorText);
        if (errorData.code === 'INSTANT_AVATAR_UNDER_REVIEW') {
          throw new Error(`Your instant avatar is currently under review by HeyGen. This process typically takes 24-48 hours. Please check your HeyGen dashboard for updates.`);
        } else if (errorData.code === 'AVATAR_NOT_APPROVED') {
          throw new Error(`Your instant avatar was not approved by HeyGen. Please create a new avatar or contact HeyGen support.`);
        }
      } catch (parseError) {
        // If we can't parse the error, fall back to generic error
      }
      
      throw new Error(`HeyGen API error: ${generateResponse.status} - ${errorText}`);
    }
    
    const generateData = await generateResponse.json();
    console.log("HeyGen generate response:", generateData);
    
    if (!generateData.data || !generateData.data.video_id) {
      throw new Error("Invalid response from HeyGen API - no video_id received");
    }
    
    const videoId = generateData.data.video_id;
    console.log(`HeyGen video generation started with ID: ${videoId}`);

  // Persist videoId on the job so we can resume without regenerating
  await updateJob({ userId: user.uid, jobId, status: "running", metadata: { videoId } });

  const adminDb = getAdminDb();
  // Prepare credits ref (we'll decrement once we know duration).
  // Video credits are tracked in seconds (1 credit = 1 second).
  const creditsRef = adminDb.collection('users').doc(user.uid).collection('meta').doc('credits');
  const creditsSnap = await creditsRef.get();
  let availableVideoSeconds = creditsSnap.exists ? (creditsSnap.data()?.video || 0) : 0;

  // 2. Poll for video completion (matching n8n workflow)
  let videoStatus = '';
  const maxRetries = 60; // 10 minutes timeout (60 * 10s)
  let retries = 0;
  let videoUrl = '';
  let lastStatusData: any = null;

  console.log("Starting to poll for video completion...");
    while (videoStatus !== 'completed' && retries < maxRetries) {
      retries++;
      await delay(10000); // Wait 10 seconds between polls

      const statusResponse = await fetch(`https://api.heygen.com/v1/video_status.get?video_id=${videoId}`, {
        headers: { 
          "X-Api-Key": heygenApiKey,
          "accept": "application/json"
        },
      });

      if (!statusResponse.ok) {
        console.warn(`Status check failed (attempt ${retries}): ${statusResponse.status}`);
        continue; // retry if status check fails
      }

      const statusData = await statusResponse.json();
      console.log(`Polling attempt ${retries}: Status = ${statusData.data?.status}`);
      lastStatusData = statusData;
      
      videoStatus = statusData.data?.status;
      if (videoStatus === 'completed') {
        videoUrl = statusData.data.video_url;
        console.log("Video generation completed! URL:", videoUrl);
      } else if (videoStatus === 'failed') {
        console.error("Video generation failed:", statusData.data?.error);
        
        // Handle specific error cases
        const errorData = statusData.data?.error;
        if (errorData?.code === 'INSTANT_AVATAR_UNDER_REVIEW') {
          throw new Error(`Your instant avatar is currently under review by HeyGen. This process typically takes 24-48 hours. Please check your HeyGen dashboard for updates.`);
        } else if (errorData?.code === 'AVATAR_NOT_APPROVED') {
          throw new Error(`Your instant avatar was not approved by HeyGen. Please create a new avatar or contact HeyGen support.`);
        } else {
          throw new Error(`HeyGen video generation failed: ${JSON.stringify(errorData) || 'Unknown error'}`);
        }
      }
    }

      if (!videoUrl) {
        throw new Error("HeyGen video generation timed out after 10 minutes.");
      }

      // Determine duration in seconds: prefer HeyGen status data, otherwise estimate from script.
      const sd = lastStatusData?.data || {};
      const secondsFromHeygen = sd.duration_seconds ?? sd.duration ?? sd.length_seconds ?? sd.video_duration_seconds ?? undefined;
      let secondsRequired = 0;
      if (secondsFromHeygen) {
        secondsRequired = Math.max(1, Math.ceil(Number(secondsFromHeygen)));
      } else {
        // Estimate assuming 130 words per minute => words / (130/60) = approx seconds
        const words = script.split(/\s+/).filter(Boolean).length;
        secondsRequired = Math.max(1, Math.ceil((words / 130) * 60));
      }

      // Deduct credits atomically using a transaction and write a usage log (amount in seconds)
      const creditsDocRef = adminDb.collection('users').doc(user.uid).collection('meta').doc('credits');
      const usageCollection = adminDb.collection('users').doc(user.uid).collection('usage');
      try {
        await adminDb.runTransaction(async (tx) => {
          const snap = await tx.get(creditsDocRef);
          const available = snap.exists ? (snap.data()?.video || 0) : 0;
          if (available < secondsRequired) {
            throw new Error(`Insufficient video credits (seconds): required ${secondsRequired}, available ${available}`);
          }
          tx.set(creditsDocRef, { video: available - secondsRequired }, { merge: true });
          tx.set(usageCollection.doc(), {
            type: 'video',
            amount: secondsRequired,
            createdAt: FieldValue.serverTimestamp(),
            jobId,
            profileId,
          });
        });
        // record in job metadata
        await updateJob({ userId: user.uid, jobId, status: 'running', metadata: { videoSecondsUsed: secondsRequired } });
      } catch (e: any) {
        await updateJob({ userId: user.uid, jobId, status: 'failed', metadata: { error: String(e?.message || e) } });
        throw e;
      }

    // 3. Download video and upload to Firebase Storage (matching n8n workflow)
    console.log("Downloading video from HeyGen...");
    const videoResponse = await fetch(videoUrl, {
      headers: {
        "accept": "application/json"
      }
    });
    
    if (!videoResponse.ok) {
      console.error(`Failed to download video: ${videoResponse.status}`);
      throw new Error(`Failed to download video from HeyGen: ${videoResponse.status}`);
    }
    
    const videoBuffer = Buffer.from(await videoResponse.arrayBuffer());
    console.log(`Downloaded video buffer size: ${videoBuffer.length} bytes`);
    
    // We're not reliably using storage for public delivery in this environment. Use HeyGen URL directly.
    const storagePath = `videos/${user.uid}/${profileId}/${jobId}.mp4`;
    const downloadUrl = videoUrl;

    // 4. Update Firestore
    const profileRef = adminDb.collection(`users/${user.uid}/profiles`).doc(profileId);
    // Save video metadata on the profile and record the seconds used
    await profileRef.update({
      video: {
        storagePath,
        downloadUrl,
        createdAt: FieldValue.serverTimestamp(),
        secondsUsed: secondsRequired,
      },
    });

    await updateJob({ userId: user.uid, jobId, status: "succeeded" });

  } catch (error: any) {
    await updateJob({
      userId: user.uid,
      jobId,
      status: "failed",
      metadata: { error: error.message },
    });
    throw error;
  }
}

export async function resumeVideo(input: { jobId: string, profileId: string, idToken: string }) {
  const { jobId, profileId, idToken } = input;

  let user;
  try {
    user = await getAuthenticatedUser(idToken);
  } catch (error) {
    console.error("Firebase Auth Error in resumeVideo:", error);
    throw new Error("Server-side authentication failed.");
  }

  if (!user) {
    throw new Error("Authentication failed.");
  }

  const heygenApiKey = process.env.HEYGEN_API_KEY;
  if (!heygenApiKey) {
    throw new Error("HeyGen configuration is missing on the server.");
  }

  const adminDb = getAdminDb();

  // Fetch job to retrieve stored videoId
  const jobRef = adminDb.collection(`users/${user.uid}/jobs`).doc(jobId);
  const jobSnap = await jobRef.get();
  if (!jobSnap.exists) {
    throw new Error("Job not found.");
  }

  const jobData: any = jobSnap.data();
  let videoId: string | undefined;
  // metadata may be an array due to arrayUnion usage; find entry containing videoId
  if (Array.isArray(jobData?.metadata)) {
    for (const entry of jobData.metadata) {
      if (entry && typeof entry === 'object' && entry.videoId) {
        videoId = entry.videoId;
      }
    }
  } else if (jobData?.metadata && jobData.metadata.videoId) {
    videoId = jobData.metadata.videoId;
  }

  if (!videoId) {
    throw new Error("No videoId found on the job. Unable to resume.");
  }

  await updateJob({ userId: user.uid, jobId, status: "running", metadata: { resume: true } });

  // Poll for completion (or immediate success if already completed)
  let videoStatus = '';
  const maxRetries = 60; // 10 minutes
  let retries = 0;
  let videoUrl = '';

  while (videoStatus !== 'completed' && retries < maxRetries) {
    retries++;
    const statusResponse = await fetch(`https://api.heygen.com/v1/video_status.get?video_id=${videoId}`, {
      headers: {
        "X-Api-Key": heygenApiKey,
        "accept": "application/json",
      },
    });

    if (!statusResponse.ok) {
      await new Promise((r) => setTimeout(r, 10000));
      continue;
    }

    const statusData = await statusResponse.json();
    videoStatus = statusData.data?.status;
    if (videoStatus === 'completed') {
      videoUrl = statusData.data.video_url;
    } else if (videoStatus === 'failed') {
      const errorData = statusData.data?.error;
      throw new Error(`HeyGen video generation failed: ${JSON.stringify(errorData) || 'Unknown error'}`);
    } else {
      await new Promise((r) => setTimeout(r, 10000));
    }
  }

  if (!videoUrl) {
    throw new Error("HeyGen video generation timed out after 10 minutes.");
  }

  // Download and upload to Firebase Storage
  const videoResponse = await fetch(videoUrl, { headers: { accept: "application/json" } });
  if (!videoResponse.ok) {
    throw new Error(`Failed to download video from HeyGen: ${videoResponse.status}`);
  }
  const videoBuffer = Buffer.from(await videoResponse.arrayBuffer());

  const storagePath = `videos/${user.uid}/${profileId}/${jobId}.mp4`;
  const adminStorage = getAdminStorage();
  const file = adminStorage.bucket().file(storagePath);
  await file.save(videoBuffer, { metadata: { contentType: "video/mp4" } });

  const [downloadUrl] = await file.getSignedUrl({ action: 'read', expires: '03-09-2491' });

  // Update profile and job
  const profileRef = adminDb.collection(`users/${user.uid}/profiles`).doc(profileId);
  await profileRef.update({
    video: {
      storagePath,
      downloadUrl,
      createdAt: FieldValue.serverTimestamp(),
    },
  });

  await updateJob({ userId: user.uid, jobId, status: "succeeded", metadata: { resumed: true } });
}

export async function resumeVideoWithUrl(input: { jobId: string, profileId: string, idToken: string, videoUrl: string }) {
  const { jobId, profileId, idToken, videoUrl } = input;

  if (!videoUrl || typeof videoUrl !== 'string') {
    throw new Error('A valid videoUrl is required.');
  }

  let user;
  try {
    user = await getAuthenticatedUser(idToken);
  } catch (error) {
    console.error("Firebase Auth Error in resumeVideoWithUrl:", error);
    throw new Error("Server-side authentication failed.");
  }

  if (!user) {
    throw new Error("Authentication failed.");
  }

  await updateJob({ userId: user.uid, jobId, status: "running", metadata: { resumeViaUrl: true } });

  // Try to download the provided URL and upload to Storage; if upload fails, fall back to storing the direct URL
  let downloadUrl = '';
  let storagePath = `videos/${user.uid}/${profileId}/${jobId}.mp4`;

  try {
    const videoResponse = await fetch(videoUrl, { headers: { accept: "application/json" } });
    if (!videoResponse.ok) {
      throw new Error(`Failed to download provided video URL: ${videoResponse.status}`);
    }
    const videoBuffer = Buffer.from(await videoResponse.arrayBuffer());

    const file = adminStorage.bucket().file(storagePath);
    await file.save(videoBuffer, { metadata: { contentType: "video/mp4" } });
    const [signedUrl] = await file.getSignedUrl({ action: 'read', expires: '03-09-2491' });
    downloadUrl = signedUrl;
  } catch (e: any) {
    console.warn('Storage upload failed or download error. Falling back to direct URL on profile:', e?.message || e);
    // Use sanitized path for consistency even if we don't upload
    const safeProfileId = String(profileId).replace(/[^a-zA-Z0-9_-]/g, '_');
    storagePath = `videos/${user.uid}/${safeProfileId}/${jobId}.mp4`;
    downloadUrl = videoUrl;
  }

  const profileRef = adminDb.collection(`users/${user.uid}/profiles`).doc(profileId);
  await profileRef.update({
    video: {
      storagePath,
      downloadUrl,
      createdAt: FieldValue.serverTimestamp(),
    },
  });

  await updateJob({ userId: user.uid, jobId, status: "succeeded", metadata: { resumed: true, via: 'url', storagePath, downloadUrl } });
}
