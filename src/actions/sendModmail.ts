import { Comment, Post } from "@devvit/public-api";
import { ModmailNotificationType, Setting } from "../settings.js";
import { ActionBase } from "./actionBase.js";
import markdownEscape from "markdown-escape";

export class SendModmailAction extends ActionBase {
    private modmailAction (): ModmailNotificationType {
        const [notificationType] = this.settings[Setting.ModmailNotification] as ModmailNotificationType[] | undefined ?? [ModmailNotificationType.None];
        return notificationType;
    }

    override actionEnabled () {
        return this.modmailAction() !== ModmailNotificationType.None;
    }

    override async execute (target: Post | Comment) {
        const message = `${markdownEscape(target.authorName)} has been banned for suspected ban evasion from r/${target.subredditName}. [Permalink to content](${target.permalink})`;
        const parameters = {
            subject: "Ban evasion detected",
            bodyMarkdown: message,
            subredditId: this.context.subredditId,
        };

        if (this.modmailAction() === ModmailNotificationType.Inbox) {
            await this.context.reddit.modMail.createModInboxConversation(parameters);
        } else {
            await this.context.reddit.modMail.createModNotification(parameters);
        }
    }
}
