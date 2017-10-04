<?php 

/**
 * @file plugins/generic/markup/classes/MarkupBatchConversionHelper.inc.php
 *
 * Copyright (c) 2003-2017 Simon Fraser University
 * Copyright (c) 2003-2017 John Willinsky
 * Distributed under the GNU GPL v2. For full terms see the file docs/COPYING.
 *
 * @class MarkupBatchGatewayPlugin
 * @ingroup plugins_generic_markup
 *
 * @brief Batch conversion Helper class
 *
 */

class MarkupBatchConversionHelper {
	/** @var $outFile string Path to file used for inter process communication */
	protected $outFile = null;

	/**
	 * Constructor
	 */
	public function __construct() {
		$this->outFile = sys_get_temp_dir() . '/markupBatch.out';
	}
	/**
	 * Determines whether a conversion is already running 
	 * @return boolean
	 */
	public function isRunning() {
		return file_exists($this->outFile);
	}
	
	/**
	 * Helper function to create a temporary file containing some data
	 * @param $data array
	 * @throws Exception
	 */
	public function createOutFile($data) {
		if (file_exists($this->outFile)) {
			throw new Exception(__('plugins.generic.markup.file-exists', array('file' => $this->outFile)));
		}
		else {
			file_put_contents($this->outFile, serialize($data));
		}
	}

	/**
	 * Update file content
	 * @param array $data
	 */
	public function updateOutFile($data) {
		file_put_contents($this->outFile, serialize($data), LOCK_EX);
	}

	/**
	 * Read the file content
	 * @return array|null
	 */
	public function readOutFile() {
		if ($this->isRunning()) {
			$content = file_get_contents($this->outFile);
			return unserialize($content);
		}
		return null;
	}

	/**
	 * Helper function to delete the temporary file
	 */
	public function deleteOutFile() {
		if (file_exists($this->outFile)) {
			unlink($this->outFile);
		}
	}

	/**
	 * Custom error handler callback to cleanup in case of runtime error
	 * @param $errno int
	 * @param $errstr string
	 * @param $errfile string
	 * @param $errline int
	 * @return boolean
	 */
	public function errorHandler($errno, $errstr, $errfile, $errline) {
		$this->deleteOutFile();
		// returning false because we still want PHP internal error handler to run
		return false;
	}
}