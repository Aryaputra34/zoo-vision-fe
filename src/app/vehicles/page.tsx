import { VehiclesPage } from "@/usecases/vehicle_gate/VehiclesPage";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  const { date } = await searchParams;
  return <VehiclesPage date={date} />;
}
