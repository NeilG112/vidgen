"use server";

import { User as FirebaseUser } from "firebase/auth";
import { initializeApp, getApps } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { adminConfig } from "./firebase/admin";

// Server-side helper to get authenticated user in Server Actions
export async function getAuthenticatedUser(idToken: string): Promise<FirebaseUser> {
  const apps = getApps();
  if (!apps.length) {
    initializeApp(adminConfig);
  }

  if (!idToken) {
    throw new Error("No authentication token provided.");
  }

  try {
  const decodedToken = await getAuth().verifyIdToken(idToken);
  return decodedToken as unknown as FirebaseUser;
  } catch (error) {
    throw new Error("Invalid or expired authentication token.");
  }
}
