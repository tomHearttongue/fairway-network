export type FacilitiesReadinessSummary = {
  openTaskCount: number;
  readySuiteCount: number;
  totalSuiteCount: number;
};

export function facilitiesHeaderCopy(summary: FacilitiesReadinessSummary): string {
  if (summary.openTaskCount === 0 && summary.readySuiteCount === summary.totalSuiteCount) {
    return "All suites are ready.";
  }
  if (summary.openTaskCount === 0) {
    return `No service tasks are open. ${summary.readySuiteCount} suites ready.`;
  }
  return `${summary.openTaskCount} active ${summary.openTaskCount === 1 ? "task" : "tasks"}. ${summary.readySuiteCount} suites ready.`;
}

export function facilitiesEmptyTaskCopy(summary: FacilitiesReadinessSummary): {
  title: string;
  detail: string;
} {
  if (summary.openTaskCount === 0 && summary.readySuiteCount === summary.totalSuiteCount) {
    return { title: "All suites are ready", detail: "No turnover or inspection tasks are open." };
  }
  return {
    title: "No service tasks are open",
    detail: `${summary.readySuiteCount} of ${summary.totalSuiteCount} suites are ready.`,
  };
}
