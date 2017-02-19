{**
* plugins/generic/markup/templates/convert.tpl
*
* Copyright (c) 2003-2013 John Willinsky
* Distributed under the GNU GPL v2. For full terms see the file docs/COPYING.
*
* Document Markup plugin file convert modal template
* 
*}
<script src="{$pluginJavaScriptURL}/MarkupFileConversionFormHandler.js"></script>

<script type="text/javascript">
	$(function() {ldelim}
		// Attach the form handler.
		$('#markupFileConversionForm').pkpHandler(
			'$.pkp.plugins.markup.js.MarkupFileConversionFormHandler'
		);
	{rdelim});
</script>

{if !$pluginIsConfigured}
	<blockquote>{translate key="plugins.generic.markup.settings.pluginNotConfigured"}</blockquote>
{elseif !$loginCredentialsConfigured}
	<blockquote>{translate key="plugins.generic.markup.settings.loginCredsNotAvailable"}</blockquote>
{else}
	<form id="markupFileConversionForm" class="pkp_form" method="post" action="{$conversionTriggerUrl}">
		<div id="step1">
			<div>{translate key="$messageKey"}</div>
			<button type="submit" id="markupFileConversionTrigger">{translate key="plugins.generic.markup.conversion.trigger"}</button>
		</div>
		<div id="step2">
		</div>
	</form>
{/if}
