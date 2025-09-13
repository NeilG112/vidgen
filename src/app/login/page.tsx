import { LoginForm } from "@/components/auth/login-form";
import { Film, Network } from "lucide-react";

export default function LoginPage() {
  return (
    <div className="flex items-center justify-center min-h-screen bg-background">
      <div className="w-full max-w-md p-8 space-y-8">
        <div className="flex flex-col items-center">
            <div className="flex items-center gap-2 mb-4">
                <div className="p-3 bg-primary rounded-lg">
                    <Film className="h-8 w-8 text-primary-foreground" />
                </div>
                <h1 className="text-4xl font-bold font-headline text-primary">RecruitFlow</h1>
            </div>
          <p className="text-muted-foreground">
            Sign in to access your dashboard
          </p>
        </div>
        <LoginForm />
      </div>
    </div>
  );
}
