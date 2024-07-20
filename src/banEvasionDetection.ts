import {ScheduledJobEvent, TriggerContext} from "@devvit/public-api";
import {ModAction} from "@devvit/protos";
import {addSeconds, subDays} from "date-fns";
import {Setting} from "./settings.js";
import {ThingPrefix, getPostOrCommentById, replaceAll} from "./utility.js";

export async function handleModAction (event: ModAction, context: TriggerContext) {
    if (event.action !== "removecomment" && event.action !== "removelink") {
        return;
    }

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

    await context.scheduler.runJob({
        name: "handleRedditActions",
        data: {
            targetId,
            subredditName: event.subreddit.name,
        },
        runAt: addSeconds(new Date(), 10), // 10 seconds to give async updates time to finish.
    });
}

export async function handleRedditActions (event: ScheduledJobEvent, context: TriggerContext) {
    const targetId = event.data?.targetId as string | undefined;
    const subredditName = event.data?.subredditName as string | undefined;

    if (!targetId || !subredditName) {
        return;
    }

    const settings = await context.settings.getAll();

    const actionBanUser = settings[Setting.BanUser] as boolean ?? false;
    const actionRemoveContent = settings[Setting.RemoveContent] as boolean ?? true;

    if (!actionBanUser && !actionRemoveContent) {
        return;
    }

    const modLog = await context.reddit.getModerationLog({
        subredditName,
        moderatorUsernames: ["reddit"],
        type: targetId.startsWith(ThingPrefix.Comment) ? "removecomment" : "removelink",
        limit: 100,
    }).all();

    if (!modLog.some(x => x.description?.toLowerCase().includes("ban evasion") && x.target?.id === targetId)) {
        console.log(`${targetId}: No ban evasion filter event.`);
        return;
    }

    const target = await getPostOrCommentById(targetId, context);

    const previousUnbanHistory = await context.reddit.getModerationLog({
        subredditName,
        type: "unbanuser",
        limit: 100,
    }).all();

    if (previousUnbanHistory.some(x => x.createdAt > subDays(new Date(), 7) && x.target?.author === target.authorName)) {
        console.log(`${targetId}: User ${target.authorName} was recently unbanned so treating this as a false positive.`);
        return;
    }

    const promises: Promise<void>[] = [];

    if (actionBanUser) {
        const banReason = settings[Setting.BanMessage] as string ?? "Ban evasion";
        let banMessage = settings[Setting.BanMessage] as string | undefined;
        if (!banMessage) {
            banMessage = undefined;
        } else {
            banMessage = replaceAll(banMessage, "{{username}}", target.authorName);
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
    }

    await Promise.all(promises);
}
