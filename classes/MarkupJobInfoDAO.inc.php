<?php

/**
 * @file plugins/generic/markup/classes/MarkupJobInfoDAO.inc.php
 *
 * Copyright (c) 2003-2016 Simon Fraser University Library
 * Copyright (c) 2003-2016 John Willinsky
 * Distributed under the GNU GPL v2. For full terms see the file docs/COPYING.
 *
 * @class MarkupJobInfoDAO
 * @ingroup plugins_generic_markup
 *
 * @brief operations for managing MarkupJobInfo objects 
 * 
 */

import('lib.pkp.classes.db.DAO');

class MarkupJobInfoDAO extends DAO {
	/** @var $plugin MarkupPlugin Reference to markup plugin */
	protected $plugin = null;
	
	//
	// constructor
	//
	public function __construct($parentPlugin) {
		parent::__construct();
		$this->plugin = $parentPlugin;
	}
	
	/**
	 * Internal function to return MarkupJobInfo object from a row.
	 * @param $row array
	 * @return MarkupJobInfo
	 */
	protected function returnMarkupJobInfoFromRow($row) {
		$this->plugin->import('classes.MarkupJobInfo');
	
		$markupJobInfo = new MarkupJobInfo();
		$markupJobInfo->setId($row['id']);
		$markupJobInfo->setJournalId($row['journal_id']);
		$markupJobInfo->setFileId($row['file_id']);
		$markupJobInfo->setUserId($row['user_id']);
		$markupJobInfo->setXmlJobId($row['xml_job_id']);
	
		return $markupJobInfo;
	}
	
	/**
	 * Retrieve a MarkupJobInfo by ID.
	 * @param $jobId string
	 * @return MarkupJobInfo
	 */
	public function getMarkupJobInfo($jobId) {
		$result = $this->retrieve(
				'SELECT * FROM markup_jobinfos WHERE id = ?', $jobId
		);
	
		$returner = null;
		if ($result->RecordCount() != 0) {
			$returner = $this->returnMarkupJobInfoFromRow($result->GetRowAssoc(false));
		}
		$result->Close();
		return $returner;
	}
	
	/**
	 * Retrieve a MarkupJobInfo by file ID.
	 * @param $fileId string
	 * @return MarkupJobInfo
	 */
	public function getMarkupJobInfobyFileId($fileId) {
		$result = $this->retrieve(
				'SELECT * FROM markup_jobinfos WHERE file_id = ?', $jobId
		);
	
		$returner = null;
		if ($result->RecordCount() != 0) {
			$returner = $this->returnMarkupJobInfoFromRow($result->GetRowAssoc(false));
		}
		$result->Close();
		return $returner;
	}
	
	/**
	 * Insert a new markup job info.
	 * @param $markupJobInfo MarkupJobInfo
	 * @return int
	 */
	public function insertMarkupJobInfo($markupJobInfo) {
		
		$ret = $this->update(
				'INSERT INTO markup_jobinfos
				(id,
				journal_id,
				user_id,
				file_id,
				xml_job_id,
				created_at)
			VALUES
				(?, ?, ?, ?, ?, ?)',
				array(
						$markupJobInfo->getId(),
						$markupJobInfo->getJournalId(),
						$markupJobInfo->getUserId(),
						$markupJobInfo->getFileId(),
						$markupJobInfo->getXmlJobId(),
						date('Y-m-d H:i:s')
				)
		);
		
		$markupJobInfo->setId($this->getInsertId());
	
		return $markupJobInfo->getId();
	}
	
	/**
	 * Get the ID of the last inserted job info.
	 * @return int
	 */
	public function getInsertId() {
		return $this->_getInsertId('markup_jobinfos', 'id');
	}
	
	/**
	 * Update a markup job info.
	 * @param $markupJobInfo MarkupJobInfo
	 * @return boolean
	 */
	public function updateMarkupJobInfo($markupJobInfo) {
		$this->update(
			'UPDATE markup_jobinfos
				SET
					journal_id = ?,
					file_id = ?,
					user_id = ?,
					xml_job_id = ?,
					updated_at = ?
			WHERE id = ?',
				array(
					$markupJobInfo->getJournalId(),
					$markupJobInfo->getFileId(),
					$markupJobInfo->getUserId(),
					$markupJobInfo->getXmlJobId(),
					date('Y-m-d H:i:s'),
					$markupJobInfo->getId(),
				)
		);
	}

	/**
	 * Delete a markup job info entry
	 * @param int $fileId
	 */
	public function deleteByFileId($fileId) {
		$this->update(
			'DELETE FROM markup_jobinfos WHERE file_id = ?',
			array((int) $fileId)
		);
	}
}