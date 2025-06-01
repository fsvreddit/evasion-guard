import { Comment, Post } from "@devvit/public-api";
import { Setting } from "../settings.js";
import { ActionBase } from "./actionBase.js";

export class RemoveContentAction extends ActionBase {
    override actionEnabled () {
        return this.settings[Setting.RemoveContent] as boolean | undefined ?? false;
    }

    override async execute (target: Post | Comment) {
        const promises: Promise<unknown>[] = [
            target.remove(),
        ];

        console.log(`${target.id}: ${target.authorName}'s post or comment has been removed.`);

        if (this.settings[Setting.RemovalMessage]) {
            const newComment = await this.context.reddit.submitComment({
                id: target.id,
                text: this.settings[Setting.RemovalMessage] as string,
            });
            promises.push(newComment.lock(), newComment.distinguish());
        }

        await Promise.all(promises);
    }
}
