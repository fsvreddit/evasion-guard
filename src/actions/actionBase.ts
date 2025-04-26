import { Comment, Post, SettingsValues, TriggerContext } from "@devvit/public-api";

export abstract class ActionBase {
    protected context: TriggerContext;
    protected settings: SettingsValues;

    protected async subredditName (): Promise<string> {
        return this.context.subredditName ?? this.context.reddit.getCurrentSubredditName();
    }

    constructor (context: TriggerContext, settings: SettingsValues) {
        this.context = context;
        this.settings = settings;
    }

    abstract actionEnabled (): boolean;
    abstract execute (target: Post | Comment): Promise<void>;
}
