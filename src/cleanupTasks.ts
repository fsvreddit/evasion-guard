import { JobContext, JSONObject, ScheduledJobEvent, TriggerContext, User } from "@devvit/public-api";
import { CLEANUP_CRON, CLEANUP_JOB, DAYS_BETWEEN_CLEANUP, WHITELISTED_USERS_KEY } from "./constants.js";
import pluralize from "pluralize";
import { addDays, addMinutes, subMinutes } from "date-fns";
import { CronExpressionParser } from "cron-parser";

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

    const items = await context.redis.zRange(WHITELISTED_USERS_KEY, 0, new Date().getTime(), { by: "score" });
    if (items.length === 0) {
        // No user accounts need to be checked.
        await scheduleAdhocCleanup(context);
        return;
    }

    const itemsToCheck = 50;

    // Get the first N accounts that are due a check.
    const usersToCheck = items.slice(0, itemsToCheck).map(item => item.member);
    await cleanupUsers(usersToCheck, context);

    if (items.length > itemsToCheck) {
        await context.scheduler.runJob({
            runAt: new Date(),
            name: CLEANUP_JOB,
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
        await context.redis.zAdd(WHITELISTED_USERS_KEY, ...activeUsers.map(user => ({ member: user, score: addDays(new Date(), DAYS_BETWEEN_CLEANUP).getTime() }))); ;
    }

    // For deleted users, remove them from both the cleanup log and remove previous records of bans and approvals.
    if (deletedUsers.length > 0) {
        console.log(`Cleanup: ${deletedUsers.length} ${pluralize("user", deletedUsers.length)} out of ${userStatuses.length} ${pluralize("is", deletedUsers.length)} deleted or suspended. Removing from data store.`);
        await context.redis.zRem(WHITELISTED_USERS_KEY, deletedUsers);
    }
}

export async function scheduleAdhocCleanup (context: TriggerContext) {
    const nextEntries = await context.redis.zRange(WHITELISTED_USERS_KEY, 0, 0, { by: "rank" });

    if (nextEntries.length === 0) {
        return;
    }

    const nextCleanupTime = new Date(nextEntries[0].score);
    const nextCleanupJobTime = addMinutes(nextCleanupTime, 5);
    const nextScheduledTime = CronExpressionParser.parse(CLEANUP_CRON).next().toDate();

    if (nextCleanupJobTime < subMinutes(nextScheduledTime, 5)) {
        // It's worth running an ad-hoc job.
        console.log(`Cleanup: Next ad-hoc cleanup: ${nextCleanupJobTime.toUTCString()}`);
        await context.scheduler.runJob({
            data: { runDate: nextCleanupJobTime.toUTCString() },
            name: CLEANUP_JOB,
            runAt: nextCleanupJobTime,
        });
    } else {
        console.log(`Cleanup: Next entry in cleanup log is after next scheduled run (${nextCleanupTime.toUTCString()}).`);
        console.log(`Cleanup: Next cleanup job: ${nextScheduledTime.toUTCString()}`);
    }
}
