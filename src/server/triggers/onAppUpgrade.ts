import type { Context } from "hono";
import { TriggerResponse } from "@devvit/web/shared";
import { handleInstallEvents } from "../core";

export const onAppUpgrade = async (c: Context): Promise<Response> => {
    console.log("App Upgrade: Triggered");

    await handleInstallEvents();

    return c.json<TriggerResponse>({ message: "app upgraded" }, 200);
};
