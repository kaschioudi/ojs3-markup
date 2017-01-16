<?php

/**
 * @file plugins/generic/markup/classes/MarkupJobInfo.inc.php
 *
 * Copyright (c) 2003-2016 Simon Fraser University Library
 * Copyright (c) 2003-2016 John Willinsky
 * Distributed under the GNU GPL v2. For full terms see the file docs/COPYING.
 *
 * @class MarkupJobInfo
 * @ingroup plugins_generic_markup
 *
 * @brief class containing metadata about a job triggered 
 * 
 */
class MarkupJobInfo extends DataObject {
	
	//
	// constructor
	//
	public function __construct() {
		parent::__construct();
	}

	/**
	 * Get job unique ID
	 * @return string
	 */
	function getId() {
		return $this->getData('id');
	}
	
	/**
	 * Set job unique ID
	 * @param $jobId string
	 */
	function setId($jobId) {
		return $this->setData('id', $jobId);
	}

	/**
	 * Get submission file ID
	 * @return int
	 */
	function getFileId() {
		return $this->getData('fileId');
	}
	
	/**
	 * Set job unique ID
	 * @param $fileId int
	 */
	function setFileId($fileId) {
		return $this->setData('fileId', $fileId);
	}
	
	/**
	 * Get ID of user who triggered the job
	 * @return int
	 */
	function getUserId() {
		return $this->getData('userId');
	}
	
	/**
	 * Set ID of user who triggered the job
	 * @param $userId int
	 */
	function setUserId($userId) {
		return $this->setData('userId', $userId);
	}

	/**
	 * Get xml job id 
	 * @return int
	 */
	function getXmlJobId() {
		return $this->getData('xmlJobId');
	}
	
	/**
	 * Set xml job id
	 * @param $xmlJobId int
	 */
	function setXmlJobId($xmlJobId) {
		return $this->setData('xmlJobId', $xmlJobId);
	}
	
	/**
	 * Get the journal ID
	 * @return int
	 */
	function getJournalId() {
		return $this->getData('journalId');
	}
	
	/**
	 * Set the journal ID
	 * @param $journalId int
	 */
	function setJournalId($journalId) {
		return $this->setData('journalId', $journalId);
	}
}