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
		options.submitHandler = this.submitForm;
		this.parent($form, options);
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
	 * Callback to handle form submission
	 */
	$.pkp.plugins.markup.js.MarkupFileConversionFormHandler.prototype.
			submitForm = 
			function(validator, formElement) {
				var $form = this.getHtmlElement();
				$.post($form.attr('action'), $form.serialize(),
						this.callbackWrapper(this.handleJobTriggerResponse, this), 'json');
	}

	/**
	 * Callback to handle server response after form submission
	 */
	$.pkp.plugins.markup.js.MarkupFileConversionFormHandler.
			prototype.handleJobTriggerResponse =
			function(formElement, jsonData) {
				var $form = this.getHtmlElement();
				$('div#step1', $form).hide();
				$('div#step2', $form).append(jsonData.content);
				$('.pkp_spinner', $form).addClass('is_visible');

				var jobId = $form.find('span#conversionJobId').text();
				if ((jobId != "") && (this.timer_ == null) ) {
					this.timer_ = setInterval(this.callbackWrapper(this.fetchJobStatus_, this), 5000);
				}
	}

	/**
	 * Callback to fetch xml job status
	 */
	$.pkp.plugins.markup.js.MarkupFileConversionFormHandler.prototype.
			fetchJobStatus_ = 
			function() {
				var self = this;
				$.ajax({
					url: $('span#conversionJobStatus').data('url'),
					type: 'POST',
					dataType: 'json'
				})
				.done(function(data) {
					if (data['content'].hasOwnProperty('status') && data['content'].hasOwnProperty('isCompleted')) {
						if (data['content']['isCompleted']) {
							self.stopAndClear_();
							// job is completed. give backgroud task few seconds to fetch 
							// and save xml document then update job status and refresh grid
							setTimeout(function(){
								self.handleJson(data);
								$('span#conversionJobStatus').text(data['content']['status']);
							}, 3000); 
						}
						else {
							$('span#conversionJobStatus').text(data['content']['status']);
						}
					}
				})
				.fail(function() {
					$('span#conversionJobStatus').text('An unexpected error occured.');
					self.callbackWrapper(self.stopAndClear_(), self);
				});
			}

	/**
	 * stop timer and hide spinner
	 */
	$.pkp.plugins.markup.js.MarkupFileConversionFormHandler.prototype.
			stopAndClear_ = 
			function() {
				var timer = this.timer_;
				clearInterval(timer);
				var $form = this.getHtmlElement();
				$('.pkp_spinner', $form).removeClass('is_visible');
			}

	/** @param {jQuery} $ jQuery closure. */
}(jQuery));