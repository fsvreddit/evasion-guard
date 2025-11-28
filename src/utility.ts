import { Comment, Post, TriggerContext } from "@devvit/public-api";
import { isCommentId, isLinkId } from "@devvit/public-api/types/tid.js";

export function getPostOrCommentById (thingId: string, context: TriggerContext): Promise<Post | Comment> {
    if (isCommentId(thingId)) {
        return context.reddit.getCommentById(thingId);
    } else if (isLinkId(thingId)) {
        return context.reddit.getPostById(thingId);
    } else {
        throw new Error(`Invalid thingId ${thingId}`);
    }
}

export function shortenedPermalink (permalink: string): string {
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
