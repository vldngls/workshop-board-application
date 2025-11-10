export interface DashboardOverviewData {
  jobOrders?: unknown;
  technicians?: unknown;
  stats?: unknown;
}

async function safeFetchJson(
  input: RequestInfo | URL,
  headers?: HeadersInit,
): Promise<unknown | undefined> {
  try {
    const response = await fetch(input, {
      credentials: "include",
      headers,
    });

    if (!response.ok) {
      console.warn(
        "[dashboard] Failed to fetch",
        typeof input === "string" ? input : input.toString(),
        response.status,
        response.statusText,
      );
      return undefined;
    }

    return response.json().catch(() => undefined);
  } catch (error) {
    console.warn(
      "[dashboard] Error fetching",
      typeof input === "string" ? input : input.toString(),
      error,
    );
    return undefined;
  }
}

export async function fetchDashboardOverview(
  origin: string,
  headers?: HeadersInit,
): Promise<DashboardOverviewData> {
  const withBase = (path: string) =>
    path.startsWith('http://') || path.startsWith('https://')
      ? path
      : `${origin}${path}`;

  const [jobOrders, technicians, stats] = await Promise.all([
    safeFetchJson(withBase("/api/job-orders?limit=1000"), headers),
    safeFetchJson(withBase("/api/users?role=technician"), headers),
    safeFetchJson(withBase("/api/dashboard"), headers),
  ]);

  return {
    jobOrders,
    technicians,
    stats,
  };
}


