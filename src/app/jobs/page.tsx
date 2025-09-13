import AppLayout from "@/components/layout/app-layout";
import JobsTable from "@/components/jobs/jobs-table";

export default function JobsPage() {
  return (
    <AppLayout>
      <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
        <div className="flex items-center justify-between space-y-2">
          <h1 className="text-3xl font-bold tracking-tight font-headline">Job History</h1>
        </div>
        <p className="text-muted-foreground">
          Track the status of your profile scraping and video generation jobs.
        </p>
        <JobsTable />
      </div>
    </AppLayout>
  );
}
