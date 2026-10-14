import { RidesPage } from "@/usecases/horse_riding/RidesPage";
import { isDateParam, todayLocal } from "@/lib/time";

export default async function Page(props: PageProps<"/rides">) {
  const { date } = await props.searchParams;
  return <RidesPage date={isDateParam(date) ? date : todayLocal()} />;
}
