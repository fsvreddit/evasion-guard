import { Comment, context, Post, reddit, redis } from "@devvit/web/server";
import { ActionBase } from "./actionBase.js";
import { addDays } from "date-fns";
import { shortenedPermalink } from "../utility.js";

export enum ModNoteSetting {
    EnableModNotes = "enableModNotes",
    ModNoteMessage = "modNoteMessage",
}

export class AddModNoteAction extends ActionBase {
    override actionEnabled () {
        return this.settings[ModNoteSetting.EnableModNotes] as boolean | undefined ?? false;
    }

    private async setModNoteAddedRecord (username: string) {
        const redisKey = `modnote:${username}`;
        await redis.set(redisKey, new Date().getTime().toString(), { expiration: addDays(new Date(), 28) });
    }

    private async hasNoteBeenAddedAlready (username: string): Promise<boolean> {
        const redisKey = `modnote:${username}`;
        const noteAdded = await redis.exists(redisKey);
        if (noteAdded) {
            // Push forward the expiration date.
            await this.setModNoteAddedRecord(username);
            return true;
        }

        // If the Redis key doesn't exist, they may still have a mod note.
        const modNotes = await reddit.getModNotes({
            subreddit: context.subredditName,
            user: username,
            filter: "NOTE",
        }).all();

        const modNoteExists = modNotes.some(note => note.operator.name === context.appSlug);
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

        await reddit.addModNote({
            subreddit: context.subredditName,
            user: target.authorName,
            note: modNote,
            label: "SPAM_WATCH",
        });

        console.log(`${target.id}: ${target.authorName} has been added to the mod notes.`);

        await this.setModNoteAddedRecord(target.authorName);
    }
}
