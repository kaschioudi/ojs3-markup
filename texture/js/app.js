var t = window.texture;

var configurator = new t.TextureConfigurator()
	.import(t.AuthorPackage)
	.setXMLStore(OJSXMLStore)

if (typeof window !== 'undefined') {
	window.onload = function() {
		var app = t.Texture.mount({
			configurator: configurator,
			documentId: document.querySelector('meta[name=jobId').getAttribute('content')
		}, document.body)
		window.app = app
	}
}