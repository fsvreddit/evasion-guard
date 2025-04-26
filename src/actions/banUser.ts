import { Comment, Post } from "@devvit/public-api";
import { Setting } from "../settings.js";
import { replaceAll } from "../utility.js";
import { ActionBase } from "./actionBase.js";

export class BanUserAction extends ActionBase {
    override actionEnabled () {
        return this.settings[Setting.BanUser] as boolean | undefined ?? false;
    }

    override async execute (target: Post | Comment) {
        const banReason = this.settings[Setting.BanReason] as string | undefined ?? "Ban evasion";
        let banMessage = this.settings[Setting.BanMessage] as string | undefined;
        if (!banMessage) {
            banMessage = undefined;
        } else {
            banMessage = replaceAll(banMessage, "{{username}}", target.authorName);
            banMessage = replaceAll(banMessage, "{{permalink}}", target.permalink);
        }

        await this.context.reddit.banUser({
            subredditName: await this.subredditName(),
            username: target.authorName,
            message: banMessage,
            note: banReason,
        });

        console.log(`${target.id}: ${target.authorName} has been banned.`);
    }
}
