"use server";

import { getAdminDb } from "@/lib/firebase/admin";
import { Job, JobStatus } from "@/lib/types";
import { FieldValue } from "firebase-admin/firestore";

type CreateJobPayload = {
  userId: string;
  type: Job['type'];
  status: Job['status'];
  metadata?: Record<string, any>;
};

export async function createJob(payload: CreateJobPayload): Promise<string> {
  const adminDb = getAdminDb();
  const jobRef = adminDb.collection(`users/${payload.userId}/jobs`).doc();
  
  const newJob: Omit<Job, 'id'> = {
    type: payload.type,
    status: payload.status,
    createdAt: FieldValue.serverTimestamp() as any,
    updatedAt: FieldValue.serverTimestamp() as any,
    metadata: payload.metadata || {},
  };

  await jobRef.set(newJob);
  return jobRef.id;
}

type UpdateJobPayload = {
    userId: string;
    jobId: string;
    status: JobStatus;
    metadata?: Record<string, any>;
};

export async function updateJob(payload: UpdateJobPayload) {
  const adminDb = getAdminDb();
  const jobRef = adminDb.collection(`users/${payload.userId}/jobs`).doc(payload.jobId);

    const updateData: any = {
        status: payload.status,
        updatedAt: FieldValue.serverTimestamp(),
    };

    if (payload.metadata) {
        updateData.metadata = FieldValue.arrayUnion(payload.metadata)
    }

    await jobRef.update(updateData);
}
