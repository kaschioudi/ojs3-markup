<?php

/**
 * @file plugins/generic/markup/MarkupSettingsTabHandler.inc.php
 *
 * Copyright (c) 2003-2016 Simon Fraser University Library
 * Copyright (c) 2003-2016 John Willinsky
 * Distributed under the GNU GPL v2. For full terms see the file docs/COPYING.
 *
 * @class MarkupSettingsTabHandler
 * @ingroup plugins_generic_markup
 *
 * @brief Responds to requests for markup files for particular journal article;
 * sends request to markup an article to Document Markup Server.
 */

import('classes.handler.Handler');

class MarkupSettingsTabHandler extends Handler {
	/** @var MarkupPlugin The Document markup plugin */
	protected $plugin = null;
	
	/**
	 * Constructor
	 */
	public function __construct() {
		parent::__construct();
		
		// set reference to markup plugin
		$this->plugin = PluginRegistry::getPlugin('generic', 'markupplugin');
		
		$this->addRoleAssignment(
			array(ROLE_ID_MANAGER),
			array('settings')
		);
	}
	

	public function settings($args, $request) {
		
		$context = $request->getContext();
		AppLocale::requireComponents(LOCALE_COMPONENT_APP_COMMON,  LOCALE_COMPONENT_PKP_MANAGER);
		$templateMgr = TemplateManager::getManager($request);
		$templateMgr->register_function('plugin_url', array($this, 'smartyPluginUrl'));
		
		$this->plugin->import('MarkupSettingsForm');
		$form = new MarkupSettingsForm($this->plugin, $context->getId());
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
}