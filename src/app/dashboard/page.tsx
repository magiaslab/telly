import { Suspense } from "react";
import { DashboardContent } from "./dashboard-content";
import DashboardLoading from "./loading";

export const dynamic = "force-dynamic";

export default function DashboardPage() {
  return (
    <Suspense fallback={<DashboardLoading />}>
      <DashboardContent />
    </Suspense>
  );
}
