import { RequireRole } from "@/auth/RequireRole";
import { Rebuilding } from "@/components/Rebuilding";

export default function UsersConfigPage() {
  return (
    <RequireRole min="MANAGER">
      <Rebuilding title="Manajemen Pengguna" task="T4" />
    </RequireRole>
  );
}
