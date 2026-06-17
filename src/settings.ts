import { SettingsFormField, TriggerContext } from "@devvit/public-api";
import { ALL_ACTIONS } from "./actions/actions.js";

export enum Setting {
    ActionThresholdValue = "actionThresholdValue",
    ActionThresholdUnit = "actionThresholdUnit",
    AutoApproveAfterUnban = "autoApproveAfterUnban",
    UsersToIgnore = "usersToIgnore",
    IgnoreApprovedSubmitters = "ignoreApprovedUsers",
    AutoIgnoreUsersAfterContentApproval = "ignoreAfterContentApproval",
    LowConfidenceAction = "lowConfidenceAction",
}

export enum LowConfidenceAction {
    Ignore = "ignore",
    RemoveFromQueue = "removeFromQueue",
    TakeAction = "takeAction",
}

export enum DateUnit {
    Day = "day",
    Week = "week",
    Month = "month",
    Year = "year",
}

export enum ModmailNotificationType {
    None = "none",
    Inbox = "inbox",
    ModNotifications = "modNotifications",
}

export const generalSettings: SettingsFormField = {
    type: "group",
    label: "Ban Evasion Detection Settings",
    fields: [
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
        {
            type: "select",
            name: Setting.LowConfidenceAction,
            label: "Action for low confidence ban evasion reports",
            helpText: "Low confidence reports are more likely to be false positives. 'Remove from mod queue' confirms the removal without taking further action. 'Take action' applies all configured actions as with high confidence reports.",
            options: [
                { label: "Ignore (leave in mod queue)", value: LowConfidenceAction.Ignore },
                { label: "Remove from mod queue", value: LowConfidenceAction.RemoveFromQueue },
                { label: "Take action (ban, remove, etc.)", value: LowConfidenceAction.TakeAction },
            ],
            multiSelect: false,
            defaultValue: [LowConfidenceAction.Ignore],
        },
    ],
};

export function getAllSettings (): SettingsFormField[] {
    const settings: SettingsFormField[] = [];
    for (const ActionClass of ALL_ACTIONS) {
        const actionInstance = new ActionClass({} as unknown as TriggerContext, {});
        settings.push(actionInstance.actionSettings);
    }

    settings.push(generalSettings);
    return settings;
}
