{**
* plugins/generic/markup/templates/settingsForm.tpl
*
* Copyright (c) 2003-2013 John Willinsky
* Distributed under the GNU GPL v2. For full terms see the file docs/COPYING.
*
* Document Markup gateway plugin settings
* TODO
*}
<script src="{$pluginJavaScriptURL}/MarkupSettingsFormHandler.js"></script>

<script type="text/javascript">
	$(function() {ldelim}
		// Attach the form handler.
		$('#markupSettingsForm').pkpHandler(
			'$.pkp.plugins.markup.js.MarkupSettingsFormHandler',
			{ldelim}
				cslStyleSelection: '{$cslStyle|escape}',
				selectedAuthType: '{$authType|escape}'
			{rdelim}
		);
	{rdelim});
</script>

<form id="markupSettingsForm" class="pkp_form" method="post" action="{url router=$smarty.const.ROUTE_PAGE op="settings" save=true}"  enctype="multipart/form-data" autocomplete="off">
	
	{include file="controllers/notification/inPlaceNotification.tpl" notificationId="MarkupSettingsFormNotification"}
	
	
	{fbvFormSection description="plugins.generic.markup.settings.markupHostAccountHelp"}{/fbvFormSection}
	
	{fbvFormSection list=true title="plugins.generic.markup.settings.authType" description="plugins.generic.markup.settings.authTypeFieldHelp"}
		{if $authType eq 'site'}
			 {assign var="siteChecked" value=true}
			 {assign var="userChecked" value=false}
		{else}
			{assign var="siteChecked" value=false}
			{assign var="userChecked" value=true}
		{/if}
		{fbvElement type="radio" name="authType" id="authTypeSite" value="site" label="plugins.generic.markup.settings.authTypeSite" checked=$siteChecked}
		{fbvElement type="radio" name="authType" id="authTypeUser" value="user" label="plugins.generic.markup.settings.authTypeUser" checked=$userChecked}
	{/fbvFormSection}
	
	{fbvFormArea id="siteAuthArea" title="plugins.generic.markup.settings.siteAuthArea"}
		{include file="`$templatePath`credentialsForm.tpl"}
	{/fbvFormArea}
	
	{fbvFormSection title="plugins.generic.markup.settings.markupHostURL" description="plugins.generic.markup.settings.markupHostURLHelp"}
		{fbvElement type="text" id="markupHostURL" value=$markupHostURL|escape class="markupHostURL"}
	{/fbvFormSection}
	
	{fbvFormSection list=true description="plugins.generic.markup.settings.conversionStages" description="plugins.generic.markup.settings.conversionStagesHelp"}
		{fbvElement type="checkbox" name="xmlConversionStages[]" id="conversionSubmissionStage" value=$smarty.const.WORKFLOW_STAGE_ID_SUBMISSION label="manager.publication.submissionStage" checked=$smarty.const.WORKFLOW_STAGE_ID_SUBMISSION|@in_array:$xmlConversionStages}
		{fbvElement type="checkbox" name="xmlConversionStages[]" id="conversionReviewStage" value=$smarty.const.WORKFLOW_STAGE_ID_EXTERNAL_REVIEW label="manager.publication.reviewStage" checked=$smarty.const.WORKFLOW_STAGE_ID_EXTERNAL_REVIEW|@in_array:$xmlConversionStages}
		{fbvElement type="checkbox" name="xmlConversionStages[]" id="conversionEditorialStage" value=$smarty.const.WORKFLOW_STAGE_ID_EDITING label="manager.publication.editorialStage" checked=$smarty.const.WORKFLOW_STAGE_ID_EDITING|@in_array:$xmlConversionStages}
		{fbvElement type="checkbox" name="xmlConversionStages[]" id="conversionProductionStage" value=$smarty.const.WORKFLOW_STAGE_ID_PRODUCTION label="manager.publication.productionStage" checked=$smarty.const.WORKFLOW_STAGE_ID_PRODUCTION|@in_array:$xmlConversionStages}
	{/fbvFormSection}

	{fbvFormSection list=true description="plugins.generic.markup.settings.editWithSubstanceStages" description="plugins.generic.markup.settings.editWithSubstanceStagesHelp"}
		{fbvElement type="checkbox" name="editWithSubstanceStages[]" id="editWithSubstanceSubmissionStage" value=$smarty.const.WORKFLOW_STAGE_ID_SUBMISSION label="manager.publication.submissionStage" checked=$smarty.const.WORKFLOW_STAGE_ID_SUBMISSION|@in_array:$editWithSubstanceStages}
		{fbvElement type="checkbox" name="editWithSubstanceStages[]" id="editWithSubstanceReviewStage" value=$smarty.const.WORKFLOW_STAGE_ID_EXTERNAL_REVIEW label="manager.publication.reviewStage" checked=$smarty.const.WORKFLOW_STAGE_ID_EXTERNAL_REVIEW|@in_array:$editWithSubstanceStages}
		{fbvElement type="checkbox" name="editWithSubstanceStages[]" id="editWithSubstanceEditorialStage" value=$smarty.const.WORKFLOW_STAGE_ID_EDITING label="manager.publication.editorialStage" checked=$smarty.const.WORKFLOW_STAGE_ID_EDITING|@in_array:$editWithSubstanceStages}
		{fbvElement type="checkbox" name="editWithSubstanceStages[]" id="editWithSubstanceProductionStage" value=$smarty.const.WORKFLOW_STAGE_ID_PRODUCTION label="manager.publication.productionStage" checked=$smarty.const.WORKFLOW_STAGE_ID_PRODUCTION|@in_array:$editWithSubstanceStages}
	{/fbvFormSection}

	{fbvFormSection title="plugins.generic.markup.settings.cslStyle" description="plugins.generic.markup.settings.cslStyleFieldHelp"}
		{fbvElement type="select" id="cslStyle"}
	{/fbvFormSection}
	
	{if 'xml'|in_array:$wantedFormats}
		{assign var="markupDocFormatXmlChecked" value=true}
	{else}
		{assign var="markupDocFormatXmlChecked" value=false}
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
		{fbvElement type="checkbox" name="wantedFormats[]" id="markupDocFormatPdf" value="pdf" label="plugins.generic.markup.settings.wantedFormatsPDF" checked=$markupDocFormatPdfChecked}
		{fbvElement type="checkbox" name="wantedFormats[]" id="markupDocFormatEpub" value="epub" label="plugins.generic.markup.settings.wantedFormatsEPUB" checked=$markupDocFormatEpubChecked}
	{/fbvFormSection}

	{fbvFormButtons id="markupFormSubmit" submitText="common.save" hideCancel=true}
	
</form>
