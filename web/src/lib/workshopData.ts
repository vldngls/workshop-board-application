/* eslint-disable @typescript-eslint/no-explicit-any */
import type { JobOrder, User } from '@/types/jobOrder';

export interface JobOrderWithDetails extends JobOrder {
  assignedTechnician: User;
  createdBy: User;
}

interface WorkshopQueues {
  qiJobs: JobOrderWithDetails[];
  forReleaseJobs: JobOrderWithDetails[];
  waitingPartsJobs: JobOrderWithDetails[];
  forPlottingJobs: JobOrderWithDetails[];
  carriedOverJobs: JobOrderWithDetails[];
  holdCustomerJobs: JobOrderWithDetails[];
  holdWarrantyJobs: JobOrderWithDetails[];
  holdInsuranceJobs: JobOrderWithDetails[];
  finishedUnclaimedJobs: JobOrderWithDetails[];
}

export interface WorkshopDataPayload extends WorkshopQueues {
  jobOrders: JobOrderWithDetails[];
  technicians: User[];
  isSnapshot: boolean;
}

const DEFAULT_WORKSHOP_DATA: WorkshopDataPayload = {
  jobOrders: [],
  technicians: [],
  qiJobs: [],
  forReleaseJobs: [],
  waitingPartsJobs: [],
  forPlottingJobs: [],
  carriedOverJobs: [],
  holdCustomerJobs: [],
  holdWarrantyJobs: [],
  holdInsuranceJobs: [],
  finishedUnclaimedJobs: [],
  isSnapshot: false,
};

function mapSnapshotJobs(snapshotJobs: any[]): JobOrderWithDetails[] {
  return snapshotJobs.map((job: any) => ({
    _id: job._id,
    jobNumber: job.jobNumber,
    createdBy: job.createdBy,
    assignedTechnician: job.assignedTechnician || undefined,
    serviceAdvisor: job.serviceAdvisor || undefined,
    plateNumber: job.plateNumber,
    vin: job.vin,
    timeRange: job.timeRange,
    actualEndTime: job.actualEndTime,
    jobList: job.jobList || [],
    parts: job.parts || [],
    status: job.status,
    date:
      typeof job.date === 'string'
        ? job.date
        : new Date(job.date).toISOString().split('T')[0],
    originalCreatedDate: job.originalCreatedDate,
    sourceType: job.sourceType,
    carriedOver: !!job.carriedOver,
    isImportant: !!job.isImportant,
    qiStatus: job.qiStatus,
    holdCustomerRemarks: job.holdCustomerRemarks,
    subletRemarks: job.subletRemarks,
    originalJobId: job.originalJobId,
    carryOverChain: job.carryOverChain,
    createdAt: job.createdAt,
    updatedAt: job.updatedAt,
  })) as unknown as JobOrderWithDetails[];
}

function deriveQueuesFromJobs(jobs: JobOrderWithDetails[]): WorkshopQueues {
  const pendingQI = jobs.filter(
    (job: any) => job.status === 'QI' && job.qiStatus === 'pending',
  );
  const forRelease = jobs.filter((job: any) => job.status === 'FR');
  const waitingParts = jobs.filter((job: any) => job.status === 'WP');
  const forPlotting = jobs.filter((job: any) => job.status === 'UA');
  const holdCustomer = jobs.filter((job: any) => job.status === 'HC');
  const holdWarranty = jobs.filter((job: any) => job.status === 'HW');
  const holdInsurance = jobs.filter((job: any) => job.status === 'HI');
  const finishedUnclaimed = jobs.filter(
    (job: any) => job.status === 'FU' || job.status === 'CP',
  );
  const carriedOver = jobs.filter(
    (job: any) =>
      job.carriedOver && !['FR', 'FU', 'CP'].includes(job.status as string),
  );

  return {
    qiJobs: pendingQI as any,
    forReleaseJobs: forRelease as any,
    waitingPartsJobs: waitingParts as any,
    forPlottingJobs: forPlotting as any,
    holdCustomerJobs: holdCustomer as any,
    holdWarrantyJobs: holdWarranty as any,
    holdInsuranceJobs: holdInsurance as any,
    finishedUnclaimedJobs: finishedUnclaimed as any,
    carriedOverJobs: carriedOver as any,
  };
}

export async function fetchWorkshopData(
  dateStr: string,
  headers?: HeadersInit,
  origin?: string,
): Promise<WorkshopDataPayload> {
  const isBrowser = typeof window !== 'undefined';
  const baseUrl = isBrowser ? '' : origin || '';

  const withBase = (path: string) =>
    path.startsWith('http://') || path.startsWith('https://')
      ? path
      : baseUrl
      ? `${baseUrl}${path}`
      : path;

  try {
    const snapshotResponse = await fetch(
      withBase(`/api/job-orders/snapshot/${dateStr}`),
      { credentials: 'include', headers },
    ).catch(() => null as unknown as Response | null);

    if (snapshotResponse?.ok) {
      const snapshotData = await snapshotResponse.json();
      const rawJobs =
        snapshotData?.snapshot?.jobOrders || snapshotData?.jobOrders || [];

      const mappedJobs = mapSnapshotJobs(rawJobs);
      const timetableJobs = mappedJobs.filter(
        (job: any) =>
          job.assignedTechnician &&
          job.timeRange?.start &&
          job.timeRange?.end &&
          job.timeRange.start !== '00:00' &&
          job.timeRange.end !== '00:00',
      );

      const techniciansResponse = await fetch(withBase('/api/users'), {
        credentials: 'include',
        headers,
      }).catch(() => null);

      const technicians =
        (await techniciansResponse?.json().catch(() => null))?.users?.filter(
          (user: any) => user.role === 'technician',
        ) ?? [];

      const queuesResponse = await fetch(
        withBase(
          '/api/job-orders/queues/by-status?statuses=QI,FR,WP,UA,HC,HW,HI,FU,carriedOver&limit=100',
        ),
        { credentials: 'include', headers },
      ).catch(() => null);

      if (queuesResponse?.ok) {
        const queuesData = await queuesResponse.json();
        const queues = queuesData.queues || {};

        return {
          jobOrders: timetableJobs,
          technicians,
          isSnapshot: true,
          qiJobs: (queues.QI || []) as any,
          forReleaseJobs: (queues.FR || []) as any,
          waitingPartsJobs: (queues.WP || []) as any,
          forPlottingJobs: (queues.UA || []) as any,
          holdCustomerJobs: (queues.HC || []) as any,
          holdWarrantyJobs: (queues.HW || []) as any,
          holdInsuranceJobs: (queues.HI || []) as any,
          finishedUnclaimedJobs: (queues.FU || []) as any,
          carriedOverJobs: (queues.carriedOver || []) as any,
        };
      }

      return {
        jobOrders: timetableJobs,
        technicians,
        isSnapshot: true,
        ...deriveQueuesFromJobs(mappedJobs),
      };
    }
  } catch {
    // Ignore snapshot errors and fall back to live data
  }

  try {
    const [jobOrdersResponse, queuesResponse, techniciansResponse] =
      await Promise.all([
        fetch(
          withBase(`/api/job-orders?date=${dateStr}&limit=500`),
          {
            credentials: 'include',
            headers,
          },
        ),
        fetch(
          withBase(
            '/api/job-orders/queues/by-status?statuses=QI,FR,WP,UA,HC,HW,HI,FU,carriedOver&limit=100',
          ),
          { credentials: 'include', headers },
        ),
        fetch(withBase('/api/users?role=technician'), {
          credentials: 'include',
          headers,
        }),
      ]);

    if (!jobOrdersResponse.ok) {
      throw new Error('Failed to load job orders');
    }

    const jobOrdersData = await jobOrdersResponse.json();
    const techniciansData = techniciansResponse.ok
      ? await techniciansResponse.json().catch(() => null)
      : null;

    let queues: Record<string, JobOrderWithDetails[]> = {};

    if (queuesResponse.ok) {
      const queuesPayload = await queuesResponse.json();
      queues = queuesPayload.queues || {};
    }

    const baseJobsForDate = jobOrdersData.jobOrders || [];
    const dateJobs = baseJobsForDate.filter((job: JobOrderWithDetails) => {
      const jobDate =
        typeof job.date === 'string'
          ? job.date
          : new Date(job.date).toISOString().split('T')[0];
      return jobDate === dateStr;
    });

    const carriedOverForTimetable = (queues.carriedOver || []).filter(
      (job: any) =>
        job.assignedTechnician &&
        job.timeRange?.start &&
        job.timeRange?.end &&
        job.timeRange.start !== '00:00' &&
        job.timeRange.end !== '00:00' &&
        (typeof job.date === 'string'
          ? job.date
          : new Date(job.date).toISOString().split('T')[0]) === dateStr,
    );

    const merged = new Map<string, JobOrderWithDetails>();
    dateJobs.forEach((job: JobOrderWithDetails) =>
      merged.set(String(job._id), job),
    );
    carriedOverForTimetable.forEach((job: JobOrderWithDetails) => {
      const key = String(job._id);
      if (!merged.has(key)) {
        merged.set(key, job);
      }
    });

    const timetableJobs = Array.from(merged.values()).filter(
      (job: JobOrderWithDetails) =>
        job.assignedTechnician &&
        job.timeRange.start !== '00:00' &&
        job.timeRange.end !== '00:00',
    );

    timetableJobs.sort((a: JobOrderWithDetails, b: JobOrderWithDetails) => {
      if (a.isImportant && !b.isImportant) return -1;
      if (!a.isImportant && b.isImportant) return 1;
      if (a.carriedOver && !b.carriedOver) return -1;
      if (!a.carriedOver && b.carriedOver) return 1;
      return 0;
    });

    return {
      jobOrders: timetableJobs,
      technicians:
        techniciansData?.users?.filter(
          (user: any) => user.role === 'technician',
        ) ?? [],
      isSnapshot: false,
      qiJobs: (queues.QI || []) as any,
      forReleaseJobs: (queues.FR || []) as any,
      waitingPartsJobs: (queues.WP || []) as any,
      forPlottingJobs: (queues.UA || []) as any,
      holdCustomerJobs: (queues.HC || []) as any,
      holdWarrantyJobs: (queues.HW || []) as any,
      holdInsuranceJobs: (queues.HI || []) as any,
      finishedUnclaimedJobs: (queues.FU || []) as any,
      carriedOverJobs: (queues.carriedOver || []) as any,
    };
  } catch (error) {
    console.warn('[workshop] Failed to load timetable data:', error);
    return DEFAULT_WORKSHOP_DATA;
  }
}


