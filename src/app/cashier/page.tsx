import { CashierPage } from "@/usecases/cashier_presence/CashierPage";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  const { date } = await searchParams;
  return <CashierPage date={date} />;
}
