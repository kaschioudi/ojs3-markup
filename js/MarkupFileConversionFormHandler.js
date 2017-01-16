/**
 * @file js/MarkupFileConversionFormHandler.js
 *
 * Copyright (c) 2014-2016 Simon Fraser University Library
 * Copyright (c) 2000-2016 John Willinsky
 * Distributed under the GNU GPL v2. For full terms see the file docs/COPYING.
 *
 * @package plugins.generic.markup
 * @class MarkupFileConversionFormHandler
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
	$.pkp.plugins.markup.js.MarkupFileConversionFormHandler =
			function($form, options) {

		this.parent($form, options);
		var that = this;
		
		// on trigger conversion response
		$(document).on('DOMNodeInserted', function(e) {
			
			var $node = $(e.target);
			if ($node.hasClass('conversionJob')) {
				var jobId = $node.find('span#conversionJobId').text();
				if ((jobId != "") && 
						($.pkp.plugins.markup.js.MarkupFileConversionFormHandler.timer_ == null) ) {
					$.pkp.plugins.markup.js.MarkupFileConversionFormHandler.timer_ = setInterval(that.fetchJobStatus_, 5000);
				}
			}
		});
	};
	$.pkp.classes.Helper.inherits(
			$.pkp.plugins.markup.js.MarkupFileConversionFormHandler,
			$.pkp.controllers.form.AjaxFormHandler);
	
	/**
	 * A Number, representing the ID value of the timer that is set.
	 * @private
	 * @type {int}
	 */
	$.pkp.plugins.markup.js.MarkupFileConversionFormHandler.timer_ = null;
	
	/**
	 * Callback to fetch xml job status
	 *
	 * @private
	 */
	$.pkp.plugins.markup.js.MarkupFileConversionFormHandler.prototype.
			fetchJobStatus_ = 
			function() {
				var that = this;
				$.ajax({
					url: $('span#conversionJobStatus').data('url'),
					type: 'POST',
					dataType: 'json'
				})
				.done(function(data) {
					if (data['content'].hasOwnProperty('status') && data['content'].hasOwnProperty('isCompleted')) {
						$('span#conversionJobStatus').text(data['content']['status']);
						if (data['content']['isCompleted']) {
							$.pkp.plugins.markup.js.MarkupFileConversionFormHandler.prototype.stopAndClear_();
						}
					}
				})
				.fail(function() {
					$('span#conversionJobStatus').text('An unexpected error occured.');
					$.pkp.plugins.markup.js.MarkupFileConversionFormHandler.prototype.stopAndClear_();
				});
			}
	
	/**
	 * stop timer and hide spinner
	 *
	 * @private
	 */
	$.pkp.plugins.markup.js.MarkupFileConversionFormHandler.prototype.
			stopAndClear_ = 
			function() {
				var timer = $.pkp.plugins.markup.js.MarkupFileConversionFormHandler.timer_;
				clearInterval(timer);
				$('span#conversionJobSpinner').hide();
			}
			
	/** @param {jQuery} $ jQuery closure. */
}(jQuery));