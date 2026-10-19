import { TaskRequest, TaskResponse } from "@devvit/web/server";
import { T1, T3 } from "@devvit/web/shared";
import { Context } from "hono";
import { handleRedditActions } from "../core";

export type HandleRedditActionsJobData = {
    targetId: T1 | T3;
    jobGuid: string;
};

export const handleRedditActionsJob = async (c: Context): Promise<Response> => {
    const request = await c.req.json<TaskRequest<HandleRedditActionsJobData>>();

    await handleRedditActions(request);

    return c.json<TaskResponse>({ message: "Reddit actions job handled." }, 200);
};
