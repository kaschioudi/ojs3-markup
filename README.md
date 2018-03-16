Markup plugin for OJS3
======================

About
-----

This allows OJS to work with PKP’s [Open Typesetting Stack](https://pkp.sfu.ca/open-typesetting-stack/) for transforming Word and PDF articles to JATS XML.

System Requirements
-------------------

PHP cURL, PHP Zlib, PHP JSON

Versions
--------

Works with OJS 3 or greater

Installation
------------

-   Clone the plugin contents into the plugins/generic folder (e.g. plugins/generic/markup). If not doing this before installing OJS, you will need to then run `php tools/upgrade.php upgrade` or `php tools/dbXMLtoSQL.php -schema execute plugins/generic/markup/schema.xml`.

Usage
-----

First, you’ll have to install and configure the plugin. To do this, after creating a journal, go to your user home by clicking your name in the top-right corner of the page, then to "Settings" -\> "Website" in the sidebar, and finally "Plugins" from the top of the Settings menu. The Open Typesetting Stack plugin should be listed under "Generic Plugins".

![](https://github.com/kaschioudi/ojs3-markup/blob/master/readme-images/plugins.png?raw=true)

Enable it, then refresh the page, and you should see a new "OTS Settings" menu entry at the top. Click through.

If this is your first time using OTS, you'll want to open a new browser tab and head over to our demonstration instance at <http://pkp-xml-demo.lib.sfu.ca/> at this point to sign up. You can upload jobs to the OTS stack directly from this page, but what you’ll want to do to use the functionality in OJS is get an API key for integration. You can do this by going to your Settings menu in the top-right corner of the OTS interface after registering and logging in, and then clicking "Generate Token" under API Authentication.

![](https://github.com/kaschioudi/ojs3-markup/blob/master/readme-images/otsapikey.png?raw=true)

Once you've got a token, you can pop back over to OJS, to the OTS Settings menu. Here, you'll want to plug in the API token you just registered, as well as configuring how you want OTS to work for your journal. You can choose a citation style for all OTS output, choose the OJS editing stages that XML conversion and editing are available in, and select the output galley formats that you want OTS to produce when you're ready to publish.

![](https://github.com/kaschioudi/ojs3-markup/blob/master/readme-images/otssettings.png?raw=true)

After finishing with configuration, you're ready to actually use the plugin. After an author submits an article, click through to the submission, and you can use the first of the new OTS features: the option to automatically convert any Word or PDF articles to XML.

![](https://github.com/kaschioudi/ojs3-markup/blob/master/readme-images/convert.png?raw=true)

This option will only be available for all workflow stages (Submission, Review, Copyediting, Production) that you've enabled in the plugin settings menu; by default, they're all enabled, but some journals may want to restrict them to only certain stages.

![](https://github.com/kaschioudi/ojs3-markup/blob/master/readme-images/complete.png?raw=true)

After the job is complete, you should see an XML version of the same article available alongside the Word or PDF document that was originally uploaded, with another new hook: the ability to directly edit the article XML in the browser, with the *Texture* web app.

![](https://github.com/kaschioudi/ojs3-markup/blob/master/readme-images/edit.png?raw=true)

​[Texture](https://github.com/substance/texture) is a WYSIWYG, user-friendly, native JATS XML editor. Users who don't want to think about XML never have to, but are still deliberately constrained by the JATS spec when making changes to the document, so that (unlike when editing with Word), they can publish directly from here. For expert users who *are *interested in tweaking XML, or for anyone wanting to add a JATS element that is not yet implemented in the WYSIWYG, you can do this with the "Insert" button in the top bar. More and more JATS elements will be added over time so that they are rendered natively, and at the same time Texture will incorporate different custom views offering expert users greater ease of use when directly editing XML.

The save behaviour in Texture is also currently incomplete -- our plan is for it to eventually act like Google Docs wherein all changes are saved automatically, with the save button in the top bar acting as a "Save as" button, when you want to register a new draft of the article in OJS. Currently, though, you need to use that button to save, and "save as" isn't there yet.

![](https://github.com/kaschioudi/ojs3-markup/blob/master/readme-images/texture.png?raw=true)

Once you're done editing the document, you can move along to the final production stage of the workflow. Similar to the initial XML conversion, on the Production tab you'll have the option to **generate galley files** from any Word, PDF, or XML documents that you've brought forward from earlier workflow stages.

![](https://github.com/kaschioudi/ojs3-markup/blob/master/readme-images/galley.png?raw=true)

This will submit another job to OTS, which will return production-ready galley files in the formats that you selected on the plugin settings page:

![](https://github.com/kaschioudi/ojs3-markup/blob/master/readme-images/galleys.png?raw=true)

​From here, you can go directly to publication.


Backlog Conversion
-----

Additionally, if your journal has already been publishing Word or PDF articles and you want to convert them to JATS XML in bulk (with the understanding that this will probably not produce an ideal result on its own), you can do so by navigating to the "OTS Backlog convesrsion" tab of the settings menu, selecting the files you want to convert, and clicking "Start conversion".

![](https://github.com/kaschioudi/ojs3-markup/blob/master/readme-images/backlog.png?raw=true)

You can also perform bulk conversion via the command line, using the provided `batch.php` in the plugin folder:

    $ ./batch.php
    Usage: 
         ./batch.php [user_name] <journal name>                 Batch convert a specific journal enabled
         ./batch.php [user_name] [--all]                        Batch convert all enabled journals
         ./batch.php [--print]                                  Prints the list of all enabled journals
         ./batch.php [user_name] [--list] <list of journals>    Batch convert a comma separated list of journals

The tool should generally be run as your webserver user (e.g. `www-data` or `apache`) so that it has access to OJS' cache and other dependencies. The `[user_name]` specified on the command line should be an OJS admin who has access to all of the journals that are to be converted. By default, this CLI tool will only convert articles which *have already been published* (it will use PDF galleys as conversion input when they are available), as it's primarily intended to generate JATS XML for indexing or deposit purposes; users wanting to create XML for production and reader views should use the full Texture workflow above.

Finally, when using the CLI tool you can also store OTS configuration settings in OJS' `config.inc.php` master file if you haven't configured the plugin from the settings menu in OJS, by adding a block like so:

    ;;;;;;;;;;;;;;;;;;
    ; Markup plugin  ;
    ;;;;;;;;;;;;;;;;;;
    
    [markup]
    
    ; OTS email address used for login.
    ots_login_email = ''
    
    ; Token for OTS API authentication. Get this token from your OTS settings page.
    ots_api_token = '' 
    
    ; Open Typesetting Stack instance to connect to. Normally you should not change this setting.
    ots_host = 'http://pkp-xml-demo.lib.sfu.ca'
    
    ; Preferred citation style for PDF and ePub output (see OTS readme).
    ots_citation_style_hash = '3f0f7fede090f24cc71b7281073996be'


Contact/Support
---------------

garnett\@sfu.ca for any issues, or open an issue on this repo!
