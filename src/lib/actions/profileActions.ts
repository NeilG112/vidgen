"use server";

import { z } from "zod";
import { getAuthenticatedUser } from "@/lib/auth";
import { adminDb } from "@/lib/firebase/admin";
import { FieldValue } from "firebase-admin/firestore";
import { createJob, updateJob } from "./jobActions";

const scrapeProfilesSchema = z.object({
  profileUrls: z.array(z.string().url()).max(10).nonempty(),
});

// Helper function to delay execution
const delay = (ms: number) => new Promise(res => setTimeout(res, ms));

export async function scrapeProfiles(input: { profileUrls: string[] }) {
  const user = await getAuthenticatedUser();
  if (!user) {
    throw new Error("You must be logged in to perform this action.");
  }

  const validation = scrapeProfilesSchema.safeParse(input);
  if (!validation.success) {
    throw new Error("Invalid input: Please provide 1 to 10 valid profile URLs.");
  }
  
  const { profileUrls } = validation.data;
  
  const jobId = await createJob({
    userId: user.uid,
    type: "profile_scraping",
    status: "pending",
    metadata: { urls: profileUrls }
  });

  try {
    await updateJob({ userId: user.uid, jobId, status: "running" });

    // TODO: set in .env
    const apifyToken = process.env.APIFY_TOKEN;
    // TODO: set in .env
    const apifyActorId = process.env.APIFY_ACTOR_ID;

    if (!apifyToken || !apifyActorId) {
        throw new Error("Apify configuration is missing on the server.");
    }
    
    // 1. Start Apify actor run
    const runResponse = await fetch(
      `https://api.apify.com/v2/acts/${apifyActorId}/runs?token=${apifyToken}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profileUrls }),
      }
    );
    
    if (!runResponse.ok) {
      throw new Error(`Apify actor run failed to start. Status: ${runResponse.status}`);
    }
    const runData = await runResponse.json();
    const { id: runId, defaultDatasetId: datasetId } = runData.data;

    // 2. Poll for actor run completion
    let runStatus = '';
    const maxRetries = 30; // 5 minutes timeout (30 * 10s)
    let retries = 0;

    while (runStatus !== 'SUCCEEDED' && retries < maxRetries) {
      retries++;
      await delay(10000); // Wait for 10 seconds

      const statusResponse = await fetch(`https://api.apify.com/v2/acts/${apifyActorId}/runs/${runId}?token=${apifyToken}`);
      const statusData = await statusResponse.json();
      runStatus = statusData.data.status;

      if (runStatus === 'FAILED' || runStatus === 'TIMED-OUT') {
        throw new Error(`Apify actor run ${runStatus}.`);
      }
    }

    if (runStatus !== 'SUCCEEDED') {
      throw new Error("Apify actor run timed out after 5 minutes.");
    }

    // 3. Fetch dataset items
    const itemsResponse = await fetch(`https://api.apify.com/v2/datasets/${datasetId}/items?token=${apifyToken}&format=json`);
    if (!itemsResponse.ok) {
        throw new Error("Failed to fetch results from Apify dataset.");
    }
    const scrapedProfiles = await itemsResponse.json();

    // 4. Normalize and save to Firestore
    const batch = adminDb.batch();
    for (const profile of scrapedProfiles) {
      const profileId = profile.publicIdentifier;
      if (!profileId) continue;

      const profileRef = adminDb.collection(`users/${user.uid}/profiles`).doc(profileId);
      
      const normalizedProfile = {
        linkedinUrl: profile.url,
        firstName: profile.firstName,
        lastName: profile.lastName,
        fullName: profile.fullName,
        headline: profile.headline,
        location: profile.location,
        profilePic: profile.imgUrl,
        skills: profile.skills || [],
        currentCompany: profile.experience?.[0]?.company,
        scrapedAt: FieldValue.serverTimestamp(),
        video: null,
      };
      batch.set(profileRef, normalizedProfile, { merge: true });
    }
    await batch.commit();

    await updateJob({ userId: user.uid, jobId, status: "succeeded" });

  } catch (error: any) {
    await updateJob({ 
        userId: user.uid, 
        jobId, 
        status: "failed", 
        metadata: { error: error.message }
    });
    // Re-throw the error to be caught by the client
    throw error;
  }
}
