{**
* plugins/generic/markup/templates/profileSettingsForm.tpl
*
* Copyright (c) 2003-2013 John Willinsky
* Distributed under the GNU GPL v2. For full terms see the file docs/COPYING.
*
* Document Markup plugin user profile settings
* 
*}

<script type="text/javascript">
	$(function() {ldelim}
		// Attach the form handler.
		$('#markupProfileSettingsForm').pkpHandler('$.pkp.controllers.form.AjaxFormHandler');
	{rdelim});
</script>

<form id="markupProfileSettingsForm" class="pkp_form" method="post" action="{url router=$smarty.const.ROUTE_PAGE page='markup' op="profile" save=true}" autocomplete="off">

	{fbvFormArea id="siteAuthArea" title="plugins.generic.markup.settings.userAuthArea"}
		{include file="controllers/notification/inPlaceNotification.tpl" notificationId="ExternalFeedFormNotification"}
	{/fbvFormArea}
	
	{include file="`$templatePath`credentialsForm.tpl"}
	
	{fbvFormButtons id="markupFormSubmit" submitText="common.save" hideCancel=true}

</form>