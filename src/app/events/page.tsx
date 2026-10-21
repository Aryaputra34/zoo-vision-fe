import { EventsExplorerPage } from "@/features/explorer/EventsExplorerPage";
import { isDateParam } from "@/lib/time";

export default async function Page(props: PageProps<"/events">) {
  const { date } = await props.searchParams;
  return <EventsExplorerPage date={isDateParam(date) ? date : undefined} />;
}
