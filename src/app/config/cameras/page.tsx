import { RequireRole } from "@/auth/RequireRole";
import { Rebuilding } from "@/components/Rebuilding";

export default function CamerasConfigPage() {
  return (
    <RequireRole min="MANAGER">
      <Rebuilding title="Konfigurasi Kamera" task="T1" />
    </RequireRole>
  );
}
