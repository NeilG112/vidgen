"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { setUserQuota, listUsersWithQuota } from "@/lib/actions/adminActions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";

const ADMIN_EMAIL = "neilganguly2007@gmail.com";

export default function AdminPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [email, setEmail] = useState("");
  const [scrape, setScrape] = useState(50);
  const [video, setVideo] = useState(50);
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const refresh = async () => {
    if (!user) return;
    const idToken = await user.getIdToken();
    try {
      const list = await listUsersWithQuota({ idToken });
      setRows(list);
    } catch (e: any) {
      toast({ variant: "destructive", title: "Failed to load", description: e?.message || String(e) });
    }
  };

  useEffect(() => { refresh(); }, [user]);

  const onSave = async () => {
    if (!user) return;
    if (user.email !== ADMIN_EMAIL) {
      toast({ variant: "destructive", title: "Not authorized" });
      return;
    }
    setLoading(true);
    try {
      const idToken = await user.getIdToken();
      await setUserQuota({ idToken, email, monthlyScrapeCredits: scrape, monthlyVideoMinutes: video });
      toast({ title: "Saved" });
      setEmail("");
      await refresh();
    } catch (e: any) {
      toast({ variant: "destructive", title: "Save failed", description: e?.message || String(e) });
    } finally {
      setLoading(false);
    }
  };

  if (!user) return null;
  if (user.email !== ADMIN_EMAIL) {
    return (
      <Card>
        <CardHeader><CardTitle>Admin</CardTitle></CardHeader>
        <CardContent>Not authorized.</CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="font-headline">Set User Quota</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Input placeholder="user@example.com" value={email} onChange={e => setEmail(e.target.value)} />
          <Input type="number" min={0} value={scrape} onChange={e => setScrape(parseInt(e.target.value || "0"))} />
          <Input type="number" min={0} value={video} onChange={e => setVideo(parseInt(e.target.value || "0"))} />
          <Button onClick={onSave} disabled={loading}>Save</Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="font-headline">Users</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Email</TableHead>
                <TableHead>Scrape (used/limit)</TableHead>
                <TableHead>Video (used/limit)</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.id}>
                  <TableCell>{r.email}</TableCell>
                  <TableCell>{(r.quota?.usedScrapeCredits || 0)}/{(r.quota?.monthlyScrapeCredits || 0)}</TableCell>
                  <TableCell>{(r.quota?.usedVideoMinutes || 0)}/{(r.quota?.monthlyVideoMinutes || 0)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}


