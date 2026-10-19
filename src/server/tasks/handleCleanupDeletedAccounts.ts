import { TaskRequest, TaskResponse } from "@devvit/web/server";
import { Context } from "hono";
import { cleanupDeletedAccounts } from "../core";

export type CleanupDeletedAccountsJobData = {
    jobGuid?: string;
    runDate?: string;
    fromCron: boolean;
};

export const handleCleanupDeletedAccountsJob = async (c: Context): Promise<Response> => {
    const request = await c.req.json<TaskRequest<CleanupDeletedAccountsJobData>>();

    await cleanupDeletedAccounts(request);

    return c.json<TaskResponse>({ message: "Cleanup job handled." }, 200);
};
