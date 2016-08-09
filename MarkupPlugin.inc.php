<?php

/**
 * @file plugins/generic/markup/MarkupPlugin.inc.php
 *
 * Copyright (c) 2003-2016 Simon Fraser University Library
 * Copyright (c) 2003-2016 John Willinsky
 * Distributed under the GNU GPL v2. For full terms see the file docs/COPYING.
 *
 * @class MarkupPlugin
 * @ingroup plugins_generic_markup
 *
 * @brief NLM XML and HTML transform plugin class
 *
 * Specification:
 *
 * When an author, copyeditor or editor uploads a new version (odt, docx, doc,
 * or pdf format) of a submission, this module submits it to the Document Markup
 * Server specified in the configuration file. 
 *
 * manifest.xml document-new.pdf (layout version of PDF) document-review.pdf
 * (review version of PDF, header author info stripped) document.xml
 * (NLM-XML3/JATS-compliant) document.html (web-viewable article version)
 *
 * This plugin extracts
 * the html, xml, epub and pdf versions and places them in the galley. 
 *
 */

import('lib.pkp.classes.plugins.GenericPlugin');

class MarkupPlugin extends GenericPlugin {
    
    /**
     * Get the system name of this plugin.
     * The name must be unique within its category.
     *
     * @return string Name of plugin
     */
    function getName() {
        return 'markupplugin';
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
     * Display verbs for the management interface.
     */
    function getManagementVerbs() {
        $verbs = parent::getManagementVerbs();
        if ($this->getEnabled()) {
            $verbs[] = array('settings', __('plugins.generic.markup.settings'));
        }
        return $verbs;
    }
    
    /**
     * Register the plugin
     *
     * @param $category string Plugin category
     * @param $path string Plugin path
     *
     * @return bool True on successful registration false otherwise
     */
    function register($category, $path) {
        
        if (parent::register($category, $path)) {
            if ($this->getEnabled()) {
                $this->import('MarkupPluginUtilities');
                // Register callbacks.
                HookRegistry::register('PluginRegistry::loadCategory', array($this, 'callbackLoadCategory'));
                HookRegistry::register('submissionfiledaodelegate::_updateobject', array($this, 'fileToMarkupCallback'));
            }
            return true;
        }
        return false;
    }
    
    /**
    * @see PluginRegistry::loadCategory()
    */
    function callbackLoadCategory($hookName, $args) {
        $category = $args[0];
        $plugins =& $args[1];
        if ($category == 'gateways') {
            $this->import('MarkupGatewayPlugin');
            $gatewayPlugin = new MarkupGatewayPlugin($this->getName());
            $plugins[$gatewayPlugin->getSeq()][$gatewayPlugin->getPluginPath()] =& $gatewayPlugin;
        }
    }
    
    /**
     * Trigger document conversion from various hooks for editor, section
     * editor, layout editor etc. uploading of documents.
     *
     * @param string $hookName Name of the hook
     * @param array $params [article object , ...]
     *
     * @return void
     */
    function fileToMarkupCallback($hookName, $params) {
        
        $args = $params[1];
        $fileId = $args[0];
        $file_stage = $args[8];
        $assoc_type = $args[12];
        
        // trigger only for galley files @TODO
        // if ($assoc_type != ASSOC_TYPE_GALLEY) {
            // return;
        // }
        
        
        $genreDao = DAORegistry::getDAO('GenreDAO');
        $submissionFileDao = DAORegistry::getDAO('SubmissionFileDAO');
        $submissionFile = $submissionFileDao->getLatestRevision($fileId);
        $filePath = $submissionFile->getFilePath();
        $mediaType = $submissionFile->getFileType();
        
        $genre = $genreDao->getById($submissionFile->getGenreId());
        if ($genre->getSupplementary()) {
            return;
        }
        
        // Trigger the conversion and retrieval of the converted document
        $this->_triggerGatewayRetrieval($fileId, true);
    }
    
    /**
     * Triggers the retrieval of the converted document via
     * MarkupGatewayPlugin::fetch()
     *
     * @param $fileId int fileId to retrieve converted archive for
     * @param $galleyFlag bool Whether or nor to create the galleys too
     *
     * @return void
     */
    function _triggerGatewayRetrieval($fileId, $galleyFlag = false) {
        
        $request = $this->getRequest();
        $user = Request::getUser();

        $path = array(
            MARKUP_GATEWAY_FOLDER,
            'fileId', $fileId,
            'userId', $user->getId()
        );

        $url = Request::url(null, 'gateway', 'plugin', null, array('MarkupGatewayPlugin', 'fileId', $fileId));
        $router = $request->getRouter();
        $dispatcher = $router->getDispatcher();
        $journal = $request->getJournal();
        $url = $dispatcher->url($request, ROUTE_PAGE, $journal, 'gateway', 'plugin', array('MarkupGatewayPlugin','fileId', $fileId));

        $ch = curl_init();
        curl_setopt($ch, CURLOPT_URL, $url);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, 1);
        curl_setopt($ch, CURLOPT_TIMEOUT_MS, 1000);
        curl_exec($ch);
        curl_close($ch);
    }
    
    /**
     * @see PKPPlugin::getContextSpecificPluginSettingsFile()
     * @return string
     */
    function getContextSpecificPluginSettingsFile() {
        return $this->getPluginPath() . '/settings.xml';
    }
    
    /**
     * Get plugin JS path
     *
     * @return string Public plugin JS path
     */
    function getJsPath() {
        $baseDir = Core::getBaseDir();
        return $baseDir . '/' . parent::getPluginPath() . '/js/';
    }
    
    /**
     * Get plugin CSS URL
     *
     * @return string Public plugin CSS URL
     */
    function getCssUrl() {
        return Request::getBaseUrl() . '/' . parent::getPluginPath() . '/css/';
    }
    
    /**
     * Get plugin JS URL
     *
     * @return string Public plugin JS URL
     */
    function getJsUrl() {
        return Request::getBaseUrl() . '/' . parent::getPluginPath() . '/js/';
    }
    
    /**
     * Override the builtin to get the correct template path.
     *
     * @return string Plugin template path
     */
    function getTemplatePath() {
        return parent::getTemplatePath() . 'templates/';
    }
    
    /**
    * @see PKPPlugin::manage()
    */
    function manage($verb, $args, &$message, &$messageParams, &$pluginModalContent = null) {
        $returner = parent::manage($verb, $args, $message, $messageParams);
        if (!$returner) return false;
        
        $request = $this->getRequest();
        $this->import('MarkupSettingsForm');
        
        $journal = $request->getJournal();
        
        switch($verb) {
            case 'settings':
                $templateMgr = TemplateManager::getManager();
                $templateMgr->register_function('plugin_url', array(&$this, 'smartyPluginUrl'));
                $settingsForm = new MarkupSettingsForm($this, $journal->getid());
                $settingsForm->initData();
                $pluginModalContent = $settingsForm->fetch($request);
                break;
                
            case 'save':
                $settingsForm = new MarkupSettingsForm($this, $journal->getid());
                $settingsForm->readInputData();
                if ($settingsForm->validate()) {
                    $settingsForm->execute();
                    $message = NOTIFICATION_TYPE_SUCCESS;
                    $messageParams = array('contents' => __('plugins.generic.markup.settings.saved'));
                    return false;
                } 
                else {
                    $pluginModalContent = $settingsForm->fetch($request);
                }
                break;
                
            default:
                return $returner;
        }
        return true;
    }
    
    /**
     * @see Plugin::getManagementVerbLinkAction()
     */
    function getManagementVerbLinkAction($request, $verb) {
        $router = $request->getRouter();

        list($verbName, $verbLocalized) = $verb;

        if ($verbName === 'settings') {
            import('lib.pkp.classes.linkAction.request.AjaxModal');
            $actionRequest = new AjaxModal(
                $router->url($request, null, null, 'plugin', null, array('verb' => 'settings', 'plugin' => $this->getName(), 'category' => 'generic')),
                $this->getDisplayName()
            );
            return new LinkAction($verbName, $actionRequest, $verbLocalized, null);
        }
    }
    
}