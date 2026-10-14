import { RequireRole } from "@/auth/RequireRole";
import { Rebuilding } from "@/components/Rebuilding";

export default function LoginsHistoryPage() {
  return (
    <RequireRole min="MANAGER">
      <Rebuilding title="Riwayat Login" task="T8" />
    </RequireRole>
  );
}
