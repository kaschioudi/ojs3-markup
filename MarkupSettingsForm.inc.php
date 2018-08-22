<?php

/**
* @file plugins/generic/markup/MarkupSettingsForm.inc.php
*
* Copyright (c) 2003-2018 Simon Fraser University
* Copyright (c) 2003-2018 John Willinsky
* Distributed under the GNU GPL v2. For full terms see the file docs/COPYING.
*
* @class MarkupSettingsForm
* @ingroup plugins_generic_markup
*
* @brief Form for Document Markup gateway plugin settings
*/

import('lib.pkp.classes.form.Form');

define('MARKUP_CSL_STYLE_DEFAULT', '674e1c66aa817a0713a410915ac1b298');
define('MARKUP_DOCUMENT_SERVER_URL_DEFAULT', 'https://pkp-xml-demo.lib.sfu.ca/');

class MarkupSettingsForm extends Form {
	
	/** @var $journalId int */
	protected $_journalId;

	/** @var $plugin object */
	protected $_plugin;

	/** @var $settings array */
	protected $_settings;
	
	/**
	 * Constructor
	 * @param $plugin mixed Plugin object
	 * @param $journalId int JournalId
	 */
	function __construct($plugin, $journalId) {
		$this->_journalId = $journalId;
		$this->_plugin = $plugin;
		
		parent::__construct($plugin->getTemplatePath() . 'settingsForm.tpl');

		// Validation checks for this form
		$this->_settings = array(
			'cslStyle' => 'string',
			'markupHostPass' => 'string',
			'markupHostURL' => 'string',
			'markupHostUser' => 'string',
			'wantedFormats' => 'object',
			'xmlConversionStages' => 'object',
			'editWithSubstanceStages' => 'object',
		);

		$this->_plugin->import('classes.MarkupConversionHelper');
	}
	
	/**
	 * Initialize plugin settings form
	 *
	 * @return void
	 */
	function initData() {
		$journalId = $this->_journalId;
		$plugin = $this->_plugin;

		// User must at least load settings page for plugin to work with defaults.
		if ($plugin->getSetting($journalId, 'cslStyle') == '') {
			$plugin->updateSetting($journalId, 'cslStyle', MARKUP_CSL_STYLE_DEFAULT);
		}
		if ($plugin->getSetting($journalId, 'markupHostURL') == '') {
			$plugin->updateSetting($journalId, 'markupHostURL', MARKUP_DOCUMENT_SERVER_URL_DEFAULT);
		}

		$this->setData('authType', $plugin->getSetting($journalId, 'authType'));
		$this->setData('cslStyle', $plugin->getSetting($journalId, 'cslStyle'));

		// Check if admin has entered credentials in config file.
		$configCreds = MarkupConversionHelper::readCredentialsFromConfig();
		if (MarkupConversionHelper::canUseCredentialsFromConfig($configCreds)) {
			$this->setData('markupConfigCredsAvailable', true);
			// javascript needs this to construct csl style full url
			$this->setData('markupHostURL', $configCreds['host']);
		}
		else {
			$this->setData('markupConfigCredsAvailable', false);
			$this->setData('markupHostUser', $plugin->getSetting($journalId, 'markupHostUser'));
			$this->setData('markupHostPass', $plugin->getSetting($journalId, 'markupHostPass'));
			$this->setData('markupHostURL', $plugin->getSetting($journalId, 'markupHostURL'));
		}

		// Check if admin has specified a default citation style
		$citationStyleHash = Config::getVar('markup', 'ots_citation_style_hash');
		if (is_null($citationStyleHash)) {
			$this->setData('markupConfigDefaultCitationHashAvailable', false);
		}
		else {
			$this->setData('markupConfigDefaultCitationHashAvailable', true);
		}

		// wanted formats
		$wantedFormats = $plugin->getSetting($journalId, 'wantedFormats');
		if (is_null($wantedFormats)) {
			$wantedFormats = $this->_plugin->getFormatList();
		}
		
		// conversion stages
		$xmlConversionStages = $plugin->getSetting($journalId, 'xmlConversionStages');
		if (is_null($xmlConversionStages)) {
			$xmlConversionStages = $this->_plugin->getXmlConversionStages();
		}

		// edit with substance
		$editWithSubstanceStages = $plugin->getSetting($journalId, 'editWithSubstanceStages');
		if (is_null($editWithSubstanceStages)) {
			$editWithSubstanceStages = $this->_plugin->getEditWithSubstanceStages();
		}

		$this->setData('wantedFormats', $wantedFormats);
		$this->setData('xmlConversionStages', $xmlConversionStages);
		$this->setData('editWithSubstanceStages', $editWithSubstanceStages);
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
				'wantedFormats',
				'authType',
				'xmlConversionStages',
				'editWithSubstanceStages',
			)
		);
	}

	/**
	 * Validate the form
	 *
	 * @return bool Whether or not the form validated
	 */
	function validate() {

		// user credentials fields are available only when credentials are not set in config.inc.php 
		$configCreds = MarkupConversionHelper::readCredentialsFromConfig();
		if (!MarkupConversionHelper::canUseCredentialsFromConfig($configCreds)) {
			$authType = $this->getData('authType');
			$loginCredsFieldsType = ($authType == 'site') ? 'required' : 'optional';
			$this->addCheck(new FormValidator($this, 'authType', 'required', 'plugins.generic.markup.required.authType'));
			$this->addCheck(new FormValidator($this, 'markupHostUser', $loginCredsFieldsType, "plugins.generic.markup.{$loginCredsFieldsType}.markupHostUser"));
			$this->addCheck(new FormValidator($this, 'markupHostPass', $loginCredsFieldsType, "plugins.generic.markup.{$loginCredsFieldsType}.markupHostPass"));
			$this->addCheck(new FormValidator($this, 'markupHostURL', 'required', 'plugins.generic.markup.required.markupHostURL'));
		}

		// citation style field is available only if not set in config.inc.php my admin
		$citationStyleHash = Config::getVar('markup', 'ots_citation_style_hash');
		if (is_null($citationStyleHash)) {
			$this->addCheck(new FormValidator($this, 'cslStyle', 'required', 'plugins.generic.markup.required.cslStyle'));
		}

		$this->addCheck(new FormValidatorPost($this));
		$this->addCheck(new FormValidator($this, 'wantedFormats', 'required', 'plugins.generic.markup.required.wantedFormats'));
		$this->addCheck(new FormValidator($this, 'xmlConversionStages', 'required', 'plugins.generic.markup.required.xmlConversionStages'));
		$this->addCheck(new FormValidator($this, 'editWithSubstanceStages', 'required', 'plugins.generic.markup.required.editWithSubstanceStages'));

		return parent::validate();
	}

	/**
	 * @see Form::fetch()
	 */
	function fetch($request) {
		$templateMgr = TemplateManager::getManager($request);
		$templateMgr->assign('pluginJavaScriptURL', $this->_plugin->getJsUrl($request));

		$templateMgr->assign('pluginName', $this->_plugin->getName());
		$templateMgr->assign('templatePath', $this->_plugin->getTemplatePath());

		// Signals indicating plugin compatibility
		$templateMgr->assign('curlSupport', function_exists('curl_init') ? __('plugins.generic.markup.settings.installed') : __('plugins.generic.markup.settings.notInstalled'));
		$templateMgr->assign('zipSupport', extension_loaded('zlib') ? __('plugins.generic.markup.settings.installed') : __('plugins.generic.markup.settings.notInstalled'));
		$templateMgr->assign('pathInfo', Request::isPathInfoEnabled() ? __('plugins.generic.markup.settings.enabled') : __('plugins.generic.markup.settings.disabled'));

		return parent::fetch($request);
	}

	function execute() {

		$plugin = $this->_plugin;
		$journalId = $this->_journalId;

		$markupHostURL = $this->getData('markupHostURL');
		if ($markupHostURL) {
			if (!parse_url($markupHostURL, PHP_URL_SCHEME)) {
				$markupHostURL = 'http://' . $markupHostURL;
			}
			if (substr(parse_url($markupHostURL, PHP_URL_PATH), -1) != '/') {
				$markupHostURL .= '/';
			}
		}

		$authType = $this->getData('authType'); 
		$markupHostUser = $this->getData('markupHostUser');
		$markupHostPass = $this->getData('markupHostPass');

		// clear user and password when authentication type is user
		if ($authType == 'user') {
			$markupHostUser = $markupHostPass = '';
		}

		// if credentials are not set by admin, these fields will be available and validated
		// thus need to be saved
		$configCreds = MarkupConversionHelper::readCredentialsFromConfig();
		if (!MarkupConversionHelper::canUseCredentialsFromConfig($configCreds)) {
			$plugin->updateSetting($journalId, 'authType', $authType);
			$plugin->updateSetting($journalId, 'markupHostURL', $markupHostURL);
			$plugin->updateSetting($journalId, 'markupHostUser', $markupHostUser);
			$plugin->updateSetting($journalId, 'markupHostPass', $markupHostPass);
		}

		// same for citation style field
		$citationStyleHash = Config::getVar('markup', 'ots_citation_style_hash');
		if (is_null($citationStyleHash)) {
			$plugin->updateSetting($journalId, 'cslStyle', $this->getData('cslStyle'));
		}

		$plugin->updateSetting($journalId, 'wantedFormats', $this->getData('wantedFormats'));
		$plugin->updateSetting($journalId, 'xmlConversionStages', $this->getData('xmlConversionStages'));
		$plugin->updateSetting($journalId, 'editWithSubstanceStages', $this->getData('editWithSubstanceStages'));
	}
}
