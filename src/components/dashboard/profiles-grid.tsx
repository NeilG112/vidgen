"use client";

import { useEffect, useState } from "react";
import { collection, onSnapshot, query, orderBy } from "firebase/firestore";
import { Terminal } from "lucide-react";

import { useAuth } from "@/lib/auth";
import { getClientDb } from "@/lib/firebase/client";
import { type Profile } from "@/lib/types";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import ProfileCard from "./profile-card";
import ProfileDetailsDialog from "./profile-details-dialog";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";


export default function ProfilesGrid() {
  const { user } = useAuth();
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedProfile, setSelectedProfile] = useState<Profile | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  useEffect(() => {
    console.log("Auth user:", user);
    if (!user) {
      setProfiles([]);
      setIsLoading(false);
      setError("You need to be logged in to view your scraped profiles.");
      return;
    }

    setIsLoading(true);
    setError(null);
    const clientDb = getClientDb();
    if (!clientDb) return;
    const q = query(
      collection(clientDb, `users/${user.uid}/profiles`),
      orderBy("scrapedAt", "desc")
    );

    console.log("Executing Firestore query...");
    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      console.log("Firestore query snapshot received:", {
        size: querySnapshot.size,
        empty: querySnapshot.empty,
      });
      const profilesData: Profile[] = [];
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        console.log(`Processing document ${doc.id}:`, data);
        
        if (!data.scrapedAt?.toDate) {
          console.warn(`Document ${doc.id} is missing or has an invalid scrapedAt field.`);
          return;
        }

        let video = null;
        if (data.video) {
            video = {
                ...data.video,
                createdAt: data.video.createdAt?.toDate ? data.video.createdAt.toDate() : new Date(),
            }
        }

        profilesData.push({
          id: doc.id,
          ...data,
          scrapedAt: data.scrapedAt.toDate(),
          video,
        } as Profile);
      });
      console.log("Processed profiles data:", profilesData);
      setProfiles(profilesData);
      setIsLoading(false);
    }, (error) => {
      console.error("Error fetching profiles:", error);
      setError("An error occurred while fetching your profiles. Please try again later.");
      setIsLoading(false);
    });

    return () => {
      console.log("Unsubscribing from Firestore query.");
      unsubscribe();
    };
  }, [user]);

  const handleOpenDialog = (profile: Profile) => {
    setSelectedProfile(profile);
    setIsDialogOpen(true);
  };
  
  const renderGridBody = () => {
    if (isLoading) {
      return Array.from({ length: 3 }).map((_, i) => (
        <Skeleton key={i} className="h-48 w-full" />
      ));
    }

    if (error) {
        return (
            <div className="col-span-full">
                <Alert variant="destructive">
                    <Terminal className="h-4 w-4" />
                    <AlertTitle>Something went wrong!</AlertTitle>
                    <AlertDescription>
                        {error}
                    </AlertDescription>
                </Alert>
            </div>
        )
    }

    if (profiles.length === 0) {
      return (
        <div className="col-span-full text-center py-12">
            <p className="text-lg font-medium">No profiles scraped yet.</p>
            <p className="text-muted-foreground">Use the form above to get started.</p>
        </div>
      );
    }
    
    return profiles.map((profile) => (
        <ProfileCard key={profile.id} profile={profile} onOpenDialog={handleOpenDialog} />
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
        <CardContent className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {renderGridBody()}
        </CardContent>
      </Card>
      <ProfileDetailsDialog
        profile={selectedProfile}
        isOpen={isDialogOpen}
        onOpenChange={setIsDialogOpen}
      />
    </>
  );
}
