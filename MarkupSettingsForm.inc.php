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
define('MARKUP_DOCUMENT_SERVER_URL_DEFAULT', 'http://pkp-xml-demo.lib.sfu.ca/');

class MarkupSettingsForm extends Form {
	
	/** @var $journalId int */
	protected $journalId;

	/** @var $plugin object */
	protected $plugin;

	/** @var $settings array */
	protected $settings;
	
	/**
	 * Constructor
	 * @param $plugin mixed Plugin object
	 * @param $journalId int JournalId
	 */
	function __construct($plugin, $journalId) {
		$this->journalId = $journalId;
		$this->plugin = $plugin;
		
		parent::__construct($plugin->getTemplatePath() . 'settingsForm.tpl');

		// Validation checks for this form
		$this->settings = array(
			'cslStyle' => 'string',
			'markupHostPass' => 'string',
			'markupHostURL' => 'string',
			'markupHostUser' => 'string',
			'wantedFormats' => 'object',
			'xmlConversionStages' => 'object',
			'editWithSubstanceStages' => 'object',
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

		$this->setData('authType', $plugin->getSetting($journalId, 'authType'));
		$this->setData('cslStyle', $plugin->getSetting($journalId, 'cslStyle'));
		$this->setData('markupHostUser', $plugin->getSetting($journalId, 'markupHostUser'));
		$this->setData('markupHostPass', $plugin->getSetting($journalId, 'markupHostPass'));
		$this->setData('markupHostURL', $plugin->getSetting($journalId, 'markupHostURL'));
		
		// wanted formats
		$wantedFormats = $plugin->getSetting($journalId, 'wantedFormats');
		if (is_null($wantedFormats)) {
			$wantedFormats = $this->plugin->getFormatList();
		}
		
		// conversion stages
		$xmlConversionStages = $plugin->getSetting($journalId, 'xmlConversionStages');
		if (is_null($xmlConversionStages)) {
			$xmlConversionStages = $this->plugin->getXmlConversionStages();
		}

		// edit with substance
		$editWithSubstanceStages = $plugin->getSetting($journalId, 'editWithSubstanceStages');
		if (is_null($editWithSubstanceStages)) {
			$editWithSubstanceStages = $this->plugin->getEditWithSubstanceStages();
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

		$this->addCheck(new FormValidator($this, 'authType', 'required', 'plugins.generic.markup.required.authType'));

		$authType = $this->getData('authType');
		$loginCredsFieldsType = ($authType == 'site') ? 'required' : 'optional';
		$this->addCheck(new FormValidator($this, 'markupHostUser', $loginCredsFieldsType, "plugins.generic.markup.{$loginCredsFieldsType}.markupHostUser"));
		$this->addCheck(new FormValidator($this, 'markupHostPass', $loginCredsFieldsType, "plugins.generic.markup.{$loginCredsFieldsType}.markupHostPass"));

		$this->addCheck(new FormValidatorPost($this));
		$this->addCheck(new FormValidator($this, 'cslStyle', 'required', 'plugins.generic.markup.required.cslStyle'));
		$this->addCheck(new FormValidator($this, 'markupHostURL', 'required', 'plugins.generic.markup.required.markupHostURL'));
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
		$templateMgr->assign('pluginJavaScriptURL', $this->plugin->getJsUrl($request));

		$templateMgr->assign('pluginName', $this->plugin->getName());
		$templateMgr->assign('templatePath', $this->plugin->getTemplatePath());

		// Signals indicating plugin compatibility
		$templateMgr->assign('curlSupport', function_exists('curl_init') ? __('plugins.generic.markup.settings.installed') : __('plugins.generic.markup.settings.notInstalled'));
		$templateMgr->assign('zipSupport', extension_loaded('zlib') ? __('plugins.generic.markup.settings.installed') : __('plugins.generic.markup.settings.notInstalled'));
		$templateMgr->assign('pathInfo', Request::isPathInfoEnabled() ? __('plugins.generic.markup.settings.enabled') : __('plugins.generic.markup.settings.disabled'));

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

		$authType = $this->getData('authType'); 
		$markupHostUser = $this->getData('markupHostUser');
		$markupHostPass = $this->getData('markupHostPass');

		// clear user and password when authentication type is user
		if ($authType == 'user') {
			$markupHostUser = $markupHostPass = '';
		}

		$plugin->updateSetting($journalId, 'authType', $authType);
		$plugin->updateSetting($journalId, 'cslStyle', $this->getData('cslStyle'));
		$plugin->updateSetting($journalId, 'markupHostURL', $markupHostURL);
		$plugin->updateSetting($journalId, 'wantedFormats', $this->getData('wantedFormats'));
		$plugin->updateSetting($journalId, 'markupHostUser', $markupHostUser);
		$plugin->updateSetting($journalId, 'markupHostPass', $markupHostPass);
		$plugin->updateSetting($journalId, 'xmlConversionStages', $this->getData('xmlConversionStages'));
		$plugin->updateSetting($journalId, 'editWithSubstanceStages', $this->getData('editWithSubstanceStages'));
	}
}
