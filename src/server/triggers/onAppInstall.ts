import type { Context } from "hono";
import { TriggerResponse } from "@devvit/web/shared";
import { handleInstallEvents } from "../core";

export const onAppInstall = async (c: Context): Promise<Response> => {
    console.log("App Install: Triggered");

    await handleInstallEvents();

    return c.json<TriggerResponse>({ message: "app installed" }, 200);
};
