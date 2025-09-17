"use server";

import { z } from "zod";
import { adminDb } from "@/lib/firebase/admin";
import { getAuthenticatedUser } from "@/lib/server-auth";

const ADMIN_EMAIL = "neilganguly2007@gmail.com";

const quotaSchema = z.object({
  email: z.string().email(),
  monthlyScrapeCredits: z.number().int().min(0),
  monthlyVideoMinutes: z.number().int().min(0),
});

export async function setUserQuota(input: { idToken: string, email: string, monthlyScrapeCredits: number, monthlyVideoMinutes: number }) {
  const parsed = quotaSchema.safeParse({ email: input.email, monthlyScrapeCredits: input.monthlyScrapeCredits, monthlyVideoMinutes: input.monthlyVideoMinutes });
  if (!parsed.success) throw new Error("Invalid quota payload");

  const me = await getAuthenticatedUser(input.idToken);
  if (!me || me.email !== ADMIN_EMAIL) throw new Error("Not authorized");

  const users = await adminDb.collection("users").where("email", "==", parsed.data.email).limit(1).get();
  const now = new Date();
  const periodStart = new Date(now.getFullYear(), now.getMonth(), 1);

  if (users.empty) {
    // Create user doc with quota
    const ref = await adminDb.collection("users").add({
      email: parsed.data.email,
      quota: {
        monthlyScrapeCredits: parsed.data.monthlyScrapeCredits,
        monthlyVideoMinutes: parsed.data.monthlyVideoMinutes,
        usedScrapeCredits: 0,
        usedVideoMinutes: 0,
        periodStart,
      }
    });
    return { id: ref.id };
  } else {
    const userDoc = users.docs[0];
    await userDoc.ref.set({
      email: parsed.data.email,
      quota: {
        monthlyScrapeCredits: parsed.data.monthlyScrapeCredits,
        monthlyVideoMinutes: parsed.data.monthlyVideoMinutes,
        usedScrapeCredits: 0,
        usedVideoMinutes: 0,
        periodStart,
      }
    }, { merge: true });
    return { id: userDoc.id };
  }
}

export async function getUserQuota(input: { idToken: string, email: string }) {
  if (!input.email) throw new Error("Email required");
  const me = await getAuthenticatedUser(input.idToken);
  if (!me || me.email !== ADMIN_EMAIL) throw new Error("Not authorized");

  const users = await adminDb.collection("users").where("email", "==", input.email).limit(1).get();
  if (users.empty) return null;
  const userDoc = users.docs[0];
  return userDoc.data().quota || null;
}

export async function listUsersWithQuota(input: { idToken: string }) {
  const me = await getAuthenticatedUser(input.idToken);
  if (!me || me.email !== ADMIN_EMAIL) throw new Error("Not authorized");
  const snap = await adminDb.collection("users").get();
  return snap.docs.map(d => ({ id: d.id, email: d.get("email"), quota: d.get("quota") || null }));
}


