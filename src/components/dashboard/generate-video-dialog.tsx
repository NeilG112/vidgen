"use client";

import { useState, useEffect } from "react";
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
// generateVideo is now a server-side API route; client will call /api/video/generate
import { useAuth } from "@/lib/auth";
import { Loader2, Sparkles } from "lucide-react";

interface GenerateVideoDialogProps {
  profile: Profile | null;
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
}

export default function GenerateVideoDialog({ profile, isOpen, onOpenChange }: GenerateVideoDialogProps) {
  const [script, setScript] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [isImproving, setIsImproving] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();

  useEffect(() => {
    if (profile && isOpen) {
      const generateScript = async () => {
        setIsGenerating(true);
        try {
          const result = await generatePersonalizedIntroScript({
            firstName: profile.firstName,
            lastName: profile.lastName,
            headline: profile.headline,
            skills: profile.skills.slice(0, 5), // Limit skills for brevity
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

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle className="font-headline">Generate Intro Video</DialogTitle>
          <DialogDescription>
            For {profile?.fullName}. You can edit the script before generating.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
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
            {isImproving ? <Loader2 className="animate-spin" /> : <Sparkles />}
            Improve with AI
          </Button>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleGenerateVideo} disabled={isGenerating || !script} className="bg-accent hover:bg-accent/90">
            {isGenerating ? <Loader2 className="animate-spin" /> : "Generate Video"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
