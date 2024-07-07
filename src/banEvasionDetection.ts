import {ScheduledJobEvent, TriggerContext} from "@devvit/public-api";
import {ModAction} from "@devvit/protos";
import {addSeconds, subDays} from "date-fns";
import {Setting} from "./settings.js";
import {getPostOrCommentById} from "./utility.js";

export async function handleModAction (event: ModAction, context: TriggerContext) {
    if (!event.action || !event.moderator) {
        return;
    }

    if ((event.action === "removecomment" || event.action === "removelink") && event.moderator.name === "reddit") {
        let targetId: string | undefined;
        if (event.action === "removecomment") {
            targetId = event.targetComment?.id;
        } else if (event.action === "removelink") {
            targetId = event.targetPost?.id;
        }

        if (!targetId) {
            return;
        }

        console.log(`${targetId}: Detected a ${event.action} action from reddit. Queueing job for Reddit action checks.`);

        await context.scheduler.runJob({
            name: "handleRedditActions",
            data: {targetId},
            runAt: addSeconds(new Date(), 10), // 10 seconds to give async updates time to finish.
        });
    }
}

export async function handleRedditActions (event: ScheduledJobEvent, context: TriggerContext) {
    if (!event.data) {
        return;
    }

    const targetId = event.data.targetId as string | undefined;
    if (!targetId) {
        return;
    }

    const settings = await context.settings.getAll();

    const banEvasionBanUsers = settings[Setting.BanUser] as boolean ?? false;
    const banEvasionRemoveContent = settings[Setting.RemoveContent] as boolean ?? true;

    if (!banEvasionBanUsers && !banEvasionRemoveContent) {
        return;
    }

    const subredditName = (await context.reddit.getCurrentSubreddit()).name;

    const modLog = await context.reddit.getModerationLog({
        subredditName,
        moderatorUsernames: ["reddit"],
        type: "removecomment",
        limit: 100,
    }).all();

    const modLogFiltered = modLog.filter(x => x.description?.toLowerCase().includes("ban evasion") && x.target?.id === targetId);

    if (modLogFiltered.length === 0) {
        console.log(`${targetId}: Not a Ban Evasion report`);
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

    if (banEvasionBanUsers) {
        const banMessage = settings[Setting.BanMessage] as string ?? "Ban evasion";
        promises.push(context.reddit.banUser({
            subredditName,
            username: target.authorName,
            message: banMessage,
            note: banMessage,
        }));
        console.log(`${targetId}: ${target.authorName} has been banned.`);
    }

    if (banEvasionRemoveContent) {
        promises.push(target.remove());
        console.log(`${targetId}: ${target.authorName}'s post or comment has been removed.`);
    }

    await Promise.all(promises);
}
