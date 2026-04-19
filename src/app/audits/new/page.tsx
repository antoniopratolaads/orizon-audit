import { Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { NewAuditWizard } from "./wizard-client";

export default function Page() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto w-full max-w-3xl space-y-4">
          <Skeleton className="h-10 w-60" />
          <Skeleton className="h-6 w-full" />
          <Skeleton className="h-80 w-full" />
        </div>
      }
    >
      <NewAuditWizard />
    </Suspense>
  );
}
