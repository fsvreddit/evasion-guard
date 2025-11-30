## Change log

### v1.4.3

* Fix bug that prevented app from working entirely. Sorry about that!

### v1.4.0

* Allow customisable placeholders when leaving mod notes
* Add feature to add a copy of the content that triggered the detection as a private mod note on the ban modmail
* Modmail feature now is clearer about action taken (previously, it would always say "banned" even if that option was not enabled)
* Removal message now supports {{username}} placeholder
* Reduced resource utilisation on Dev Platform
* Update Dev Platform dependencies

### v1.3.5

* Fixed issue that prevents ban evasion events from being detected following changes to how mod action entries appear to the Dev Platform
* Update Dev Platform dependencies

### v1.3.4

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
