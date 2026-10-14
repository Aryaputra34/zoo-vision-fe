import { RequireRole } from "@/auth/RequireRole";
import { Rebuilding } from "@/components/Rebuilding";

export default function AuditLogPage() {
  return (
    <RequireRole min="MANAGER">
      <Rebuilding title="Audit Log" task="T8" />
    </RequireRole>
  );
}
