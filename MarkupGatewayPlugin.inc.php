<?php

/**
 * @file plugins/generic/markup/MarkupGatewayPlugin.inc.php
 *
 * Copyright (c) 2003-2013 John Willinsky
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
    var $parentPluginName;

    function MarkupGatewayPlugin($parentPluginName) {
        parent::GatewayPlugin();
        $this->parentPluginName = $parentPluginName;
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
        $plugin =& PluginRegistry::getPlugin('generic', $this->parentPluginName);
        return $plugin;
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
     * Handles URL requests to trigger document markup processing for given
     * article; also handles download requests for xml/pdf/html/epub versions of an
     * article as well as the html's css files
     *
     * Accepted parameters:
     *   fileId/[int],
     *   fileName/[string]
     *   refresh/[bool]
     *   refreshGalley/[bool]
     *   css/[string]
     *   js/[string]
     *   userId/[int]
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
        $journal =& Request::getJournal();
        if (!$journal) {
            echo __('plugins.generic.markup.archive.no_journal');
            exit;
        }

        // Handles requests for css files
        if (isset($args['css'])) {
            $this->_downloadMarkupCSS($journal, $args['css']);
            exit;
        }

        // Handles requests for js files
        if (isset($args['js'])) {
            $this->_downloadMarkupJS($args['js']);
            exit;
        }

        // Load the article
        $fileId = isset($args['fileId']) ? (int) $args['fileId'] : false;
        if (!$fileId) {
            echo __('plugins.generic.markup.archive.no_articleID');
            exit;
        }

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
        $this->import('MarkupPluginUtilities');
        
        $submissionDao = Application::getSubmissionDAO();
        $submission = $submissionDao->getById($submissionFile->getSubmissionId());
        
        // submit file to markup server
        $filePath = $submissionFile->getFilePath();
        $filename = basename($filePath);
        
        $apiResponse = MarkupPluginUtilities::submitFile($this->getMarkupPlugin(), $filename, $filePath);
        if ($apiResponse['status'] == 'error') {
            echo $apiResponse['error'];
            return;
        }
        
        $jobId = $apiResponse['id'];
        
        // retrieve job archive from markup server
        $i = 0;
        while($i++ < 60) {
            $apiResponse = MarkupPluginUtilities::getJobStatus($this->getMarkupPlugin(), $jobId);
            if (($apiResponse['jobStatus'] != 0) && ($apiResponse['jobStatus'] != 1)) break; // Jobstatus 0 - pending ; Jobstatus 1 - Processing
            sleep(5);
        }
        
        // Return if the job didn't complete
        if ($apiResponse['jobStatus'] != 2) return;
        
        // make sure submission file has not been deleted (for instance when user cancel out of wizard)
        $submissionFileDao = DAORegistry::getDAO('SubmissionFileDAO');
        $submissionFile = $submissionFileDao->getLatestRevision($submissionFile->getFileId());
        if (empty($submissionFile)) {
            echo __('plugins.generic.markup.archive.no_file');
            exit;
        }
        
        // Download the Zip archive.
        $url = MarkupPluginUtilities::getZipFileUrl($this->getMarkupPlugin(), $jobId);
        $tmpZipFile = sys_get_temp_dir() . '/documents.zip';
        @unlink($tmpZipFile);
        @copy($url, $tmpZipFile);
        
        if (!file_exists($tmpZipFile)) return;
        
        // save archive as production ready file
        // @TODO @TBD
        
        
        // Extract archive
        $extractionPath = null;
        if (($extractionPath = $this->_unzipArchive($tmpZipFile)) === false) {
            return;
        }
        
        // save relevant documents
        $journal =& Request::getJournal();
        $journalId = $journal->getId();
        $plugin =& $this->getMarkupPlugin();
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
     * @param $overrideGalley boolean whether galley should be overriden
     *
     * @return object Submission file object 
     */
    function _addFileToGalley($existing_galley_by_labels, $submission, $genreId, $format, $filePath, $overrideGalley) {
        $submissionId = $submission->getId();
        
        // galley type
        $galley_type = 'downloadablefilearticlegalleyplugin';
        if ($format == 'pdf') {
            $galley_type = 'pdfjsviewerplugin';
        }
        elseif ($format == 'html') {
            $galley_type = 'htmlarticlegalleyplugin';
        }
        
        $galleyFiles = [];
        $articleGalley = null;
        $label = 'XMLPS ' . strtoupper($format);
        if (!in_array($label, array_keys($existing_galley_by_labels))) {
            // create new galley
            $articleGalleyDao = DAORegistry::getDAO('ArticleGalleyDAO');
            $articleGalley = $articleGalleyDao->newDataObject();
            $articleGalley->setSubmissionId($submissionId);
            $articleGalley->setLabel('XMLPS ' . strtoupper($format));
            $articleGalley->setLocale($submission->getLocale());
            $articleGalley->setGalleyType($galley_type);
            $articleGalleyDao->insertObject($articleGalley);
        }
        else {
            // work with existing
            $articleGalley = $existing_galley_by_labels[$label];
            
            // if override enabled delete previous entry in the galley
            $galleyFiles = $articleGalley->getLatestGalleyFiles();
        }
        
        
        $submissionFileDao = DAORegistry::getDAO('SubmissionFileDAO');
        $submissionFile = $this->_getSubmissionFile($galleyFiles, $overrideGalley);
        
        $submissionFile->setSubmissionId($submissionId);
        $submissionFile->setGenreId($genreId);
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
        
        return $insertedFile;
    }
    
    /**
     * Instantiates a submission file depending of whether it's first galley file and plugin settings 
     *
     * @param $galleyFiles latest galley files
     * @param $overrideGalley plugin setting value
     *
     * @return SubmissionFile Submission File object instance
     */
    protected function _getSubmissionFile ($galleyFiles, $overrideGalley)
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
        if (!MarkupPluginUtilities::zipArchiveExtract($zipFile, $destination, $message, $validFiles)) {
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
            if (!MarkupPluginUtilities::zipArchiveExtract($htmlZipFile, $destination . '/html', $message)) {
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
    
    /**
     * Returns a journal's CSS file to the browser. If the journal doesn't have
     * one fall back to the one provided by the plugin
     *
     * @param $journal mixed Journal to fetch CSS for
     * @param $fileName string File name of the CSS file to fetch
     *
     * @return bool Whether or not the CSS file exists
     */
    function _downloadMarkupCSS($journal, $fileName) {
        import('classes.file.JournalFileManager');

        // Load the journals CSS path
        $journalFileManager = new JournalFileManager($journal);
        $cssFolder = $journalFileManager->getBasePath() . 'css/';

        // If journal CSS path doesn't exist fall back to plugin's CSS path
        if (!file_exists($cssFolder . $fileName)) {
            $cssFolder = $this->getCssPath();
        }

        return MarkupPluginUtilities::downloadFile($cssFolder, $fileName);
    }
    
    /**
     * Offers the plugins article JS file for download
     *
     * @param $fileName string File name of the JS file to fetch
     *
     * @return bool Whether or not the JS file exists
     */
    function _downloadMarkupJS($fileName) {
        return MarkupPluginUtilities::downloadFile($this->getJsPath(), $fileName);
    }
    
}
