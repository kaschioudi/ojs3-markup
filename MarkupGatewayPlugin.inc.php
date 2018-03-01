<?php

/**
 * @file plugins/generic/markup/MarkupGatewayPlugin.inc.php
 *
 * Copyright (c) 2003-2017 Simon Fraser University
 * Copyright (c) 2003-2017 John Willinsky
 * Distributed under the GNU GPL v2. For full terms see the file docs/COPYING.
 *
 * @class MarkupGatewayPlugin
 * @ingroup plugins_generic_markup
 *
 * @brief Responds to requests for markup files for particular journal article;
 * sends request to markup an article to Document Markup Server.
 */

import('lib.pkp.classes.plugins.GatewayPlugin');

class MarkupGatewayPlugin extends GatewayPlugin {
	
	/** @var $parentPluginName string Name of parent plugin */
	protected $parentPluginName = null;

	/** @var $user User user object */
	protected $user = null;

	/** @var $plugin MarkupPlugin Reference to markup plugin */
	protected $plugin = null;

	/** @var $xmlpsWrapper XMLPSWrapper Reference to wrapper class for OTS Service */
	protected $xmlpsWrapper = null;

	/** @var $fileId int submission file id */
	protected $fileId = null;

	/** @var $stage int submission stage */
	protected $stage = null;

	/** @var $jobId string job identifier */
	protected $jobId = null;

	/** @var $conversionHelper MarkupConversionHelper Conversion helper object */
	protected $conversionHelper = null;

	function __construct($parentPluginName) {
		parent::__construct();

		$this->parentPluginName = $parentPluginName;
		$this->plugin = PluginRegistry::getPlugin('generic', $parentPluginName);
	}
	
	/**
	 * Initialize xmlps wrapper
	 * 
	 * @return void
	 */
	protected function _initXMLPSWrapper($request) {
		$this->import('classes.MarkupConversionHelper');
		$this->xmlpsWrapper = MarkupConversionHelper::getOTSWrapperInstance(
			$this->plugin,
			$request->getJournal(),
			$this->user
		);
	}
	
	/**
	 * Hide this plugin from the management interface
	 *
	 * @return bool true
	 */
	function getHideManagement() {
		return true;
	}
	
	/**
	 * Get the name of this plugin. The name must be unique within
	 * its category.
	 *
	 * @return string Name of plugin
	 */
	function getName() {
		return 'MarkupGatewayPlugin';
	}
	
	/**
	 * Get plugin display name
	 *
	 * @return string Plugin display name
	 */
	function getDisplayName() {
		return __('plugins.generic.markup.displayName');
	}

	/**
	 * Get plugin description
	 *
	 * @return string Plugin description
	 */
	function getDescription() {
		return __('plugins.generic.markup.description');
	}
	
	/**
	 * Get the parent plugin
	 *
	 * @return MarkupPlugin Markup plugin object
	 */
	function &getMarkupPlugin() {
		return $this->plugin;
	}
	
	/**
	 * Overwrite plugin path with parent's plugin path
	 *
	 * @return string Plugin path
	 */
	function getPluginPath() {
		$plugin =& $this->getMarkupPlugin();
		return $plugin->getPluginPath();
	}
	
	/**
	 * Overwrite the template path with the parent's template path
	 *
	 * @return string Template path
	 */
	function getTemplatePath() {
		$plugin =& $this->getMarkupPlugin();
		return $plugin->getTemplatePath();
	}
	
	/**
	 * Overwrite the JS path with the parent's JS path
	 *
	 * @return string CSS path
	 */
	function getCssPath() {
		$plugin =& $this->getMarkupPlugin();
		return $plugin->getCssPath();
	}
	
	/**
	 * Overwrite the JS path with the parent's JS path
	 *
	 * @return string JS path
	 */
	function getJsPath() {
		$plugin =& $this->getMarkupPlugin();
		return $plugin->getJsPath();
	}
	
	/**
	 * Get whether or not this plugin is enabled. (Should always return true, as the
	 * parent plugin will take care of loading this one when needed)
	 * @return boolean
	 */
	function getEnabled() {
		$plugin =& $this->getMarkupPlugin();
		return $plugin->getEnabled(); // Should always be true anyway if this is loaded
	}
	
	/**
	 * Get the management verbs for this plugin (override to none so that the parent
	 * plugin can handle this)
	 * @return array
	 */
	function getManagementVerbs() {
		return array();
	}
	
	/**
	 * Handles URL requests to trigger document markup processing for given submission;
	 *
	 * Accepted parameters:
	 *   fileId/[int],
	 *
	 * @param $args Array of url arguments
	 *
	 * @return void
	 */
	function fetch($args, $request) {
		
		// Parse keys and values from arguments
		$keys = array();
		$values = array();
		foreach ($args as $index => $arg) {
			if ($arg == 'true') $arg = true;
			if ($arg == 'false') $arg = false;

			if ($index % 2 == 0) {
				$keys[] = $arg;
			} else {
				$values[] = $arg;
			}
		}
		$args = array_combine($keys, $values);

		// TODO validate that filestage and target arguments are available

		if (!$this->getEnabled()) {
			echo __('plugins.generic.markup.archive.enable');
			exit;
		}

		// Make sure we're within a Journal context
		$journal = $this->getRequest()->getJournal();
		if (!$journal) {
			echo __('plugins.generic.markup.archive.no_journal');
			exit;
		}

		// load submission
		$fileId = isset($args['fileId']) ? (int) $args['fileId'] : false;
		if (!$fileId) {
			echo __('plugins.generic.markup.archive.no_articleID');
			exit;
		}

		// load user 
		$userDao = DAORegistry::getDAO('UserDAO');
		$userId = isset($args['userId']) ? (int) $args['userId'] : false;
		if (!$userId) {
			fatalError(__('plugins.generic.markup.archive.no_articleID'));
			exit;
		}

		$submissionFileDao = DAORegistry::getDAO('SubmissionFileDAO');
		$submissionFile = $submissionFileDao->getLatestRevision($fileId);
		if (empty($submissionFile)) {
			echo __('plugins.generic.markup.archive.no_article');
			exit;
		}

		$this->fileId = $fileId;
		$this->user = $userDao->getById($args['userId']);
		$this->jobId = isset($args['jobId']) ? $args['jobId'] : '';
		$this->stage = isset($args['stage']) ? (int) $args['stage'] : false;

		// initialize OTS wrapper
		$this->_initXMLPSWrapper($request);

		// initialize conversion helper object
		$this->import('classes.MarkupConversionHelper');
		$this->conversionHelper = new MarkupConversionHelper($this->plugin, $this->xmlpsWrapper, $this->user);

		// process
		$stage = (int)$args['stage'];
		$target = strval($args['target']);
		$this->_process($submissionFile, $stage, $target);
	}
	
	/**
	 * Takes care of document markup conversion
	 *
	 * @param $submissionFile mixed SubmissionFile 
	 * @param $stage int Submission stage ID
	 * @param $target string Job target (xml-conversion or galley-generate)
	 *
	 * @return void
	 */
	function _process($submissionFile, $stage, $target) {
		$journal = $this->getRequest()->getJournal();
		$journalId = $journal->getId();

		$submissionDao = Application::getSubmissionDAO();
		$submission = $submissionDao->getById($submissionFile->getSubmissionId());

		$tmpZipFile = null;

		try {
			$jobId = $this->conversionHelper->triggerConversion($journal, $submissionFile, $stage, $target, $this->jobId);
			$tmpZipFile = $this->conversionHelper->retrieveConversionJobArchive($submissionFile, $jobId);
			if (($tmpZipFile == false) || !file_exists($tmpZipFile)) {
				return;
			}
			
		}
		catch (Exception $e) {
			// @TODO log error
			error_log('EXCEPTION!!! ' . $e->getMessage());
			return;
		}

		// save archive as production ready file
		// @TODO @TBD

		// Extract archive
		$extractionPath = null;
		if (($extractionPath = $this->conversionHelper->unzipArchive($tmpZipFile)) === false) {
			return;
		}

		// find current user's group
		$userGroupDao = DAORegistry::getDAO('UserGroupDAO');
		$userGroups = $userGroupDao->getByUserId($this->user->getId(), $journal->getId());
		$userGroup = $userGroups->next();

		$fileName = "document" . '__' . date('Y-m-d_h:i:s');
		switch ($target) {
			case 'xml-conversion':
				$this->conversionHelper->handleArchiveExtractionAfterXmlConversion(
					$extractionPath,
					$journal,
					$submission,
					$submissionFile, 
					$stage,
					$fileName
				);
				break;

			case 'galley-generate':
				$this->conversionHelper->handleArchiveExtractionAfterGalleyGenerate(
					$extractionPath,
					$journal,
					$submission,
					$submissionFile,
					$fileName
				);
				break;
		}

		@unlink($tmpZipFile);
		@rmdir($extractionPath);
	}

}
