import { context, reddit, TaskRequest, TaskResponse } from "@devvit/web/server";
import { Context } from "hono";
import { hasEventBeenHandled } from "@fsvreddit/fsv-devvit-web-helpers";
import { addMinutes } from "date-fns";

export type AddAdditionalDetailsToModmailJobData = {
    jobGuid?: string;
    targetPermalink: string;
    authorName: string;
    message: string;
};

export const handleAddAdditionalDetailsToModmailJob = async (c: Context): Promise<Response> => {
    const event = await c.req.json<TaskRequest<AddAdditionalDetailsToModmailJobData>>();

    const jobGuid = event.data.jobGuid;
    if (jobGuid && await hasEventBeenHandled(`addAdditionalDetailsToModmail:${jobGuid}`, { expiration: addMinutes(new Date(), 5) })) {
        console.warn(`Duplicate addAdditionalDetailsToModmail job for jobGuid ${jobGuid}`);
        return c.json<TaskResponse>({ message: `Duplicate addAdditionalDetailsToModmail job for jobGuid ${jobGuid}` }, 200);
    }

    const { data } = event;

    const recentModmail = await reddit.modMail.getConversations({
        subreddits: [context.subredditName],
        state: "archived",
    });

    const banModmail = Object.values(recentModmail.conversations).find(convo => convo.participant?.name === data.authorName
        && Object.values(convo.messages).some(message => message.author?.name === context.appSlug));

    if (!banModmail) {
        console.error(`Could not find modmail conversation for banned user ${data.authorName}`);
        return c.json<TaskResponse>({ message: `Could not find modmail conversation for banned user ${data.authorName}` }, 200);
    }

    if (!banModmail.id) {
        console.error(`Modmail conversation for banned user ${data.authorName} has no ID`);
        return c.json<TaskResponse>({ message: `Modmail conversation for banned user ${data.authorName} has no ID` }, 400);
    }

    await reddit.modMail.reply({
        conversationId: banModmail.id,
        body: data.message,
        isInternal: true,
    });

    await reddit.modMail.archiveConversation(banModmail.id);

    console.log(`Added additional details to modmail for banned user ${data.authorName}`);
    return c.json<TaskResponse>({ message: `Added additional details to modmail for banned user ${data.authorName}` }, 200);
};
