<?php

/**
 * @file plugins/generic/markup/MarkupPluginUtilities.inc.php
 *
 * Copyright (c) 2003-2013 John Willinsky
 * Distributed under the GNU GPL v2. For full terms see the file docs/COPYING.
 *
 * @class MarkupPluginUtilities
 * @ingroup plugins_generic_markup
 *
 * @brief helper functions
 *
 */

// Plugin gateway path folder.
define('MARKUP_GATEWAY_FOLDER', 'markupplugin');
// Title of suplementary files on markup server
define('MARKUP_SUPPLEMENTARY_FILE_TITLE', 'Document Markup Files');

class MarkupPluginUtilities {

    /**
     * Show a notification to the user
     *
     * @param $message string Translated text to display
     * @param $typeFlag bool Success/Error message
     * @param $userId int UserId of user to notify
     */
    function showNotification($message, $typeFlag = true, $userId = null) {

        import('classes.notification.NotificationManager');
        $notificationManager = new NotificationManager();

        $notificationType = NOTIFICATION_TYPE_SUCCESS;
        if ($typeFlag == false) {
            $notificationType = NOTIFICATION_TYPE_ERROR;
        }

        // If user not specified explicitly, then include current user.
        if (!isset($userId)) {
            $user =& Request::getUser();
            $userId = $user->getId();
        }
        if (isset($userId)) {
            $notificationManager->createTrivialNotification(
                $userId,
                $notificationType,
                array('contents' => $message)
            );
        }
    }

    /**
     * Return article's supplementary files directory.
     *
     * @param $articleId int ArticleId
     *
     * @return string Supplementary file folder path
     */
    function getSuppFolder($articleId) {
        import('classes.file.ArticleFileManager');
        $articleFileManager = new ArticleFileManager((int) $articleId);
        return $articleFileManager->filesDir . $articleFileManager->fileStageToPath(ARTICLE_FILE_SUPP);
    }

    /**
     * Return requested markup file to user's browser.
     *
     * @param $folder string Server file path
     * @param $fileName string Name of file to download
     *
     * @return void
     */
    function downloadFile($folder, $fileName) {
        $filePath = $folder . $fileName;
        $fileManager = new FileManager();

        if (!$fileManager->fileExists($filePath)) {
            return self::showNotification(
                __(
                    'plugins.generic.markup.archive.no_file',
                    array('file' => $fileName)
                )
            );
        }

        $mimeType = self::getMimeType($filePath);
        $fileManager->downloadFile($filePath, $mimeType, true);

        exit;
    }

    /**
     * Clean markup plugin media files related to an article if no XML or HTML
     * galley links are left.
     *
     * @param $articleId int ArticleID
     * @param $type string What document type to discard if not provided all galley media will be discarded
     *
     * @return void
     */
    function cleanGalleyMedia($articleId, $type = '') {
        $galleyDao =& DAORegistry::getDAO('ArticleGalleyDAO');
        $galleys =& $galleyDao->getGalleysByArticle($articleId);

        $keep = array();
        if (!empty($type)) {
            foreach ($galleys as $galley) {
                $label = $galley->getLabel();
                if ($label == 'XML' && $type != 'XML') $keep['xml'] = true;
                if ($label == 'HTML' && $type != 'HTML') $keep['html'] = true;
                if ($label == 'PDF' && $type != 'PDF') $keep['pdf'] = true;
            };
        }

        $suppFolder = self::getSuppFolder($articleId) . '/markup/';

        $deletes = array();
        if ($keep) {
            if (!isset($keep['xml'])) {
                $deletes[] = $suppFolder . 'document.xml';
            }
            if (!isset($keep['html'])) {
                $deletes[] = $suppFolder . 'html';
            }
            if (!isset($keep['pdf'])) {
                $deletes[] = $suppFolder . 'document.pdf';
            }
        } else {
            $deletes[] = $suppFolder;
        }

        foreach ($deletes as $delete) {
            if (!file_exists($delete)) continue;

            if (is_file($delete)) {
                unlink($delete);
            } else {
                $rdi = new RecursiveDirectoryIterator($delete, FilesystemIterator::SKIP_DOTS);
                $rii = new RecursiveIteratorIterator($rdi, RecursiveIteratorIterator::CHILD_FIRST);
                foreach($rii as $path) {
                    $path->isFile() ? unlink($path->getPathname()) : rmdir($path->getPathname());
                }
                rmdir($delete);
            }
        }
    }

    /**
     * Return mime type of a file
     *
     * @param $file string File to get mimetype for
     *
     * @return string Mime type of the file
     */
    function getMimeType($file) {
        $finfo = finfo_open(FILEINFO_MIME_TYPE);
        return finfo_file($finfo, $file);
    }

    /**
     *
     * Build the URL to query the markup server
     *
     * @param $plugin mixed Plugin to process the Request for
     * @param $action string API action
     * @param $params array Query parameters
     *
     * @return string Markup server query URL
     */
    function apiUrl($plugin, $action, $params = array()) {
        $journal = Request::getJournal();
        $journalId = $journal->getId();

        $apiUrl = $plugin->getSetting($journalId, 'markupHostURL');
        $apiUrl = rtrim($apiUrl, '/');

        $apiUrl = $apiUrl . '/api/job/' .  $action;

        if ($params) {
            $apiUrl .= '?' . http_build_query($params);
        }

        return $apiUrl;
    }

    /**
     * Call the markup server API
     *
     * @param $plugin mixed Plugin to process the Request for
     * @param $action string API action
     * @param $params array Query/POST parameters
     * @param $method Whether to use a GET/POST request
     * @param $method Whether to execute the curl request or to just return the cannel and url
     *
     * @return mixed API response
     */
    function apiRequest($plugin, $action, $params = array(), $isPost = false, $execute = true) {
        $journal = Request::getJournal();
        $journalId = $journal->getId();

        $ch = curl_init();
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, 1);

        $params['email'] = $plugin->getSetting($journalId, 'markupHostUser');
        $params['password'] = $plugin->getSetting($journalId, 'markupHostPass');

        if ($isPost) {
            curl_setopt($ch, CURLOPT_POST, 1);
            curl_setopt($ch, CURLOPT_POSTFIELDS, $params);
            $params = array();
        }

        $apiUrl = self::apiUrl($plugin, $action, $params);

        if (!$execute) {
            return array('channel' => $ch, 'apiUrl' => $apiUrl);
        }

        curl_setopt($ch, CURLOPT_URL, $apiUrl);

        $response = curl_exec($ch);

        $response = json_decode($response, true);
        if (!$response) {
            $error = curl_error($ch);
            if (empty($error)) {
                $error = 'HTTP status: ' . curl_getinfo($ch, CURLINFO_HTTP_CODE);
            }

            $response = array(
                'status' => 'error',
                'error' => $error,
            );
        }

        curl_close($ch);

        return $response;
    }


    /**
     * Submit a file to the markup server for conversion
     *
     * @param $plugin mixed Plugin to submit the file for
     * @param $fileName string File name
     * @param $filePath string File path
     *
     * @return mixed API response
     */
    function submitFile($plugin, $fileName, $filePath) {
        $journal = Request::getJournal();
        $journalId = $journal->getId();

        $params = array(
            'fileName' => $fileName,
            'fileContent' => file_get_contents($filePath),
            'citationStyleHash' => $plugin->getSetting($journalId, 'cslStyle'),
        );
        
        return self::apiRequest($plugin, 'submit', $params, true);
    }

    /**
     * Get the converted file URL
     *
     * @param $plugin mixed Plugin to retrieve the file for
     * @param $jobId Job Id
     * @param $conversionStage What conversion stage to retrieve
     *
     * @return mixed API response
     */
    function getFileUrl($plugin, $jobId, $conversionStage) {
        $params = array(
            'id' => $jobId,
            'conversionStage' => $conversionStage,
        );

        $data = self::apiRequest($plugin, 'retrieve', $params, false, false);

        return $data['apiUrl'];
    }

    /**
     * Get the converted ZIP file URL
     *
     * @param $plugin mixed Plugin to retrieve the file for
     * @param $jobId Job Id
     *
     * @return mixed API response
     */
    function getZipFileUrl($plugin, $jobId) {

        return self::getFileUrl($plugin, $jobId, 10);
    }

    /**
     * Retrieve a job status from markup server
     *
     * @param $plugin mixed Plugin to retrieve the job status for
     * @param $jobId Job Id
     *
     * @return mixed API response
     */
    function getJobStatus($plugin, $jobId) {
        $params = array(
            'id' => $jobId,
        );

        return self::apiRequest($plugin, 'status', $params);
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
    function zipArchiveExtract($zipFile, $destination, &$message, $validFiles = array()) {
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
}
