<?php 

/**
 * @file plugins/generic/markup/classes/MarkupConversionHelper.inc.php
 *
 * Copyright (c) 2003-2017 Simon Fraser University
 * Copyright (c) 2003-2017 John Willinsky
 * Distributed under the GNU GPL v2. For full terms see the file docs/COPYING.
 *
 * @class MarkupConversionHelper
 * @ingroup plugins_generic_markup
 *
 * @brief Markup conversion Helper class
 *
 */

class MarkupConversionHelper {
	/** @var $xmlpsWrapper XMLPSWrapper Reference to wrapper class for OTS Service */
	protected $_xmlpsWrapper = null;
	/** @var $plugin MarkupPlugin Reference to markup plugin */
	protected $_plugin = null;
	/** @var $params array extra parameters */
	protected $_params = null;
	/** @var $xmlpsWrapper OTSWrapper OTS wrapper */
	protected static $_otsWrapper = null;

	/**
	 * Constructor
	 * @param $plugin MarkupPlugin 
	 * @param $xmlpsWrapper XMLPSWrapper 
	 * @param $user PKPUser 
	 */
	public function __construct($plugin, $xmlpsWrapper, $user) {
		$this->_plugin = $plugin;
		$this->user = $user;
		$this->_xmlpsWrapper = $xmlpsWrapper;
	}

	/**
	 * Build an array of metadata about submitted file
	 * @param $journal Journal Journal
	 * @param $submission Submission Submission
	 *
	 * @return array
	 */
	protected function buildSubmissionMetadata($journal, $submission) {
		AppLocale::requireComponents(LOCALE_COMPONENT_PKP_SUBMISSION);
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
		$issueDetails = null;
		$publishedArticle = $publishedArticleDao->getByArticleId($submission->getId());
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
			'locale'	 	=> $locale,
			'article-titles'	=> $articleTitles,
			'abstracts'		=> $abstracts,
			'journal-titles'	=> $journalTitles,
			'journal-id'	 	=> htmlspecialchars($journal->getSetting('abbreviation', $locale) ? Core::cleanVar($journal->getSetting('abbreviation', $locale)) : Core::cleanVar($journal->getSetting('acronym', $locale))),
			'institution'	   	=> $journal->getSetting('publisherInstitution'),
			'contributors'	  	=> $authors,
			'issue-details'	 	=> $issueDetails,
			'online-ISSN'	   	=> $journal->getSetting('onlineIssn'),
			'print-ISSN'		=> $journal->getSetting('printIssn'),
			'doi'			=> $submission->getStoredPubId('doi'),
			'article-id'		=> $submission->getBestArticleId(),
			'copyright-year'	=> $submission->getCopyrightYear(),
			'copyright-statement'	=> htmlspecialchars(__('submission.copyrightStatement', array('copyrightYear' => $submission->getCopyrightYear(), 'copyrightHolder' => $submission->getLocalizedCopyrightHolder()))),
			'license-url'		=> $submission->getLicenseURL(),
			'license'		=> Application::getCCLicenseBadge($submission->getLicenseURL()),
			'fpage'  		=> isset($fpage) ? $fpage: '',
			'lpage'  		=> isset($lpage) ? $lpage: '',
			'page-count'  		=> isset($pageCount) ? $pageCount: '',
			'date-published'  	=> $submission->getDatePublished(),
			'subj-group-heading'	=> $sectionDao->getById($submission->getSectionId()),
		);
	}

	/**
	 * Kicks off a submission file conversion on OTS server
	 * @param $journal Journal Journal
	 * @param $submissionFile mixed SubmissionFile 
	 * @param $stage int Submission stage ID
	 * @param $target string Job target (xml-conversion or galley-generate)
	 * @param $jobInfoId int OTS job ID
	 * 
	 * @return $jobId int
	 */
	public function triggerConversion($journal, $submissionFile, $stage, $target, $jobInfoId) {
		$submissionDao = Application::getSubmissionDAO();
		$submission = $submissionDao->getById($submissionFile->getSubmissionId());

		// submit file to markup server
		$filePath = $submissionFile->getFilePath();
		$filename = basename($filePath);
		$fileContent = file_get_contents($filePath);
		$citationStyle = $this->_plugin->getSetting($journal->getId(), 'cslStyle');

		$metadata = $this->buildSubmissionMetadata($journal, $submission);
		$jobId = $this->_xmlpsWrapper->submitJob($filename, $fileContent, $citationStyle, $metadata);

		// link XML job id with markup job
		$markupJobInfoDao = DAORegistry::getDAO('MarkupJobInfoDAO');
		$this->_plugin->import('classes.MarkupJobInfo');
		$markupJobInfo = $markupJobInfoDao->getMarkupJobInfo($jobInfoId);
		$markupJobInfo->setXmlJobId($jobId);
		$markupJobInfoDao->updateMarkupJobInfo($markupJobInfo);

		return $jobId;
	}

	/**
	 * Retrieves conversion archive from OTS server
	 * @param $submissionFile mixed SubmissionFile 
	 * @param $jobId int XML job ID
	 * @param $statusCallbackFn Closure
	 * @param $maxReq int max number of requests to perform
	 * @param $sleep int number of seconds to pause between requests
	 * 
	 * @return boolean|string
	 */
	public function retrieveConversionJobArchive($submissionFile, $jobId, $statusCallbackFn = null, $maxReq = 180, $sleep = 5) {
		$i = 0;
		$jobStatus = null;
		while($i++ < $maxReq) {
			$jobStatus = $this->_xmlpsWrapper->getJobStatus($jobId);
			if (!is_null($statusCallbackFn) && is_callable($statusCallbackFn)) {
				$statusCallbackFn($jobStatus);
			}
			if (($jobStatus != XMLPSWrapper::JOB_STATUS_PENDING) && ($jobStatus != XMLPSWrapper::JOB_STATUS_PROCESSING)) break;
			sleep($sleep);
		}

		// Return FALSE if the job didn't complete
		if ($jobStatus != XMLPSWrapper::JOB_STATUS_COMPLETED) 
			return false;

		// make sure submission file has not been deleted (for instance when user cancel out of wizard)
		$submissionFileDao = DAORegistry::getDAO('SubmissionFileDAO');
		$submissionFile = $submissionFileDao->getLatestRevision($submissionFile->getFileId());
		if (empty($submissionFile)) {
			return false;
		}

		// Download the Zip archive.
		$tmpZipFile = $this->_xmlpsWrapper->downloadFile($jobId);

		return $tmpZipFile;
	}

	/**
	 * Extract archive file.
	 *
	 * @param $zipFile string Path to zip archive
	 *
	 * @return mixed path to extraction directory or false if extraction was not successful
	 */
	public function unzipArchive($zipFile) {

		$validFiles = array(
			'document.pdf',
			'document.xml',
			'document.epub',
		);

		// Extract the zip archive to a markup subdirectory
		$message = '';
		$destination = sys_get_temp_dir() . '/' . uniqid();
		if (!$this->zipArchiveExtract($zipFile, $destination, $message, $validFiles)) {
			echo __(
				'plugins.generic.markup.archive.badZip',
				array(
					'file' => $zipFile,
					'error' => $message
				)
			);
			return false;
		}

		return $destination;
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
	public function zipArchiveExtract($zipFile, $destination, &$message, $validFiles = array()) {
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
	 * Add converted xml document to file list for stage
	 *
	 * @param $journal Journal
	 * @param $submission Submission
	 * @param $filePath string Path to file in archive
	 * @param $params array Additional parameters (file stage, assoc type, assoc id)
	 *
	 * @return void
	 */
	public function addXmlDocumentToSubmissionFileList($journal, $submission, $filePath, $params) {
		$journalId = $journal->getId();
		$submissionId = $submission->getId();

		$genreDao = DAORegistry::getDAO('GenreDAO');
		$genre = $genreDao->getByKey('SUBMISSION', $journalId);
		$genreId = $genre->getId();

		$userGroupDao = DAORegistry::getDAO('UserGroupDAO');

		$fileName = isset($params['filename']) ? "{$params['filename']}.xml" :'document.xml';

		$submissionFileDao = DAORegistry::getDAO('SubmissionFileDAO');
		$submissionFile = $submissionFileDao->newDataObjectByGenreId($genreId);
		$submissionFile->setUploaderUserId($this->user->getId());
		$submissionFile->setSubmissionId($submissionId);
		$submissionFile->setGenreId($genreId);
		$submissionFile->setFileSize(filesize($filePath));
		$submissionFile->setFileStage($params['stage']);
		$submissionFile->setDateUploaded(Core::getCurrentDate());
		$submissionFile->setDateModified(Core::getCurrentDate());
		$submissionFile->setOriginalFileName($fileName);
		$submissionFile->setFileType('text/xml');
		$submissionFile->setViewable(true);
		$submissionFile->setSubmissionLocale($submission->getLocale());
		$submissionFile->setName($fileName, AppLocale::getLocale());

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
	public function addFileToSubmissionGalley($existing_galley_by_labels, $submission, $genreId, $format, $filePath, $params = array()) {

		$submissionId = $submission->getId();

		$galleyFiles = [];
		$articleGalley = null;
		$articleGalleyDao = DAORegistry::getDAO('ArticleGalleyDAO');
		$label = 'XMLPS-' . strtoupper($format) . '-' .  date("MdSY@H:i",time());

		$fileName = isset($params['filename']) ? "{$params['filename']}.{$format}" : "document.{$format}";

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
		$submissionFile->setOriginalFileName($fileName);
		$submissionFile->setSubmissionLocale($submission->getLocale());
		$submissionFile->setName($fileName, AppLocale::getLocale());

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
	 * Performs zip extraction after xml job conversion
	 * @param $extractionPath string
	 * @param $journal Journal
	 * @param $submission Submission
	 * @param $submissionFile SubmissionFile
	 * @param $stage int
	 * @param $fileName string
	 * @return boolean
	 */
	public function handleArchiveExtractionAfterXmlConversion($extractionPath, $journal, $submission, $submissionFile, $stage, $fileName) {
		$params = array(
			'stage' 	=> $stage,
			'assocType' 	=> (int)$submissionFile->getAssocType(),
			'assocId' 	=> (int)$submissionFile->getAssocId(),
			'UserGroupId' 	=> $userGroup->getId(),
			'filename'	=> $fileName,
		);
		$this->addXmlDocumentToSubmissionFileList($journal, $submission, "{$extractionPath}/document.xml", $params);
		return true;
	}

	/**
	 * Performs zip extraction after production ready file conversion
	 * @param $extractionPath string
	 * @param $journal Journal
	 * @param $submission Submission
	 * @param $submissionFile SubmissionFile
	 * @param string $fileName
	 * @return boolean
	 */
	public function handleArchiveExtractionAfterGalleyGenerate($extractionPath, $journal, $submission, $submissionFile, $fileName) {
		$journalId = $journal->getId();
		// Always populate production ready files with xml document.
		$params = array(
			'stage' 	=> SUBMISSION_FILE_PRODUCTION_READY,
			'assocType' 	=> (int)$submissionFile->getAssocType(),
			'assocId' 	=> (int)$submissionFile->getAssocId(),
			'UserGroupId' 	=> $userGroup->getId(),
			'filename' 	=> $fileName
		);
		$this->addXmlDocumentToSubmissionFileList($journal, $submission, "{$extractionPath}/document.xml", $params);
		$wantedFormats = $this->_plugin->getSetting($journalId, 'wantedFormats');
		$genreDao = DAORegistry::getDAO('GenreDAO');
		$genre = $genreDao->getByKey('SUBMISSION', $journalId);

		// retrieve galleys
		$articleGalleyDao = DAORegistry::getDAO('ArticleGalleyDAO');
		$galleys = $articleGalleyDao->getBySubmissionId($submission->getId());
		$existing_galley_by_labels = array();
		while ($galley = $galleys->next()) {
			$existing_galley_by_labels[$galley->getLabel()] = $galley;
		}

		$gParams = array(
			'filename' => $fileName,
			'UserGroupId' 	=> $userGroup->getId(),
		);
		if (in_array('pdf', $wantedFormats)) {
			$this->addFileToSubmissionGalley($existing_galley_by_labels, $submission, $genre->getId(), 'pdf', "{$extractionPath}/document.pdf", $gParams);
		}
		if (in_array('xml', $wantedFormats)) {
			$this->addFileToSubmissionGalley($existing_galley_by_labels, $submission, $genre->getId(), 'xml', "{$extractionPath}/document.xml", $gParams);
		}
		if (in_array('epub', $wantedFormats)) {
			$this->addFileToSubmissionGalley($existing_galley_by_labels, $submission, $genre->getId(), 'epub', "{$extractionPath}/document.epub", $gParams);
		}
		return true;
	}

	/**
	 * Creates markup job info 
	 * @param $journal Journal
	 * @param $user User
	 * @param $fileId int 
	 * @return string
	 */
	public static function createConversionJobInfo($journal, $user, $fileId) {
		$jobId = uniqid();
		$markupJobInfoDao = DAORegistry::getDAO('MarkupJobInfoDAO');
		// using require_once here because I can't use `$this->import('MarkupJobInfo');` since we are in static function
		// and I don't want to use `import('plugins.generic.markup.classes.MarkupJobInfo');`  because I cannot
		// guarantee the plugin folder will always be `markup`. e.g The repo name is ojs3-markup
		require_once(dirname(__FILE__) . '/MarkupJobInfo.inc.php');
		$jobInfo = new MarkupJobInfo();
		$jobInfo->setId($jobId);
		$jobInfo->setFileId($fileId);
		$jobInfo->setUserId($user->getId());
		$jobInfo->setJournalId($journal->getId());
		$jobInfo->setXmlJobId(NULL);
		$markupJobInfoDao->insertMarkupJobInfo($jobInfo);

		return $jobId;
	}

	/**
	 * Return an instance of OTS wrapper
	 * @param $plugin MarkupPlugin
	 * @param $journal Journal
	 * @param $userObject User
	 * @param $useCached boolean Whether the cached object can be reused. 
	 *
	 * @return XMLPSWrapper
	 */
	public static function getOTSWrapperInstance($plugin, $journal, $userObject, $reuseCached = true) {
		// Note: passing $userObject instead of calling $request->getUser() because this 
		// method is often called from gateway plugin and it seems that user session is not available
		if (!is_null(self::$_otsWrapper) && $reuseCached) {
			return self::$_otsWrapper;
		}
		$journalId = $journal->getId();
		// Import host, user and password variables into the current symbol table from an array
		extract($plugin->getOTSLoginParametersForJournal($journal->getId(), $userObject));
		// using require_once here because I can't use `$this->import('XMLPSWrapper');` since we are in static function 
		// and I don't want to use `import('plugins.generic.markup.classes.XMLPSWrapper');`  because I cannot 
		// guarantee the plugin folder will always be `markup`. e.g The repo name is ojs3-markup
		require_once(dirname(__FILE__) . '/XMLPSWrapper.inc.php');
		self::$_otsWrapper = new XMLPSWrapper($host, $user, $password);
		return self::$_otsWrapper;
	}

	/**
	 * Read OTS credentials values from config file
	 * @return array
	 */
	public static function readCredentialsFromConfig() {
		return array(
			'host'		=> Config::getVar('markup', 'ots_host'),
			'user' 		=> Config::getVar('markup', 'ots_login_email'),
			'password' 	=> Config::getVar('markup', 'ots_api_token'),
		);
	}

	/**
	 * Tells wether the user has specified OTS login credentials in the config file
	 * @param $creds array
	 * @return boolean
	 */
	public static function canUseCredentialsFromConfig($creds) {
		if (!isset($creds['host']) || empty($creds['host'])) {
			return false;
		}
		if (!isset($creds['user']) || empty($creds['user'])) {
			return false;
		}
		if (!isset($creds['password']) || empty($creds['password'])) {
			return false;
		}
		return true;
	}
}
