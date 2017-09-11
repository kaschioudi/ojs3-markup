/**
 * @file js/MarkupSubmissionsBatchConversion.js
 *
 * Copyright (c) 2014-2016 Simon Fraser University Library
 * Copyright (c) 2000-2016 John Willinsky
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
		// submission selection click handler
		$('div#markupBatchConversionGridContainer').on('click', 'input:checkbox[id*="select-"]', function() {
		    var $el = $(this);
		    var isChecked = $el.is(':checked');
		    var $ul = $('ul#submissionListConfirmation');
		    var submissionLabel = $el.closest('tr').find('td:eq(2)').text().replace(/\s+/g, " ");
		    if (isChecked) {
		    	var submissionId = $el.val();
		    	var $submissionFilesElement = $('<ul />');
		        $.get($('input#batchFilesToConvert').val(), {'submissionId': submissionId}, function(data) {
		        	var content = data.content;
		        	if (content) {
		        		if (!content.length) {
		        			$submissionFilesElement.append($('<li><label>No file found!</label></li>'));
		        		}
		        		else {
			        		for (var i = 0; i < content.length; i++) {
			        			var fileId = content[i].fileId;
			        			var filename = content[i].filename;
			        			var stage = content[i].stage;
			        			var fileCheckbox = $('<li class="batch-conversion-submission-file"></li>')
			        				.append('<label><input type="checkbox" class="submission-file"'+ 
			        						'name="submission-file" value="+fileId+"'+
			        						'data-submission-id="'+submissionId+'"'+
			        						'data-file-id="'+fileId+'"'+
			        						'data-stage="'+stage+'"'+
			        						'checked /> '+filename+'</label>');
			        			fileCheckbox.appendTo($submissionFilesElement);
			        				
			        		}
			        		$submissionFilesElement.appendTo($('li[data-submission-id='+submissionId+']'));
		        		}
		        	}
		        }, 'json')
		        .then(function() {
		        	$('<li class="batch-conversion-submission"/>')
		        		.attr('data-submission-id', submissionId)
		        		.text(submissionLabel)
		        		.append($submissionFilesElement)
		        		.appendTo($ul);
		        });
		    }
		    else {
		        $('ul#submissionListConfirmation li[data-submission-id='+$el.val()+']').remove();
		    }
		});

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
			var $next = $('input[class=submission-file]:not(".processed"):checked').first();
			if ($next.length) {
				this.convert($next);
			}
	}

	/**
	 * Trigger file conversion
	 * 
	 * @param {jQueryObject} $element input checkbox representing submission file
	 */
	$.pkp.plugins.markup.js.MarkupSubmissionsBatchConversion.prototype.convert = 
		function($element) {
			this.$listElement = $element.closest('li');
			this.$listElement.addClass('batch-processing');
			var params = {
				'submissionId': $element.data('submission-id'),
				'stage': $element.data('stage'),
				'fileId': $element.data('file-id'),
			};
			var postUrl = $('input#conversionTriggerUrl').val() +
							'?submissionId='+$element.data('submission-id')+
							'&stage='+$element.data('stage')+
							'&fileId='+$element.data('file-id')+
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