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
