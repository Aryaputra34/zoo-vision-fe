import { ZoneEditorPage } from "@/features/cameras/ZoneEditorPage";

export default async function CameraZonesRoute({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <ZoneEditorPage id={id} />;
}
