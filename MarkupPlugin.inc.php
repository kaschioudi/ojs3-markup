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
 * the xml, epub and pdf versions and places them in the galley. 
 *
 */

import('lib.pkp.classes.plugins.GenericPlugin');

class MarkupPlugin extends GenericPlugin {
	
	/** @var $formatList array Default list of wanted formats */
	protected $formatList = array('epub','xml','pdf');

	/** @var $conversionStages array Default list of stages for convert to xml feature */
	protected $xmlConversionStages = array(WORKFLOW_STAGE_ID_SUBMISSION,WORKFLOW_STAGE_ID_INTERNAL_REVIEW,WORKFLOW_STAGE_ID_EXTERNAL_REVIEW,WORKFLOW_STAGE_ID_EDITING,WORKFLOW_STAGE_ID_PRODUCTION);

	/** @var $editWithSubstanceStages array Default list of stages for edit with substance feature */
	protected $editWithSubstanceStages = array(WORKFLOW_STAGE_ID_SUBMISSION,WORKFLOW_STAGE_ID_INTERNAL_REVIEW,WORKFLOW_STAGE_ID_EXTERNAL_REVIEW,WORKFLOW_STAGE_ID_EDITING,WORKFLOW_STAGE_ID_PRODUCTION);

	/**
	 * Returns list of available formats
	 *
	 * @return array format list
	 */
	public function getFormatList() {
		return $this->formatList;
	}

	/**
	 * Returns default list of stages for convert to xml feature
	 *
	 * @return array Default list of stages for convert to xml feature
	 */
	public function getXmlConversionStages() {
		return $this->xmlConversionStages;
	}

	/**
	 * Returns default list of stages for edit with substance feature
	 *
	 * @return array Default list of stages for edit with substance feature
	 */
	public function getEditWithSubstanceStages() {
		return $this->editWithSubstanceStages;
	}
	
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
				$this->import('classes.MarkupJobInfoDAO');

				$markupJobInfoDao = new MarkupJobInfoDAO($this);
				DAORegistry::registerDAO('MarkupJobInfoDAO', $markupJobInfoDao);

				// Register callbacks.
				HookRegistry::register('LoadHandler', array($this, 'callbackLoadHandler'));
				HookRegistry::register('TemplateManager::fetch', array($this, 'templateFetchCallback'));
				HookRegistry::register('PluginRegistry::loadCategory', array($this, 'callbackLoadCategory'));
				HookRegistry::register('Templates::Management::Settings::website', array($this, 'callbackShowWebsiteSettingsTabs'));
				HookRegistry::register('Templates::User::profile', array($this, 'callbackUserProfile'));
				HookRegistry::register('submissionfiledaodelegate::_deleteobject', array($this, 'callbackSubmissionFileDeteted'));
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
		return parent::getPluginPath() . '/css/';
	}
	
	/**
	 * Get plugin JS URL
	 *
	 * @return string Public plugin JS URL
	 */
	function getJsUrl($request) {
		return $request->getBaseUrl() . '/' . $this->getPluginPath() . '/js';
	}

	/**
	 * Get texture editor folder url
	 *
	 * @return string url to texture folder
	 */
	function getTextureFolderUrl($request) {
		return $request->getBaseUrl() . '/' . $this->getPluginPath() . '/texture';
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
	 * Get the filename of the ADODB schema for this plugin.
	 * @return string Full path and filename to schema descriptor.
	 */
	function getInstallSchemaFile() {
		return $this->getPluginPath() . '/schema.xml';
	}

	/**
	 * @see Plugin::manage()
	 */
	function manage($args, $request) {
		
		$this->import('MarkupSettingsForm');
		$journal = $request->getJournal();

		switch ($request->getUserVar('verb')) {
			case 'settings':
				$context = $request->getContext();
				AppLocale::requireComponents(LOCALE_COMPONENT_APP_COMMON,  LOCALE_COMPONENT_PKP_MANAGER);
				$templateMgr = TemplateManager::getManager($request);
				$templateMgr->register_function('plugin_url', array($this, 'smartyPluginUrl'));
				$form = new MarkupSettingsForm($this, $context->getId());
				if ($request->getUserVar('save')) {
					$form->readInputData();
					if ($form->validate()) {
						$form->execute();
						$notificationManager = new NotificationManager();
						$notificationManager->createTrivialNotification(
							$request->getUser()->getId(),
							NOTIFICATION_TYPE_SUCCESS,
							array('contents' => __('plugins.generic.markup.settings.saved'))
						);
						return new JSONMessage(true);
					}
				} else {
					$form->initData();
				}
				return new JSONMessage(true, $form->fetch($request));
		}
		return parent::manage($args, $request);
	}
	
	/**
	 * Extend the website settings tabs to include markup settings
	 * @param $hookName string The name of the invoked hook
	 * @param $args array Hook parameters
	 * @return boolean Hook handling status
	 */
	public function callbackShowWebsiteSettingsTabs($hookName, $args) {
		$output =& $args[2];
		$request =& Registry::get('request');
		$dispatcher = $request->getDispatcher();
		$output .= '<li><a name="markup" href="' . $dispatcher->url($request, ROUTE_PAGE, null, 'markup', 'settings') . '">' . __('plugins.generic.markup.settings') . '</a></li>';
		return false;
	}

	/**
	 * @see PKPPageRouter::route()
	 */
	public function callbackLoadHandler($hookName, $args) {
		// Check the page.
		$page = $args[0];
		if ($page !== 'markup') return;

		// Check the operation.
		$op = $args[1];

		if ($op == 'settings') { // settings tab
			define('HANDLER_CLASS', 'MarkupSettingsTabHandler');
			$args[2] = $this->getPluginPath() . '/' . 'MarkupSettingsTabHandler.inc.php';
		}
		else {
			$publicOps = array(
				'convertToXml',
				'generateGalleyFiles',
				'editor',
				'xml',
				'save',
				'profile',
				'triggerConversion',
				'fetchConversionJobStatus',
			);

			if (!in_array($op, $publicOps)) return;

			// Get the journal object from the context (optimized).
			$request = $this->getRequest();
			$router = $request->getRouter();
			$journal = $router->getContext($request); /* @var $journal Journal */

			// Looks as if our handler had been requested.
			define('HANDLER_CLASS', 'MarkupHandler');

			// set handler file path
			$args[2] = $this->getPluginPath() . '/' . 'MarkupHandler.inc.php';
		}
	}

	/**
	 * Adds additional links to submission files grid row
	 * @param $hookName string The name of the invoked hook
	 * @param $args array Hook parameters
	 */
	public function templateFetchCallback($hookName, $params) {
		$request = $this->getRequest();
		$router = $request->getRouter();
		$dispatcher = $router->getDispatcher();
		$journal = $request->getJournal();
		$journalId = $journal->getId();

		$templateMgr = $params[0];
		$resourceName = $params[1];
		if ($resourceName == 'controllers/grid/gridRow.tpl') {
			$row = $templateMgr->get_template_vars('row');
			$data = $row->getData();
			if (is_array($data) && (isset($data['submissionFile']))) {
				$submissionFile = $data['submissionFile'];
				$fileExtension = $submissionFile->getExtension();

				// get stage ID
				$stage = $submissionFile->getFileStage();
				$stageId = (int) $request->getUserVar('stageId');

				if (in_array(strtolower($fileExtension), array('doc','docx','odt','pdf', 'xml'))) {

					import('lib.pkp.classes.linkAction.request.AjaxModal');

					// get list of stages for "Convert to xml" feature.
					$xmlConversionStages = $this->getSetting($journalId, 'xmlConversionStages');
					if (in_array($stageId, $xmlConversionStages) && ($fileExtension != 'xml')) {
						$row->addAction(new LinkAction(
							'convert',
							new AjaxModal(
								$dispatcher->url($request, ROUTE_PAGE, null, 'markup', 'convertToXml', null, 
										array(
											'submissionId' => $submissionFile->getSubmissionId(), 
											'fileId' => $submissionFile->getFileId(), 
											'stage' => $stage)
										),
								__('plugins.generic.markup.modal.xmlConversion')
							),
							__('plugins.generic.markup.links.convertToXml'),
							null
						));
					}

					if ($stageId == WORKFLOW_STAGE_ID_PRODUCTION) {
						$row->addAction(new LinkAction(
							'generateGaleyFiles',
							new AjaxModal(
								$dispatcher->url($request, ROUTE_PAGE, null, 'markup', 'generateGalleyFiles', null, 
										array(
											'submissionId' => $submissionFile->getSubmissionId(), 
											'fileId' => $submissionFile->getFileId(), 
											'stage' => WORKFLOW_STAGE_ID_PRODUCTION)
										),
								__('plugins.generic.markup.modal.galleyProduction')
							),
							__('plugins.generic.markup.links.generateGalley'),
							null
						));
					}
				}
				
				if (strtolower($fileExtension) == 'xml') {
					// get list of stages for "Edit with Substance" feature.
					$editWithSubstanceStages = $this->getSetting($journalId, 'editWithSubstanceStages');

					if (in_array($stageId, $editWithSubstanceStages)) {
						import('lib.pkp.classes.linkAction.request.OpenWindowAction');
						$row->addAction(new LinkAction(
							'editor',
							new OpenWindowAction(
								$dispatcher->url($request, ROUTE_PAGE, null, 'markup', 'editor', null, 
										array(
											'submissionId' => $submissionFile->getSubmissionId(), 
											'fileId' => $submissionFile->getFileId(), 
											'stage' => $stage)
										)
							),
							__('plugins.generic.markup.links.editWithSubstance'),
							null
						));
					}
				}
			}
		}
	}

	/**
	 * Triggers document conversion process through MarkupGatewayPlugin::fetch()
	 *
	 * @param $fileId int fileId to retrieve converted archive for
	 * @param $stage int the file stage
	 * @param $target string job target (xml-conversion or galey-generate)
	 *
	 * @return string job id
	 */
	public function fetchGateway($fileId, $stage, $target) {
		$request = $this->getRequest();
		$user = $request->getUser();

		$router = $request->getRouter();
		$dispatcher = $router->getDispatcher();
		$journal = $request->getJournal();

		$jobId = uniqid();

		// create job info
		$markupJobInfoDao = DAORegistry::getDAO('MarkupJobInfoDAO');
		$this->import('classes.MarkupJobInfo');
		$jobInfo = new MarkupJobInfo();
		$jobInfo->setId($jobId);
		$jobInfo->setFileId($fileId);
		$jobInfo->setUserId($user->getId());
		$jobInfo->setJournalId($journal->getId());
		$jobInfo->setXmlJobId(NULL);
		$markupJobInfoDao->insertMarkupJobInfo($jobInfo);

		$url = $request->url(null, 'gateway', 'plugin', 
					array('MarkupGatewayPlugin','fileId', $fileId, 'userId', $user->getId(), 
							'stage', $stage, 'jobId', $jobId, 'target', $target)
				);

		$ch = curl_init();
		curl_setopt($ch, CURLOPT_URL, $url);
		curl_setopt($ch, CURLOPT_RETURNTRANSFER, 1);
		curl_setopt($ch, CURLOPT_TIMEOUT_MS, 1000);
		curl_exec($ch);
		curl_close($ch);

		return $jobId;
	}

	/**
	 * Retrieve OTS login credentials for specific website
	 * 
	 * @param $journalId int Journal ID
	 * @param $user User
	 * @return array 
	 */
	public function getOTSLoginParametersForJournal($journalId, $user = null) {
		$authType = $this->getSetting($journalId, 'authType');
		switch ($authType) {
			case 'user':
				return array(
					'host' => $this->getSetting($journalId, 'markupHostURL'),
					'user' => isset($user) ? $user->getSetting('markupHostUser') : null,
					'password' => isset($user) ? $user->getSetting('markupHostPass') : null,
				);

			case 'site':
				return array(
					'host' => $this->getSetting($journalId, 'markupHostURL'),
					'user' => $this->getSetting($journalId, 'markupHostUser'),
					'password' => $this->getSetting($journalId, 'markupHostPass'),
				);

			default:
				return array(
					'host' => null,
					'user' => null,
					'password' => null,
				);
		}
	}
	
	/**
	 * Extend user profile page with a new tab for user specific OTS login credentials
	 * @param $hookName string The name of the invoked hook
	 * @param $args array Hook parameters
	 * @return boolean Hook handling status
	 */
	public function callbackUserProfile($hookName, $params)
	{
		$request = $this->getRequest();
		$context = $request->getContext();
		$authType = $this->getSetting($context->getId(), 'authType');

		if ($authType == 'user') {
			$output =& $params[2];
			$dispatcher = $request->getDispatcher();
			$url = $dispatcher->url($request, ROUTE_PAGE, null, 'markup', 'profile');

			$output .= '<li><a name="otsServerCredentials" ' .
					'href="'.$url.'">' . __('plugins.generic.markup.tab.profile') . '</a></li>';
		}

		return false;
	}

	/**
	 * Remove entries related to a submission file when that file is deleted
	 * @param $hookName string The name of the invoked hook
	 * @param $args array Hook parameters
	 */
	public function callbackSubmissionFileDeteted($hookName, $params)
	{
		if ((count($params) == 3) && isset($params[1]) 
				&& is_array($params[1]) && count($params[1] == 2)) {
			$submissionFileId = $params[1][0];
			$markupJobInfoDao = DAORegistry::getDAO('MarkupJobInfoDAO');
			$markupJobInfoDao->deleteByFileId($submissionFileId);
		}
	}
}
