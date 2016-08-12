<?php

/**
 * @file plugins/generic/markup/helpers/XMLPSWrapper.inc.php
 *
 * Copyright (c) 2003-2016 Simon Fraser University Library
 * Copyright (c) 2003-2016 John Willinsky
 * Distributed under the GNU GPL v2. For full terms see the file docs/COPYING.
 *
 * @class XMLPSWrapper
 * @ingroup plugins_generic_markup
 *
 * @brief Wrapper class for XML Parsing Service
 * 
 */
class XMLPSWrapper {
    
    const JOB_CONVERSION_STAGE_ZIP = 10;
    const JOB_STATUS_PENDING = 0;
    const JOB_STATUS_PROCESSING = 1;
    const JOB_STATUS_COMPLETED = 2;
    
    protected $username = null;
    protected $password = null;
    protected $host = null;
    
    /**
     * Initialize object with server parameters
     * 
     * @param $host string server hostname
     * @param $username string username
     * @param $password string password
     * 
     */
    public function __construct($host, $username = null, $password = null) {
        
        if (is_null($host) || empty($host)) {
            throw new Exception('Server host name is required.');
        }
        
        $this->host = rtrim($host, '/');
        $this->username = $username;
        $this->password = $password;
    }
    
    /**
     * Internal helper method to build request url
     * 
     * @param $endpoint string api endpoint
     * @param $params array parameters
     * 
     * @return string
     */
    protected function _buildRequestUrl($endpoint, $params = array()) {
        
        $endpoint = trim($endpoint, '/');
        $params = http_build_query($params);
        $url = "{$this->host}/{$endpoint}";
        
        return empty($params) ? $url : "{$url}?{$params}";
    }
    
    /**
     * Internal helper method that makes request to api endpoint
     * 
     * @param $endpoint string api endpoint
     * @param $params array parameters
     * @param $authRequired boolean whether authentication is required
     * @param $isPost boolean Whether to use GET/POST request
     * 
     * @return array
     * 
     * @throws Exception login credentials are not set for and api call requires authentication
     * @throws Exception When request fails.
     */
    protected function _makeApiRequest($endpoint, $params, $authRequired = false, $isPost = false) {

        if ($authRequired) {
            
            if (empty($this->username) || empty($this->password)) {
                throw new Exception('Login credentials (username & password) are required for server authentication.');
            }
            
            $credentials = array(
                'email' => $this->username,
                'password' => $this->password,
            );
            
            $params = array_merge($params, $credentials);
        }
        
        $apiUrl = null;
        $ch = curl_init();
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, 1);
        
        if ($isPost) {
            curl_setopt($ch, CURLOPT_POST, 1);
            curl_setopt($ch, CURLOPT_POSTFIELDS, $params);
            
            $apiUrl = $this->_buildRequestUrl($endpoint);
        }
        else {
            $apiUrl = $this->_buildRequestUrl($endpoint, $params);
        }
        
        
        curl_setopt($ch, CURLOPT_URL, $apiUrl);
        $response = curl_exec($ch);
        $response = json_decode($response, true);
        
        if (!$response) {
            $error = curl_error($ch);
            
            if (empty($error)) {
                $error = 'HTTP status: ' . curl_getinfo($ch, CURLINFO_HTTP_CODE);
            }
            
            throw new Exception($error);
        }
        
        curl_close($ch);
        
        return $response;
    }
    
    /**
     * Submit a file for conversion
     * 
     * @param $fileName string file name
     * @param $fileContent string content
     * @param $citationStyleHash string citation style hash
     * 
     * @return int
     * 
     * @throws Exception When response status is not equal to success.
     */
    public function submitJob($fileName, $fileContent, $citationStyleHash) {
        
        $params = array(
            'fileName' => $fileName,
            'fileContent' => $fileContent,
            'citationStyleHash' => $citationStyleHash,
        );
        
        $response = $this->_makeApiRequest('api/job/submit', $params, true, true);
        
        if ($response['status'] != "success") {
            throw new Exception('Job submission failed.');
        }
        
        return $response['id'];
    }
    
    /**
     * Query a job's status
     * 
     * @param $jobId int job id
     * 
     * @return int
     * 
     * @throws Exception When response status is not equal to success.
     */
    public function getJobStatus($jobId) {
        
        $params = array(
            'id' => $jobId
        );
        
        $response = $this->_makeApiRequest('api/job/status', $params, true);
        
        if ($response['status'] != "success") {
            throw new Exception('Job submission failed.');
        }
        
        return $response['jobStatus'];
    }
    
    /**
     * Get the converted file URL
     * 
     * @param $jobId int job id
     * 
     * @return string
     */
    protected function _getFileUrl($jobId, $conversionStage) {
        
        $params = array(
            'id' => $jobId,
            'conversionStage' => self::JOB_CONVERSION_STAGE_ZIP,
            'email' => $this->username,
            'password' => $this->password,
        );
        
        return $this->_buildRequestUrl('api/job/retrieve', $params);
    }
    
    /**
     * Get a job final stage archive zip file
     * 
     * @param $jobId int job id
     * @param $filename Name for downloaded file
     * @param $destinationDir Destination directory
     * 
     * @return string
     */
    public function downloadFile($jobId, $filename = 'documents.zip', $destinationDir = null)
    {
        if (is_null($destinationDir)) {
            $destinationDir = sys_get_temp_dir();
        }
        
        $fileUrl = $this->_getFileUrl($jobId, $conversionStage);
        $filePath = rtrim($destinationDir, '/') . '/' . $filename;
        
        if (file_exists($filePath)) {
            @unlink($filePath);
        }
        
        if (!@copy($fileUrl, $filePath)) {
            throw new Exception("Unable to copy from {$fileUrl} to {$filePath}");
        }
        
        return $filePath;
    }
    
    /**
     * Get list of citation styles
     * 
     * @return array
     * 
     * @throws Exception When response status is not equal to success.
     */
    public function getCitationList() {
        
        $response = $this->_makeApiRequest('/api/job/citationStyleList', array());
        
        if ($response['status'] != "success") {
            throw new Exception('Job submission failed.');
        }
        
        return $response['citationStyles'];
    }
    
}