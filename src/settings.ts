import {SettingsFormField} from "@devvit/public-api";

export enum Setting {
    BanUser = "banEvasionBanUsers",
    BanMessage = "banMessage",
    RemoveContent = "banEvasionRemoveContent",
}

export const settingsForBanEvasionHandling: SettingsFormField[] = [
    {
        type: "boolean",
        name: Setting.BanUser,
        label: "Ban users detected for ban evasion",
        defaultValue: false,
    },
    {
        type: "string",
        name: Setting.BanMessage,
        label: "Ban message to send to user",
        defaultValue: "Ban evasion",
    },
    {
        type: "boolean",
        name: Setting.RemoveContent,
        label: "Remove content from users detected as evading bans",
        helpText: "Only the comment or post that triggered the Ban Evasion detection will be removed.",
        defaultValue: true,
    },
];
