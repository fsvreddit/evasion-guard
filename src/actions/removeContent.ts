import { Comment, Post, SettingsFormField } from "@devvit/public-api";
import { ActionBase } from "./actionBase.js";

enum RemovalSetting {
    RemoveContent = "banEvasionRemoveContent",
    RemovalMessage = "removalMessage",
}

export class RemoveContentAction extends ActionBase {
    override actionSettings: SettingsFormField = {
        type: "group",
        label: "Removal Options",
        fields: [
            {
                type: "boolean",
                name: RemovalSetting.RemoveContent,
                label: "Remove content from users detected as evading bans",
                helpText: "Only the comment or post that triggered the Ban Evasion detection will be removed.",
                defaultValue: true,
            },
            {
                type: "paragraph",
                name: RemovalSetting.RemovalMessage,
                label: "Removal message to reply to the content with",
                helpText: "Removal messages will only be left if the above setting is turned on. Leave blank to disable.",
            },
        ],
    };

    override actionEnabled () {
        return this.settings[RemovalSetting.RemoveContent] as boolean | undefined ?? false;
    }

    override async execute (target: Post | Comment) {
        const promises: Promise<unknown>[] = [
            target.remove(),
        ];

        console.log(`${target.id}: ${target.authorName}'s post or comment has been removed.`);

        if (this.settings[RemovalSetting.RemovalMessage]) {
            const newComment = await this.context.reddit.submitComment({
                id: target.id,
                text: this.settings[RemovalSetting.RemovalMessage] as string,
            });
            promises.push(newComment.lock(), newComment.distinguish());
        }

        await Promise.all(promises);
    }
}
