import { Devvit } from "@devvit/public-api";
import { handleModAction, handleRedditActions } from "./banEvasionDetection.js";
import { getAllSettings } from "./settings.js";
import { handleInstallEvents } from "./installEvents.js";
import { SchedulerJob } from "./constants.js";
import { cleanupDeletedAccounts } from "./cleanupTasks.js";
import { addAdditionalDetailsToModmail } from "./actions/banUser.js";

Devvit.addSettings(getAllSettings());

Devvit.addTrigger({
    event: "ModAction",
    onEvent: handleModAction,
});

Devvit.addTrigger({
    events: ["AppInstall", "AppUpgrade"],
    onEvent: handleInstallEvents,
});

Devvit.addSchedulerJob({
    name: SchedulerJob.HandleRedditActions,
    onRun: handleRedditActions,
});

Devvit.addSchedulerJob({
    name: SchedulerJob.Cleanup,
    onRun: cleanupDeletedAccounts,
});

Devvit.addSchedulerJob({
    name: SchedulerJob.AddAdditionalDetailsToModmail,
    onRun: addAdditionalDetailsToModmail,
});

Devvit.configure({
    redditAPI: true,
    redis: true,
});

export default Devvit;
