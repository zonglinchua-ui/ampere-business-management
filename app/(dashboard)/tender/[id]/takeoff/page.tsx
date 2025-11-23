import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { MainLayout } from "@/components/layout/main-layout";
import { TakeoffWorkspace } from "@/components/takeoff/TakeoffWorkspace";
import {
  fetchInitialMeasurements,
  fetchTakeoffSheets,
} from "@/lib/takeoff/loaders";

interface TakeoffPageProps {
  params: { id: string };
}

export default async function TenderTakeoffPage({
  params,
}: TakeoffPageProps) {
  const session = await getServerSession(authOptions);

  if (!session) {
    redirect("/auth/login");
  }

  const tenderId = params.id;

  const [sheets, measurements] = await Promise.all([
    fetchTakeoffSheets(tenderId),
    fetchInitialMeasurements(tenderId),
  ]);

  return (
    <MainLayout>
      <div className="p-6">
        <div className="mb-6 space-y-1">
          <p className="text-sm text-muted-foreground">Tender #{tenderId}</p>
          <h1 className="text-2xl font-semibold tracking-tight">Takeoff workspace</h1>
          <p className="text-sm text-muted-foreground">
            Review drawings, manage sheets, and capture measurements in one place.
          </p>
        </div>
        <TakeoffWorkspace
          tenderId={tenderId}
          sheets={sheets}
          initialMeasurements={measurements}
        />
      </div>
    </MainLayout>
  );
}
