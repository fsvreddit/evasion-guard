import { JobContext, JSONObject, ScheduledJobEvent, TriggerContext, User } from "@devvit/public-api";
import { SchedulerJob } from "./constants.js";
import pluralize from "pluralize";
import { addDays, addMinutes } from "date-fns";

const ALLOWLISTED_USERS_KEY = "whitelistedUsers";
const DAYS_BETWEEN_CLEANUP = 28;

export async function setAllowListForUser (username: string, context: TriggerContext) {
    await context.redis.zAdd(ALLOWLISTED_USERS_KEY, { member: username, score: addDays(new Date(), DAYS_BETWEEN_CLEANUP).getTime() });
}

export async function isUserAllowlisted (username: string, context: TriggerContext): Promise<boolean> {
    const score = await context.redis.zScore(ALLOWLISTED_USERS_KEY, username);
    return score !== undefined;
}

async function userActive (username: string, context: TriggerContext): Promise<boolean> {
    let user: User | undefined;
    try {
        user = await context.reddit.getUserByUsername(username);
    } catch {
        //
    }

    if (!user) {
        console.log(`Cleanup: ${username} appears to be deleted or shadowbanned.`);
    }

    return user !== undefined;
}

interface UserActive {
    username: string;
    isActive: boolean;
}

export async function cleanupDeletedAccounts (event: ScheduledJobEvent<JSONObject | undefined>, context: JobContext) {
    if (event.data?.runDate) {
        console.log(`Cleanup: Starting cleanup job scheduled for ${event.data.runDate as string}`);
    } else {
        console.log("Cleanup: Starting cleanup job");
    }

    const items = await context.redis.zRange(ALLOWLISTED_USERS_KEY, 0, new Date().getTime(), { by: "score" });
    if (items.length === 0) {
        // No user accounts need to be checked.
        await scheduleAdhocCleanup(context);
        return;
    }

    const runRecentlyKey = "cleanupRecentlyRun";
    if (event.data?.fromCron && await context.redis.exists(runRecentlyKey)) {
        console.log("Cleanup: Recent cron run detected, skipping this run to avoid overlap.");
        return;
    }

    await context.redis.set(runRecentlyKey, "true", { expiration: addMinutes(new Date(), 5) });

    const itemsToCheck = 50;

    // Get the first N accounts that are due a check.
    const usersToCheck = items.slice(0, itemsToCheck).map(item => item.member);
    await cleanupUsers(usersToCheck, context);

    if (items.length > itemsToCheck) {
        await context.scheduler.runJob({
            runAt: new Date(),
            name: SchedulerJob.Cleanup,
        });
    } else {
        await scheduleAdhocCleanup(context);
    }
}

async function cleanupUsers (usersToCheck: string[], context: TriggerContext) {
    const userStatuses: UserActive[] = [];

    for (const username of usersToCheck) {
        const isActive = await userActive(username, context);
        userStatuses.push({ username, isActive });
    }

    const activeUsers = userStatuses.filter(user => user.isActive).map(user => user.username);
    const deletedUsers = userStatuses.filter(user => !user.isActive).map(user => user.username);

    // For active users, set their next check date to be in the future.
    if (activeUsers.length > 0) {
        console.log(`Cleanup: ${activeUsers.length} ${pluralize("user", activeUsers.length)} still active out of ${userStatuses.length}. Resetting next check time.`);
        await context.redis.zAdd(ALLOWLISTED_USERS_KEY, ...activeUsers.map(user => ({ member: user, score: addDays(new Date(), DAYS_BETWEEN_CLEANUP).getTime() }))); ;
    }

    // For deleted users, remove them from both the cleanup log and remove previous records of bans and approvals.
    if (deletedUsers.length > 0) {
        console.log(`Cleanup: ${deletedUsers.length} ${pluralize("user", deletedUsers.length)} out of ${userStatuses.length} ${pluralize("is", deletedUsers.length)} deleted or suspended. Removing from data store.`);
        await context.redis.zRem(ALLOWLISTED_USERS_KEY, deletedUsers);
    }
}

export async function scheduleAdhocCleanup (context: TriggerContext) {
    const nextEntries = await context.redis.zRange(ALLOWLISTED_USERS_KEY, 0, 0, { by: "rank" });

    if (nextEntries.length === 0) {
        console.log("Cleanup: No users in cleanup queue, skipping ad-hoc cleanup scheduling.");
        return;
    }

    const nextCleanupTime = new Date(nextEntries[0].score);
    const nextCleanupJobTime = nextCleanupTime < new Date() ? new Date() : nextCleanupTime;

    const existingJobs = await context.scheduler.listJobs();
    const existingAdhocJobs = existingJobs.filter(job => job.name === SchedulerJob.Cleanup as string && "runAt" in job);
    await Promise.all(existingAdhocJobs.map(job => context.scheduler.cancelJob(job.id)));

    console.log(`Cleanup: Next ad-hoc cleanup: ${nextCleanupJobTime.toUTCString()}`);
    await context.scheduler.runJob({
        data: { runDate: nextCleanupJobTime.toUTCString() },
        name: SchedulerJob.Cleanup,
        runAt: nextCleanupJobTime,
    });
}
