import { Devvit } from "@devvit/public-api";
import { handleModAction, handleRedditActions } from "./banEvasionDetection.js";
import { settingsForBanEvasionHandling } from "./settings.js";
import { handleInstallEvents } from "./installEvents.js";
import { CLEANUP_JOB, HANDLE_REDDIT_ACTIONS_JOB } from "./constants.js";
import { cleanupDeletedAccounts } from "./cleanupTasks.js";

Devvit.addSettings(settingsForBanEvasionHandling);

Devvit.addTrigger({
    event: "ModAction",
    onEvent: handleModAction,
});

Devvit.addTrigger({
    events: ["AppInstall", "AppUpgrade"],
    onEvent: handleInstallEvents,
});

Devvit.addSchedulerJob({
    name: HANDLE_REDDIT_ACTIONS_JOB,
    onRun: handleRedditActions,
});

Devvit.addSchedulerJob({
    name: CLEANUP_JOB,
    onRun: cleanupDeletedAccounts,
});

Devvit.configure({
    redditAPI: true,
    redis: true,
});

export default Devvit;
