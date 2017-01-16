/**
 * @file js/MarkupSettingsFormHandler.js
 *
 * Copyright (c) 2014-2016 Simon Fraser University Library
 * Copyright (c) 2000-2016 John Willinsky
 * Distributed under the GNU GPL v2. For full terms see the file docs/COPYING.
 *
 * @package plugins.generic.markup
 * @class MarkupSettingsFormHandler
 *
 * @brief Markup plugin settings form handler.
 */
(function($) {
	
	/** @type {Object} */
	$.pkp.plugins.markup =
			$.pkp.plugins.markup ||
			{ js: { } };
			
	/**
	 * @constructor
	 *
	 * @extends $.pkp.controllers.form.AjaxFormHandler
	 *
	 * @param {jQueryObject} $form the wrapped HTML form element.
	 * @param {Object} options form options.
	 */
	$.pkp.plugins.markup.js.MarkupSettingsFormHandler =
			function($form, options) {

		this.parent($form, options);

		this.callbackWrapper(this.loadCitationStyles_(options.cslStyleSelection));

		this.selectedAuthType = options.selectedAuthType;
		this.setSiteAuthAreaVisibility_();

		$form.find('input[type=radio][name=authType]').change(this.callbackWrapper(this.showHideSiteAuth));
	};
	$.pkp.classes.Helper.inherits(
			$.pkp.plugins.markup.js.MarkupSettingsFormHandler,
			$.pkp.controllers.form.AjaxFormHandler);

	/**
	 * Selected authentication type
	 * @private
	 * @type {string}
	 */
	$.pkp.plugins.markup.js.MarkupSettingsFormHandler
			.selectedAuthType = null;

	/**
	 * Callback to initialize citation list
	 *
	 * @private
	 */
	$.pkp.plugins.markup.js.MarkupSettingsFormHandler.prototype.
			loadCitationStyles_ = 
			function(cslStyleSelection) {

				var url = $('input[name=markupHostURL]').val();

				// stop here if host url not available
				if (url == '')
					return;

				var $cslStyleSelector = $('select[name=cslStyle]');

				url = $.trim(url).replace(/\/$/, '') + '/api/job/citationStyleList';

				// remove all options
				$cslStyleSelector.children('option').each(function() { this.remove(); });

				$.ajax({
					url: url,
					type: 'GET',
					dataType: 'json',
					success: function(data){ 
						if (!data.citationStyles) 
							return;

						var $option = null;
						var citationStyles = data.citationStyles;
						for (var hash in citationStyles) {
							if (citationStyles.hasOwnProperty(hash)) {
								$option = $('<option></option>').attr('value', hash).text(citationStyles[hash]);

								if (cslStyleSelection == hash) {
									$option.attr('selected', 'selected');
								}

								$cslStyleSelector.append($option);
							}
						}
					},
					error: function() {
						alert('Unable to fetch citation styles');
					}
				});

			}

	/**
	 * Callback to show/hide site wide login credentials form
	 *
	 * @private
	 */
	$.pkp.plugins.markup.js.MarkupSettingsFormHandler.prototype.
			showHideSiteAuth = 
			function() {
				this.selectedAuthType = $('input[type=radio][name=authType]:checked').val()
				this.setSiteAuthAreaVisibility_();
			} 

	/**
	 * Adjust the display of the site authentication form
	 *
	 * @private
	 */
	$.pkp.plugins.markup.js.MarkupSettingsFormHandler.prototype.
			setSiteAuthAreaVisibility_ = 
			function() {
				if (this.selectedAuthType == 'site') {
					$('#siteAuthArea').fadeIn('slow');
				}
				else {
					$('#siteAuthArea').fadeOut('fast');
				}
			} 
	
	/** @param {jQuery} $ jQuery closure. */
}(jQuery));