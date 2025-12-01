A Devvit app to either remove comments from or ban users who have been detected by Reddit for ban evasion using the native Ban Evasion Detection tools.

This app only acts on ban evasion reports that are detected to be High Confidence. Low confidence ban evasion reports are prone to false positives.

The app does not ban the user immediately when Reddit filters the comment or post. There is a short delay of approximately ten seconds to allow the mod log to be written fully, so it is possible that you will occasionally see Ban Evasion entries in the modqueue.

If the user has been recently unbanned from the subreddit, they will not be banned again. This is because the Ban Evasion detection can suffer from false positives immediately after a ban. Due to this, you may occasionally see "Ban evasion" entries in the mod queue that persist longer.

This app is open source. [You can find the source on Github here](https://github.com/fsvreddit/evasion-guard).

## Change log

### v1.4.6

* Fix bug that prevented app from working entirely. Sorry about that!

### v1.4.0

* Allow customisable placeholders when leaving mod notes
* Add feature to add a copy of the content that triggered the detection as a private mod note on the ban modmail
* Modmail feature now is clearer about action taken (previously, it would always say "banned" even if that option was not enabled)
* Removal message now supports {{username}} placeholder
* Reduced resource utilisation on Dev Platform
* Update Dev Platform dependencies

For older changes, please see the [full changelog](https://github.com/fsvreddit/evasion-guard/blob/main/changelog.md)
