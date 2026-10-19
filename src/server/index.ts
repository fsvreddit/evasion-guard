import { Hono } from "hono";
import { createServer, getServerPort } from "@devvit/web/server";
import { getRequestListener } from "@hono/node-server";
import { onAppInstall, onAppUpgrade, onModAction } from "./triggers";
import { validateBanDuration } from "./validators";
import { handleAddAdditionalDetailsToModmailJob, handleCleanupDeletedAccountsJob, handleRedditActionsJob, handleStoreRecentUnbansAfterInstallJob } from "./tasks";

const application = new Hono();

// Triggers
application.post("/internal/triggers/app-install", onAppInstall);
application.post("/internal/triggers/app-upgrade", onAppUpgrade);
application.post("/internal/triggers/mod-action", onModAction);

// Settings validators
application.post("/internal/validators/validate-ban-duration", validateBanDuration);

// Tasks
application.post("/internal/tasks/add-additional-details-to-modmail", handleAddAdditionalDetailsToModmailJob);
application.post("/internal/tasks/cleanup", handleCleanupDeletedAccountsJob);
application.post("/internal/tasks/handle-reddit-actions", handleRedditActionsJob);
application.post("/internal/tasks/store-recent-unbans-after-install", handleStoreRecentUnbansAfterInstallJob);

const server = createServer(getRequestListener(application.fetch));
server.on("error", (err) => {
    console.error(`server error; ${err.stack}`);
});

const port = getServerPort();
server.listen(port);
