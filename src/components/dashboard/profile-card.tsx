"use client";

import Image from "next/image";
import { type Profile } from "@/lib/types";
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
      </CardContent>
      <CardFooter>
        <Button onClick={() => onOpenDialog(profile)} className="w-full">
          View Profile
        </Button>
      </CardFooter>
    </Card>
  );
}