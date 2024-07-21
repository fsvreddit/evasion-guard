import {Comment, Post, TriggerContext} from "@devvit/public-api";

export enum ThingPrefix {
    Comment = "t1_",
    Account = "t2_",
    Post = "t3_",
    Message = "t4_",
    Subreddit = "t5_",
    Award = "t6_"
}

export function getPostOrCommentById (thingId: string, context: TriggerContext): Promise<Post | Comment> {
    if (thingId.startsWith(ThingPrefix.Comment)) {
        return context.reddit.getCommentById(thingId);
    } else if (thingId.startsWith(ThingPrefix.Post)) {
        return context.reddit.getPostById(thingId);
    } else {
        throw new Error(`Invalid thingId ${thingId}`);
    }
}

export function replaceAll (input: string, pattern: string, replacement: string): string {
    return input.split(pattern).join(replacement);
}
