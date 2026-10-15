import { RestaurantPage } from "@/usecases/restaurant/RestaurantPage";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  const { date } = await searchParams;
  return <RestaurantPage date={date} />;
}
