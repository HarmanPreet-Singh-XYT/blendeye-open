import { StudioDashboard } from "@/components/dashboard/studio-dashboard";
import { AuthGate } from "@/components/cinema/auth-gate";

export default function DashboardPage() {
  return (
    <AuthGate>
      <StudioDashboard />
    </AuthGate>
  );
}
