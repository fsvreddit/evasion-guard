import { reddit, redis, scheduler, TaskRequest, User } from "@devvit/web/server";
import { SchedulerJob } from "./constants.js";
import pluralize from "pluralize";
import { addDays, addMinutes } from "date-fns";
import { hasEventBeenHandled } from "@fsvreddit/fsv-devvit-web-helpers";
import { CleanupDeletedAccountsJobData } from "../tasks";

const ALLOWLISTED_USERS_KEY = "whitelistedUsers";
const DAYS_BETWEEN_CLEANUP = 28;

export async function setAllowListForUser (username: string) {
    await redis.zAdd(ALLOWLISTED_USERS_KEY, { member: username, score: addDays(new Date(), DAYS_BETWEEN_CLEANUP).getTime() });
}

export async function isUserAllowlisted (username: string): Promise<boolean> {
    const score = await redis.zScore(ALLOWLISTED_USERS_KEY, username);
    return score !== undefined;
}

async function userActive (username: string): Promise<boolean> {
    let user: User | undefined;
    try {
        user = await reddit.getUserByUsername(username);
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

export async function cleanupDeletedAccounts (event: TaskRequest<CleanupDeletedAccountsJobData>) {
    const jobGuid = event.data.jobGuid;
    if (jobGuid && await hasEventBeenHandled(`cleanupDeletedAccounts:${jobGuid}`, { expiration: addMinutes(new Date(), 5) })) {
        console.warn(`Duplicate cleanupDeletedAccounts job for jobGuid ${jobGuid}`);
        return;
    }

    if (event.data.runDate) {
        console.log(`Cleanup: Starting cleanup job scheduled for ${event.data.runDate}`);
    } else {
        console.log("Cleanup: Starting cleanup job");
    }

    const items = await redis.zRange(ALLOWLISTED_USERS_KEY, 0, new Date().getTime(), { by: "score" });
    if (items.length === 0) {
        // No user accounts need to be checked.
        await scheduleAdhocCleanup();
        return;
    }

    const runRecentlyKey = "cleanupRecentlyRun";
    if (event.data.fromCron && await redis.exists(runRecentlyKey)) {
        console.log("Cleanup: Recent cron run detected, skipping this run to avoid overlap.");
        return;
    }

    await redis.set(runRecentlyKey, "true", { expiration: addMinutes(new Date(), 5) });

    const itemsToCheck = 50;

    // Get the first N accounts that are due a check.
    const usersToCheck = items.slice(0, itemsToCheck).map(item => item.member);
    await cleanupUsers(usersToCheck);

    if (items.length > itemsToCheck) {
        await scheduler.runJob<CleanupDeletedAccountsJobData>({
            runAt: new Date(),
            name: SchedulerJob.Cleanup,
            data: { jobGuid: crypto.randomUUID(), fromCron: false },
        });
    } else {
        await scheduleAdhocCleanup();
    }
}

async function cleanupUsers (usersToCheck: string[]) {
    const userStatuses: UserActive[] = [];

    for (const username of usersToCheck) {
        const isActive = await userActive(username);
        userStatuses.push({ username, isActive });
    }

    const activeUsers = userStatuses.filter(user => user.isActive).map(user => user.username);
    const deletedUsers = userStatuses.filter(user => !user.isActive).map(user => user.username);

    // For active users, set their next check date to be in the future.
    if (activeUsers.length > 0) {
        console.log(`Cleanup: ${activeUsers.length} ${pluralize("user", activeUsers.length)} still active out of ${userStatuses.length}. Resetting next check time.`);
        await redis.zAdd(ALLOWLISTED_USERS_KEY, ...activeUsers.map(user => ({ member: user, score: addDays(new Date(), DAYS_BETWEEN_CLEANUP).getTime() }))); ;
    }

    // For deleted users, remove them from both the cleanup log and remove previous records of bans and approvals.
    if (deletedUsers.length > 0) {
        console.log(`Cleanup: ${deletedUsers.length} ${pluralize("user", deletedUsers.length)} out of ${userStatuses.length} ${pluralize("is", deletedUsers.length)} deleted or suspended. Removing from data store.`);
        await redis.zRem(ALLOWLISTED_USERS_KEY, deletedUsers);
    }
}

export async function scheduleAdhocCleanup () {
    const nextEntries = await redis.zRange(ALLOWLISTED_USERS_KEY, 0, 0, { by: "rank" });

    if (nextEntries.length === 0) {
        console.log("Cleanup: No users in cleanup queue, skipping ad-hoc cleanup scheduling.");
        return;
    }

    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const nextCleanupTime = new Date(nextEntries[0]!.score);
    const nextCleanupJobTime = nextCleanupTime < new Date() ? new Date() : nextCleanupTime;

    const existingJobs = await scheduler.listJobs();
    const existingAdhocJobs = existingJobs.filter(job => job.name === SchedulerJob.Cleanup as string && "runAt" in job);
    await Promise.all(existingAdhocJobs.map(job => scheduler.cancelJob(job.id)));

    console.log(`Cleanup: Next ad-hoc cleanup: ${nextCleanupJobTime.toUTCString()}`);
    await scheduler.runJob<CleanupDeletedAccountsJobData>({
        data: { runDate: nextCleanupJobTime.toUTCString(), jobGuid: crypto.randomUUID(), fromCron: false },
        name: SchedulerJob.Cleanup,
        runAt: nextCleanupJobTime,
    });
}
