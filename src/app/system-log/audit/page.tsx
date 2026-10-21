import { AuditLogPage } from "@/features/system-log/AuditLogPage";
import { isDateParam } from "@/lib/time";

export default async function Page(props: PageProps<"/system-log/audit">) {
  const { date } = await props.searchParams;
  return <AuditLogPage date={isDateParam(date) ? date : undefined} />;
}
