import { Comment, Post } from "@devvit/public-api";
import { Setting } from "../settings.js";
import { replaceAll } from "../utility.js";
import { ActionBase } from "./actionBase.js";

export class BanUserAction extends ActionBase {
    override actionEnabled () {
        return this.settings[Setting.BanUser] as boolean | undefined ?? false;
    }

    public shortenedPermalink (permalink: string): string {
        const regex = /^\/r\/([^/]+)\/comments\/([\w\d]+)\/[^/]+\/(?:([\w\d]+)\/)?$/;
        const matches = regex.exec(permalink);
        if (!matches) {
            return permalink;
        }

        const [, subredditName, postId, commentId] = matches;
        if (commentId) {
            return `/r/${subredditName}/comments/${postId}/-/${commentId}/`;
        } else {
            return `/r/${subredditName}/comments/${postId}/`;
        }
    }

    override async execute (target: Post | Comment) {
        let banReason = this.settings[Setting.BanReason] as string | undefined ?? "Ban evasion";
        banReason = replaceAll(banReason, "{{permalink}}", this.shortenedPermalink(target.permalink));

        let banMessage = this.settings[Setting.BanMessage] as string | undefined;
        if (!banMessage) {
            banMessage = undefined;
        } else {
            banMessage = replaceAll(banMessage, "{{username}}", target.authorName);
            banMessage = replaceAll(banMessage, "{{permalink}}", this.shortenedPermalink(target.permalink));
        }

        const durationSetting = this.settings[Setting.BanDuration] as number | undefined ?? 0;
        const duration = durationSetting > 0 ? durationSetting : undefined;

        await this.context.reddit.banUser({
            subredditName: await this.subredditName(),
            username: target.authorName,
            message: banMessage,
            note: banReason,
            duration,
        });

        console.log(`${target.id}: ${target.authorName} has been banned.`);
    }
}
