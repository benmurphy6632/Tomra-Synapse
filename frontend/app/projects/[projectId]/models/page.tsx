import ModelVersions from "@/components/pages/modelVersions/modelV";

export default function ModelsPage({
  params,
}: {
  params: { projectId: string };
}) {
  return (
    <div className="relative z-10 p-7 text-white">
      <ModelVersions />
    </div>
  );
}