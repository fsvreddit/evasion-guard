import { context, reddit, redis, scheduler, settings, TaskRequest, User } from "@devvit/web/server";
import { isT1, OnModActionRequest, T1, T3 } from "@devvit/web/shared";
import { addDays, addHours, addMinutes, addMonths, addSeconds, subDays, subMonths, subWeeks, subYears } from "date-fns";
import { DateUnit, Setting } from ".";
import { SchedulerJob } from "./constants.js";
import { ALL_ACTIONS } from "./actions/actions.js";
import { isUserAllowlisted, setAllowListForUser } from "./cleanupTasks.js";
import { getPostOrCommentById, hasEventBeenHandled } from "@fsvreddit/fsv-devvit-web-helpers";
import { HandleRedditActionsJobData } from "../tasks";

export async function isModOfSub (username: string | undefined, force?: boolean): Promise<boolean> {
    if (!username) {
        return false;
    }

    if (username === "AutoModerator" || username === `${context.subredditName}-ModTeam`) {
        return true;
    }

    if (username === "reddit" || username === "[ Redacted ]") {
        return false;
    }

    const redisKey = `ismod~${username}`;

    const cachedValue = await redis.get(redisKey);
    if (!force && cachedValue !== undefined) {
        return JSON.parse(cachedValue) as boolean;
    }

    const moderators = await reddit.getModerators({
        subredditName: context.subredditName,
        username,
    }).all();

    const isMod = moderators.length > 0;
    await redis.set(redisKey, JSON.stringify(isMod), { expiration: addDays(new Date(), 1) });
    return isMod;
}

export async function handleModAction (event: OnModActionRequest) {
    if (await hasEventBeenHandled(`modAction:${event.moderator?.name}:${event.action}:${event.actionedAt}`)) {
        console.log(`Duplicate mod action trigger for ${event.moderator?.name} and action ${event.action}`);
        return;
    }

    switch (event.action) {
        case "removecomment":
        case "removelink":
            await handleRemoveItemAction(event);
            break;
        case "unbanuser":
            await handleUnbanAction(event);
            break;
        case "approvecomment":
        case "approvelink":
            await handleApproveContent(event);
            break;
        case "acceptmoderatorinvite":
        case "addmoderator":
        case "removemoderator":
            await isModOfSub(event.targetUser?.name, true);
            break;
    }
}

export async function handleRemoveItemAction (event: OnModActionRequest) {
    try {
        if (await isModOfSub(event.moderator?.name)) {
            return;
        }
    } catch (e) {
        console.error(`Error checking mod status for ${event.moderator?.name}:`, e);
    }

    if (!event.subreddit) {
        return;
    }

    let targetId: T1 | T3 | undefined;
    if (event.action === "removecomment") {
        targetId = event.targetComment?.id as T1 | undefined;
    } else if (event.action === "removelink") {
        targetId = event.targetPost?.id as T3 | undefined;
    }

    if (!targetId) {
        return;
    }

    console.log(`${targetId}: Detected a ${event.action} action from reddit.`);
    const redisKey = `alreadyChecked~${targetId}`;
    const alreadyChecked = await redis.get(redisKey);
    if (alreadyChecked) {
        console.log(`${targetId}: Duplicate trigger`);
        return;
    }

    await scheduler.runJob<HandleRedditActionsJobData>({
        name: SchedulerJob.HandleRedditActions,
        data: {
            targetId,
            jobGuid: crypto.randomUUID(),
        },
        runAt: addSeconds(new Date(), 10), // 10 seconds to give async updates time to finish.
    });

    await redis.set(redisKey, "true", { expiration: addHours(new Date(), 1) });
}

export async function handleUnbanAction (event: OnModActionRequest) {
    const targetUser = event.targetUser?.name;
    if (!targetUser || targetUser === "[deleted]") {
        return;
    }

    const unbanDate = event.actionedAt ?? new Date();
    await redis.set(`unbanned~${targetUser}`, new Date().getTime().toString(), { expiration: addDays(unbanDate, 7) });
    console.log(`${targetUser}: User unbanned, setting Redis key.`);
}

export async function handleApproveContent (event: OnModActionRequest) {
    const authorName = event.targetUser?.name;
    if (!authorName) {
        return;
    }

    let targetId: string | undefined;
    if (event.action === "approvecomment") {
        targetId = event.targetComment?.id;
    } else if (event.action === "approvelink") {
        targetId = event.targetPost?.id;
    }

    if (!targetId) {
        return;
    }

    if (!await redis.exists(`banevasiontarget~${targetId}`)) {
        return;
    }

    // Store in the allowlisted users set, with a score indicating next cleanup due.
    await setAllowListForUser(authorName);
}

export async function handleRedditActions (event: TaskRequest<HandleRedditActionsJobData>) {
    const jobGuid = event.data.jobGuid as string | undefined;
    if (jobGuid && await hasEventBeenHandled(`handleRedditActions:${jobGuid}`, { expiration: addMinutes(new Date(), 5) })) {
        console.warn(`Duplicate handleRedditActions job for jobGuid ${jobGuid}`);
        return;
    }

    const targetId = event.data.targetId;

    const appSettings = await settings.getAll();

    let atLeastOneActionEnabled = false;
    for (const Action of ALL_ACTIONS) {
        const action = new Action(appSettings);
        if (action.actionEnabled()) {
            atLeastOneActionEnabled = true;
            break;
        }
    }

    if (!atLeastOneActionEnabled) {
        console.log(`${targetId}: No actions enabled, skipping.`);
        return;
    }

    const modLog = await reddit.getModerationLog({
        subredditName: context.subredditName,
        moderatorUsernames: ["reddit"],
        type: isT1(targetId) ? "removecomment" : "removelink",
        limit: 100,
    }).all();

    if (!modLog.some((x) => {
        if (x.target?.id !== targetId) {
            return false;
        }

        if (x.details?.toLowerCase().includes("ban evasion") && x.description?.startsWith("Higher accuracy")) {
            return true;
        }

        if (x.description?.toLowerCase().includes("ban evasion")) {
            return true;
        }

        return false;
    })) {
        console.log(`${targetId}: No ban evasion filter event.`);
        return;
    }

    const target = await getPostOrCommentById(targetId);

    const userAllowList = appSettings[Setting.UsersToIgnore] as string | undefined ?? "";
    const usersToIgnore = userAllowList.split(",").map(username => username.toLowerCase().trim());

    if (usersToIgnore.includes(target.authorName.toLowerCase())) {
        console.log(`${targetId}: Author ${target.authorName} is allowlisted explicitly`);
        return;
    }

    const userPreviouslyUnbanned = await redis.get(`unbanned~${target.authorName}`);
    if (userPreviouslyUnbanned) {
        console.log(`${targetId}: User ${target.authorName} was recently unbanned so treating this as a false positive.`);
        if (appSettings[Setting.AutoApproveAfterUnban]) {
            await reddit.approve(targetId);
            console.log(`${targetId}: Approved due to recent unban.`);
        }
        return;
    }

    if (appSettings[Setting.AutoIgnoreUsersAfterContentApproval]) {
        const userAllowlisted = await isUserAllowlisted(target.authorName);
        if (userAllowlisted) {
            await reddit.approve(targetId);
            console.log(`${targetId}: Author ${target.authorName} is allowlisted
                 via prior approval`);
            return;
        }
    }

    const actionThresholdValue = appSettings[Setting.ActionThresholdValue] as number;
    const [actionThresholdUnit] = appSettings[Setting.ActionThresholdUnit] as DateUnit[];

    if (actionThresholdValue && target.authorId) {
        let user: User | undefined;
        try {
            user = await reddit.getUserById(target.authorId);
        } catch {
            //
        }

        if (!user) {
            console.log(`${targetId}: User ${target.authorName} is suspended or shadowbanned.`);
            return;
        }
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        const minimumAge = getMinimumAge(actionThresholdValue, actionThresholdUnit!);
        if (user.createdAt < minimumAge) {
            console.log(`${targetId}: User ${target.authorName} is too old to take action on.`);
            return;
        }
    }

    if (appSettings[Setting.IgnoreApprovedSubmitters]) {
        const approvedUsers = await reddit.getApprovedUsers({
            subredditName: target.subredditName,
            username: target.authorName,
        }).all();

        if (approvedUsers.length > 0) {
            console.log(`${targetId}: User ${target.authorName} is an approved submitter.`);
            return;
        }
    }

    const promises: Promise<unknown>[] = [];

    for (const Action of ALL_ACTIONS) {
        const action = new Action(appSettings);
        if (!action.actionEnabled()) {
            continue;
        }
        promises.push(action.execute(target));
    }

    promises.push(redis.set(`banevasiontarget~${targetId}`, new Date().getTime().toString(), { expiration: addMonths(new Date(), 3) }));

    await Promise.all(promises);
}

function getMinimumAge (thresholdValue: number, thresholdUnit: DateUnit) {
    switch (thresholdUnit) {
        case DateUnit.Day:
            return subDays(new Date(), thresholdValue);
        case DateUnit.Week:
            return subWeeks(new Date(), thresholdValue);
        case DateUnit.Month:
            return subMonths(new Date(), thresholdValue);
        case DateUnit.Year:
            return subYears(new Date(), thresholdValue);
    }
}
