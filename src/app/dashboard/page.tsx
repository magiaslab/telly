import { Suspense } from "react";
import { DashboardContent } from "./dashboard-content";
import DashboardLoading from "./loading";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams: Promise<{ tesla_error?: string }> | { tesla_error?: string };
};

export default async function DashboardPage(props: PageProps) {
  const searchParams = await Promise.resolve(props.searchParams);
  return (
    <Suspense fallback={<DashboardLoading />}>
      <DashboardContent teslaError={searchParams.tesla_error} />
    </Suspense>
  );
}
