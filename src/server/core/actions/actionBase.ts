import { Comment, Post, SettingsValues } from "@devvit/web/server";

export abstract class ActionBase {
    protected settings: SettingsValues;

    constructor (settings: SettingsValues) {
        this.settings = settings;
    }

    abstract actionEnabled (): boolean;
    abstract execute (target: Post | Comment): Promise<void>;
}
