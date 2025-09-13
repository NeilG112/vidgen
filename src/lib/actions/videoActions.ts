"use server";

import { z } from "zod";
import { getAuthenticatedUser } from "@/lib/auth";
import { adminDb, adminStorage } from "@/lib/firebase/admin";
import { FieldValue } from "firebase-admin/firestore";
import { createJob, updateJob } from "./jobActions";

const generateVideoSchema = z.object({
  profileId: z.string(),
  script: z.string().min(10).max(1000),
});

const delay = (ms: number) => new Promise(res => setTimeout(res, ms));

export async function generateVideo(input: { profileId: string, script: string }) {
  const user = await getAuthenticatedUser();
  if (!user) throw new Error("Authentication required.");

  const validation = generateVideoSchema.safeParse(input);
  if (!validation.success) throw new Error("Invalid input.");

  const { profileId, script } = validation.data;

  const jobId = await createJob({
    userId: user.uid,
    type: "video_generation",
    status: "pending",
    metadata: { profileId },
  });

  try {
    await updateJob({ userId: user.uid, jobId, status: "running" });

    // TODO: set in .env
    const heygenApiKey = process.env.HEYGEN_API_KEY;
    const heygenAvatarId = process.env.HEYGEN_AVATAR_ID;
    const heygenVoiceId = process.env.HEYGEN_VOICE_ID;

    if (!heygenApiKey || !heygenAvatarId || !heygenVoiceId) {
      throw new Error("HeyGen configuration is missing on the server.");
    }
    
    // 1. Generate video with HeyGen
    const generateResponse = await fetch("https://api.heygen.com/v2/video/generate", {
      method: "POST",
      headers: {
        "X-Api-Key": heygenApiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        video_inputs: [
          {
            character: { type: "avatar", avatar_id: heygenAvatarId, scale: 1.0 },
            voice: { type: "text", voice_id: heygenVoiceId, input_text: script },
          },
        ],
        test: false,
        dimension: { width: 1280, height: 720 },
      }),
    });

    if (!generateResponse.ok) throw new Error(`HeyGen API error: ${await generateResponse.text()}`);
    const generateData = await generateResponse.json();
    const videoId = generateData.data.video_id;

    // 2. Poll for video completion
    let videoStatus = '';
    const maxRetries = 60; // 10 minutes timeout (60 * 10s)
    let retries = 0;
    let videoUrl = '';

    while (videoStatus !== 'completed' && retries < maxRetries) {
        await delay(10000);
        retries++;

        const statusResponse = await fetch(`https://api.heygen.com/v1/video_status.get?video_id=${videoId}`, {
            headers: { "X-Api-Key": heygenApiKey },
        });

        if (!statusResponse.ok) continue; // retry if status check fails

        const statusData = await statusResponse.json();
        videoStatus = statusData.data.status;
        if (videoStatus === 'completed') {
            videoUrl = statusData.data.video_url;
        } else if (videoStatus === 'failed') {
            throw new Error('HeyGen video generation failed.');
        }
    }

    if (!videoUrl) throw new Error("HeyGen video generation timed out.");

    // 3. Download video and upload to Firebase Storage
    const videoResponse = await fetch(videoUrl);
    if (!videoResponse.ok) throw new Error("Failed to download video from HeyGen.");
    const videoBuffer = Buffer.from(await videoResponse.arrayBuffer());
    
    const storagePath = `videos/${user.uid}/${profileId}/${jobId}.mp4`;
    const file = adminStorage.bucket().file(storagePath);
    
    await file.save(videoBuffer, {
      metadata: { contentType: "video/mp4" },
    });
    
    const [downloadUrl] = await file.getSignedUrl({
        action: 'read',
        expires: '03-09-2491' // A very long expiry date
    });

    // 4. Update Firestore
    const profileRef = adminDb.collection(`users/${user.uid}/profiles`).doc(profileId);
    await profileRef.update({
      video: {
        storagePath,
        downloadUrl,
        createdAt: FieldValue.serverTimestamp(),
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
