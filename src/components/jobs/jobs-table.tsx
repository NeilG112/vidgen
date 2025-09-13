"use client";

import { useEffect, useState } from "react";
import { collection, onSnapshot, query, orderBy } from "firebase/firestore";
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
import { useAuth } from "@/lib/auth";
import { db } from "@/lib/firebase/client";
import { type Job } from "@/lib/types";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDistanceToNow } from "date-fns";
import { Loader2, CheckCircle2, XCircle, Bot } from "lucide-react";

export default function JobsTable() {
  const { user } = useAuth();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!user) return;

    setIsLoading(true);
    const q = query(collection(db, `users/${user.uid}/jobs`), orderBy("createdAt", "desc"));

    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const jobsData: Job[] = [];
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        jobsData.push({
          id: doc.id,
          ...data,
          createdAt: data.createdAt?.toDate(),
        } as Job);
      });
      setJobs(jobsData);
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, [user]);

  const getStatusBadge = (status: Job["status"]) => {
    switch (status) {
      case "pending":
        return <Badge variant="outline"><Loader2 className="mr-1 h-3 w-3 animate-spin" />Pending</Badge>;
      case "running":
        return <Badge variant="secondary"><Loader2 className="mr-1 h-3 w-3 animate-spin" />Running</Badge>;
      case "succeeded":
        return <Badge className="bg-green-600 hover:bg-green-600/90"><CheckCircle2 className="mr-1 h-3 w-3" />Succeeded</Badge>;
      case "failed":
        return <Badge variant="destructive"><XCircle className="mr-1 h-3 w-3" />Failed</Badge>;
      default:
        return <Badge variant="outline">Unknown</Badge>;
    }
  };

  const renderTableBody = () => {
    if (isLoading) {
      return Array.from({ length: 5 }).map((_, i) => (
        <TableRow key={i}>
          <TableCell><Skeleton className="h-4 w-32" /></TableCell>
          <TableCell><Skeleton className="h-6 w-24 rounded-full" /></TableCell>
          <TableCell><Skeleton className="h-4 w-40" /></TableCell>
          <TableCell><Skeleton className="h-4 w-full" /></TableCell>
        </TableRow>
      ));
    }

    if (jobs.length === 0) {
      return (
        <TableRow>
          <TableCell colSpan={4} className="h-24 text-center">
            No jobs have been run yet.
          </TableCell>
        </TableRow>
      );
    }
    
    return jobs.map((job) => (
        <TableRow key={job.id}>
            <TableCell className="font-medium capitalize flex items-center">
                <Bot className="mr-2 h-4 w-4 text-muted-foreground" />
                {job.type.replace('_', ' ')}
            </TableCell>
            <TableCell>{getStatusBadge(job.status)}</TableCell>
            <TableCell className="text-muted-foreground">
                {formatDistanceToNow(job.createdAt, { addSuffix: true })}
            </TableCell>
            <TableCell className="text-xs text-muted-foreground">{job.id}</TableCell>
        </TableRow>
    ));
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-headline">Jobs</CardTitle>
        <CardDescription>
          A log of all your automated tasks.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Type</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Created</TableHead>
              <TableHead>Job ID</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {renderTableBody()}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
