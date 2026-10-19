import { scheduler } from "@devvit/web/server";
import { addSeconds } from "date-fns";
import { SchedulerJob } from "./constants.js";
import { scheduleAdhocCleanup } from "./cleanupTasks.js";
import { CleanupDeletedAccountsJobData, HandleStoreRecentUnbansAfterInstallJobData } from "../tasks/";

export async function handleInstallEvents () {
    console.log("Handling install/upgrade event");

    // Find and remove jobs.
    const existingJobs = await scheduler.listJobs();
    await Promise.all(existingJobs.map(job => scheduler.cancelJob(job.id)));

    const randomHour = Math.floor(Math.random() * 6);
    const randomMinute = Math.floor(Math.random() * 60);

    await scheduler.runJob<CleanupDeletedAccountsJobData>({
        name: SchedulerJob.Cleanup,
        cron: `${randomMinute} ${randomHour}/6 * * *`,
        data: { fromCron: true },
    });

    await scheduler.runJob<HandleStoreRecentUnbansAfterInstallJobData>({
        name: SchedulerJob.StoreRecentUnbansAfterInstall,
        runAt: addSeconds(new Date(), 30),
        data: { jobGuid: crypto.randomUUID() },
    });

    await scheduleAdhocCleanup();

    console.log("Completed handling install/upgrade event");
}
