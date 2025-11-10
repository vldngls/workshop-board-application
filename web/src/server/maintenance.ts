interface MaintenanceStatus {
  isUnderMaintenance: boolean;
  maintenanceMessage?: string;
}

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:4000";

export async function getMaintenanceStatus(): Promise<MaintenanceStatus> {
  try {
    const response = await fetch(
      `${API_BASE}/maintenance/settings/public`,
      {
        method: "GET",
        // Always fetch the latest maintenance status
        cache: "no-store",
      },
    );

    if (!response.ok) {
      if (response.status === 404) {
        return { isUnderMaintenance: false };
      }

      console.warn(
        "[maintenance] Failed to fetch maintenance status:",
        response.status,
        response.statusText,
      );
      return { isUnderMaintenance: false };
    }

    const data = (await response.json()) as MaintenanceStatus | null;

    if (!data) {
      return { isUnderMaintenance: false };
    }

    return {
      isUnderMaintenance: Boolean(data.isUnderMaintenance),
      maintenanceMessage: data.maintenanceMessage,
    };
  } catch (error) {
    console.warn("[maintenance] Error fetching maintenance status:", error);
    return { isUnderMaintenance: false };
  }
}


