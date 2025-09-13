import AppLayout from "@/components/layout/app-layout";
import ProfileScraper from "@/components/dashboard/profile-scraper";
import ProfilesTable from "@/components/dashboard/profiles-table";

export default function DashboardPage() {
  return (
    <AppLayout>
      <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
        <div className="flex items-center justify-between space-y-2">
          <h1 className="text-3xl font-bold tracking-tight font-headline">Dashboard</h1>
        </div>
        <ProfileScraper />
        <ProfilesTable />
      </div>
    </AppLayout>
  );
}
