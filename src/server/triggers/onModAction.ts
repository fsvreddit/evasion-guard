import type { Context } from "hono";
import { OnModActionRequest, TriggerResponse } from "@devvit/web/shared";
import { handleModAction } from "../core";

export const onModAction = async (c: Context): Promise<Response> => {
    const request = await c.req.json<OnModActionRequest>();

    await handleModAction(request);

    return c.json<TriggerResponse>({ message: "mod action handled" }, 200);
};
