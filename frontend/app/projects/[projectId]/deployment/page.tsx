import ModelDeployment from "@/components/pages/model-deployment/ModelDeployment";

export default async function Page({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  return <ModelDeployment projectId={projectId} />;
}