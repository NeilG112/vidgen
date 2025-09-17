"use server";

import { z } from "zod";
import { getAuthenticatedUser } from "@/lib/server-auth";
import { adminDb } from "@/lib/firebase/admin";
import { FieldValue } from "firebase-admin/firestore";
import { createJob, updateJob } from "./jobActions";

const scrapeProfilesSchema = z.object({
  profileUrls: z.array(z.string().url()).max(10).nonempty(),
  idToken: z.string(),
});

// Helper function to delay execution
const delay = (ms: number) => new Promise(res => setTimeout(res, ms));

// Helper function to sanitize string for Firestore ID
const sanitizeForFirestoreId = (id: string) => {
    return id.replace(/[.\#$[\],/]/g, '_');
}

export async function scrapeProfiles(input: { profileUrls: string[], idToken: string }) {
  console.log("Starting scrapeProfiles function with input:", input.profileUrls);
  const validation = scrapeProfilesSchema.safeParse(input);
  if (!validation.success) {
    console.error("Input validation failed:", validation.error);
    throw new Error("Invalid input: Please provide 1 to 10 valid profile URLs.");
  }

  const { profileUrls, idToken } = validation.data;
  
  let user;
  try {
    user = await getAuthenticatedUser(idToken);
    console.log("Authenticated user:", user.uid);
  } catch (error) {
    console.error("Firebase Auth Error in scrapeProfiles:", error);
    throw new Error("Server-side authentication failed.");
  }

  if (!user) {
    throw new Error("Authentication failed.");
  }
  
  const jobId = await createJob({
    userId: user.uid,
    type: "profile_scraping",
    status: "pending",
    metadata: { urls: profileUrls }
  });
  console.log(`Created job ${jobId} for user ${user.uid}`);

  // Atomically check and decrement scraping credits and create a usage log
  const creditsDocRef = adminDb.collection('users').doc(user.uid).collection('meta').doc('credits');
  const usageCollection = adminDb.collection('users').doc(user.uid).collection('usage');
  const needed = profileUrls.length;
  await adminDb.runTransaction(async (tx) => {
    const creditsSnap = await tx.get(creditsDocRef);
    const available = creditsSnap.exists ? (creditsSnap.data()?.scraping || 0) : 0;
    if (available < needed) {
      throw new Error(`Insufficient scraping credits: required ${needed}, available ${available}`);
    }
    tx.set(creditsDocRef, { scraping: available - needed }, { merge: true });
    tx.set(usageCollection.doc(), {
      type: 'scraping',
      amount: needed,
      createdAt: FieldValue.serverTimestamp(),
      jobId,
      urls: profileUrls,
    });
  });

  try {
    await updateJob({ userId: user.uid, jobId, status: "running" });

    const apifyToken = process.env.APIFY_TOKEN;
    const apifyActorId = process.env.APIFY_ACTOR_ID;

    if (!apifyToken || !apifyActorId) {
        console.error("Apify configuration missing.");
        throw new Error("Apify configuration is missing on the server.");
    }
    
    console.log(`Starting Apify actor ${apifyActorId}`);
    const runResponse = await fetch(
      `https://api.apify.com/v2/acts/${apifyActorId}/runs?token=${apifyToken}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profileUrls }),
      }
    );
    
    if (!runResponse.ok) {
      const errorBody = await runResponse.text();
      console.error(`Apify actor run failed to start. Status: ${runResponse.status}, Body: ${errorBody}`);
      throw new Error(`Apify actor run failed to start. Status: ${runResponse.status}`);
    }
    const runData = await runResponse.json();
    const { id: runId, defaultDatasetId: datasetId } = runData.data;
    console.log(`Apify actor run started with runId: ${runId}, datasetId: ${datasetId}`);

    let runStatus = '';
    const maxRetries = 30; // 5 minutes timeout (30 * 10s)
    let retries = 0;

    console.log("Polling for Apify run to finish...");
    while (runStatus !== 'SUCCEEDED' && retries < maxRetries) {
      retries++;
      await delay(10000); // Wait for 10 seconds

      const statusResponse = await fetch(`https://api.apify.com/v2/acts/${apifyActorId}/runs/${runId}?token=${apifyToken}`);
      const statusData = await statusResponse.json();
      runStatus = statusData.data.status;
      console.log(`Polling attempt ${retries}: Apify run status is ${runStatus}`);

      if (runStatus === 'FAILED' || runStatus === 'TIMED-OUT') {
        throw new Error(`Apify actor run ${runStatus}.`);
      }
    }

    if (runStatus !== 'SUCCEEDED') {
      throw new Error("Apify actor run timed out after 5 minutes.");
    }

    console.log("Apify run finished. Fetching results from dataset...");
    const itemsResponse = await fetch(`https://api.apify.com/v2/datasets/${datasetId}/items?token=${apifyToken}&clean=true&format=json`);
    if (!itemsResponse.ok) {
        console.error("Failed to fetch results from Apify dataset.", itemsResponse.statusText);
        throw new Error("Failed to fetch results from Apify dataset.");
    }
    const scrapedProfiles = await itemsResponse.json();

    if (!scrapedProfiles || scrapedProfiles.length === 0) {
        console.warn("Scraping completed, but no profiles were found.");
        await updateJob({ 
            userId: user.uid, 
            jobId, 
            status: "succeeded",
            metadata: { info: "Scraping completed, but no profiles were found or returned." }
        });
        return; 
    }

    console.log(`Found ${scrapedProfiles.length} profiles. Preparing to save to Firestore.`);
    const batch = adminDb.batch();
    for (const profile of scrapedProfiles) {
      const profileUrl = profile.linkedinUrl || profile.url;

      if (!profileUrl) {
        console.warn("Skipping profile with no URL:", profile);
        continue;
      }
      const profileId = sanitizeForFirestoreId(profileUrl);
      const profileRef = adminDb.collection(`users/${user.uid}/profiles`).doc(profileId);
      
      let firstName = profile.firstName;
      let lastName = profile.lastName;
      let fullName = profile.fullName;

      if (!fullName && profileUrl) {
        const slug = profileUrl.split('/in/')[1]?.split('/')[0];
        if (slug) {
            const nameSlug = slug.replace(/-[a-z0-9]+$/, '');
            const nameParts = nameSlug.split('-').map((part: string) => part.charAt(0).toUpperCase() + part.slice(1));
            fullName = nameParts.join(' ');
            firstName = nameParts[0];
            lastName = nameParts.slice(1).join(' ');
        }
      }

      const transformedExperience = (profile.experiences || []).flatMap((exp: any) => {
        const formatDescription = (description: any[]) => {
          if (!description) return '';
          return description.map((d: any) => d.text).join('\n\n');
        }
    
        if (exp.breakdown && exp.subComponents) {
          return exp.subComponents.map((subExp: any) => ({
            title: subExp.title?.trim() || '',
            company: exp.title?.trim() || '',
            duration: subExp.caption?.trim() || '',
            description: formatDescription(subExp.description),
          }));
        }
        return {
          title: exp.title?.trim() || '',
          company: exp.subtitle?.split('·')[0]?.trim() || '',
          duration: exp.caption?.trim() || '',
          location: exp.metadata?.trim() || '',
          description: formatDescription(exp.subComponents?.[0]?.description),
        };
      });

      const normalizedProfile = {
        linkedinUrl: profileUrl,
        firstName: firstName || '',
        lastName: lastName || '',
        fullName: fullName || '',
        headline: profile.headline || profile.jobTitle || '',
        about: profile.about || '',
        experience: transformedExperience,
        location: profile.location || profile.addressWithCountry || '',
        profilePic: profile.profilePic || profile.profilePicHighQuality || profile.imgUrl || profile.imageUrl || '',
        skills: (profile.skills?.map((s:any) => s.name).filter((name: any) => name && typeof name === 'string') || 
                 profile.topSkillsByEndorsements?.map((s: any) => s.skill).filter((skill: any) => skill && typeof skill === 'string') || 
                 []),
        currentCompany: profile.companyName || transformedExperience[0]?.company || '',
        scrapedAt: FieldValue.serverTimestamp(),
        video: null,
      };

      // Additional validation to ensure no undefined values
      Object.keys(normalizedProfile).forEach(key => {
        if (normalizedProfile[key as keyof typeof normalizedProfile] === undefined) {
          console.warn(`Found undefined value for key: ${key}, setting to empty string`);
          (normalizedProfile as any)[key] = '';
        }
      });

      console.log(`Adding profile ${profileId} to Firestore batch.`);
      batch.set(profileRef, normalizedProfile, { merge: true });
    }
    
    await batch.commit();
    console.log("Successfully committed batch to Firestore.");

    await updateJob({ userId: user.uid, jobId, status: "succeeded" });

  } catch (error: any) {
    console.error(`Job ${jobId} failed with error:`, error.message);
    await updateJob({ 
        userId: user.uid, 
        jobId, 
        status: "failed", 
        metadata: { error: error.message }
    });
    throw error;
  }
}
