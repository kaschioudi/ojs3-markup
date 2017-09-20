{**
 * templates/batchConversion.tpl
 *
 * Copyright (c) 2014-2017 Simon Fraser University
 * Copyright (c) 2003-2017 John Willinsky
 * Distributed under the GNU GPL v2. For full terms see the file docs/COPYING.
 *
 * displays submissions along with submission files.
 *}
<div>
	<div class="pkp_form">
		<fieldset>
			<label class="description">{translate key="plugins.generic.markup.batch.selected-submissions"}</label>
			<input type="hidden" id="batchFilesToConvert" name="batchFilesToConvert" value="{$batchFilesToConvert|escape}" />
			<input type="hidden" id="conversionTriggerUrl" name="conversionTriggerUrl" value="{$conversionTriggerUrl|escape}" />
			<ul id="submissionListConfirmation">
			{foreach from=$submissions item=submission}
				<li class="batch-conversion-submission">
					#{$submission.id|escape} 
					{$submission.title|escape} <br>
					<select 
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
			<div id="conversion-status" style="display:none;">
				<p>
					<strong><span id="conversion-status-processed"></span></strong> processed out of 
					<strong><span id="conversion-status-total"></span></strong> submissions.
				</p>
			</div>
			<button id="startConversionBtn">{translate key="plugins.generic.markup.batch.trigger-label"}</button>
		</fieldset>
	</div>
</div>
<script type="text/javascript">
	$(function() {ldelim}
		$.pkp.plugins.markup.js.MarkupSubmissionsBatchConversion();
	{rdelim});
</script>

