import { SettingsValidationRequest, SettingsValidationResponse } from "@devvit/web/shared";
import type { Context } from "hono";

export const validateBanDuration = async (c: Context): Promise<Response> => {
    const { value } = await c.req.json<SettingsValidationRequest<number>>();

    if (value === undefined) {
        return c.json<SettingsValidationResponse>({
            success: false,
            error: "Ban duration is required",
        });
    }

    if (value < 0 || value > 999 || !Number.isInteger(value)) {
        return c.json<SettingsValidationResponse>({
            success: false,
            error: "Ban duration must be a whole number between 0 and 999",
        });
    }

    return c.json<SettingsValidationResponse>({
        success: true,
    });
};
