"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { type Profile } from "@/lib/types";
import { generatePersonalizedIntroScript } from "@/ai/flows/generate-personalized-intro-script";
import { improveIntroScript } from "@/ai/flows/improve-intro-script";
// generateVideo action is server-side; call /api/video/generate instead
import { useAuth } from "@/lib/auth";
import { doc, onSnapshot } from "firebase/firestore";
import { getClientDb } from "@/lib/firebase/client";
import { Loader2, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";

interface ProfileDetailsDialogProps {
  profile: Profile | null;
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
}

export default function ProfileDetailsDialog({ profile, isOpen, onOpenChange }: ProfileDetailsDialogProps) {
  const [script, setScript] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [isImproving, setIsImproving] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();
  const [credits, setCredits] = useState<{ video?: number } | null>(null);

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

  useEffect(() => {
    if (profile && isOpen) {
      const generateScript = async () => {
        setIsGenerating(true);
        try {
          const result = await generatePersonalizedIntroScript({
            firstName: profile.firstName,
            lastName: profile.lastName,
            headline: profile.headline,
            skills: profile.skills.slice(0, 5),
            company: profile.currentCompany || "their current role",
          });
          setScript(result.script);
        } catch (error) {
          toast({
            variant: "destructive",
            title: "Error Generating Script",
            description: "Could not generate a personalized script.",
          });
          setScript(`Hi ${profile.firstName}, I came across your profile and was impressed with your background. I'd love to connect.`);
        } finally {
          setIsGenerating(false);
        }
      };
      generateScript();
    }
  }, [profile, isOpen, toast]);

  const handleImproveScript = async () => {
    setIsImproving(true);
    try {
      const result = await improveIntroScript({ script });
      setScript(result.improvedScript);
      toast({
        title: "Script Improved!",
        description: "The script has been enhanced by AI.",
      });
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error Improving Script",
        description: "Could not improve the script at this time.",
      });
    } finally {
      setIsImproving(false);
    }
  };

  const handleGenerateVideo = async () => {
    if (!profile || !user) return;
    setIsGenerating(true);
    try {
      // estimate minutes required from script (130 wpm) before calling server
      const words = script.split(/\s+/).filter(Boolean).length;
      const minutesEstimate = Math.max(1, Math.ceil(words / 130));
      const available = credits?.video ?? 0;
      if (available < minutesEstimate) {
        toast({ variant: 'destructive', title: 'Insufficient credits', description: `This video will take ~${minutesEstimate} minute(s) and you have ${available} video credits.` });
        setIsGenerating(false);
        return;
      }

      const idToken = await user.getIdToken();
      const res = await fetch('/api/video/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profileId: profile.id, script, idToken }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Video generation failed');
      toast({
        title: "Video Generation Started",
        description: "Your video is being created. You can track its progress on the Jobs page.",
      });
      onOpenChange(false);
    } catch (error) {
        let errorMessage = "An unknown error occurred.";
        if (error instanceof Error) {
            errorMessage = error.message;
        }
      toast({
        variant: "destructive",
        title: "Video Generation Failed",
        description: errorMessage,
      });
    } finally {
      setIsGenerating(false);
    }
  };

  if (!profile) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[800px]">
        <ScrollArea className="max-h-[80vh]">
          <DialogHeader>
            <div className="flex items-center space-x-4">
              <Image
                src={profile.profilePic || 'https://picsum.photos/seed/1/100/100'}
                alt={profile.fullName}
                width={80}
                height={80}
                className="rounded-full"
              />
              <div>
                <DialogTitle className="font-headline text-2xl">{profile.fullName}</DialogTitle>
                <DialogDescription>{profile.headline}</DialogDescription>
              </div>
            </div>
          </DialogHeader>
          <div className="grid gap-6 py-4 px-2">
            <div>
              <h3 className="font-semibold mb-2">About</h3>
              <p className="text-sm text-muted-foreground">{profile.about}</p>
            </div>

            <div>
              <h3 className="font-semibold mb-2">Experience</h3>
              <ul className="space-y-4">
                {(profile.experience || []).map((exp: any, index: number) => (
                  <li key={index} className="text-sm">
                    <p className="font-medium">{exp.title}</p>
                    <p className="text-muted-foreground">{exp.company}</p>
                    <p className="text-xs text-muted-foreground">{exp.duration}</p>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <h3 className="font-semibold mb-2">Skills</h3>
              <div className="flex flex-wrap gap-2">
                {profile.skills.map((skill, index) => (
                  <Badge key={index} variant="secondary">{skill}</Badge>
                ))}
              </div>
            </div>

            {profile.video && (
              <div>
                <h3 className="font-semibold mb-2">Generated Video</h3>
                <div className="bg-muted rounded-lg p-4">
                  <video 
                    controls 
                    className="w-full max-w-md mx-auto rounded-lg"
                    poster={profile.profilePic}
                  >
                    <source src={profile.video.downloadUrl} type="video/mp4" />
                    Your browser does not support the video tag.
                  </video>
                  <p className="text-xs text-muted-foreground mt-2 text-center">
                    Generated on {new Date(profile.video.createdAt).toLocaleDateString()}
                  </p>
                </div>
              </div>
            )}

            <div className="grid w-full gap-2">
              <Label htmlFor="script">Intro Script</Label>
              {isGenerating && !script ? (
                  <div className="flex items-center justify-center h-40 rounded-md border border-dashed">
                      <Loader2 className="animate-spin text-muted-foreground" />
                  </div>
              ) : (
                  <Textarea
                      id="script"
                      value={script}
                      onChange={(e) => setScript(e.target.value)}
                      placeholder="Enter your intro script here..."
                      rows={6}
                  />
              )}
            </div>
            <Button
              variant="outline"
              onClick={handleImproveScript}
              disabled={isImproving || !script}
              className="w-fit"
            >
              {isImproving ? <Loader2 className="animate-spin mr-2" /> : <Sparkles className="mr-2" />}
              Improve with AI
            </Button>
          </div>
          <DialogFooter className="sticky bottom-0 bg-background/95 backdrop-blur-sm pt-4">
            <div className="mr-auto text-sm text-muted-foreground flex items-center gap-4">
              <div>Video credits: <strong>{credits?.video ?? 0}</strong></div>
            </div>
            <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button onClick={handleGenerateVideo} disabled={isGenerating || !script} className="bg-accent hover:bg-accent/90">
              {isGenerating ? <Loader2 className="animate-spin mr-2" /> : null}
              Generate Video
            </Button>
          </DialogFooter>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}