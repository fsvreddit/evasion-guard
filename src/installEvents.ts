import { AppInstall, AppUpgrade } from "@devvit/protos";
import { TriggerContext } from "@devvit/public-api";
import { addDays, subDays } from "date-fns";
import { SchedulerJob } from "./constants.js";
import { scheduleAdhocCleanup } from "./cleanupTasks.js";

export async function handleInstallEvents (_: AppInstall | AppUpgrade, context: TriggerContext) {
    console.log("Handling install/upgrade event");

    // Find and remove jobs.
    const existingJobs = await context.scheduler.listJobs();
    await Promise.all(existingJobs.map(job => context.scheduler.cancelJob(job.id)));

    const randomHour = Math.floor(Math.random() * 6);
    const randomMinute = Math.floor(Math.random() * 60);

    await context.scheduler.runJob({
        name: SchedulerJob.Cleanup,
        cron: `${randomMinute} ${randomHour}/6 * * *`,
        data: { fromCron: true },
    });

    await scheduleAdhocCleanup(context);

    const redisKey = "StoredRecentUnbans";

    if (await context.redis.exists(redisKey)) {
        return;
    }

    const subredditName = context.subredditName ?? await context.reddit.getCurrentSubredditName();
    const recentUnbans = await context.reddit.getModerationLog({
        subredditName,
        type: "unbanuser",
        limit: 1000,
    }).all();

    // Store a record of recent unbans for any user unbanned in last 7 days.
    for (const logEntry of recentUnbans.filter(x => x.createdAt > subDays(new Date(), 7))) {
        if (logEntry.target && logEntry.target.author !== "[deleted]") {
            await context.redis.set(`unbanned~${logEntry.target.author}`, new Date().getTime().toString(), { expiration: addDays(logEntry.createdAt, 7) });
            console.log(`Stored details of unban for ${logEntry.target.author}`);
        }
    }

    await context.redis.set(redisKey, "true");
}
