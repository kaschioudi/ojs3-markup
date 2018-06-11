<?php 

/**
 * @file plugins/generic/markup/classes/MarkupBatchConversionHelper.inc.php
 *
 * Copyright (c) 2003-2018 Simon Fraser University
 * Copyright (c) 2003-2018 John Willinsky
 * Distributed under the GNU GPL v2. For full terms see the file docs/COPYING.
 *
 * @class MarkupBatchGatewayPlugin
 * @ingroup plugins_generic_markup
 *
 * @brief Batch conversion Helper class
 *
 */

class MarkupBatchConversionHelper {
	/** @var $outFile string Path to file used for inter process communication */
	protected $_outFile = null;

	/**
	 * Constructor
	 */
	public function __construct() {
		$this->_outFile = sys_get_temp_dir() . '/markupBatch.out';
	}
	/**
	 * Determines whether a conversion is already running 
	 * @return boolean
	 */
	public function isRunning() {
		return file_exists($this->_outFile);
	}
	
	/**
	 * Helper function to create a temporary file containing some data
	 * @param $data array
	 * @throws Exception
	 */
	public function createOutFile($data) {
		if (file_exists($this->_outFile)) {
			throw new Exception(__('plugins.generic.markup.file-exists', array('file' => $this->_outFile)));
		}
		else {
			file_put_contents($this->_outFile, serialize($data));
		}
	}

	/**
	 * Update file content
	 * @param array $data
	 */
	public function updateOutFile($data) {
		file_put_contents($this->_outFile, serialize($data), LOCK_EX);
	}

	/**
	 * Read the file content
	 * @return array|null
	 */
	public function readOutFile() {
		if ($this->isRunning()) {
			$content = file_get_contents($this->_outFile);
			return unserialize($content);
		}
		return null;
	}

	/**
	 * Helper function to delete the temporary file
	 */
	public function deleteOutFile() {
		if (file_exists($this->_outFile)) {
			unlink($this->_outFile);
		}
	}

	/**
	 * Custom error handler callback to cleanup in case of runtime error
	 * @param $errno int
	 * @param $errstr string
	 * @param $errfile string
	 * @param $errline int
	 * @return boolean
	 */
	public function errorHandler($errno, $errstr, $errfile, $errline) {
		$this->deleteOutFile();
		// returning false because we still want PHP internal error handler to run
		return false;
	}


	/**
	 * Build an array of submissions metadata to process
	 * @param $contextId int
	 * @return array
	 */
	public function buildSubmissionMetadataByContext($contextId) {
		$metadata = array();
		$locale = AppLocale::getLocale();
		$genreDao = DAORegistry::getDAO('GenreDAO');
		$submissionDao = DAORegistry::getDAO('ArticleDAO');
		$submissionFileDao = DAORegistry::getDAO('SubmissionFileDAO');
		$submissions = $submissionDao->getByContextId($contextId);
		import('lib.pkp.classes.file.SubmissionFileManager');
		$validFileExtensions = array('pdf','doc','docx','xml');
		$pdfGalleyFileId = null;
		$pdfProductionReadyFileId = null;
		$xmlProductionReadyFileId = null;

		import('lib.pkp.classes.submission.SubmissionFile'); // Bring in const
		// TODO Validate this with Alec
		// do we need more const here?
		// Do these values make sense?
		// Unable to find titles for SUBMISSION_FILE_FAIR_COPY and SUBMISSION_FILE_PUBLIC
		$fileStageNames = array(
			SUBMISSION_FILE_SUBMISSION 		=> __('submission.submit.submissionFiles'),
			SUBMISSION_FILE_REVIEW_FILE 		=> __('reviewer.submission.reviewFiles'),
			SUBMISSION_FILE_COPYEDIT 		=> __('submission.copyedited'),
			SUBMISSION_FILE_PROOF 			=> __('submission.pageProofs'),
			SUBMISSION_FILE_PRODUCTION_READY	=> __('editor.submission.production.productionReadyFiles'),
			SUBMISSION_FILE_ATTACHMENT		=> __('grid.reviewAttachments.title'),
			SUBMISSION_FILE_FAIR_COPY		=> 'SUBMISSION_FILE_FAIR_COPY',//__(''),
			SUBMISSION_FILE_QUERY			=> __('submission.queries.attachedFiles'),
			SUBMISSION_FILE_REVIEW_ATTACHMENT	=> __('grid.reviewAttachments.title'),
			SUBMISSION_FILE_REVIEW_REVISION		=> __('editor.submission.revisions'),
			SUBMISSION_FILE_PUBLIC			=> 'SUBMISSION_FILE_PUBLIC',//__(''),
		);

		while ($submission = $submissions->next()) {
			$pdfGalleyFileId = null;
			//Exclude incomplete submissions
			if ($submission->getSubmissionProgress() != 0) {
				continue;
			}
			$hasXmlInProductionReady = false;
			$sMetadata = array(
				'id'	=> $submission->getId(),
				'stage'	=> $submission->getStageId(),
				'title' => $submission->getFullTitle($locale),
				'files' => array(),
			);
			$submissionFileManager = new SubmissionFileManager($contextId, $submission->getId());
			$submissionFiles = $submissionFileDao->getBySubmissionId($submission->getId());
			foreach ($submissionFiles as $submissionFile) {
				$genre = $genreDao->getById($submissionFile->getGenreId());
				$fileStage = $submissionFile->getFileStage();
				$fileExtension = strtolower($submissionFile->getExtension());
				if (!$genre || (intval($genre->getCategory()) != GENRE_CATEGORY_DOCUMENT))
					continue;
				if (!in_array($fileExtension, $validFileExtensions))
					continue;
				// check whether xml file is present in production ready
				if (($fileExtension == 'xml') && ($fileStage == SUBMISSION_FILE_PRODUCTION_READY)) {
					$hasXmlInProductionReady = true;
				}

				// check if there's a publish pdf in galleys or production ready
				if ($fileExtension == 'pdf') {
					if ($fileStage == SUBMISSION_FILE_PROOF) {
						$pdfGalleyFileId = $submissionFile->getFileId();
					}
					if ($fileStage == SUBMISSION_FILE_PRODUCTION_READY) {
						$pdfProductionReadyFileId = $submissionFile->getFileId();
					}
				}
				if (in_array($fileExtension, array('doc','docx'))) {
					if ($fileStage == SUBMISSION_FILE_PRODUCTION_READY) {
						$xmlProductionReadyFileId = $submissionFile->getFileId();
					}
				}
				$sMetadata['files'][] = array(
					'fileId' 	=> $submissionFile->getFileId(),
					'filename'	=> $submissionFile->getName($locale),
					'fileStage'	=> $fileStageNames[$fileStage],
				);
			}

			// decide on submission file to select by default
			$defaultSubmissionFileId = 0;
			if (!$hasXmlInProductionReady) {
				if (!is_null($pdfGalleyFileId)) {
					$defaultSubmissionFileId = $pdfGalleyFileId;
				}
				elseif (!is_null($pdfProductionReadyFileId)) {
					$defaultSubmissionFileId = $pdfProductionReadyFileId;
				}
				elseif (!is_null($xmlProductionReadyFileId)) {
					$defaultSubmissionFileId = $xmlProductionReadyFileId;
				}
				else {
					$defaultSubmissionFileId = 0;
				}
			}
			$sMetadata['defaultSubmissionFileId'] = $defaultSubmissionFileId;
			$sMetadata['pdfGalleyFileId'] = $pdfGalleyFileId;
			$sMetadata['pdfProductionReadyFileId'] = $pdfProductionReadyFileId;
			$sMetadata['xmlProductionReadyFileId'] = $xmlProductionReadyFileId;
			$metadata[] = $sMetadata;
		}
		return $metadata;
	}
}