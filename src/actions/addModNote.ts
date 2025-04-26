import { Comment, Post } from "@devvit/public-api";
import { Setting } from "../settings.js";
import { ActionBase } from "./actionBase.js";
import { addDays } from "date-fns";

export class AddModNoteAction extends ActionBase {
    override actionEnabled () {
        return this.settings[Setting.EnableModNotes] as boolean | undefined ?? false;
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

        await this.context.reddit.addModNote({
            subreddit: await this.subredditName(),
            user: target.authorName,
            note: "User was flagged by Reddit's ban evasion detection system.",
            label: "SPAM_WATCH",
        });

        console.log(`${target.id}: ${target.authorName} has been added to the mod notes.`);

        await this.setModNoteAddedRecord(target.authorName);
    }
}
