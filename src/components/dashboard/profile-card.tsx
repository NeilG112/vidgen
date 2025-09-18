"use client";

import Image from "next/image";
import { type Profile } from "@/lib/types";
import { useAuth } from "@/lib/auth";
import { useEffect, useState } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { getClientDb } from "@/lib/firebase/client";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";

interface ProfileCardProps {
  profile: Profile;
  onOpenDialog: (profile: Profile) => void;
}

export default function ProfileCard({ profile, onOpenDialog }: ProfileCardProps) {
  const { user } = useAuth();
  const [credits, setCredits] = useState<{ scraping?: number, video?: number, resetAt?: any } | null>(null);

  useEffect(() => {
    if (!user) return;
    const clientDb = getClientDb();
    if (!clientDb) return;
    const creditsRef = doc(clientDb, 'users', user.uid, 'meta', 'credits');
    const unsub = onSnapshot(creditsRef, (snap) => {
      if (snap.exists()) setCredits(snap.data() as any);
      else setCredits(null);
    });
    return () => unsub();
  }, [user]);

  const nextReset = () => {
    const now = new Date();
    const next = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    return next.toLocaleDateString();
  };
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center space-x-4">
          <Image
            src={profile.profilePic || 'https://picsum.photos/seed/1/100/100'}
            alt={profile.fullName}
            width={60}
            height={60}
            className="rounded-full"
          />
          <CardTitle className="font-headline">{profile.fullName}</CardTitle>
        </div>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground line-clamp-2">{profile.headline}</p>
        {profile.video && (
          <div className="mt-2 text-xs text-muted-foreground">Video cost: ~1 credit/min</div>
        )}
      </CardContent>
      <CardFooter>
        <div className="w-full">
          {profile.video?.secondsUsed && (
            <div className="mb-2 text-sm text-muted-foreground">Video used: <strong>{profile.video.secondsUsed}s</strong></div>
          )}
          <div className="mb-2 text-xs text-muted-foreground">Next reset: {nextReset()}</div>
          <Button onClick={() => onOpenDialog(profile)} className="w-full">
            View Profile
          </Button>
        </div>
      </CardFooter>
    </Card>
  );
}