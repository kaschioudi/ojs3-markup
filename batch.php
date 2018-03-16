#!/usr/bin/env php
<?php

/**
 * @file batch.php
 *
 * Copyright (c) 2003-2018 Simon Fraser University
 * Copyright (c) 2003-2018 John Willinsky
 * Distributed under the GNU GPL v2. For full terms see the file docs/COPYING.
 *
 * @class BatchConversionTool
 * @ingroup plugins_generic_markup
 *
 * @brief Handles request for articles batch conversion.
 *
 * @brief CLI tool to perform batch conversion tasks
 */

require_once dirname(dirname(dirname(dirname(__FILE__)))) . '/tools/bootstrap.inc.php';

class BatchConversionTool extends CommandLineTool {
	/** @var MarkupBatchConversionHelper Batch conversion helper class*/
	protected $_markupBatchConversionHelper = null;

	/** @var MarkupConversionHelper Markup conversion helper object */
	protected $_markupConversionHelper = null;

	/** @var MarkupPlugin Markup plugin object */
	protected $_markupPlugin = null;

	/** @var PKPUser User object */
	protected $_user = null;

	/** @var Context Current context object */
	protected $_context = null;

	/** @var XMLPSWrapper OTS wrapper object */
	protected $_otsWrapper = null;

	/** @var array All the arguments passed to the script */
	protected $_parameters = null;

	/**
	 * Constructor
	 * @param array $argv
	 */
	public function __construct($argv = array()) {
		parent::__construct($argv);
		
		if (!sizeof($this->argv)) {
			$this->usage();
			exit(1);
		}

		$this->_parameters = $this->argv;
		import('plugins.generic.markup.MarkupPlugin');
		$this->_markupPlugin = new MarkupPlugin();
		$this->_markupPlugin->register('generic', dirname(__FILE__));
		
		// register MarkupJobInfoDAO
		$this->_markupPlugin->import('classes.MarkupJobInfoDAO');
		$markupJobInfoDao = new MarkupJobInfoDAO($this->_markupPlugin);
		DAORegistry::registerDAO('MarkupJobInfoDAO', $markupJobInfoDao);
	}

	/**
	 * Initializes object properties
	 * (ps: Make sure $context proprerty is set before calling this method)
	 */
	protected function initProperties() {
		import('plugins.generic.markup.classes.MarkupConversionHelper');
		$this->_otsWrapper = MarkupConversionHelper::getOTSWrapperInstance(
			$this->_markupPlugin,
			$this->_context,
			$this->_user,
			false
		);
		$this->_markupConversionHelper = new MarkupConversionHelper(
			$this->_markupPlugin,
			$this->_otsWrapper,
			$this->_user
		);
		$this->_markupPlugin->import('classes.MarkupBatchConversionHelper');
		$this->_markupBatchConversionHelper = new MarkupBatchConversionHelper();
	}

	/**
	 * Print command usage information
	 */
	public function usage() {
		print "Usage: " . PHP_EOL;
		print "\t {$this->scriptName} [user_name] <journal name>\t\t\t\t\tBatch convert a specific journal enabled" . PHP_EOL;
		print "\t {$this->scriptName} [user_name] [--all]\t\t\t\t\t\tBatch convert all enabled journals" . PHP_EOL;
		print "\t {$this->scriptName} [--print]\t\t\t\t\t\t\tPrints the list of all enabled journals" . PHP_EOL;
		print "\t {$this->scriptName} [user_name] [--list] <comma-separated list of journals>\tBatch convert a comma separated list of journals" . PHP_EOL;
	}

	/**
	 * Execute batch conversion task
	 */
	public function execute() {
		$allOption = in_array('--all', $this->_parameters);
		$listOption = in_array('--list',$this->_parameters);
		$printOption = in_array('--print',$this->_parameters);

		if ($printOption) {
			$this->processPrint();
		}
		else {
			// load user only on first init
			if (!$this->_user) {
				$adminUser = array_shift($this->_parameters);
				$userDao = DAORegistry::getDAO('UserDAO');
				$this->_user = $userDao->getByUsername($adminUser);
			}
			if (!$this->_user) {
				print "=> " . __('plugins.generic.markup.unknownUser', array('adminUser' => $adminUser)). PHP_EOL;
				print PHP_EOL;
				$this->usage();
				exit(4);
			}

			if ($allOption) {
				$this->processAll();
			}
			elseif ($listOption) {
				$this->processList();
			}
			else {
				$contextPath = $this->_parameters[0];
				$contextDao = DAORegistry::getDAO('JournalDAO');
				$context = $contextDao->getByPath($contextPath);
				$this->processOne($context);
			}
		}
	}

	/**
	 * Prints the list of all enabled journals
	 */
	protected function processPrint() {
		$contextDao = DAORegistry::getDAO('JournalDAO');
		$contexts = $contextDao->getAll(true);
		print __('plugins.generic.markup.journalList') . PHP_EOL;
		while ($context = $contexts->next()) {
			print "=> " . $context->getPath() . " (" . $context->getLocalizedName() . ")" . PHP_EOL;
		}
	}

	/**
	 * Batch convert all enabled journals
	 */
	protected function processAll() {
		$contextDao = DAORegistry::getDAO('JournalDAO');
		$contexts = $contextDao->getAll(true);
		while ($context = $contexts->next()) {
			$this->processOne($context);
		}
	}

	/**
	 * Batch convert a comma separated list of enabled journals
	 */
	protected function processList() {
		if (!isset($this->_parameters[1])) {
			print __('plugins.generic.markup.missingJournalList') . PHP_EOL . PHP_EOL;
			$this->usage();
			exit(3);
		}

		$journals = explode(",", $this->_parameters[1]);
		$contextDao = DAORegistry::getDAO('JournalDAO');
		foreach ($journals as $contextPath) {
			$context = $contextDao->getByPath($contextPath);
			$this->processOne($context);
		}
	}

	/**
	 * Batch convert a specific journal enabled
	 * @param $context Context|null
	 * @throws Exception
	 */
	protected function processOne($context) {
		if (!$context) {
			print __('plugins.generic.markup.invalidJournalPath') . PHP_EOL;
			exit(1);
		}

		$this->_context = $context;
		try {
			$this->initProperties();
		}
		catch(Exception $e) {
			print "=> " . $e->getMessage(). PHP_EOL;
			print PHP_EOL;
			$this->usage();
			exit(2);
		}

		print '---------------------------------------------------' . PHP_EOL;
		print '*****> JOURNAL: ' . $context->getPath() . ' <*****' . PHP_EOL;
		print '---------------------------------------------------' . PHP_EOL;

		$submissionDao = Application::getSubmissionDAO();
		$submissionFileDao = DAORegistry::getDAO('SubmissionFileDAO');
		$metadata = $this->_markupBatchConversionHelper->buildSubmissionMetadataByContext($context->getId());
		$submissionFoundCount = count($metadata);
		$submissionProcessedCount = 0;
		foreach ($metadata as $submission) {
			print "=> " . __('plugins.generic.markup.processingSubmissionText', array('submissionTitle' => $submission['title'])) . PHP_EOL;
			if ($defaultSubmissionFileId = intval($submission['defaultSubmissionFileId'])) {
				try {
					$submissionFile = $submissionFileDao->getLatestRevision($defaultSubmissionFileId);
					if (empty($submissionFile)) {
						print "\t => " . __('plugins.generic.markup.archive.noArticle') . PHP_EOL;
						continue;
					}
					$submissionProcessedCount++;
					// load submission
					$submissionObj = $submissionDao->getById($submissionFile->getSubmissionId());

					$jobInfoId = MarkupConversionHelper::createConversionJobInfo(
						$context,
						$this->_user,
						$defaultSubmissionFileId
					);
					$jobId = $this->_markupConversionHelper->triggerConversion(
						$context,
						$submissionFile,
						$submission['stage'],
						'galley-generate',
						$jobInfoId
					);
					print "\t " . __('plugins.generic.markup.otsJobId', array('jobId' => $jobId)) . PHP_EOL;
					print "\t " . __('plugins.generic.markup.ojsJobInfoId', array('jobInfoId' => $jobInfoId)) . PHP_EOL;
					$otsWrapper = $this->_otsWrapper;
					$data = array();
					$statusCallbackFn = function($jobStatus) use ($otsWrapper, $data) {
						$conversionStatus = $otsWrapper->statusCodeToLabel($jobStatus);
						print "\t" . __('plugins.generic.markup.otsConversionStatus', array('conversionStatus' => $conversionStatus)) . PHP_EOL;
					};
					$tmpZipFile = $this->_markupConversionHelper->retrieveConversionJobArchive(
						$submissionFile,
						$jobId,
						$statusCallbackFn
					);
					if (($tmpZipFile == false) || !file_exists($tmpZipFile)) {
						throw new Exception("\t => " . __('plugins.generic.markup.archive-download-failure') . PHP_EOL);
					}
					$extractionPath = null;
					if (($extractionPath = $this->_markupConversionHelper->unzipArchive($tmpZipFile)) === false) {
						throw new Exception("\t => " . __('plugins.generic.markup.archive-extract-failure') . PHP_EOL);
					}
					$fileName = "document" . '__' . date('Y-m-d_h:i:s');
					$this->_markupConversionHelper->handleArchiveExtractionAfterGalleyGenerate(
						$extractionPath,
						$context,
						$submissionObj,
						$submissionFile,
						$fileName
					);
				}
				catch (Exception $e) {
					print "\t => *** EXCEPTION *** => " . $e->getMessage() . PHP_EOL; 
				}
			}
		}
		print PHP_EOL . __('plugins.generic.markup.batchSummary', array('submissionFoundCount' => $submissionFoundCount, 'submissionProcessedCount' => $submissionProcessedCount)) . PHP_EOL;
		print PHP_EOL;
	}
}

$tool = new BatchConversionTool(isset($argv) ? $argv : array());
$tool->execute();
