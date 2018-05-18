{**
 * templates/batchConversion.tpl
 *
 * Copyright (c) 2014-2018 Simon Fraser University
 * Copyright (c) 2003-2018 John Willinsky
 * Distributed under the GNU GPL v2. For full terms see the file docs/COPYING.
 *
 * displays submissions along with submission files.
 *}
<div>
	<div class="pkp_form">
	<form id="batchConversionForm" action="{$startConversionUrl|escape}" method="post">
		<fieldset>
			<label class="description">{translate key="plugins.generic.markup.batch.selected-submissions"}</label>

			{if $batchConversionIsRunning}
			<div id="conversion-status" class="batch-processing" data-status-url="{$batchConversionStatusUrl|escape}">
				<span id="conversionJobSpinner" class="pkp_spinner is_visible"></span>
				<div class="output">
					<p>{translate key="common.loading"}</p>
				</div>
				<div style="float:right;position:relative;">
					<button 
						class="batch-cancel-conversion"
						id="stopConversionBtn" 
						type="submit"
						data-cancel-url="{$cancelConversionUrl|escape}">
						{translate key="plugins.generic.markup.batch.cancel-label"}
					</button>
				</div>
				<p>&nbsp;</p>
			</div>
			{/if}

			<ul id="submissionListConfirmation">
			{foreach from=$submissions item=submission}
				<li class="batch-conversion-submission">
					#{$submission.id|escape} 
					{$submission.title|escape} <br>
					<select 
						id="submission_{$submission.id|escape}"
						name="submission_{$submission.id|escape}"
						class="submission-file" 
						data-submission-id="{$submission.id|escape}" 
						data-stage="{$submission.stage|escape}">
						<option value="-1">{translate key="plugins.generic.markup.batch-select-file"}</option>
						{foreach from=$submission.files item=submissionFile}
							<option value="{$submissionFile.fileId|escape}" data-file-id="{$submissionFile.fileId|escape}"
								{if $submission.defaultSubmissionFileId == $submissionFile.fileId} selected="selected" {/if}>
								[{$submissionFile.fileStage|escape}] {$submissionFile.filename|escape}
							</option>
						{/foreach}
					</select>
				</li>
			{/foreach}
			</ul>
			{if !$batchConversionIsRunning}
				<button id="startConversionBtn" type="submit">{translate key="plugins.generic.markup.batch.trigger-label"}</button>
			{/if}
		</fieldset>
	</form>
	</div>
</div>
<script type="text/javascript">
	$(function() {ldelim}
		// Attach the form handler.
		$('#batchConversionForm').pkpHandler(
			'$.pkp.plugins.markup.js.MarkupSubmissionsBatchConversionFormHandler'
		);
	{rdelim});
</script>

