"use client";

import { useEffect, useState } from "react";
import { doc, onSnapshot, query, collection, where, orderBy, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import { useAuth } from "@/lib/auth";

function startOfMonthDate() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1);
}

export default function CreditsBar() {
  const { user } = useAuth();
  const [credits, setCredits] = useState<{ scraping?: number; video?: number } | null>(null);
  const [usageThisMonth, setUsageThisMonth] = useState<{ scraping: number; video: number }>({ scraping: 0, video: 0 });

  useEffect(() => {
    if (!user) return;
    const creditsRef = doc(db, 'users', user.uid, 'meta', 'credits');
    const unsub = onSnapshot(creditsRef, (snap) => {
      setCredits(snap.exists() ? (snap.data() as any) : { scraping: 0, video: 0 });
    });

    // load usage for this month (one-time load)
    (async () => {
      const start = startOfMonthDate();
      const usageQ = query(collection(db, 'users', user.uid, 'usage'), where('createdAt', '>=', start), orderBy('createdAt', 'desc'));
      try {
        const snap = await getDocs(usageQ);
        let scraping = 0;
        let video = 0;
        snap.forEach(d => {
          const data = d.data() as any;
          if (data.type === 'scraping') scraping += (data.amount || 0);
          if (data.type === 'video') video += (data.amount || 0);
        });
        setUsageThisMonth({ scraping, video });
      } catch (e) {
        // ignore
      }
    })();

    return () => unsub();
  }, [user]);

  if (!user) return null;

  const availableScraping = credits?.scraping ?? 0;
  const usedScraping = usageThisMonth.scraping;
  const limitScraping = availableScraping + usedScraping;

  const availableVideo = credits?.video ?? 0;
  const usedVideo = usageThisMonth.video;
  const limitVideo = availableVideo + usedVideo;

  const pct = (used: number, limit: number) => {
    if (!limit) return 0;
    return Math.min(100, Math.round((used / limit) * 100));
  };

  return (
    <div className="w-56 p-4 bg-background rounded-md shadow-sm">
      <h3 className="text-sm font-medium mb-3">Credits</h3>
      <div className="mb-4">
        <div className="text-xs text-muted-foreground flex justify-between"><span>Scraping</span><span>{availableScraping}/{limitScraping}</span></div>
        <div className="h-2 bg-muted rounded mt-1 overflow-hidden">
          <div className="h-2 bg-green-600" style={{ width: `${pct(usedScraping, limitScraping)}%` }} />
        </div>
      </div>
      <div className="mb-4">
        <div className="text-xs text-muted-foreground flex justify-between"><span>Video</span><span>{availableVideo}/{limitVideo}</span></div>
        <div className="h-2 bg-muted rounded mt-1 overflow-hidden">
          <div className="h-2 bg-blue-600" style={{ width: `${pct(usedVideo, limitVideo)}%` }} />
        </div>
      </div>
      <div className="text-xs text-muted-foreground">Reset: {new Date(new Date().getFullYear(), new Date().getMonth()+1, 1).toLocaleDateString()}</div>
    </div>
  );
}
