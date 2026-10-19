import { context, reddit, redis, TaskRequest, TaskResponse } from "@devvit/web/server";
import { hasEventBeenHandled } from "@fsvreddit/fsv-devvit-web-helpers";
import { addDays, addMinutes, subDays } from "date-fns";
import { Context } from "hono";

export type HandleStoreRecentUnbansAfterInstallJobData = {
    jobGuid: string;
};

export const handleStoreRecentUnbansAfterInstallJob = async (c: Context): Promise<Response> => {
    const request = await c.req.json<TaskRequest<HandleStoreRecentUnbansAfterInstallJobData>>();
    const redisKey = "StoredRecentUnbans";

    if (await redis.exists(redisKey)) {
        console.log("Recent unbans have already been stored after install/upgrade, skipping");
        return c.json<TaskResponse>({ message: "Recent unbans have already been stored after install/upgrade, skipping" }, 200);
    }

    if (await hasEventBeenHandled(`handleStoreRecentUnbansAfterInstall:${request.data.jobGuid}`, { expiration: addMinutes(new Date(), 5) })) {
        console.warn(`Duplicate handleStoreRecentUnbansAfterInstall job for jobGuid ${request.data.jobGuid}`);
        return c.json<TaskResponse>({ message: `Duplicate handleStoreRecentUnbansAfterInstall job for jobGuid ${request.data.jobGuid}` }, 200);
    }

    console.log("Storing recent unbans after install/upgrade");

    const recentUnbans = await reddit.getModerationLog({
        subredditName: context.subredditName,
        type: "unbanuser",
        limit: 1000,
    }).all();

    // Store a record of recent unbans for any user unbanned in last 7 days.
    for (const logEntry of recentUnbans.filter(x => x.createdAt > subDays(new Date(), 7))) {
        if (logEntry.target && logEntry.target.author !== "[deleted]") {
            await redis.set(`unbanned~${logEntry.target.author}`, new Date().getTime().toString(), { expiration: addDays(logEntry.createdAt, 7) });
            console.log(`Stored details of unban for ${logEntry.target.author}`);
        }
    }

    await redis.set(redisKey, "true");
    console.log("Completed storing recent unbans after install/upgrade");

    return c.json<TaskResponse>({ message: "Completed storing recent unbans after install/upgrade" }, 200);
};
