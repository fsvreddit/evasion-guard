import {AppInstall, AppUpgrade} from "@devvit/protos";
import {TriggerContext} from "@devvit/public-api";
import {addDays, subDays} from "date-fns";

export async function handleInstallEvents (_: AppInstall | AppUpgrade, context: TriggerContext) {
    const redisKey = "StoredRecentUnbans";
    const alreadyStored = await context.redis.get(redisKey);

    if (alreadyStored) {
        return;
    }

    const subreddit = await context.reddit.getCurrentSubreddit();
    const recentUnbans = await context.reddit.getModerationLog({
        subredditName: subreddit.name,
        type: "unbanuser",
        limit: 1000,
    }).all();

    // Store a record of recent unbans for any user unbanned in last 7 days.
    for (const logEntry of recentUnbans.filter(x => x.createdAt > subDays(new Date(), 7))) {
        if (logEntry.target && logEntry.target.author !== "[deleted]") {
            await context.redis.set(`unbanned~${logEntry.target.author}`, new Date().getTime().toString(), {expiration: addDays(logEntry.createdAt, 7)});
            console.log(`Stored details of unban for ${logEntry.target.author}`);
        }
    }

    await context.redis.set(redisKey, "true");
}
