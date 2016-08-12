<?php

/**
* @file plugins/generic/markup/MarkupSettingsForm.inc.php
*
* Copyright (c) 2003-2016 Simon Fraser University Library
* Copyright (c) 2003-2016 John Willinsky
* Distributed under the GNU GPL v2. For full terms see the file docs/COPYING.
*
* @class MarkupSettingsForm
* @ingroup plugins_generic_markup
*
* @brief Form for Document Markup gateway plugin settings
*/

import('lib.pkp.classes.form.Form');

define('MARKUP_CSL_STYLE_DEFAULT', '674e1c66aa817a0713a410915ac1b298');
define('MARKUP_DOCUMENT_SERVER_URL_DEFAULT', 'http://pkp-xml-test.lib.sfu.ca/');

class MarkupSettingsForm extends Form {
    
    /** @var $journalId int */
    var $journalId;

    /** @var $plugin object */
    var $plugin;

    /** @var $settings array */
    var $settings;
    
    /**
     * Constructor
     * @param $plugin mixed Plugin object
     * @param $journalId int JournalId
     */
    function MarkupSettingsForm($plugin, $journalId) {
        $this->journalId = $journalId;
        $this->plugin = $plugin;
        
        parent::Form($plugin->getTemplatePath() . 'settingsForm.tpl');

        // Validation checks for this form
        $this->settings = array(
            'cslStyle' => 'string',
            'markupHostPass' => 'string',
            'markupHostURL' => 'string',
            'markupHostUser' => 'string',
            'overrideGalley' => 'bool',
            'wantedFormats' => 'object',
        );
    }
    
    /**
     * Initialize plugin settings form
     *
     * @return void
     */
    function initData() {
        $journalId = $this->journalId;
        $plugin = $this->plugin;

        // User must at least load settings page for plugin to work with defaults.
        if ($plugin->getSetting($journalId, 'cslStyle') == '') {
            $plugin->updateSetting($journalId, 'cslStyle', MARKUP_CSL_STYLE_DEFAULT);
        }
        if ($plugin->getSetting($journalId, 'markupHostURL') == '') {
            $plugin->updateSetting($journalId, 'markupHostURL', MARKUP_DOCUMENT_SERVER_URL_DEFAULT);
        }

        $this->setData('cslStyle', $plugin->getSetting($journalId, 'cslStyle'));
        $this->setData('markupHostUser', $plugin->getSetting($journalId, 'markupHostUser'));
        $this->setData('markupHostURL', $plugin->getSetting($journalId, 'markupHostURL'));
        $this->setData('overrideGalley', $plugin->getSetting($journalId, 'overrideGalley'));
        $this->setData('wantedFormats', $plugin->getSetting($journalId, 'wantedFormats'));
    }
    
    /**
     * Assign form data to user-submitted data
     *
     * @return void
     */
    function readInputData() {
        $this->readUserVars(
            array(
                'cslStyle',
                'markupHostPass',
                'markupHostURL',
                'markupHostUser',
                'overrideGalley',
                'wantedFormats',
            )
        );
    }
    
    /**
     * Validate the form
     *
     * @return bool Whether or not the form validated
     */
    function validate() {
        $this->addCheck(new FormValidatorPost($this));
        $this->addCheck(new FormValidator($this, 'cslStyle', 'required', 'plugins.generic.markup.required.cslStyle'));
        $this->addCheck(new FormValidator($this, 'markupHostPass', 'optional', 'plugins.generic.markup.optional.markupHostPass'));
        $this->addCheck(new FormValidator($this, 'markupHostURL', 'required', 'plugins.generic.markup.required.markupHostURL'));
        $this->addCheck(new FormValidator($this, 'markupHostUser', 'optional', 'plugins.generic.markup.optional.markupHostUrl'));
        $this->addCheck(new FormValidator($this, 'overrideGalley', 'required', 'plugins.generic.markup.required.overrideGalley'));
        $this->addCheck(new FormValidator($this, 'wantedFormats', 'required', 'plugins.generic.markup.required.wantedFormats'));

        return parent::validate();
    }
    
    /**
     * @see Form::fetch()
     */
    function fetch($request) {
        $templateMgr = TemplateManager::getManager($request);
        $templateMgr->assign('pluginName', $this->plugin->getName());
        
        
        // Signals indicating plugin compatibility
        $templateMgr->assign('curlSupport', function_exists('curl_init') ? __('plugins.generic.markup.settings.installed') : __('plugins.generic.markup.settings.notInstalled'));
        $templateMgr->assign('zipSupport', extension_loaded('zlib') ? __('plugins.generic.markup.settings.installed') : __('plugins.generic.markup.settings.notInstalled'));
        $templateMgr->assign('pathInfo', Request::isPathInfoEnabled() ? __('plugins.generic.markup.settings.enabled') : __('plugins.generic.markup.settings.disabled'));
        
        $additionalScriptPath = $this->plugin->getJsUrl(). 'MarkupSettingsFormHandler.js';
        $templateMgr->addJavaScript($additionalScriptPath);
        
        return parent::fetch($request);
    }
    
    function execute() {
        $plugin = $this->plugin;
        $journalId = $this->journalId;
        
        $markupHostURL = $this->getData('markupHostURL');
        if ($markupHostURL) {
            if (!parse_url($markupHostURL, PHP_URL_SCHEME)) {
                $markupHostURL = 'http://' . $markupHostURL;
            }
            if (substr(parse_url($markupHostURL, PHP_URL_PATH), -1) != '/') {
                $markupHostURL .= '/';
            }
        }
        
        $plugin->updateSetting($journalId, 'cslStyle', $this->getData('cslStyle'));
        $plugin->updateSetting($journalId, 'markupHostURL', $markupHostURL);
        $plugin->updateSetting($journalId, 'markupHostUser', $this->getData('markupHostUser'));
        $plugin->updateSetting($journalId, 'markupHostPass', $this->getData('markupHostPass'));
        $plugin->updateSetting($journalId, 'overrideGalley', $this->getData('overrideGalley'));
        $plugin->updateSetting($journalId, 'wantedFormats', $this->getData('wantedFormats'));
    }
}