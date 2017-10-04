<?php

/**
 * @file plugins/generic/markup/MarkupHandler.inc.php
 *
 * Copyright (c) 2014-2017 Simon Fraser University
 * Copyright (c) 2003-2017 John Willinsky
 * Distributed under the GNU GPL v2. For full terms see the file docs/COPYING.
 *
 * @class MarkupHandler
 * @ingroup plugins_generic_markup
 *
 * @brief Handle requests for markup plugin
 */

import('classes.handler.Handler');

class MarkupHandler extends Handler {
	/** @var MarkupPlugin The Document markup plugin */
	protected $plugin;
	
	/**
	 * Constructor
	 */
	function __construct() {
		parent::__construct();	
		
		// set reference to markup plugin
		$this->plugin = PluginRegistry::getPlugin('generic', 'markupplugin'); 
		
		$this->addRoleAssignment(
			array(ROLE_ID_MANAGER, ROLE_ID_SUB_EDITOR, ROLE_ID_ASSISTANT, ROLE_ID_REVIEWER, ROLE_ID_AUTHOR),
			array('convertToXml', 'generateGalleyFiles', 'profile', 'save', 
					'editor', 'xml', 'triggerConversion', 'fetchConversionJobStatus')
		);

		$this->addRoleAssignment(array(ROLE_ID_MANAGER), array('batch'));
	}
	
	/**
	 * @copydoc PKPHandler::authorize()
	 */
	function authorize($request, &$args, $roleAssignments) {
		$op = $request->getRouter()->getRequestedOp($request);
		
		if(in_array($op, array('profile','batch'))) {
			import('lib.pkp.classes.security.authorization.ContextAccessPolicy');
			$this->addPolicy(new ContextAccessPolicy($request, $roleAssignments));
		}
		else {
			import('lib.pkp.classes.security.authorization.SubmissionFileAccessPolicy');
			$this->addPolicy(new SubmissionFileAccessPolicy($request, $args, $roleAssignments, SUBMISSION_FILE_ACCESS_READ));
		}

		return parent::authorize($request, $args, $roleAssignments);
	}
	
	/**
	 * Triggers a job on xml server to convert a dox/pdf document to xml
	 * 
	 * @param $args array
	 * @param $request PKPRequest
	 * 
	 * @return JSONMessage
	 */
	public function convertToXml($args, $request) {
		$params = array (
			'messageKey' => 'plugins.generic.markup.modal.xmlConversionText',
			'target' => 'xml-conversion',
			'stage' => $request->getUserVar('stage')
		);
		return $this->_conversion($args, $request, $params);
	}
	
	/**
	 * Triggers a job on xml server to generate galley files
	 * 
	 * @param $args array
	 * @param $request PKPRequest
	 * 
	 * @return JSONMessage
	 */
	public function generateGalleyFiles($args, $request) {
		$params = array (
			'messageKey' => 'plugins.generic.markup.modal.galleyProductionText',
			'target' => 'galley-generate',
			'stage' => WORKFLOW_STAGE_ID_PRODUCTION
		);
		return $this->_conversion($args, $request, $params);
	}
	
	/**
	 * 
	 * @param $args array
	 * @param $request PKPRequest
	 * @param $params array 
	 * @return JSONMessage
	 */
	protected function _conversion($args, $request, $params) {
		$context = $request->getContext();
		$dispatcher = $request->getDispatcher();
		$authType = $this->plugin->getSetting($context->getId(), 'authType');
		
		$submissionFile = $this->getAuthorizedContextObject(ASSOC_TYPE_SUBMISSION_FILE);
		if (!$submissionFile) {
			return new JSONMessage(false);
		}
		
		$fileId = $submissionFile->getFileId();
		$stageId = $params['stage'];
		
		$pluginIsConfigured = is_null($authType) ? false : true;
		$loginCredentialsConfigured = true;
		
		// Import host, user and password variables into the current symbol table from an array
		extract($this->plugin->getOTSLoginParametersForJournal($context->getId(), $request->getUser()));
		if (is_null($user) || is_null($password)) {
			$loginCredentialsConfigured = false;
		}
		
		$conversionTriggerUrl = $dispatcher->url($request, ROUTE_PAGE, null, 'markup', 'triggerConversion', null, array('submissionId' => $submissionFile->getSubmissionId(), 'fileId' => $fileId, 'stage' => $stageId, 'target' => $params['target']));
		$editorTemplateFile = $this->plugin->getTemplatePath() . 'convert.tpl';
		AppLocale::requireComponents(LOCALE_COMPONENT_APP_COMMON,  LOCALE_COMPONENT_PKP_MANAGER);
		$templateMgr = TemplateManager::getManager($request);
		$templateMgr->assign('fileId', $fileId);
		$templateMgr->assign('messageKey', $params['messageKey']);
		$templateMgr->assign('pluginIsConfigured', $pluginIsConfigured);
		$templateMgr->assign('loginCredentialsConfigured', $loginCredentialsConfigured);
		$templateMgr->assign('conversionTriggerUrl', $conversionTriggerUrl);
		$templateMgr->assign('pluginJavaScriptURL', $this->plugin->getJsUrl($request));
		$output = $templateMgr->fetch($editorTemplateFile);
		return new JSONMessage(true, $output);
	}
	
	/**
	 * Display substance editor
	 * 
	 * @param $args array
	 * @param $request PKPRequest
	 * 
	 * @return string
	 */
	public function editor($args, $request) {
		$stageId = (int) $request->getUserVar('stage');
		
		$submissionFile = $this->getAuthorizedContextObject(ASSOC_TYPE_SUBMISSION_FILE);
		if (!$submissionFile) {
			fatalError('Invalid request');
		}
		
		$fileId = $submissionFile->getFileId();
		$editorTemplateFile = $this->plugin->getTemplatePath() . 'editor.tpl';
		$router = $request->getRouter();
		$documentUrl = $router->url($request, null, 'markup', 'xml', null, 
				array(
						'submissionId' => $submissionFile->getSubmissionId(), 
						'fileId' => $fileId)
				);
		
		AppLocale::requireComponents(LOCALE_COMPONENT_APP_COMMON,  LOCALE_COMPONENT_PKP_MANAGER);
		$templateMgr = TemplateManager::getManager($request);
		$templateMgr->assign('documentUrl', $documentUrl);
		$templateMgr->assign('textureFolderPath', $this->plugin->getTextureFolderUrl($request));
		return $templateMgr->fetch($editorTemplateFile);
	}
	
	/**
	 * fetch xml document 
	 * 
	 * @param $args array
	 * @param $request PKPRequest
	 * 
	 * @return string
	 */
	public function xml($args, $request) {
		$submissionFile = $this->getAuthorizedContextObject(ASSOC_TYPE_SUBMISSION_FILE);
		if (!$submissionFile) {
			fatalError('Invalid request');
		}
		
		$fileId = $submissionFile->getFileId();
		$stageId = (int) $request->getUserVar('stage');
		
		$submissionFileDao = DAORegistry::getDAO('SubmissionFileDAO');
		if (empty($submissionFile)) {
			echo __('plugins.generic.markup.archive.no_article'); // TODO custom message
			exit;
		}
		
		$filePath = $submissionFile->getFilePath();
		$postdata = file_get_contents("php://input");
		
		if (!empty($postdata)) {
			$data = (array) json_decode($postdata);
			if (empty($data['content'])) {
				return new JSONMessage(false);
			}
			
			$xmlheader = '<?xml version="1.0"?>'. PHP_EOL;
			file_put_contents($filePath, $xmlheader . $data['content']);
			return new JSONMessage(true);
		}
		else {
			$fileContent = file_get_contents($filePath);
			return $fileContent;
		}
	}
	
	/**
	 * Trigger a job on xml server
	 * 
	 * @param $args array
	 * @param $request PKPRequest
	 * 
	 * @return JSONMessage
	 */
	public function triggerConversion($args, $request) {
		$submissionFile = $this->getAuthorizedContextObject(ASSOC_TYPE_SUBMISSION_FILE);
		if (!$submissionFile) {
			return new JSONMessage(false);
		}
		
		$fileId = $submissionFile->getFileId();
		$stage = $request->getUserVar('stage');
			
		$target = $request->getUserVar('target');
		$jobId = $this->plugin->fetchGateway($fileId, $stage, $target);
		
		$journal = $request->getJournal();
		$url = $this->plugin->getSetting($journal->getid(), 'markupHostURL');
		$message = __('plugins.generic.markup.job.success', array('url' => $url));
		
		$router = $request->getRouter();
		$dispatcher = $router->getDispatcher();
		$conversionJobStatusCheckUrl = $dispatcher->url($request, ROUTE_PAGE, null, 'markup', 
			'fetchConversionJobStatus', null, array('submissionId' => $submissionFile->getSubmissionId(), 'fileId' => $submissionFile->getFileId(), 'job' => $jobId));
		
		$templateFile = $this->plugin->getTemplatePath() . 'convert-result.tpl';
		AppLocale::requireComponents(LOCALE_COMPONENT_APP_COMMON,  LOCALE_COMPONENT_PKP_MANAGER);
		$templateMgr = TemplateManager::getManager($request);
		$templateMgr->assign('jobId', $jobId);
		$templateMgr->assign('message', $message);
		$templateMgr->assign('conversionJobStatusCheckUrl', $conversionJobStatusCheckUrl);
		$output = $templateMgr->fetch($templateFile);
		return new JSONMessage(true, $output);
	}
	
	/**
	 * fetch xml job status
	 * 
	 * @param $args array
	 * @param $request PKPRequest
	 * 
	 * @return JSONMessage
	 */
	public function fetchConversionJobStatus($args, $request)
	{
		$journal = $request->getJournal();
		$jobId = $request->getUserVar('job');	// TODO validate jobId here
		
		$markupJobInfoDao = DAORegistry::getDAO('MarkupJobInfoDAO');
		$jobInfo = $markupJobInfoDao->getMarkupJobInfo($jobId);
		$xmlJobId = $jobInfo->getXmlJobId();
		
		// Import host, user and password variables into the current symbol table from an array
		extract($this->plugin->getOTSLoginParametersForJournal($journal->getId(), $request->getUser()));
		
		$this->plugin->import('classes.XMLPSWrapper');
		$xmlpsWrapper = new XMLPSWrapper($host, $user, $password);
		$code = (int) $xmlpsWrapper->getJobStatus($xmlJobId);
		$status = $xmlpsWrapper->statusCodeToLabel($code);
		
		$isCompleted = in_array($code, array(XMLPSWrapper::JOB_STATUS_FAILED, XMLPSWrapper::JOB_STATUS_COMPLETED));
		$json = new JSONMessage(true, array(
				'status' => $status, 
				'isCompleted' => $isCompleted 
			)
		);
		
		if ($isCompleted) {
			$json->setEvent('dataChanged');
			$json->setAdditionalAttributes(array('reloadContainer' => true));
		}
		
		return $json;
	}
	
	/**
	 * 
	 * @param $args array
	 * @param $request PKPRequest
	 * 
	 */
	public function save($args, $request) {
		throw new Exception("Not yet implemented!");
	}
	
	/**
	 * Display login credentials form in case of user specific authentication
	 * @param $args array
	 * @param $request PKPRequest
	 * 
	 * @return JSONMessage
	 */
	public function profile($args, $request) {
		$context = $request->getContext();
		AppLocale::requireComponents(LOCALE_COMPONENT_APP_COMMON,  LOCALE_COMPONENT_PKP_MANAGER);
		$templateMgr = TemplateManager::getManager($request);
		$templateMgr->register_function('plugin_url', array($this, 'smartyPluginUrl'));
		
		$this->plugin->import('MarkupProfileSettingsForm');
		$form = new MarkupProfileSettingsForm($this->plugin, $context->getId());
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

	protected function buildSubmissionMetadata($contextId) {
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
		// TODO do we need more const here?
		$fileStageNames = array(
			SUBMISSION_FILE_SUBMISSION 		=> __('submission.submit.submissionFiles'),
			SUBMISSION_FILE_REVIEW_FILE 		=> __('reviewer.submission.reviewFiles'),
			SUBMISSION_FILE_COPYEDIT 		=> __('submission.copyedited'),
			SUBMISSION_FILE_PROOF 			=> __('submission.pageProofs'),
			SUBMISSION_FILE_PRODUCTION_READY	=> __('editor.submission.production.productionReadyFiles'),
		);

		while ($submission = $submissions->next()) {
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
				if (intval($genre->getCategory()) != GENRE_CATEGORY_DOCUMENT)
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

	/**
	 * Display batch conversion page
	 * @param $args array
	 * @param $request PKPRequest
	 *
	 * @return JSONMessage
	 */
	public function batch($args, $request) {
		AppLocale::requireComponents(
			LOCALE_COMPONENT_APP_SUBMISSION,
			LOCALE_COMPONENT_PKP_SUBMISSION,
			LOCALE_COMPONENT_APP_EDITOR,
			LOCALE_COMPONENT_PKP_EDITOR,
			LOCALE_COMPONENT_PKP_COMMON,
			LOCALE_COMPONENT_APP_COMMON
		);

		$this->plugin->import('classes.MarkupBatchConversionHelper');
		$batchConversionHelper = new MarkupBatchConversionHelper();

		$context = $request->getContext();
		$dispatcher = $request->getDispatcher();
		$templateMgr = TemplateManager::getManager();
		$submissionMetadata = $this->buildSubmissionMetadata($context->getId());
		$batchConversionStatusUrl = $dispatcher->url($request, ROUTE_PAGE, null, 'batch', 'fetchConversionStatus', null);
		$startConversionUrl = $dispatcher->url($request, ROUTE_PAGE, null, 'batch', 'startConversion', null);
		$templateMgr->assign('batchConversionStatusUrl', $batchConversionStatusUrl);
		$templateMgr->assign('startConversionUrl', $startConversionUrl);

		if ($batchConversionHelper->isRunning()) {
			$data = $batchConversionHelper->readOutFile();
			$cancelConversionUrl = $dispatcher->url($request, ROUTE_PAGE, null, 'batch', 'cancelConversion',
					null, array('token' => $data['cancellationToken']));
			$templateMgr->assign('cancelConversionUrl', $cancelConversionUrl);
		}
		$templateMgr->assign('submissions', $submissionMetadata);
		$templateMgr->assign('batchConversionIsRunning', $batchConversionHelper->isRunning());
		$templateFile = $this->plugin->getTemplatePath() . 'batchConversion.tpl';
		$output = $templateMgr->fetch($templateFile);
		return new JSONMessage(true, $output);
	}
}