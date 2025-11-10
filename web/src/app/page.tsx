export const dynamic = "force-dynamic";
import { redirect } from "next/navigation";
import type { Role } from "@/types/auth";
import MaintenanceNotice from "@/components/MaintenanceNotice";
import { getMaintenanceStatus } from "@/server/maintenance";
import { getSession } from "@/server/auth/session";

const DEFAULT_ROUTE_BY_ROLE: Record<Role, string> = {
  superadmin: "/dashboard/maintenance",
  administrator: "/dashboard",
  "job-controller": "/dashboard/workshop",
  "service-advisor": "/dashboard",
  technician: "/dashboard/technician",
};

export default async function Home() {
  const [maintenance, session] = await Promise.all([
    getMaintenanceStatus(),
    getSession(),
  ]);

  const isSuperAdmin = session?.role === "superadmin";

  if (maintenance.isUnderMaintenance && !isSuperAdmin) {
    return <MaintenanceNotice message={maintenance.maintenanceMessage} />;
  }

  if (!session) {
    redirect("/login");
  }

  const route =
    DEFAULT_ROUTE_BY_ROLE[session.role] ?? DEFAULT_ROUTE_BY_ROLE["job-controller"];

  redirect(route);
}
