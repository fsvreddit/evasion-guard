// Visit developers.reddit.com/docs to learn Devvit!

import {Devvit} from "@devvit/public-api";
import {handleModAction, handleRedditActions} from "./banEvasionDetection.js";
import {settingsForBanEvasionHandling} from "./settings.js";

Devvit.addSettings(settingsForBanEvasionHandling);

Devvit.addTrigger({
    event: "ModAction",
    onEvent: handleModAction,
});

Devvit.addSchedulerJob({
    name: "handleRedditActions",
    onRun: handleRedditActions,
});

Devvit.configure({
    redditAPI: true,
});

export default Devvit;
