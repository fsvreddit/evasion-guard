import { Comment, context, Post, reddit, scheduler } from "@devvit/web/server";
import { isT3 } from "@devvit/web/shared";
import { ActionBase } from "./actionBase.js";
import { shortenedPermalink } from "../utility.js";
import { SchedulerJob } from "../constants.js";
import { addSeconds } from "date-fns";
import json2md from "json2md";
import { AddAdditionalDetailsToModmailJobData } from "../../tasks";

export enum BanSetting {
    BanUser = "banEvasionBanUsers",
    BanReason = "banReason",
    BanMessage = "banMessage",
    BanDuration = "banDuration",
    BanIncludeTargetContentAsPrivateModNote = "banIncludeTargetContentAsPrivateModNote",
}

export class BanUserAction extends ActionBase {
    override actionEnabled () {
        return this.settings[BanSetting.BanUser] as boolean | undefined ?? false;
    }

    override async execute (target: Post | Comment) {
        let banReason = this.settings[BanSetting.BanReason] as string | undefined ?? "Ban evasion";
        banReason = banReason.replaceAll("{{permalink}}", shortenedPermalink(target.permalink));

        let banMessage = this.settings[BanSetting.BanMessage] as string | undefined;
        if (!banMessage) {
            banMessage = undefined;
        } else {
            banMessage = banMessage.replaceAll("{{username}}", target.authorName);
            banMessage = banMessage.replaceAll("{{permalink}}", shortenedPermalink(target.permalink));
        }

        const durationSetting = this.settings[BanSetting.BanDuration] as number | undefined ?? 0;
        const duration = durationSetting > 0 ? durationSetting : undefined;

        await reddit.banUser({
            subredditName: context.subredditName,
            username: target.authorName,
            message: banMessage,
            note: banReason,
            duration,
        });

        if (this.settings[BanSetting.BanIncludeTargetContentAsPrivateModNote]) {
            await this.queueModNoteWithAdditionalDetailsToModmail(target);
        }

        console.log(`${target.id}: ${target.authorName} has been banned.`);
    }

    private async queueModNoteWithAdditionalDetailsToModmail (target: Post | Comment) {
        const message: json2md.DataObject[] = [
            { p: `/u/${target.authorName} was banned for ban evasion, triggered by [this ${isT3(target.id) ? "post" : "comment"}](${target.permalink})` },
        ];

        if ("title" in target) {
            message.push({ p: `Title: ${target.title}` });
            if (!target.url.startsWith(`https://www.reddit.com/r/${target.subredditName}`)) {
                message.push({ p: `URL: ${target.url}` });
            }
        }

        if (target.body) {
            message.push({ blockquote: target.body });
        }

        await scheduler.runJob<AddAdditionalDetailsToModmailJobData>({
            name: SchedulerJob.AddAdditionalDetailsToModmail,
            runAt: addSeconds(new Date(), 5),
            data: {
                targetPermalink: shortenedPermalink(target.permalink),
                authorName: target.authorName,
                message: json2md(message),
                jobGuid: crypto.randomUUID(),
            },
        });
    }
}
