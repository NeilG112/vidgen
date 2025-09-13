"use client";

import { useEffect, useState } from "react";
import { collection, onSnapshot, query } from "firebase/firestore";
import Image from "next/image";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";
import { db } from "@/lib/firebase/client";
import { type Profile } from "@/lib/types";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDistanceToNow } from "date-fns";
import GenerateVideoDialog from "./generate-video-dialog";
import { Clapperboard, Download, Play, User } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover";
import Link from "next/link";

export default function ProfilesTable() {
  const { user } = useAuth();
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedProfile, setSelectedProfile] = useState<Profile | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  useEffect(() => {
    if (!user) return;

    setIsLoading(true);
    const q = query(collection(db, `users/${user.uid}/profiles`));
    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const profilesData: Profile[] = [];
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        profilesData.push({
          id: doc.id,
          ...data,
          scrapedAt: data.scrapedAt?.toDate(),
          video: data.video ? { ...data.video, createdAt: data.video.createdAt?.toDate() } : null
        } as Profile);
      });
      setProfiles(profilesData.sort((a,b) => b.scrapedAt.getTime() - a.scrapedAt.getTime()));
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, [user]);

  const handleGenerateClick = (profile: Profile) => {
    setSelectedProfile(profile);
    setIsDialogOpen(true);
  };
  
  const renderTableBody = () => {
    if (isLoading) {
      return Array.from({ length: 3 }).map((_, i) => (
        <TableRow key={i}>
          <TableCell><Skeleton className="h-10 w-10 rounded-full" /></TableCell>
          <TableCell><Skeleton className="h-4 w-32" /></TableCell>
          <TableCell><Skeleton className="h-4 w-48" /></TableCell>
          <TableCell><Skeleton className="h-4 w-24" /></TableCell>
          <TableCell><Skeleton className="h-8 w-32" /></TableCell>
        </TableRow>
      ));
    }

    if (profiles.length === 0) {
      return (
        <TableRow>
          <TableCell colSpan={5} className="h-24 text-center">
            No profiles scraped yet. Use the form above to get started.
          </TableCell>
        </TableRow>
      );
    }
    
    return profiles.map((profile) => (
        <TableRow key={profile.id}>
            <TableCell>
                 <Image
                    src={profile.profilePic || 'https://picsum.photos/seed/1/100/100'}
                    alt={profile.fullName}
                    width={40}
                    height={40}
                    className="rounded-full"
                    data-ai-hint="profile picture"
                />
            </TableCell>
            <TableCell className="font-medium">{profile.fullName}</TableCell>
            <TableCell>{profile.headline}</TableCell>
            <TableCell className="text-muted-foreground">
                {formatDistanceToNow(profile.scrapedAt, { addSuffix: true })}
            </TableCell>
             <TableCell>
            {profile.video ? (
              <Popover>
                <PopoverTrigger asChild>
                    <Button variant="secondary">
                        <Play className="mr-2 h-4 w-4" />
                        View Video
                    </Button>
                </PopoverTrigger>
                <PopoverContent className="w-80">
                  <div className="space-y-4">
                    <video src={profile.video.downloadUrl} controls className="w-full rounded-md" />
                    <div className="flex justify-between items-center">
                        <p className="text-xs text-muted-foreground">Generated {formatDistanceToNow(profile.video.createdAt, { addSuffix: true })}</p>
                        <Button asChild size="sm">
                            <Link href={profile.video.downloadUrl} target="_blank" download>
                                <Download className="mr-2 h-4 w-4"/>
                                Download
                            </Link>
                        </Button>
                    </div>
                  </div>
                </PopoverContent>
              </Popover>
            ) : (
                <Button onClick={() => handleGenerateClick(profile)}>
                    <Clapperboard className="mr-2 h-4 w-4" />
                    Generate Intro
                </Button>
            )}
            </TableCell>
        </TableRow>
    ));
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="font-headline">Scraped Profiles</CardTitle>
          <CardDescription>
            Here are the LinkedIn profiles you've recently scraped.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead></TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Headline</TableHead>
                <TableHead>Scraped</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {renderTableBody()}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      <GenerateVideoDialog
        profile={selectedProfile}
        isOpen={isDialogOpen}
        onOpenChange={setIsDialogOpen}
      />
    </>
  );
}
