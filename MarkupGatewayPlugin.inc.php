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
    
    protected $user = null;
    protected $plugin = null;
    protected $xmlpsWrapper = null;

    function MarkupGatewayPlugin($parentPluginName) {
        parent::GatewayPlugin();
        
        $this->parentPluginName = $parentPluginName;
        $this->plugin = PluginRegistry::getPlugin('generic', $parentPluginName);
        $this->_initXMLPSWrapper();
    }
    
    /**
     * Initialize xmlps wrapper
     */
    protected function _initXMLPSWrapper() {
        
        $journal = $this->getRequest()->getJournal();
        $journalId = $journal->getId();
        
        $plugin = $this->getMarkupPlugin();
        $host = $plugin->getSetting($journalId, 'markupHostURL');
        $user = $plugin->getSetting($journalId, 'markupHostUser');
        $password = $plugin->getSetting($journalId, 'markupHostPass');

        $this->import('helpers.XMLPSWrapper');
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
            // TODO explicit error message
            echo __('plugins.generic.markup.archive.no_articleID');
            exit;
        }
        $this->user = $userDao->getById($args['userId']);

        $submissionFileDao = DAORegistry::getDAO('SubmissionFileDAO');
        $submissionFile = $submissionFileDao->getLatestRevision($fileId);
        if (empty($submissionFile)) {
            echo __('plugins.generic.markup.archive.no_article');
            exit;
        }
        
        // process
        $this->_process($submissionFile);
    }
    
    
    
    /**
     * Takes care of document markup conversion
     *
     * @param $submissionFile mixed SubmissionFile 
     *
     * @return void
     */
    function _process($submissionFile) {
        
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
            $jobId = $this->xmlpsWrapper->submitJob($filename, $fileContent, $citationStyle);
            
            // retrieve job archive from markup server
            $i = 0;
            $jobStatus = null;
            while($i++ < 60) {
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
        
        $wantedFormats = $plugin->getSetting($journalId, 'wantedFormats');
        $overrideGalley = (bool) intval($plugin->getSetting($journalId, 'overrideGalley'));
        
        $genreDao = DAORegistry::getDAO('GenreDAO');
        $genre = $genreDao->getByKey('SUBMISSION', $journalId);
        
        // retrieve galleys
        $articleGalleyDao = DAORegistry::getDAO('ArticleGalleyDAO');
        $galleys = $articleGalleyDao->getBySubmissionId($submission->getId());
        $existing_galley_by_labels = array();
        while ($galley = $galleys->next()) {
            $existing_galley_by_labels[$galley->getLabel()] = $galley;
        }
        
        if (in_array('html', $wantedFormats)) {
            $this->_addFileToGalley($existing_galley_by_labels, $submission, $genre->getId(), 'html', "{$extractionPath}/html/document.html", $overrideGalley);
        }
        if (in_array('pdf', $wantedFormats)) {
            $this->_addFileToGalley($existing_galley_by_labels, $submission, $genre->getId(), 'pdf', "{$extractionPath}/document.pdf", $overrideGalley);
        }
        if (in_array('xml', $wantedFormats)) {
            $this->_addFileToGalley($existing_galley_by_labels, $submission, $genre->getId(), 'xml', "{$extractionPath}/document.xml", $overrideGalley);
        }
        if (in_array('epub', $wantedFormats)) {
            $this->_addFileToGalley($existing_galley_by_labels, $submission, $genre->getId(), 'epub', "{$extractionPath}/document.epub", $overrideGalley);
        }
        
        @unlink($tmpZipFile);
        @rmdir($extractionPath);
    }
    
    /**
     * Add a document as galley file
     *
     * @param $existing_galley_by_labels array Array of existing galleys for submission indexed by label
     * @param $submission object Submission object
     * @param $genreId int Genre ID 
     * @param $format string Asset format 
     * @param $fileName string File to process
     * @param $overrideGalley boolean whether galley should be overwritten
     *
     * @return object Submission file object 
     */
    function _addFileToGalley($existing_galley_by_labels, $submission, $genreId, $format, $filePath, $overrideGalley) {
        
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
            case 'html':
                $submissionFile->setFileType('text/html');
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
     * Instantiates a submission file depending of whether it's first galley file and plugin settings 
     *
     * @param $genreId genre id
     * @param $galleyFiles latest galley files
     * @param $overrideGalley plugin setting value
     *
     * @return SubmissionFile Submission File object instance
     */
    /* 
    protected function _getSubmissionFile ($genreId, $galleyFiles, $overrideGalley)
    {
        $submissionFileDao = DAORegistry::getDAO('SubmissionFileDAO');
        
        // empty article galley or article galley not empty but file override disabled
        if (empty($galleyFiles) || (!empty($galleyFiles) && !$overrideGalley)) {
            return $submissionFileDao->newDataObjectByGenreId($genreId);
        }
        
        $latestGalleyFile = array_pop($galleyFiles);
        $fileId = $latestGalleyFile->getFileId();
        
        $revisionNumber = $submissionFileDao->getLatestRevisionNumber($fileId);
        $revision = $revisionNumber + 1;
        
        $submissionFile = $submissionFileDao->getLatestRevision($fileId);
        $submissionFile->setRevision($revision);
        return $submissionFile;
    }
    */
    
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
            'html.zip',
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
        
        // If we got a html.zip extract this to html subdirectory
        $htmlZipFile = $destination . '/html.zip';
        if (file_exists($htmlZipFile)) {
            if (!$this->_zipArchiveExtract($htmlZipFile, $destination . '/html', $message)) {
                echo __(
                    'plugins.generic.markup.archive.bad_zip',
                    array(
                        'file' => $htmlZipFile,
                        'error' => $message
                    )
                );
                return false;
            }
            // unlink($htmlZipFile);
        }
        
        return $destination;
    }
    
}
