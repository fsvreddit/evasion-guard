import { Comment, JobContext, JSONObject, Post, ScheduledJobEvent, SettingsFormField } from "@devvit/public-api";
import { ActionBase } from "./actionBase.js";
import { shortenedPermalink } from "../utility.js";
import { SchedulerJob } from "../constants.js";
import { addSeconds } from "date-fns";
import json2md from "json2md";

enum BanSetting {
    BanUser = "banEvasionBanUsers",
    BanReason = "banReason",
    BanMessage = "banMessage",
    BanDuration = "banDuration",
    BanIncludeTargetContentAsPrivateModNote = "banIncludeTargetContentAsPrivateModNote",
}

export class BanUserAction extends ActionBase {
    override actionSettings: SettingsFormField = {
        type: "group",
        label: "Ban Options",
        fields: [
            {
                type: "boolean",
                name: BanSetting.BanUser,
                label: "Ban users detected for ban evasion",
                defaultValue: false,
            },
            {
                type: "string",
                name: BanSetting.BanReason,
                label: "Ban reason (visible on 'banned users' page).",
                helpText: "Supports placeholder: {{permalink}}",
                defaultValue: "Ban evasion",
            },
            {
                type: "paragraph",
                name: BanSetting.BanMessage,
                label: "Ban message to send to user",
                helpText: "Supports placeholders: {{username}}, {{permalink}}",
                defaultValue: "Ban evasion",
            },
            {
                type: "number",
                name: BanSetting.BanDuration,
                label: "Ban duration (in days)",
                helpText: "Set to 0 for a permanent ban.",
                defaultValue: 0,
                onValidate: ({ value }) => {
                    if (value && (value < 0 || value > 999)) {
                        return "Ban duration must be between 0 and 999 days";
                    }
                },
            },
            {
                type: "boolean",
                name: BanSetting.BanIncludeTargetContentAsPrivateModNote,
                label: "Include a private mod note on the ban modmail with a copy of the content that triggered the ban evasion detection",
                defaultValue: false,
            },
        ],
    };

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

        await this.context.reddit.banUser({
            subredditName: await this.subredditName(),
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
            { p: `/u/${target.authorName} was banned for ban evasion, triggered by [this ${target instanceof Post ? "post" : "comment"}](${target.permalink})` },
        ];

        if (target instanceof Post) {
            message.push({ p: `Title: ${target.title}` });
            if (!target.url.startsWith(`https://www.reddit.com/r/${target.subredditName}`)) {
                message.push({ p: `URL: ${target.url}` });
            }
        }

        if (target.body) {
            message.push({ blockquote: target.body });
        }

        await this.context.scheduler.runJob({
            name: SchedulerJob.AddAdditionalDetailsToModmail,
            runAt: addSeconds(new Date(), 5),
            data: {
                targetPermalink: shortenedPermalink(target.permalink),
                authorName: target.authorName,
                message: json2md(message),
            },
        });
    }
}

interface AdditionalDetailsToModmailEventData {
    targetPermalink: string;
    authorName: string;
    message: string;
}

export async function addAdditionalDetailsToModmail (event: ScheduledJobEvent<JSONObject | undefined>, context: JobContext) {
    const data = event.data as AdditionalDetailsToModmailEventData | undefined;
    if (!data) {
        console.error("No data provided for addAdditionalDetailsToModmail job");
        return;
    }

    const recentModmail = await context.reddit.modMail.getConversations({
        subreddits: [context.subredditName ?? await context.reddit.getCurrentSubredditName()],
        state: "archived",
    });

    const banModmail = Object.values(recentModmail.conversations).find(convo => convo.participant?.name === data.authorName
        && Object.values(convo.messages).some(message => message.author?.name === context.appName));

    if (!banModmail) {
        console.error(`Could not find modmail conversation for banned user ${data.authorName}`);
        return;
    }

    if (!banModmail.id) {
        console.error(`Modmail conversation for banned user ${data.authorName} has no ID`);
        return;
    }

    await context.reddit.modMail.reply({
        conversationId: banModmail.id,
        body: data.message,
        isInternal: true,
    });

    await context.reddit.modMail.archiveConversation(banModmail.id);

    console.log(`Added additional details to modmail for banned user ${data.authorName}`);
}
