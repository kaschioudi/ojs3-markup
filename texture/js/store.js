
function OJSXMLStore() {
	this.readXML = function(documentId, cb) {
		fetch(documentId, {
			  credentials: 'same-origin'
		})
		.then(function(response){
			response.text().then(function(xml) {
				cb(null, xml);
			});
		})
	};
	
	this.writeXML = function(documentId, xml, cb) {
		var data = {'content': xml};
		alert('NOT YET IMPLEMENTED!');
	};
}