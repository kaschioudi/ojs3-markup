{**
* plugins/generic/markup/templates/settingsForm.tpl
*
* Copyright (c) 2003-2013 John Willinsky
* Distributed under the GNU GPL v2. For full terms see the file docs/COPYING.
*
* Document Markup gateway plugin settings
* TODO
*}

{$additionalHeadData}
<script type="text/javascript">
    $(function() {ldelim}
        // Attach the form handler.
        $('#markupSettingsForm').pkpHandler(
            '$.pkp.plugins.markup.js.MarkupSettingsFormHandler',
            {ldelim}
                cslStyleSelection: '{$cslStyle|escape}'
            {rdelim}
        );
    {rdelim});
</script>

<form id="markupSettingsForm" class="pkp_form" method="post" action="{url router=$smarty.const.ROUTE_COMPONENT op="plugin" category="generic" plugin=$pluginName verb="save"}"  enctype="multipart/form-data" autocomplete="off">
    
    {include file="controllers/notification/inPlaceNotification.tpl" notificationId="MarkupSettingsFormNotification"}
    
    
    {fbvFormSection description="plugins.generic.markup.settings.markupHostAccountHelp"}{/fbvFormSection}
    
    {fbvFormSection for="markupHostUser " title="plugins.generic.markup.settings.markupHostUser"}
        {fbvElement type="text" id="markupHostUser" value=$markupHostUser|escape}
    {/fbvFormSection}
    
    {fbvFormSection title="plugins.generic.markup.settings.markupHostPass"}
        {fbvElement type="text" password=true id="markupHostPass" value=$markupHostPass|escape}
    {/fbvFormSection}
    
    
    {fbvFormSection title="plugins.generic.markup.settings.markupHostURL" description="plugins.generic.markup.settings.markupHostURLHelp"}
        {fbvElement type="text" id="markupHostURL" value=$markupHostURL|escape class="markupHostURL"}
    {/fbvFormSection}
    
    {fbvFormSection title="plugins.generic.markup.settings.cslStyle" description="plugins.generic.markup.settings.cslStyleFieldHelp"}
        {fbvElement type="select" id="cslStyle"}
    {/fbvFormSection}
    
    {if $overrideGalley eq false}
        {assign var="noChecked" value=true}
        {assign var="yesChecked" value=false}
    {else}
        {assign var="noChecked" value=false}
        {assign var="yesChecked" value=true}
    {/if}
    {fbvFormSection list=true description="plugins.generic.markup.settings.overrideGalley" description="plugins.generic.markup.settings.overrideGalleyFieldHelp"}
        {fbvElement type="radio" name="overrideGalley" id="overrideGalleyNo" value="0" label="plugins.generic.markup.settings.overrideGalleyNo" checked=$noChecked}
        {fbvElement type="radio" name="overrideGalley" id="overrideGalleyYes" value="1" label="plugins.generic.markup.settings.overrideGalleyYes" checked=$yesChecked}
    {/fbvFormSection}
    
    {if 'xml'|in_array:$wantedFormats}
        {assign var="markupDocFormatXmlChecked" value=true}
    {else}
        {assign var="markupDocFormatXmlChecked" value=false}
    {/if}
    
    {if 'html'|in_array:$wantedFormats}
        {assign var="markupDocFormatHtmlChecked" value=true}
    {else}
        {assign var="markupDocFormatHtmlChecked" value=false}
    {/if}
    
    {if 'pdf'|in_array:$wantedFormats}
        {assign var="markupDocFormatPdfChecked" value=true}
    {else}
        {assign var="markupDocFormatPdfChecked" value=false}
    {/if}
    
    {if 'epub'|in_array:$wantedFormats}
        {assign var="markupDocFormatEpubChecked" value=true}
    {else}
        {assign var="markupDocFormatEpubChecked" value=false}
    {/if}
    
    {fbvFormSection list=true description="plugins.generic.markup.settings.wantedFormats" description="plugins.generic.markup.settings.wantedFormatsHelp"}
        {fbvElement type="checkbox" name="wantedFormats[]" id="markupDocFormatXml" value="xml" label="plugins.generic.markup.settings.wantedFormatsXML" checked=$markupDocFormatXmlChecked}
        {fbvElement type="checkbox" name="wantedFormats[]" id="markupDocFormatHtml" value="html" label="plugins.generic.markup.settings.wantedFormatsHTML" checked=$markupDocFormatHtmlChecked}
        {fbvElement type="checkbox" name="wantedFormats[]" id="markupDocFormatPdf" value="pdf" label="plugins.generic.markup.settings.wantedFormatsPDF" checked=$markupDocFormatPdfChecked}
        {fbvElement type="checkbox" name="wantedFormats[]" id="markupDocFormatEpub" value="epub" label="plugins.generic.markup.settings.wantedFormatsEPUB" checked=$markupDocFormatEpubChecked}
    {/fbvFormSection}

    <dl>
        <dt>{fieldLabel key="plugins.generic.markup.settings.curlSupport"}</dt>
        <dd><strong>{$curlSupport|escape}</strong><br/>{translate key="plugins.generic.markup.settings.curlSupportHelp"}</dd>
        
        <dt>{fieldLabel key="plugins.generic.markup.settings.zipSupport"}</dt>
        <dd><strong>{$zipSupport|escape}</strong><br/>{translate key="plugins.generic.markup.settings.zipSupportHelp"}</dd>
        
        <dt>{fieldLabel key="plugins.generic.markup.settings.pathInfo"}</dt>
        <dd><strong>{$pathInfo|escape}</strong><br/>{translate key="plugins.generic.markup.settings.pathInfoHelp"}</dd>
    </dl>
    
    {fbvFormButtons id="markupFormSubmit" submitText="common.save" hideCancel=true}
    
</form>
