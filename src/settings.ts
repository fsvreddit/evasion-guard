import { SettingsFormField } from "@devvit/public-api";

export enum Setting {
    BanUser = "banEvasionBanUsers",
    BanReason = "banReason",
    BanMessage = "banMessage",
    RemoveContent = "banEvasionRemoveContent",
    RemovalMessage = "removalMessage",
    ActionThresholdValue = "actionThresholdValue",
    ActionThresholdUnit = "actionThresholdUnit",
    AutoApproveAfterUnban = "autoApproveAfterUnban",
    UsersToIgnore = "usersToIgnore",
    IgnoreApprovedSubmitters = "ignoreApprovedUsers",
    AutoIgnoreUsersAfterContentApproval = "ignoreAfterContentApproval",
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
        type: "paragraph",
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
        type: "paragraph",
        name: Setting.RemovalMessage,
        label: "Removal message to reply to the content with",
        helpText: "Removal messages will only be left if the above setting is turned on. Leave blank to disable.",
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
    {
        type: "boolean",
        name: Setting.AutoApproveAfterUnban,
        label: "Auto-approve posts and comments after recent unban",
        helpText: "Ban Evasion detections after recent unbans are likely false positives. Select this option to approve content flagged for ban evasion within a week of an unban action.",
        defaultValue: false,
    },
    {
        type: "boolean",
        name: Setting.IgnoreApprovedSubmitters,
        label: "Ignore users who are approved submitters",
        defaultValue: false,
    },
    {
        type: "string",
        name: Setting.UsersToIgnore,
        label: "A list of named users to ignore",
        helpText: "Comma separated, not case sensitive",
        defaultValue: "",
    },
    {
        type: "boolean",
        name: Setting.AutoIgnoreUsersAfterContentApproval,
        label: "Ignore and approve content from users who have had content flagged by this app re-approved",
        helpText: "Only approves content specifically flagged for ban evasion, not content more generally",
        defaultValue: false,
    },
];
