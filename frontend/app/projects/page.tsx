import { Suspense } from "react";
import AllProjects from "@/components/pages/projects/AllProjects";

export default function Page() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <AllProjects />
    </Suspense>
  );
}
