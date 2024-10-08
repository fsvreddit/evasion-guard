import { SettingsFormField } from "@devvit/public-api";

export enum Setting {
    BanUser = "banEvasionBanUsers",
    BanReason = "banReason",
    BanMessage = "banMessage",
    RemoveContent = "banEvasionRemoveContent",
    ActionThresholdValue = "actionThresholdValue",
    ActionThresholdUnit = "actionThresholdUnit",
}

export enum DateUnit {
    Day = "day",
    Week = "week",
    Month = "month",
    Year = "year",
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
        name: Setting.BanReason,
        label: "Ban reason (visible on 'banned users' page)",
        defaultValue: "Ban evasion",
    },
    {
        type: "string",
        name: Setting.BanMessage,
        label: "Ban message to send to user",
        helpText: "Supports placeholders: {{username}}, {{permalink}}",
        defaultValue: "Ban evasion",
    },
    {
        type: "boolean",
        name: Setting.RemoveContent,
        label: "Remove content from users detected as evading bans",
        helpText: "Only the comment or post that triggered the Ban Evasion detection will be removed.",
        defaultValue: true,
    },
    {
        type: "number",
        name: Setting.ActionThresholdValue,
        label: "Max account age",
        helpText: "This app will only take action on users younger than this age. Set to 0 to take action at any age.",
        defaultValue: 0,
    },
    {
        type: "select",
        name: Setting.ActionThresholdUnit,
        label: "Max account age unit",
        options: Object.entries(DateUnit).map(([label, value]) => ({ label, value })),
        multiSelect: false,
        defaultValue: [DateUnit.Day],
    },
];
