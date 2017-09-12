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
	protected $plugin = null;

	/**
	 * Constructor
	 */
	public function __construct() {
		parent::__construct();

		// set reference to markup plugin
		$this->plugin = PluginRegistry::getPlugin('generic', 'markupplugin');

		$this->addRoleAssignment(
			array(ROLE_ID_MANAGER),
			array('filesToConvert')
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
}