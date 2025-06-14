A Devvit app to either remove comments from or ban users who have been detected by Reddit for ban evasion using the native Ban Evasion Detection tools.

I **strongly** advise that the "ban" option is only used if the detection is in High Confidence mode. If you use it when in Low Confidence mode there is a high chance of false positives.

The app does not ban the user immediately when Reddit filters the comment or post. There is a short delay of approximately ten seconds to allow the mod log to be written fully, so it is possible that you will occasionally see Ban Evasion entries in the modqueue.

If the user has been recently unbanned from the subreddit, they will not be banned again. This is because the Ban Evasion detection can suffer from false positives immediately after a ban. Due to this, you may occasionally see "Ban evasion" entries in the mod queue that persist longer.

This app is open source. You can find the source on Github [here](https://github.com/fsvreddit/evasion-guard).

## Change log

### v1.3.3

* Fix bug preventing app from working after Reddit changed how ban evasion log entries are retrieved from the Dev Platform
* App now only acts on Higher Accuracy ban evasion detections.

### v1.3.2

* Fixed bug where the "remove" action type was only working where the "ban" option was enabled

### v1.3.1

* Escape usernames properly in modmail output

### v1.3.0

* Add function to add mod note when a user is detected for ban evasion
* Add {{permalink}} placeholder support for ban reason
* Add support for temporary bans
* Fix an issue that prevented auto-allowlisting on approve from working

### v1.2.2

* Add function to send modmail when a user is detected for ban evasion

### v1.2.1

* Add allowlisting functionality
* Allow multi-line ban messages
* Add feature to leave removal messages in reply to users

### v1.1.6

* Add option to automatically approve content for users flagged for ban evasion who have been recently unbanned.

### v1.1.5

* Mitigate against duplicate triggers, preventing undesirable multiple bans
* Make check for recent unbans more efficient

### v1.1.1

* Separate out ban reason and ban message
* Add {{username}} and {{permalink}} placeholders on ban message
* Add ability to set a maximum account age to automate actions on
