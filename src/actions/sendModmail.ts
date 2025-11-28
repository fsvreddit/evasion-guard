import { Comment, Post, SettingsFormField } from "@devvit/public-api";
import { ModmailNotificationType } from "../settings.js";
import { ActionBase } from "./actionBase.js";
import markdownEscape from "markdown-escape";

enum ModmailSetting {
    ModmailNotification = "modmailNotification",
}

export class SendModmailAction extends ActionBase {
    override actionSettings: SettingsFormField = {
        type: "group",
        label: "Modmail Options",
        fields: [
            {
                type: "select",
                name: ModmailSetting.ModmailNotification,
                label: "Send modmail notification",
                options: [
                    { label: "No notification", value: ModmailNotificationType.None },
                    { label: "Inbox", value: ModmailNotificationType.Inbox },
                    { label: "Mod Notifications", value: ModmailNotificationType.ModNotifications },
                ],
                multiSelect: false,
                defaultValue: [ModmailNotificationType.None],
            },
        ],
    };

    private modmailAction (): ModmailNotificationType {
        const [notificationType] = this.settings[ModmailSetting.ModmailNotification] as ModmailNotificationType[] | undefined ?? [ModmailNotificationType.None];
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
