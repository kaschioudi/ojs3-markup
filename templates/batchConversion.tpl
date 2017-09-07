{**
 * templates/batchConversion.tpl
 *
 * Copyright (c) 2014-2016 Simon Fraser University Library
 * Copyright (c) 2003-2016 John Willinsky
 * Distributed under the GNU GPL v2. For full terms see the file docs/COPYING.
 *
 * markup plugin -- displays the ArticlesGrid.
 *}
 <link rel="stylesheet" href="{$pluginCssURL}/batch.css" />
<div>
	{url|assign:markupBatchConversionGridUrl router=$smarty.const.ROUTE_COMPONENT component="plugins.generic.markup.controllers.grid.MarkupBatchConversionGridHandler" op="fetchGrid" escape=false}
	{load_url_in_div id="markupBatchConversionGridContainer" url=$markupBatchConversionGridUrl}
	<div class="pkp_form">
		<fieldset>
			<legend>Selected submissions</legend>
			<label class="description">Aenean vel ante id ante tristique tristique. Ut at mollis velit. Curabitur ornare ornare malesuada. Vestibulum elit leo, tempor vitae posuere ut, dapibus vitae nisi. Aenean tristique dapibus posuere. Ut eget tortor quis ipsum vestibulum finibus. Nullam ornare bibendum magna. Phasellus a quam tortor.</label>
			<input type="hidden" id="batchFilesToConvert" name="batchFilesToConvert" value="{$batchFilesToConvert}" />
			<input type="hidden" id="conversionTriggerUrl" name="conversionTriggerUrl" value="{$conversionTriggerUrl}" />
			<ul id="submissionListConfirmation"></ul>
			<button id="startConversionBtn">{translate key="plugins.generic.markup.batch.trigger-label"}</button>
		</fieldset>
	</div>
</div>
<script src="{$pluginJavaScriptURL}/MarkupSubmissionsBatchConversion.js"></script>
<script type="text/javascript">
	$(function() {ldelim}
		$.pkp.plugins.markup.js.MarkupSubmissionsBatchConversion();
	{rdelim});
</script>

