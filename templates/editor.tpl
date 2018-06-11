{**
 * plugins/generic/markup/templates/editor.tpl
 *
 * Copyright (c) 2014-2018 Simon Fraser University
 * Copyright (c) 2003-2018 John Willinsky
 * Distributed under the GNU GPL v2. For full terms see the file docs/COPYING.
 *
 * Texture editor page
 *}
<html>
<head>
	<meta charset="UTF-8">
	<meta name="jobId" content="{$documentUrl}">
	<link href='{$textureFolderPath}/css/texture.css' rel='stylesheet' type='text/css'/>
	<link href='{$textureFolderPath}/css/texture-reset.css' rel='stylesheet' type='text/css'/>
	<link href='{$textureFolderPath}/css/substance.css' rel='stylesheet' type='text/css'/>
	<link href='{$textureFolderPath}/css/texture-pagestyle.css' rel='stylesheet' type='text/css'/>
	<link href='{$textureFolderPath}/css/font-awesome.min.css' rel='stylesheet' type='text/css'/>
	<link href='{$textureFolderPath}/css/editor.css' rel='stylesheet' type='text/css'/>
</head>
<body>
	<div id="toolbar">
		<div id="feedback" class="save-feedback"></div>
		<input class="save-btn" type="button" id="saveDocument" value="Save" />
	</div>
	<div id="editor"></div>
	
	<script type="text/javascript" src="{$textureFolderPath}/js/substance.js"></script>
	<script type="text/javascript" src="{$textureFolderPath}/js/texture.js"></script>
	<script type="text/javascript" src="{$textureFolderPath}/js/jquery.min.js"></script>
	<script type="text/javascript" src="{$textureFolderPath}/js/editor.js"></script>
	<script type="text/javascript" src="{$textureFolderPath}/js/app.js"></script>
</body>
</html>