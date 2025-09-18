"use client";

import { useState, useEffect } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, PlusCircle, Trash2, UploadCloud } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
// server action moved to API route to avoid leaking secrets into client bundles
import { useAuth } from "@/lib/auth";
import { doc, onSnapshot } from "firebase/firestore";
import { getClientDb } from "@/lib/firebase/client";

const urlSchema = z.string().url().refine(
  (url) => url.startsWith("https://www.linkedin.com/in/"),
  "URL must be a valid LinkedIn profile URL (linkedin.com/in/...)"
);

const formSchema = z.object({
  profileUrls: z.array(z.object({ value: urlSchema })).max(10, "You can scrape a maximum of 10 profiles at a time.").min(1, "Please add at least one profile URL."),
});

export default function ProfileScraper() {
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [credits, setCredits] = useState<{ scraping?: number } | null>(null);
  const { toast } = useToast();

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

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      profileUrls: [{ value: "" }],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "profileUrls",
  });

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    if (!user) {
      toast({
        variant: "destructive",
        title: "Authentication Error",
        description: "You must be logged in to scrape profiles.",
      });
      return;
    }

    setIsLoading(true);
    try {
  const idToken = await user.getIdToken();
  const urls = values.profileUrls.map(item => item.value);

      // client-side check for scraping credits
      const available = credits?.scraping ?? 0;
      if (available < urls.length) {
        toast({ variant: "destructive", title: "Insufficient credits", description: `You need ${urls.length} scraping credits but have ${available}.` });
        setIsLoading(false);
        return;
      }

      // Call server API route which will use server-side secrets safely
      const res = await fetch('/api/scrapeProfiles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profileUrls: urls, idToken }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Failed to start scraping');
      toast({
        title: "Scraping Started",
        description: "Your profiles are being scraped. You can track progress on the Jobs page.",
      });
      form.reset({ profileUrls: [{ value: "" }] });
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Scraping Failed",
        description: error.message || "An unexpected error occurred.",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileUpload = () => {
    toast({
        title: "Feature Coming Soon",
        description: "CSV and Excel file uploads will be available in a future update.",
    });
  }

  return (
    <Tabs defaultValue="manual">
      <TabsList className="grid w-full grid-cols-2 md:w-[400px]">
        <TabsTrigger value="manual">Manual Input</TabsTrigger>
        <TabsTrigger value="file">Upload File</TabsTrigger>
      </TabsList>
      <TabsContent value="manual">
        <Card>
          <CardHeader>
            <CardTitle className="font-headline">Scrape LinkedIn Profiles</CardTitle>
            <CardDescription>
              Enter up to 10 LinkedIn profile URLs to scrape.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <div className="space-y-4">
                  {fields.map((field, index) => (
                    <FormField
                      key={field.id}
                      control={form.control}
                      name={`profileUrls.${index}.value`}
                      render={({ field }) => (
                        <FormItem>
                          <div className="flex items-center gap-2">
                            <FormControl>
                              <Input
                                placeholder="https://www.linkedin.com/in/username"
                                {...field}
                              />
                            </FormControl>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              onClick={() => remove(index)}
                              disabled={fields.length === 1}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  ))}
                </div>
                 <FormMessage>
                  {form.formState.errors.profileUrls?.message}
                </FormMessage>
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => append({ value: "" })}
                    disabled={fields.length >= 10}
                  >
                    <PlusCircle className="mr-2 h-4 w-4" />
                    Add URL
                  </Button>
                  <Button type="submit" disabled={isLoading || ((credits?.scraping ?? 0) < fields.length)} className="bg-accent hover:bg-accent/90">
                    {isLoading ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : null}
                    Start Scraping
                  </Button>
                </div>
              </form>
            </Form>
          </CardContent>
        </Card>
      </TabsContent>
      <TabsContent value="file">
        <Card>
          <CardHeader>
            <CardTitle className="font-headline">Upload a File</CardTitle>
            <CardDescription>
              Upload a CSV or Excel file containing LinkedIn profile URLs.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col items-center justify-center p-8 border-2 border-dashed rounded-lg">
                <UploadCloud className="w-12 h-12 text-muted-foreground" />
                <p className="mt-4 text-sm text-muted-foreground">Drag and drop your file here, or click to browse.</p>
                <Button variant="outline" className="mt-4" onClick={handleFileUpload}>
                    Browse Files
                </Button>
            </div>
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>
  );
}
