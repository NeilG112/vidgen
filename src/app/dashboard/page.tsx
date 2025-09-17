import AppLayout from "@/components/layout/app-layout";
import ProfileScraper from "@/components/dashboard/profile-scraper";
import ProfilesGrid from "@/components/dashboard/profiles-grid";
import CreditsBar from "@/components/dashboard/credits-bar";

export default function DashboardPage() {
  return (
    <AppLayout>
      <div className="flex gap-6 p-4 md:p-8 pt-6">
        <aside className="flex-shrink-0">
          <CreditsBar />
        </aside>
        <div className="flex-1 space-y-4">
          <div className="flex items-center justify-between space-y-2">
            <h1 className="text-3xl font-bold tracking-tight font-headline">Dashboard</h1>
          </div>
          <ProfileScraper />
          <ProfilesGrid />
        </div>
      </div>
    </AppLayout>
  );
}
