{**
 * plugins/generic/markup/templates/credentialsForm.tpl
 *
 * Copyright (c) 2014-2018 Simon Fraser University
 * Copyright (c) 2003-2018 John Willinsky
 * Distributed under the GNU GPL v2. For full terms see the file docs/COPYING.
 *
 * Document Markup XML server credentials fields
 *}

{fbvFormSection for="markupHostUser " title="plugins.generic.markup.settings.markupHostUser"}
	{fbvElement type="text" id="markupHostUser" value=$markupHostUser}
{/fbvFormSection}

{fbvFormSection title="plugins.generic.markup.settings.markupHostPass"}
	{fbvElement type="text" id="markupHostPass" value=$markupHostPass}
{/fbvFormSection}
