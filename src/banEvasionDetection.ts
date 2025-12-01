import { JSONObject, ScheduledJobEvent, TriggerContext, User } from "@devvit/public-api";
import { ModAction } from "@devvit/protos";
import { isCommentId } from "@devvit/public-api/types/tid.js";
import { addDays, addHours, addMonths, addSeconds, subDays, subMonths, subWeeks, subYears } from "date-fns";
import { DateUnit, Setting } from "./settings.js";
import { getPostOrCommentById } from "./utility.js";
import { SchedulerJob } from "./constants.js";
import { ALL_ACTIONS } from "./actions/actions.js";
import { isUserAllowlisted, setAllowListForUser } from "./cleanupTasks.js";

export async function isModOfSub (username: string | undefined, context: TriggerContext, force?: boolean): Promise<boolean> {
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

    const cachedValue = await context.redis.get(redisKey);
    if (!force && cachedValue !== undefined) {
        return JSON.parse(cachedValue) as boolean;
    }

    const moderators = await context.reddit.getModerators({
        subredditName: context.subredditName ?? await context.reddit.getCurrentSubredditName(),
        username,
    }).all();

    const isMod = moderators.length > 0;
    await context.redis.set(redisKey, JSON.stringify(isMod), { expiration: addDays(new Date(), 1) });
    return isMod;
}

export async function handleModAction (event: ModAction, context: TriggerContext) {
    switch (event.action) {
        case "removecomment":
        case "removelink":
            await handleRemoveItemAction(event, context);
            break;
        case "unbanuser":
            await handleUnbanAction(event, context);
            break;
        case "approvecomment":
        case "approvelink":
            await handleApproveContent(event, context);
            break;
        case "acceptmoderatorinvite":
        case "addmoderator":
        case "removemoderator":
            await isModOfSub(event.targetUser?.name, context, true);
            break;
    }
}

export async function handleRemoveItemAction (event: ModAction, context: TriggerContext) {
    try {
        if (await isModOfSub(event.moderator?.name, context)) {
            return;
        }
    } catch (e) {
        console.error(`Error checking mod status for ${event.moderator?.name}:`, e);
    }

    if (!event.subreddit) {
        return;
    }

    let targetId: string | undefined;
    if (event.action === "removecomment") {
        targetId = event.targetComment?.id;
    } else if (event.action === "removelink") {
        targetId = event.targetPost?.id;
    }

    if (!targetId) {
        return;
    }

    console.log(`${targetId}: Detected a ${event.action} action from reddit.`);
    const redisKey = `alreadyChecked~${targetId}`;
    const alreadyChecked = await context.redis.get(redisKey);
    if (alreadyChecked) {
        console.log(`${targetId}: Duplicate trigger`);
        return;
    }

    await context.scheduler.runJob({
        name: SchedulerJob.HandleRedditActions,
        data: {
            targetId,
            subredditName: event.subreddit.name,
        },
        runAt: addSeconds(new Date(), 10), // 10 seconds to give async updates time to finish.
    });

    await context.redis.set(redisKey, "true", { expiration: addHours(new Date(), 1) });
}

export async function handleUnbanAction (event: ModAction, context: TriggerContext) {
    const targetUser = event.targetUser?.name;
    if (!targetUser || targetUser === "[deleted]") {
        return;
    }

    const unbanDate = event.actionedAt ?? new Date();
    await context.redis.set(`unbanned~${targetUser}`, new Date().getTime().toString(), { expiration: addDays(unbanDate, 7) });
    console.log(`${targetUser}: User unbanned, setting Redis key.`);
}

export async function handleApproveContent (event: ModAction, context: TriggerContext) {
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

    if (!await context.redis.exists(`banevasiontarget~${targetId}`)) {
        return;
    }

    // Store in the allowlisted users set, with a score indicating next cleanup due.
    await setAllowListForUser(authorName, context);
}

export async function handleRedditActions (event: ScheduledJobEvent<JSONObject | undefined>, context: TriggerContext) {
    const targetId = event.data?.targetId as string | undefined;
    const subredditName = event.data?.subredditName as string | undefined;

    if (!targetId || !subredditName) {
        return;
    }

    const settings = await context.settings.getAll();

    let atLeastOneActionEnabled = false;
    for (const Action of ALL_ACTIONS) {
        const action = new Action(context, settings);
        if (action.actionEnabled()) {
            atLeastOneActionEnabled = true;
            break;
        }
    }

    if (!atLeastOneActionEnabled) {
        console.log(`${targetId}: No actions enabled, skipping.`);
        return;
    }

    const modLog = await context.reddit.getModerationLog({
        subredditName,
        moderatorUsernames: ["reddit"],
        type: isCommentId(targetId) ? "removecomment" : "removelink",
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

    const target = await getPostOrCommentById(targetId, context);

    const userAllowList = settings[Setting.UsersToIgnore] as string | undefined ?? "";
    const usersToIgnore = userAllowList.split(",").map(username => username.toLowerCase().trim());

    if (usersToIgnore.includes(target.authorName.toLowerCase())) {
        console.log(`${targetId}: Author ${target.authorName} is allowlisted explicitly`);
        return;
    }

    const userPreviouslyUnbanned = await context.redis.get(`unbanned~${target.authorName}`);
    if (userPreviouslyUnbanned) {
        console.log(`${targetId}: User ${target.authorName} was recently unbanned so treating this as a false positive.`);
        if (settings[Setting.AutoApproveAfterUnban]) {
            await context.reddit.approve(targetId);
            console.log(`${targetId}: Approved due to recent unban.`);
        }
        return;
    }

    if (settings[Setting.AutoIgnoreUsersAfterContentApproval]) {
        const userAllowlisted = await isUserAllowlisted(target.authorName, context);
        if (userAllowlisted) {
            await context.reddit.approve(targetId);
            console.log(`${targetId}: Author ${target.authorName} is allowlisted
                 via prior approval`);
            return;
        }
    }

    const actionThresholdValue = settings[Setting.ActionThresholdValue] as number;
    const [actionThresholdUnit] = settings[Setting.ActionThresholdUnit] as string[];

    if (actionThresholdValue && target.authorId) {
        let user: User | undefined;
        try {
            user = await context.reddit.getUserById(target.authorId);
        } catch {
            //
        }

        if (!user) {
            console.log(`${targetId}: User ${target.authorName} is suspended or shadowbanned.`);
            return;
        }
        const minimumAge = getMinimumAge(actionThresholdValue, actionThresholdUnit as DateUnit);
        if (user.createdAt < minimumAge) {
            console.log(`${targetId}: User ${target.authorName} is too old to take action on.`);
            return;
        }
    }

    if (settings[Setting.IgnoreApprovedSubmitters]) {
        const approvedUsers = await context.reddit.getApprovedUsers({
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
        const action = new Action(context, settings);
        if (!action.actionEnabled()) {
            continue;
        }
        promises.push(action.execute(target));
    }

    promises.push(context.redis.set(`banevasiontarget~${targetId}`, new Date().getTime().toString(), { expiration: addMonths(new Date(), 3) }));

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
