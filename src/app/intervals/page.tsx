import { IntervalsExplorerPage } from "@/features/explorer/IntervalsExplorerPage";
import { isDateParam } from "@/lib/time";

export default async function Page(props: PageProps<"/intervals">) {
  const { date } = await props.searchParams;
  return <IntervalsExplorerPage date={isDateParam(date) ? date : undefined} />;
}
