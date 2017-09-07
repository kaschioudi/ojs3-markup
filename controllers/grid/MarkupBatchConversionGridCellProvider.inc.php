<?php

/**
 * @file controllers/grid/MarkupBatchConversionGridCellProvider.inc.php
 *
 * Copyright (c) 2014-2016 Simon Fraser University Library
 * Copyright (c) 2000-2016 John Willinsky
 * Distributed under the GNU GPL v2. For full terms see the file docs/COPYING.
 *
 * @class MarkupBatchConversionGridCellProvider
 * @ingroup controllers_grid_markup
 *
 * @brief Class for a cell provider to display information about articles for batch conversion
 */

import('lib.pkp.controllers.grid.submissions.SubmissionsListGridCellProvider');
import('lib.pkp.classes.linkAction.request.RedirectAction');

class MarkupBatchConversionGridCellProvider extends SubmissionsListGridCellProvider {
	/**
	 * Constructor
	 */
	function __construct($user, $authorizedRoles = null) {
		parent::__construct($user, $authorizedRoles);
	}

	/**
	 * Extracts variables for a given column from a data element
	 * so that they may be assigned to template before rendering.
	 * @param $row GridRow
	 * @param $column GridColumn
	 * @return array
	 */
	function getTemplateVarsFromRowColumn($row, $column) {
		$submission = $row->getData();
		$columnId = $column->getId();
		assert(is_a($submission, 'DataObject') && !empty($columnId));

		switch ($columnId) {
			case 'select':
				return array('selected' => false, 'disabled' => false, 'value' => $submission->getId());
			default:
				return parent::getTemplateVarsFromRowColumn($row, $column);
		}
	}
}