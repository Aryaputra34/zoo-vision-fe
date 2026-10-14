import { RequireRole } from "@/auth/RequireRole";
import { Rebuilding } from "@/components/Rebuilding";

export default function SystemEventsPage() {
  return (
    <RequireRole min="MANAGER">
      <Rebuilding title="Kejadian Sistem" task="T8" />
    </RequireRole>
  );
}
