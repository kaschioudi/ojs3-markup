<?php

/**
 * @file controllers/grid/MarkupBatchConversionGridHandler.inc.php
 *
 * Copyright (c) 2014-2017 Simon Fraser University
 * Copyright (c) 2003-2017 John Willinsky
 * Distributed under the GNU GPL v2. For full terms see the file docs/COPYING.
 *
 * @class MarkupBatchConversionGridHandler
 * @ingroup controllers_grid_markup
 *
 * @brief Handle markup batch conversion grid requests.
 */

import('lib.pkp.controllers.grid.submissions.SubmissionsListGridHandler');
import('plugins.generic.markup.controllers.grid.MarkupBatchConversionGridRow');
import('plugins.generic.markup.controllers.grid.MarkupBatchConversionGridCellProvider');

class MarkupBatchConversionGridHandler extends SubmissionsListGridHandler {
	/** @var MarkupPlugin The markup plugin */
	protected static $plugin;

	/**
	 * Set the static pages plugin.
	 * @param $plugin StaticPagesPlugin
	 */
	public static function setPlugin($plugin) {
		self::$plugin = $plugin;
	}

	/**
	 * Constructor
	 */
	function __construct() {
		parent::__construct();
		$this->addRoleAssignment(
			array(ROLE_ID_MANAGER),
			array('index', 'fetchGrid', 'fetchRow', 'fetchRows')
		);
	}

	/**
	 * @copydoc Gridhandler::initialize()
	 */
	function initialize($request, $args = null) {
		parent::initialize($request);
		$context = $request->getContext();
		$router = $request->getRouter();

		$this->setTitle('plugins.generic.markup.batch');

		$authorizedRoles = $this->getAuthorizedContextObject(ASSOC_TYPE_USER_ROLES);
		$cellProvider = new MarkupBatchConversionGridCellProvider($request->getUser(), $authorizedRoles);

		$this->addColumn(
			new GridColumn(
				'select',
				'',
				null,
				'controllers/grid/common/cell/selectStatusCell.tpl',
				$cellProvider,
				array('width' => 5)
			)
		);

		$columns =& $this->getColumns();
		$columns = array(
			'select'=> $columns['select'],
			'id' 	=> $columns['id'],
			'title' => $columns['title'], 
			'stage' => $columns['stage'],
		);
	}

	/**
	 * @copyDoc GridHandler::renderFilter()
	 */
	function renderFilter($request, $filterData = array()) {
		$filterData = array('active' => true);
		return parent::renderFilter($request, $filterData);
	}

	/**
	 * @copyDoc GridHandler::getFilterSelectionData()
	 */
	function getFilterSelectionData($request) {
		return array_merge(
			parent::getFilterSelectionData($request),
			array(
				'orphaned' => $request->getUserVar('orphaned') ? (int) $request->getUserVar('orphaned') : null,
			)
		);
	}

	/**
	 * @copydoc GridHandler::loadData()
	 */
	protected function loadData($request, $filter) {
		$submissionDao = Application::getSubmissionDAO();
		$context = $request->getContext();
		$rangeInfo = $this->getGridRangeInfo($request, $this->getId());

		list($search, $column, $stageId, $sectionId) = $this->getFilterValues($filter);
		$title = $author = $editor = null;
		if ($column == 'title') {
			$title = $search;
		} elseif ($column == 'author') {
			$author = $search;
		} elseif ($column == 'editor') {
			$editor = $search;
		}

		$nonExistingUserId = 0;
		return $submissionDao->getActiveSubmissions($context->getId(), $title, $author, $editor, $stageId, $sectionId, $rangeInfo, $filter['orphaned']);
	}

	/**
	 * @copydoc Gridhandler::getRowInstance()
	 */
	function getRowInstance() {
		return new MarkupBatchConversionGridRow();
	}

	/**
	 * Display the grid's containing page.
	 * @param $args array
	 * @param $request PKPRequest
	 */
	public function index($args, $request) {
		$context = $request->getContext();
		$dispatcher = $request->getDispatcher();
		$templateMgr = TemplateManager::getManager();
		$templateMgr->assign('pluginJavaScriptURL', self::$plugin->getJsUrl($request));
		$templateMgr->assign('pluginCssURL', self::$plugin->getCssUrl($request));
		$batchFilesToConvert = $dispatcher->url($request, ROUTE_PAGE, null, 'batch', 'filesToConvert', null);
		$conversionTriggerUrl = $dispatcher->url($request, ROUTE_PAGE, null, 'markup', 'triggerConversion', null);
		$templateMgr->assign('batchFilesToConvert', $batchFilesToConvert);
		$templateMgr->assign('conversionTriggerUrl', $conversionTriggerUrl);
		$templateFile = self::$plugin->getTemplatePath() . 'batchConversion.tpl';
		$output = $templateMgr->fetch($templateFile);
		return new JSONMessage(true, $output);
	}
}
