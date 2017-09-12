<?php

/**
 * @file controllers/grid/MarkupBatchConversionGridRow.inc.php
 *
 * Copyright (c) 2014-2017 Simon Fraser University
 * Copyright (c) 2003-2017 John Willinsky
 * Distributed under the GNU GPL v2. For full terms see the file docs/COPYING.
 *
 * @class MarkupBatchConversionGridRow
 * @ingroup controllers_grid_markup
 *
 * @brief Handle markup batch conversion grid row requests.
 */

import('lib.pkp.classes.controllers.grid.GridRow');

class MarkupBatchConversionGridRow extends GridRow {
	/**
	 * Constructor
	 */
	function __construct() {
		parent::__construct();
	}

	//
	// Overridden template methods
	//
	/**
	 * @copydoc GridRow::initialize()
	 */
	function initialize($request, $template = null) {
		parent::initialize($request, $template);
	}
}