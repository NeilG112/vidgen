import { FieldValue } from "firebase-admin/firestore";

export type Profile = {
  id: string;
  linkedinUrl: string;
  firstName: string;
  lastName: string;
  fullName: string;
  headline: string;
  skills: string[];
  location: string;
  profilePic: string;
  currentCompany?: string;
  scrapedAt: Date;
  about?: string;
  experience?: Array<any>;
  video: {
    storagePath: string;
    downloadUrl: string;
    createdAt: Date;
    secondsUsed?: number;
  } | null;
};

export type JobStatus = 'pending' | 'running' | 'succeeded' | 'failed';

export type JobType = 'profile_scraping' | 'video_generation';

export type Job = {
    id: string;
    type: JobType;
    status: JobStatus;
    createdAt: Date;
    updatedAt: Date;
    metadata: Record<string, any>;
};
