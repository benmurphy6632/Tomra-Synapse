import ImageClassification from "@/components/pages/image-classification/ImageClassification";

export default async function Page({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  return <ImageClassification projectId={projectId} />;
}