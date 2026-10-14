import { RequireRole } from "@/auth/RequireRole";
import { Rebuilding } from "@/components/Rebuilding";

export default function ModelsConfigPage() {
  return (
    <RequireRole min="MANAGER">
      <Rebuilding title="Konfigurasi Model AI" task="T3" />
    </RequireRole>
  );
}
