import { Comment, Post, SettingsFormField } from "@devvit/public-api";
import { ActionBase } from "./actionBase.js";
import { addDays } from "date-fns";
import { shortenedPermalink } from "../utility.js";

enum ModNoteSetting {
    EnableModNotes = "enableModNotes",
    ModNoteMessage = "modNoteMessage",
}

export class AddModNoteAction extends ActionBase {
    override actionSettings: SettingsFormField = {
        type: "group",
        label: "Mod Note Options",
        fields: [
            {
                type: "boolean",
                name: ModNoteSetting.EnableModNotes,
                label: "Add Mod Note",
                helpText: "Adds a mod note to the user when a user is flagged for ban evasion.",
                defaultValue: false,
            },
            {
                type: "string",
                name: ModNoteSetting.ModNoteMessage,
                label: "Mod Note Message",
                helpText: "Message to add as a mod note when a user is flagged for ban evasion. Supports placeholder {{permalink}}",
                defaultValue: "User was flagged by Reddit's ban evasion detection system.",
            },
        ],
    };

    override actionEnabled () {
        return this.settings[ModNoteSetting.EnableModNotes] as boolean | undefined ?? false;
    }

    private async setModNoteAddedRecord (username: string) {
        const redisKey = `modnote:${username}`;
        await this.context.redis.set(redisKey, new Date().getTime().toString(), { expiration: addDays(new Date(), 28) });
    }

    private async hasNoteBeenAddedAlready (username: string): Promise<boolean> {
        const redisKey = `modnote:${username}`;
        const noteAdded = await this.context.redis.exists(redisKey);
        if (noteAdded) {
            // Push forward the expiration date.
            await this.setModNoteAddedRecord(username);
            return true;
        }

        // If the Redis key doesn't exist, they may still have a mod note.
        const modNotes = await this.context.reddit.getModNotes({
            subreddit: await this.subredditName(),
            user: username,
            filter: "NOTE",
        }).all();

        const modNoteExists = modNotes.some(note => note.operator.name === this.context.appName);
        if (modNoteExists) {
            await this.setModNoteAddedRecord(username);
        }

        return modNoteExists;
    }

    override async execute (target: Post | Comment) {
        const noteAdded = await this.hasNoteBeenAddedAlready(target.authorName);
        if (noteAdded) {
            console.log(`${target.id}: ${target.authorName} already has a mod note.`);
            return;
        }

        let modNote = this.settings[ModNoteSetting.ModNoteMessage] as string;
        modNote = modNote.replaceAll("{{permalink}}", shortenedPermalink(target.permalink));

        await this.context.reddit.addModNote({
            subreddit: await this.subredditName(),
            user: target.authorName,
            note: modNote,
            label: "SPAM_WATCH",
        });

        console.log(`${target.id}: ${target.authorName} has been added to the mod notes.`);

        await this.setModNoteAddedRecord(target.authorName);
    }
}
