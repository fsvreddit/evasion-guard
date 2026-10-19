import { Comment, context, Post, reddit } from "@devvit/web/server";
import { ModmailNotificationType } from "..";
import { ActionBase } from "./actionBase.js";
import json2md from "json2md";
import { RemoveContentAction } from "./removeContent.js";
import { BanUserAction } from "./banUser.js";
import { AddModNoteAction } from "./addModNote.js";
import pluralize from "pluralize";

export enum ModmailSetting {
    ModmailNotification = "modmailNotification",
}

export class SendModmailAction extends ActionBase {
    override actionEnabled () {
        return this.modmailAction() !== ModmailNotificationType.None;
    }

    private modmailAction (): ModmailNotificationType {
        const [notificationType] = this.settings[ModmailSetting.ModmailNotification] as ModmailNotificationType[] | undefined ?? [ModmailNotificationType.None];
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        return notificationType!;
    }

    override async execute (target: Post | Comment) {
        const message: json2md.DataObject[] = [
            { p: `/u/${target.authorName} has been flagged for suspected ban evasion in r/${target.subredditName}. [Permalink to content](${target.permalink})` },
        ];

        const actionTakenBullets: string[] = [];
        if (new BanUserAction(this.settings).actionEnabled()) {
            actionTakenBullets.push("The user has been banned for suspected ban evasion.");
        }

        if (new RemoveContentAction(this.settings).actionEnabled()) {
            actionTakenBullets.push("The content that triggered the ban evasion detection has been removed.");
        }

        if (new AddModNoteAction(this.settings).actionEnabled()) {
            actionTakenBullets.push("A mod note has been added to the user's account.");
        }

        if (actionTakenBullets.length > 0) {
            message.push({ p: `${pluralize("Action", actionTakenBullets.length)} taken:` });
            message.push({ ul: actionTakenBullets });
        }

        const parameters = {
            subject: "Potential ban evasion detected",
            bodyMarkdown: json2md(message),
            subredditId: context.subredditId,
        };

        if (this.modmailAction() === ModmailNotificationType.Inbox) {
            await reddit.modMail.createModInboxConversation(parameters);
        } else {
            await reddit.modMail.createModNotification(parameters);
        }
    }
}
