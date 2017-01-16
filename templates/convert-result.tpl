{**
* plugins/generic/markup/templates/convert-result.tpl
*
* Copyright (c) 2003-2013 John Willinsky
* Distributed under the GNU GPL v2. For full terms see the file docs/COPYING.
*
* Document Markup plugin file convert response template
* 
*}
<div class="conversionJob">
	<p>{$message}</p>
	<h3>Conversion job infos</h3>
	<dl>
		<dt>Job Id</dt><dd><span id="conversionJobId">{$jobId|escape}</dd>
		<dt>Job status</dt><dd><span id="conversionJobStatus" data-url="{$conversionJobStatusCheckUrl|escape}">...</span>&nbsp;
		<span id="conversionJobSpinner" class="pkp_spinner"></span></dd>
	</dl>
</div>