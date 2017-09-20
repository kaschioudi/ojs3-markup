/**
 * @file js/MarkupSubmissionsBatchConversion.js
 *
 * Copyright (c) 2014-2017 Simon Fraser University
 * Copyright (c) 2000-2017 John Willinsky
 * Distributed under the GNU GPL v2. For full terms see the file docs/COPYING.
 *
 * @package plugins.generic.markup
 * @class MarkupSubmissionsBatchConversion
 *
 * @brief Batch conversion client side handler
 */
(function($) {

	/** @type {Object} */
	$.pkp.plugins.markup =
			$.pkp.plugins.markup ||
			{ js: { } };

	/**
	 * @constructor
	 */
	$.pkp.plugins.markup.js.MarkupSubmissionsBatchConversion = function() {

		// batch conversion button click handler
		$('div.pkp_form button#startConversionBtn').click(function() {
			$(this).attr('disabled','disabled').hide();
			$.pkp.plugins.markup.js.MarkupSubmissionsBatchConversion.prototype.processFile();
		});
	};

	/**
	 * A Number, representing the ID value of the timer that is set.
	 * @private
	 * @type {int}
	 */
	$.pkp.plugins.markup.js.MarkupSubmissionsBatchConversion.timer = null;

	/**
	 * A jQuery element.
	 * @private
	 * @type {jQueryObject}
	 */
	$.pkp.plugins.markup.js.MarkupSubmissionsBatchConversion.$listElement = null;

	/**
	 * Determine which file to convert
	 */
	$.pkp.plugins.markup.js.MarkupSubmissionsBatchConversion.prototype.processFile = 
		function() {
			this.conversionStatus();
			var $next = $('select[class=submission-file]:not(".processed")').first();
			if ($next.length) {
				this.convert($next);
			}
	}

	/**
	 * Display numbers of submissions processed and to be processed
	 */
	$.pkp.plugins.markup.js.MarkupSubmissionsBatchConversion.prototype.conversionStatus = 
		function() {
			$('div#conversion-status').show();
			var processedCount = $('select[class="submission-file processed"]').size();
			var totalCount = $('ul#submissionListConfirmation select').size();
			$('span#conversion-status-processed').text(processedCount);
			$('span#conversion-status-total').text(totalCount);
	}

	/**
	 * Trigger file conversion
	 * 
	 * @param {jQueryObject} $element input checkbox representing submission file
	 */
	$.pkp.plugins.markup.js.MarkupSubmissionsBatchConversion.prototype.convert = 
		function($element) {
			$element.addClass('processed');
			this.$listElement = $element.closest('li');
			this.$listElement.addClass('batch-processing');
			var params = {
				'submissionId': $element.data('submission-id'),
				'stage': $element.data('stage'),
				'fileId': parseInt($element.val()),
			};

			if (params.fileId != -1) {
				var postUrl = $('input#conversionTriggerUrl').val() +
					'?submissionId='+params.submissionId+
					'&stage='+params.stage+
					'&fileId='+params.fileId+
					'&target=galley-generate';

				var that = this;
				$.post(postUrl, {}, function(data) {
					that.$listElement.append(data.content);
					$('.pkp_spinner', that.$listElement).addClass('is_visible');
					var jobId = that.$listElement.find('span#conversionJobId').text();
					if ((jobId != "") && (that.timer == null) ) {
						that.timer = setInterval(function() { that.fetchJobStatus.apply(that); }, 5000);
					}
				}, 'json');
			}
			else {
				this.processFile();
			}
	}

	/**
	 * Callback to fetch xml job status
	 */
	$.pkp.plugins.markup.js.MarkupSubmissionsBatchConversion.prototype.fetchJobStatus = 
		function() {
			var self = this;
			$.ajax({
				url: $('span#conversionJobStatus', this.$listElement).data('url'),
				type: 'POST',
				dataType: 'json',
				success: function(data) {
					if (data['content'].hasOwnProperty('status') && data['content'].hasOwnProperty('isCompleted')) {
						if (data['content']['isCompleted']) {
							self.stopAndClear();
							$('span#conversionJobStatus').text(data['content']['status']);
							self.$listElement.removeClass('batch-processing').addClass('batch-success');
							$('input[class=submission-file]', self.$listElement).addClass('processed');
							self.processFile();
						}
						else {
							$('span#conversionJobStatus', self.$listElement).text(data['content']['status']);
						}
					}
				},
				error: function() {
					self.$listElement.removeClass('batch-processing').addClass('batch-failure');
					$('span#conversionJobStatus', self.$listElement).text('An unexpected error occured.');
					self.stopAndClear();
					self.processFile();
				}
			});
	}

	/**
	 * stop timer and hide spinner
	 */
	$.pkp.plugins.markup.js.MarkupSubmissionsBatchConversion.prototype.stopAndClear = 
		function() {
			$('.pkp_spinner', this.$listElement).removeClass('is_visible');
			clearInterval(this.timer);
			this.timer = null;
	}

}(jQuery));