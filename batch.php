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
	protected $markupBatchConversionHelper = null;

	/** @var MarkupConversionHelper Markup conversion helper object */
	protected $markupConversionHelper = null;

	/** @var MarkupPlugin Markup plugin object */
	protected $markupPlugin = null;

	/** @var PKPUser User object */
	protected $user = null;

	/** @var Context Current context object */
	protected $context = null;

	/** @var XMLPSWrapper OTS wrapper object */
	protected $otsWrapper = null;

	/** @var array All the arguments passed to the script */
	protected $parameters = null;

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

		$this->parameters = $this->argv;
		import('plugins.generic.markup.MarkupPlugin');
		$this->markupPlugin = new MarkupPlugin();
		$this->markupPlugin->register('generic', dirname(__FILE__));
		
		// register MarkupJobInfoDAO
		$this->markupPlugin->import('classes.MarkupJobInfoDAO');
		$markupJobInfoDao = new MarkupJobInfoDAO($this->markupPlugin);
		DAORegistry::registerDAO('MarkupJobInfoDAO', $markupJobInfoDao);
	}

	/**
	 * Initializes object properties
	 * (ps: Make sure $context proprerty is set before calling this method)
	 */
	protected function initProperties() {
		// load user
		$adminUser = 'admin';	// TODO read admin user from command-line
		$userDao = DAORegistry::getDAO('UserDAO');
		$this->user = $userDao->getByUsername($adminUser);
		if (!$this->user) {
			throw new Exception("The specified user, \"{$adminUser}\", does not exist.");
		}
		
		import('plugins.generic.markup.classes.MarkupConversionHelper');
		$this->otsWrapper = MarkupConversionHelper::getOTSWrapperInstance(
			$this->markupPlugin,
			$this->context,
			$this->user,
			false
		);
		$this->markupConversionHelper = new MarkupConversionHelper(
			$this->markupPlugin,
			$this->otsWrapper,
			$this->user
		);
		$this->markupPlugin->import('classes.MarkupBatchConversionHelper');
		$this->markupBatchConversionHelper = new MarkupBatchConversionHelper();
	}

	/**
	 * Print command usage information
	 */
	public function usage() {
		print "Usage: " . PHP_EOL;
		print "\t {$this->scriptName} <journal name>\t\t\t\t\tBatch convert a specific journal enabled" . PHP_EOL;
		print "\t {$this->scriptName} [--all]\t\t\t\t\t\tBatch convert all enabled journals" . PHP_EOL;
		print "\t {$this->scriptName} [--print]\t\t\t\t\t\tPrints the list of all enabled journals" . PHP_EOL;
		print "\t {$this->scriptName} [--list] <comma-separated list of journals>\tBatch convert a comma separated list of journals" . PHP_EOL;
	}

	/**
	 * Execute batch conversion task
	 */
	public function execute() {
		$allOption = in_array('--all', $this->parameters);
		$listOption = in_array('--list',$this->parameters);
		$printOption = in_array('--print',$this->parameters);

		if ($allOption) {
			$this->processAll();
		}
		elseif ($listOption) {
			$this->processList();
		}
		elseif ($printOption) {
			$this->processPrint();
		}
		else {
			$contextPath = $this->parameters[0];
			$contextDao = DAORegistry::getDAO('JournalDAO');
			$context = $contextDao->getByPath($contextPath);
			$this->processOne($context);
		}
	}

	/**
	 * Prints the list of all enabled journals
	 */
	protected function processPrint() {
		$contextDao = DAORegistry::getDAO('JournalDAO');
		$contexts = $contextDao->getAll(true);
		print "Below is the list of all journals enabled in this OJS install:" . PHP_EOL;
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
		if (!isset($this->parameters[1])) {
			$this->usage();
			exit(3);
		}
		
		$journals = explode(",", $this->parameters[1]);
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
			print "The specified journal path does not exist." . PHP_EOL;
			exit(1);
		}

		print '---------------------------------------------------' . PHP_EOL;
		print '*****> JOURNAL: ' . $context->getPath() . ' <*****' . PHP_EOL;
		print '---------------------------------------------------' . PHP_EOL;
		$this->context = $context;
		try {
			$this->initProperties();
		}
		catch(Exception $e) {
			print "\t => " . $e->getMessage(). PHP_EOL;
			exit(2);
		}

		$submissionDao = Application::getSubmissionDAO();
		$submissionFileDao = DAORegistry::getDAO('SubmissionFileDAO');
		$metadata = $this->markupBatchConversionHelper->buildSubmissionMetadataByContext($context->getId());
		$submissionFoundCount = count($metadata);
		$submissionProcessedCount = 0;
		foreach ($metadata as $submission) {
			print "=> Processing submission: {$submission['title']}" . PHP_EOL;
			if ($defaultSubmissionFileId = intval($submission['defaultSubmissionFileId'])) {
				try {
					$submissionFile = $submissionFileDao->getLatestRevision($defaultSubmissionFileId);
					if (empty($submissionFile)) {
						print "\t => " . __('plugins.generic.markup.archive.no_article') . PHP_EOL;
						continue;
					}
					$submissionProcessedCount++;
					// load submission
					$submissionObj = $submissionDao->getById($submissionFile->getSubmissionId());

					$jobInfoId = MarkupConversionHelper::createConversionJobInfo(
						$context,
						$this->user,
						$defaultSubmissionFileId
					);
					$jobId = $this->markupConversionHelper->triggerConversion(
						$context,
						$submissionFile,
						$submission['stage'],
						'galley-generate',
						$jobInfoId
					);
					print "\t OTS Job #ID : {$jobId}" . PHP_EOL;
					print "\t OJS JobInfo #ID : {$jobInfoId}" . PHP_EOL;
					$otsWrapper = $this->otsWrapper;
					$data = array();
					$statusCallbackFn = function($jobStatus) use ($otsWrapper, $data) {
						$conversionStatus = $otsWrapper->statusCodeToLabel($jobStatus);
						print "\tOTS JOB STATUS => {$conversionStatus}" . PHP_EOL;
					};
					$tmpZipFile = $this->markupConversionHelper->retrieveConversionJobArchive(
						$submissionFile,
						$jobId,
						$statusCallbackFn
					);
					if (($tmpZipFile == false) || !file_exists($tmpZipFile)) {
						throw new Exception("\t => " . __('plugins.generic.markup.archive-download-failure') . PHP_EOL);
					}
					$extractionPath = null;
					if (($extractionPath = $this->markupConversionHelper->unzipArchive($tmpZipFile)) === false) {
						throw new Exception("\t => " . __('plugins.generic.markup.archive-extract-failure') . PHP_EOL);
					}
					$fileName = "document" . '__' . date('Y-m-d_h:i:s');
					$this->markupConversionHelper->handleArchiveExtractionAfterGalleyGenerate(
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
		print PHP_EOL . "{$submissionFoundCount} submission(s) found & {$submissionProcessedCount} processed!" . PHP_EOL;
		print PHP_EOL;
	}
}

$tool = new BatchConversionTool(isset($argv) ? $argv : array());
$tool->execute();
