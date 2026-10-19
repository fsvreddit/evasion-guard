import { Comment, Post, reddit } from "@devvit/web/server";
import { ActionBase } from "./actionBase.js";

export enum RemovalSetting {
    RemoveContent = "banEvasionRemoveContent",
    RemovalMessage = "removalMessage",
}

export class RemoveContentAction extends ActionBase {
    override actionEnabled () {
        return this.settings[RemovalSetting.RemoveContent] as boolean | undefined ?? false;
    }

    override async execute (target: Post | Comment) {
        const promises: Promise<unknown>[] = [
            target.remove(),
        ];

        console.log(`${target.id}: ${target.authorName}'s post or comment has been removed.`);

        let removalMessage = this.settings[RemovalSetting.RemovalMessage] as string | undefined;
        if (removalMessage) {
            removalMessage = removalMessage.replaceAll("{{username}}", target.authorName);
            const newComment = await reddit.submitComment({
                id: target.id,
                text: removalMessage,
            });
            promises.push(newComment.lock(), newComment.distinguish());
        }

        await Promise.all(promises);
    }
}
