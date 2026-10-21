import { LoginsPage } from "@/features/system-log/LoginsPage";
import { isDateParam } from "@/lib/time";

export default async function Page(props: PageProps<"/system-log/logins">) {
  const { date } = await props.searchParams;
  return <LoginsPage date={isDateParam(date) ? date : undefined} />;
}
