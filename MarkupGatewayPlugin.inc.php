<?php

/**
 * @file plugins/generic/markup/MarkupGatewayPlugin.inc.php
 *
 * Copyright (c) 2003-2016 Simon Fraser University Library
 * Copyright (c) 2003-2016 John Willinsky
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
	protected function _initXMLPSWrapper() {
		
		$request = $this->getRequest();
		$journal = $request->getJournal();
		$journalId = $journal->getId();
		
		$plugin = $this->getMarkupPlugin();

		// Import host, user and password variables into the current symbol table from an array
		extract($this->plugin->getOTSLoginParametersForJournal($journal->getId(), $this->user));

		$this->import('classes.XMLPSWrapper');
		$this->xmlpsWrapper = new XMLPSWrapper($host, $user, $password);
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
		$this->_initXMLPSWrapper();

		// process
		$stage = (int)$args['stage'];
		$target = strval($args['target']);
		$this->_process($submissionFile, $stage, $target);
	}
	
	/**
	 * Build an array of metadata about submitted file
	 * @param $journal Journal Journal
	 * @param $submission Submission Submission
	 *
	 * @return array
	 */
	protected function _buildMetadata($journal, $submission)
	{
		$locale = ($submission->getLanguage() != '') ? $submission->getLanguage() : $journal->getPrimaryLocale();
		
		$publishedArticleDao = DAORegistry::getDAO('PublishedArticleDAO');
		$issueDao = DAORegistry::getDAO('IssueDAO');		
		$sectionDao = DAORegistry::getDAO('SectionDAO');
		$userGroupDao = DAORegistry::getDAO('UserGroupDAO');
		
		/* Authors */
		$count = 0;
		foreach ($submission->getAuthors() as $author) {
				$authors[$count]['firstName'] = $author->getFirstName();
				$authors[$count]['lastName'] = $author->getLastName();
				$authors[$count]['email'] = $author->getEmail();
				$authors[$count]['orcid'] = $author->getOrcid();
				$authors[$count]['affiliation'] = $author->getLocalizedAffiliation();
				$authors[$count]['country'] = $author->getCountry();
				$authors[$count]['bio'] = $author->getLocalizedBiography();
				$userGroup = $userGroupDao->getById($author->getUserGroupId());
				$authors[$count]['contribType'] = $userGroup->getLocalizedName();
				$count++;
		}
				
		/* Issue information, if available*/
		$publishedArticle = $publishedArticleDao->getPublishedArticleByArticleId($submission->getId());
		if ($publishedArticle){	
			$issue = $issueDao->getById($publishedArticle->getIssueId());				
			$issueDetails = array (
						'issue-year'   		=> $issue->getYear(),
						'issue-volume'  	=> $issue->getVolume(),
						'issue-number'  	=> $issue->getNumber(),
						'issue-title'  		=> $issue->getLocalizedTitle(),
					);
		}
		
		/* Page numbers */
		$matches = null;
		if (PKPString::regexp_match_get('/^[Pp][Pp]?[.]?[ ]?(\d+)$/', $submission->getPages(), $matches)) {
			$matchedPage = htmlspecialchars(Core::cleanVar($matches[1]));
			$fpage = $matchedPage;
			$lpage = $matchedPage;
			$pageCount = 1;
		} elseif (PKPString::regexp_match_get('/^[Pp][Pp]?[.]?[ ]?(\d+)[ ]?(-|–)[ ]?([Pp][Pp]?[.]?[ ]?)?(\d+)$/', $submission->getPages(), $matches)) {
			$fpage = htmlspecialchars(Core::cleanVar($matches[1]));
			$lpage = htmlspecialchars(Core::cleanVar($matches[4]));
			$pageCount = $fpage - $lpage + 1;
		}		
		
		/* Localized journal titles */
		foreach ($journal->getName(null) as $loc => $title) {
			$journalTitles[strtoupper(substr($loc, 0, 2))] = htmlspecialchars(Core::cleanVar($title));
		}
		
		/* Localized article titles */
		foreach ($submission->getTitle(null) as $loc => $title) {
			$articleTitles[strtoupper(substr($loc, 0, 2))] = htmlspecialchars(Core::cleanVar($title));
		}
		
		/* Localized abstracts */
		if (is_array($submission->getAbstract(null))) foreach ($submission->getAbstract(null) as $loc => $abstract) {
			$abstract = htmlspecialchars(Core::cleanVar(strip_tags($abstract)));
			if (empty($abstract)) continue;
			$abstracts[strtoupper(substr($loc, 0, 2))] = $abstract;			
		}
		
		/* TODO: keywords and other classifications */
		
		
		return array (
				'locale'     		=> $locale,
				'article-titles'    => $articleTitles,
				'abstracts'         => $abstracts,
				'journal-titles'    => $journalTitles,
				'journal-id'     	=> htmlspecialchars($journal->getSetting('abbreviation', $locale) ? Core::cleanVar($journal->getSetting('abbreviation', $locale)) : Core::cleanVar($journal->getSetting('acronym', $locale))),
				'institution'       => $journal->getSetting('publisherInstitution'),
				'contributors'      => $authors,
				'issue-details'     => $issueDetails,
				'online-ISSN'       => $journal->getSetting('onlineIssn'),
				'print-ISSN'        => $journal->getSetting('printIssn'),
				'doi'        		=> $submission->getStoredPubId('doi'),
				'article-id'        => $submission->getBestArticleId(),
				'copyright-year'    => $submission->getCopyrightYear(),
				'copyright-statement'  => htmlspecialchars(__('submission.copyrightStatement', array('copyrightYear' => $submission->getCopyrightYear(), 'copyrightHolder' => $submission->getLocalizedCopyrightHolder()))),
				'license-url'    	=> $submission->getLicenseURL(),
				'license'    		=> Application::getCCLicenseBadge($submission->getLicenseURL()),
				'fpage'  			=> isset($fpage) ? $fpage: '',
				'lpage'  			=> isset($lpage) ? $lpage: '',
				'page-count'  		=> isset($pageCount) ? $pageCount: '',
				'date-published'  	=> $submission->getDatePublished(),
				'subj-group-heading'=> $sectionDao->getById($submission->getSectionId()),
		);
		
		
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

		// submit file to markup server
		$filePath = $submissionFile->getFilePath();
		$filename = basename($filePath);
		$fileContent = file_get_contents($filePath);
		$citationStyle = $this->plugin->getSetting($journalId, 'cslStyle');

		$tmpZipFile = null;

		try {
			$metadata = $this->_buildMetadata($journal, $submission);

			$jobId = $this->xmlpsWrapper->submitJob($filename, $fileContent, $citationStyle, $metadata);

			// link XML job id with markup job
			$markupJobInfoDao = DAORegistry::getDAO('MarkupJobInfoDAO');
			$this->plugin->import('classes.MarkupJobInfo');
			$markupJobInfo = $markupJobInfoDao->getMarkupJobInfo($this->jobId);
			$markupJobInfo->setXmlJobId($jobId);
			$markupJobInfoDao->updateMarkupJobInfo($markupJobInfo);
			
			// retrieve job archive from markup server
			$i = 0;
			$jobStatus = null;
			while($i++ < 180) {
				$jobStatus = $this->xmlpsWrapper->getJobStatus($jobId);
				if (($jobStatus != XMLPSWrapper::JOB_STATUS_PENDING) && ($jobStatus != XMLPSWrapper::JOB_STATUS_PROCESSING)) break; 
				sleep(5);
			}
			
			// Return if the job didn't complete
			if ($jobStatus != XMLPSWrapper::JOB_STATUS_COMPLETED) return;
			
			// make sure submission file has not been deleted (for instance when user cancel out of wizard)
			$submissionFileDao = DAORegistry::getDAO('SubmissionFileDAO');
			$submissionFile = $submissionFileDao->getLatestRevision($submissionFile->getFileId());
			if (empty($submissionFile)) {
				echo __('plugins.generic.markup.archive.no_file');
				exit;
			}
			
			// Download the Zip archive.
			$tmpZipFile = $this->xmlpsWrapper->downloadFile($jobId);
			
			if (!file_exists($tmpZipFile)) return;
			
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
		if (($extractionPath = $this->_unzipArchive($tmpZipFile)) === false) {
			return;
		}

		// save relevant documents
		$journal = $this->getRequest()->getJournal();
		$journalId = $journal->getId();
		$plugin = $this->getMarkupPlugin();

		switch ($target) {
			case 'xml-conversion':
				$params = array(
					'stage' => $stage,
					'assocType' => (int)$submissionFile->getAssocType(),
					'assocId' => (int)$submissionFile->getAssocId(),
					'UserGroupId' => (int)$submissionFile->getUserGroupId()
				);
				$this->addXmlDocumentToFileList($submission, "{$extractionPath}/document.xml", $params);
				break;

			case 'galley-generate':
				$wantedFormats = $plugin->getSetting($journalId, 'wantedFormats');

				$genreDao = DAORegistry::getDAO('GenreDAO');
				$genre = $genreDao->getByKey('SUBMISSION', $journalId);

				// retrieve galleys
				$articleGalleyDao = DAORegistry::getDAO('ArticleGalleyDAO');
				$galleys = $articleGalleyDao->getBySubmissionId($submission->getId());
				$existing_galley_by_labels = array();
				while ($galley = $galleys->next()) {
					$existing_galley_by_labels[$galley->getLabel()] = $galley;
				}

				if (in_array('pdf', $wantedFormats)) {
					$this->_addFileToGalley($existing_galley_by_labels, $submission, $genre->getId(), 'pdf', "{$extractionPath}/document.pdf");
				}
				if (in_array('xml', $wantedFormats)) {
					$this->_addFileToGalley($existing_galley_by_labels, $submission, $genre->getId(), 'xml', "{$extractionPath}/document.xml");
				}
				if (in_array('epub', $wantedFormats)) {
					$this->_addFileToGalley($existing_galley_by_labels, $submission, $genre->getId(), 'epub', "{$extractionPath}/document.epub");
				}
				break;
		}

		@unlink($tmpZipFile);
		@rmdir($extractionPath);
	}

	/**
	 * Add converted xml document to file list for stage
	 * 
	 * @param $submission object Submission object
	 * @param $filePath string Path to file in archive
	 * @param $params array Additional parameters (file stage, assoc type, assoc id)
	 * 
	 * @return void
	 */
	protected function addXmlDocumentToFileList($submission, $filePath, $params) {
		$journal = $this->getRequest()->getJournal();
		$journalId = $journal->getId();

		$submissionId = $submission->getId();

		$genreDao = DAORegistry::getDAO('GenreDAO');
		$genre = $genreDao->getByKey('SUBMISSION', $journalId);
		$genreId = $genre->getId();

		$userGroupDao = DAORegistry::getDAO('UserGroupDAO');

		$submissionFileDao = DAORegistry::getDAO('SubmissionFileDAO');
		$submissionFile = $submissionFileDao->newDataObjectByGenreId($genreId);
		$submissionFile->setUploaderUserId($this->user->getId());
		$submissionFile->setSubmissionId($submissionId);
		$submissionFile->setGenreId($genreId);
		$submissionFile->setFileSize(filesize($filePath));
		$submissionFile->setFileStage($params['stage']);
		$submissionFile->setDateUploaded(Core::getCurrentDate());
		$submissionFile->setDateModified(Core::getCurrentDate());
		$submissionFile->setOriginalFileName(basename($filePath));
		$submissionFile->setFileType('text/xml');
		$submissionFile->setViewable(true);
		$submissionFile->setUserGroupId($params['UserGroupId']);

		$submissionFile->setAssocType($params['assocType']);
		$submissionFile->setAssocId($params['assocId']);
		$insertedFile = $submissionFileDao->insertObject($submissionFile, $filePath, false);
	}
	
	/**
	 * Add a document as galley file
	 *
	 * @param $existing_galley_by_labels array Array of existing galleys for submission indexed by label
	 * @param $submission object Submission object
	 * @param $genreId int Genre ID 
	 * @param $format string Asset format 
	 * @param $fileName string File to process
	 *
	 * @return object Submission file object 
	 */
	function _addFileToGalley($existing_galley_by_labels, $submission, $genreId, $format, $filePath) {

		$submissionId = $submission->getId();

		$galleyFiles = [];
		$articleGalley = null;
		$articleGalleyDao = DAORegistry::getDAO('ArticleGalleyDAO');
		$label = 'XMLPS-' . strtoupper($format) . '-' .  date("MdSY@H:i",time());

		// create new galley
		$articleGalley = $articleGalleyDao->newDataObject();
		$articleGalley->setSubmissionId($submissionId);
		$articleGalley->setLabel($label);
		$articleGalley->setLocale($submission->getLocale());
		$articleGalleyDao->insertObject($articleGalley);

		$submissionFileDao = DAORegistry::getDAO('SubmissionFileDAO');
		$submissionFile = $submissionFileDao->newDataObjectByGenreId($genreId);
		$submissionFile->setUploaderUserId($this->user->getId());
		$submissionFile->setSubmissionId($submissionId);
		$submissionFile->setGenreId($genreId);
		$submissionFile->setFileSize(filesize($filePath));
		$submissionFile->setFileStage(SUBMISSION_FILE_PROOF);
		$submissionFile->setDateUploaded(Core::getCurrentDate());
		$submissionFile->setDateModified(Core::getCurrentDate());
		$submissionFile->setOriginalFileName(basename($filePath));

		switch($format) {
			case 'pdf':
				$submissionFile->setFileType('application/pdf');
				break;
			case 'epub':
				$submissionFile->setFileType('application/epub+zip');
				break;
			case 'xml':
				$submissionFile->setFileType('text/xml');
				break;
		}

		$submissionFile->setAssocType(ASSOC_TYPE_GALLEY);
		$submissionFile->setAssocId($articleGalley->getId());
		$insertedFile = $submissionFileDao->insertObject($submissionFile, $filePath, false);

		// attach file id to galley
		$articleGalley->setFileId($submissionFile->getFileId());
		$articleGalleyDao->updateObject($articleGalley);

		return $insertedFile;
	}
	
	/**
	 * Extract zip a archive
	 *
	 * @param $zipFile string File to extract
	 * @param $validFiles mixed Array with file names to extract
	 * @param $destination string Destination folder
	 * @param $message string Reference to status message from ZipArchive
	 *
	 * @return bool Whether or not the extraction was successful
	 */
	protected function _zipArchiveExtract($zipFile, $destination, &$message, $validFiles = array()) {
		$zip = new ZipArchive;
		if (!$zip->open($zipFile, ZIPARCHIVE::CHECKCONS)) {
			$message = $zip->getStatusString();
			return false;
		}

		if (!empty($validFiles)) {
			// Restrict which files to extract
			$extractFiles = array();
			foreach ($validFiles as $validFile) {
				if ($zip->locateName($validFile) !== false) {
					$extractFiles[] = $validFile;
				}
			}
			$status = $zip->extractTo($destination, $extractFiles);
		} else {
			// Extract the entire archive
			$status = $zip->extractTo($destination);
		}

		if ($status === false && $zip->getStatusString() != 'No error') {
			$zip->close();
			$message = $zip->getStatusString();
			return false;
		}

		$zip->close();

		return true;
	}

	/**
	 * Extract archive file.
	 *
	 * @param $zipFile string Path to zip archive
	 *
	 * @return mixed path to extraction directory or false if extraction was not successful
	 */
	function _unzipArchive($zipFile) {
		
		$validFiles = array(
			'document.pdf',
			'document.xml',
			'document.epub',
		);

		// Extract the zip archive to a markup subdirectory
		$message = '';
		$destination = sys_get_temp_dir() . '/' . uniqid();
		if (!$this->_zipArchiveExtract($zipFile, $destination, $message, $validFiles)) {
			echo __(
				'plugins.generic.markup.archive.bad_zip',
				array(
					'file' => $zipFile,
					'error' => $message
				)
			);
			return false;
		}
		
		return $destination;
	}

}
