import { RequireRole } from "@/auth/RequireRole";
import { Rebuilding } from "@/components/Rebuilding";

export default function ApiTokensConfigPage() {
  return (
    <RequireRole min="SUPERADMIN">
      <Rebuilding title="Token API" task="T4" />
    </RequireRole>
  );
}
