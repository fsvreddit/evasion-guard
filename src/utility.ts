import { Comment, Post, TriggerContext } from "@devvit/public-api";
import { isCommentId, isLinkId } from "@devvit/shared-types/tid.js";

export function getPostOrCommentById (thingId: string, context: TriggerContext): Promise<Post | Comment> {
    if (isCommentId(thingId)) {
        return context.reddit.getCommentById(thingId);
    } else if (isLinkId(thingId)) {
        return context.reddit.getPostById(thingId);
    } else {
        throw new Error(`Invalid thingId ${thingId}`);
    }
}

export function replaceAll (input: string, pattern: string, replacement: string): string {
    return input.split(pattern).join(replacement);
}
