import { CameraEditPage } from "@/features/cameras/CameraEditPage";

export default async function CameraEditRoute({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <CameraEditPage id={id} />;
}
