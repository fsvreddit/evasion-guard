import { shortenedPermalink } from "./utility.js";

test("Shorten URL for comment", () => {
    const input = "/r/unitedkingdom/comments/1k7dty5/shamed_scots_doctor_used_secret_spy_cameras_to/moxtabw/";
    const expected = "/r/unitedkingdom/comments/1k7dty5/-/moxtabw/";

    const result = shortenedPermalink(input);

    expect(result).toBe(expected);
});

test("Shorten URL for post", () => {
    const input = "/r/unitedkingdom/comments/1k7dty5/shamed_scots_doctor_used_secret_spy_cameras_to/";
    const expected = "/r/unitedkingdom/comments/1k7dty5/";

    const result = shortenedPermalink(input);

    expect(result).toBe(expected);
});
