import { JSONObject, ScheduledJobEvent, TriggerContext, User } from "@devvit/public-api";
import { ModAction } from "@devvit/protos";
import { isCommentId } from "@devvit/shared-types/tid.js";
import { addDays, addHours, addMonths, addSeconds, subDays, subMonths, subWeeks, subYears } from "date-fns";
import { DateUnit, ModmailNotificationType, Setting } from "./settings.js";
import { getPostOrCommentById, replaceAll } from "./utility.js";
import { DAYS_BETWEEN_CLEANUP, HANDLE_REDDIT_ACTIONS_JOB, WHITELISTED_USERS_KEY } from "./constants.js";

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
    }
}

export async function handleRemoveItemAction (event: ModAction, context: TriggerContext) {
    if (event.moderator?.name !== "reddit") {
        return;
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
        name: HANDLE_REDDIT_ACTIONS_JOB,
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
    if (event.action === "removecomment") {
        targetId = event.targetComment?.id;
    } else if (event.action === "removelink") {
        targetId = event.targetPost?.id;
    }

    if (!targetId) {
        return;
    }

    const removedByThisApp = await context.redis.get(`banevasiontarget~${targetId}`);
    if (!removedByThisApp) {
        return;
    }

    // Store in the whitelisted users set, with a score indicating next cleanup due.
    await context.redis.zAdd(WHITELISTED_USERS_KEY, { member: authorName, score: addDays(new Date(), DAYS_BETWEEN_CLEANUP).getTime() });
}

export async function handleRedditActions (event: ScheduledJobEvent<JSONObject | undefined>, context: TriggerContext) {
    const targetId = event.data?.targetId as string | undefined;
    const subredditName = event.data?.subredditName as string | undefined;

    if (!targetId || !subredditName) {
        return;
    }

    const settings = await context.settings.getAll();

    const actionBanUser = settings[Setting.BanUser] as boolean | undefined ?? false;
    const actionRemoveContent = settings[Setting.RemoveContent] as boolean | undefined ?? true;
    const [actionSendModmail] = settings[Setting.ModmailNotification] as [ModmailNotificationType] | undefined ?? [ModmailNotificationType.None];

    if (!actionBanUser && !actionRemoveContent) {
        return;
    }

    const modLog = await context.reddit.getModerationLog({
        subredditName,
        moderatorUsernames: ["reddit"],
        type: isCommentId(targetId) ? "removecomment" : "removelink",
        limit: 100,
    }).all();

    if (!modLog.some(x => x.description?.toLowerCase().includes("ban evasion") && x.target?.id === targetId)) {
        console.log(`${targetId}: No ban evasion filter event.`);
        return;
    }

    const target = await getPostOrCommentById(targetId, context);

    const userWhitelist = settings[Setting.UsersToIgnore] as string | undefined ?? "";
    const usersToIgnore = userWhitelist.split(",").map(username => username.toLowerCase().trim());

    if (usersToIgnore.includes(target.authorName.toLowerCase())) {
        console.log(`${targetId}: Author ${target.authorName} is whitelisted explicitly`);
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
        const userWhitelisted = await context.redis.zScore(WHITELISTED_USERS_KEY, target.authorName);
        if (userWhitelisted) {
            await context.reddit.approve(targetId);
            console.log(`${targetId}: Author ${target.authorName} is whitelisted via prior approval`);
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

    if (actionBanUser) {
        const banReason = settings[Setting.BanReason] as string | undefined ?? "Ban evasion";
        let banMessage = settings[Setting.BanMessage] as string | undefined;
        if (!banMessage) {
            banMessage = undefined;
        } else {
            banMessage = replaceAll(banMessage, "{{username}}", target.authorName);
            banMessage = replaceAll(banMessage, "{{permalink}}", target.permalink);
        }

        promises.push(context.reddit.banUser({
            subredditName,
            username: target.authorName,
            message: banMessage,
            note: banReason,
        }));
        console.log(`${targetId}: ${target.authorName} has been banned.`);
    }

    if (actionRemoveContent) {
        promises.push(target.remove());
        console.log(`${targetId}: ${target.authorName}'s post or comment has been removed.`);

        if (settings[Setting.RemovalMessage]) {
            const newComment = await context.reddit.submitComment({
                id: targetId,
                text: settings[Setting.RemovalMessage] as string,
            });
            promises.push(newComment.lock(), newComment.distinguish());
        }
    }

    if (actionSendModmail !== ModmailNotificationType.None) {
        const message = `${target.authorName} has been banned for suspected ban evasion from r/${target.subredditName}. [Permalink to content](${target.permalink})`;
        const parameters = {
            subject: "Ban evasion detected",
            bodyMarkdown: message,
            subredditId: context.subredditId,
        };

        if (actionSendModmail === ModmailNotificationType.Inbox) {
            promises.push(context.reddit.modMail.createModInboxConversation(parameters));
        } else {
            promises.push(context.reddit.modMail.createModNotification(parameters));
        }
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
