A Devvit app to either remove comments from or ban users who have been detected by Reddit for ban evasion using the native Ban Evasion Detection tools.

I **strongly** advise that the "ban" option is only used if the detection is in High Confidence mode. If you use it when in Low Confidence mode there is a high chance of false positives.

The app does not ban the user immediately when Reddit filters the comment or post. There is a short delay of approximately ten seconds to allow the mod log to be written fully, so it is possible that you will occasionally see Ban Evasion entries in the modqueue.

If the user has been recently unbanned from the subreddit, they will not be banned again. This is because the Ban Evasion detection can suffer from false positives immediately after a ban. Due to this, you may occasionally see "Ban evasion" entries in the mod queue that persist longer.

This app is open source. You can find the source on Github [here](https://github.com/fsvreddit/evasion-guard).

## Change log

v1.1.5

* Mitigate against duplicate triggers, preventing undesirable multiple bans
* Make check for recent unbans more efficient

v1.1.1

* Separate out ban reason and ban message
* Add {{username}} and {{permalink}} placeholders on ban message
* Add ability to set a maximum account age to automate actions on
