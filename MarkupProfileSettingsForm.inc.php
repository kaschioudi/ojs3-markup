<?php

/**
* @file plugins/generic/markup/MarkupProfileSettingsForm.inc.php
*
* Copyright (c) 2003-2018 Simon Fraser University
* Copyright (c) 2003-2018 John Willinsky
* Distributed under the GNU GPL v2. For full terms see the file docs/COPYING.
*
* @class MarkupProfileSettingsForm
* @ingroup plugins_generic_markup
*
* @brief Form for Document Markup XML service credential settings from user profile
*/

import('lib.pkp.classes.form.Form');

class MarkupProfileSettingsForm extends Form {
	
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
	public function __construct($plugin, $journalId) {
		$this->_journalId = $journalId;
		$this->_plugin = $plugin;
		
		parent::__construct($plugin->getTemplatePath() . 'profileSettingsForm.tpl');

		// Validation checks for this form
		$this->_settings = array(
			'markupHostPass' => 'string',
			'markupHostUser' => 'string',
		);
	}
	
	/**
	 * Initialize plugin settings form
	 *
	 * @return void
	 */
	public function initData() {
		$plugin = $this->_plugin;
		$request = $plugin->getRequest();
		$user = $request->getUser();

		$this->setData('markupHostUser', $user->getSetting('markupHostUser'));
		$this->setData('markupHostPass', $user->getSetting('markupHostPass'));
	}
	
	/**
	 * Assign form data to user-submitted data
	 *
	 * @return void
	 */
	public function readInputData() {
		$this->readUserVars(
			array(
				'markupHostPass',
				'markupHostUser',
			)
		);
	}
	
	/**
	 * Validate the form
	 *
	 * @return bool Whether or not the form validated
	 */
	public function validate() {
		$this->addCheck(new FormValidatorPost($this));
		$this->addCheck(new FormValidator($this, 'markupHostPass', 'required', 'plugins.generic.markup.required.markupHostPass'));
		$this->addCheck(new FormValidator($this, 'markupHostUser', 'required', 'plugins.generic.markup.required.markupHostUser'));

		return parent::validate();
	}
	
	/**
	 * @see Form::fetch()
	 */
	public function fetch($request) {
		$templateMgr = TemplateManager::getManager($request);
		$templateMgr->assign('pluginJavaScriptURL', $this->_plugin->getJsUrl($request));
		
		$templateMgr->assign('pluginName', $this->_plugin->getName());
		$templateMgr->assign('templatePath', $this->_plugin->getTemplatePath());
		
		return parent::fetch($request);
	}
	
	public function execute() {
		$plugin = $this->_plugin;
		$request = $plugin->getRequest();
		$user = $request->getUser();
		
		$user->updateSetting('markupHostUser', $this->getData('markupHostUser'));
		$user->updateSetting('markupHostPass', $this->getData('markupHostPass'));
	}
}