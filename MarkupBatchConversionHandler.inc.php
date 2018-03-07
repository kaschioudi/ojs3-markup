<?php

/**
 * @file plugins/generic/markup/MarkupBatchConversionHandler.inc.php
 *
 * Copyright (c) 2003-2017 Simon Fraser University
 * Copyright (c) 2003-2017 John Willinsky
 * Distributed under the GNU GPL v2. For full terms see the file docs/COPYING.
 *
 * @class MarkupBatchConversionHandler
 * @ingroup plugins_generic_markup
 *
 * @brief Handles request for articles batch conversion.
 */

import('classes.handler.Handler');

class MarkupBatchConversionHandler extends Handler {
	/** @var MarkupPlugin The Document markup plugin */
	protected $_plugin = null;

	/**
	 * Constructor
	 */
	public function __construct() {
		parent::__construct();

		// set reference to markup plugin
		$this->_plugin = PluginRegistry::getPlugin('generic', 'markupplugin');

		$this->addRoleAssignment(
			array(ROLE_ID_MANAGER),
			array('filesToConvert', 'startConversion', 'fetchConversionStatus', 'cancelConversion')
		);
	}

	/**
	 * @copydoc PKPHandler::authorize()
	 */
	function authorize($request, &$args, $roleAssignments) {
		$op = $request->getRouter()->getRequestedOp($request);

		if($op == 'filesToConvert') {
			import('lib.pkp.classes.security.authorization.SubmissionAccessPolicy');
			$this->addPolicy(new SubmissionAccessPolicy($request, $args, $roleAssignments));
		}

		return parent::authorize($request, $args, $roleAssignments);
	}

	/**
	 * Provides the list of files to batch convert given a submission
	 * @param $args array
	 * @param $request PKPRequest
	 * 
	 * @return JSONMessage
	 */
	 public function filesToConvert($args, $request) {
	 	$context = $request->getContext();
	 	$submission = $this->getAuthorizedContextObject(ASSOC_TYPE_SUBMISSION);
		$genreDao = DAORegistry::getDAO('GenreDAO');
	 	$submissionFileDao = DAORegistry::getDAO('SubmissionFileDAO');
	 	$filesToConvert = array();
	 	$validFileExtensions = array('pdf','doc','docx');
 		$submissionFiles = $submissionFileDao->getLatestRevisions($submission->getId());
 		foreach ($submissionFiles as $submissionFile) {
 			$genre = $genreDao->getById($submissionFile->getGenreId());
 			if (intval($genre->getCategory()) != GENRE_CATEGORY_DOCUMENT) 
 				continue;
 			if (intval($genre->getDependent()) != 0) 
 				continue;
 			if (!in_array(strtolower($submissionFile->getExtension()), $validFileExtensions)) 
 				continue;
 			$filesToConvert[] = array(
 				'fileId' 	=> $submissionFile->getFileId(),
 				'stage'		=> $submission->getStageId(),
 				'filename'	=> $submissionFile->getName(AppLocale::getLocale()),
 			);
 		}
	 	return new JSONMessage(true, $filesToConvert);
	}

	/**
	 * trigger batch conversion
	 * @param $args array
	 * @param $request PKPRequest
	 *
	 * @return JSONMessage
	 */
	public function startConversion($args, $request) {
		$user = $request->getUser();
		$dispatcher = $request->getDispatcher();

		$pattern = '/submission_(\d+)/';
		$submissions = array();
		foreach ($_POST as $field => $value) {
			if (preg_match($pattern, $field, $matches) && (intval($value) !== -1) ) {
				$submissionId = $matches[1];
				$submissions[$submissionId] = $value;
			}
		}
		if (count($submissions)) {
			// trigger conversion
			$url = $request->url(null, 'gateway', 'plugin', array('MarkupBatchGatewayPlugin',
										'userId', $user->getId()));
			$ch = curl_init();
			curl_setopt($ch, CURLOPT_HTTPHEADER, array('Expect:')); // Avoid HTTP 417 errors
			curl_setopt($ch, CURLOPT_URL, $url);
			curl_setopt($ch, CURLOPT_POSTFIELDS, $submissions);
			curl_setopt($ch, CURLOPT_RETURNTRANSFER, 1);
			curl_setopt($ch, CURLOPT_TIMEOUT_MS, 1000);
			curl_exec($ch);
			curl_close($ch);

			// notification
			$notificationManager = new NotificationManager();
			$notificationManager->createTrivialNotification(
				$user->getId(), 
				NOTIFICATION_TYPE_SUCCESS, 
				array(
					'contents' => __('plugins.generic.markup.start-success'),
				)
			);
		}

		// redirect to batch conversion page
		$url = $dispatcher->url($request, ROUTE_PAGE,null, 'management', 'settings', 'website',
				array(), 'markupBatchConversion');
		$request->redirectUrl($url);
	}

	/**
	 * Returns status for running conversion
	 * @param $args array
	 * @param $request PKPRequest
	 *
	 * @return JSONMessage
	 */
	public function fetchConversionStatus($args, $request) {
		$this->_plugin->import('classes.MarkupBatchConversionHelper');
		$batchConversionHelper = new MarkupBatchConversionHelper();
		$data = $batchConversionHelper->readOutFile();
		$responseData = null;
		if (is_array($data)) {
			$responseData = <<<OED

			<h3>Batch conversion job infos</h3>
			<p><em>Running {$data['processedCount']} out of {$data['submissionCount']}.</em></p>
			<dl>
				<dt>Submission Id</dt><dd>{$data['submissionId']}</dd>
				<dt>OJS Job ID</dt><dd>{$data['jobInfoId']}</dd>
				<dt>OTS Job ID</dt><dd>{$data['otsJobId']}</dd>
				<dt>Job Status</dt><dd>{$data['conversionStatus']}</dd>
			</dl>

OED;
		}
		else {
			$responseData = array(
				'errorMessage' => __('plugins.generic.markup.conversion-running'),
			);
		}

		return new JSONMessage(true, $responseData);
	}

	/**
	 * Stops running batch conversion
	 * @param $args array
	 * @param $request PKPRequest
	 *
	 * @return JSONMessage
	 */
	public function cancelConversion($args, $request) {
		$user = $request->getUser();
		$dispatcher = $request->getDispatcher();
		$conversionPageUrl = $dispatcher->url($request, ROUTE_PAGE,null, 'management', 'settings', 'website',
				array(), 'markupBatchConversion');
		$this->_plugin->import('classes.MarkupBatchConversionHelper');
		$batchConversionHelper = new MarkupBatchConversionHelper();
		if (!$batchConversionHelper->isRunning()) {
			$request->redirectUrl($conversionPageUrl);
			exit;
		}

		// verify cancellation token
		$data = $batchConversionHelper->readOutFile();
		$token = $request->getUserVar('token');
		if ($token != $data['cancellationToken']) {
			$request->redirectUrl($conversionPageUrl);
			exit;
		}

		$pid = intval($data['pid']);
		$notificationManager = new NotificationManager();
		if (posix_kill($pid, 9)) {	// 9 = SIGKILL
			$notificationManager->createTrivialNotification(
				$user->getId(),
				NOTIFICATION_TYPE_SUCCESS,
				array(
					'contents' => __('plugins.generic.markup.cancel-success'),
				)
			);
		}
		else {
			$notificationManager->createTrivialNotification(
				$user->getId(),
				NOTIFICATION_TYPE_ERROR,
				array(
					'contents' => __('plugins.generic.markup.cancel-failure'),
				)
			);
		}
		$batchConversionHelper->deleteOutFile();
		$request->redirectUrl($conversionPageUrl);
	}
}
