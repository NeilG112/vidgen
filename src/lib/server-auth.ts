"use server";

import { User as FirebaseUser } from "firebase/auth";
import { getAdminApp } from "./firebase/admin";
import { getAuth } from "firebase-admin/auth";

// Server-side helper to get authenticated user in Server Actions
export async function getAuthenticatedUser(idToken: string): Promise<FirebaseUser> {
  // Lazily initialize admin app (throws if env not set)
  getAdminApp();

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
