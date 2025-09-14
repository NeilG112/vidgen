"use server";

import { z } from "zod";
import { getAuthenticatedUser } from "@/lib/server-auth";
import { adminDb, adminStorage } from "@/lib/firebase/admin";
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
    const heygenApiKey = process.env.HEYGEN_API_KEY;
    const heygenAvatarId = process.env.HEYGEN_AVATAR_ID;
    const heygenVoiceId = process.env.HEYGEN_VOICE_ID;

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
      throw new Error(`HeyGen API error: ${generateResponse.status}`);
    }
    
    const generateData = await generateResponse.json();
    console.log("HeyGen generate response:", generateData);
    
    if (!generateData.data || !generateData.data.video_id) {
      throw new Error("Invalid response from HeyGen API - no video_id received");
    }
    
    const videoId = generateData.data.video_id;
    console.log(`HeyGen video generation started with ID: ${videoId}`);

    // 2. Poll for video completion (matching n8n workflow)
    let videoStatus = '';
    const maxRetries = 60; // 10 minutes timeout (60 * 10s)
    let retries = 0;
    let videoUrl = '';

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
      
      videoStatus = statusData.data?.status;
      if (videoStatus === 'completed') {
        videoUrl = statusData.data.video_url;
        console.log("Video generation completed! URL:", videoUrl);
      } else if (videoStatus === 'failed') {
        console.error("Video generation failed:", statusData.data?.error);
        throw new Error(`HeyGen video generation failed: ${statusData.data?.error || 'Unknown error'}`);
      }
    }

    if (!videoUrl) {
      throw new Error("HeyGen video generation timed out after 10 minutes.");
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
