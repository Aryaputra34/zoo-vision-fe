import { OverviewPage } from "@/usecases/overview/OverviewPage";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  const { date } = await searchParams;
  return <OverviewPage date={date} />;
}
