(function (global, factory) {
    typeof exports === 'object' && typeof module !== 'undefined' ? factory(exports, require('substance')) :
    typeof define === 'function' && define.amd ? define(['exports', 'substance'], factory) :
    (factory((global.texture = global.texture || {}),global.substance));
}(this, (function (exports,substance) {

/*
  Texture Component

  Based on given mode prop, displays the Publisher, Author or Reader component
*/
var Texture = (function (Component$$1) {
  function Texture(parent, props) {
    Component$$1.call(this, parent, props)

    if (!props.configurator) {
      throw new Error("'configurator' is required")
    }
    this.configurator = props.configurator
    this.xmlStore = this.configurator.getXMLStore()
  }

  if ( Component$$1 ) Texture.__proto__ = Component$$1;
  Texture.prototype = Object.create( Component$$1 && Component$$1.prototype );
  Texture.prototype.constructor = Texture;

  Texture.prototype.getChildContext = function getChildContext () {
    return {
      xmlStore: this.xmlStore
    }
  };

  Texture.prototype.getInitialState = function getInitialState () {
    return {
      documentSession: null,
      error: null
    }
  };

  Texture.prototype.didMount = function didMount () {
    // load the document after mounting
    this._loadDocument(this.props.documentId)
  };

  Texture.prototype.willReceiveProps = function willReceiveProps (newProps) {
    if (newProps.documentId !== this.props.documentId) {
      this.dispose()
      this.state = this.getInitialState()
      this._loadDocument(newProps.documentId)
    }
  };

  Texture.prototype.dispose = function dispose () {
    // Note: we need to clear everything, as the childContext
    // changes which is immutable
    this.empty()
  };

  Texture.prototype.render = function render ($$) {
    var el = $$('div').addClass('sc-texture')

    if (this.state.error) {
      el.append(this.state.error)
    }

    if (this.state.documentSession) {
      var ComponentClass = this.configurator.getInterfaceComponentClass()

      el.append($$(ComponentClass, {
        documentId: this.props.documentId,
        documentSession: this.state.documentSession,
        configurator: this.getConfigurator()
      }))
    }
    return el
  };

  Texture.prototype.getConfigurator = function getConfigurator () {
    return this.configurator
  };

  Texture.prototype.createDocumentSession = function createDocumentSession (doc) {
    return new substance.DocumentSession(doc)
  };

  Texture.prototype._loadDocument = function _loadDocument () {
    var configurator = this.getConfigurator()
    this.xmlStore.readXML(this.props.documentId, function(err, xml) {
      if (err) {
        console.error(err)
        this.setState({
          error: new Error('Loading failed')
        })
        return
      }
      var importer = configurator.createImporter('jats')
      var doc = importer.importDocument(xml)

      // HACK: For debug purposes
      window.doc = doc
      this.setState({
        documentSession: this.createDocumentSession(doc)
      })
    }.bind(this))
  };

  return Texture;
}(substance.Component));

var SaveHandlerStub = function SaveHandlerStub () {};

SaveHandlerStub.prototype.saveDocument = function saveDocument (doc, changes, cb) {
  console.warn('No SaveHandler provided. Using Stub.')
  cb(null)
};

var FileClientStub = function FileClientStub () {};

FileClientStub.prototype.uploadFile = function uploadFile (file, cb) {
  var delay = 50
  var steps = (file.size / 500000) * (1000 / delay)
  var i = 0
  var channel = new substance.EventEmitter()
  var _step = function() {
    if (i++ < steps) {
      channel.emit('progress', (i-1)/(steps))
      window.setTimeout(_step, delay)
    } else {
      // Default file upload implementation
      // We just return a temporary objectUrl
      var fileUrl = window.URL.createObjectURL(file)
      cb(null, fileUrl)
    }
  }
  _step()
  return channel
};

var TextureConfigurator = (function (Configurator$$1) {
  function TextureConfigurator() {
    var args = [], len = arguments.length;
    while ( len-- ) args[ len ] = arguments[ len ];

    Configurator$$1.apply(this, args)

    this.config.saveHandler = new SaveHandlerStub()
    this.config.fileClient = new FileClientStub()
    this.config.xmlStore = null
    this.config.InterfaceComponentClass = null
  }

  if ( Configurator$$1 ) TextureConfigurator.__proto__ = Configurator$$1;
  TextureConfigurator.prototype = Object.create( Configurator$$1 && Configurator$$1.prototype );
  TextureConfigurator.prototype.constructor = TextureConfigurator;

  TextureConfigurator.prototype.setInterfaceComponentClass = function setInterfaceComponentClass (Class) {
    if (this.config.InterfaceComponentClass) {
      throw new Error("InterfaceComponetClass can't be set twice")
    }
    this.config.InterfaceComponentClass = Class
  };

  TextureConfigurator.prototype.getInterfaceComponentClass = function getInterfaceComponentClass () {
    return this.config.InterfaceComponentClass
  };

  TextureConfigurator.prototype.setSaveHandler = function setSaveHandler (saveHandler) {
    this.config.saveHandler = saveHandler
  };

  TextureConfigurator.prototype.setFileClient = function setFileClient (fileClient) {
    this.config.fileClient = fileClient
  };

  TextureConfigurator.prototype.getFileClient = function getFileClient () {
    return this.config.fileClient
  };

  TextureConfigurator.prototype.getSaveHandler = function getSaveHandler () {
    return this.config.saveHandler
  };

  TextureConfigurator.prototype.setXMLStore = function setXMLStore (XMLStoreClass, params) {
    this.config.xmlStore = {
      Class: XMLStoreClass,
      params: params
    }
    return this
  };

  TextureConfigurator.prototype.getXMLStore = function getXMLStore () {
    var xmlStore = this.config.xmlStore
    var XMLStoreClass = this.config.xmlStore.Class
    return new XMLStoreClass(this.config.xmlStore.params)
  };

  return TextureConfigurator;
}(substance.Configurator));

var ExampleXMLStore = function ExampleXMLStore(data) {
  this.data = data
};

ExampleXMLStore.prototype.readXML = function readXML (documentId, cb) {
  var cached = localStorage.getItem(documentId)
  if (cached) {
    return cb(null, cached)
  }
  cb(null, this.data[documentId])
};

ExampleXMLStore.prototype.writeXML = function writeXML (documentId, xml, cb) {
  localStorage.setItem(documentId, xml)
  cb(null)
};

var SaveHandler = function SaveHandler(context) {
  this.context = context
};

SaveHandler.prototype.saveDocument = function saveDocument (doc, changes, cb) {
  var exporter = this.context.exporter
  var xml = exporter.exportDocument(doc)
  // console.log('### SAVING XML', xml);
  this.context.xmlStore.writeXML(this.context.documentId, xml, cb)
};

// TODO: we need to think if it is really a good idea to
// derive from ProseEditor here
// There would be a lot of code redundancy
var AbstractWriter = (function (AbstractEditor$$1) {
  function AbstractWriter() {
    var args = [], len = arguments.length;
    while ( len-- ) args[ len ] = arguments[ len ];

    AbstractEditor$$1.apply(this, args)

    this.handleActions({
      'tocEntrySelected': this.tocEntrySelected
    })
  }

  if ( AbstractEditor$$1 ) AbstractWriter.__proto__ = AbstractEditor$$1;
  AbstractWriter.prototype = Object.create( AbstractEditor$$1 && AbstractEditor$$1.prototype );
  AbstractWriter.prototype.constructor = AbstractWriter;

  AbstractWriter.prototype._initialize = function _initialize () {
    AbstractEditor$$1.prototype._initialize.apply(this, arguments);

    this.exporter = this._getExporter()
    this.tocProvider = this._getTOCProvider()
    this.saveHandler = this._getSaveHandler()
    this.documentSession.setSaveHandler(this.saveHandler)

    var doc = this.props.documentSession.getDocument()
    this.contentHighlights = new substance.Highlights(doc)
  };

  AbstractWriter.prototype.getChildContext = function getChildContext () {
    var childContext = AbstractEditor$$1.prototype.getChildContext.apply(this, arguments)
    childContext.tocProvider = this.tocProvider
    return childContext
  };

  AbstractWriter.prototype._renderToolbar = function _renderToolbar ($$) {
    var commandStates = this.commandManager.getCommandStates()
    return $$(substance.Toolbar, {
      commandStates: commandStates
    }).ref('toolbar')
  };

  AbstractWriter.prototype._renderContentPanel = function _renderContentPanel ($$) { // eslint-disable-line
    throw new Error("This method is abstract.")
  };

  AbstractWriter.prototype.tocEntrySelected = function tocEntrySelected (nodeId) {
    return this._scrollTo(nodeId)
  };

  AbstractWriter.prototype._scrollTo = function _scrollTo (nodeId) { // eslint-disable-line
    throw new Error("This method is abstract.")
  };

  AbstractWriter.prototype._getExporter = function _getExporter () {
    throw new Error("This method is abstract.")
  };

  AbstractWriter.prototype._getTOCProvider = function _getTOCProvider () {
    throw new Error("This method is abstract.")
  };

  AbstractWriter.prototype._getSaveHandler = function _getSaveHandler () {
    return new SaveHandler({
      documentId: this.props.documentId,
      xmlStore: this.context.xmlStore,
      exporter: this.exporter
    })
  };


  AbstractWriter.prototype.documentSessionUpdated = function documentSessionUpdated () {
    var toolbar = this.refs.toolbar
    if (toolbar) {
      var commandStates = this.commandManager.getCommandStates()
      toolbar.setProps({
        commandStates: commandStates
      })
    }

    var documentSession = this.documentSession
    var sel = documentSession.getSelection()
    var selectionState = documentSession.getSelectionState()

    var xrefs = selectionState.getAnnotationsForType('xref')
    var highlights = {
      'fig': [],
      'bibr': []
    }

    if (xrefs.length === 1 && xrefs[0].getSelection().equals(sel) ) {
      var xref = xrefs[0]
      highlights[xref.referenceType] = xref.targets.concat([xref.id])
    }

    this.contentHighlights.set(highlights)
  };

  return AbstractWriter;
}(substance.AbstractEditor));

var AuthorTOCProvider = (function (TOCProvider$$1) {
  function AuthorTOCProvider(documentSession) {
    TOCProvider$$1.call(this, documentSession.getDocument(), {
      containerId: 'bodyFlat'
    })
  }

  if ( TOCProvider$$1 ) AuthorTOCProvider.__proto__ = TOCProvider$$1;
  AuthorTOCProvider.prototype = Object.create( TOCProvider$$1 && TOCProvider$$1.prototype );
  AuthorTOCProvider.prototype.constructor = AuthorTOCProvider;

  return AuthorTOCProvider;
}(substance.TOCProvider));

var Author = (function (AbstractWriter$$1) {
  function Author () {
    AbstractWriter$$1.apply(this, arguments);
  }

  if ( AbstractWriter$$1 ) Author.__proto__ = AbstractWriter$$1;
  Author.prototype = Object.create( AbstractWriter$$1 && AbstractWriter$$1.prototype );
  Author.prototype.constructor = Author;

  Author.prototype.render = function render ($$) {
    var el = $$('div').addClass('sc-author')
    el.append(
      $$(substance.SplitPane, {splitType: 'vertical', sizeB: '400px'}).append(
        this._renderMainSection($$),
        this._renderContextSection($$)
      )
    )
    return el
  };

  Author.prototype._renderContextSection = function _renderContextSection ($$) {
    return $$('div').addClass('se-context-section').append(
      $$(substance.TOC)
    )
  };

  Author.prototype._renderMainSection = function _renderMainSection ($$) {
    var mainSection = $$('div').addClass('se-main-section')
    var splitPane = $$(substance.SplitPane, {splitType: 'horizontal'}).append(
      this._renderToolbar($$),
      this._renderContentPanel($$)
    )
    mainSection.append(splitPane)
    return mainSection
  };

  Author.prototype._renderContentPanel = function _renderContentPanel ($$) {
    var doc = this.documentSession.getDocument()
    var ArticleComponent = this.componentRegistry.get('article')
    var article = doc.get('article')

    var contentPanel = $$(substance.ScrollPane, {
      tocProvider: this.tocProvider,
      scrollbarType: 'substance',
      scrollbarPosition: 'left',
      overlay: substance.ProseEditorOverlayTools,
      highlights: this.contentHighlights
    }).ref('contentPanel')

    var layout = $$(substance.Layout, {
      width: 'large'
    })

    layout.append(
      $$(ArticleComponent, {
        node: article,
        bodyId: 'bodyFlat',
        disabled: this.props.disabled,
        configurator: this.props.configurator
      })
    )

    contentPanel.append(layout)
    return contentPanel
  };

  Author.prototype._scrollTo = function _scrollTo (nodeId) {
    this.refs.contentPanel.scrollTo(nodeId)
  };

  Author.prototype._getExporter = function _getExporter () {
    return this.props.configurator.createExporter('jats')
  };

  Author.prototype._getTOCProvider = function _getTOCProvider () {
    return new AuthorTOCProvider(this.documentSession)
  };

  return Author;
}(AbstractWriter));

var commonjsGlobal = typeof window !== 'undefined' ? window : typeof global !== 'undefined' ? global : typeof self !== 'undefined' ? self : {}

function interopDefault(ex) {
	return ex && typeof ex === 'object' && 'default' in ex ? ex['default'] : ex;
}

function createCommonjsModule(fn, module) {
	return module = { exports: {} }, fn(module, module.exports), module.exports;
}

var last = createCommonjsModule(function (module) {
/**
 * Gets the last element of `array`.
 *
 * @static
 * @memberOf _
 * @since 0.1.0
 * @category Array
 * @param {Array} array The array to query.
 * @returns {*} Returns the last element of `array`.
 * @example
 *
 * _.last([1, 2, 3]);
 * // => 3
 */
function last(array) {
  var length = array ? array.length : 0;
  return length ? array[length - 1] : undefined;
}

module.exports = last;
});

var last$1 = interopDefault(last);

var UnsupportedNodeJATSConverter = {

  type: 'unsupported',

  matchElement: function() {
    return true
  },

  import: function(el, node) {
    node.xmlContent = el.innerHTML
    node.tagName = el.tagName
  },

  export: function(node, el) {
    el.tagName = node.tagName
    el.innerHTML = node.xmlContent
    return el
  }

}

var JATSImporter = (function (XMLImporter$$1) {
  function JATSImporter(config) {
    XMLImporter$$1.call(this, config)
    config.enableInlineWrapper = true
    this.state = new JATSImporter.State()
  }

  if ( XMLImporter$$1 ) JATSImporter.__proto__ = XMLImporter$$1;
  JATSImporter.prototype = Object.create( XMLImporter$$1 && XMLImporter$$1.prototype );
  JATSImporter.prototype.constructor = JATSImporter;

  JATSImporter.prototype.importDocument = function importDocument (xmlString) {
    this.reset()
    var xmlDoc = substance.DefaultDOMElement.parseXML(xmlString, 'fullDoc')
    // HACK: server side impl gives an array
    var articleEl
    if (substance.inBrowser) {
      articleEl = xmlDoc.find('article')
    } else {
      // HACK: this should be more convenient
      for (var idx = 0; idx < xmlDoc.length; idx++) {
        if (xmlDoc[idx].tagName === 'article') {
          articleEl = xmlDoc[idx]
        }
      }
    }
    this.convertDocument(articleEl)
    var doc = this.generateDocument()
    return doc
  };  

  JATSImporter.prototype.convertDocument = function convertDocument (articleElement) {
    this.convertElement(articleElement)
  };

  JATSImporter.prototype.convertElements = function convertElements (elements, startIdx, endIdx) {
    var this$1 = this;

    if (arguments.length < 2) {
      startIdx = 0
    }
    if(arguments.length < 3) {
      endIdx = elements.length
    }
    var nodes = []
    for (var i = startIdx; i < endIdx; i++) {
      nodes.push(this$1.convertElement(elements[i]))
    }
    return nodes
  };

  JATSImporter.prototype._converterCanBeApplied = function _converterCanBeApplied (converter, el) {
    return converter.matchElement(el, this)
  };

  JATSImporter.prototype._getUnsupportedNodeConverter = function _getUnsupportedNodeConverter () {
    return UnsupportedNodeJATSConverter
  };

  JATSImporter.prototype._nodeData = function _nodeData (el, schema) {
    var nodeData = XMLImporter$$1.prototype._nodeData.call(this, el, schema)
    nodeData.attributes = el.getAttributes()
    return nodeData
  };

  return JATSImporter;
}(substance.XMLImporter));

var State = (function (superclass) {
  function State () {
    superclass.apply(this, arguments);
  }

  if ( superclass ) State.__proto__ = superclass;
  State.prototype = Object.create( superclass && superclass.prototype );
  State.prototype.constructor = State;

  State.prototype.reset = function reset () {
    var args = [], len = arguments.length;
    while ( len-- ) args[ len ] = arguments[ len ];

    (ref = superclass.prototype).reset.apply(this, args)
    // stack for list types
    this.lists = []
    this.listItemLevel = 1
    var ref;
  };

  State.prototype.getCurrentListItemLevel = function getCurrentListItemLevel () {
    return this.listItemLevel
  };

  State.prototype.increaseListItemLevel = function increaseListItemLevel () {
    return this.listItemLevel++
  };

  State.prototype.decreaseListItemLevel = function decreaseListItemLevel () {
    return this.listItemLevel--
  };

  State.prototype.getCurrentList = function getCurrentList () {
    return last$1(this.lists)
  };

  return State;
}(substance.DOMImporter.State));

JATSImporter.State = State

/*
  EXPERIMENTAL:

    Import:

    Takes the internal model produced by JATSImporter, transforming
    into a simplified representation:
      - flattening sections into HTML style using headings
      - more?

    Export:

    Takes the simplified internal representation and turns it into the
    model that can be used with JATSExporter.

    Challenge:
      Do not loose any information present in JATS (e.g.)

    Delimitation:
      For the time being we do not consider that the Authoring interface
      is used at the same time with the JATS editing interface.
*/

var JATSTransformer = function JATSTransformer () {};

JATSTransformer.prototype.fromJATS = function fromJATS (doc) {
  var jsonConverter = new substance.JSONConverter()
  var json = doc.toJSON()
  var converted = doc.newInstance()
  jsonConverter.importDocument(converted, json)

  var body = doc.get('body')
  var nodes = body.getNodes()

  var nodeIds = _flattenSections(converted, nodes, [], 1)
  converted.create({
    id: 'bodyFlat',
    type: 'body',
    nodes: nodeIds
  })
  return converted
};

JATSTransformer.prototype.toJATS = function toJATS (doc) {
  var jsonConverter = new substance.JSONConverter()
  var json = doc.toJSON()
  var converted = doc.newInstance()
  jsonConverter.importDocument(converted, json)

  var body = converted.get('bodyFlat')
  var nodeIds = _createSections(converted, body.getNodes())
  if (converted.get('body')) {
    converted.set(['body', 'nodes'], nodeIds)
  } else {
    converted.create({
      id: 'body',
      type: 'body',
      nodes: nodeIds
    })
  }
  return converted
};

var _isSectionBackMatter = {
  "notes": true,
  "fn-group": true,
  "glossary": true,
  "ref-list": true
}

function _flattenSections(doc, nodes, result, level) {
  nodes.forEach(function(node) {
    if (node.type === 'section') {
      var id = 'h_' + node.id;
      var titleId = node.title;
      doc.create({
        id: id,
        type: 'heading',
        sectionId: node.id,
        level: level,
        content: node.getTitle(),
      })
      if (titleId) {
        substance.annotationHelpers.transferAnnotations(doc, [titleId, 'content'], 0, [id, 'content'], 0)
      }
      result.push(id)
      result = _flattenSections(doc, node.getNodes(), result, level+1)
      result = result.concat(node.backMatter)
    } else {
      result.push(node.id)
    }
  })
  return result
}

function _createSections(doc, nodes) {
  var stack = [{
    nodes: [],
    backMatter: []
  }]

  function _createSection(item) {
    var title = doc.create({
      type: 'title',
      content: item.node.getText(),
    })
    substance.annotationHelpers.transferAnnotations(doc, item.node.getTextPath(), 0, title.getTextPath(), 0)
    return doc.create({
      type: 'section',
      title: title.id,
      nodes: item.nodes,
      backMatter: item.backMatter
    })
  }
  var item, sec

  for (var i=0; i < nodes.length; i++) {
    var node = nodes[i]
    if (node.type === 'heading') {
      while (stack.length >= node.level+1) {
        item = stack.pop()
        sec = _createSection(item)
        last$1(stack).nodes.push(sec.id)
      }
      stack.push({
        node: node,
        nodes: [],
        backMatter: []
      })
    } else if (_isSectionBackMatter[node.type]) {
      last$1(stack).backMatter.push(node.id)
    } else {
      last$1(stack).nodes.push(node.id)
    }
  }
  while (stack.length > 1) {
    item = stack.pop()
    sec = _createSection(item)
    last$1(stack).nodes.push(sec.id)
  }
  return stack[0].nodes
}

var AuthorImporter = (function (JATSImporter$$1) {
  function AuthorImporter () {
    JATSImporter$$1.apply(this, arguments);
  }

  if ( JATSImporter$$1 ) AuthorImporter.__proto__ = JATSImporter$$1;
  AuthorImporter.prototype = Object.create( JATSImporter$$1 && JATSImporter$$1.prototype );
  AuthorImporter.prototype.constructor = AuthorImporter;

  AuthorImporter.prototype.importDocument = function importDocument () {
    var args = [], len = arguments.length;
    while ( len-- ) args[ len ] = arguments[ len ];

    var doc = (ref = JATSImporter$$1.prototype).importDocument.apply(this, args)
    var trafo = new JATSTransformer()
    doc = trafo.fromJATS(doc)
    return doc
    var ref;
  };

  return AuthorImporter;
}(JATSImporter));

var isArray = createCommonjsModule(function (module) {
/**
 * Checks if `value` is classified as an `Array` object.
 *
 * @static
 * @memberOf _
 * @since 0.1.0
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is an array, else `false`.
 * @example
 *
 * _.isArray([1, 2, 3]);
 * // => true
 *
 * _.isArray(document.body.children);
 * // => false
 *
 * _.isArray('abc');
 * // => false
 *
 * _.isArray(_.noop);
 * // => false
 */
var isArray = Array.isArray;

module.exports = isArray;
});

var isArray$1 = interopDefault(isArray);


var require$$0 = Object.freeze({
	default: isArray$1
});

var isObjectLike = createCommonjsModule(function (module) {
/**
 * Checks if `value` is object-like. A value is object-like if it's not `null`
 * and has a `typeof` result of "object".
 *
 * @static
 * @memberOf _
 * @since 4.0.0
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is object-like, else `false`.
 * @example
 *
 * _.isObjectLike({});
 * // => true
 *
 * _.isObjectLike([1, 2, 3]);
 * // => true
 *
 * _.isObjectLike(_.noop);
 * // => false
 *
 * _.isObjectLike(null);
 * // => false
 */
function isObjectLike(value) {
  return value != null && typeof value == 'object';
}

module.exports = isObjectLike;
});

var isObjectLike$1 = interopDefault(isObjectLike);


var require$$0$1 = Object.freeze({
	default: isObjectLike$1
});

var isString = createCommonjsModule(function (module) {
var isArray = interopDefault(require$$0),
    isObjectLike = interopDefault(require$$0$1);

/** `Object#toString` result references. */
var stringTag = '[object String]';

/** Used for built-in method references. */
var objectProto = Object.prototype;

/**
 * Used to resolve the
 * [`toStringTag`](http://ecma-international.org/ecma-262/7.0/#sec-object.prototype.tostring)
 * of values.
 */
var objectToString = objectProto.toString;

/**
 * Checks if `value` is classified as a `String` primitive or object.
 *
 * @static
 * @since 0.1.0
 * @memberOf _
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is a string, else `false`.
 * @example
 *
 * _.isString('abc');
 * // => true
 *
 * _.isString(1);
 * // => false
 */
function isString(value) {
  return typeof value == 'string' ||
    (!isArray(value) && isObjectLike(value) && objectToString.call(value) == stringTag);
}

module.exports = isString;
});

var isString$1 = interopDefault(isString);


var require$$2 = Object.freeze({
	default: isString$1
});

var JATSExporter = (function (XMLExporter$$1) {
  function JATSExporter () {
    XMLExporter$$1.apply(this, arguments);
  }

  if ( XMLExporter$$1 ) JATSExporter.__proto__ = XMLExporter$$1;
  JATSExporter.prototype = Object.create( XMLExporter$$1 && XMLExporter$$1.prototype );
  JATSExporter.prototype.constructor = JATSExporter;

  JATSExporter.prototype.exportDocument = function exportDocument (doc) {
    this.state.doc = doc

    var articleEl = this.convertNode(doc.get('article'))
    return articleEl.outerHTML
  };

  JATSExporter.prototype.convertNode = function convertNode (node) {
    var el = XMLExporter$$1.prototype.convertNode.call(this, node)
    if (isString$1(node)) {
      node = this.state.doc.get(node)
    }
    el.attr(node.attributes)
    return el
  };

  JATSExporter.prototype.convertNodes = function convertNodes (nodes) {
    var els = []
    var converter = this
    if (nodes._isArrayIterator) {
      while(nodes.hasNext()) {
        els.push(converter.convertNode(nodes.next()))
      }
    } else {
      nodes.forEach(function(node) {
        els.push(converter.convertNode(node))
      })
    }
    return els
  };

  return JATSExporter;
}(substance.XMLExporter));

var AuthorExporter = (function (JATSExporter$$1) {
  function AuthorExporter () {
    JATSExporter$$1.apply(this, arguments);
  }

  if ( JATSExporter$$1 ) AuthorExporter.__proto__ = JATSExporter$$1;
  AuthorExporter.prototype = Object.create( JATSExporter$$1 && JATSExporter$$1.prototype );
  AuthorExporter.prototype.constructor = AuthorExporter;

  AuthorExporter.prototype.exportDocument = function exportDocument (doc) {
    var trafo = new JATSTransformer()
    doc = trafo.toJATS(doc)
    return JATSExporter$$1.prototype.exportDocument.call(this, doc)
  };

  return AuthorExporter;
}(JATSExporter));

var Aff = (function (DocumentNode$$1) {
  function Aff () {
    DocumentNode$$1.apply(this, arguments);
  }if ( DocumentNode$$1 ) Aff.__proto__ = DocumentNode$$1;
  Aff.prototype = Object.create( DocumentNode$$1 && DocumentNode$$1.prototype );
  Aff.prototype.constructor = Aff;

  

  return Aff;
}(substance.DocumentNode));

Aff.type = 'aff'

/*
  Content
  (
    #PCDATA | addr-line | city | country | fax | institution | institution-wrap | phone |
    postal-code | state | email | ext-link | uri | inline-supplementary-material |
    related-article | related-object | hr | bold | fixed-case | italic | monospace |
    overline | overline-start | overline-end | roman | sans-serif | sc | strike |
    underline | underline-start | underline-end | ruby | alternatives | inline-graphic |
    private-char | chem-struct | inline-formula | tex-math | mml:math | abbrev | milestone-end |
    milestone-start | named-content | styled-content | fn | target | xref | sub | sup | x |
    break | label
  )*
*/
Aff.define({
  attributes: { type: 'object', default: {} },
  xmlContent: { type: 'string', default: ''}
})

/*
  Converts a node into its DOM representation

  @return {substance/ui/DOMElement} A wrapped DOM element
*/
function toDOM(node) {
  var tagName = node.constructor.tagName || node.constructor.type
  var el = substance.DefaultDOMElement.parseXML('<'+tagName+'>'+node.xmlContent+'</'+tagName+'>')
  el.attr(node.attributes)
  return el
}

/*
  Get all affiliations for a doc
*/
function getAffs(doc) {
  var affs = doc.getIndex('type').get('aff')
  // Convert to array and get the view for the node
  affs = Object.keys(affs).map(function (affId) { return getAdapter(affs[affId]); })
  return affs
}

/*
  Turns the xmlContent string into JSON, ready to be
  rendered by the component.
*/
function getAdapter(node) {
  var el = toDOM(node);
  return {
    node: node,
    name: el.textContent
  };
}

var AffComponent = (function (Component$$1) {
  function AffComponent() {
    var args = [], len = arguments.length;
    while ( len-- ) args[ len ] = arguments[ len ];

    Component$$1.apply(this, args)
  }

  if ( Component$$1 ) AffComponent.__proto__ = Component$$1;
  AffComponent.prototype = Object.create( Component$$1 && Component$$1.prototype );
  AffComponent.prototype.constructor = AffComponent;

  AffComponent.prototype.render = function render ($$) {
    var aff = getAdapter(this.props.node)
    var el = $$('div').addClass('sc-aff')
      .append($$(substance.FontAwesomeIcon, {icon: 'fa-building-o'}))
      .append(' '+aff.name)
    return el
  };

  return AffComponent;
}(substance.Component));

var AffConverter = {

  type: 'aff',
  tagName: 'aff',

  import: function(el, node, converter) { // eslint-disable-line
    node.xmlContent = el.innerHTML
  },

  export: function(node, el, converter) { // eslint-disable-line
    el.innerHTML = node.xmlContent
  }
}

var AffPackage = {
  name: 'aff',
  configure: function(config) {
    config.addNode(Aff)
    config.addComponent(Aff.type, AffComponent)
    config.addConverter('jats', AffConverter)
  }
}

var ArticleNode = (function (DocumentNode$$1) {
  function ArticleNode () {
    DocumentNode$$1.apply(this, arguments);
  }if ( DocumentNode$$1 ) ArticleNode.__proto__ = DocumentNode$$1;
  ArticleNode.prototype = Object.create( DocumentNode$$1 && DocumentNode$$1.prototype );
  ArticleNode.prototype.constructor = ArticleNode;

  

  return ArticleNode;
}(substance.DocumentNode));

ArticleNode.type = 'article'

/*
  Attributes
    article-type Type of Article
    dtd-version Version of the Tag Set (DTD)
    id Document Internal Identifier
    specific-use Specific Use
    xml:base Base
    xml:lang Language
    xmlns:ali NISO ALI Namespace (NISO Access License and Indicators)
    xmlns:mml MathML Namespace Declaration
    xmlns:xlink XLink Namespace Declaration
    xmlns:xsi XML Schema Namespace Declaration

  Content Model
    (front, body?, back?, floats-group?, (sub-article* | response*))
*/

ArticleNode.define({
  attributes: { type: 'object', default: {} },
  front: { type: 'id' },
  body: { type: 'id', optional: true },
  back: { type: 'id', optional: true },
  floatsGroup: { type: 'id', optional: true },
  subArticles: { type: ['id'], optional: true },
  responses: { type: ['id'], optional: true }
})

var XMLIterator = function XMLIterator(elements) {
  this.it = new substance.ArrayIterator(elements)
};

XMLIterator.prototype.optional = function optional (tagName, cb) {
  this._one(tagName, true, cb)
};

XMLIterator.prototype.required = function required (tagName, cb) {
  this._one(tagName, false, cb)
};

XMLIterator.prototype._one = function _one (tagName, optional, cb) {
  if (this.it.hasNext()) {
    var el = this.it.next()
    if (el.tagName === tagName) {
      return cb(el)
    } else {
      this.it.back()
    }
  }
  if (!optional) { throw new Error("Expecting element '"+ tagName +"'.") }
};

XMLIterator.prototype._manyOf = function _manyOf (tagNames, cb) {
    var this$1 = this;

  if (isString$1(tagNames)) { tagNames = [tagNames] }
  var count = 0
  tagNames = substance.makeMap(tagNames)
  while(this.it.hasNext()) {
    var el = this$1.it.next()
    if (tagNames[el.tagName]) {
      count++
      cb(el)
    } else {
      this$1.it.back()
      break
    }
  }
  return count
};

XMLIterator.prototype.manyOf = function manyOf (tagNames, cb) {
  return this._manyOf(tagNames, cb)
};

XMLIterator.prototype.oneOrMoreOf = function oneOrMoreOf (tagNames, cb) {
  var count = this._manyOf(tagNames, cb)
  if (count === 0) {
    throw new Error('Expecting at least one element of ' + String(tagNames));
  }
  return count
};

XMLIterator.prototype.hasNext = function hasNext () {
  return this.it.hasNext()
};

var ArticleConverter = {

  type: 'article',
  tagName: 'article',

  /*
    Attributes
      article-type Type of Article
      dtd-version Version of the Tag Set (DTD)
      id Document Internal Identifier
      specific-use Specific Use
      xml:base Base
      xml:lang Language
      xmlns:ali NISO ALI Namespace (NISO Access License and Indicators)
      xmlns:mml MathML Namespace Declaration
      xmlns:xlink XLink Namespace Declaration
      xmlns:xsi XML Schema Namespace Declaration

    Content Model
      front, body?, back?, floats-group?, (sub-article* | response*)
  */

  import: function(el, node, converter) {
    node.id = 'article' // there is only be one article element

    var children = el.getChildren()
    var iterator = new XMLIterator(children)
    iterator.required('front', function(child) {
      node.front = converter.convertElement(child).id
    })
    iterator.optional('body', function(child) {
      node.body = converter.convertElement(child).id
    })
    iterator.optional('back', function(child) {
      node.back = converter.convertElement(child).id
    })
    iterator.optional('floats-group', function(child) {
      node.floatsGroup = converter.convertElement(child).id
    })
    iterator.manyOf('sub-article', function(child) {
      if (!node.subArticles) { node.subArticles = [] }
      node.subArticles.push(converter.convertElement(child).id)
    })
    iterator.manyOf('response', function(child) {
      if (!node.responses) { node.responses = [] }
      node.responses.push(converter.convertElement(child).id)
    })
    if (iterator.hasNext()) {
      throw new Error('Illegal JATS: ' + el.outerHTML)
    }
  },

  export: function(node, el, converter) {
    el.append(converter.convertNode(node.front))
    if (node.body) {
      el.append(converter.convertNode(node.body))
    }
    if (node.back) {
      el.append(converter.convertNode(node.back))
    }
    if (node.floatsGroup) {
      el.append(converter.convertNode(node.floatsGroup))
    }
    if (node.subArticles) {
      el.append(converter.convertNodes(node.subArticles))
    }
    if (node.responses) {
      el.append(converter.convertNodes(node.responses))
    }
  }
}

var TextureArticle = (function (Document$$1) {
  function TextureArticle () {
    Document$$1.apply(this, arguments);
  }

  if ( Document$$1 ) TextureArticle.__proto__ = Document$$1;
  TextureArticle.prototype = Object.create( Document$$1 && Document$$1.prototype );
  TextureArticle.prototype.constructor = TextureArticle;

  TextureArticle.prototype.getRefList = function getRefList () {
    var refLists = this.getIndex('type').get('ref-list')
    var refListId = Object.keys(refLists)[0]
    return refListId ? this.get(refListId) : undefined
  };

  /*
    Get first ContribGroup
  */
  TextureArticle.prototype.getContribGroup = function getContribGroup () {
    var contribGroups = this.getIndex('type').get('contrib-group')
    var contribGroupId = Object.keys(contribGroups)[0]
    return contribGroupId ? this.get(contribGroupId) : undefined
  };

  return TextureArticle;
}(substance.Document));

var isObject = createCommonjsModule(function (module) {
/**
 * Checks if `value` is the
 * [language type](http://www.ecma-international.org/ecma-262/7.0/#sec-ecmascript-language-types)
 * of `Object`. (e.g. arrays, functions, objects, regexes, `new Number(0)`, and `new String('')`)
 *
 * @static
 * @memberOf _
 * @since 0.1.0
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is an object, else `false`.
 * @example
 *
 * _.isObject({});
 * // => true
 *
 * _.isObject([1, 2, 3]);
 * // => true
 *
 * _.isObject(_.noop);
 * // => true
 *
 * _.isObject(null);
 * // => false
 */
function isObject(value) {
  var type = typeof value;
  return value != null && (type == 'object' || type == 'function');
}

module.exports = isObject;
});

var isObject$1 = interopDefault(isObject);


var require$$1$6 = Object.freeze({
	default: isObject$1
});

var isFunction = createCommonjsModule(function (module) {
var isObject = interopDefault(require$$1$6);

/** `Object#toString` result references. */
var funcTag = '[object Function]',
    genTag = '[object GeneratorFunction]',
    proxyTag = '[object Proxy]';

/** Used for built-in method references. */
var objectProto = Object.prototype;

/**
 * Used to resolve the
 * [`toStringTag`](http://ecma-international.org/ecma-262/7.0/#sec-object.prototype.tostring)
 * of values.
 */
var objectToString = objectProto.toString;

/**
 * Checks if `value` is classified as a `Function` object.
 *
 * @static
 * @memberOf _
 * @since 0.1.0
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is a function, else `false`.
 * @example
 *
 * _.isFunction(_);
 * // => true
 *
 * _.isFunction(/abc/);
 * // => false
 */
function isFunction(value) {
  // The use of `Object#toString` avoids issues with the `typeof` operator
  // in Safari 9 which returns 'object' for typed array and other constructors.
  var tag = isObject(value) ? objectToString.call(value) : '';
  return tag == funcTag || tag == genTag || tag == proxyTag;
}

module.exports = isFunction;
});

var isFunction$1 = interopDefault(isFunction);


var require$$1$5 = Object.freeze({
	default: isFunction$1
});

var _freeGlobal = createCommonjsModule(function (module) {
/** Detect free variable `global` from Node.js. */
var freeGlobal = typeof commonjsGlobal == 'object' && commonjsGlobal && commonjsGlobal.Object === Object && commonjsGlobal;

module.exports = freeGlobal;
});

var _freeGlobal$1 = interopDefault(_freeGlobal);


var require$$0$5 = Object.freeze({
	default: _freeGlobal$1
});

var _root = createCommonjsModule(function (module) {
var freeGlobal = interopDefault(require$$0$5);

/** Detect free variable `self`. */
var freeSelf = typeof self == 'object' && self && self.Object === Object && self;

/** Used as a reference to the global object. */
var root = freeGlobal || freeSelf || Function('return this')();

module.exports = root;
});

var _root$1 = interopDefault(_root);


var require$$0$4 = Object.freeze({
	default: _root$1
});

var _coreJsData = createCommonjsModule(function (module) {
var root = interopDefault(require$$0$4);

/** Used to detect overreaching core-js shims. */
var coreJsData = root['__core-js_shared__'];

module.exports = coreJsData;
});

var _coreJsData$1 = interopDefault(_coreJsData);


var require$$0$3 = Object.freeze({
	default: _coreJsData$1
});

var _isMasked = createCommonjsModule(function (module) {
var coreJsData = interopDefault(require$$0$3);

/** Used to detect methods masquerading as native. */
var maskSrcKey = (function() {
  var uid = /[^.]+$/.exec(coreJsData && coreJsData.keys && coreJsData.keys.IE_PROTO || '');
  return uid ? ('Symbol(src)_1.' + uid) : '';
}());

/**
 * Checks if `func` has its source masked.
 *
 * @private
 * @param {Function} func The function to check.
 * @returns {boolean} Returns `true` if `func` is masked, else `false`.
 */
function isMasked(func) {
  return !!maskSrcKey && (maskSrcKey in func);
}

module.exports = isMasked;
});

var _isMasked$1 = interopDefault(_isMasked);


var require$$2$1 = Object.freeze({
	default: _isMasked$1
});

var _toSource = createCommonjsModule(function (module) {
/** Used for built-in method references. */
var funcProto = Function.prototype;

/** Used to resolve the decompiled source of functions. */
var funcToString = funcProto.toString;

/**
 * Converts `func` to its source code.
 *
 * @private
 * @param {Function} func The function to process.
 * @returns {string} Returns the source code.
 */
function toSource(func) {
  if (func != null) {
    try {
      return funcToString.call(func);
    } catch (e) {}
    try {
      return (func + '');
    } catch (e) {}
  }
  return '';
}

module.exports = toSource;
});

var _toSource$1 = interopDefault(_toSource);


var require$$0$6 = Object.freeze({
	default: _toSource$1
});

var _baseIsNative = createCommonjsModule(function (module) {
var isFunction = interopDefault(require$$1$5),
    isMasked = interopDefault(require$$2$1),
    isObject = interopDefault(require$$1$6),
    toSource = interopDefault(require$$0$6);

/**
 * Used to match `RegExp`
 * [syntax characters](http://ecma-international.org/ecma-262/7.0/#sec-patterns).
 */
var reRegExpChar = /[\\^$.*+?()[\]{}|]/g;

/** Used to detect host constructors (Safari). */
var reIsHostCtor = /^\[object .+?Constructor\]$/;

/** Used for built-in method references. */
var funcProto = Function.prototype,
    objectProto = Object.prototype;

/** Used to resolve the decompiled source of functions. */
var funcToString = funcProto.toString;

/** Used to check objects for own properties. */
var hasOwnProperty = objectProto.hasOwnProperty;

/** Used to detect if a method is native. */
var reIsNative = RegExp('^' +
  funcToString.call(hasOwnProperty).replace(reRegExpChar, '\\$&')
  .replace(/hasOwnProperty|(function).*?(?=\\\()| for .+?(?=\\\])/g, '$1.*?') + '$'
);

/**
 * The base implementation of `_.isNative` without bad shim checks.
 *
 * @private
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is a native function,
 *  else `false`.
 */
function baseIsNative(value) {
  if (!isObject(value) || isMasked(value)) {
    return false;
  }
  var pattern = isFunction(value) ? reIsNative : reIsHostCtor;
  return pattern.test(toSource(value));
}

module.exports = baseIsNative;
});

var _baseIsNative$1 = interopDefault(_baseIsNative);


var require$$1$4 = Object.freeze({
	default: _baseIsNative$1
});

var _getValue = createCommonjsModule(function (module) {
/**
 * Gets the value at `key` of `object`.
 *
 * @private
 * @param {Object} [object] The object to query.
 * @param {string} key The key of the property to get.
 * @returns {*} Returns the property value.
 */
function getValue(object, key) {
  return object == null ? undefined : object[key];
}

module.exports = getValue;
});

var _getValue$1 = interopDefault(_getValue);


var require$$0$7 = Object.freeze({
	default: _getValue$1
});

var _getNative = createCommonjsModule(function (module) {
var baseIsNative = interopDefault(require$$1$4),
    getValue = interopDefault(require$$0$7);

/**
 * Gets the native function at `key` of `object`.
 *
 * @private
 * @param {Object} object The object to query.
 * @param {string} key The key of the method to get.
 * @returns {*} Returns the function if it's native, else `undefined`.
 */
function getNative(object, key) {
  var value = getValue(object, key);
  return baseIsNative(value) ? value : undefined;
}

module.exports = getNative;
});

var _getNative$1 = interopDefault(_getNative);


var require$$1$3 = Object.freeze({
	default: _getNative$1
});

var _defineProperty = createCommonjsModule(function (module) {
var getNative = interopDefault(require$$1$3);

var defineProperty = (function() {
  try {
    var func = getNative(Object, 'defineProperty');
    func({}, '', {});
    return func;
  } catch (e) {}
}());

module.exports = defineProperty;
});

var _defineProperty$1 = interopDefault(_defineProperty);


var require$$1$2 = Object.freeze({
	default: _defineProperty$1
});

var _baseAssignValue = createCommonjsModule(function (module) {
var defineProperty = interopDefault(require$$1$2);

/**
 * The base implementation of `assignValue` and `assignMergeValue` without
 * value checks.
 *
 * @private
 * @param {Object} object The object to modify.
 * @param {string} key The key of the property to assign.
 * @param {*} value The value to assign.
 */
function baseAssignValue(object, key, value) {
  if (key == '__proto__' && defineProperty) {
    defineProperty(object, key, {
      'configurable': true,
      'enumerable': true,
      'value': value,
      'writable': true
    });
  } else {
    object[key] = value;
  }
}

module.exports = baseAssignValue;
});

var _baseAssignValue$1 = interopDefault(_baseAssignValue);


var require$$1$1 = Object.freeze({
	default: _baseAssignValue$1
});

var eq = createCommonjsModule(function (module) {
/**
 * Performs a
 * [`SameValueZero`](http://ecma-international.org/ecma-262/7.0/#sec-samevaluezero)
 * comparison between two values to determine if they are equivalent.
 *
 * @static
 * @memberOf _
 * @since 4.0.0
 * @category Lang
 * @param {*} value The value to compare.
 * @param {*} other The other value to compare.
 * @returns {boolean} Returns `true` if the values are equivalent, else `false`.
 * @example
 *
 * var object = { 'a': 1 };
 * var other = { 'a': 1 };
 *
 * _.eq(object, object);
 * // => true
 *
 * _.eq(object, other);
 * // => false
 *
 * _.eq('a', 'a');
 * // => true
 *
 * _.eq('a', Object('a'));
 * // => false
 *
 * _.eq(NaN, NaN);
 * // => true
 */
function eq(value, other) {
  return value === other || (value !== value && other !== other);
}

module.exports = eq;
});

var eq$1 = interopDefault(eq);


var require$$3 = Object.freeze({
	default: eq$1
});

var _assignValue = createCommonjsModule(function (module) {
var baseAssignValue = interopDefault(require$$1$1),
    eq = interopDefault(require$$3);

/** Used for built-in method references. */
var objectProto = Object.prototype;

/** Used to check objects for own properties. */
var hasOwnProperty = objectProto.hasOwnProperty;

/**
 * Assigns `value` to `key` of `object` if the existing value is not equivalent
 * using [`SameValueZero`](http://ecma-international.org/ecma-262/7.0/#sec-samevaluezero)
 * for equality comparisons.
 *
 * @private
 * @param {Object} object The object to modify.
 * @param {string} key The key of the property to assign.
 * @param {*} value The value to assign.
 */
function assignValue(object, key, value) {
  var objValue = object[key];
  if (!(hasOwnProperty.call(object, key) && eq(objValue, value)) ||
      (value === undefined && !(key in object))) {
    baseAssignValue(object, key, value);
  }
}

module.exports = assignValue;
});

var _assignValue$1 = interopDefault(_assignValue);


var require$$13 = Object.freeze({
	default: _assignValue$1
});

var _copyObject = createCommonjsModule(function (module) {
var assignValue = interopDefault(require$$13),
    baseAssignValue = interopDefault(require$$1$1);

/**
 * Copies properties of `source` to `object`.
 *
 * @private
 * @param {Object} source The object to copy properties from.
 * @param {Array} props The property identifiers to copy.
 * @param {Object} [object={}] The object to copy properties to.
 * @param {Function} [customizer] The function to customize copied values.
 * @returns {Object} Returns `object`.
 */
function copyObject(source, props, object, customizer) {
  var isNew = !object;
  object || (object = {});

  var index = -1,
      length = props.length;

  while (++index < length) {
    var key = props[index];

    var newValue = customizer
      ? customizer(object[key], source[key], key, object, source)
      : undefined;

    if (newValue === undefined) {
      newValue = source[key];
    }
    if (isNew) {
      baseAssignValue(object, key, newValue);
    } else {
      assignValue(object, key, newValue);
    }
  }
  return object;
}

module.exports = copyObject;
});

var _copyObject$1 = interopDefault(_copyObject);


var require$$1 = Object.freeze({
	default: _copyObject$1
});

var identity = createCommonjsModule(function (module) {
/**
 * This method returns the first argument it receives.
 *
 * @static
 * @since 0.1.0
 * @memberOf _
 * @category Util
 * @param {*} value Any value.
 * @returns {*} Returns `value`.
 * @example
 *
 * var object = { 'a': 1 };
 *
 * console.log(_.identity(object) === object);
 * // => true
 */
function identity(value) {
  return value;
}

module.exports = identity;
});

var identity$1 = interopDefault(identity);


var require$$0$8 = Object.freeze({
	default: identity$1
});

var _apply = createCommonjsModule(function (module) {
/**
 * A faster alternative to `Function#apply`, this function invokes `func`
 * with the `this` binding of `thisArg` and the arguments of `args`.
 *
 * @private
 * @param {Function} func The function to invoke.
 * @param {*} thisArg The `this` binding of `func`.
 * @param {Array} args The arguments to invoke `func` with.
 * @returns {*} Returns the result of `func`.
 */
function apply(func, thisArg, args) {
  switch (args.length) {
    case 0: return func.call(thisArg);
    case 1: return func.call(thisArg, args[0]);
    case 2: return func.call(thisArg, args[0], args[1]);
    case 3: return func.call(thisArg, args[0], args[1], args[2]);
  }
  return func.apply(thisArg, args);
}

module.exports = apply;
});

var _apply$1 = interopDefault(_apply);


var require$$0$9 = Object.freeze({
	default: _apply$1
});

var _overRest = createCommonjsModule(function (module) {
var apply = interopDefault(require$$0$9);

/* Built-in method references for those with the same name as other `lodash` methods. */
var nativeMax = Math.max;

/**
 * A specialized version of `baseRest` which transforms the rest array.
 *
 * @private
 * @param {Function} func The function to apply a rest parameter to.
 * @param {number} [start=func.length-1] The start position of the rest parameter.
 * @param {Function} transform The rest array transform.
 * @returns {Function} Returns the new function.
 */
function overRest(func, start, transform) {
  start = nativeMax(start === undefined ? (func.length - 1) : start, 0);
  return function() {
    var args = arguments,
        index = -1,
        length = nativeMax(args.length - start, 0),
        array = Array(length);

    while (++index < length) {
      array[index] = args[start + index];
    }
    index = -1;
    var otherArgs = Array(start + 1);
    while (++index < start) {
      otherArgs[index] = args[index];
    }
    otherArgs[start] = transform(array);
    return apply(func, this, otherArgs);
  };
}

module.exports = overRest;
});

var _overRest$1 = interopDefault(_overRest);


var require$$1$9 = Object.freeze({
	default: _overRest$1
});

var constant = createCommonjsModule(function (module) {
/**
 * Creates a function that returns `value`.
 *
 * @static
 * @memberOf _
 * @since 2.4.0
 * @category Util
 * @param {*} value The value to return from the new function.
 * @returns {Function} Returns the new constant function.
 * @example
 *
 * var objects = _.times(2, _.constant({ 'a': 1 }));
 *
 * console.log(objects);
 * // => [{ 'a': 1 }, { 'a': 1 }]
 *
 * console.log(objects[0] === objects[1]);
 * // => true
 */
function constant(value) {
  return function() {
    return value;
  };
}

module.exports = constant;
});

var constant$1 = interopDefault(constant);


var require$$2$2 = Object.freeze({
	default: constant$1
});

var _baseSetToString = createCommonjsModule(function (module) {
var constant = interopDefault(require$$2$2),
    defineProperty = interopDefault(require$$1$2),
    identity = interopDefault(require$$0$8);

/**
 * The base implementation of `setToString` without support for hot loop shorting.
 *
 * @private
 * @param {Function} func The function to modify.
 * @param {Function} string The `toString` result.
 * @returns {Function} Returns `func`.
 */
var baseSetToString = !defineProperty ? identity : function(func, string) {
  return defineProperty(func, 'toString', {
    'configurable': true,
    'enumerable': false,
    'value': constant(string),
    'writable': true
  });
};

module.exports = baseSetToString;
});

var _baseSetToString$1 = interopDefault(_baseSetToString);


var require$$1$10 = Object.freeze({
	default: _baseSetToString$1
});

var _shortOut = createCommonjsModule(function (module) {
/** Used to detect hot functions by number of calls within a span of milliseconds. */
var HOT_COUNT = 500,
    HOT_SPAN = 16;

/* Built-in method references for those with the same name as other `lodash` methods. */
var nativeNow = Date.now;

/**
 * Creates a function that'll short out and invoke `identity` instead
 * of `func` when it's called `HOT_COUNT` or more times in `HOT_SPAN`
 * milliseconds.
 *
 * @private
 * @param {Function} func The function to restrict.
 * @returns {Function} Returns the new shortable function.
 */
function shortOut(func) {
  var count = 0,
      lastCalled = 0;

  return function() {
    var stamp = nativeNow(),
        remaining = HOT_SPAN - (stamp - lastCalled);

    lastCalled = stamp;
    if (remaining > 0) {
      if (++count >= HOT_COUNT) {
        return arguments[0];
      }
    } else {
      count = 0;
    }
    return func.apply(undefined, arguments);
  };
}

module.exports = shortOut;
});

var _shortOut$1 = interopDefault(_shortOut);


var require$$0$11 = Object.freeze({
	default: _shortOut$1
});

var _setToString = createCommonjsModule(function (module) {
var baseSetToString = interopDefault(require$$1$10),
    shortOut = interopDefault(require$$0$11);

/**
 * Sets the `toString` method of `func` to return `string`.
 *
 * @private
 * @param {Function} func The function to modify.
 * @param {Function} string The `toString` result.
 * @returns {Function} Returns `func`.
 */
var setToString = shortOut(baseSetToString);

module.exports = setToString;
});

var _setToString$1 = interopDefault(_setToString);


var require$$0$10 = Object.freeze({
	default: _setToString$1
});

var _baseRest = createCommonjsModule(function (module) {
var identity = interopDefault(require$$0$8),
    overRest = interopDefault(require$$1$9),
    setToString = interopDefault(require$$0$10);

/**
 * The base implementation of `_.rest` which doesn't validate or coerce arguments.
 *
 * @private
 * @param {Function} func The function to apply a rest parameter to.
 * @param {number} [start=func.length-1] The start position of the rest parameter.
 * @returns {Function} Returns the new function.
 */
function baseRest(func, start) {
  return setToString(overRest(func, start, identity), func + '');
}

module.exports = baseRest;
});

var _baseRest$1 = interopDefault(_baseRest);


var require$$1$8 = Object.freeze({
	default: _baseRest$1
});

var isLength = createCommonjsModule(function (module) {
/** Used as references for various `Number` constants. */
var MAX_SAFE_INTEGER = 9007199254740991;

/**
 * Checks if `value` is a valid array-like length.
 *
 * **Note:** This method is loosely based on
 * [`ToLength`](http://ecma-international.org/ecma-262/7.0/#sec-tolength).
 *
 * @static
 * @memberOf _
 * @since 4.0.0
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is a valid length, else `false`.
 * @example
 *
 * _.isLength(3);
 * // => true
 *
 * _.isLength(Number.MIN_VALUE);
 * // => false
 *
 * _.isLength(Infinity);
 * // => false
 *
 * _.isLength('3');
 * // => false
 */
function isLength(value) {
  return typeof value == 'number' &&
    value > -1 && value % 1 == 0 && value <= MAX_SAFE_INTEGER;
}

module.exports = isLength;
});

var isLength$1 = interopDefault(isLength);


var require$$1$11 = Object.freeze({
	default: isLength$1
});

var isArrayLike = createCommonjsModule(function (module) {
var isFunction = interopDefault(require$$1$5),
    isLength = interopDefault(require$$1$11);

/**
 * Checks if `value` is array-like. A value is considered array-like if it's
 * not a function and has a `value.length` that's an integer greater than or
 * equal to `0` and less than or equal to `Number.MAX_SAFE_INTEGER`.
 *
 * @static
 * @memberOf _
 * @since 4.0.0
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is array-like, else `false`.
 * @example
 *
 * _.isArrayLike([1, 2, 3]);
 * // => true
 *
 * _.isArrayLike(document.body.children);
 * // => true
 *
 * _.isArrayLike('abc');
 * // => true
 *
 * _.isArrayLike(_.noop);
 * // => false
 */
function isArrayLike(value) {
  return value != null && isLength(value.length) && !isFunction(value);
}

module.exports = isArrayLike;
});

var isArrayLike$1 = interopDefault(isArrayLike);


var require$$3$1 = Object.freeze({
	default: isArrayLike$1
});

var _isIndex = createCommonjsModule(function (module) {
/** Used as references for various `Number` constants. */
var MAX_SAFE_INTEGER = 9007199254740991;

/** Used to detect unsigned integer values. */
var reIsUint = /^(?:0|[1-9]\d*)$/;

/**
 * Checks if `value` is a valid array-like index.
 *
 * @private
 * @param {*} value The value to check.
 * @param {number} [length=MAX_SAFE_INTEGER] The upper bounds of a valid index.
 * @returns {boolean} Returns `true` if `value` is a valid index, else `false`.
 */
function isIndex(value, length) {
  length = length == null ? MAX_SAFE_INTEGER : length;
  return !!length &&
    (typeof value == 'number' || reIsUint.test(value)) &&
    (value > -1 && value % 1 == 0 && value < length);
}

module.exports = isIndex;
});

var _isIndex$1 = interopDefault(_isIndex);


var require$$3$2 = Object.freeze({
	default: _isIndex$1
});

var _isIterateeCall = createCommonjsModule(function (module) {
var eq = interopDefault(require$$3),
    isArrayLike = interopDefault(require$$3$1),
    isIndex = interopDefault(require$$3$2),
    isObject = interopDefault(require$$1$6);

/**
 * Checks if the given arguments are from an iteratee call.
 *
 * @private
 * @param {*} value The potential iteratee value argument.
 * @param {*} index The potential iteratee index or key argument.
 * @param {*} object The potential iteratee object argument.
 * @returns {boolean} Returns `true` if the arguments are from an iteratee call,
 *  else `false`.
 */
function isIterateeCall(value, index, object) {
  if (!isObject(object)) {
    return false;
  }
  var type = typeof index;
  if (type == 'number'
        ? (isArrayLike(object) && isIndex(index, object.length))
        : (type == 'string' && index in object)
      ) {
    return eq(object[index], value);
  }
  return false;
}

module.exports = isIterateeCall;
});

var _isIterateeCall$1 = interopDefault(_isIterateeCall);


var require$$0$12 = Object.freeze({
	default: _isIterateeCall$1
});

var _createAssigner = createCommonjsModule(function (module) {
var baseRest = interopDefault(require$$1$8),
    isIterateeCall = interopDefault(require$$0$12);

/**
 * Creates a function like `_.assign`.
 *
 * @private
 * @param {Function} assigner The function to assign values.
 * @returns {Function} Returns the new assigner function.
 */
function createAssigner(assigner) {
  return baseRest(function(object, sources) {
    var index = -1,
        length = sources.length,
        customizer = length > 1 ? sources[length - 1] : undefined,
        guard = length > 2 ? sources[2] : undefined;

    customizer = (assigner.length > 3 && typeof customizer == 'function')
      ? (length--, customizer)
      : undefined;

    if (guard && isIterateeCall(sources[0], sources[1], guard)) {
      customizer = length < 3 ? undefined : customizer;
      length = 1;
    }
    object = Object(object);
    while (++index < length) {
      var source = sources[index];
      if (source) {
        assigner(object, source, index, customizer);
      }
    }
    return object;
  });
}

module.exports = createAssigner;
});

var _createAssigner$1 = interopDefault(_createAssigner);


var require$$1$7 = Object.freeze({
	default: _createAssigner$1
});

var _baseTimes = createCommonjsModule(function (module) {
/**
 * The base implementation of `_.times` without support for iteratee shorthands
 * or max array length checks.
 *
 * @private
 * @param {number} n The number of times to invoke `iteratee`.
 * @param {Function} iteratee The function invoked per iteration.
 * @returns {Array} Returns the array of results.
 */
function baseTimes(n, iteratee) {
  var index = -1,
      result = Array(n);

  while (++index < n) {
    result[index] = iteratee(index);
  }
  return result;
}

module.exports = baseTimes;
});

var _baseTimes$1 = interopDefault(_baseTimes);


var require$$5 = Object.freeze({
	default: _baseTimes$1
});

var _baseIsArguments = createCommonjsModule(function (module) {
var isObjectLike = interopDefault(require$$0$1);

/** `Object#toString` result references. */
var argsTag = '[object Arguments]';

/** Used for built-in method references. */
var objectProto = Object.prototype;

/**
 * Used to resolve the
 * [`toStringTag`](http://ecma-international.org/ecma-262/7.0/#sec-object.prototype.tostring)
 * of values.
 */
var objectToString = objectProto.toString;

/**
 * The base implementation of `_.isArguments`.
 *
 * @private
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is an `arguments` object,
 */
function baseIsArguments(value) {
  return isObjectLike(value) && objectToString.call(value) == argsTag;
}

module.exports = baseIsArguments;
});

var _baseIsArguments$1 = interopDefault(_baseIsArguments);


var require$$1$12 = Object.freeze({
	default: _baseIsArguments$1
});

var isArguments = createCommonjsModule(function (module) {
var baseIsArguments = interopDefault(require$$1$12),
    isObjectLike = interopDefault(require$$0$1);

/** Used for built-in method references. */
var objectProto = Object.prototype;

/** Used to check objects for own properties. */
var hasOwnProperty = objectProto.hasOwnProperty;

/** Built-in value references. */
var propertyIsEnumerable = objectProto.propertyIsEnumerable;

/**
 * Checks if `value` is likely an `arguments` object.
 *
 * @static
 * @memberOf _
 * @since 0.1.0
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is an `arguments` object,
 *  else `false`.
 * @example
 *
 * _.isArguments(function() { return arguments; }());
 * // => true
 *
 * _.isArguments([1, 2, 3]);
 * // => false
 */
var isArguments = baseIsArguments(function() { return arguments; }()) ? baseIsArguments : function(value) {
  return isObjectLike(value) && hasOwnProperty.call(value, 'callee') &&
    !propertyIsEnumerable.call(value, 'callee');
};

module.exports = isArguments;
});

var isArguments$1 = interopDefault(isArguments);


var require$$5$1 = Object.freeze({
	default: isArguments$1
});

var stubFalse = createCommonjsModule(function (module) {
/**
 * This method returns `false`.
 *
 * @static
 * @memberOf _
 * @since 4.13.0
 * @category Util
 * @returns {boolean} Returns `false`.
 * @example
 *
 * _.times(2, _.stubFalse);
 * // => [false, false]
 */
function stubFalse() {
  return false;
}

module.exports = stubFalse;
});

var stubFalse$1 = interopDefault(stubFalse);


var require$$0$14 = Object.freeze({
	default: stubFalse$1
});

var isBuffer = createCommonjsModule(function (module, exports) {
var root = interopDefault(require$$0$4),
    stubFalse = interopDefault(require$$0$14);

/** Detect free variable `exports`. */
var freeExports = typeof exports == 'object' && exports && !exports.nodeType && exports;

/** Detect free variable `module`. */
var freeModule = freeExports && typeof module == 'object' && module && !module.nodeType && module;

/** Detect the popular CommonJS extension `module.exports`. */
var moduleExports = freeModule && freeModule.exports === freeExports;

/** Built-in value references. */
var Buffer = moduleExports ? root.Buffer : undefined;

/* Built-in method references for those with the same name as other `lodash` methods. */
var nativeIsBuffer = Buffer ? Buffer.isBuffer : undefined;

/**
 * Checks if `value` is a buffer.
 *
 * @static
 * @memberOf _
 * @since 4.3.0
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is a buffer, else `false`.
 * @example
 *
 * _.isBuffer(new Buffer(2));
 * // => true
 *
 * _.isBuffer(new Uint8Array(2));
 * // => false
 */
var isBuffer = nativeIsBuffer || stubFalse;

module.exports = isBuffer;
});

var isBuffer$1 = interopDefault(isBuffer);


var require$$2$4 = Object.freeze({
	default: isBuffer$1
});

var _baseIsTypedArray = createCommonjsModule(function (module) {
var isLength = interopDefault(require$$1$11),
    isObjectLike = interopDefault(require$$0$1);

/** `Object#toString` result references. */
var argsTag = '[object Arguments]',
    arrayTag = '[object Array]',
    boolTag = '[object Boolean]',
    dateTag = '[object Date]',
    errorTag = '[object Error]',
    funcTag = '[object Function]',
    mapTag = '[object Map]',
    numberTag = '[object Number]',
    objectTag = '[object Object]',
    regexpTag = '[object RegExp]',
    setTag = '[object Set]',
    stringTag = '[object String]',
    weakMapTag = '[object WeakMap]';

var arrayBufferTag = '[object ArrayBuffer]',
    dataViewTag = '[object DataView]',
    float32Tag = '[object Float32Array]',
    float64Tag = '[object Float64Array]',
    int8Tag = '[object Int8Array]',
    int16Tag = '[object Int16Array]',
    int32Tag = '[object Int32Array]',
    uint8Tag = '[object Uint8Array]',
    uint8ClampedTag = '[object Uint8ClampedArray]',
    uint16Tag = '[object Uint16Array]',
    uint32Tag = '[object Uint32Array]';

/** Used to identify `toStringTag` values of typed arrays. */
var typedArrayTags = {};
typedArrayTags[float32Tag] = typedArrayTags[float64Tag] =
typedArrayTags[int8Tag] = typedArrayTags[int16Tag] =
typedArrayTags[int32Tag] = typedArrayTags[uint8Tag] =
typedArrayTags[uint8ClampedTag] = typedArrayTags[uint16Tag] =
typedArrayTags[uint32Tag] = true;
typedArrayTags[argsTag] = typedArrayTags[arrayTag] =
typedArrayTags[arrayBufferTag] = typedArrayTags[boolTag] =
typedArrayTags[dataViewTag] = typedArrayTags[dateTag] =
typedArrayTags[errorTag] = typedArrayTags[funcTag] =
typedArrayTags[mapTag] = typedArrayTags[numberTag] =
typedArrayTags[objectTag] = typedArrayTags[regexpTag] =
typedArrayTags[setTag] = typedArrayTags[stringTag] =
typedArrayTags[weakMapTag] = false;

/** Used for built-in method references. */
var objectProto = Object.prototype;

/**
 * Used to resolve the
 * [`toStringTag`](http://ecma-international.org/ecma-262/7.0/#sec-object.prototype.tostring)
 * of values.
 */
var objectToString = objectProto.toString;

/**
 * The base implementation of `_.isTypedArray` without Node.js optimizations.
 *
 * @private
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is a typed array, else `false`.
 */
function baseIsTypedArray(value) {
  return isObjectLike(value) &&
    isLength(value.length) && !!typedArrayTags[objectToString.call(value)];
}

module.exports = baseIsTypedArray;
});

var _baseIsTypedArray$1 = interopDefault(_baseIsTypedArray);


var require$$2$5 = Object.freeze({
	default: _baseIsTypedArray$1
});

var _baseUnary = createCommonjsModule(function (module) {
/**
 * The base implementation of `_.unary` without support for storing metadata.
 *
 * @private
 * @param {Function} func The function to cap arguments for.
 * @returns {Function} Returns the new capped function.
 */
function baseUnary(func) {
  return function(value) {
    return func(value);
  };
}

module.exports = baseUnary;
});

var _baseUnary$1 = interopDefault(_baseUnary);


var require$$2$6 = Object.freeze({
	default: _baseUnary$1
});

var _nodeUtil = createCommonjsModule(function (module, exports) {
var freeGlobal = interopDefault(require$$0$5);

/** Detect free variable `exports`. */
var freeExports = typeof exports == 'object' && exports && !exports.nodeType && exports;

/** Detect free variable `module`. */
var freeModule = freeExports && typeof module == 'object' && module && !module.nodeType && module;

/** Detect the popular CommonJS extension `module.exports`. */
var moduleExports = freeModule && freeModule.exports === freeExports;

/** Detect free variable `process` from Node.js. */
var freeProcess = moduleExports && freeGlobal.process;

/** Used to access faster Node.js helpers. */
var nodeUtil = (function() {
  try {
    return freeProcess && freeProcess.binding('util');
  } catch (e) {}
}());

module.exports = nodeUtil;
});

var _nodeUtil$1 = interopDefault(_nodeUtil);


var require$$0$16 = Object.freeze({
	default: _nodeUtil$1
});

var isTypedArray = createCommonjsModule(function (module) {
var baseIsTypedArray = interopDefault(require$$2$5),
    baseUnary = interopDefault(require$$2$6),
    nodeUtil = interopDefault(require$$0$16);

/* Node.js helper references. */
var nodeIsTypedArray = nodeUtil && nodeUtil.isTypedArray;

/**
 * Checks if `value` is classified as a typed array.
 *
 * @static
 * @memberOf _
 * @since 3.0.0
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is a typed array, else `false`.
 * @example
 *
 * _.isTypedArray(new Uint8Array);
 * // => true
 *
 * _.isTypedArray([]);
 * // => false
 */
var isTypedArray = nodeIsTypedArray ? baseUnary(nodeIsTypedArray) : baseIsTypedArray;

module.exports = isTypedArray;
});

var isTypedArray$1 = interopDefault(isTypedArray);


var require$$0$15 = Object.freeze({
	default: isTypedArray$1
});

var _arrayLikeKeys = createCommonjsModule(function (module) {
var baseTimes = interopDefault(require$$5),
    isArguments = interopDefault(require$$5$1),
    isArray = interopDefault(require$$0),
    isBuffer = interopDefault(require$$2$4),
    isIndex = interopDefault(require$$3$2),
    isTypedArray = interopDefault(require$$0$15);

/** Used for built-in method references. */
var objectProto = Object.prototype;

/** Used to check objects for own properties. */
var hasOwnProperty = objectProto.hasOwnProperty;

/**
 * Creates an array of the enumerable property names of the array-like `value`.
 *
 * @private
 * @param {*} value The value to query.
 * @param {boolean} inherited Specify returning inherited property names.
 * @returns {Array} Returns the array of property names.
 */
function arrayLikeKeys(value, inherited) {
  var isArr = isArray(value),
      isArg = !isArr && isArguments(value),
      isBuff = !isArr && !isArg && isBuffer(value),
      isType = !isArr && !isArg && !isBuff && isTypedArray(value),
      skipIndexes = isArr || isArg || isBuff || isType,
      result = skipIndexes ? baseTimes(value.length, String) : [],
      length = result.length;

  for (var key in value) {
    if ((inherited || hasOwnProperty.call(value, key)) &&
        !(skipIndexes && (
           // Safari 9 has enumerable `arguments.length` in strict mode.
           key == 'length' ||
           // Node.js 0.10 has enumerable non-index properties on buffers.
           (isBuff && (key == 'offset' || key == 'parent')) ||
           // PhantomJS 2 has enumerable non-index properties on typed arrays.
           (isType && (key == 'buffer' || key == 'byteLength' || key == 'byteOffset')) ||
           // Skip index properties.
           isIndex(key, length)
        ))) {
      result.push(key);
    }
  }
  return result;
}

module.exports = arrayLikeKeys;
});

var _arrayLikeKeys$1 = interopDefault(_arrayLikeKeys);


var require$$2$3 = Object.freeze({
	default: _arrayLikeKeys$1
});

var _isPrototype = createCommonjsModule(function (module) {
/** Used for built-in method references. */
var objectProto = Object.prototype;

/**
 * Checks if `value` is likely a prototype object.
 *
 * @private
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is a prototype, else `false`.
 */
function isPrototype(value) {
  var Ctor = value && value.constructor,
      proto = (typeof Ctor == 'function' && Ctor.prototype) || objectProto;

  return value === proto;
}

module.exports = isPrototype;
});

var _isPrototype$1 = interopDefault(_isPrototype);


var require$$0$17 = Object.freeze({
	default: _isPrototype$1
});

var _nativeKeysIn = createCommonjsModule(function (module) {
/**
 * This function is like
 * [`Object.keys`](http://ecma-international.org/ecma-262/7.0/#sec-object.keys)
 * except that it includes inherited enumerable properties.
 *
 * @private
 * @param {Object} object The object to query.
 * @returns {Array} Returns the array of property names.
 */
function nativeKeysIn(object) {
  var result = [];
  if (object != null) {
    for (var key in Object(object)) {
      result.push(key);
    }
  }
  return result;
}

module.exports = nativeKeysIn;
});

var _nativeKeysIn$1 = interopDefault(_nativeKeysIn);


var require$$0$18 = Object.freeze({
	default: _nativeKeysIn$1
});

var _baseKeysIn = createCommonjsModule(function (module) {
var isObject = interopDefault(require$$1$6),
    isPrototype = interopDefault(require$$0$17),
    nativeKeysIn = interopDefault(require$$0$18);

/** Used for built-in method references. */
var objectProto = Object.prototype;

/** Used to check objects for own properties. */
var hasOwnProperty = objectProto.hasOwnProperty;

/**
 * The base implementation of `_.keysIn` which doesn't treat sparse arrays as dense.
 *
 * @private
 * @param {Object} object The object to query.
 * @returns {Array} Returns the array of property names.
 */
function baseKeysIn(object) {
  if (!isObject(object)) {
    return nativeKeysIn(object);
  }
  var isProto = isPrototype(object),
      result = [];

  for (var key in object) {
    if (!(key == 'constructor' && (isProto || !hasOwnProperty.call(object, key)))) {
      result.push(key);
    }
  }
  return result;
}

module.exports = baseKeysIn;
});

var _baseKeysIn$1 = interopDefault(_baseKeysIn);


var require$$1$13 = Object.freeze({
	default: _baseKeysIn$1
});

var keysIn = createCommonjsModule(function (module) {
var arrayLikeKeys = interopDefault(require$$2$3),
    baseKeysIn = interopDefault(require$$1$13),
    isArrayLike = interopDefault(require$$3$1);

/**
 * Creates an array of the own and inherited enumerable property names of `object`.
 *
 * **Note:** Non-object values are coerced to objects.
 *
 * @static
 * @memberOf _
 * @since 3.0.0
 * @category Object
 * @param {Object} object The object to query.
 * @returns {Array} Returns the array of property names.
 * @example
 *
 * function Foo() {
 *   this.a = 1;
 *   this.b = 2;
 * }
 *
 * Foo.prototype.c = 3;
 *
 * _.keysIn(new Foo);
 * // => ['a', 'b', 'c'] (iteration order is not guaranteed)
 */
function keysIn(object) {
  return isArrayLike(object) ? arrayLikeKeys(object, true) : baseKeysIn(object);
}

module.exports = keysIn;
});

var keysIn$1 = interopDefault(keysIn);


var require$$0$13 = Object.freeze({
	default: keysIn$1
});

var assignIn = createCommonjsModule(function (module) {
var copyObject = interopDefault(require$$1),
    createAssigner = interopDefault(require$$1$7),
    keysIn = interopDefault(require$$0$13);

/**
 * This method is like `_.assign` except that it iterates over own and
 * inherited source properties.
 *
 * **Note:** This method mutates `object`.
 *
 * @static
 * @memberOf _
 * @since 4.0.0
 * @alias extend
 * @category Object
 * @param {Object} object The destination object.
 * @param {...Object} [sources] The source objects.
 * @returns {Object} Returns `object`.
 * @see _.assign
 * @example
 *
 * function Foo() {
 *   this.a = 1;
 * }
 *
 * function Bar() {
 *   this.c = 3;
 * }
 *
 * Foo.prototype.b = 2;
 * Bar.prototype.d = 4;
 *
 * _.assignIn({ 'a': 0 }, new Foo, new Bar);
 * // => { 'a': 1, 'b': 2, 'c': 3, 'd': 4 }
 */
var assignIn = createAssigner(function(object, source) {
  copyObject(source, keysIn(source), object);
});

module.exports = assignIn;
});

var assignIn$1 = interopDefault(assignIn);


var require$$0$2 = Object.freeze({
	default: assignIn$1
});

var extend = createCommonjsModule(function (module) {
module.exports = interopDefault(require$$0$2);
});

var extend$1 = interopDefault(extend);

function renderNodeComponent(self, $$, node, props) {
  props = props || {}
  var componentRegistry = self.props.componentRegistry || self.context.componentRegistry
  var ComponentClass = componentRegistry.get(node.type)
  if (!ComponentClass) {
    console.error('Could not resolve a component for node type ' + node.type)
    ComponentClass = componentRegistry.get('unsupported')
  }
  return $$(ComponentClass, extend$1({
    node: node
  }, props))
}

var ArticleComponent = (function (Component$$1) {
  function ArticleComponent () {
    Component$$1.apply(this, arguments);
  }

  if ( Component$$1 ) ArticleComponent.__proto__ = Component$$1;
  ArticleComponent.prototype = Object.create( Component$$1 && Component$$1.prototype );
  ArticleComponent.prototype.constructor = ArticleComponent;

  ArticleComponent.prototype.render = function render ($$) {
    var node = this.props.node
    var doc = node.getDocument()
    var configurator = this.props.configurator
    var el = $$('div')
      .addClass('sc-article')
      .attr('data-id', this.props.node.id)

    // Render front
    var front = doc.get('front')
    if (front) {
      var frontEl = renderNodeComponent(this, $$, front, {
        disabled: this.props.disabled,
        configurator: configurator
      })
      el.append(frontEl)
    }

    // Render body
    var body = doc.get(this.props.bodyId)
    if (body) {
      var bodyEl = renderNodeComponent(this, $$, body, {
        disabled: this.props.disabled,
        configurator: configurator
      })
      el.append(bodyEl)
    }

    // Render back matter
    var back = doc.get('back')
    if (back) {
      var backEl = renderNodeComponent(this, $$, back, {
        disabled: this.props.disabled,
        configurator: configurator
      });
      el.append(backEl)
    }

    return el
  };

  return ArticleComponent;
}(substance.Component));

var ArticlePackage = {
  name: 'article',
  configure: function(config) {
    config.defineSchema({
      name: 'texture-article',
      ArticleClass: TextureArticle,
      defaultTextType: 'paragraph'
    })
    config.addNode(ArticleNode)
    config.addConverter('jats', ArticleConverter)
    config.addComponent(ArticleNode.type, ArticleComponent)
  }
}

var ArticleMeta = (function (DocumentNode$$1) {
  function ArticleMeta () {
    DocumentNode$$1.apply(this, arguments);
  }if ( DocumentNode$$1 ) ArticleMeta.__proto__ = DocumentNode$$1;
  ArticleMeta.prototype = Object.create( DocumentNode$$1 && DocumentNode$$1.prototype );
  ArticleMeta.prototype.constructor = ArticleMeta;

  

  return ArticleMeta;
}(substance.DocumentNode));

ArticleMeta.type = 'article-meta'

ArticleMeta.define({
  attributes: { type: 'object', default: {} },
  nodes: { type: ['id'], default: [] }
})

// Helpers to define strict converters
// everything here is taken from JATS 1.1 green http://jats.nlm.nih.gov/archiving/tag-library/1.1/

var JATS = {
  ABSTRACT: ['abstract'],
  ACCESS: ['alt-text','long-desc'],
  ADDRESS_LINK: ['email','ext-link','uri'],
  AFF_ALTERNATIVES: ['aff', 'aff-alternatives'],
  APPEARANCE: ['hr'],
  BLOCK_MATH: ['disp-formula', 'disp-formula-group'],
  BLOCK_DISPLAY: ['address','alternatives','array','boxed-text',
    'chem-struct-wrap', 'code','fig','fig-group','graphic','media',
    'preformat','supplementary-material', 'table-wrap','table-wrap-group'],
  BREAK: ['break'],
  CHEM_STRUCT: ['chem-struct-wrap'],
  CITATION: ['citation-alternatives','element-citation','mixed-citation','nlm-citation'],
  CONTRIB_GROUP: ['contrib-group'],
  DISLAY_BACK_MATTER: ['attrib','permissions'],
  EMPHASIS: ['bold','fixed-case','italic','monospace','overline',
    'overline-start','overline-end','roman','sans-serif','sc','strike',
    'underline','underline-start','underline-end','ruby'],
  FUNDING: ['award-id','funding-source','open-access'],
  INLINE_DISPLAY: ['alternatives', 'inline-graphic', 'private-char'],
  INLINE_MATH: ['chem-struct','inline-formula'],
  INTABLE_PARA: ['disp-quote','speech', 'statement','verse-group'],
  JUST_PARA: ['p'],
  JUST_TABLE: ['table-wrap'],
  KWD_GROUP: ['kwd-group'],
  LIST: ['def-list','list'],
  MATH: ['tex-math','mml:math'],
  NOTHING_BUT_PARA: ['p'],
  PHRASE: ['abbrev','milestone-end','milestone-start','named-content','styled-content'],
  RELATED_ARTICLE: ['related-article','related-object'],
  REST_OF_PARA: ['ack','disp-quote','speech','statement','verse-group'],
  SIMPLE_DISPLAY: ['alternatives','array','code','graphic','media','preformat'],
  SIMPLE_LINK: ['fn','target','xref'],
  SUBSUP: ['sub','sup'],
  TITLE_GROUP: ['article-title', 'subtitle', 'trans-title-group', 'alt-title', 'fn-group'],
  X: ['x'],
}

JATS.ARTICLE_LINK = ['inline-supplementary-material'].concat(JATS.RELATED_ARTICLE)
JATS.ALL_PHRASE = JATS.ADDRESS_LINK
  .concat(JATS.ARTICLE_LINK)
  .concat(JATS.APPEARANCE)
  .concat(JATS.EMPHASIS)
  .concat(JATS.INLINE_DISPLAY)
  .concat(JATS.INLINE_MATH)
  .concat(JATS.MATH)
  .concat(JATS.PHRASE)
  .concat(JATS.SIMPLE_LINK)
  .concat(JATS.SUBSUP)
  .concat(JATS.X)
JATS.PARA_LEVEL = JATS.BLOCK_DISPLAY
  .concat(JATS.BLOCK_MATH)
  .concat(JATS.LIST)
  .concat(JATS.MATH)
  .concat(JATS.NOTHING_BUT_PARA)
  .concat(JATS.RELATED_ARTICLE)
  .concat(JATS.REST_OF_PARA)
  .concat(JATS.X)

var ArticleMetaConverter = {

  type: 'article-meta',
  tagName: 'article-meta',

  /*
    Attributes
      id Document Internal Identifier
      xml:base Base
    Content
      (article-id*, article-categories?,
         title-group?,
         (%contrib-group.class; |
          %aff-alternatives.class; | %x.class;)*,
         author-notes?, pub-date*,
         volume*, volume-id*, volume-series?,
         issue*, issue-id*, issue-title*,
         issue-sponsor*, issue-part?,
         volume-issue-group*, isbn*,
         supplement?,
         ( ( (fpage, lpage?)?, page-range?) |
           elocation-id )?,
         (%address-link.class; | product |
          supplementary-material)*,
         history?, permissions?, self-uri*,
         (%related-article.class;)*,
         (%abstract.class;)*, trans-abstract*,
         (%kwd-group.class;)*, funding-group*,
         conference*, counts?, custom-meta-group?)
  */
  import: function(el, node, converter) {
    node.id = 'article-meta'; // there is only one <article-meta> element
    var iterator = new XMLIterator(el.getChildren())
    var elements

    iterator.manyOf(['article-id'], function(child) {
      node.nodes.push(converter.convertElement(child).id)
    })
    iterator.optional('article-categories', function(child) {
      node.nodes.push(converter.convertElement(child).id)
    })
    iterator.optional('title-group', function(child) {
      node.nodes.push(converter.convertElement(child).id)
    })
    // %contrib-group.class; | %aff-alternatives.class; | %x.class;
    elements = JATS.CONTRIB_GROUP
      .concat(JATS.AFF_ALTERNATIVES)
      .concat(JATS.X)
    iterator.manyOf(elements, function(child) {
      node.nodes.push(converter.convertElement(child).id)
    })
    iterator.optional('author-notes', function(child) {
      node.nodes.push(converter.convertElement(child).id)
    })
    // pub-date*, volume*, volume-id*
    iterator.manyOf(['pub-date', 'volume', 'volume-id'], function(child) {
      node.nodes.push(converter.convertElement(child).id)
    })
    iterator.optional('volume-series', function(child) {
      node.nodes.push(converter.convertElement(child).id)
    })
    iterator.manyOf(['issue', 'issue-id', 'issue-title', 'issue-sponsor'], function(child) {
      node.nodes.push(converter.convertElement(child).id)
    })
    iterator.optional('issue-part', function(child) {
      node.nodes.push(converter.convertElement(child).id)
    })
    iterator.manyOf(['volume-issue-group', 'isbn'], function(child) {
      node.nodes.push(converter.convertElement(child).id)
    })
    iterator.optional('supplement', function(child) {
      node.nodes.push(converter.convertElement(child).id)
    })
    // ( ( (fpage, lpage?)?, page-range?) |
    //   elocation-id )?,
    //
    // TODO: XMLIterator can't handle such complex optionals atm
    iterator.manyOf(['fpage', 'lpage', 'page-range', 'elocation-id'], function(child) {
      node.nodes.push(converter.convertElement(child).id)
    })
    // (%address-link.class; | product |
    //  supplementary-material)*,
    elements = JATS.ADDRESS_LINK.concat(['product', 'supplementary-material']);
    iterator.manyOf(elements, function(child) {
      node.nodes.push(converter.convertElement(child).id)
    })
    iterator.optional('history', function(child) {
      node.nodes.push(converter.convertElement(child).id)
    })
    iterator.optional('permissions', function(child) {
      node.nodes.push(converter.convertElement(child).id)
    })
    elements = ['self-uri']
      .concat(JATS.RELATED_ARTICLE)
      .concat(JATS.ABSTRACT)
      .concat(['trans-abstract'])
      .concat(JATS.KWD_GROUP)
      .concat(['funding-group', 'conference'])
    iterator.manyOf(elements, function(child) {
      node.nodes.push(converter.convertElement(child).id)
    })
    iterator.optional('counts', function(child) {
      node.nodes.push(converter.convertElement(child).id)
    })
    iterator.optional('custom-meta-group', function(child) {
      node.nodes.push(converter.convertElement(child).id)
    })
    if (iterator.hasNext()) { throw new Error('Illegal JATS: ' + el.outerHTML) }
  },

  export: function(node, el, converter) {
    el.append(converter.convertNodes(node.nodes))
  }
}

var ArticleMetaComponent = (function (Component$$1) {
  function ArticleMetaComponent () {
    Component$$1.apply(this, arguments);
  }

  if ( Component$$1 ) ArticleMetaComponent.__proto__ = Component$$1;
  ArticleMetaComponent.prototype = Object.create( Component$$1 && Component$$1.prototype );
  ArticleMetaComponent.prototype.constructor = ArticleMetaComponent;

  ArticleMetaComponent.prototype.render = function render ($$) {
    var node = this.props.node
    var doc = node.getDocument()

    var el = $$('div')
      .addClass('sc-article-meta')
      .attr('data-id', this.props.node.id)

    var children = node.nodes
    children.forEach(function(nodeId) {
      var childNode = doc.get(nodeId)
      if (childNode.type !== 'unsupported') {
        el.append(
          renderNodeComponent(this, $$, childNode, {
            disabled: this.props.disabled
          })
        );
      }
    }.bind(this))
    return el
  };

  return ArticleMetaComponent;
}(substance.Component));

var ArticleMetaPackage = {
  name: 'article-meta',
  configure: function(config) {
    config.addNode(ArticleMeta)
    config.addConverter('jats', ArticleMetaConverter)
    config.addComponent(ArticleMeta.type, ArticleMetaComponent)
  }
}

var ArticleTitle = (function (TextNode$$1) {
  function ArticleTitle () {
    TextNode$$1.apply(this, arguments);
  }if ( TextNode$$1 ) ArticleTitle.__proto__ = TextNode$$1;
  ArticleTitle.prototype = Object.create( TextNode$$1 && TextNode$$1.prototype );
  ArticleTitle.prototype.constructor = ArticleTitle;

  

  return ArticleTitle;
}(substance.TextNode));

ArticleTitle.type = 'article-title'

ArticleTitle.define({
  attributes: { type: 'object', default: {} }
})

var TextNodeConverter = {
  import: function(el, node, converter) {
    node.content = converter.annotatedText(el, [node.id, 'content'])
  },
  export: function(node, el, converter) {
    el.append(converter.annotatedText([node.id, 'content']))
  },
  // used by text node converters to reduce code redundancy
  extend: function(converter) {
    return extend$1({}, this, converter)
  }
}

var ArticleTitleConverter = TextNodeConverter.extend({
  type: 'article-title',
  tagName: 'article-title'
})

var TitleComponent = (function (Component$$1) {
  function TitleComponent () {
    Component$$1.apply(this, arguments);
  }

  if ( Component$$1 ) TitleComponent.__proto__ = Component$$1;
  TitleComponent.prototype = Object.create( Component$$1 && Component$$1.prototype );
  TitleComponent.prototype.constructor = TitleComponent;

  TitleComponent.prototype.render = function render ($$) {
    var el = $$('div').addClass('sc-title')
    var node = this.props.node
    var titleEditor = $$(substance.TextPropertyEditor, {
      disabled: this.props.disabled,
      path: node.getTextPath()
    }).ref('titleEditor')
    el.append(titleEditor)
    return el
  };

  return TitleComponent;
}(substance.Component));

var ArticleTitleComponent = (function (TitleComponent$$1) {
  function ArticleTitleComponent () {
    TitleComponent$$1.apply(this, arguments);
  }

  if ( TitleComponent$$1 ) ArticleTitleComponent.__proto__ = TitleComponent$$1;
  ArticleTitleComponent.prototype = Object.create( TitleComponent$$1 && TitleComponent$$1.prototype );
  ArticleTitleComponent.prototype.constructor = ArticleTitleComponent;

  ArticleTitleComponent.prototype.render = function render () {
    var args = [], len = arguments.length;
    while ( len-- ) args[ len ] = arguments[ len ];

    var el = (ref = TitleComponent$$1.prototype).render.apply(this, args)
    el.removeClass('sc-title')
    el.addClass('sc-article-title')
    return el
    var ref;
  };

  return ArticleTitleComponent;
}(TitleComponent));

var ArticleTitlePackage = {
  name: 'article-title',
  configure: function(config) {
    config.addNode(ArticleTitle)
    config.addConverter('jats', ArticleTitleConverter)
    config.addComponent(ArticleTitle.type, ArticleTitleComponent)
    config.addLabel('article-title.content', 'Title')
  }
}

var Contrib = (function (DocumentNode$$1) {
  function Contrib () {
    DocumentNode$$1.apply(this, arguments);
  }if ( DocumentNode$$1 ) Contrib.__proto__ = DocumentNode$$1;
  Contrib.prototype = Object.create( DocumentNode$$1 && DocumentNode$$1.prototype );
  Contrib.prototype.constructor = Contrib;

  

  return Contrib;
}(substance.DocumentNode));

Contrib.type = 'contrib';

/*
  Content
  (
    (
      anonymous | collab | name | name-alternatives | string-name | degrees |
      address | aff | aff-alternatives | author-comment | bio | email | etal | ext-link |
      fn | on-behalf-of | role | uri | xref | x
    )*
  )
*/
Contrib.define({
  attributes: { type: 'object', default: {} },
  xmlContent: { type: 'string', default: ''}
})

var _arrayMap = createCommonjsModule(function (module) {
/**
 * A specialized version of `_.map` for arrays without support for iteratee
 * shorthands.
 *
 * @private
 * @param {Array} [array] The array to iterate over.
 * @param {Function} iteratee The function invoked per iteration.
 * @returns {Array} Returns the new mapped array.
 */
function arrayMap(array, iteratee) {
  var index = -1,
      length = array ? array.length : 0,
      result = Array(length);

  while (++index < length) {
    result[index] = iteratee(array[index], index, array);
  }
  return result;
}

module.exports = arrayMap;
});

var _arrayMap$1 = interopDefault(_arrayMap);


var require$$6 = Object.freeze({
	default: _arrayMap$1
});

var _listCacheClear = createCommonjsModule(function (module) {
/**
 * Removes all key-value entries from the list cache.
 *
 * @private
 * @name clear
 * @memberOf ListCache
 */
function listCacheClear() {
  this.__data__ = [];
  this.size = 0;
}

module.exports = listCacheClear;
});

var _listCacheClear$1 = interopDefault(_listCacheClear);


var require$$4$1 = Object.freeze({
	default: _listCacheClear$1
});

var _assocIndexOf = createCommonjsModule(function (module) {
var eq = interopDefault(require$$3);

/**
 * Gets the index at which the `key` is found in `array` of key-value pairs.
 *
 * @private
 * @param {Array} array The array to inspect.
 * @param {*} key The key to search for.
 * @returns {number} Returns the index of the matched value, else `-1`.
 */
function assocIndexOf(array, key) {
  var length = array.length;
  while (length--) {
    if (eq(array[length][0], key)) {
      return length;
    }
  }
  return -1;
}

module.exports = assocIndexOf;
});

var _assocIndexOf$1 = interopDefault(_assocIndexOf);


var require$$0$19 = Object.freeze({
	default: _assocIndexOf$1
});

var _listCacheDelete = createCommonjsModule(function (module) {
var assocIndexOf = interopDefault(require$$0$19);

/** Used for built-in method references. */
var arrayProto = Array.prototype;

/** Built-in value references. */
var splice = arrayProto.splice;

/**
 * Removes `key` and its value from the list cache.
 *
 * @private
 * @name delete
 * @memberOf ListCache
 * @param {string} key The key of the value to remove.
 * @returns {boolean} Returns `true` if the entry was removed, else `false`.
 */
function listCacheDelete(key) {
  var data = this.__data__,
      index = assocIndexOf(data, key);

  if (index < 0) {
    return false;
  }
  var lastIndex = data.length - 1;
  if (index == lastIndex) {
    data.pop();
  } else {
    splice.call(data, index, 1);
  }
  --this.size;
  return true;
}

module.exports = listCacheDelete;
});

var _listCacheDelete$1 = interopDefault(_listCacheDelete);


var require$$3$3 = Object.freeze({
	default: _listCacheDelete$1
});

var _listCacheGet = createCommonjsModule(function (module) {
var assocIndexOf = interopDefault(require$$0$19);

/**
 * Gets the list cache value for `key`.
 *
 * @private
 * @name get
 * @memberOf ListCache
 * @param {string} key The key of the value to get.
 * @returns {*} Returns the entry value.
 */
function listCacheGet(key) {
  var data = this.__data__,
      index = assocIndexOf(data, key);

  return index < 0 ? undefined : data[index][1];
}

module.exports = listCacheGet;
});

var _listCacheGet$1 = interopDefault(_listCacheGet);


var require$$2$8 = Object.freeze({
	default: _listCacheGet$1
});

var _listCacheHas = createCommonjsModule(function (module) {
var assocIndexOf = interopDefault(require$$0$19);

/**
 * Checks if a list cache value for `key` exists.
 *
 * @private
 * @name has
 * @memberOf ListCache
 * @param {string} key The key of the entry to check.
 * @returns {boolean} Returns `true` if an entry for `key` exists, else `false`.
 */
function listCacheHas(key) {
  return assocIndexOf(this.__data__, key) > -1;
}

module.exports = listCacheHas;
});

var _listCacheHas$1 = interopDefault(_listCacheHas);


var require$$1$15 = Object.freeze({
	default: _listCacheHas$1
});

var _listCacheSet = createCommonjsModule(function (module) {
var assocIndexOf = interopDefault(require$$0$19);

/**
 * Sets the list cache `key` to `value`.
 *
 * @private
 * @name set
 * @memberOf ListCache
 * @param {string} key The key of the value to set.
 * @param {*} value The value to set.
 * @returns {Object} Returns the list cache instance.
 */
function listCacheSet(key, value) {
  var data = this.__data__,
      index = assocIndexOf(data, key);

  if (index < 0) {
    ++this.size;
    data.push([key, value]);
  } else {
    data[index][1] = value;
  }
  return this;
}

module.exports = listCacheSet;
});

var _listCacheSet$1 = interopDefault(_listCacheSet);


var require$$0$20 = Object.freeze({
	default: _listCacheSet$1
});

var _ListCache = createCommonjsModule(function (module) {
var listCacheClear = interopDefault(require$$4$1),
    listCacheDelete = interopDefault(require$$3$3),
    listCacheGet = interopDefault(require$$2$8),
    listCacheHas = interopDefault(require$$1$15),
    listCacheSet = interopDefault(require$$0$20);

/**
 * Creates an list cache object.
 *
 * @private
 * @constructor
 * @param {Array} [entries] The key-value pairs to cache.
 */
function ListCache(entries) {
  var this$1 = this;

  var index = -1,
      length = entries ? entries.length : 0;

  this.clear();
  while (++index < length) {
    var entry = entries[index];
    this$1.set(entry[0], entry[1]);
  }
}

// Add methods to `ListCache`.
ListCache.prototype.clear = listCacheClear;
ListCache.prototype['delete'] = listCacheDelete;
ListCache.prototype.get = listCacheGet;
ListCache.prototype.has = listCacheHas;
ListCache.prototype.set = listCacheSet;

module.exports = ListCache;
});

var _ListCache$1 = interopDefault(_ListCache);


var require$$1$14 = Object.freeze({
	default: _ListCache$1
});

var _stackClear = createCommonjsModule(function (module) {
var ListCache = interopDefault(require$$1$14);

/**
 * Removes all key-value entries from the stack.
 *
 * @private
 * @name clear
 * @memberOf Stack
 */
function stackClear() {
  this.__data__ = new ListCache;
  this.size = 0;
}

module.exports = stackClear;
});

var _stackClear$1 = interopDefault(_stackClear);


var require$$4$2 = Object.freeze({
	default: _stackClear$1
});

var _stackDelete = createCommonjsModule(function (module) {
/**
 * Removes `key` and its value from the stack.
 *
 * @private
 * @name delete
 * @memberOf Stack
 * @param {string} key The key of the value to remove.
 * @returns {boolean} Returns `true` if the entry was removed, else `false`.
 */
function stackDelete(key) {
  var data = this.__data__,
      result = data['delete'](key);

  this.size = data.size;
  return result;
}

module.exports = stackDelete;
});

var _stackDelete$1 = interopDefault(_stackDelete);


var require$$3$4 = Object.freeze({
	default: _stackDelete$1
});

var _stackGet = createCommonjsModule(function (module) {
/**
 * Gets the stack value for `key`.
 *
 * @private
 * @name get
 * @memberOf Stack
 * @param {string} key The key of the value to get.
 * @returns {*} Returns the entry value.
 */
function stackGet(key) {
  return this.__data__.get(key);
}

module.exports = stackGet;
});

var _stackGet$1 = interopDefault(_stackGet);


var require$$2$9 = Object.freeze({
	default: _stackGet$1
});

var _stackHas = createCommonjsModule(function (module) {
/**
 * Checks if a stack value for `key` exists.
 *
 * @private
 * @name has
 * @memberOf Stack
 * @param {string} key The key of the entry to check.
 * @returns {boolean} Returns `true` if an entry for `key` exists, else `false`.
 */
function stackHas(key) {
  return this.__data__.has(key);
}

module.exports = stackHas;
});

var _stackHas$1 = interopDefault(_stackHas);


var require$$1$16 = Object.freeze({
	default: _stackHas$1
});

var _Map = createCommonjsModule(function (module) {
var getNative = interopDefault(require$$1$3),
    root = interopDefault(require$$0$4);

/* Built-in method references that are verified to be native. */
var Map = getNative(root, 'Map');

module.exports = Map;
});

var _Map$1 = interopDefault(_Map);


var require$$5$3 = Object.freeze({
	default: _Map$1
});

var _nativeCreate = createCommonjsModule(function (module) {
var getNative = interopDefault(require$$1$3);

/* Built-in method references that are verified to be native. */
var nativeCreate = getNative(Object, 'create');

module.exports = nativeCreate;
});

var _nativeCreate$1 = interopDefault(_nativeCreate);


var require$$0$23 = Object.freeze({
	default: _nativeCreate$1
});

var _hashClear = createCommonjsModule(function (module) {
var nativeCreate = interopDefault(require$$0$23);

/**
 * Removes all key-value entries from the hash.
 *
 * @private
 * @name clear
 * @memberOf Hash
 */
function hashClear() {
  this.__data__ = nativeCreate ? nativeCreate(null) : {};
  this.size = 0;
}

module.exports = hashClear;
});

var _hashClear$1 = interopDefault(_hashClear);


var require$$4$4 = Object.freeze({
	default: _hashClear$1
});

var _hashDelete = createCommonjsModule(function (module) {
/**
 * Removes `key` and its value from the hash.
 *
 * @private
 * @name delete
 * @memberOf Hash
 * @param {Object} hash The hash to modify.
 * @param {string} key The key of the value to remove.
 * @returns {boolean} Returns `true` if the entry was removed, else `false`.
 */
function hashDelete(key) {
  var result = this.has(key) && delete this.__data__[key];
  this.size -= result ? 1 : 0;
  return result;
}

module.exports = hashDelete;
});

var _hashDelete$1 = interopDefault(_hashDelete);


var require$$3$5 = Object.freeze({
	default: _hashDelete$1
});

var _hashGet = createCommonjsModule(function (module) {
var nativeCreate = interopDefault(require$$0$23);

/** Used to stand-in for `undefined` hash values. */
var HASH_UNDEFINED = '__lodash_hash_undefined__';

/** Used for built-in method references. */
var objectProto = Object.prototype;

/** Used to check objects for own properties. */
var hasOwnProperty = objectProto.hasOwnProperty;

/**
 * Gets the hash value for `key`.
 *
 * @private
 * @name get
 * @memberOf Hash
 * @param {string} key The key of the value to get.
 * @returns {*} Returns the entry value.
 */
function hashGet(key) {
  var data = this.__data__;
  if (nativeCreate) {
    var result = data[key];
    return result === HASH_UNDEFINED ? undefined : result;
  }
  return hasOwnProperty.call(data, key) ? data[key] : undefined;
}

module.exports = hashGet;
});

var _hashGet$1 = interopDefault(_hashGet);


var require$$2$11 = Object.freeze({
	default: _hashGet$1
});

var _hashHas = createCommonjsModule(function (module) {
var nativeCreate = interopDefault(require$$0$23);

/** Used for built-in method references. */
var objectProto = Object.prototype;

/** Used to check objects for own properties. */
var hasOwnProperty = objectProto.hasOwnProperty;

/**
 * Checks if a hash value for `key` exists.
 *
 * @private
 * @name has
 * @memberOf Hash
 * @param {string} key The key of the entry to check.
 * @returns {boolean} Returns `true` if an entry for `key` exists, else `false`.
 */
function hashHas(key) {
  var data = this.__data__;
  return nativeCreate ? data[key] !== undefined : hasOwnProperty.call(data, key);
}

module.exports = hashHas;
});

var _hashHas$1 = interopDefault(_hashHas);


var require$$1$17 = Object.freeze({
	default: _hashHas$1
});

var _hashSet = createCommonjsModule(function (module) {
var nativeCreate = interopDefault(require$$0$23);

/** Used to stand-in for `undefined` hash values. */
var HASH_UNDEFINED = '__lodash_hash_undefined__';

/**
 * Sets the hash `key` to `value`.
 *
 * @private
 * @name set
 * @memberOf Hash
 * @param {string} key The key of the value to set.
 * @param {*} value The value to set.
 * @returns {Object} Returns the hash instance.
 */
function hashSet(key, value) {
  var data = this.__data__;
  this.size += this.has(key) ? 0 : 1;
  data[key] = (nativeCreate && value === undefined) ? HASH_UNDEFINED : value;
  return this;
}

module.exports = hashSet;
});

var _hashSet$1 = interopDefault(_hashSet);


var require$$0$24 = Object.freeze({
	default: _hashSet$1
});

var _Hash = createCommonjsModule(function (module) {
var hashClear = interopDefault(require$$4$4),
    hashDelete = interopDefault(require$$3$5),
    hashGet = interopDefault(require$$2$11),
    hashHas = interopDefault(require$$1$17),
    hashSet = interopDefault(require$$0$24);

/**
 * Creates a hash object.
 *
 * @private
 * @constructor
 * @param {Array} [entries] The key-value pairs to cache.
 */
function Hash(entries) {
  var this$1 = this;

  var index = -1,
      length = entries ? entries.length : 0;

  this.clear();
  while (++index < length) {
    var entry = entries[index];
    this$1.set(entry[0], entry[1]);
  }
}

// Add methods to `Hash`.
Hash.prototype.clear = hashClear;
Hash.prototype['delete'] = hashDelete;
Hash.prototype.get = hashGet;
Hash.prototype.has = hashHas;
Hash.prototype.set = hashSet;

module.exports = Hash;
});

var _Hash$1 = interopDefault(_Hash);


var require$$2$10 = Object.freeze({
	default: _Hash$1
});

var _mapCacheClear = createCommonjsModule(function (module) {
var Hash = interopDefault(require$$2$10),
    ListCache = interopDefault(require$$1$14),
    Map = interopDefault(require$$5$3);

/**
 * Removes all key-value entries from the map.
 *
 * @private
 * @name clear
 * @memberOf MapCache
 */
function mapCacheClear() {
  this.size = 0;
  this.__data__ = {
    'hash': new Hash,
    'map': new (Map || ListCache),
    'string': new Hash
  };
}

module.exports = mapCacheClear;
});

var _mapCacheClear$1 = interopDefault(_mapCacheClear);


var require$$4$3 = Object.freeze({
	default: _mapCacheClear$1
});

var _isKeyable = createCommonjsModule(function (module) {
/**
 * Checks if `value` is suitable for use as unique object key.
 *
 * @private
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is suitable, else `false`.
 */
function isKeyable(value) {
  var type = typeof value;
  return (type == 'string' || type == 'number' || type == 'symbol' || type == 'boolean')
    ? (value !== '__proto__')
    : (value === null);
}

module.exports = isKeyable;
});

var _isKeyable$1 = interopDefault(_isKeyable);


var require$$0$26 = Object.freeze({
	default: _isKeyable$1
});

var _getMapData = createCommonjsModule(function (module) {
var isKeyable = interopDefault(require$$0$26);

/**
 * Gets the data for `map`.
 *
 * @private
 * @param {Object} map The map to query.
 * @param {string} key The reference key.
 * @returns {*} Returns the map data.
 */
function getMapData(map, key) {
  var data = map.__data__;
  return isKeyable(key)
    ? data[typeof key == 'string' ? 'string' : 'hash']
    : data.map;
}

module.exports = getMapData;
});

var _getMapData$1 = interopDefault(_getMapData);


var require$$0$25 = Object.freeze({
	default: _getMapData$1
});

var _mapCacheDelete = createCommonjsModule(function (module) {
var getMapData = interopDefault(require$$0$25);

/**
 * Removes `key` and its value from the map.
 *
 * @private
 * @name delete
 * @memberOf MapCache
 * @param {string} key The key of the value to remove.
 * @returns {boolean} Returns `true` if the entry was removed, else `false`.
 */
function mapCacheDelete(key) {
  var result = getMapData(this, key)['delete'](key);
  this.size -= result ? 1 : 0;
  return result;
}

module.exports = mapCacheDelete;
});

var _mapCacheDelete$1 = interopDefault(_mapCacheDelete);


var require$$3$6 = Object.freeze({
	default: _mapCacheDelete$1
});

var _mapCacheGet = createCommonjsModule(function (module) {
var getMapData = interopDefault(require$$0$25);

/**
 * Gets the map value for `key`.
 *
 * @private
 * @name get
 * @memberOf MapCache
 * @param {string} key The key of the value to get.
 * @returns {*} Returns the entry value.
 */
function mapCacheGet(key) {
  return getMapData(this, key).get(key);
}

module.exports = mapCacheGet;
});

var _mapCacheGet$1 = interopDefault(_mapCacheGet);


var require$$2$12 = Object.freeze({
	default: _mapCacheGet$1
});

var _mapCacheHas = createCommonjsModule(function (module) {
var getMapData = interopDefault(require$$0$25);

/**
 * Checks if a map value for `key` exists.
 *
 * @private
 * @name has
 * @memberOf MapCache
 * @param {string} key The key of the entry to check.
 * @returns {boolean} Returns `true` if an entry for `key` exists, else `false`.
 */
function mapCacheHas(key) {
  return getMapData(this, key).has(key);
}

module.exports = mapCacheHas;
});

var _mapCacheHas$1 = interopDefault(_mapCacheHas);


var require$$1$18 = Object.freeze({
	default: _mapCacheHas$1
});

var _mapCacheSet = createCommonjsModule(function (module) {
var getMapData = interopDefault(require$$0$25);

/**
 * Sets the map `key` to `value`.
 *
 * @private
 * @name set
 * @memberOf MapCache
 * @param {string} key The key of the value to set.
 * @param {*} value The value to set.
 * @returns {Object} Returns the map cache instance.
 */
function mapCacheSet(key, value) {
  var data = getMapData(this, key),
      size = data.size;

  data.set(key, value);
  this.size += data.size == size ? 0 : 1;
  return this;
}

module.exports = mapCacheSet;
});

var _mapCacheSet$1 = interopDefault(_mapCacheSet);


var require$$0$27 = Object.freeze({
	default: _mapCacheSet$1
});

var _MapCache = createCommonjsModule(function (module) {
var mapCacheClear = interopDefault(require$$4$3),
    mapCacheDelete = interopDefault(require$$3$6),
    mapCacheGet = interopDefault(require$$2$12),
    mapCacheHas = interopDefault(require$$1$18),
    mapCacheSet = interopDefault(require$$0$27);

/**
 * Creates a map cache object to store key-value pairs.
 *
 * @private
 * @constructor
 * @param {Array} [entries] The key-value pairs to cache.
 */
function MapCache(entries) {
  var this$1 = this;

  var index = -1,
      length = entries ? entries.length : 0;

  this.clear();
  while (++index < length) {
    var entry = entries[index];
    this$1.set(entry[0], entry[1]);
  }
}

// Add methods to `MapCache`.
MapCache.prototype.clear = mapCacheClear;
MapCache.prototype['delete'] = mapCacheDelete;
MapCache.prototype.get = mapCacheGet;
MapCache.prototype.has = mapCacheHas;
MapCache.prototype.set = mapCacheSet;

module.exports = MapCache;
});

var _MapCache$1 = interopDefault(_MapCache);


var require$$0$22 = Object.freeze({
	default: _MapCache$1
});

var _stackSet = createCommonjsModule(function (module) {
var ListCache = interopDefault(require$$1$14),
    Map = interopDefault(require$$5$3),
    MapCache = interopDefault(require$$0$22);

/** Used as the size to enable large array optimizations. */
var LARGE_ARRAY_SIZE = 200;

/**
 * Sets the stack `key` to `value`.
 *
 * @private
 * @name set
 * @memberOf Stack
 * @param {string} key The key of the value to set.
 * @param {*} value The value to set.
 * @returns {Object} Returns the stack cache instance.
 */
function stackSet(key, value) {
  var data = this.__data__;
  if (data instanceof ListCache) {
    var pairs = data.__data__;
    if (!Map || (pairs.length < LARGE_ARRAY_SIZE - 1)) {
      pairs.push([key, value]);
      this.size = ++data.size;
      return this;
    }
    data = this.__data__ = new MapCache(pairs);
  }
  data.set(key, value);
  this.size = data.size;
  return this;
}

module.exports = stackSet;
});

var _stackSet$1 = interopDefault(_stackSet);


var require$$0$21 = Object.freeze({
	default: _stackSet$1
});

var _Stack = createCommonjsModule(function (module) {
var ListCache = interopDefault(require$$1$14),
    stackClear = interopDefault(require$$4$2),
    stackDelete = interopDefault(require$$3$4),
    stackGet = interopDefault(require$$2$9),
    stackHas = interopDefault(require$$1$16),
    stackSet = interopDefault(require$$0$21);

/**
 * Creates a stack cache object to store key-value pairs.
 *
 * @private
 * @constructor
 * @param {Array} [entries] The key-value pairs to cache.
 */
function Stack(entries) {
  var data = this.__data__ = new ListCache(entries);
  this.size = data.size;
}

// Add methods to `Stack`.
Stack.prototype.clear = stackClear;
Stack.prototype['delete'] = stackDelete;
Stack.prototype.get = stackGet;
Stack.prototype.has = stackHas;
Stack.prototype.set = stackSet;

module.exports = Stack;
});

var _Stack$1 = interopDefault(_Stack);


var require$$15 = Object.freeze({
	default: _Stack$1
});

var _setCacheAdd = createCommonjsModule(function (module) {
/** Used to stand-in for `undefined` hash values. */
var HASH_UNDEFINED = '__lodash_hash_undefined__';

/**
 * Adds `value` to the array cache.
 *
 * @private
 * @name add
 * @memberOf SetCache
 * @alias push
 * @param {*} value The value to cache.
 * @returns {Object} Returns the cache instance.
 */
function setCacheAdd(value) {
  this.__data__.set(value, HASH_UNDEFINED);
  return this;
}

module.exports = setCacheAdd;
});

var _setCacheAdd$1 = interopDefault(_setCacheAdd);


var require$$1$19 = Object.freeze({
	default: _setCacheAdd$1
});

var _setCacheHas = createCommonjsModule(function (module) {
/**
 * Checks if `value` is in the array cache.
 *
 * @private
 * @name has
 * @memberOf SetCache
 * @param {*} value The value to search for.
 * @returns {number} Returns `true` if `value` is found, else `false`.
 */
function setCacheHas(value) {
  return this.__data__.has(value);
}

module.exports = setCacheHas;
});

var _setCacheHas$1 = interopDefault(_setCacheHas);


var require$$0$28 = Object.freeze({
	default: _setCacheHas$1
});

var _SetCache = createCommonjsModule(function (module) {
var MapCache = interopDefault(require$$0$22),
    setCacheAdd = interopDefault(require$$1$19),
    setCacheHas = interopDefault(require$$0$28);

/**
 *
 * Creates an array cache object to store unique values.
 *
 * @private
 * @constructor
 * @param {Array} [values] The values to cache.
 */
function SetCache(values) {
  var this$1 = this;

  var index = -1,
      length = values ? values.length : 0;

  this.__data__ = new MapCache;
  while (++index < length) {
    this$1.add(values[index]);
  }
}

// Add methods to `SetCache`.
SetCache.prototype.add = SetCache.prototype.push = setCacheAdd;
SetCache.prototype.has = setCacheHas;

module.exports = SetCache;
});

var _SetCache$1 = interopDefault(_SetCache);


var require$$5$4 = Object.freeze({
	default: _SetCache$1
});

var _arraySome = createCommonjsModule(function (module) {
/**
 * A specialized version of `_.some` for arrays without support for iteratee
 * shorthands.
 *
 * @private
 * @param {Array} [array] The array to iterate over.
 * @param {Function} predicate The function invoked per iteration.
 * @returns {boolean} Returns `true` if any element passes the predicate check,
 *  else `false`.
 */
function arraySome(array, predicate) {
  var index = -1,
      length = array ? array.length : 0;

  while (++index < length) {
    if (predicate(array[index], index, array)) {
      return true;
    }
  }
  return false;
}

module.exports = arraySome;
});

var _arraySome$1 = interopDefault(_arraySome);


var require$$1$20 = Object.freeze({
	default: _arraySome$1
});

var _cacheHas = createCommonjsModule(function (module) {
/**
 * Checks if a `cache` value for `key` exists.
 *
 * @private
 * @param {Object} cache The cache to query.
 * @param {string} key The key of the entry to check.
 * @returns {boolean} Returns `true` if an entry for `key` exists, else `false`.
 */
function cacheHas(cache, key) {
  return cache.has(key);
}

module.exports = cacheHas;
});

var _cacheHas$1 = interopDefault(_cacheHas);


var require$$0$29 = Object.freeze({
	default: _cacheHas$1
});

var _equalArrays = createCommonjsModule(function (module) {
var SetCache = interopDefault(require$$5$4),
    arraySome = interopDefault(require$$1$20),
    cacheHas = interopDefault(require$$0$29);

/** Used to compose bitmasks for comparison styles. */
var UNORDERED_COMPARE_FLAG = 1,
    PARTIAL_COMPARE_FLAG = 2;

/**
 * A specialized version of `baseIsEqualDeep` for arrays with support for
 * partial deep comparisons.
 *
 * @private
 * @param {Array} array The array to compare.
 * @param {Array} other The other array to compare.
 * @param {Function} equalFunc The function to determine equivalents of values.
 * @param {Function} customizer The function to customize comparisons.
 * @param {number} bitmask The bitmask of comparison flags. See `baseIsEqual`
 *  for more details.
 * @param {Object} stack Tracks traversed `array` and `other` objects.
 * @returns {boolean} Returns `true` if the arrays are equivalent, else `false`.
 */
function equalArrays(array, other, equalFunc, customizer, bitmask, stack) {
  var isPartial = bitmask & PARTIAL_COMPARE_FLAG,
      arrLength = array.length,
      othLength = other.length;

  if (arrLength != othLength && !(isPartial && othLength > arrLength)) {
    return false;
  }
  // Assume cyclic values are equal.
  var stacked = stack.get(array);
  if (stacked && stack.get(other)) {
    return stacked == other;
  }
  var index = -1,
      result = true,
      seen = (bitmask & UNORDERED_COMPARE_FLAG) ? new SetCache : undefined;

  stack.set(array, other);
  stack.set(other, array);

  // Ignore non-index properties.
  while (++index < arrLength) {
    var arrValue = array[index],
        othValue = other[index];

    if (customizer) {
      var compared = isPartial
        ? customizer(othValue, arrValue, index, other, array, stack)
        : customizer(arrValue, othValue, index, array, other, stack);
    }
    if (compared !== undefined) {
      if (compared) {
        continue;
      }
      result = false;
      break;
    }
    // Recursively compare arrays (susceptible to call stack limits).
    if (seen) {
      if (!arraySome(other, function(othValue, othIndex) {
            if (!cacheHas(seen, othIndex) &&
                (arrValue === othValue || equalFunc(arrValue, othValue, customizer, bitmask, stack))) {
              return seen.push(othIndex);
            }
          })) {
        result = false;
        break;
      }
    } else if (!(
          arrValue === othValue ||
            equalFunc(arrValue, othValue, customizer, bitmask, stack)
        )) {
      result = false;
      break;
    }
  }
  stack['delete'](array);
  stack['delete'](other);
  return result;
}

module.exports = equalArrays;
});

var _equalArrays$1 = interopDefault(_equalArrays);


var require$$2$14 = Object.freeze({
	default: _equalArrays$1
});

var _Symbol = createCommonjsModule(function (module) {
var root = interopDefault(require$$0$4);

/** Built-in value references. */
var Symbol = root.Symbol;

module.exports = Symbol;
});

var _Symbol$1 = interopDefault(_Symbol);


var require$$0$30 = Object.freeze({
	default: _Symbol$1
});

var _Uint8Array = createCommonjsModule(function (module) {
var root = interopDefault(require$$0$4);

/** Built-in value references. */
var Uint8Array = root.Uint8Array;

module.exports = Uint8Array;
});

var _Uint8Array$1 = interopDefault(_Uint8Array);


var require$$0$31 = Object.freeze({
	default: _Uint8Array$1
});

var _mapToArray = createCommonjsModule(function (module) {
/**
 * Converts `map` to its key-value pairs.
 *
 * @private
 * @param {Object} map The map to convert.
 * @returns {Array} Returns the key-value pairs.
 */
function mapToArray(map) {
  var index = -1,
      result = Array(map.size);

  map.forEach(function(value, key) {
    result[++index] = [key, value];
  });
  return result;
}

module.exports = mapToArray;
});

var _mapToArray$1 = interopDefault(_mapToArray);


var require$$0$32 = Object.freeze({
	default: _mapToArray$1
});

var _setToArray = createCommonjsModule(function (module) {
/**
 * Converts `set` to an array of its values.
 *
 * @private
 * @param {Object} set The set to convert.
 * @returns {Array} Returns the values.
 */
function setToArray(set) {
  var index = -1,
      result = Array(set.size);

  set.forEach(function(value) {
    result[++index] = value;
  });
  return result;
}

module.exports = setToArray;
});

var _setToArray$1 = interopDefault(_setToArray);


var require$$0$33 = Object.freeze({
	default: _setToArray$1
});

var _equalByTag = createCommonjsModule(function (module) {
var Symbol = interopDefault(require$$0$30),
    Uint8Array = interopDefault(require$$0$31),
    eq = interopDefault(require$$3),
    equalArrays = interopDefault(require$$2$14),
    mapToArray = interopDefault(require$$0$32),
    setToArray = interopDefault(require$$0$33);

/** Used to compose bitmasks for comparison styles. */
var UNORDERED_COMPARE_FLAG = 1,
    PARTIAL_COMPARE_FLAG = 2;

/** `Object#toString` result references. */
var boolTag = '[object Boolean]',
    dateTag = '[object Date]',
    errorTag = '[object Error]',
    mapTag = '[object Map]',
    numberTag = '[object Number]',
    regexpTag = '[object RegExp]',
    setTag = '[object Set]',
    stringTag = '[object String]',
    symbolTag = '[object Symbol]';

var arrayBufferTag = '[object ArrayBuffer]',
    dataViewTag = '[object DataView]';

/** Used to convert symbols to primitives and strings. */
var symbolProto = Symbol ? Symbol.prototype : undefined,
    symbolValueOf = symbolProto ? symbolProto.valueOf : undefined;

/**
 * A specialized version of `baseIsEqualDeep` for comparing objects of
 * the same `toStringTag`.
 *
 * **Note:** This function only supports comparing values with tags of
 * `Boolean`, `Date`, `Error`, `Number`, `RegExp`, or `String`.
 *
 * @private
 * @param {Object} object The object to compare.
 * @param {Object} other The other object to compare.
 * @param {string} tag The `toStringTag` of the objects to compare.
 * @param {Function} equalFunc The function to determine equivalents of values.
 * @param {Function} customizer The function to customize comparisons.
 * @param {number} bitmask The bitmask of comparison flags. See `baseIsEqual`
 *  for more details.
 * @param {Object} stack Tracks traversed `object` and `other` objects.
 * @returns {boolean} Returns `true` if the objects are equivalent, else `false`.
 */
function equalByTag(object, other, tag, equalFunc, customizer, bitmask, stack) {
  switch (tag) {
    case dataViewTag:
      if ((object.byteLength != other.byteLength) ||
          (object.byteOffset != other.byteOffset)) {
        return false;
      }
      object = object.buffer;
      other = other.buffer;

    case arrayBufferTag:
      if ((object.byteLength != other.byteLength) ||
          !equalFunc(new Uint8Array(object), new Uint8Array(other))) {
        return false;
      }
      return true;

    case boolTag:
    case dateTag:
    case numberTag:
      // Coerce booleans to `1` or `0` and dates to milliseconds.
      // Invalid dates are coerced to `NaN`.
      return eq(+object, +other);

    case errorTag:
      return object.name == other.name && object.message == other.message;

    case regexpTag:
    case stringTag:
      // Coerce regexes to strings and treat strings, primitives and objects,
      // as equal. See http://www.ecma-international.org/ecma-262/7.0/#sec-regexp.prototype.tostring
      // for more details.
      return object == (other + '');

    case mapTag:
      var convert = mapToArray;

    case setTag:
      var isPartial = bitmask & PARTIAL_COMPARE_FLAG;
      convert || (convert = setToArray);

      if (object.size != other.size && !isPartial) {
        return false;
      }
      // Assume cyclic values are equal.
      var stacked = stack.get(object);
      if (stacked) {
        return stacked == other;
      }
      bitmask |= UNORDERED_COMPARE_FLAG;

      // Recursively compare objects (susceptible to call stack limits).
      stack.set(object, other);
      var result = equalArrays(convert(object), convert(other), equalFunc, customizer, bitmask, stack);
      stack['delete'](object);
      return result;

    case symbolTag:
      if (symbolValueOf) {
        return symbolValueOf.call(object) == symbolValueOf.call(other);
      }
  }
  return false;
}

module.exports = equalByTag;
});

var _equalByTag$1 = interopDefault(_equalByTag);


var require$$5$5 = Object.freeze({
	default: _equalByTag$1
});

var _overArg = createCommonjsModule(function (module) {
/**
 * Creates a unary function that invokes `func` with its argument transformed.
 *
 * @private
 * @param {Function} func The function to wrap.
 * @param {Function} transform The argument transform.
 * @returns {Function} Returns the new function.
 */
function overArg(func, transform) {
  return function(arg) {
    return func(transform(arg));
  };
}

module.exports = overArg;
});

var _overArg$1 = interopDefault(_overArg);


var require$$0$36 = Object.freeze({
	default: _overArg$1
});

var _nativeKeys = createCommonjsModule(function (module) {
var overArg = interopDefault(require$$0$36);

/* Built-in method references for those with the same name as other `lodash` methods. */
var nativeKeys = overArg(Object.keys, Object);

module.exports = nativeKeys;
});

var _nativeKeys$1 = interopDefault(_nativeKeys);


var require$$0$35 = Object.freeze({
	default: _nativeKeys$1
});

var _baseKeys = createCommonjsModule(function (module) {
var isPrototype = interopDefault(require$$0$17),
    nativeKeys = interopDefault(require$$0$35);

/** Used for built-in method references. */
var objectProto = Object.prototype;

/** Used to check objects for own properties. */
var hasOwnProperty = objectProto.hasOwnProperty;

/**
 * The base implementation of `_.keys` which doesn't treat sparse arrays as dense.
 *
 * @private
 * @param {Object} object The object to query.
 * @returns {Array} Returns the array of property names.
 */
function baseKeys(object) {
  if (!isPrototype(object)) {
    return nativeKeys(object);
  }
  var result = [];
  for (var key in Object(object)) {
    if (hasOwnProperty.call(object, key) && key != 'constructor') {
      result.push(key);
    }
  }
  return result;
}

module.exports = baseKeys;
});

var _baseKeys$1 = interopDefault(_baseKeys);


var require$$1$21 = Object.freeze({
	default: _baseKeys$1
});

var keys = createCommonjsModule(function (module) {
var arrayLikeKeys = interopDefault(require$$2$3),
    baseKeys = interopDefault(require$$1$21),
    isArrayLike = interopDefault(require$$3$1);

/**
 * Creates an array of the own enumerable property names of `object`.
 *
 * **Note:** Non-object values are coerced to objects. See the
 * [ES spec](http://ecma-international.org/ecma-262/7.0/#sec-object.keys)
 * for more details.
 *
 * @static
 * @since 0.1.0
 * @memberOf _
 * @category Object
 * @param {Object} object The object to query.
 * @returns {Array} Returns the array of property names.
 * @example
 *
 * function Foo() {
 *   this.a = 1;
 *   this.b = 2;
 * }
 *
 * Foo.prototype.c = 3;
 *
 * _.keys(new Foo);
 * // => ['a', 'b'] (iteration order is not guaranteed)
 *
 * _.keys('hi');
 * // => ['0', '1']
 */
function keys(object) {
  return isArrayLike(object) ? arrayLikeKeys(object) : baseKeys(object);
}

module.exports = keys;
});

var keys$1 = interopDefault(keys);


var require$$0$34 = Object.freeze({
	default: keys$1
});

var _equalObjects = createCommonjsModule(function (module) {
var keys = interopDefault(require$$0$34);

/** Used to compose bitmasks for comparison styles. */
var PARTIAL_COMPARE_FLAG = 2;

/** Used for built-in method references. */
var objectProto = Object.prototype;

/** Used to check objects for own properties. */
var hasOwnProperty = objectProto.hasOwnProperty;

/**
 * A specialized version of `baseIsEqualDeep` for objects with support for
 * partial deep comparisons.
 *
 * @private
 * @param {Object} object The object to compare.
 * @param {Object} other The other object to compare.
 * @param {Function} equalFunc The function to determine equivalents of values.
 * @param {Function} customizer The function to customize comparisons.
 * @param {number} bitmask The bitmask of comparison flags. See `baseIsEqual`
 *  for more details.
 * @param {Object} stack Tracks traversed `object` and `other` objects.
 * @returns {boolean} Returns `true` if the objects are equivalent, else `false`.
 */
function equalObjects(object, other, equalFunc, customizer, bitmask, stack) {
  var isPartial = bitmask & PARTIAL_COMPARE_FLAG,
      objProps = keys(object),
      objLength = objProps.length,
      othProps = keys(other),
      othLength = othProps.length;

  if (objLength != othLength && !isPartial) {
    return false;
  }
  var index = objLength;
  while (index--) {
    var key = objProps[index];
    if (!(isPartial ? key in other : hasOwnProperty.call(other, key))) {
      return false;
    }
  }
  // Assume cyclic values are equal.
  var stacked = stack.get(object);
  if (stacked && stack.get(other)) {
    return stacked == other;
  }
  var result = true;
  stack.set(object, other);
  stack.set(other, object);

  var skipCtor = isPartial;
  while (++index < objLength) {
    key = objProps[index];
    var objValue = object[key],
        othValue = other[key];

    if (customizer) {
      var compared = isPartial
        ? customizer(othValue, objValue, key, other, object, stack)
        : customizer(objValue, othValue, key, object, other, stack);
    }
    // Recursively compare objects (susceptible to call stack limits).
    if (!(compared === undefined
          ? (objValue === othValue || equalFunc(objValue, othValue, customizer, bitmask, stack))
          : compared
        )) {
      result = false;
      break;
    }
    skipCtor || (skipCtor = key == 'constructor');
  }
  if (result && !skipCtor) {
    var objCtor = object.constructor,
        othCtor = other.constructor;

    // Non `Object` object instances with different constructors are not equal.
    if (objCtor != othCtor &&
        ('constructor' in object && 'constructor' in other) &&
        !(typeof objCtor == 'function' && objCtor instanceof objCtor &&
          typeof othCtor == 'function' && othCtor instanceof othCtor)) {
      result = false;
    }
  }
  stack['delete'](object);
  stack['delete'](other);
  return result;
}

module.exports = equalObjects;
});

var _equalObjects$1 = interopDefault(_equalObjects);


var require$$4$5 = Object.freeze({
	default: _equalObjects$1
});

var _DataView = createCommonjsModule(function (module) {
var getNative = interopDefault(require$$1$3),
    root = interopDefault(require$$0$4);

/* Built-in method references that are verified to be native. */
var DataView = getNative(root, 'DataView');

module.exports = DataView;
});

var _DataView$1 = interopDefault(_DataView);


var require$$6$2 = Object.freeze({
	default: _DataView$1
});

var _Promise = createCommonjsModule(function (module) {
var getNative = interopDefault(require$$1$3),
    root = interopDefault(require$$0$4);

/* Built-in method references that are verified to be native. */
var Promise = getNative(root, 'Promise');

module.exports = Promise;
});

var _Promise$1 = interopDefault(_Promise);


var require$$4$6 = Object.freeze({
	default: _Promise$1
});

var _Set = createCommonjsModule(function (module) {
var getNative = interopDefault(require$$1$3),
    root = interopDefault(require$$0$4);

/* Built-in method references that are verified to be native. */
var Set = getNative(root, 'Set');

module.exports = Set;
});

var _Set$1 = interopDefault(_Set);


var require$$3$7 = Object.freeze({
	default: _Set$1
});

var _WeakMap = createCommonjsModule(function (module) {
var getNative = interopDefault(require$$1$3),
    root = interopDefault(require$$0$4);

/* Built-in method references that are verified to be native. */
var WeakMap = getNative(root, 'WeakMap');

module.exports = WeakMap;
});

var _WeakMap$1 = interopDefault(_WeakMap);


var require$$2$15 = Object.freeze({
	default: _WeakMap$1
});

var _baseGetTag = createCommonjsModule(function (module) {
/** Used for built-in method references. */
var objectProto = Object.prototype;

/**
 * Used to resolve the
 * [`toStringTag`](http://ecma-international.org/ecma-262/7.0/#sec-object.prototype.tostring)
 * of values.
 */
var objectToString = objectProto.toString;

/**
 * The base implementation of `getTag`.
 *
 * @private
 * @param {*} value The value to query.
 * @returns {string} Returns the `toStringTag`.
 */
function baseGetTag(value) {
  return objectToString.call(value);
}

module.exports = baseGetTag;
});

var _baseGetTag$1 = interopDefault(_baseGetTag);


var require$$1$22 = Object.freeze({
	default: _baseGetTag$1
});

var _getTag = createCommonjsModule(function (module) {
var DataView = interopDefault(require$$6$2),
    Map = interopDefault(require$$5$3),
    Promise = interopDefault(require$$4$6),
    Set = interopDefault(require$$3$7),
    WeakMap = interopDefault(require$$2$15),
    baseGetTag = interopDefault(require$$1$22),
    toSource = interopDefault(require$$0$6);

/** `Object#toString` result references. */
var mapTag = '[object Map]',
    objectTag = '[object Object]',
    promiseTag = '[object Promise]',
    setTag = '[object Set]',
    weakMapTag = '[object WeakMap]';

var dataViewTag = '[object DataView]';

/** Used for built-in method references. */
var objectProto = Object.prototype;

/**
 * Used to resolve the
 * [`toStringTag`](http://ecma-international.org/ecma-262/7.0/#sec-object.prototype.tostring)
 * of values.
 */
var objectToString = objectProto.toString;

/** Used to detect maps, sets, and weakmaps. */
var dataViewCtorString = toSource(DataView),
    mapCtorString = toSource(Map),
    promiseCtorString = toSource(Promise),
    setCtorString = toSource(Set),
    weakMapCtorString = toSource(WeakMap);

/**
 * Gets the `toStringTag` of `value`.
 *
 * @private
 * @param {*} value The value to query.
 * @returns {string} Returns the `toStringTag`.
 */
var getTag = baseGetTag;

// Fallback for data views, maps, sets, and weak maps in IE 11 and promises in Node.js < 6.
if ((DataView && getTag(new DataView(new ArrayBuffer(1))) != dataViewTag) ||
    (Map && getTag(new Map) != mapTag) ||
    (Promise && getTag(Promise.resolve()) != promiseTag) ||
    (Set && getTag(new Set) != setTag) ||
    (WeakMap && getTag(new WeakMap) != weakMapTag)) {
  getTag = function(value) {
    var result = objectToString.call(value),
        Ctor = result == objectTag ? value.constructor : undefined,
        ctorString = Ctor ? toSource(Ctor) : undefined;

    if (ctorString) {
      switch (ctorString) {
        case dataViewCtorString: return dataViewTag;
        case mapCtorString: return mapTag;
        case promiseCtorString: return promiseTag;
        case setCtorString: return setTag;
        case weakMapCtorString: return weakMapTag;
      }
    }
    return result;
  };
}

module.exports = getTag;
});

var _getTag$1 = interopDefault(_getTag);


var require$$7 = Object.freeze({
	default: _getTag$1
});

var _baseIsEqualDeep = createCommonjsModule(function (module) {
var Stack = interopDefault(require$$15),
    equalArrays = interopDefault(require$$2$14),
    equalByTag = interopDefault(require$$5$5),
    equalObjects = interopDefault(require$$4$5),
    getTag = interopDefault(require$$7),
    isArray = interopDefault(require$$0),
    isBuffer = interopDefault(require$$2$4),
    isTypedArray = interopDefault(require$$0$15);

/** Used to compose bitmasks for comparison styles. */
var PARTIAL_COMPARE_FLAG = 2;

/** `Object#toString` result references. */
var argsTag = '[object Arguments]',
    arrayTag = '[object Array]',
    objectTag = '[object Object]';

/** Used for built-in method references. */
var objectProto = Object.prototype;

/** Used to check objects for own properties. */
var hasOwnProperty = objectProto.hasOwnProperty;

/**
 * A specialized version of `baseIsEqual` for arrays and objects which performs
 * deep comparisons and tracks traversed objects enabling objects with circular
 * references to be compared.
 *
 * @private
 * @param {Object} object The object to compare.
 * @param {Object} other The other object to compare.
 * @param {Function} equalFunc The function to determine equivalents of values.
 * @param {Function} [customizer] The function to customize comparisons.
 * @param {number} [bitmask] The bitmask of comparison flags. See `baseIsEqual`
 *  for more details.
 * @param {Object} [stack] Tracks traversed `object` and `other` objects.
 * @returns {boolean} Returns `true` if the objects are equivalent, else `false`.
 */
function baseIsEqualDeep(object, other, equalFunc, customizer, bitmask, stack) {
  var objIsArr = isArray(object),
      othIsArr = isArray(other),
      objTag = arrayTag,
      othTag = arrayTag;

  if (!objIsArr) {
    objTag = getTag(object);
    objTag = objTag == argsTag ? objectTag : objTag;
  }
  if (!othIsArr) {
    othTag = getTag(other);
    othTag = othTag == argsTag ? objectTag : othTag;
  }
  var objIsObj = objTag == objectTag,
      othIsObj = othTag == objectTag,
      isSameTag = objTag == othTag;

  if (isSameTag && isBuffer(object)) {
    if (!isBuffer(other)) {
      return false;
    }
    objIsArr = true;
    objIsObj = false;
  }
  if (isSameTag && !objIsObj) {
    stack || (stack = new Stack);
    return (objIsArr || isTypedArray(object))
      ? equalArrays(object, other, equalFunc, customizer, bitmask, stack)
      : equalByTag(object, other, objTag, equalFunc, customizer, bitmask, stack);
  }
  if (!(bitmask & PARTIAL_COMPARE_FLAG)) {
    var objIsWrapped = objIsObj && hasOwnProperty.call(object, '__wrapped__'),
        othIsWrapped = othIsObj && hasOwnProperty.call(other, '__wrapped__');

    if (objIsWrapped || othIsWrapped) {
      var objUnwrapped = objIsWrapped ? object.value() : object,
          othUnwrapped = othIsWrapped ? other.value() : other;

      stack || (stack = new Stack);
      return equalFunc(objUnwrapped, othUnwrapped, customizer, bitmask, stack);
    }
  }
  if (!isSameTag) {
    return false;
  }
  stack || (stack = new Stack);
  return equalObjects(object, other, equalFunc, customizer, bitmask, stack);
}

module.exports = baseIsEqualDeep;
});

var _baseIsEqualDeep$1 = interopDefault(_baseIsEqualDeep);


var require$$2$13 = Object.freeze({
	default: _baseIsEqualDeep$1
});

var _baseIsEqual = createCommonjsModule(function (module) {
var baseIsEqualDeep = interopDefault(require$$2$13),
    isObject = interopDefault(require$$1$6),
    isObjectLike = interopDefault(require$$0$1);

/**
 * The base implementation of `_.isEqual` which supports partial comparisons
 * and tracks traversed objects.
 *
 * @private
 * @param {*} value The value to compare.
 * @param {*} other The other value to compare.
 * @param {Function} [customizer] The function to customize comparisons.
 * @param {boolean} [bitmask] The bitmask of comparison flags.
 *  The bitmask may be composed of the following flags:
 *     1 - Unordered comparison
 *     2 - Partial comparison
 * @param {Object} [stack] Tracks traversed `value` and `other` objects.
 * @returns {boolean} Returns `true` if the values are equivalent, else `false`.
 */
function baseIsEqual(value, other, customizer, bitmask, stack) {
  if (value === other) {
    return true;
  }
  if (value == null || other == null || (!isObject(value) && !isObjectLike(other))) {
    return value !== value && other !== other;
  }
  return baseIsEqualDeep(value, other, baseIsEqual, customizer, bitmask, stack);
}

module.exports = baseIsEqual;
});

var _baseIsEqual$1 = interopDefault(_baseIsEqual);


var require$$6$1 = Object.freeze({
	default: _baseIsEqual$1
});

var _baseIsMatch = createCommonjsModule(function (module) {
var Stack = interopDefault(require$$15),
    baseIsEqual = interopDefault(require$$6$1);

/** Used to compose bitmasks for comparison styles. */
var UNORDERED_COMPARE_FLAG = 1,
    PARTIAL_COMPARE_FLAG = 2;

/**
 * The base implementation of `_.isMatch` without support for iteratee shorthands.
 *
 * @private
 * @param {Object} object The object to inspect.
 * @param {Object} source The object of property values to match.
 * @param {Array} matchData The property names, values, and compare flags to match.
 * @param {Function} [customizer] The function to customize comparisons.
 * @returns {boolean} Returns `true` if `object` is a match, else `false`.
 */
function baseIsMatch(object, source, matchData, customizer) {
  var index = matchData.length,
      length = index,
      noCustomizer = !customizer;

  if (object == null) {
    return !length;
  }
  object = Object(object);
  while (index--) {
    var data = matchData[index];
    if ((noCustomizer && data[2])
          ? data[1] !== object[data[0]]
          : !(data[0] in object)
        ) {
      return false;
    }
  }
  while (++index < length) {
    data = matchData[index];
    var key = data[0],
        objValue = object[key],
        srcValue = data[1];

    if (noCustomizer && data[2]) {
      if (objValue === undefined && !(key in object)) {
        return false;
      }
    } else {
      var stack = new Stack;
      if (customizer) {
        var result = customizer(objValue, srcValue, key, object, source, stack);
      }
      if (!(result === undefined
            ? baseIsEqual(srcValue, objValue, customizer, UNORDERED_COMPARE_FLAG | PARTIAL_COMPARE_FLAG, stack)
            : result
          )) {
        return false;
      }
    }
  }
  return true;
}

module.exports = baseIsMatch;
});

var _baseIsMatch$1 = interopDefault(_baseIsMatch);


var require$$2$7 = Object.freeze({
	default: _baseIsMatch$1
});

var _isStrictComparable = createCommonjsModule(function (module) {
var isObject = interopDefault(require$$1$6);

/**
 * Checks if `value` is suitable for strict equality comparisons, i.e. `===`.
 *
 * @private
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` if suitable for strict
 *  equality comparisons, else `false`.
 */
function isStrictComparable(value) {
  return value === value && !isObject(value);
}

module.exports = isStrictComparable;
});

var _isStrictComparable$1 = interopDefault(_isStrictComparable);


var require$$2$16 = Object.freeze({
	default: _isStrictComparable$1
});

var _getMatchData = createCommonjsModule(function (module) {
var isStrictComparable = interopDefault(require$$2$16),
    keys = interopDefault(require$$0$34);

/**
 * Gets the property names, values, and compare flags of `object`.
 *
 * @private
 * @param {Object} object The object to query.
 * @returns {Array} Returns the match data of `object`.
 */
function getMatchData(object) {
  var result = keys(object),
      length = result.length;

  while (length--) {
    var key = result[length],
        value = object[key];

    result[length] = [key, value, isStrictComparable(value)];
  }
  return result;
}

module.exports = getMatchData;
});

var _getMatchData$1 = interopDefault(_getMatchData);


var require$$1$23 = Object.freeze({
	default: _getMatchData$1
});

var _matchesStrictComparable = createCommonjsModule(function (module) {
/**
 * A specialized version of `matchesProperty` for source values suitable
 * for strict equality comparisons, i.e. `===`.
 *
 * @private
 * @param {string} key The key of the property to get.
 * @param {*} srcValue The value to match.
 * @returns {Function} Returns the new spec function.
 */
function matchesStrictComparable(key, srcValue) {
  return function(object) {
    if (object == null) {
      return false;
    }
    return object[key] === srcValue &&
      (srcValue !== undefined || (key in Object(object)));
  };
}

module.exports = matchesStrictComparable;
});

var _matchesStrictComparable$1 = interopDefault(_matchesStrictComparable);


var require$$1$24 = Object.freeze({
	default: _matchesStrictComparable$1
});

var _baseMatches = createCommonjsModule(function (module) {
var baseIsMatch = interopDefault(require$$2$7),
    getMatchData = interopDefault(require$$1$23),
    matchesStrictComparable = interopDefault(require$$1$24);

/**
 * The base implementation of `_.matches` which doesn't clone `source`.
 *
 * @private
 * @param {Object} source The object of property values to match.
 * @returns {Function} Returns the new spec function.
 */
function baseMatches(source) {
  var matchData = getMatchData(source);
  if (matchData.length == 1 && matchData[0][2]) {
    return matchesStrictComparable(matchData[0][0], matchData[0][1]);
  }
  return function(object) {
    return object === source || baseIsMatch(object, source, matchData);
  };
}

module.exports = baseMatches;
});

var _baseMatches$1 = interopDefault(_baseMatches);


var require$$4 = Object.freeze({
	default: _baseMatches$1
});

var memoize = createCommonjsModule(function (module) {
var MapCache = interopDefault(require$$0$22);

/** Error message constants. */
var FUNC_ERROR_TEXT = 'Expected a function';

/**
 * Creates a function that memoizes the result of `func`. If `resolver` is
 * provided, it determines the cache key for storing the result based on the
 * arguments provided to the memoized function. By default, the first argument
 * provided to the memoized function is used as the map cache key. The `func`
 * is invoked with the `this` binding of the memoized function.
 *
 * **Note:** The cache is exposed as the `cache` property on the memoized
 * function. Its creation may be customized by replacing the `_.memoize.Cache`
 * constructor with one whose instances implement the
 * [`Map`](http://ecma-international.org/ecma-262/7.0/#sec-properties-of-the-map-prototype-object)
 * method interface of `delete`, `get`, `has`, and `set`.
 *
 * @static
 * @memberOf _
 * @since 0.1.0
 * @category Function
 * @param {Function} func The function to have its output memoized.
 * @param {Function} [resolver] The function to resolve the cache key.
 * @returns {Function} Returns the new memoized function.
 * @example
 *
 * var object = { 'a': 1, 'b': 2 };
 * var other = { 'c': 3, 'd': 4 };
 *
 * var values = _.memoize(_.values);
 * values(object);
 * // => [1, 2]
 *
 * values(other);
 * // => [3, 4]
 *
 * object.a = 2;
 * values(object);
 * // => [1, 2]
 *
 * // Modify the result cache.
 * values.cache.set(object, ['a', 'b']);
 * values(object);
 * // => ['a', 'b']
 *
 * // Replace `_.memoize.Cache`.
 * _.memoize.Cache = WeakMap;
 */
function memoize(func, resolver) {
  if (typeof func != 'function' || (resolver && typeof resolver != 'function')) {
    throw new TypeError(FUNC_ERROR_TEXT);
  }
  var memoized = function() {
    var args = arguments,
        key = resolver ? resolver.apply(this, args) : args[0],
        cache = memoized.cache;

    if (cache.has(key)) {
      return cache.get(key);
    }
    var result = func.apply(this, args);
    memoized.cache = cache.set(key, result) || cache;
    return result;
  };
  memoized.cache = new (memoize.Cache || MapCache);
  return memoized;
}

// Expose `MapCache`.
memoize.Cache = MapCache;

module.exports = memoize;
});

var memoize$1 = interopDefault(memoize);


var require$$0$39 = Object.freeze({
	default: memoize$1
});

var _memoizeCapped = createCommonjsModule(function (module) {
var memoize = interopDefault(require$$0$39);

/** Used as the maximum memoize cache size. */
var MAX_MEMOIZE_SIZE = 500;

/**
 * A specialized version of `_.memoize` which clears the memoized function's
 * cache when it exceeds `MAX_MEMOIZE_SIZE`.
 *
 * @private
 * @param {Function} func The function to have its output memoized.
 * @returns {Function} Returns the new memoized function.
 */
function memoizeCapped(func) {
  var result = memoize(func, function(key) {
    if (cache.size === MAX_MEMOIZE_SIZE) {
      cache.clear();
    }
    return key;
  });

  var cache = result.cache;
  return result;
}

module.exports = memoizeCapped;
});

var _memoizeCapped$1 = interopDefault(_memoizeCapped);


var require$$1$25 = Object.freeze({
	default: _memoizeCapped$1
});

var isSymbol = createCommonjsModule(function (module) {
var isObjectLike = interopDefault(require$$0$1);

/** `Object#toString` result references. */
var symbolTag = '[object Symbol]';

/** Used for built-in method references. */
var objectProto = Object.prototype;

/**
 * Used to resolve the
 * [`toStringTag`](http://ecma-international.org/ecma-262/7.0/#sec-object.prototype.tostring)
 * of values.
 */
var objectToString = objectProto.toString;

/**
 * Checks if `value` is classified as a `Symbol` primitive or object.
 *
 * @static
 * @memberOf _
 * @since 4.0.0
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is a symbol, else `false`.
 * @example
 *
 * _.isSymbol(Symbol.iterator);
 * // => true
 *
 * _.isSymbol('abc');
 * // => false
 */
function isSymbol(value) {
  return typeof value == 'symbol' ||
    (isObjectLike(value) && objectToString.call(value) == symbolTag);
}

module.exports = isSymbol;
});

var isSymbol$1 = interopDefault(isSymbol);


var require$$0$42 = Object.freeze({
	default: isSymbol$1
});

var _baseToString = createCommonjsModule(function (module) {
var Symbol = interopDefault(require$$0$30),
    arrayMap = interopDefault(require$$6),
    isArray = interopDefault(require$$0),
    isSymbol = interopDefault(require$$0$42);

/** Used as references for various `Number` constants. */
var INFINITY = 1 / 0;

/** Used to convert symbols to primitives and strings. */
var symbolProto = Symbol ? Symbol.prototype : undefined,
    symbolToString = symbolProto ? symbolProto.toString : undefined;

/**
 * The base implementation of `_.toString` which doesn't convert nullish
 * values to empty strings.
 *
 * @private
 * @param {*} value The value to process.
 * @returns {string} Returns the string.
 */
function baseToString(value) {
  // Exit early for strings to avoid a performance hit in some environments.
  if (typeof value == 'string') {
    return value;
  }
  if (isArray(value)) {
    // Recursively convert values (susceptible to call stack limits).
    return arrayMap(value, baseToString) + '';
  }
  if (isSymbol(value)) {
    return symbolToString ? symbolToString.call(value) : '';
  }
  var result = (value + '');
  return (result == '0' && (1 / value) == -INFINITY) ? '-0' : result;
}

module.exports = baseToString;
});

var _baseToString$1 = interopDefault(_baseToString);


var require$$0$41 = Object.freeze({
	default: _baseToString$1
});

var toString = createCommonjsModule(function (module) {
var baseToString = interopDefault(require$$0$41);

/**
 * Converts `value` to a string. An empty string is returned for `null`
 * and `undefined` values. The sign of `-0` is preserved.
 *
 * @static
 * @memberOf _
 * @since 4.0.0
 * @category Lang
 * @param {*} value The value to convert.
 * @returns {string} Returns the converted string.
 * @example
 *
 * _.toString(null);
 * // => ''
 *
 * _.toString(-0);
 * // => '-0'
 *
 * _.toString([1, 2, 3]);
 * // => '1,2,3'
 */
function toString(value) {
  return value == null ? '' : baseToString(value);
}

module.exports = toString;
});

var toString$1 = interopDefault(toString);


var require$$0$40 = Object.freeze({
	default: toString$1
});

var _stringToPath = createCommonjsModule(function (module) {
var memoizeCapped = interopDefault(require$$1$25),
    toString = interopDefault(require$$0$40);

/** Used to match property names within property paths. */
var reLeadingDot = /^\./,
    rePropName = /[^.[\]]+|\[(?:(-?\d+(?:\.\d+)?)|(["'])((?:(?!\2)[^\\]|\\.)*?)\2)\]|(?=(?:\.|\[\])(?:\.|\[\]|$))/g;

/** Used to match backslashes in property paths. */
var reEscapeChar = /\\(\\)?/g;

/**
 * Converts `string` to a property path array.
 *
 * @private
 * @param {string} string The string to convert.
 * @returns {Array} Returns the property path array.
 */
var stringToPath = memoizeCapped(function(string) {
  string = toString(string);

  var result = [];
  if (reLeadingDot.test(string)) {
    result.push('');
  }
  string.replace(rePropName, function(match, number, quote, string) {
    result.push(quote ? string.replace(reEscapeChar, '$1') : (number || match));
  });
  return result;
});

module.exports = stringToPath;
});

var _stringToPath$1 = interopDefault(_stringToPath);


var require$$0$38 = Object.freeze({
	default: _stringToPath$1
});

var _castPath = createCommonjsModule(function (module) {
var isArray = interopDefault(require$$0),
    stringToPath = interopDefault(require$$0$38);

/**
 * Casts `value` to a path array if it's not one.
 *
 * @private
 * @param {*} value The value to inspect.
 * @returns {Array} Returns the cast property path array.
 */
function castPath(value) {
  return isArray(value) ? value : stringToPath(value);
}

module.exports = castPath;
});

var _castPath$1 = interopDefault(_castPath);


var require$$6$3 = Object.freeze({
	default: _castPath$1
});

var _isKey = createCommonjsModule(function (module) {
var isArray = interopDefault(require$$0),
    isSymbol = interopDefault(require$$0$42);

/** Used to match property names within property paths. */
var reIsDeepProp = /\.|\[(?:[^[\]]*|(["'])(?:(?!\1)[^\\]|\\.)*?\1)\]/,
    reIsPlainProp = /^\w*$/;

/**
 * Checks if `value` is a property name and not a property path.
 *
 * @private
 * @param {*} value The value to check.
 * @param {Object} [object] The object to query keys on.
 * @returns {boolean} Returns `true` if `value` is a property name, else `false`.
 */
function isKey(value, object) {
  if (isArray(value)) {
    return false;
  }
  var type = typeof value;
  if (type == 'number' || type == 'symbol' || type == 'boolean' ||
      value == null || isSymbol(value)) {
    return true;
  }
  return reIsPlainProp.test(value) || !reIsDeepProp.test(value) ||
    (object != null && value in Object(object));
}

module.exports = isKey;
});

var _isKey$1 = interopDefault(_isKey);


var require$$1$26 = Object.freeze({
	default: _isKey$1
});

var _toKey = createCommonjsModule(function (module) {
var isSymbol = interopDefault(require$$0$42);

/** Used as references for various `Number` constants. */
var INFINITY = 1 / 0;

/**
 * Converts `value` to a string key if it's not a string or symbol.
 *
 * @private
 * @param {*} value The value to inspect.
 * @returns {string|symbol} Returns the key.
 */
function toKey(value) {
  if (typeof value == 'string' || isSymbol(value)) {
    return value;
  }
  var result = (value + '');
  return (result == '0' && (1 / value) == -INFINITY) ? '-0' : result;
}

module.exports = toKey;
});

var _toKey$1 = interopDefault(_toKey);


var require$$0$43 = Object.freeze({
	default: _toKey$1
});

var _baseGet = createCommonjsModule(function (module) {
var castPath = interopDefault(require$$6$3),
    isKey = interopDefault(require$$1$26),
    toKey = interopDefault(require$$0$43);

/**
 * The base implementation of `_.get` without support for default values.
 *
 * @private
 * @param {Object} object The object to query.
 * @param {Array|string} path The path of the property to get.
 * @returns {*} Returns the resolved value.
 */
function baseGet(object, path) {
  path = isKey(path, object) ? [path] : castPath(path);

  var index = 0,
      length = path.length;

  while (object != null && index < length) {
    object = object[toKey(path[index++])];
  }
  return (index && index == length) ? object : undefined;
}

module.exports = baseGet;
});

var _baseGet$1 = interopDefault(_baseGet);


var require$$0$37 = Object.freeze({
	default: _baseGet$1
});

var get = createCommonjsModule(function (module) {
var baseGet = interopDefault(require$$0$37);

/**
 * Gets the value at `path` of `object`. If the resolved value is
 * `undefined`, the `defaultValue` is returned in its place.
 *
 * @static
 * @memberOf _
 * @since 3.7.0
 * @category Object
 * @param {Object} object The object to query.
 * @param {Array|string} path The path of the property to get.
 * @param {*} [defaultValue] The value returned for `undefined` resolved values.
 * @returns {*} Returns the resolved value.
 * @example
 *
 * var object = { 'a': [{ 'b': { 'c': 3 } }] };
 *
 * _.get(object, 'a[0].b.c');
 * // => 3
 *
 * _.get(object, ['a', '0', 'b', 'c']);
 * // => 3
 *
 * _.get(object, 'a.b.c', 'default');
 * // => 'default'
 */
function get(object, path, defaultValue) {
  var result = object == null ? undefined : baseGet(object, path);
  return result === undefined ? defaultValue : result;
}

module.exports = get;
});

var get$1 = interopDefault(get);


var require$$5$6 = Object.freeze({
	default: get$1
});

var _baseHasIn = createCommonjsModule(function (module) {
/**
 * The base implementation of `_.hasIn` without support for deep paths.
 *
 * @private
 * @param {Object} [object] The object to query.
 * @param {Array|string} key The key to check.
 * @returns {boolean} Returns `true` if `key` exists, else `false`.
 */
function baseHasIn(object, key) {
  return object != null && key in Object(object);
}

module.exports = baseHasIn;
});

var _baseHasIn$1 = interopDefault(_baseHasIn);


var require$$1$27 = Object.freeze({
	default: _baseHasIn$1
});

var _hasPath = createCommonjsModule(function (module) {
var castPath = interopDefault(require$$6$3),
    isArguments = interopDefault(require$$5$1),
    isArray = interopDefault(require$$0),
    isIndex = interopDefault(require$$3$2),
    isKey = interopDefault(require$$1$26),
    isLength = interopDefault(require$$1$11),
    toKey = interopDefault(require$$0$43);

/**
 * Checks if `path` exists on `object`.
 *
 * @private
 * @param {Object} object The object to query.
 * @param {Array|string} path The path to check.
 * @param {Function} hasFunc The function to check properties.
 * @returns {boolean} Returns `true` if `path` exists, else `false`.
 */
function hasPath(object, path, hasFunc) {
  path = isKey(path, object) ? [path] : castPath(path);

  var index = -1,
      length = path.length,
      result = false;

  while (++index < length) {
    var key = toKey(path[index]);
    if (!(result = object != null && hasFunc(object, key))) {
      break;
    }
    object = object[key];
  }
  if (result || ++index != length) {
    return result;
  }
  length = object ? object.length : 0;
  return !!length && isLength(length) && isIndex(key, length) &&
    (isArray(object) || isArguments(object));
}

module.exports = hasPath;
});

var _hasPath$1 = interopDefault(_hasPath);


var require$$0$44 = Object.freeze({
	default: _hasPath$1
});

var hasIn = createCommonjsModule(function (module) {
var baseHasIn = interopDefault(require$$1$27),
    hasPath = interopDefault(require$$0$44);

/**
 * Checks if `path` is a direct or inherited property of `object`.
 *
 * @static
 * @memberOf _
 * @since 4.0.0
 * @category Object
 * @param {Object} object The object to query.
 * @param {Array|string} path The path to check.
 * @returns {boolean} Returns `true` if `path` exists, else `false`.
 * @example
 *
 * var object = _.create({ 'a': _.create({ 'b': 2 }) });
 *
 * _.hasIn(object, 'a');
 * // => true
 *
 * _.hasIn(object, 'a.b');
 * // => true
 *
 * _.hasIn(object, ['a', 'b']);
 * // => true
 *
 * _.hasIn(object, 'b');
 * // => false
 */
function hasIn(object, path) {
  return object != null && hasPath(object, path, baseHasIn);
}

module.exports = hasIn;
});

var hasIn$1 = interopDefault(hasIn);


var require$$4$7 = Object.freeze({
	default: hasIn$1
});

var _baseMatchesProperty = createCommonjsModule(function (module) {
var baseIsEqual = interopDefault(require$$6$1),
    get = interopDefault(require$$5$6),
    hasIn = interopDefault(require$$4$7),
    isKey = interopDefault(require$$1$26),
    isStrictComparable = interopDefault(require$$2$16),
    matchesStrictComparable = interopDefault(require$$1$24),
    toKey = interopDefault(require$$0$43);

/** Used to compose bitmasks for comparison styles. */
var UNORDERED_COMPARE_FLAG = 1,
    PARTIAL_COMPARE_FLAG = 2;

/**
 * The base implementation of `_.matchesProperty` which doesn't clone `srcValue`.
 *
 * @private
 * @param {string} path The path of the property to get.
 * @param {*} srcValue The value to match.
 * @returns {Function} Returns the new spec function.
 */
function baseMatchesProperty(path, srcValue) {
  if (isKey(path) && isStrictComparable(srcValue)) {
    return matchesStrictComparable(toKey(path), srcValue);
  }
  return function(object) {
    var objValue = get(object, path);
    return (objValue === undefined && objValue === srcValue)
      ? hasIn(object, path)
      : baseIsEqual(srcValue, objValue, undefined, UNORDERED_COMPARE_FLAG | PARTIAL_COMPARE_FLAG);
  };
}

module.exports = baseMatchesProperty;
});

var _baseMatchesProperty$1 = interopDefault(_baseMatchesProperty);


var require$$3$8 = Object.freeze({
	default: _baseMatchesProperty$1
});

var _baseProperty = createCommonjsModule(function (module) {
/**
 * The base implementation of `_.property` without support for deep paths.
 *
 * @private
 * @param {string} key The key of the property to get.
 * @returns {Function} Returns the new accessor function.
 */
function baseProperty(key) {
  return function(object) {
    return object == null ? undefined : object[key];
  };
}

module.exports = baseProperty;
});

var _baseProperty$1 = interopDefault(_baseProperty);


var require$$3$9 = Object.freeze({
	default: _baseProperty$1
});

var _basePropertyDeep = createCommonjsModule(function (module) {
var baseGet = interopDefault(require$$0$37);

/**
 * A specialized version of `baseProperty` which supports deep paths.
 *
 * @private
 * @param {Array|string} path The path of the property to get.
 * @returns {Function} Returns the new accessor function.
 */
function basePropertyDeep(path) {
  return function(object) {
    return baseGet(object, path);
  };
}

module.exports = basePropertyDeep;
});

var _basePropertyDeep$1 = interopDefault(_basePropertyDeep);


var require$$2$17 = Object.freeze({
	default: _basePropertyDeep$1
});

var property = createCommonjsModule(function (module) {
var baseProperty = interopDefault(require$$3$9),
    basePropertyDeep = interopDefault(require$$2$17),
    isKey = interopDefault(require$$1$26),
    toKey = interopDefault(require$$0$43);

/**
 * Creates a function that returns the value at `path` of a given object.
 *
 * @static
 * @memberOf _
 * @since 2.4.0
 * @category Util
 * @param {Array|string} path The path of the property to get.
 * @returns {Function} Returns the new accessor function.
 * @example
 *
 * var objects = [
 *   { 'a': { 'b': 2 } },
 *   { 'a': { 'b': 1 } }
 * ];
 *
 * _.map(objects, _.property('a.b'));
 * // => [2, 1]
 *
 * _.map(_.sortBy(objects, _.property(['a', 'b'])), 'a.b');
 * // => [1, 2]
 */
function property(path) {
  return isKey(path) ? baseProperty(toKey(path)) : basePropertyDeep(path);
}

module.exports = property;
});

var property$1 = interopDefault(property);


var require$$0$45 = Object.freeze({
	default: property$1
});

var _baseIteratee = createCommonjsModule(function (module) {
var baseMatches = interopDefault(require$$4),
    baseMatchesProperty = interopDefault(require$$3$8),
    identity = interopDefault(require$$0$8),
    isArray = interopDefault(require$$0),
    property = interopDefault(require$$0$45);

/**
 * The base implementation of `_.iteratee`.
 *
 * @private
 * @param {*} [value=_.identity] The value to convert to an iteratee.
 * @returns {Function} Returns the iteratee.
 */
function baseIteratee(value) {
  // Don't store the `typeof` result in a variable to avoid a JIT bug in Safari 9.
  // See https://bugs.webkit.org/show_bug.cgi?id=156034 for more details.
  if (typeof value == 'function') {
    return value;
  }
  if (value == null) {
    return identity;
  }
  if (typeof value == 'object') {
    return isArray(value)
      ? baseMatchesProperty(value[0], value[1])
      : baseMatches(value);
  }
  return property(value);
}

module.exports = baseIteratee;
});

var _baseIteratee$1 = interopDefault(_baseIteratee);


var require$$5$2 = Object.freeze({
	default: _baseIteratee$1
});

var _createBaseFor = createCommonjsModule(function (module) {
/**
 * Creates a base function for methods like `_.forIn` and `_.forOwn`.
 *
 * @private
 * @param {boolean} [fromRight] Specify iterating from right to left.
 * @returns {Function} Returns the new base function.
 */
function createBaseFor(fromRight) {
  return function(object, iteratee, keysFunc) {
    var index = -1,
        iterable = Object(object),
        props = keysFunc(object),
        length = props.length;

    while (length--) {
      var key = props[fromRight ? length : ++index];
      if (iteratee(iterable[key], key, iterable) === false) {
        break;
      }
    }
    return object;
  };
}

module.exports = createBaseFor;
});

var _createBaseFor$1 = interopDefault(_createBaseFor);


var require$$0$46 = Object.freeze({
	default: _createBaseFor$1
});

var _baseFor = createCommonjsModule(function (module) {
var createBaseFor = interopDefault(require$$0$46);

/**
 * The base implementation of `baseForOwn` which iterates over `object`
 * properties returned by `keysFunc` and invokes `iteratee` for each property.
 * Iteratee functions may exit iteration early by explicitly returning `false`.
 *
 * @private
 * @param {Object} object The object to iterate over.
 * @param {Function} iteratee The function invoked per iteration.
 * @param {Function} keysFunc The function to get the keys of `object`.
 * @returns {Object} Returns `object`.
 */
var baseFor = createBaseFor();

module.exports = baseFor;
});

var _baseFor$1 = interopDefault(_baseFor);


var require$$1$30 = Object.freeze({
	default: _baseFor$1
});

var _baseForOwn = createCommonjsModule(function (module) {
var baseFor = interopDefault(require$$1$30),
    keys = interopDefault(require$$0$34);

/**
 * The base implementation of `_.forOwn` without support for iteratee shorthands.
 *
 * @private
 * @param {Object} object The object to iterate over.
 * @param {Function} iteratee The function invoked per iteration.
 * @returns {Object} Returns `object`.
 */
function baseForOwn(object, iteratee) {
  return object && baseFor(object, iteratee, keys);
}

module.exports = baseForOwn;
});

var _baseForOwn$1 = interopDefault(_baseForOwn);


var require$$1$29 = Object.freeze({
	default: _baseForOwn$1
});

var _createBaseEach = createCommonjsModule(function (module) {
var isArrayLike = interopDefault(require$$3$1);

/**
 * Creates a `baseEach` or `baseEachRight` function.
 *
 * @private
 * @param {Function} eachFunc The function to iterate over a collection.
 * @param {boolean} [fromRight] Specify iterating from right to left.
 * @returns {Function} Returns the new base function.
 */
function createBaseEach(eachFunc, fromRight) {
  return function(collection, iteratee) {
    if (collection == null) {
      return collection;
    }
    if (!isArrayLike(collection)) {
      return eachFunc(collection, iteratee);
    }
    var length = collection.length,
        index = fromRight ? length : -1,
        iterable = Object(collection);

    while ((fromRight ? index-- : ++index < length)) {
      if (iteratee(iterable[index], index, iterable) === false) {
        break;
      }
    }
    return collection;
  };
}

module.exports = createBaseEach;
});

var _createBaseEach$1 = interopDefault(_createBaseEach);


var require$$0$47 = Object.freeze({
	default: _createBaseEach$1
});

var _baseEach = createCommonjsModule(function (module) {
var baseForOwn = interopDefault(require$$1$29),
    createBaseEach = interopDefault(require$$0$47);

/**
 * The base implementation of `_.forEach` without support for iteratee shorthands.
 *
 * @private
 * @param {Array|Object} collection The collection to iterate over.
 * @param {Function} iteratee The function invoked per iteration.
 * @returns {Array|Object} Returns `collection`.
 */
var baseEach = createBaseEach(baseForOwn);

module.exports = baseEach;
});

var _baseEach$1 = interopDefault(_baseEach);


var require$$1$28 = Object.freeze({
	default: _baseEach$1
});

var _baseMap = createCommonjsModule(function (module) {
var baseEach = interopDefault(require$$1$28),
    isArrayLike = interopDefault(require$$3$1);

/**
 * The base implementation of `_.map` without support for iteratee shorthands.
 *
 * @private
 * @param {Array|Object} collection The collection to iterate over.
 * @param {Function} iteratee The function invoked per iteration.
 * @returns {Array} Returns the new mapped array.
 */
function baseMap(collection, iteratee) {
  var index = -1,
      result = isArrayLike(collection) ? Array(collection.length) : [];

  baseEach(collection, function(value, key, collection) {
    result[++index] = iteratee(value, key, collection);
  });
  return result;
}

module.exports = baseMap;
});

var _baseMap$1 = interopDefault(_baseMap);


var require$$4$8 = Object.freeze({
	default: _baseMap$1
});

var map = createCommonjsModule(function (module) {
var arrayMap = interopDefault(require$$6),
    baseIteratee = interopDefault(require$$5$2),
    baseMap = interopDefault(require$$4$8),
    isArray = interopDefault(require$$0);

/**
 * Creates an array of values by running each element in `collection` thru
 * `iteratee`. The iteratee is invoked with three arguments:
 * (value, index|key, collection).
 *
 * Many lodash methods are guarded to work as iteratees for methods like
 * `_.every`, `_.filter`, `_.map`, `_.mapValues`, `_.reject`, and `_.some`.
 *
 * The guarded methods are:
 * `ary`, `chunk`, `curry`, `curryRight`, `drop`, `dropRight`, `every`,
 * `fill`, `invert`, `parseInt`, `random`, `range`, `rangeRight`, `repeat`,
 * `sampleSize`, `slice`, `some`, `sortBy`, `split`, `take`, `takeRight`,
 * `template`, `trim`, `trimEnd`, `trimStart`, and `words`
 *
 * @static
 * @memberOf _
 * @since 0.1.0
 * @category Collection
 * @param {Array|Object} collection The collection to iterate over.
 * @param {Function} [iteratee=_.identity] The function invoked per iteration.
 * @returns {Array} Returns the new mapped array.
 * @example
 *
 * function square(n) {
 *   return n * n;
 * }
 *
 * _.map([4, 8], square);
 * // => [16, 64]
 *
 * _.map({ 'a': 4, 'b': 8 }, square);
 * // => [16, 64] (iteration order is not guaranteed)
 *
 * var users = [
 *   { 'user': 'barney' },
 *   { 'user': 'fred' }
 * ];
 *
 * // The `_.property` iteratee shorthand.
 * _.map(users, 'user');
 * // => ['barney', 'fred']
 */
function map(collection, iteratee) {
  var func = isArray(collection) ? arrayMap : baseMap;
  return func(collection, baseIteratee(iteratee, 3));
}

module.exports = map;
});

var map$1 = interopDefault(map);

var XMLAttributeEditor = (function (Component$$1) {
  function XMLAttributeEditor () {
    Component$$1.apply(this, arguments);
  }

  if ( Component$$1 ) XMLAttributeEditor.__proto__ = Component$$1;
  XMLAttributeEditor.prototype = Object.create( Component$$1 && Component$$1.prototype );
  XMLAttributeEditor.prototype.constructor = XMLAttributeEditor;

  XMLAttributeEditor.prototype._getAttributeString = function _getAttributeString () {
    return map$1(this.props.attributes, function(val, key) {
      return key+'='+val
    }).join('\n')
  };

  XMLAttributeEditor.prototype._parseAttributesFromString = function _parseAttributesFromString (newAttrs) {
    newAttrs = newAttrs.split('\n')
    var res = {}

    newAttrs.forEach(function(attr) {
      var parts = attr.split('=')
      res[parts[0]] = parts[1]
    })
    return res
  };

  /* Returns the changed attributes */
  XMLAttributeEditor.prototype.getAttributes = function getAttributes () {
    var attrStr = this.refs.attributesEditor.val()
    return this._parseAttributesFromString(attrStr)
  };

  XMLAttributeEditor.prototype.render = function render ($$) {
    var node = this.props.node
    var el = $$('div').addClass('sc-xml-attribute-editor')
    var attributeStr = this._getAttributeString(node)
    el.append(
      $$('textarea')
        .ref('attributesEditor')
        .append(attributeStr)
    )
    return el
  };

  return XMLAttributeEditor;
}(substance.Component));

var XMLEditor = (function (Component$$1) {
  function XMLEditor () {
    Component$$1.apply(this, arguments);
  }

  if ( Component$$1 ) XMLEditor.__proto__ = Component$$1;
  XMLEditor.prototype = Object.create( Component$$1 && Component$$1.prototype );
  XMLEditor.prototype.constructor = XMLEditor;

  XMLEditor.prototype.getXML = function getXML () {
    return this.refs.xml.val()
  };

  XMLEditor.prototype.render = function render ($$) {
    var el = $$('div').addClass('sc-xml-editor')

    el.append(
      $$('textarea')
        .ref('xml')
        .append(this.props.xml)
    )
    return el
  };

  return XMLEditor;
}(substance.Component));

var EditXML = (function (Component$$1) {
  function EditXML () {
    Component$$1.apply(this, arguments);
  }

  if ( Component$$1 ) EditXML.__proto__ = Component$$1;
  EditXML.prototype = Object.create( Component$$1 && Component$$1.prototype );
  EditXML.prototype.constructor = EditXML;

  EditXML.prototype.render = function render ($$) {
    var node = this.props.node
    var el = $$('div').addClass('sc-edit-xml')
    var tagName = node.tagName || node.constructor.type

    el.append(
      $$('div').addClass('se-tag sm-open-tag-start').append('<'+tagName)
    )

    el.append(
      $$(XMLAttributeEditor, {
        attributes: node.attributes
      }).ref('attributesEditor')
    )

    el.append(
      $$('div').addClass('se-tag sm-open-tag-end').append('>')
    )

    el.append(
      $$(XMLEditor, {
        xml: node.xmlContent
      }).ref('xmlEditor')
    )

    el.append(
      $$('div').addClass('se-tag sm-end-tag').append('</'+tagName+'>')
    )

    el.append(
      $$('div').addClass('se-actions').append(
        $$(substance.Button).append('Save').on('click', this._save),
        $$(substance.Button).addClass('se-cancel').append('Cancel').on('click', this._cancel)
      )
    )
    return el
  };

  EditXML.prototype._cancel = function _cancel () {
    this.send('closeModal');
  };

  EditXML.prototype._delete = function _delete () {
    console.warn('Not yet implemented');
    // TODO: this is actually not very trivial as we don't
    // know the node's context. E.g. when deleting
    // a contrib node we need to remove the id from
  };

  EditXML.prototype._save = function _save () {
    var documentSession = this.context.documentSession
    var node = this.props.node

    var newAttributes = this.refs.attributesEditor.getAttributes()
    var newXML = this.refs.xmlEditor.getXML()

    // TODO: add validity checks. E.g. try to parse XML string
    documentSession.transaction(function(tx) {
      tx.set([node.id, 'xmlContent'], newXML)
      tx.set([node.id, 'attributes'], newAttributes)
    })
    this.send('closeModal')
  };

  return EditXML;
}(substance.Component));

/*
  Extract name from elements that contain
  name or string-name nodes (e.g. contrib, mixed-citation, element-citation)
*/
function getFullName(node) {
  var el = toDOM(node)
  var name = el.find('name')
  var stringName = el.find('string-name')

  if (name) {
    var surname = name.find('surname').text()
    var givenNames = name.find('given-names').text()
    return [givenNames, surname].join(' ')
  } else if (stringName) {
    return stringName.text()
  }
}

/*
  For given contrib node get the assigned affiliation ids as an object
*/
function affsForContrib(node) {
  var el = toDOM(node)
  var xrefs = el.findAll('xref[ref-type=aff]')
  var affs = {}
  xrefs.forEach(function(xref) {
    var affId = xref.getAttribute('rid')
    affs[affId] = true
  })
  return affs
}

/*
  A practical view model for ContribComponent and EditContrib
*/
function getAdapter$1(node) {
  var doc = node.getDocument()

  return {
    node: node, // the original plain node
    fullName: getFullName(node),
    selectedAffs: affsForContrib(node),
    affs: getAffs(doc),
    // True if node follows strict texture-enforced markup
    strict: node.attributes.generator === 'texture'
  }
}

function saveContrib(documentSession, contribData) {
  documentSession.transaction(function(tx) {
    var node = tx.get(contribData.id)
    var el = toDOM(node)
    var $$ = el.getElementFactory()

    el.innerHTML = ''
    el.append(
      $$('string-name').append(contribData.fullName)
    )

    // Affiliations are represented as xrefs
    contribData.selectedAffs.forEach(function(affId) {
      el.append(
        $$('xref').attr({'ref-type': 'aff', rid: affId})
      )
    })

    var xmlContent = el.innerHTML
    tx.set([node.id, 'xmlContent'], xmlContent)
  })
}

var EditContrib = (function (Component$$1) {
  function EditContrib () {
    Component$$1.apply(this, arguments);
  }

  if ( Component$$1 ) EditContrib.__proto__ = Component$$1;
  EditContrib.prototype = Object.create( Component$$1 && Component$$1.prototype );
  EditContrib.prototype.constructor = EditContrib;

  EditContrib.prototype.getXML = function getXML () {
    return this.refs.xml.val()
  };

  EditContrib.prototype.render = function render ($$) {
    var Input = this.getComponent('input')
    var Button$$1 = this.getComponent('button')

    var el = $$('div').addClass('sc-edit-contrib')
    var affs = this.props.affs
    var fullName = this.props.fullName
    var selectedAffs = this.props.selectedAffs

    var affSel = $$('select').attr({multiple: 'multiple'}).ref('affSel')

    affs.forEach(function(a) {
      var opt = $$('option')
        .attr({value: a.node.id})
        .append(a.name)

      if (selectedAffs[a.node.id]) {
        opt.attr('selected', 'selected')
      }
      affSel.append(opt)
    })

    el.append(
      $$('div').addClass('se-label').append('Name:'),
      $$('div').addClass('se-fullname').append(
        $$(Input, {
          type: 'text',
          value: fullName,
          placeholder: 'Enter full name of author'
        }).ref('fullName')
      ),
      $$('div').addClass('se-label').append('Affiliations:'),
      affSel
    )

    el.append(
      $$('div').addClass('se-actions').append(
        $$(Button$$1).append('Save').on('click', this._save),
        $$(Button$$1).addClass('se-cancel').append('Cancel').on('click', this._cancel)
      )
    )
    return el
  };

  EditContrib.prototype._save = function _save () {
    var contribData = {
      id: this.props.node.id,
      selectedAffs: getSelectedOptions(this.refs.affSel.el.el),
      fullName: this.refs.fullName.val()
    }

    var documentSession = this.context.documentSession
    saveContrib(documentSession, contribData)
    this.send('closeModal')
  };

  EditContrib.prototype._cancel = function _cancel () {
    this.send('closeModal')
  };

  return EditContrib;
}(substance.Component));


// arguments: reference to select list, callback function (optional)
function getSelectedOptions(sel, fn) {
  var opts = [], opt

  // loop through options in select list
  for (var i=0, len=sel.options.length; i<len; i++) {
    opt = sel.options[i]

    // check if selected
    if ( opt.selected ) {
      // add to array of option elements to return from this function
      opts.push(opt.value)

      // invoke optional callback function if provided
      if (fn) {
        fn(opt)
      }
    }
  }
  // return array containing references to selected option elements
  return opts
}

var ContribComponent = (function (Component$$1) {
  function ContribComponent() {
    var args = [], len = arguments.length;
    while ( len-- ) args[ len ] = arguments[ len ];

    Component$$1.apply(this, args)

    this.handleActions({
      'closeModal': this._closeModal,
      'xmlSaved': this._closeModal
    })

    this.props.node.on('properties:changed', this.rerender, this)
  }

  if ( Component$$1 ) ContribComponent.__proto__ = Component$$1;
  ContribComponent.prototype = Object.create( Component$$1 && Component$$1.prototype );
  ContribComponent.prototype.constructor = ContribComponent;

  ContribComponent.prototype.render = function render ($$) {
    var Modal = this.getComponent('modal')
    var contrib = getAdapter$1(this.props.node)
    var el = $$('div').addClass('sc-contrib')
      .append(
        $$('div').addClass('se-name')
          .append(contrib.fullName)
          .on('click', this._toggleEditor)
      )

    if (this.state.editXML) {
      // Conforms to strict markup enforced by texture
      // for visual editing
      var EditorClass
      if (contrib.strict) {
        EditorClass = EditContrib
      } else {
        EditorClass = EditXML
      }

      el.append(
        $$(Modal, {
          width: 'medium'
        }).append(
          $$(EditorClass, contrib)
        )
      )
    }
    return el
  };

  ContribComponent.prototype._closeModal = function _closeModal () {
    this.setState({
      editXML: false
    })
  };

  ContribComponent.prototype._toggleEditor = function _toggleEditor () {
    this.setState({
      editXML: true
    })
  };

  return ContribComponent;
}(substance.Component));

var ContribConverter = {

  type: 'contrib',
  tagName: 'contrib',

  /*
    (label?, (citation-alternatives | element-citation | mixed-citation | nlm-citation | note | x)+)
  */
  import: function(el, node, converter) { // eslint-disable-line
    node.xmlContent = el.innerHTML
  },

  export: function(node, el, converter) { // eslint-disable-line
    el.innerHTML = node.xmlContent
  }
}

var ContribPackage = {
  name: 'contrib',
  configure: function(config) {
    config.addNode(Contrib)
    config.addComponent(Contrib.type, ContribComponent)
    config.addConverter('jats', ContribConverter)
  }
}

var ContribGroup = (function (Container$$1) {
  function ContribGroup () {
    Container$$1.apply(this, arguments);
  }if ( Container$$1 ) ContribGroup.__proto__ = Container$$1;
  ContribGroup.prototype = Object.create( Container$$1 && Container$$1.prototype );
  ContribGroup.prototype.constructor = ContribGroup;

  

  return ContribGroup;
}(substance.Container));

ContribGroup.type = "contrib-group"

ContribGroup.define({
  attributes: { type: 'object', default: {} },
  nodes: { type: ['id'], default: [] }
})

var CONTRIB_GROUP = ['contrib', 'address', 'aff', 'aff-alternatives', 'author-comment', 'bio', 'email', 'etal', 'ext-link', 'fn', 'on-behalf-of', 'role', 'uri', 'xref', 'x']

var ContribGroupConverter = {

  type: 'contrib-group',
  tagName: 'contrib-group',

  import: function(el, node, converter) {
    // node.id = 'contrib-group'; // there is only be one body element
    node.xmlAttributes = el.getAttributes()

    var children = el.getChildren()
    var iterator = new XMLIterator(children)

    iterator.oneOrMoreOf(CONTRIB_GROUP, function(child) {
      node.nodes.push(converter.convertElement(child).id)
    })
    if (iterator.hasNext()) { throw new Error('Illegal JATS: ' + el.outerHTML) }
  },

  export: function(node, el, converter) {
    el.attr(node.xmlAttributes)
    el.append(converter.convertNodes(node.nodes))
    if (node.sigBlock) {
      el.append(converter.convertNode(node.sigBlock))
    }
  }

}

var ContribGroupComponent = (function (Component$$1) {
  function ContribGroupComponent () {
    Component$$1.apply(this, arguments);
  }

  if ( Component$$1 ) ContribGroupComponent.__proto__ = Component$$1;
  ContribGroupComponent.prototype = Object.create( Component$$1 && Component$$1.prototype );
  ContribGroupComponent.prototype.constructor = ContribGroupComponent;

  ContribGroupComponent.prototype.didMount = function didMount () {
    Component$$1.prototype.didMount.call(this)
    var node = this.props.node
    node.on('nodes:changed', this.rerender, this)
  };

  ContribGroupComponent.prototype.dispose = function dispose () {
    Component$$1.prototype.dispose.call(this)
    var node = this.props.node
    node.off(this)
  };

  ContribGroupComponent.prototype.render = function render ($$) {
    var node = this.props.node
    var doc = node.getDocument()

    var el = $$('div')
      .addClass('sc-contrib-group')
      .attr('data-id', this.props.node.id)

    var children = node.nodes
    children.forEach(function(nodeId) {
      var childNode = doc.get(nodeId)
      if (childNode.type !== 'unsupported') {
        el.append(
          renderNodeComponent(this, $$, childNode, {
            disabled: this.props.disabled
          })
        )
      }
    }.bind(this))

    // el.append($$('button').addClass('se-add-author').append('Add Author'));
    return el
  };

  return ContribGroupComponent;
}(substance.Component));

var ContribGroupPackage = {
  name: 'contrib-group',
  configure: function(config) {
    config.addNode(ContribGroup)
    config.addConverter('jats', ContribGroupConverter)
    config.addComponent(ContribGroup.type, ContribGroupComponent)
  }
}

/*
  Back matter

  Material published with an article but following the narrative flow.
*/
var Back = (function (Container$$1) {
  function Back () {
    Container$$1.apply(this, arguments);
  }if ( Container$$1 ) Back.__proto__ = Container$$1;
  Back.prototype = Object.create( Container$$1 && Container$$1.prototype );
  Back.prototype.constructor = Back;

  

  return Back;
}(substance.Container));

Back.type = 'back'

/*
  Attributes
    id Document Internal Identifier
    xml:base Base

  Content
    (label?, title*, (ack | app-group | bio | fn-group | glossary | ref-list | notes | sec)*)
*/

Back.define({
  attributes: { type: 'object', default: {} },
  label: { type: 'label', optional:true },
  titles: { type: ['title'], default: [] },
  nodes: { type: ['id'], default: [] }
})

var BACK_CONTENT = ["ack", "app-group", "bio", "fn-group", "glossary", "ref-list", "notes", "sec"]

var BackConverter = {

  type: 'back',
  tagName: 'back',

  /*
    Content:
      label?, title*,
      (ack | app-group | bio | fn-group | glossary | ref-list | notes | sec)*
  */

  import: function(el, node, converter) {
    node.id = 'back' // There can only be one back item
    var iterator = new XMLIterator(el.getChildren())
    iterator.optional('label', function(child) {
      node.label = converter.convertElement(child).id
    });
    iterator.manyOf('title', function(child) {
      node.titles.push(converter.convertElement(child).id)
    });
    iterator.manyOf(BACK_CONTENT, function(child) {
      node.nodes.push(converter.convertElement(child).id)
    });
    if (iterator.hasNext()) { throw new Error('Illegal JATS: ' + el.outerHTML) }
  },

  export: function(node, el, converter) {
    if(node.label) {
      el.append(converter.convertNode(node.label))
    }
    node.titles.forEach(function(nodeId) {
      el.append(converter.convertNode(nodeId))
    });
    node.nodes.forEach(function(nodeId) {
      el.append(converter.convertNode(nodeId))
    });
  }
}

var BackComponent = (function (Component$$1) {
  function BackComponent () {
    Component$$1.apply(this, arguments);
  }

  if ( Component$$1 ) BackComponent.__proto__ = Component$$1;
  BackComponent.prototype = Object.create( Component$$1 && Component$$1.prototype );
  BackComponent.prototype.constructor = BackComponent;

  BackComponent.prototype.render = function render ($$) {
    var node = this.props.node
    var doc = node.getDocument()

    var el = $$('div')
      .addClass('sc-back')
      .attr('data-id', this.props.node.id)

    // Ref elements
    var children = node.nodes
    children.forEach(function(nodeId) {
      var childNode = doc.get(nodeId)
      if (childNode.type !== 'unsupported') {
        el.append(
          renderNodeComponent(this, $$, childNode, {
            disabled: this.props.disabled
          })
        );
      } else {
        console.info(childNode.type+ ' inside <back> currently not supported by the editor.')
      }
    }.bind(this))

    return el
  };

  return BackComponent;
}(substance.Component));

var BackPackage = {
  name: 'back',
  configure: function(config) {
    config.addNode(Back)
    config.addConverter('jats', BackConverter)
    config.addComponent(Back.type, BackComponent)
  }
}

var Body = (function (Container$$1) {
  function Body () {
    Container$$1.apply(this, arguments);
  }if ( Container$$1 ) Body.__proto__ = Container$$1;
  Body.prototype = Object.create( Container$$1 && Container$$1.prototype );
  Body.prototype.constructor = Body;

  

  return Body;
}(substance.Container));

Body.type = "body"

/*
  Content
   (address | alternatives | array | boxed-text | chem-struct-wrap | code | fig | fig-group | graphic | media | preformat | supplementary-material | table-wrap | table-wrap-group | disp-formula | disp-formula-group | def-list | list | tex-math | mml:math | p | related-article | related-object | ack | disp-quote | speech | statement | verse-group | x)*,
   (sec)*,
   sig-block?
*/

Body.define({
  attributes: { type: 'object', default: {} },
  nodes: { type: ['id'], default: [] },
  sigBlock: { type: ['sig-block'], optional: true }
})

var BodyConverter = {

  type: 'body',
  tagName: 'body',

  /*
    Attributes
      id Document Internal Identifier
      specific-use Specific Use
      xml:base Base

    Content
      %para_level*,
      (sec)*,
      sig-block?
  */

  import: function(el, node, converter) {
    node.id = 'body' // there is only be one body element
    node.xmlAttributes = el.getAttributes()

    var children = el.getChildren()
    var iterator = new XMLIterator(children)
    iterator.manyOf(JATS.PARA_LEVEL, function(child) {
      node.nodes.push(converter.convertElement(child).id)
    })
    iterator.manyOf('sec', function(child) {
      node.nodes.push(converter.convertElement(child).id)
    })
    iterator.optional('sig-block', function(child) {
      node.sigBlock = converter.convertElement(child).id
    })
    if (iterator.hasNext()) { throw new Error('Illegal JATS: ' + el.outerHTML) }
  },

  export: function(node, el, converter) {
    el.attr(node.xmlAttributes)
    el.append(converter.convertNodes(node.nodes))
    if (node.sigBlock) {
      el.append(converter.convertNode(node.sigBlock))
    }
  }

}

var BodyComponent = (function (Component$$1) {
  function BodyComponent () {
    Component$$1.apply(this, arguments);
  }

  if ( Component$$1 ) BodyComponent.__proto__ = Component$$1;
  BodyComponent.prototype = Object.create( Component$$1 && Component$$1.prototype );
  BodyComponent.prototype.constructor = BodyComponent;

  BodyComponent.prototype.render = function render ($$) {
    var node = this.props.node
    var configurator = this.props.configurator
    var el = $$('div')
      .addClass('sc-body')
      .attr('data-id', this.props.node.id)

    el.append(
      $$(substance.ContainerEditor, {
        disabled: this.props.disabled,
        node: node,
        commands: configurator.getSurfaceCommandNames(),
        textTypes: configurator.getTextTypes()
      }).ref('body')
    )
    return el
  };

  return BodyComponent;
}(substance.Component));

var BodyPackage = {
  name: 'body',
  configure: function(config) {
    config.addNode(Body)
    config.addConverter('jats', BodyConverter)
    config.addComponent(Body.type, BodyComponent)
  }
}

var Bold = (function (Annotation$$1) {
  function Bold () {
    Annotation$$1.apply(this, arguments);
  }if ( Annotation$$1 ) Bold.__proto__ = Annotation$$1;
  Bold.prototype = Object.create( Annotation$$1 && Annotation$$1.prototype );
  Bold.prototype.constructor = Bold;

  

  return Bold;
}(substance.Annotation));

Bold.type = 'bold'

Bold.define({
  attributes: { type: 'object', default: {} }
})

var BoldConverter = {
  type: 'bold',
  tagName: 'bold'
}

var BoldTool = (function (AnnotationTool$$1) {
	function BoldTool () {
		AnnotationTool$$1.apply(this, arguments);
	}if ( AnnotationTool$$1 ) BoldTool.__proto__ = AnnotationTool$$1;
	BoldTool.prototype = Object.create( AnnotationTool$$1 && AnnotationTool$$1.prototype );
	BoldTool.prototype.constructor = BoldTool;

	

	return BoldTool;
}(substance.AnnotationTool));

var BoldCommand = (function (AnnotationCommand$$1) {
	function BoldCommand () {
		AnnotationCommand$$1.apply(this, arguments);
	}if ( AnnotationCommand$$1 ) BoldCommand.__proto__ = AnnotationCommand$$1;
	BoldCommand.prototype = Object.create( AnnotationCommand$$1 && AnnotationCommand$$1.prototype );
	BoldCommand.prototype.constructor = BoldCommand;

	

	return BoldCommand;
}(substance.AnnotationCommand));

var BoldPackage = {
  name: 'bold',
  configure: function(config) {
    config.addNode(Bold)
    config.addConverter('jats', BoldConverter)
    config.addCommand(Bold.type, BoldCommand, { nodeType: Bold.type })
    config.addTool(Bold.type, BoldTool, {target: 'annotations'})
    config.addIcon(Bold.type, { 'fontawesome': 'fa-bold' })
    config.addLabel(Bold.type, {
      en: 'Bold'
    })
  }
}

var Caption = (function (Container$$1) {
  function Caption () {
    Container$$1.apply(this, arguments);
  }

  if ( Container$$1 ) Caption.__proto__ = Container$$1;
  Caption.prototype = Object.create( Container$$1 && Container$$1.prototype );
  Caption.prototype.constructor = Caption;

  Caption.prototype.getTitle = function getTitle () {
    var doc = this.getDocument();
    if (doc) {
      return doc.get(this.title);
    }
  };

  return Caption;
}(substance.Container));

Caption.type = 'caption'

/*
  Attributes
    content-type Type of Content
    id Document Internal Identifier
    specific-use Specific Use
    style Style (NISO JATS table model; MathML Tag Set)
    xml:base Base
    xml:lang Language

  Content
    ( title?, (p)* )
*/
Caption.define({
  attributes: { type: 'object', default: {} },
  title: { type: 'title', optional: true },
  nodes: { type: ['p'], default: [] }
})

var CaptionComponent = (function (Component$$1) {
  function CaptionComponent () {
    Component$$1.apply(this, arguments);
  }

  if ( Component$$1 ) CaptionComponent.__proto__ = Component$$1;
  CaptionComponent.prototype = Object.create( Component$$1 && Component$$1.prototype );
  CaptionComponent.prototype.constructor = CaptionComponent;

  CaptionComponent.prototype.render = function render ($$) {
    var node = this.props.node
    var doc = node.getDocument()

    var el = $$('div')
      .addClass('sc-caption')
      .attr('data-id', node.id)

    if (node.title) {
      var title = doc.get(node.title);
      el.append($$(substance.TextPropertyEditor, {
        disabled: this.props.disabled,
        path: title.getTextPath()
      })).ref('title')
    }

    var contentEl = $$('div').addClass('se-content')
    var contentEditor = $$(substance.ContainerEditor, {
      disabled: this.props.disabled,
      node: node
    }).ref('content')
    contentEl.append(contentEditor)
    el.append(contentEl)

    return el
  };

  return CaptionComponent;
}(substance.Component));

var CaptionConverter = {

  type: 'caption',
  tagName: 'caption',

  /*
    Attributes
    content-type Type of Content
    id Document Internal Identifier
    specific-use Specific Use
    style Style (NISO JATS table model; MathML Tag Set)
    xml:base Base
    xml:lang Language

    Content
      ( title?, (p)* )
  */

  import: function(el, node, converter) {
    node.xmlAttributes = el.getAttributes()

    var children = el.getChildren()
    var iterator = new XMLIterator(children)
    // title is just annotated text
    iterator.optional('title', function(childEl) {
      node.title = converter.convertElement(childEl).id
    })
    iterator.manyOf('p', function(childEl) {
      node.nodes.push(converter.convertElement(childEl).id)
    })
    if (iterator.hasNext()) {
      throw new Error('Invalid JATS:' + el.outerHTML)
    }
  },

  export: function(node, el, converter) {
    el.attr(node.xmlAttributes)
    if (node.title) { el.append(converter.convertNode(node.title)) }
    el.append(converter.convertNodes(node.nodes))
  }

}

var CaptionPackage = {
  name: 'caption',
  configure: function(config) {
    config.addNode(Caption)
    config.addComponent(Caption.type, CaptionComponent)
    config.addConverter('jats', CaptionConverter)
  }
}

var ExtLink = (function (Annotation$$1) {
  function ExtLink () {
    Annotation$$1.apply(this, arguments);
  }if ( Annotation$$1 ) ExtLink.__proto__ = Annotation$$1;
  ExtLink.prototype = Object.create( Annotation$$1 && Annotation$$1.prototype );
  ExtLink.prototype.constructor = ExtLink;

  

  return ExtLink;
}(substance.Annotation));

ExtLink.type = 'ext-link'

ExtLink.define({
  attributes: {
    type: 'object', default: {'xlink:href': ''}
  }
})

// in presence of overlapping annotations will try to render this as one element
ExtLink.fragmentation = substance.Fragmenter.SHOULD_NOT_SPLIT

var ExtLinkConverter = {

  type: "ext-link",
  tagName: "ext-link",

  /*
    Attributes
    assigning-authority Authority Responsible for an Identifier
    ext-link-type Type of External Link
    id Document Internal Identifier
    specific-use Specific Use
    xlink:actuate Actuating the Link
    xlink:href Href (Linking Mechanism)
    xlink:role Role of the Link
    xlink:show Showing the Link
    xlink:title Title of the Link
    xlink:type Type of Link
    xml:base Base
    xml:lang Language
    xmlns:xlink XLink Namespace Declaration

    Content
    (#PCDATA | email | ext-link | uri | inline-supplementary-material |
      related-article | related-object | hr | bold | fixed-case | italic |
      monospace | overline | overline-start | overline-end | roman | sans-serif
      | sc | strike | underline | underline-start | underline-end | ruby |
      alternatives | inline-graphic | private-char | chem-struct | inline-formula |
      tex-math | mml:math | abbrev | milestone-end | milestone-start | named-content |
      styled-content | fn | target | xref | sub | sup | x)*
  */
}

var ExtLinkComponent = (function (AnnotationComponent$$1) {
  function ExtLinkComponent () {
    AnnotationComponent$$1.apply(this, arguments);
  }

  if ( AnnotationComponent$$1 ) ExtLinkComponent.__proto__ = AnnotationComponent$$1;
  ExtLinkComponent.prototype = Object.create( AnnotationComponent$$1 && AnnotationComponent$$1.prototype );
  ExtLinkComponent.prototype.constructor = ExtLinkComponent;

  ExtLinkComponent.prototype.didMount = function didMount () {
    AnnotationComponent$$1.prototype.didMount.apply(this, arguments)

    var node = this.props.node
    node.on('properties:changed', this.rerender, this)
  };

  ExtLinkComponent.prototype.dispose = function dispose () {
    AnnotationComponent$$1.prototype.dispose.apply(this, arguments)

    var node = this.props.node
    node.off(this)
  };

  ExtLinkComponent.prototype.render = function render ($$) { // eslint-disable-line
    var node = this.props.node;
    var el = AnnotationComponent$$1.prototype.render.apply(this, arguments)

    el.tagName = 'a'
    el.attr('href', node.attributes['xlink:href'])

    return el
  };

  return ExtLinkComponent;
}(substance.AnnotationComponent));

var ExtLinkTool = (function (AnnotationTool$$1) {
	function ExtLinkTool () {
		AnnotationTool$$1.apply(this, arguments);
	}if ( AnnotationTool$$1 ) ExtLinkTool.__proto__ = AnnotationTool$$1;
	ExtLinkTool.prototype = Object.create( AnnotationTool$$1 && AnnotationTool$$1.prototype );
	ExtLinkTool.prototype.constructor = ExtLinkTool;

	

	return ExtLinkTool;
}(substance.AnnotationTool));

var EditExtLinkTool = (function (EditLinkTool$$1) {
	function EditExtLinkTool () {
		EditLinkTool$$1.apply(this, arguments);
	}if ( EditLinkTool$$1 ) EditExtLinkTool.__proto__ = EditLinkTool$$1;
	EditExtLinkTool.prototype = Object.create( EditLinkTool$$1 && EditLinkTool$$1.prototype );
	EditExtLinkTool.prototype.constructor = EditExtLinkTool;

	

	return EditExtLinkTool;
}(substance.EditLinkTool));

EditExtLinkTool.urlPropertyPath = ['attributes', 'xlink:href']

// import EditExtLinkCommand from './EditExtLinkCommand'
var ExtLinkPackage = {
  name: 'ext-link',
  configure: function(config) {
    config.addNode(ExtLink)
    config.addConverter('jats', ExtLinkConverter)
    config.addComponent(ExtLink.type, ExtLinkComponent)

    config.addCommand(ExtLink.type, substance.LinkCommand, {nodeType: ExtLink.type})
    config.addCommand('edit-ext-link', substance.EditAnnotationCommand, {nodeType: ExtLink.type})
    config.addTool(ExtLink.type, ExtLinkTool, {target: 'annotations'})
    config.addTool('edit-ext-link', EditExtLinkTool, { target: 'overlay' })
    config.addIcon(ExtLink.type, { 'fontawesome': 'fa-link'})
    config.addIcon('open-link', { 'fontawesome': 'fa-external-link' })
    config.addLabel(ExtLink.type, {
      en: 'Link'
    })
    config.addLabel('open-link', {
      en: 'Open Link',
      de: 'Link öffnen'
    })
    config.addLabel('delete-link', {
      en: 'Remove Link',
      de: 'Link löschen'
    })
  }
}

var Figure = (function (DocumentNode$$1) {
  function Figure () {
    DocumentNode$$1.apply(this, arguments);
  }if ( DocumentNode$$1 ) Figure.__proto__ = DocumentNode$$1;
  Figure.prototype = Object.create( DocumentNode$$1 && DocumentNode$$1.prototype );
  Figure.prototype.constructor = Figure;

  

  return Figure;
}(substance.DocumentNode));

Figure.type = 'figure'

/*
  Attribute
    fig-type Type of Figure
    id Document Internal Identifier
    orientation Orientation
    position Position
    specific-use Specific Use
    xml:base Base
    xml:lang Language

  Content
    (
      (object-id)*,
      label?, (caption)*, (abstract)*, (kwd-group)*,
      (alt-text | long-desc | email | ext-link | uri)*,
      (disp-formula | disp-formula-group | chem-struct-wrap | disp-quote | speech |
        statement | verse-group | table-wrap | p | def-list | list | alternatives |
        array | code | graphic | media | preformat)*,
      (attrib | permissions)*
    )
*/
Figure.define({
  attributes: { type: 'object', default: {} },
  objectIds: { type: ['string'], default: [] },
  label: { type: 'label', optional: true },
  captions: { type: ['caption'], default: [] },
  abstracts: { type: ['abstract'], default: [] },
  kwdGroups: { type: ['kwd-group'], default: [] },
  altTexts: { type: ['alt-text'], default: [] },
  longDescs: { type: ['long-desc'], default: [] },
  emails: { type: ['email'], default: [] },
  extLinks: { type: ['ext-link'], default: [] },
  uris: { type: ['uri'], default: [] },
  contentNodes: { type: ['id'], default: [] },
  attribs: { type: ['attrib'], default: [] },
  permissions: { type: ['permissions'], default: [] }
})

var FigureComponent = (function (Component$$1) {
  function FigureComponent () {
    Component$$1.apply(this, arguments);
  }

  if ( Component$$1 ) FigureComponent.__proto__ = Component$$1;
  FigureComponent.prototype = Object.create( Component$$1 && Component$$1.prototype );
  FigureComponent.prototype.constructor = FigureComponent;

  FigureComponent.prototype.render = function render ($$) {
    var node = this.props.node
    var doc = node.getDocument()
    var el = $$('div')
      .addClass('sc-figure')
      .attr('data-id', this.props.node.id)

    if (node.label) {
      var label = doc.get(node.label)
      el.append(
        renderNodeComponent(this, $$, label, {
          disabled: this.props.disabled
        }).ref('label')
      )
    }

    // Display figure content
    node.contentNodes.forEach(function(nodeId) {
      var childNode = doc.get(nodeId)
      el.append(
        renderNodeComponent(this, $$, childNode, {
          disabled: this.props.disabled
        })
      )
    }.bind(this))

    // Display Captions
    node.captions.forEach(function(nodeId) {
      var captionNode = doc.get(nodeId)
      el.append(
        renderNodeComponent(this, $$, captionNode, {
          disabled: this.props.disabled
        }).ref('caption')
      )
    }.bind(this))

    // TODO: we should provide a UI to the rest of the node's content
    // in an overlay
    return el
  };

  return FigureComponent;
}(substance.Component));

/*
  Renders a keyboard-selectable figure target item
*/
var FigureTarget = (function (Component$$1) {
  function FigureTarget () {
    Component$$1.apply(this, arguments);
  }

  if ( Component$$1 ) FigureTarget.__proto__ = Component$$1;
  FigureTarget.prototype = Object.create( Component$$1 && Component$$1.prototype );
  FigureTarget.prototype.constructor = FigureTarget;

  FigureTarget.prototype.render = function render ($$) {
    var node = this.props.node
    var doc = node.getDocument()
    var el = $$('div')
      .addClass('sc-figure-target')
      .attr({'data-id': node.id})

    if (this.props.selected) {
      el.addClass('sm-selected')
    }

    // Render thumbnail
    el.append(
      this._renderThumb($$)
    )

    if (node.label) {
      var label = doc.get(node.label)
      el.append(
        renderNodeComponent(this, $$, label, {
          disabled: this.props.disabled
        })
      )
    }

    // Render first caption
    // TODO: Is there a way to cut off the caption to have a more compact view?
    var firstCaption = node.captions[0]

    if (firstCaption) {
      firstCaption = doc.get(firstCaption)
      el.append(
        renderNodeComponent(this, $$, firstCaption, {
          disabled: this.props.disabled
        })
      )
    }
    return el
  };

  /*
    Render thumbnail based on the contents of the figure
  */
  FigureTarget.prototype._renderThumb = function _renderThumb ($$) {
    // For now we just pick the first content node (e.g. a graphic or a table)
    var node = this.props.node
    var doc = node.getDocument()
    var firstContentNode = node.contentNodes[0]
    var el = $$('div').addClass('se-thumbnail')

    if (firstContentNode) {
      firstContentNode = doc.get(firstContentNode)
      el.append(renderNodeComponent(this, $$, firstContentNode))
    } else {
      el.append('No thumb')
    }
    return el
  };

  return FigureTarget;
}(substance.Component));

var ACCESS_OR_LINK = JATS.ACCESS.concat(JATS.ADDRESS_LINK)
var FIGURE_CONTENT = JATS.BLOCK_MATH
  .concat(JATS.CHEM_STRUCT)
  .concat(JATS.INTABLE_PARA)
  .concat(JATS.JUST_TABLE)
  .concat(JATS.JUST_PARA)
  .concat(JATS.LIST)
  .concat(JATS.SIMPLE_DISPLAY)

var FigureConverter = {

  type: 'figure',
  tagName: 'fig',

  /*
    Spec: http://jats.nlm.nih.gov/archiving/tag-library/1.1/element/fig.html

    Attributes
      fig-type Type of Figure
      id Document Internal Identifier
      orientation Orientation
      position Position
      specific-use Specific Use
      xml:base Base
      xml:lang Language

    Content
    (
      (object-id)*,
      label?, (caption)*, (abstract)*, (kwd-group)*,
      (alt-text | long-desc | email | ext-link | uri)*,
      (disp-formula | disp-formula-group | chem-struct-wrap | disp-quote | speech |
        statement | verse-group | table-wrap | p | def-list | list | alternatives |
        array | code | graphic | media | preformat)*,
      (attrib | permissions)*
    )
  */

  import: function(el, node, converter) {
    var iterator = new XMLIterator(el.getChildren())
    iterator.manyOf('object-id', function(child) {
      node.objectIds.push(child.textContent)
    })
    iterator.optional('label', function(child) {
      node.label = converter.convertElement(child).id
    })
    iterator.manyOf('caption', function(child) {
      node.captions.push(converter.convertElement(child).id)
    })
    iterator.manyOf('abstract', function(child) {
      node.abstracts.push(converter.convertElement(child).id)
    })
    iterator.manyOf('kwd-group', function(child) {
      node.kwdGroups.push(converter.convertElement(child).id)
    })
    iterator.manyOf(ACCESS_OR_LINK, function(child) {
      var childNode = converter.convertElement(child)
      switch(child.tagName) {
        case "alt-text":
          node.altTexts.push(childNode.id)
          break
        case "long-desc":
          node.longDescs.push(childNode.id)
          break
        case "ext-link":
          node.extLinks.push(childNode.id)
          break
        case "uri":
          node.uris.push(childNode.id)
          break
        case "email":
          node.emails.push(childNode.id)
          break
        default:
          //nothing
      }
    })
    iterator.manyOf(FIGURE_CONTENT, function(child) {
      node.contentNodes.push(converter.convertElement(child).id)
    })
    iterator.manyOf(JATS.DISLAY_BACK_MATTER, function(child) {
      var childNode = converter.convertElement(child)
      switch(child.tagName) {
        case "attrib":
          node.attribs.push(childNode.id)
          break
        case "permissions":
          node.permissions.push(childNode.id)
          break
        default:
          //nothing
      }
    })
    if (iterator.hasNext()) {
      throw new Error('Illegal JATS: ' + el.outerHTML)
    }
  },

  export: function(node, el, converter) {
    var $$ = converter.$$
    node.objectIds.forEach(function(objectId) {
      el.append($$('object-id').text(objectId))
    })
    if (node.label) {
      el.append(converter.convertNode(node.label))
    }
    el.append(converter.convertNodes(node.captions))
    el.append(converter.convertNodes(node.abstracts))
    el.append(converter.convertNodes(node.kwdGroups))
    if (node.altTexts) {
      el.append(converter.convertNodes(node.altTexts))
    }
    if (node.longDescs) {
      el.append(converter.convertNodes(node.longDescs))
    }
    if (node.extLinks) {
      el.append(converter.convertNodes(node.extLinks))
    }
    if (node.uris) {
      el.append(converter.convertNodes(node.uris))
    }
    if (node.emails) {
      el.append(converter.convertNodes(node.emails))
    }
    el.append(converter.convertNodes(node.contentNodes))
    el.append(converter.convertNodes(node.attribs))
    el.append(converter.convertNodes(node.permissions))
  }
}

var FigurePackage = {
  name: 'figure',
  configure: function(config) {
    config.addNode(Figure)
    config.addComponent(Figure.type, FigureComponent)
    config.addComponent(Figure.type+'-target', FigureTarget)
    config.addConverter('jats', FigureConverter)
  }
}

var Footnote = (function (Container$$1) {
  function Footnote () {
    Container$$1.apply(this, arguments);
  }if ( Container$$1 ) Footnote.__proto__ = Container$$1;
  Footnote.prototype = Object.create( Container$$1 && Container$$1.prototype );
  Footnote.prototype.constructor = Footnote;

  

  return Footnote;
}(substance.Container));

Footnote.type = 'footnote'

/*
  Content
    (label?, p+)
*/
Footnote.define({
  attributes: { type: 'object', default: {} },
  label: { type: 'label', optional: true },
  nodes: { type: ['p'], default: [] }
})

var FootnoteComponent = (function (Component$$1) {
  function FootnoteComponent () {
    Component$$1.apply(this, arguments);
  }

  if ( Component$$1 ) FootnoteComponent.__proto__ = Component$$1;
  FootnoteComponent.prototype = Object.create( Component$$1 && Component$$1.prototype );
  FootnoteComponent.prototype.constructor = FootnoteComponent;

  FootnoteComponent.prototype.render = function render ($$) {
    var node = this.props.node
    var doc = node.getDocument()

    var el = $$('div')
      .addClass('sc-footnote')
      .attr('data-id', this.props.node.id)

    if (node.label) {
      var label = doc.get(node.label)
      el.append($$(substance.TextPropertyComponent, {
        path: label.getTextPath()
      }))
    }
    // TODO: what if no label is present?

    this.props.node.nodes.forEach(function(nodeId) {
      var childNode = doc.get(nodeId)
      el.append(
        renderNodeComponent(this, $$, childNode, {
          disabled: this.props.disabled
        })
      );
    }.bind(this))

    return el
  };

  return FootnoteComponent;
}(substance.Component));

var FootnoteConverter = {

  type: 'footnote',
  tagName: 'fn',
  /*
    Attributes
      fn-type Type of Footnote
      id Document Internal Identifier
      specific-use Specific Use
      symbol Symbol
      xml:base Base
      xml:lang Language

    Content
      (label?, (p)+)
  */

  import: function(el, node, converter) {
    var iterator = new XMLIterator(el.getChildren())
    iterator.optional('label', function(child) {
      node.label = converter.convertElement(child).id
    })
    iterator.oneOrMoreOf('p', function(child) {
      node.nodes.push(converter.convertElement(child).id)
    })
    if (iterator.hasNext()) { throw new Error('Illegal JATS: ' + el.outerHTML) }
  },

  export: function(node, el, converter) {
    if (node.label) {
      el.append(converter.convertNode(node.label))
    }
    el.append(converter.convertNodes(node.nodes))
  }

}

var FootnotePackage = {
  name: 'footnote',
  configure: function(config) {
    config.addNode(Footnote);
    config.addComponent(Footnote.type, FootnoteComponent)
    config.addConverter('jats', FootnoteConverter)
  }
}

var Front = (function (Container$$1) {
  function Front () {
    Container$$1.apply(this, arguments);
  }if ( Container$$1 ) Front.__proto__ = Container$$1;
  Front.prototype = Object.create( Container$$1 && Container$$1.prototype );
  Front.prototype.constructor = Front;

  

  return Front;
}(substance.Container));

Front.type = "front"

/*
  Content
    (
      journal-meta?, article-meta,
      (def-list | list | ack | bio | fn-group | glossary | notes)*
    )
*/

Front.define({
  attributes: { type: 'object', default: {} },
  journalMeta: { type: 'journal-meta', optional: true },
  articleMeta: { type: 'article-meta' },
  nodes: { type: ['id'], default: [] }
})

var FRONT_CONTENT = ['def-list', 'list', 'ack', 'bio', 'fn-group', 'glossary', 'notes']

var FrontConverter = {

  type: 'front',
  tagName: 'front',

  /*
    Attributes
      id Document Internal Identifier
      xml:base Base
    Content
      (
        journal-meta?, article-meta,
        (def-list | list | ack | bio | fn-group | glossary | notes)*
      )
  */

  import: function(el, node, converter) {
    node.id = 'front'; // there is only one <front> element
    var iterator = new XMLIterator(el.getChildren())
    iterator.optional('journal-meta', function(child) {
      node.journalMeta = converter.convertElement(child).id
    })
    iterator.required('article-meta', function(child) {
      node.articleMeta = converter.convertElement(child).id
    })
    iterator.manyOf(FRONT_CONTENT, function(child) {
      node.nodes.push(converter.convertElement(child).id)
    })
    if (iterator.hasNext()) { throw new Error('Illegal JATS: ' + el.outerHTML) }
  },

  export: function(node, el, converter) {
    if (node.journalMeta) {
      el.append(converter.convertNode(node.journalMeta))
    }
    el.append(converter.convertNode(node.articleMeta))
    el.append(converter.convertNodes(node.nodes))
  }
}

var FrontComponent = (function (Component$$1) {
  function FrontComponent () {
    Component$$1.apply(this, arguments);
  }

  if ( Component$$1 ) FrontComponent.__proto__ = Component$$1;
  FrontComponent.prototype = Object.create( Component$$1 && Component$$1.prototype );
  FrontComponent.prototype.constructor = FrontComponent;

  FrontComponent.prototype.render = function render ($$) {
    var node = this.props.node
    var doc = node.getDocument()

    var el = $$('div')
      .addClass('sc-front')
      .attr('data-id', this.props.node.id)

    // Render articlemeta
    var articleMeta = doc.get(node.articleMeta)

    el.append(
      renderNodeComponent(this, $$, articleMeta, {
        disabled: this.props.disabled
      })
    )

    return el
  };

  return FrontComponent;
}(substance.Component));

var FrontPackage = {
  name: 'front',
  configure: function(config) {
    config.addNode(Front)
    config.addConverter('jats', FrontConverter)
    config.addComponent(Front.type, FrontComponent)
  }
}

var Graphic = (function (Container$$1) {
  function Graphic () {
    Container$$1.apply(this, arguments);
  }

  if ( Container$$1 ) Graphic.__proto__ = Container$$1;
  Graphic.prototype = Object.create( Container$$1 && Container$$1.prototype );
  Graphic.prototype.constructor = Graphic;

  Graphic.prototype.getHref = function getHref () {
    return this.attributes['xlink:href']
  };

  return Graphic;
}(substance.Container));

Graphic.type = 'graphic'

Graphic.define({
  attributes: { type: 'object', default: {} }
})

var GraphicComponent = (function (Component$$1) {
  function GraphicComponent () {
    Component$$1.apply(this, arguments);
  }

  if ( Component$$1 ) GraphicComponent.__proto__ = Component$$1;
  GraphicComponent.prototype = Object.create( Component$$1 && Component$$1.prototype );
  GraphicComponent.prototype.constructor = GraphicComponent;

  GraphicComponent.prototype.render = function render ($$) {
    var node = this.props.node
    var el = $$('div')
      .addClass('sc-graphic')
      .attr('data-id', node.id)
    el.append(
      $$('img').attr({
        src: node.getHref()
      })
    )
    return el
  };

  return GraphicComponent;
}(substance.Component));

var GRAPHIC_ELEMENTS = JATS.ACCESS
    .concat(JATS.ADDRESS_LINK)
    .concat(['caption', 'object-id', 'kwd-group', 'label'])
    .concat(JATS.DISPLAY_BACK_MATTER)

var GraphicConverter = {

  type: 'graphic',
  tagName: 'graphic',

  /*
    Attributes
    content-type Type of Content
    id Document Internal Identifier
    mime-subtype Mime Subtype
    mimetype Mime Type
    orientation Orientation
    position Position
    specific-use Specific Use
    xlink:actuate Actuating the Link
    xlink:href Href (Linking Mechanism)
    xlink:role Role of the Link
    xlink:show Showing the Link
    xlink:title Title of the Link
    xlink:type Type of Link
    xml:base Base
    xml:lang Language
    xmlns:xlink XLink Namespace Declaration

    Content
    (
      alt-text | long-desc | abstract | email | ext-link | uri | caption |
      object-id | kwd-group | label | attrib | permissions
    )*

  */

  import: function(el, node, converter) {
    var iterator = new XMLIterator(el.getChildren())
    iterator.manyOf(GRAPHIC_ELEMENTS, function(child) {
      node.nodes.push(converter.convertElement(child).id)
    })
    if (iterator.hasNext()) { throw new Error('Illegal JATS: ' + el.outerHTML) }
  },

  export: function(node, el, converter) {
    el.append(converter.convertNodes(node.nodes))
  }

}

var GraphicPackage = {
  name: 'graphic',
  configure: function(config) {
    config.addNode(Graphic)
    config.addComponent(Graphic.type, GraphicComponent)
    config.addConverter('jats', GraphicConverter)
  }
}

var Italic = (function (Annotation$$1) {
  function Italic () {
    Annotation$$1.apply(this, arguments);
  }if ( Annotation$$1 ) Italic.__proto__ = Annotation$$1;
  Italic.prototype = Object.create( Annotation$$1 && Annotation$$1.prototype );
  Italic.prototype.constructor = Italic;

  

  return Italic;
}(substance.Annotation));

Italic.type = 'italic'

Italic.define({
  attributes: { type: 'object', default: {} }
})

var ItalicConverter = {
  type: 'italic',
  tagName: 'italic'
}

var ItalicTool = (function (AnnotationTool$$1) {
	function ItalicTool () {
		AnnotationTool$$1.apply(this, arguments);
	}if ( AnnotationTool$$1 ) ItalicTool.__proto__ = AnnotationTool$$1;
	ItalicTool.prototype = Object.create( AnnotationTool$$1 && AnnotationTool$$1.prototype );
	ItalicTool.prototype.constructor = ItalicTool;

	

	return ItalicTool;
}(substance.AnnotationTool));

var ItalicCommand = (function (AnnotationCommand$$1) {
	function ItalicCommand () {
		AnnotationCommand$$1.apply(this, arguments);
	}if ( AnnotationCommand$$1 ) ItalicCommand.__proto__ = AnnotationCommand$$1;
	ItalicCommand.prototype = Object.create( AnnotationCommand$$1 && AnnotationCommand$$1.prototype );
	ItalicCommand.prototype.constructor = ItalicCommand;

	

	return ItalicCommand;
}(substance.AnnotationCommand));

var ItalicPackage = {
  name: 'italic',
  configure: function(config) {
    config.addNode(Italic)
    config.addConverter('jats', ItalicConverter)

    config.addCommand(Italic.type, ItalicCommand, { nodeType: Italic.type })
    config.addTool(Italic.type, ItalicTool, {target: 'annotations'})
    config.addIcon(Italic.type, { 'fontawesome': 'fa-italic' })
    config.addLabel(Italic.type, {
      en: 'Italic'
    })
  }
}

var Label = (function (TextNode$$1) {
  function Label () {
    TextNode$$1.apply(this, arguments);
  }if ( TextNode$$1 ) Label.__proto__ = TextNode$$1;
  Label.prototype = Object.create( TextNode$$1 && TextNode$$1.prototype );
  Label.prototype.constructor = Label;

  

  return Label;
}(substance.TextNode));

Label.type = 'label'

Label.define({
  attributes: { type: 'object', default: {} }
})

var LabelConverter = TextNodeConverter.extend({
  type: 'label',
  tagName: 'label'
})

var LabelComponent = (function (Component$$1) {
  function LabelComponent () {
    Component$$1.apply(this, arguments);
  }

  if ( Component$$1 ) LabelComponent.__proto__ = Component$$1;
  LabelComponent.prototype = Object.create( Component$$1 && Component$$1.prototype );
  LabelComponent.prototype.constructor = LabelComponent;

  LabelComponent.prototype.render = function render ($$) {
    var el = $$('div').addClass('sc-label')
    var node = this.props.node
    var labelEditor = $$(substance.TextPropertyEditor, {
      disabled: this.props.disabled,
      path: node.getTextPath()
    }).ref('labelEditor')
    el.append(labelEditor)
    return el
  };

  return LabelComponent;
}(substance.Component));

var LabelPackage = {
  name: 'label',
  configure: function(config) {
    config.addNode(Label)
    config.addComponent(Label.type, LabelComponent)
    config.addConverter('jats', LabelConverter)
  }
}

var Monospace = (function (Annotation$$1) {
  function Monospace () {
    Annotation$$1.apply(this, arguments);
  }if ( Annotation$$1 ) Monospace.__proto__ = Annotation$$1;
  Monospace.prototype = Object.create( Annotation$$1 && Annotation$$1.prototype );
  Monospace.prototype.constructor = Monospace;

  

  return Monospace;
}(substance.Annotation));

Monospace.type = 'monospace'

Monospace.define({
  attributes: { type: 'object', default: {} }
})

var MonospaceConverter = {
  type: 'monospace',
  tagName: 'monospace'
}

var MonospacePackage = {
  name: 'monospace',
  configure: function(config) {
    config.addNode(Monospace)
    config.addConverter('jats', MonospaceConverter)
  }
}

var ParagraphNode = (function (TextBlock$$1) {
  function ParagraphNode () {
    TextBlock$$1.apply(this, arguments);
  }if ( TextBlock$$1 ) ParagraphNode.__proto__ = TextBlock$$1;
  ParagraphNode.prototype = Object.create( TextBlock$$1 && TextBlock$$1.prototype );
  ParagraphNode.prototype.constructor = ParagraphNode;

  

  return ParagraphNode;
}(substance.TextBlock));

ParagraphNode.type = "paragraph"

ParagraphNode.define({
  attributes: { type: 'object', default: {} }
})

var ParagraphComponent = (function (TextBlockComponent$$1) {
  function ParagraphComponent () {
    TextBlockComponent$$1.apply(this, arguments);
  }

  if ( TextBlockComponent$$1 ) ParagraphComponent.__proto__ = TextBlockComponent$$1;
  ParagraphComponent.prototype = Object.create( TextBlockComponent$$1 && TextBlockComponent$$1.prototype );
  ParagraphComponent.prototype.constructor = ParagraphComponent;

  ParagraphComponent.prototype.getClassNames = function getClassNames () {
    return 'sc-paragraph'
  };

  return ParagraphComponent;
}(substance.TextBlockComponent));

var ParagraphConverter = TextNodeConverter.extend({
  type: 'paragraph',
  tagName: 'p'
})

var ParagraphPackage = {

  name: 'paragraph',

  configure: function(config) {
    config.addNode(ParagraphNode)
    config.addComponent(ParagraphNode.type, ParagraphComponent)
    config.addConverter('jats', ParagraphConverter)
    config.addTextType({
      name: ParagraphNode.type,
      data: {type: ParagraphNode.type}
    })
    config.addLabel(ParagraphNode.type, {
      en: 'Paragraph',
      de: 'Paragraph'
    })
    config.addLabel('paragraph.content', {
      en: 'Paragraph',
      de: 'Paragraph'
    })
  }
}

/*
  ref

  One item in a bibliographic list.
*/
var Ref = (function (DocumentNode$$1) {
  function Ref () {
    DocumentNode$$1.apply(this, arguments);
  }

  if ( DocumentNode$$1 ) Ref.__proto__ = DocumentNode$$1;
  Ref.prototype = Object.create( DocumentNode$$1 && DocumentNode$$1.prototype );
  Ref.prototype.constructor = Ref;

  Ref.prototype.isPlain = function isPlain () {
    // TODO:
  };

  /*
    Get parsed DOM version of XML content
  */
  Ref.prototype.getDOM = function getDOM () {
    return substance.DefaultDOMElement.parseXML(this.xmlContent)
  };

  return Ref;
}(substance.DocumentNode));

Ref.type = 'ref'

/*
  Content
  (label?, (citation-alternatives | element-citation | mixed-citation | nlm-citation | note | x)+)
*/
Ref.define({
  attributes: { type: 'object', default: {} },
  xmlContent: {type: 'string', default: ''}
})

/*
  TODO: Get rid of HTML renderer. Instead extract data as
  JSON and then pass it to a component for rendering
*/
var namesToHTML = function(ref) {
  var nameElements = ref.findAll('name')
  var nameEls = []
  for (var i = 0; i < nameElements.length; i++) {
    var name = nameElements[i]
    var nameEl = substance.DefaultDOMElement.createElement('span')
    nameEl.addClass('name')
    nameEl.text(name.find('surname').text() + ' ' + name.find('given-names').text())
    if (i > 0 && i < nameElements.length) {
      var comma = substance.DefaultDOMElement.createElement('span')
      comma.text(', ')
      nameEls.push(comma)
    }
    nameEls.push(nameEl)
  }
  return nameEls
}

var titleToHTML = function (ref) {
  var articleTitle = ref.find('article-title')
  var title = substance.DefaultDOMElement.createElement('div')
  title.addClass('title')

  if (articleTitle) {
    title.text(articleTitle.text() + '. ')
  } else {
    title.text('Untitled. ')
  }

  return title
}

var metaToHTML = function (ref) {

  // Example: "Cellular and Molecular Life Sciences, 70: 2657-2675, 2013"

  var meta = substance.DefaultDOMElement.createElement('div')

  meta.addClass('meta')

  var metaText = ''

  var source = ref.find('source')
  if (source) { metaText += source.text() + ', ' }

  var volume = ref.find('volume')
  if (volume) { metaText += volume.text() + ': ' }

  var fpage = ref.find('fpage')
  if (fpage) { metaText += fpage.text() + '-' }

  var lpage = ref.find('lpage')
  if (lpage) { metaText += lpage.text() + ', ' }

  var year = ref.find("year");
  if (year) { metaText += year.text() }

  meta.text(metaText)
  return meta
}

var URItoHTML = function (ref) {
  var el = substance.DefaultDOMElement.createElement('div')
  el.addClass('doi')

  var doi = ref.find("pub-id[pub-id-type='doi'], ext-link[ext-link-type='doi']")
  var uri = ref.find("ext-link[ext-link-type='uri']")

  var url

  if (doi) {
    url = 'http://dx.doi.org/' + doi.text()
  } else if (uri) {
    url = uri.getAttribute('xlink:href')
  }

  el.appendChild(substance.DefaultDOMElement.createElement('a').setAttribute('href', url).text(url))
  return el
}

var refToHTML = function (ref) {

  // ref element to HTML - https://jats.nlm.nih.gov/archiving/tag-library/0.4/n-ac60.html
  // ------------------
  // NLM XML example element-citation:
  //
  // <ref id="bib56">
  //     <element-citation publication-type="journal">
  //         <person-group person-group-type="author">
  //             <name>
  //                 <surname>Weinhold</surname>
  //                 <given-names>A</given-names>
  //             </name>
  //             <name>
  //                 <surname>Baldwin</surname>
  //                 <given-names>IT</given-names>
  //             </name>
  //         </person-group>
  //         <year>2011</year>
  //         <article-title>Trichome-derived O-acyl sugars are a first meal for caterpillars that tags them for predation</article-title>
  //         <source>Proc Natl Acad Sci U S A</source>
  //         <volume>108</volume>
  //         <fpage>7855</fpage>
  //         <lpage>7859</lpage>
  //         <ext-link ext-link-type="uri" xlink:href="http://dx.doi.org/10.1073/pnas.1101306108">10.1073/pnas.1101306108</ext-link>
  //     </element-citation>
  // </ref>

  // NLM XML example mixed-citation:
  // <ref id="bib2">
  //   <mixed-citation publication-type="journal">
  //       <person-group person-group-type="author">
  //           <name>
  //               <surname>Im</surname>
  //               <given-names>JT</given-names>
  //           </name>
  //           <name>
  //               <surname>Park</surname>
  //               <given-names>BY</given-names>
  //           </name>
  //       </person-group>.
  //       <year>2013</year>.
  //       <article-title>Giant epidermal cyst on posterior scalp</article-title>.
  //       <source>Arch Plast Surg</source>.
  //       <volume>40</volume>
  //       <fpage>280</fpage>-
  //       <lpage>2</lpage>
  //       <pub-id pub-id-type="doi">10.5999/aps.2013.40.3.280</pub-id>
  //   </mixed-citation>
  // </ref>

  ref = ref.getDOM()

  // TODO: remove safeguard for multiple citation elements
  if(Array.isArray(ref)) {
    ref = ref[0]
  }
  var el = substance.DefaultDOMElement.createElement('div')
  if (ref.is('mixed-citation')) {
    el.appendChild(ref.textContent)
  } else if (ref.is('element-citation')) {
    el.appendChild(titleToHTML(ref))
    var names = namesToHTML(ref)
    for (var i = 0; i < names.length; i++) {
      el.appendChild(names[i])
    }
    el.appendChild(metaToHTML(ref))
    el.appendChild(URItoHTML(ref))
  } else {
    el.text('Citation type is unsupported')
  }

  return el.outerHTML

}

var RefComponent = (function (Component$$1) {
  function RefComponent () {
    Component$$1.apply(this, arguments);
  }

  if ( Component$$1 ) RefComponent.__proto__ = Component$$1;
  RefComponent.prototype = Object.create( Component$$1 && Component$$1.prototype );
  RefComponent.prototype.constructor = RefComponent;

  RefComponent.prototype.render = function render ($$) {
    var el = $$('div').addClass('sc-ref')
    el.attr('data-id', this.props.node.id)
    el.html(refToHTML(this.props.node))
    return el
  };

  return RefComponent;
}(substance.Component));

// Isolated Nodes config
RefComponent.fullWidth = true
RefComponent.noStyle = true

/*
  Renders a keyboard-selectable ref target item
*/
var RefTarget = (function (Component$$1) {
  function RefTarget () {
    Component$$1.apply(this, arguments);
  }

  if ( Component$$1 ) RefTarget.__proto__ = Component$$1;
  RefTarget.prototype = Object.create( Component$$1 && Component$$1.prototype );
  RefTarget.prototype.constructor = RefTarget;

  RefTarget.prototype.render = function render ($$) {
    var el = $$('div')
      .addClass('sc-ref-target')
      .attr({'data-id': this.props.node.id})

    if (this.props.selected) {
      el.addClass('sm-selected')
    }
    var node = this.props.node
    el.html(refToHTML(node))
    return el
  };

  return RefTarget;
}(substance.Component));

var RefConverter = {

  type: 'ref',
  tagName: 'ref',

  /*
    (label?, (citation-alternatives | element-citation | mixed-citation | nlm-citation | note | x)+)
  */
  import: function(el, node, converter) { // eslint-disable-line
    node.xmlContent = el.innerHTML
  },

  export: function(node, el, converter) { // eslint-disable-line
    el.innerHTML = node.xmlContent
  }

}

var RefPackage = {
  name: 'ref',
  configure: function(config) {
    config.addNode(Ref)
    config.addComponent(Ref.type, RefComponent)
    config.addComponent(Ref.type+'-target', RefTarget)
    config.addConverter('jats', RefConverter)
  }
}

/*
  ref-list

  List of bibliographic references for a document or document component.
*/
var RefList = (function (Container$$1) {
  function RefList () {
    Container$$1.apply(this, arguments);
  }if ( Container$$1 ) RefList.__proto__ = Container$$1;
  RefList.prototype = Object.create( Container$$1 && Container$$1.prototype );
  RefList.prototype.constructor = RefList;

  

  return RefList;
}(substance.Container));

RefList.type = 'ref-list'

  /*
    (
      label?,
      title?,
      (
        address | alternatives | array | boxed-text | chem-struct-wrap | code | fig |
        fig-group | graphic | media | preformat | supplementary-material | table-wrap |
        table-wrap-group | disp-formula | disp-formula-group | def-list | list | tex-math |
        mml:math | p | related-article | related-object | ack | disp-quote | speech | statement |
        verse-group | x | ref
      )*,
      (ref-list)*
    )
  */
RefList.define({
  attributes: { type: 'object', default: {} },
  label: { type: 'label', optional: true },
  title: { type: 'title', optional: true },
  nodes: { type: ['id'], default: [] }
})

var REFLIST_CONTENT = ['ref', 'ref-list'].concat(JATS.PARA_LEVEL)

var RefListConverter = {

  type: 'ref-list',
  tagName: 'ref-list',

  /*
    (
      label?,
      title?,
      (
        address | alternatives | array | boxed-text | chem-struct-wrap | code | fig |
        fig-group | graphic | media | preformat | supplementary-material | table-wrap |
        table-wrap-group | disp-formula | disp-formula-group | def-list | list | tex-math |
        mml:math | p | related-article | related-object | ack | disp-quote | speech | statement |
        verse-group | x | ref
      )*,
      (ref-list)*
    )
  */
  import: function(el, node, converter) {
    var iterator = new XMLIterator(el.getChildren())
    iterator.optional('label', function(child) {
      node.label = converter.convertElement(child).id
    })
    iterator.optional('title', function(child) {
      node.title = converter.convertElement(child).id
    })
    iterator.manyOf(REFLIST_CONTENT, function(child) {
      node.nodes.push(converter.convertElement(child).id)
    })
    if (iterator.hasNext()) { throw new Error('Illegal JATS: ' + el.outerHTML) }
  },

  export: function(node, el, converter) {
    if(node.label) {
      el.append(converter.convertNode(node.label))
    }
    if(node.title) {
      el.append(converter.convertNode(node.title))
    }
    el.append(converter.convertNodes(node.nodes))
  }

}

var RefListComponent = (function (Component$$1) {
  function RefListComponent () {
    Component$$1.apply(this, arguments);
  }

  if ( Component$$1 ) RefListComponent.__proto__ = Component$$1;
  RefListComponent.prototype = Object.create( Component$$1 && Component$$1.prototype );
  RefListComponent.prototype.constructor = RefListComponent;

  RefListComponent.prototype.didMount = function didMount () {
    Component$$1.prototype.didMount.call(this)
    var node = this.props.node
    node.on('nodes:changed', this.rerender, this)
  };

  RefListComponent.prototype.dispose = function dispose () {
    Component$$1.prototype.dispose.call(this)
    var node = this.props.node
    node.off(this)
  };

  RefListComponent.prototype.render = function render ($$) {
    var node = this.props.node
    var doc = node.getDocument()
    var el = $$('div').addClass('sc-ref-list')

    // NOTE: We don't yet expose RefList.label to the editor
    if (node.title) {
      var titleNode = doc.get(node.title)
      el.append(
        renderNodeComponent(this, $$, titleNode, {
          disabled: this.props.disabled
        })
      )
    }

    // Ref elements
    var children = node.nodes
    children.forEach(function(nodeId) {
      var childNode = doc.get(nodeId)
      if (childNode.type !== 'unsupported') {
        el.append(
          renderNodeComponent(this, $$, childNode, {
            disabled: this.props.disabled
          })
        )
      } else {
        console.info(childNode.type+ ' inside <ref-list> currently not supported by the editor.')
      }
    }.bind(this))

    return el
  };

  return RefListComponent;
}(substance.Component));

// Isolated Nodes config
RefListComponent.fullWidth = true
RefListComponent.noStyle = true

var RefListPackage = {
  name: 'ref-list',
  configure: function(config) {
    config.addNode(RefList)
    config.addComponent(RefList.type, RefListComponent)
    config.addConverter('jats', RefListConverter)
  }
}

var Section = (function (Container$$1) {
  function Section () {
    Container$$1.apply(this, arguments);
  }

  if ( Container$$1 ) Section.__proto__ = Container$$1;
  Section.prototype = Object.create( Container$$1 && Container$$1.prototype );
  Section.prototype.constructor = Section;

  Section.prototype.getTitle = function getTitle () {
    var titleNode = this.getDocument().get(this.title)
    if (titleNode) {
      return titleNode.getText()
    }
  };

  return Section;
}(substance.Container));

Section.type = "section"

/*
  Content Model
    ( sec-meta?, label?, title?,
      ( address | alternatives | array | boxed-text | chem-struct-wrap | code |
        fig | fig-group | graphic | media | preformat | supplementary-material |
        table-wrap | table-wrap-group | disp-formula | disp-formula-group |
        def-list | list | tex-math | mml:math | p | related-article | related-object |
        ack | disp-quote | speech | statement | verse-group | x)*,
      (sec)*,
      (notes | fn-group | glossary | ref-list)*
    )
*/

Section.define({
  attributes: { type: 'object', default: {} },
  meta: { type: 'id', optional: true },
  label: { type: 'id', optional:true },
  title: { type: 'id', optional: true },
  nodes: { type: ['id'], default: [] },
  backMatter: { type: ['id'], default: [] }
})

var SectionComponent = (function (Component$$1) {
  function SectionComponent () {
    Component$$1.apply(this, arguments);
  }

  if ( Component$$1 ) SectionComponent.__proto__ = Component$$1;
  SectionComponent.prototype = Object.create( Component$$1 && Component$$1.prototype );
  SectionComponent.prototype.constructor = SectionComponent;

  SectionComponent.prototype.render = function render ($$) {
    var node = this.props.node
    var doc = node.getDocument()
    var el = $$('div').addClass('sc-section')

    if (node.title) {
      var title = doc.get(node.title)
      el.append(
        $$(substance.TextPropertyEditor, { path: title.getTextPath() }).addClass('se-title').ref('titleEditor')
      )
    }
    el.append(
      $$(substance.ContainerEditor, { node: node }).ref('contentEditor')
        .addClass('se-content')
    )
    return el
  };

  return SectionComponent;
}(substance.Component));

SectionComponent.fullWidth = true
SectionComponent.noStyle = true

var SectionConverter = {

  type: 'section',
  tagName: 'sec',

  /*
    Attributes
      disp-level Display Level of a Heading
      id Document Internal Identifier
      sec-type Type of Section
      specific-use Specific Use
      xml:base Base
      xml:lang Language

    Content
    (
      sec-meta?, label?, title?,
      ( address | alternatives | array |
        boxed-text | chem-struct-wrap | code | fig | fig-group |
        graphic | media | preformat | supplementary-material | table-wrap |
        table-wrap-group | disp-formula | disp-formula-group | def-list |
        list | tex-math | mml:math | p | related-article | related-object |
        ack | disp-quote | speech | statement | verse-group | x
      )*,
      (sec)*,
      (notes | fn-group | glossary | ref-list)*
    )
  */

  import: function(el, node, converter) {

    var children = el.getChildren()
    var iterator = new XMLIterator(children)

    iterator.optional('sec-meta', function(child) {
      node.meta = converter.convertElement(child).id
    })
    iterator.optional('label', function(child) {
      node.label = converter.convertElement(child).id
    })
    iterator.optional('title', function(child) {
      node.title = converter.convertElement(child).id
    })

    iterator.manyOf(JATS.PARA_LEVEL, function(child) {
      node.nodes.push(converter.convertElement(child).id)
    })

    iterator.manyOf(['sec'], function(child) {
      node.nodes.push(converter.convertElement(child).id)
    })

    iterator.manyOf(["notes","fn-group","glossary","ref-list"], function(child) {
      node.backMatter.push(converter.convertElement(child).id)
    })

    if (iterator.hasNext()) {
      throw new Error('Illegal JATS: ' + el.outerHTML)
    }
  },

  export: function(node, el, converter) {
    var $$ = converter.$$

    el.attr(node.xmlAttributes)
    if (node.meta) {
      el.append(
        $$('sec-meta').append(
          converter.convertNode(node.meta)
        )
      )
    }
    if(node.label) {
      el.append(converter.convertNode(node.label))
    }
    if(node.title) {
      el.append(converter.convertNode(node.title))
    }
    node.nodes.forEach(function(nodeId) {
      el.append(converter.convertNode(nodeId))
    })
    node.backMatter.forEach(function(nodeId) {
      el.append(converter.convertNode(nodeId))
    })
  }

}

var SectionPackage = {
  name: 'section',
  configure: function(config) {
    config.addNode(Section)
    config.addComponent('section', SectionComponent)
    config.addConverter('jats', SectionConverter)
  }
}

var Subscript = (function (Annotation$$1) {
  function Subscript () {
    Annotation$$1.apply(this, arguments);
  }if ( Annotation$$1 ) Subscript.__proto__ = Annotation$$1;
  Subscript.prototype = Object.create( Annotation$$1 && Annotation$$1.prototype );
  Subscript.prototype.constructor = Subscript;

  

  return Subscript;
}(substance.Annotation));

Subscript.type = 'subscript'

Subscript.define({
  attributes: { type: 'object', default: {} }
})

var SubscriptConverter = {
  type: 'subscript',
  tagName: 'sub'
}

var SubscriptPackage = {
  name: 'subscript',
  configure: function(config) {
    config.addNode(Subscript)
    config.addConverter('jats', SubscriptConverter)
  }
}

var Superscript = (function (Annotation$$1) {
  function Superscript () {
    Annotation$$1.apply(this, arguments);
  }if ( Annotation$$1 ) Superscript.__proto__ = Annotation$$1;
  Superscript.prototype = Object.create( Annotation$$1 && Annotation$$1.prototype );
  Superscript.prototype.constructor = Superscript;

  

  return Superscript;
}(substance.Annotation));

Superscript.type = 'superscript'

Superscript.define({
  attributes: { type: 'object', default: {} }
})

var SuperscriptConverter = {
  type: 'superscript',
  tagName: 'sup'
}

var SuperscriptPackage = {
  name: 'superscript',
  configure: function(config) {
    config.addNode(Superscript)
    config.addConverter('jats', SuperscriptConverter)
  }
}

var Table = (function (BlockNode$$1) {
  function Table () {
    BlockNode$$1.apply(this, arguments);
  }if ( BlockNode$$1 ) Table.__proto__ = BlockNode$$1;
  Table.prototype = Object.create( BlockNode$$1 && BlockNode$$1.prototype );
  Table.prototype.constructor = Table;

  

  return Table;
}(substance.BlockNode));

Table.type = 'table'

Table.define({
  attributes: { type: 'object', default: {} },
  htmlContent: {type: 'string'}
})

var TableComponent = (function (Component$$1) {
  function TableComponent () {
    Component$$1.apply(this, arguments);
  }

  if ( Component$$1 ) TableComponent.__proto__ = Component$$1;
  TableComponent.prototype = Object.create( Component$$1 && Component$$1.prototype );
  TableComponent.prototype.constructor = TableComponent;

  TableComponent.prototype.render = function render ($$) {
    var el = $$('table')
      .addClass('sc-table')
      .attr('data-id', this.props.node.id)
      .html(this.props.node.htmlContent)

    return el
  };

  return TableComponent;
}(substance.Component));

var TableConverter = {

  type: 'table', // Substance node model
  tagName: 'table', // Used as a matcher

  import: function(el, node) {
    node.htmlContent = el.innerHTML
  },

  export: function(node, el) {
    el.html(node.htmlContent)
  }
}

var TablePackage = {
  name: 'table',
  configure: function(config) {
    config.addNode(Table)
    config.addComponent(Table.type, TableComponent)
    config.addConverter('jats', TableConverter)
  }
}

var Title = (function (TextNode$$1) {
  function Title () {
    TextNode$$1.apply(this, arguments);
  }if ( TextNode$$1 ) Title.__proto__ = TextNode$$1;
  Title.prototype = Object.create( TextNode$$1 && TextNode$$1.prototype );
  Title.prototype.constructor = Title;

  

  return Title;
}(substance.TextNode));

Title.type = 'title'

Title.define({
  attributes: { type: 'object', default: {} }
})

var TitleConverter = TextNodeConverter.extend({
  type: 'title',
  tagName: 'title'
})

var TitlePackage = {
  name: 'title',
  configure: function(config) {
    config.addNode(Title)
    config.addConverter('jats', TitleConverter)
    config.addComponent(Title.type, TitleComponent)
  }
}

var TitleGroup = (function (Container$$1) {
  function TitleGroup () {
    Container$$1.apply(this, arguments);
  }if ( Container$$1 ) TitleGroup.__proto__ = Container$$1;
  TitleGroup.prototype = Object.create( Container$$1 && Container$$1.prototype );
  TitleGroup.prototype.constructor = TitleGroup;

  

  return TitleGroup;
}(substance.Container));

TitleGroup.type = "title-group"

/*
  Content
  (
    article-title, subtitle*, trans-title-group*, alt-title*, fn-group?
  )
*/
TitleGroup.define({
  attributes: { type: 'object', default: {} },
  nodes: { type: ['id'], default: [] }
});

var TitleGroupConverter = {

  type: 'title-group',
  tagName: 'title-group',

  /*
    Attributes
      id Document Internal Identifier
      specific-use Specific Use
      xml:base Base

    Content
      %title-group-model;
  */

  import: function(el, node, converter) {
    node.id = 'title-group'; // there is only be one body element
    node.xmlAttributes = el.getAttributes()

    var children = el.getChildren()
    var iterator = new XMLIterator(children)

    // TODO: This is not strict enough. We want to check for the
    // element cardinalities:
    //   (article-title, subtitle*, trans-title-group*, alt-title*, fn-group?)
    // We may want to use a helper for this (see #64)
    iterator.manyOf(JATS.TITLE_GROUP, function(child) {
      node.nodes.push(converter.convertElement(child).id)
    });
    if (iterator.hasNext()) { throw new Error('Illegal JATS: ' + el.outerHTML) }
  },

  export: function(node, el, converter) {
    el.attr(node.xmlAttributes)
    el.append(converter.convertNodes(node.nodes))
    if (node.sigBlock) {
      el.append(converter.convertNode(node.sigBlock))
    }
  }

}

var TitleGroupComponent = (function (Component$$1) {
  function TitleGroupComponent () {
    Component$$1.apply(this, arguments);
  }

  if ( Component$$1 ) TitleGroupComponent.__proto__ = Component$$1;
  TitleGroupComponent.prototype = Object.create( Component$$1 && Component$$1.prototype );
  TitleGroupComponent.prototype.constructor = TitleGroupComponent;

  TitleGroupComponent.prototype.render = function render ($$) {
    var node = this.props.node
    var doc = node.getDocument()

    var el = $$('div')
      .addClass('sc-title-group')
      .attr('data-id', this.props.node.id)

    var children = node.nodes
    children.forEach(function(nodeId) {
      var childNode = doc.get(nodeId)
      if (childNode.type !== 'unsupported') {
        el.append(
          renderNodeComponent(this, $$, childNode, {
            disabled: this.props.disabled
          })
        )
      }
    }.bind(this))
    return el
  };

  return TitleGroupComponent;
}(substance.Component));

var TitleGroupPackage = {
  name: 'title-group',
  configure: function(config) {
    config.addNode(TitleGroup)
    config.addConverter('jats', TitleGroupConverter)
    config.addComponent(TitleGroup.type, TitleGroupComponent)
  }
}

var XRef = (function (InlineNode$$1) {
  function XRef () {
    InlineNode$$1.apply(this, arguments);
  }if ( InlineNode$$1 ) XRef.__proto__ = InlineNode$$1;
  XRef.prototype = Object.create( InlineNode$$1 && InlineNode$$1.prototype );
  XRef.prototype.constructor = XRef;

  

  return XRef;
}(substance.InlineNode));

XRef.type = 'xref';

XRef.define({
  attributes: { type: 'object', default: {} },
  targets: {type: ['id'], default: []},
  label: { type: 'text', optional: true }
})

Object.defineProperties(XRef.prototype, {
  referenceType: {
    get: function() {
      return this.attributes['ref-type']
    },
    set: function(refType) {
      this.attributes['ref-type'] = refType
    }
  }
})

// In presence of overlapping annotations will try to render this as one element
XRef.fragmentation = substance.Fragmenter.SHOULD_NOT_SPLIT

var XRefComponent = (function (Component$$1) {
  function XRefComponent () {
    Component$$1.apply(this, arguments);
  }

  if ( Component$$1 ) XRefComponent.__proto__ = Component$$1;
  XRefComponent.prototype = Object.create( Component$$1 && Component$$1.prototype );
  XRefComponent.prototype.constructor = XRefComponent;

  XRefComponent.prototype.render = function render ($$) { // eslint-disable-line
    var node = this.props.node
    var el = $$('span').addClass('sc-xref')

    var labelEditor = $$(substance.TextPropertyEditor, {
      disabled: this.props.disabled,
      tagName: 'span',
      path: [node.id, 'label'],
      withoutBreak: true
    }).ref('labelEditor')
    el.append(labelEditor)

    el.addClass('sm-'+node.referenceType)
    return el
  };

  return XRefComponent;
}(substance.Component));

var XRefConverter = {

  type: "xref",
  tagName: "xref",

  /*
    Content:
      (%all_phrase | break)*
  */

  /* <xref ref-type="bibr" rid="bib50 bib51">Steppuhn and Baldwin, 2007</xref> */

  import: function(el, node, converter) {
    node.targets = el.attr('rid').split(' ')
    node.label = converter.annotatedText(el, [node.id, 'label'])
  },

  export: function(node, el, converter) { // eslint-disable-line
    el.attr({
      'rid': node.targets.join(' '),
      'ref-type': node.referenceType
    })
    el.append(
      converter.annotatedText([node.id, 'label'])
    )
  }
}

var EditXRefCommand = (function (EditInlineNodeCommand$$1) {
	function EditXRefCommand () {
		EditInlineNodeCommand$$1.apply(this, arguments);
	}if ( EditInlineNodeCommand$$1 ) EditXRefCommand.__proto__ = EditInlineNodeCommand$$1;
	EditXRefCommand.prototype = Object.create( EditInlineNodeCommand$$1 && EditInlineNodeCommand$$1.prototype );
	EditXRefCommand.prototype.constructor = EditXRefCommand;

	

	return EditXRefCommand;
}(substance.EditInlineNodeCommand));

var _arrayEach = createCommonjsModule(function (module) {
/**
 * A specialized version of `_.forEach` for arrays without support for
 * iteratee shorthands.
 *
 * @private
 * @param {Array} [array] The array to iterate over.
 * @param {Function} iteratee The function invoked per iteration.
 * @returns {Array} Returns `array`.
 */
function arrayEach(array, iteratee) {
  var index = -1,
      length = array ? array.length : 0;

  while (++index < length) {
    if (iteratee(array[index], index, array) === false) {
      break;
    }
  }
  return array;
}

module.exports = arrayEach;
});

var _arrayEach$1 = interopDefault(_arrayEach);


var require$$14 = Object.freeze({
	default: _arrayEach$1
});

var _baseAssign = createCommonjsModule(function (module) {
var copyObject = interopDefault(require$$1),
    keys = interopDefault(require$$0$34);

/**
 * The base implementation of `_.assign` without support for multiple sources
 * or `customizer` functions.
 *
 * @private
 * @param {Object} object The destination object.
 * @param {Object} source The source object.
 * @returns {Object} Returns `object`.
 */
function baseAssign(object, source) {
  return object && copyObject(source, keys(source), object);
}

module.exports = baseAssign;
});

var _baseAssign$1 = interopDefault(_baseAssign);


var require$$12 = Object.freeze({
	default: _baseAssign$1
});

var _cloneBuffer = createCommonjsModule(function (module, exports) {
var root = interopDefault(require$$0$4);

/** Detect free variable `exports`. */
var freeExports = typeof exports == 'object' && exports && !exports.nodeType && exports;

/** Detect free variable `module`. */
var freeModule = freeExports && typeof module == 'object' && module && !module.nodeType && module;

/** Detect the popular CommonJS extension `module.exports`. */
var moduleExports = freeModule && freeModule.exports === freeExports;

/** Built-in value references. */
var Buffer = moduleExports ? root.Buffer : undefined,
    allocUnsafe = Buffer ? Buffer.allocUnsafe : undefined;

/**
 * Creates a clone of  `buffer`.
 *
 * @private
 * @param {Buffer} buffer The buffer to clone.
 * @param {boolean} [isDeep] Specify a deep clone.
 * @returns {Buffer} Returns the cloned buffer.
 */
function cloneBuffer(buffer, isDeep) {
  if (isDeep) {
    return buffer.slice();
  }
  var length = buffer.length,
      result = allocUnsafe ? allocUnsafe(length) : new buffer.constructor(length);

  buffer.copy(result);
  return result;
}

module.exports = cloneBuffer;
});

var _cloneBuffer$1 = interopDefault(_cloneBuffer);


var require$$11 = Object.freeze({
	default: _cloneBuffer$1
});

var _copyArray = createCommonjsModule(function (module) {
/**
 * Copies the values of `source` to `array`.
 *
 * @private
 * @param {Array} source The array to copy values from.
 * @param {Array} [array=[]] The array to copy values to.
 * @returns {Array} Returns `array`.
 */
function copyArray(source, array) {
  var index = -1,
      length = source.length;

  array || (array = Array(length));
  while (++index < length) {
    array[index] = source[index];
  }
  return array;
}

module.exports = copyArray;
});

var _copyArray$1 = interopDefault(_copyArray);


var require$$10 = Object.freeze({
	default: _copyArray$1
});

var stubArray = createCommonjsModule(function (module) {
/**
 * This method returns a new empty array.
 *
 * @static
 * @memberOf _
 * @since 4.13.0
 * @category Util
 * @returns {Array} Returns the new empty array.
 * @example
 *
 * var arrays = _.times(2, _.stubArray);
 *
 * console.log(arrays);
 * // => [[], []]
 *
 * console.log(arrays[0] === arrays[1]);
 * // => false
 */
function stubArray() {
  return [];
}

module.exports = stubArray;
});

var stubArray$1 = interopDefault(stubArray);


var require$$0$49 = Object.freeze({
	default: stubArray$1
});

var _getSymbols = createCommonjsModule(function (module) {
var overArg = interopDefault(require$$0$36),
    stubArray = interopDefault(require$$0$49);

/* Built-in method references for those with the same name as other `lodash` methods. */
var nativeGetSymbols = Object.getOwnPropertySymbols;

/**
 * Creates an array of the own enumerable symbol properties of `object`.
 *
 * @private
 * @param {Object} object The object to query.
 * @returns {Array} Returns the array of symbols.
 */
var getSymbols = nativeGetSymbols ? overArg(nativeGetSymbols, Object) : stubArray;

module.exports = getSymbols;
});

var _getSymbols$1 = interopDefault(_getSymbols);


var require$$1$31 = Object.freeze({
	default: _getSymbols$1
});

var _copySymbols = createCommonjsModule(function (module) {
var copyObject = interopDefault(require$$1),
    getSymbols = interopDefault(require$$1$31);

/**
 * Copies own symbol properties of `source` to `object`.
 *
 * @private
 * @param {Object} source The object to copy symbols from.
 * @param {Object} [object={}] The object to copy symbols to.
 * @returns {Object} Returns `object`.
 */
function copySymbols(source, object) {
  return copyObject(source, getSymbols(source), object);
}

module.exports = copySymbols;
});

var _copySymbols$1 = interopDefault(_copySymbols);


var require$$9 = Object.freeze({
	default: _copySymbols$1
});

var _arrayPush = createCommonjsModule(function (module) {
/**
 * Appends the elements of `values` to `array`.
 *
 * @private
 * @param {Array} array The array to modify.
 * @param {Array} values The values to append.
 * @returns {Array} Returns `array`.
 */
function arrayPush(array, values) {
  var index = -1,
      length = values.length,
      offset = array.length;

  while (++index < length) {
    array[offset + index] = values[index];
  }
  return array;
}

module.exports = arrayPush;
});

var _arrayPush$1 = interopDefault(_arrayPush);


var require$$1$32 = Object.freeze({
	default: _arrayPush$1
});

var _baseGetAllKeys = createCommonjsModule(function (module) {
var arrayPush = interopDefault(require$$1$32),
    isArray = interopDefault(require$$0);

/**
 * The base implementation of `getAllKeys` and `getAllKeysIn` which uses
 * `keysFunc` and `symbolsFunc` to get the enumerable property names and
 * symbols of `object`.
 *
 * @private
 * @param {Object} object The object to query.
 * @param {Function} keysFunc The function to get the keys of `object`.
 * @param {Function} symbolsFunc The function to get the symbols of `object`.
 * @returns {Array} Returns the array of property names and symbols.
 */
function baseGetAllKeys(object, keysFunc, symbolsFunc) {
  var result = keysFunc(object);
  return isArray(object) ? result : arrayPush(result, symbolsFunc(object));
}

module.exports = baseGetAllKeys;
});

var _baseGetAllKeys$1 = interopDefault(_baseGetAllKeys);


var require$$2$18 = Object.freeze({
	default: _baseGetAllKeys$1
});

var _getAllKeys = createCommonjsModule(function (module) {
var baseGetAllKeys = interopDefault(require$$2$18),
    getSymbols = interopDefault(require$$1$31),
    keys = interopDefault(require$$0$34);

/**
 * Creates an array of own enumerable property names and symbols of `object`.
 *
 * @private
 * @param {Object} object The object to query.
 * @returns {Array} Returns the array of property names and symbols.
 */
function getAllKeys(object) {
  return baseGetAllKeys(object, keys, getSymbols);
}

module.exports = getAllKeys;
});

var _getAllKeys$1 = interopDefault(_getAllKeys);


var require$$8 = Object.freeze({
	default: _getAllKeys$1
});

var _initCloneArray = createCommonjsModule(function (module) {
/** Used for built-in method references. */
var objectProto = Object.prototype;

/** Used to check objects for own properties. */
var hasOwnProperty = objectProto.hasOwnProperty;

/**
 * Initializes an array clone.
 *
 * @private
 * @param {Array} array The array to clone.
 * @returns {Array} Returns the initialized clone.
 */
function initCloneArray(array) {
  var length = array.length,
      result = array.constructor(length);

  // Add properties assigned by `RegExp#exec`.
  if (length && typeof array[0] == 'string' && hasOwnProperty.call(array, 'index')) {
    result.index = array.index;
    result.input = array.input;
  }
  return result;
}

module.exports = initCloneArray;
});

var _initCloneArray$1 = interopDefault(_initCloneArray);


var require$$6$4 = Object.freeze({
	default: _initCloneArray$1
});

var _cloneArrayBuffer = createCommonjsModule(function (module) {
var Uint8Array = interopDefault(require$$0$31);

/**
 * Creates a clone of `arrayBuffer`.
 *
 * @private
 * @param {ArrayBuffer} arrayBuffer The array buffer to clone.
 * @returns {ArrayBuffer} Returns the cloned array buffer.
 */
function cloneArrayBuffer(arrayBuffer) {
  var result = new arrayBuffer.constructor(arrayBuffer.byteLength);
  new Uint8Array(result).set(new Uint8Array(arrayBuffer));
  return result;
}

module.exports = cloneArrayBuffer;
});

var _cloneArrayBuffer$1 = interopDefault(_cloneArrayBuffer);


var require$$0$50 = Object.freeze({
	default: _cloneArrayBuffer$1
});

var _cloneDataView = createCommonjsModule(function (module) {
var cloneArrayBuffer = interopDefault(require$$0$50);

/**
 * Creates a clone of `dataView`.
 *
 * @private
 * @param {Object} dataView The data view to clone.
 * @param {boolean} [isDeep] Specify a deep clone.
 * @returns {Object} Returns the cloned data view.
 */
function cloneDataView(dataView, isDeep) {
  var buffer = isDeep ? cloneArrayBuffer(dataView.buffer) : dataView.buffer;
  return new dataView.constructor(buffer, dataView.byteOffset, dataView.byteLength);
}

module.exports = cloneDataView;
});

var _cloneDataView$1 = interopDefault(_cloneDataView);


var require$$5$8 = Object.freeze({
	default: _cloneDataView$1
});

var _addMapEntry = createCommonjsModule(function (module) {
/**
 * Adds the key-value `pair` to `map`.
 *
 * @private
 * @param {Object} map The map to modify.
 * @param {Array} pair The key-value pair to add.
 * @returns {Object} Returns `map`.
 */
function addMapEntry(map, pair) {
  // Don't return `map.set` because it's not chainable in IE 11.
  map.set(pair[0], pair[1]);
  return map;
}

module.exports = addMapEntry;
});

var _addMapEntry$1 = interopDefault(_addMapEntry);


var require$$2$19 = Object.freeze({
	default: _addMapEntry$1
});

var _arrayReduce = createCommonjsModule(function (module) {
/**
 * A specialized version of `_.reduce` for arrays without support for
 * iteratee shorthands.
 *
 * @private
 * @param {Array} [array] The array to iterate over.
 * @param {Function} iteratee The function invoked per iteration.
 * @param {*} [accumulator] The initial value.
 * @param {boolean} [initAccum] Specify using the first element of `array` as
 *  the initial value.
 * @returns {*} Returns the accumulated value.
 */
function arrayReduce(array, iteratee, accumulator, initAccum) {
  var index = -1,
      length = array ? array.length : 0;

  if (initAccum && length) {
    accumulator = array[++index];
  }
  while (++index < length) {
    accumulator = iteratee(accumulator, array[index], index, array);
  }
  return accumulator;
}

module.exports = arrayReduce;
});

var _arrayReduce$1 = interopDefault(_arrayReduce);


var require$$1$33 = Object.freeze({
	default: _arrayReduce$1
});

var _cloneMap = createCommonjsModule(function (module) {
var addMapEntry = interopDefault(require$$2$19),
    arrayReduce = interopDefault(require$$1$33),
    mapToArray = interopDefault(require$$0$32);

/**
 * Creates a clone of `map`.
 *
 * @private
 * @param {Object} map The map to clone.
 * @param {Function} cloneFunc The function to clone values.
 * @param {boolean} [isDeep] Specify a deep clone.
 * @returns {Object} Returns the cloned map.
 */
function cloneMap(map, isDeep, cloneFunc) {
  var array = isDeep ? cloneFunc(mapToArray(map), true) : mapToArray(map);
  return arrayReduce(array, addMapEntry, new map.constructor);
}

module.exports = cloneMap;
});

var _cloneMap$1 = interopDefault(_cloneMap);


var require$$4$9 = Object.freeze({
	default: _cloneMap$1
});

var _cloneRegExp = createCommonjsModule(function (module) {
/** Used to match `RegExp` flags from their coerced string values. */
var reFlags = /\w*$/;

/**
 * Creates a clone of `regexp`.
 *
 * @private
 * @param {Object} regexp The regexp to clone.
 * @returns {Object} Returns the cloned regexp.
 */
function cloneRegExp(regexp) {
  var result = new regexp.constructor(regexp.source, reFlags.exec(regexp));
  result.lastIndex = regexp.lastIndex;
  return result;
}

module.exports = cloneRegExp;
});

var _cloneRegExp$1 = interopDefault(_cloneRegExp);


var require$$3$10 = Object.freeze({
	default: _cloneRegExp$1
});

var _addSetEntry = createCommonjsModule(function (module) {
/**
 * Adds `value` to `set`.
 *
 * @private
 * @param {Object} set The set to modify.
 * @param {*} value The value to add.
 * @returns {Object} Returns `set`.
 */
function addSetEntry(set, value) {
  // Don't return `set.add` because it's not chainable in IE 11.
  set.add(value);
  return set;
}

module.exports = addSetEntry;
});

var _addSetEntry$1 = interopDefault(_addSetEntry);


var require$$2$21 = Object.freeze({
	default: _addSetEntry$1
});

var _cloneSet = createCommonjsModule(function (module) {
var addSetEntry = interopDefault(require$$2$21),
    arrayReduce = interopDefault(require$$1$33),
    setToArray = interopDefault(require$$0$33);

/**
 * Creates a clone of `set`.
 *
 * @private
 * @param {Object} set The set to clone.
 * @param {Function} cloneFunc The function to clone values.
 * @param {boolean} [isDeep] Specify a deep clone.
 * @returns {Object} Returns the cloned set.
 */
function cloneSet(set, isDeep, cloneFunc) {
  var array = isDeep ? cloneFunc(setToArray(set), true) : setToArray(set);
  return arrayReduce(array, addSetEntry, new set.constructor);
}

module.exports = cloneSet;
});

var _cloneSet$1 = interopDefault(_cloneSet);


var require$$2$20 = Object.freeze({
	default: _cloneSet$1
});

var _cloneSymbol = createCommonjsModule(function (module) {
var Symbol = interopDefault(require$$0$30);

/** Used to convert symbols to primitives and strings. */
var symbolProto = Symbol ? Symbol.prototype : undefined,
    symbolValueOf = symbolProto ? symbolProto.valueOf : undefined;

/**
 * Creates a clone of the `symbol` object.
 *
 * @private
 * @param {Object} symbol The symbol object to clone.
 * @returns {Object} Returns the cloned symbol object.
 */
function cloneSymbol(symbol) {
  return symbolValueOf ? Object(symbolValueOf.call(symbol)) : {};
}

module.exports = cloneSymbol;
});

var _cloneSymbol$1 = interopDefault(_cloneSymbol);


var require$$1$34 = Object.freeze({
	default: _cloneSymbol$1
});

var _cloneTypedArray = createCommonjsModule(function (module) {
var cloneArrayBuffer = interopDefault(require$$0$50);

/**
 * Creates a clone of `typedArray`.
 *
 * @private
 * @param {Object} typedArray The typed array to clone.
 * @param {boolean} [isDeep] Specify a deep clone.
 * @returns {Object} Returns the cloned typed array.
 */
function cloneTypedArray(typedArray, isDeep) {
  var buffer = isDeep ? cloneArrayBuffer(typedArray.buffer) : typedArray.buffer;
  return new typedArray.constructor(buffer, typedArray.byteOffset, typedArray.length);
}

module.exports = cloneTypedArray;
});

var _cloneTypedArray$1 = interopDefault(_cloneTypedArray);


var require$$0$51 = Object.freeze({
	default: _cloneTypedArray$1
});

var _initCloneByTag = createCommonjsModule(function (module) {
var cloneArrayBuffer = interopDefault(require$$0$50),
    cloneDataView = interopDefault(require$$5$8),
    cloneMap = interopDefault(require$$4$9),
    cloneRegExp = interopDefault(require$$3$10),
    cloneSet = interopDefault(require$$2$20),
    cloneSymbol = interopDefault(require$$1$34),
    cloneTypedArray = interopDefault(require$$0$51);

/** `Object#toString` result references. */
var boolTag = '[object Boolean]',
    dateTag = '[object Date]',
    mapTag = '[object Map]',
    numberTag = '[object Number]',
    regexpTag = '[object RegExp]',
    setTag = '[object Set]',
    stringTag = '[object String]',
    symbolTag = '[object Symbol]';

var arrayBufferTag = '[object ArrayBuffer]',
    dataViewTag = '[object DataView]',
    float32Tag = '[object Float32Array]',
    float64Tag = '[object Float64Array]',
    int8Tag = '[object Int8Array]',
    int16Tag = '[object Int16Array]',
    int32Tag = '[object Int32Array]',
    uint8Tag = '[object Uint8Array]',
    uint8ClampedTag = '[object Uint8ClampedArray]',
    uint16Tag = '[object Uint16Array]',
    uint32Tag = '[object Uint32Array]';

/**
 * Initializes an object clone based on its `toStringTag`.
 *
 * **Note:** This function only supports cloning values with tags of
 * `Boolean`, `Date`, `Error`, `Number`, `RegExp`, or `String`.
 *
 * @private
 * @param {Object} object The object to clone.
 * @param {string} tag The `toStringTag` of the object to clone.
 * @param {Function} cloneFunc The function to clone values.
 * @param {boolean} [isDeep] Specify a deep clone.
 * @returns {Object} Returns the initialized clone.
 */
function initCloneByTag(object, tag, cloneFunc, isDeep) {
  var Ctor = object.constructor;
  switch (tag) {
    case arrayBufferTag:
      return cloneArrayBuffer(object);

    case boolTag:
    case dateTag:
      return new Ctor(+object);

    case dataViewTag:
      return cloneDataView(object, isDeep);

    case float32Tag: case float64Tag:
    case int8Tag: case int16Tag: case int32Tag:
    case uint8Tag: case uint8ClampedTag: case uint16Tag: case uint32Tag:
      return cloneTypedArray(object, isDeep);

    case mapTag:
      return cloneMap(object, isDeep, cloneFunc);

    case numberTag:
    case stringTag:
      return new Ctor(object);

    case regexpTag:
      return cloneRegExp(object);

    case setTag:
      return cloneSet(object, isDeep, cloneFunc);

    case symbolTag:
      return cloneSymbol(object);
  }
}

module.exports = initCloneByTag;
});

var _initCloneByTag$1 = interopDefault(_initCloneByTag);


var require$$5$7 = Object.freeze({
	default: _initCloneByTag$1
});

var _baseCreate = createCommonjsModule(function (module) {
var isObject = interopDefault(require$$1$6);

/** Built-in value references. */
var objectCreate = Object.create;

/**
 * The base implementation of `_.create` without support for assigning
 * properties to the created object.
 *
 * @private
 * @param {Object} proto The object to inherit from.
 * @returns {Object} Returns the new object.
 */
var baseCreate = (function() {
  function object() {}
  return function(proto) {
    if (!isObject(proto)) {
      return {};
    }
    if (objectCreate) {
      return objectCreate(proto);
    }
    object.prototype = proto;
    var result = new object;
    object.prototype = undefined;
    return result;
  };
}());

module.exports = baseCreate;
});

var _baseCreate$1 = interopDefault(_baseCreate);


var require$$2$22 = Object.freeze({
	default: _baseCreate$1
});

var _getPrototype = createCommonjsModule(function (module) {
var overArg = interopDefault(require$$0$36);

/** Built-in value references. */
var getPrototype = overArg(Object.getPrototypeOf, Object);

module.exports = getPrototype;
});

var _getPrototype$1 = interopDefault(_getPrototype);


var require$$1$35 = Object.freeze({
	default: _getPrototype$1
});

var _initCloneObject = createCommonjsModule(function (module) {
var baseCreate = interopDefault(require$$2$22),
    getPrototype = interopDefault(require$$1$35),
    isPrototype = interopDefault(require$$0$17);

/**
 * Initializes an object clone.
 *
 * @private
 * @param {Object} object The object to clone.
 * @returns {Object} Returns the initialized clone.
 */
function initCloneObject(object) {
  return (typeof object.constructor == 'function' && !isPrototype(object))
    ? baseCreate(getPrototype(object))
    : {};
}

module.exports = initCloneObject;
});

var _initCloneObject$1 = interopDefault(_initCloneObject);


var require$$4$10 = Object.freeze({
	default: _initCloneObject$1
});

var _baseClone = createCommonjsModule(function (module) {
var Stack = interopDefault(require$$15),
    arrayEach = interopDefault(require$$14),
    assignValue = interopDefault(require$$13),
    baseAssign = interopDefault(require$$12),
    cloneBuffer = interopDefault(require$$11),
    copyArray = interopDefault(require$$10),
    copySymbols = interopDefault(require$$9),
    getAllKeys = interopDefault(require$$8),
    getTag = interopDefault(require$$7),
    initCloneArray = interopDefault(require$$6$4),
    initCloneByTag = interopDefault(require$$5$7),
    initCloneObject = interopDefault(require$$4$10),
    isArray = interopDefault(require$$0),
    isBuffer = interopDefault(require$$2$4),
    isObject = interopDefault(require$$1$6),
    keys = interopDefault(require$$0$34);

/** `Object#toString` result references. */
var argsTag = '[object Arguments]',
    arrayTag = '[object Array]',
    boolTag = '[object Boolean]',
    dateTag = '[object Date]',
    errorTag = '[object Error]',
    funcTag = '[object Function]',
    genTag = '[object GeneratorFunction]',
    mapTag = '[object Map]',
    numberTag = '[object Number]',
    objectTag = '[object Object]',
    regexpTag = '[object RegExp]',
    setTag = '[object Set]',
    stringTag = '[object String]',
    symbolTag = '[object Symbol]',
    weakMapTag = '[object WeakMap]';

var arrayBufferTag = '[object ArrayBuffer]',
    dataViewTag = '[object DataView]',
    float32Tag = '[object Float32Array]',
    float64Tag = '[object Float64Array]',
    int8Tag = '[object Int8Array]',
    int16Tag = '[object Int16Array]',
    int32Tag = '[object Int32Array]',
    uint8Tag = '[object Uint8Array]',
    uint8ClampedTag = '[object Uint8ClampedArray]',
    uint16Tag = '[object Uint16Array]',
    uint32Tag = '[object Uint32Array]';

/** Used to identify `toStringTag` values supported by `_.clone`. */
var cloneableTags = {};
cloneableTags[argsTag] = cloneableTags[arrayTag] =
cloneableTags[arrayBufferTag] = cloneableTags[dataViewTag] =
cloneableTags[boolTag] = cloneableTags[dateTag] =
cloneableTags[float32Tag] = cloneableTags[float64Tag] =
cloneableTags[int8Tag] = cloneableTags[int16Tag] =
cloneableTags[int32Tag] = cloneableTags[mapTag] =
cloneableTags[numberTag] = cloneableTags[objectTag] =
cloneableTags[regexpTag] = cloneableTags[setTag] =
cloneableTags[stringTag] = cloneableTags[symbolTag] =
cloneableTags[uint8Tag] = cloneableTags[uint8ClampedTag] =
cloneableTags[uint16Tag] = cloneableTags[uint32Tag] = true;
cloneableTags[errorTag] = cloneableTags[funcTag] =
cloneableTags[weakMapTag] = false;

/**
 * The base implementation of `_.clone` and `_.cloneDeep` which tracks
 * traversed objects.
 *
 * @private
 * @param {*} value The value to clone.
 * @param {boolean} [isDeep] Specify a deep clone.
 * @param {boolean} [isFull] Specify a clone including symbols.
 * @param {Function} [customizer] The function to customize cloning.
 * @param {string} [key] The key of `value`.
 * @param {Object} [object] The parent object of `value`.
 * @param {Object} [stack] Tracks traversed objects and their clone counterparts.
 * @returns {*} Returns the cloned value.
 */
function baseClone(value, isDeep, isFull, customizer, key, object, stack) {
  var result;
  if (customizer) {
    result = object ? customizer(value, key, object, stack) : customizer(value);
  }
  if (result !== undefined) {
    return result;
  }
  if (!isObject(value)) {
    return value;
  }
  var isArr = isArray(value);
  if (isArr) {
    result = initCloneArray(value);
    if (!isDeep) {
      return copyArray(value, result);
    }
  } else {
    var tag = getTag(value),
        isFunc = tag == funcTag || tag == genTag;

    if (isBuffer(value)) {
      return cloneBuffer(value, isDeep);
    }
    if (tag == objectTag || tag == argsTag || (isFunc && !object)) {
      result = initCloneObject(isFunc ? {} : value);
      if (!isDeep) {
        return copySymbols(value, baseAssign(result, value));
      }
    } else {
      if (!cloneableTags[tag]) {
        return object ? value : {};
      }
      result = initCloneByTag(value, tag, baseClone, isDeep);
    }
  }
  // Check for circular references and return its corresponding clone.
  stack || (stack = new Stack);
  var stacked = stack.get(value);
  if (stacked) {
    return stacked;
  }
  stack.set(value, result);

  var props = isArr ? undefined : (isFull ? getAllKeys : keys)(value);
  arrayEach(props || value, function(subValue, key) {
    if (props) {
      key = subValue;
      subValue = value[key];
    }
    // Recursively populate clone (susceptible to call stack limits).
    assignValue(result, key, baseClone(subValue, isDeep, isFull, customizer, key, value, stack));
  });
  return result;
}

module.exports = baseClone;
});

var _baseClone$1 = interopDefault(_baseClone);


var require$$0$48 = Object.freeze({
	default: _baseClone$1
});

var clone = createCommonjsModule(function (module) {
var baseClone = interopDefault(require$$0$48);

/**
 * Creates a shallow clone of `value`.
 *
 * **Note:** This method is loosely based on the
 * [structured clone algorithm](https://mdn.io/Structured_clone_algorithm)
 * and supports cloning arrays, array buffers, booleans, date objects, maps,
 * numbers, `Object` objects, regexes, sets, strings, symbols, and typed
 * arrays. The own enumerable properties of `arguments` objects are cloned
 * as plain objects. An empty object is returned for uncloneable values such
 * as error objects, functions, DOM nodes, and WeakMaps.
 *
 * @static
 * @memberOf _
 * @since 0.1.0
 * @category Lang
 * @param {*} value The value to clone.
 * @returns {*} Returns the cloned value.
 * @see _.cloneDeep
 * @example
 *
 * var objects = [{ 'a': 1 }, { 'b': 2 }];
 *
 * var shallow = _.clone(objects);
 * console.log(shallow[0] === objects[0]);
 * // => true
 */
function clone(value) {
  return baseClone(value, false, true);
}

module.exports = clone;
});

var clone$1 = interopDefault(clone);

var _createFind = createCommonjsModule(function (module) {
var baseIteratee = interopDefault(require$$5$2),
    isArrayLike = interopDefault(require$$3$1),
    keys = interopDefault(require$$0$34);

/**
 * Creates a `_.find` or `_.findLast` function.
 *
 * @private
 * @param {Function} findIndexFunc The function to find the collection index.
 * @returns {Function} Returns the new find function.
 */
function createFind(findIndexFunc) {
  return function(collection, predicate, fromIndex) {
    var iterable = Object(collection);
    if (!isArrayLike(collection)) {
      var iteratee = baseIteratee(predicate, 3);
      collection = keys(collection);
      predicate = function(key) { return iteratee(iterable[key], key, iterable); };
    }
    var index = findIndexFunc(collection, predicate, fromIndex);
    return index > -1 ? iterable[iteratee ? collection[index] : index] : undefined;
  };
}

module.exports = createFind;
});

var _createFind$1 = interopDefault(_createFind);


var require$$1$36 = Object.freeze({
	default: _createFind$1
});

var _baseFindIndex = createCommonjsModule(function (module) {
/**
 * The base implementation of `_.findIndex` and `_.findLastIndex` without
 * support for iteratee shorthands.
 *
 * @private
 * @param {Array} array The array to inspect.
 * @param {Function} predicate The function invoked per iteration.
 * @param {number} fromIndex The index to search from.
 * @param {boolean} [fromRight] Specify iterating from right to left.
 * @returns {number} Returns the index of the matched value, else `-1`.
 */
function baseFindIndex(array, predicate, fromIndex, fromRight) {
  var length = array.length,
      index = fromIndex + (fromRight ? 1 : -1);

  while ((fromRight ? index-- : ++index < length)) {
    if (predicate(array[index], index, array)) {
      return index;
    }
  }
  return -1;
}

module.exports = baseFindIndex;
});

var _baseFindIndex$1 = interopDefault(_baseFindIndex);


var require$$2$23 = Object.freeze({
	default: _baseFindIndex$1
});

var toNumber = createCommonjsModule(function (module) {
var isObject = interopDefault(require$$1$6),
    isSymbol = interopDefault(require$$0$42);

/** Used as references for various `Number` constants. */
var NAN = 0 / 0;

/** Used to match leading and trailing whitespace. */
var reTrim = /^\s+|\s+$/g;

/** Used to detect bad signed hexadecimal string values. */
var reIsBadHex = /^[-+]0x[0-9a-f]+$/i;

/** Used to detect binary string values. */
var reIsBinary = /^0b[01]+$/i;

/** Used to detect octal string values. */
var reIsOctal = /^0o[0-7]+$/i;

/** Built-in method references without a dependency on `root`. */
var freeParseInt = parseInt;

/**
 * Converts `value` to a number.
 *
 * @static
 * @memberOf _
 * @since 4.0.0
 * @category Lang
 * @param {*} value The value to process.
 * @returns {number} Returns the number.
 * @example
 *
 * _.toNumber(3.2);
 * // => 3.2
 *
 * _.toNumber(Number.MIN_VALUE);
 * // => 5e-324
 *
 * _.toNumber(Infinity);
 * // => Infinity
 *
 * _.toNumber('3.2');
 * // => 3.2
 */
function toNumber(value) {
  if (typeof value == 'number') {
    return value;
  }
  if (isSymbol(value)) {
    return NAN;
  }
  if (isObject(value)) {
    var other = typeof value.valueOf == 'function' ? value.valueOf() : value;
    value = isObject(other) ? (other + '') : other;
  }
  if (typeof value != 'string') {
    return value === 0 ? value : +value;
  }
  value = value.replace(reTrim, '');
  var isBinary = reIsBinary.test(value);
  return (isBinary || reIsOctal.test(value))
    ? freeParseInt(value.slice(2), isBinary ? 2 : 8)
    : (reIsBadHex.test(value) ? NAN : +value);
}

module.exports = toNumber;
});

var toNumber$1 = interopDefault(toNumber);


var require$$0$54 = Object.freeze({
	default: toNumber$1
});

var toFinite = createCommonjsModule(function (module) {
var toNumber = interopDefault(require$$0$54);

/** Used as references for various `Number` constants. */
var INFINITY = 1 / 0,
    MAX_INTEGER = 1.7976931348623157e+308;

/**
 * Converts `value` to a finite number.
 *
 * @static
 * @memberOf _
 * @since 4.12.0
 * @category Lang
 * @param {*} value The value to convert.
 * @returns {number} Returns the converted number.
 * @example
 *
 * _.toFinite(3.2);
 * // => 3.2
 *
 * _.toFinite(Number.MIN_VALUE);
 * // => 5e-324
 *
 * _.toFinite(Infinity);
 * // => 1.7976931348623157e+308
 *
 * _.toFinite('3.2');
 * // => 3.2
 */
function toFinite(value) {
  if (!value) {
    return value === 0 ? value : 0;
  }
  value = toNumber(value);
  if (value === INFINITY || value === -INFINITY) {
    var sign = (value < 0 ? -1 : 1);
    return sign * MAX_INTEGER;
  }
  return value === value ? value : 0;
}

module.exports = toFinite;
});

var toFinite$1 = interopDefault(toFinite);


var require$$0$53 = Object.freeze({
	default: toFinite$1
});

var toInteger = createCommonjsModule(function (module) {
var toFinite = interopDefault(require$$0$53);

/**
 * Converts `value` to an integer.
 *
 * **Note:** This method is loosely based on
 * [`ToInteger`](http://www.ecma-international.org/ecma-262/7.0/#sec-tointeger).
 *
 * @static
 * @memberOf _
 * @since 4.0.0
 * @category Lang
 * @param {*} value The value to convert.
 * @returns {number} Returns the converted integer.
 * @example
 *
 * _.toInteger(3.2);
 * // => 3
 *
 * _.toInteger(Number.MIN_VALUE);
 * // => 0
 *
 * _.toInteger(Infinity);
 * // => 1.7976931348623157e+308
 *
 * _.toInteger('3.2');
 * // => 3
 */
function toInteger(value) {
  var result = toFinite(value),
      remainder = result % 1;

  return result === result ? (remainder ? result - remainder : result) : 0;
}

module.exports = toInteger;
});

var toInteger$1 = interopDefault(toInteger);


var require$$1$37 = Object.freeze({
	default: toInteger$1
});

var findIndex = createCommonjsModule(function (module) {
var baseFindIndex = interopDefault(require$$2$23),
    baseIteratee = interopDefault(require$$5$2),
    toInteger = interopDefault(require$$1$37);

/* Built-in method references for those with the same name as other `lodash` methods. */
var nativeMax = Math.max;

/**
 * This method is like `_.find` except that it returns the index of the first
 * element `predicate` returns truthy for instead of the element itself.
 *
 * @static
 * @memberOf _
 * @since 1.1.0
 * @category Array
 * @param {Array} array The array to inspect.
 * @param {Function} [predicate=_.identity]
 *  The function invoked per iteration.
 * @param {number} [fromIndex=0] The index to search from.
 * @returns {number} Returns the index of the found element, else `-1`.
 * @example
 *
 * var users = [
 *   { 'user': 'barney',  'active': false },
 *   { 'user': 'fred',    'active': false },
 *   { 'user': 'pebbles', 'active': true }
 * ];
 *
 * _.findIndex(users, function(o) { return o.user == 'barney'; });
 * // => 0
 *
 * // The `_.matches` iteratee shorthand.
 * _.findIndex(users, { 'user': 'fred', 'active': false });
 * // => 1
 *
 * // The `_.matchesProperty` iteratee shorthand.
 * _.findIndex(users, ['active', false]);
 * // => 0
 *
 * // The `_.property` iteratee shorthand.
 * _.findIndex(users, 'active');
 * // => 2
 */
function findIndex(array, predicate, fromIndex) {
  var length = array ? array.length : 0;
  if (!length) {
    return -1;
  }
  var index = fromIndex == null ? 0 : toInteger(fromIndex);
  if (index < 0) {
    index = nativeMax(length + index, 0);
  }
  return baseFindIndex(array, baseIteratee(predicate, 3), index);
}

module.exports = findIndex;
});

var findIndex$1 = interopDefault(findIndex);


var require$$0$52 = Object.freeze({
	default: findIndex$1
});

var find = createCommonjsModule(function (module) {
var createFind = interopDefault(require$$1$36),
    findIndex = interopDefault(require$$0$52);

/**
 * Iterates over elements of `collection`, returning the first element
 * `predicate` returns truthy for. The predicate is invoked with three
 * arguments: (value, index|key, collection).
 *
 * @static
 * @memberOf _
 * @since 0.1.0
 * @category Collection
 * @param {Array|Object} collection The collection to inspect.
 * @param {Function} [predicate=_.identity]
 *  The function invoked per iteration.
 * @param {number} [fromIndex=0] The index to search from.
 * @returns {*} Returns the matched element, else `undefined`.
 * @example
 *
 * var users = [
 *   { 'user': 'barney',  'age': 36, 'active': true },
 *   { 'user': 'fred',    'age': 40, 'active': false },
 *   { 'user': 'pebbles', 'age': 1,  'active': true }
 * ];
 *
 * _.find(users, function(o) { return o.age < 40; });
 * // => object for 'barney'
 *
 * // The `_.matches` iteratee shorthand.
 * _.find(users, { 'age': 1, 'active': true });
 * // => object for 'pebbles'
 *
 * // The `_.matchesProperty` iteratee shorthand.
 * _.find(users, ['active', false]);
 * // => object for 'fred'
 *
 * // The `_.property` iteratee shorthand.
 * _.find(users, 'active');
 * // => object for 'barney'
 */
var find = createFind(findIndex);

module.exports = find;
});

var find$1 = interopDefault(find);

var _baseIsNaN = createCommonjsModule(function (module) {
/**
 * The base implementation of `_.isNaN` without support for number objects.
 *
 * @private
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is `NaN`, else `false`.
 */
function baseIsNaN(value) {
  return value !== value;
}

module.exports = baseIsNaN;
});

var _baseIsNaN$1 = interopDefault(_baseIsNaN);


var require$$1$38 = Object.freeze({
	default: _baseIsNaN$1
});

var _strictIndexOf = createCommonjsModule(function (module) {
/**
 * A specialized version of `_.indexOf` which performs strict equality
 * comparisons of values, i.e. `===`.
 *
 * @private
 * @param {Array} array The array to inspect.
 * @param {*} value The value to search for.
 * @param {number} fromIndex The index to search from.
 * @returns {number} Returns the index of the matched value, else `-1`.
 */
function strictIndexOf(array, value, fromIndex) {
  var index = fromIndex - 1,
      length = array.length;

  while (++index < length) {
    if (array[index] === value) {
      return index;
    }
  }
  return -1;
}

module.exports = strictIndexOf;
});

var _strictIndexOf$1 = interopDefault(_strictIndexOf);


var require$$0$55 = Object.freeze({
	default: _strictIndexOf$1
});

var _baseIndexOf = createCommonjsModule(function (module) {
var baseFindIndex = interopDefault(require$$2$23),
    baseIsNaN = interopDefault(require$$1$38),
    strictIndexOf = interopDefault(require$$0$55);

/**
 * The base implementation of `_.indexOf` without `fromIndex` bounds checks.
 *
 * @private
 * @param {Array} array The array to inspect.
 * @param {*} value The value to search for.
 * @param {number} fromIndex The index to search from.
 * @returns {number} Returns the index of the matched value, else `-1`.
 */
function baseIndexOf(array, value, fromIndex) {
  return value === value
    ? strictIndexOf(array, value, fromIndex)
    : baseFindIndex(array, baseIsNaN, fromIndex);
}

module.exports = baseIndexOf;
});

var _baseIndexOf$1 = interopDefault(_baseIndexOf);


var require$$4$12 = Object.freeze({
	default: _baseIndexOf$1
});

var _arrayIncludes = createCommonjsModule(function (module) {
var baseIndexOf = interopDefault(require$$4$12);

/**
 * A specialized version of `_.includes` for arrays without support for
 * specifying an index to search from.
 *
 * @private
 * @param {Array} [array] The array to inspect.
 * @param {*} target The value to search for.
 * @returns {boolean} Returns `true` if `target` is found, else `false`.
 */
function arrayIncludes(array, value) {
  var length = array ? array.length : 0;
  return !!length && baseIndexOf(array, value, 0) > -1;
}

module.exports = arrayIncludes;
});

var _arrayIncludes$1 = interopDefault(_arrayIncludes);


var require$$4$11 = Object.freeze({
	default: _arrayIncludes$1
});

var _arrayIncludesWith = createCommonjsModule(function (module) {
/**
 * This function is like `arrayIncludes` except that it accepts a comparator.
 *
 * @private
 * @param {Array} [array] The array to inspect.
 * @param {*} target The value to search for.
 * @param {Function} comparator The comparator invoked per element.
 * @returns {boolean} Returns `true` if `target` is found, else `false`.
 */
function arrayIncludesWith(array, value, comparator) {
  var index = -1,
      length = array ? array.length : 0;

  while (++index < length) {
    if (comparator(value, array[index])) {
      return true;
    }
  }
  return false;
}

module.exports = arrayIncludesWith;
});

var _arrayIncludesWith$1 = interopDefault(_arrayIncludesWith);


var require$$3$11 = Object.freeze({
	default: _arrayIncludesWith$1
});

var _baseDifference = createCommonjsModule(function (module) {
var SetCache = interopDefault(require$$5$4),
    arrayIncludes = interopDefault(require$$4$11),
    arrayIncludesWith = interopDefault(require$$3$11),
    arrayMap = interopDefault(require$$6),
    baseUnary = interopDefault(require$$2$6),
    cacheHas = interopDefault(require$$0$29);

/** Used as the size to enable large array optimizations. */
var LARGE_ARRAY_SIZE = 200;

/**
 * The base implementation of methods like `_.difference` without support
 * for excluding multiple arrays or iteratee shorthands.
 *
 * @private
 * @param {Array} array The array to inspect.
 * @param {Array} values The values to exclude.
 * @param {Function} [iteratee] The iteratee invoked per element.
 * @param {Function} [comparator] The comparator invoked per element.
 * @returns {Array} Returns the new array of filtered values.
 */
function baseDifference(array, values, iteratee, comparator) {
  var index = -1,
      includes = arrayIncludes,
      isCommon = true,
      length = array.length,
      result = [],
      valuesLength = values.length;

  if (!length) {
    return result;
  }
  if (iteratee) {
    values = arrayMap(values, baseUnary(iteratee));
  }
  if (comparator) {
    includes = arrayIncludesWith;
    isCommon = false;
  }
  else if (values.length >= LARGE_ARRAY_SIZE) {
    includes = cacheHas;
    isCommon = false;
    values = new SetCache(values);
  }
  outer:
  while (++index < length) {
    var value = array[index],
        computed = iteratee ? iteratee(value) : value;

    value = (comparator || value !== 0) ? value : 0;
    if (isCommon && computed === computed) {
      var valuesIndex = valuesLength;
      while (valuesIndex--) {
        if (values[valuesIndex] === computed) {
          continue outer;
        }
      }
      result.push(value);
    }
    else if (!includes(values, computed, comparator)) {
      result.push(value);
    }
  }
  return result;
}

module.exports = baseDifference;
});

var _baseDifference$1 = interopDefault(_baseDifference);


var require$$2$24 = Object.freeze({
	default: _baseDifference$1
});

var isArrayLikeObject = createCommonjsModule(function (module) {
var isArrayLike = interopDefault(require$$3$1),
    isObjectLike = interopDefault(require$$0$1);

/**
 * This method is like `_.isArrayLike` except that it also checks if `value`
 * is an object.
 *
 * @static
 * @memberOf _
 * @since 4.0.0
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is an array-like object,
 *  else `false`.
 * @example
 *
 * _.isArrayLikeObject([1, 2, 3]);
 * // => true
 *
 * _.isArrayLikeObject(document.body.children);
 * // => true
 *
 * _.isArrayLikeObject('abc');
 * // => false
 *
 * _.isArrayLikeObject(_.noop);
 * // => false
 */
function isArrayLikeObject(value) {
  return isObjectLike(value) && isArrayLike(value);
}

module.exports = isArrayLikeObject;
});

var isArrayLikeObject$1 = interopDefault(isArrayLikeObject);


var require$$0$56 = Object.freeze({
	default: isArrayLikeObject$1
});

var without = createCommonjsModule(function (module) {
var baseDifference = interopDefault(require$$2$24),
    baseRest = interopDefault(require$$1$8),
    isArrayLikeObject = interopDefault(require$$0$56);

/**
 * Creates an array excluding all given values using
 * [`SameValueZero`](http://ecma-international.org/ecma-262/7.0/#sec-samevaluezero)
 * for equality comparisons.
 *
 * **Note:** Unlike `_.pull`, this method returns a new array.
 *
 * @static
 * @memberOf _
 * @since 0.1.0
 * @category Array
 * @param {Array} array The array to inspect.
 * @param {...*} [values] The values to exclude.
 * @returns {Array} Returns the new array of filtered values.
 * @see _.difference, _.xor
 * @example
 *
 * _.without([2, 1, 2, 3], 1, 2);
 * // => [3]
 */
var without = baseRest(function(array, values) {
  return isArrayLikeObject(array)
    ? baseDifference(array, values)
    : [];
});

module.exports = without;
});

var without$1 = interopDefault(without);

var _baseValues = createCommonjsModule(function (module) {
var arrayMap = interopDefault(require$$6);

/**
 * The base implementation of `_.values` and `_.valuesIn` which creates an
 * array of `object` property values corresponding to the property names
 * of `props`.
 *
 * @private
 * @param {Object} object The object to query.
 * @param {Array} props The property names to get values for.
 * @returns {Object} Returns the array of property values.
 */
function baseValues(object, props) {
  return arrayMap(props, function(key) {
    return object[key];
  });
}

module.exports = baseValues;
});

var _baseValues$1 = interopDefault(_baseValues);


var require$$1$39 = Object.freeze({
	default: _baseValues$1
});

var values = createCommonjsModule(function (module) {
var baseValues = interopDefault(require$$1$39),
    keys = interopDefault(require$$0$34);

/**
 * Creates an array of the own enumerable string keyed property values of `object`.
 *
 * **Note:** Non-object values are coerced to objects.
 *
 * @static
 * @since 0.1.0
 * @memberOf _
 * @category Object
 * @param {Object} object The object to query.
 * @returns {Array} Returns the array of property values.
 * @example
 *
 * function Foo() {
 *   this.a = 1;
 *   this.b = 2;
 * }
 *
 * Foo.prototype.c = 3;
 *
 * _.values(new Foo);
 * // => [1, 2] (iteration order is not guaranteed)
 *
 * _.values('hi');
 * // => ['h', 'i']
 */
function values(object) {
  return object ? baseValues(object, keys(object)) : [];
}

module.exports = values;
});

var values$1 = interopDefault(values);


var require$$0$57 = Object.freeze({
	default: values$1
});

var includes = createCommonjsModule(function (module) {
var baseIndexOf = interopDefault(require$$4$12),
    isArrayLike = interopDefault(require$$3$1),
    isString = interopDefault(require$$2),
    toInteger = interopDefault(require$$1$37),
    values = interopDefault(require$$0$57);

/* Built-in method references for those with the same name as other `lodash` methods. */
var nativeMax = Math.max;

/**
 * Checks if `value` is in `collection`. If `collection` is a string, it's
 * checked for a substring of `value`, otherwise
 * [`SameValueZero`](http://ecma-international.org/ecma-262/7.0/#sec-samevaluezero)
 * is used for equality comparisons. If `fromIndex` is negative, it's used as
 * the offset from the end of `collection`.
 *
 * @static
 * @memberOf _
 * @since 0.1.0
 * @category Collection
 * @param {Array|Object|string} collection The collection to inspect.
 * @param {*} value The value to search for.
 * @param {number} [fromIndex=0] The index to search from.
 * @param- {Object} [guard] Enables use as an iteratee for methods like `_.reduce`.
 * @returns {boolean} Returns `true` if `value` is found, else `false`.
 * @example
 *
 * _.includes([1, 2, 3], 1);
 * // => true
 *
 * _.includes([1, 2, 3], 1, 2);
 * // => false
 *
 * _.includes({ 'a': 1, 'b': 2 }, 1);
 * // => true
 *
 * _.includes('abcd', 'bc');
 * // => true
 */
function includes(collection, value, fromIndex, guard) {
  collection = isArrayLike(collection) ? collection : values(collection);
  fromIndex = (fromIndex && !guard) ? toInteger(fromIndex) : 0;

  var length = collection.length;
  if (fromIndex < 0) {
    fromIndex = nativeMax(length + fromIndex, 0);
  }
  return isString(collection)
    ? (fromIndex <= length && collection.indexOf(value, fromIndex) > -1)
    : (!!length && baseIndexOf(collection, value, fromIndex) > -1);
}

module.exports = includes;
});

var includes$1 = interopDefault(includes);

var _baseSortBy = createCommonjsModule(function (module) {
/**
 * The base implementation of `_.sortBy` which uses `comparer` to define the
 * sort order of `array` and replaces criteria objects with their corresponding
 * values.
 *
 * @private
 * @param {Array} array The array to sort.
 * @param {Function} comparer The function to define sort order.
 * @returns {Array} Returns `array`.
 */
function baseSortBy(array, comparer) {
  var length = array.length;

  array.sort(comparer);
  while (length--) {
    array[length] = array[length].value;
  }
  return array;
}

module.exports = baseSortBy;
});

var _baseSortBy$1 = interopDefault(_baseSortBy);


var require$$3$12 = Object.freeze({
	default: _baseSortBy$1
});

var _compareAscending = createCommonjsModule(function (module) {
var isSymbol = interopDefault(require$$0$42);

/**
 * Compares values to sort them in ascending order.
 *
 * @private
 * @param {*} value The value to compare.
 * @param {*} other The other value to compare.
 * @returns {number} Returns the sort order indicator for `value`.
 */
function compareAscending(value, other) {
  if (value !== other) {
    var valIsDefined = value !== undefined,
        valIsNull = value === null,
        valIsReflexive = value === value,
        valIsSymbol = isSymbol(value);

    var othIsDefined = other !== undefined,
        othIsNull = other === null,
        othIsReflexive = other === other,
        othIsSymbol = isSymbol(other);

    if ((!othIsNull && !othIsSymbol && !valIsSymbol && value > other) ||
        (valIsSymbol && othIsDefined && othIsReflexive && !othIsNull && !othIsSymbol) ||
        (valIsNull && othIsDefined && othIsReflexive) ||
        (!valIsDefined && othIsReflexive) ||
        !valIsReflexive) {
      return 1;
    }
    if ((!valIsNull && !valIsSymbol && !othIsSymbol && value < other) ||
        (othIsSymbol && valIsDefined && valIsReflexive && !valIsNull && !valIsSymbol) ||
        (othIsNull && valIsDefined && valIsReflexive) ||
        (!othIsDefined && valIsReflexive) ||
        !othIsReflexive) {
      return -1;
    }
  }
  return 0;
}

module.exports = compareAscending;
});

var _compareAscending$1 = interopDefault(_compareAscending);


var require$$0$58 = Object.freeze({
	default: _compareAscending$1
});

var _compareMultiple = createCommonjsModule(function (module) {
var compareAscending = interopDefault(require$$0$58);

/**
 * Used by `_.orderBy` to compare multiple properties of a value to another
 * and stable sort them.
 *
 * If `orders` is unspecified, all values are sorted in ascending order. Otherwise,
 * specify an order of "desc" for descending or "asc" for ascending sort order
 * of corresponding values.
 *
 * @private
 * @param {Object} object The object to compare.
 * @param {Object} other The other object to compare.
 * @param {boolean[]|string[]} orders The order to sort by for each property.
 * @returns {number} Returns the sort order indicator for `object`.
 */
function compareMultiple(object, other, orders) {
  var index = -1,
      objCriteria = object.criteria,
      othCriteria = other.criteria,
      length = objCriteria.length,
      ordersLength = orders.length;

  while (++index < length) {
    var result = compareAscending(objCriteria[index], othCriteria[index]);
    if (result) {
      if (index >= ordersLength) {
        return result;
      }
      var order = orders[index];
      return result * (order == 'desc' ? -1 : 1);
    }
  }
  // Fixes an `Array#sort` bug in the JS engine embedded in Adobe applications
  // that causes it, under certain circumstances, to provide the same value for
  // `object` and `other`. See https://github.com/jashkenas/underscore/pull/1247
  // for more details.
  //
  // This also ensures a stable sort in V8 and other engines.
  // See https://bugs.chromium.org/p/v8/issues/detail?id=90 for more details.
  return object.index - other.index;
}

module.exports = compareMultiple;
});

var _compareMultiple$1 = interopDefault(_compareMultiple);


var require$$1$41 = Object.freeze({
	default: _compareMultiple$1
});

var _baseOrderBy = createCommonjsModule(function (module) {
var arrayMap = interopDefault(require$$6),
    baseIteratee = interopDefault(require$$5$2),
    baseMap = interopDefault(require$$4$8),
    baseSortBy = interopDefault(require$$3$12),
    baseUnary = interopDefault(require$$2$6),
    compareMultiple = interopDefault(require$$1$41),
    identity = interopDefault(require$$0$8);

/**
 * The base implementation of `_.orderBy` without param guards.
 *
 * @private
 * @param {Array|Object} collection The collection to iterate over.
 * @param {Function[]|Object[]|string[]} iteratees The iteratees to sort by.
 * @param {string[]} orders The sort orders of `iteratees`.
 * @returns {Array} Returns the new sorted array.
 */
function baseOrderBy(collection, iteratees, orders) {
  var index = -1;
  iteratees = arrayMap(iteratees.length ? iteratees : [identity], baseUnary(baseIteratee));

  var result = baseMap(collection, function(value, key, collection) {
    var criteria = arrayMap(iteratees, function(iteratee) {
      return iteratee(value);
    });
    return { 'criteria': criteria, 'index': ++index, 'value': value };
  });

  return baseSortBy(result, function(object, other) {
    return compareMultiple(object, other, orders);
  });
}

module.exports = baseOrderBy;
});

var _baseOrderBy$1 = interopDefault(_baseOrderBy);


var require$$1$40 = Object.freeze({
	default: _baseOrderBy$1
});

var orderBy = createCommonjsModule(function (module) {
var baseOrderBy = interopDefault(require$$1$40),
    isArray = interopDefault(require$$0);

/**
 * This method is like `_.sortBy` except that it allows specifying the sort
 * orders of the iteratees to sort by. If `orders` is unspecified, all values
 * are sorted in ascending order. Otherwise, specify an order of "desc" for
 * descending or "asc" for ascending sort order of corresponding values.
 *
 * @static
 * @memberOf _
 * @since 4.0.0
 * @category Collection
 * @param {Array|Object} collection The collection to iterate over.
 * @param {Array[]|Function[]|Object[]|string[]} [iteratees=[_.identity]]
 *  The iteratees to sort by.
 * @param {string[]} [orders] The sort orders of `iteratees`.
 * @param- {Object} [guard] Enables use as an iteratee for methods like `_.reduce`.
 * @returns {Array} Returns the new sorted array.
 * @example
 *
 * var users = [
 *   { 'user': 'fred',   'age': 48 },
 *   { 'user': 'barney', 'age': 34 },
 *   { 'user': 'fred',   'age': 40 },
 *   { 'user': 'barney', 'age': 36 }
 * ];
 *
 * // Sort by `user` in ascending order and by `age` in descending order.
 * _.orderBy(users, ['user', 'age'], ['asc', 'desc']);
 * // => objects for [['barney', 36], ['barney', 34], ['fred', 48], ['fred', 40]]
 */
function orderBy(collection, iteratees, orders, guard) {
  if (collection == null) {
    return [];
  }
  if (!isArray(iteratees)) {
    iteratees = iteratees == null ? [] : [iteratees];
  }
  orders = guard ? undefined : orders;
  if (!isArray(orders)) {
    orders = orders == null ? [] : [orders];
  }
  return baseOrderBy(collection, iteratees, orders);
}

module.exports = orderBy;
});

var orderBy$1 = interopDefault(orderBy);

var TARGET_TYPES = {
  'fig': ['figure', 'fig-group'],
  'bibr': ['ref'],
  'table': ['table-wrap'],
  'other': ['figure']
}

/*
  Computes available targets for a given reference node

  Returns an array of entries with all info needed by XRefTargets to render
  [
    {
      selected: true,
      node: TARGET_NODE
    }
    ,...
  ]
*/
function getXRefTargets(node) {
  var doc = node.getDocument()
  var selectedTargets = node.targets
  var nodesByType = doc.getIndex('type')
  var refType = node.referenceType
  var targetTypes = TARGET_TYPES[refType]
  var targets = []

  targetTypes.forEach(function(targetType) {
    var nodesForType = map$1(nodesByType.get(targetType))

    nodesForType.forEach(function(node) {
      var isSelected = includes$1(selectedTargets, node.id)
      targets.push({
        selected: isSelected,
        node: node
      })
    })
  })

  // Makes the selected targets go to top
  targets = orderBy$1(targets, ['selected'], ['desc'])
  return targets
}

/*
  Editing of XRefTargets
*/
var XRefTargets = (function (Component$$1) {
  function XRefTargets () {
    Component$$1.apply(this, arguments);
  }

  if ( Component$$1 ) XRefTargets.__proto__ = Component$$1;
  XRefTargets.prototype = Object.create( Component$$1 && Component$$1.prototype );
  XRefTargets.prototype.constructor = XRefTargets;

  XRefTargets.prototype.getInitialState = function getInitialState () {
    return {
      targets: getXRefTargets(this.props.node)
    }
  };

  // this.willReceiveProps = function() {
  //   console.log('XRefTargets.willReceiveProps', this.__id__);
  // };

  // this.dispose = function() {
  //   console.log('XRefTargets.dispose', this.__id__);
  // };

  XRefTargets.prototype.render = function render ($$) {
    var el = $$('div').addClass('sc-xref-targets')
    var componentRegistry = this.context.componentRegistry

    this.state.targets.forEach(function(target) {
      var TargetComponent = componentRegistry.get(target.node.type+'-target')
      var props = clone$1(target)
      // disable editing in TargetComponent
      props.disabled = true
      el.append(
        $$(TargetComponent, props)
          .on('click', this._toggleTarget.bind(this, target.node))
      )
    }.bind(this))
    return el
  };

  XRefTargets.prototype._toggleTarget = function _toggleTarget (targetNode) {
    var node = this.props.node
    var surface = this.context.surfaceManager.getFocusedSurface()
    // console.log('XRefTargets: toggling target of ', node.id);

    // Update model
    var newTargets = node.targets
    if (newTargets.indexOf(targetNode.id) > 0) {
      newTargets = without$1(newTargets, targetNode.id)
    } else {
      newTargets.push(targetNode.id)
    }

    // Compute visual feedback
    var targets = this.state.targets;
    var target = find$1(this.state.targets, function(t) {
      return t.node === targetNode
    })

    // Flip the selected flag
    target.selected = !target.selected

    // Triggers a rerender
    this.setState({
      targets: targets
    })

    // console.log('XRefTargets: setting targets of ', node.id, 'to', newTargets);
    // ATTENTION: still we need to use surface.transaction()
    surface.transaction(function(tx) {
      tx.set([node.id, 'targets'], newTargets)
    })
  };

  return XRefTargets;
}(substance.Component));

/*
  Shown in OverlayTools
*/
var EditXRefTool = (function (Tool$$1) {
  function EditXRefTool() {
    var args = [], len = arguments.length;
    while ( len-- ) args[ len ] = arguments[ len ];

    Tool$$1.apply(this, args)
    this.handleActions({
      'closeModal': this._doneEditing,
      'doneEditing': this._doneEditing
    })
  }

  if ( Tool$$1 ) EditXRefTool.__proto__ = Tool$$1;
  EditXRefTool.prototype = Object.create( Tool$$1 && Tool$$1.prototype );
  EditXRefTool.prototype.constructor = EditXRefTool;

  EditXRefTool.prototype.render = function render ($$) {
    var Modal = this.getComponent('modal')
    var Button$$1 = this.getComponent('button')

    var node = this.props.node
    var el = $$('div').addClass('sc-edit-xref-tool')

    el.append(
      $$(Button$$1, {
        icon: 'edit',
        style: this.props.style
      })
      .attr('title', this.getLabel('edit-xref'))
      .on('click', this._onEdit),
      $$(Button$$1, {
        icon: 'delete',
        style: this.props.style
      })
      .attr('title', this.getLabel('delete-xref'))
      .on('click', this._onDelete)
    )

    if (this.state.edit) {
      el.append(
        $$(Modal, {
          width: 'large'
        }).append(
          $$(XRefTargets, {
            node: node
          }).ref('targets')
        )
      )
    }
    return el;
  };

  EditXRefTool.prototype._onEdit = function _onEdit () {
    this.setState({
      edit: true
    })
  };

  EditXRefTool.prototype._doneEditing = function _doneEditing () {
    this.setState({
      edit: false
    })
  };

  EditXRefTool.prototype._onDelete = function _onDelete () {
    var ds = this.context.documentSession;
    ds.transaction(function(tx, args) {
      return substance.deleteSelection(tx, args)
    })
  };

  return EditXRefTool;
}(substance.Tool));

var AddXRefCommand = (function (InsertInlineNodeCommand$$1) {
  function AddXRefCommand () {
    InsertInlineNodeCommand$$1.apply(this, arguments);
  }

  if ( InsertInlineNodeCommand$$1 ) AddXRefCommand.__proto__ = InsertInlineNodeCommand$$1;
  AddXRefCommand.prototype = Object.create( InsertInlineNodeCommand$$1 && InsertInlineNodeCommand$$1.prototype );
  AddXRefCommand.prototype.constructor = AddXRefCommand;

  AddXRefCommand.prototype.createNodeData = function createNodeData () {
    return {
      attributes: {'ref-type': 'bibr'},
      targets: [],
      label: '???',
      type: 'xref'
    }
  };

  return AddXRefCommand;
}(substance.InsertInlineNodeCommand));

var AddXRefTool = (function (AnnotationTool$$1) {
	function AddXRefTool () {
		AnnotationTool$$1.apply(this, arguments);
	}if ( AnnotationTool$$1 ) AddXRefTool.__proto__ = AnnotationTool$$1;
	AddXRefTool.prototype = Object.create( AnnotationTool$$1 && AnnotationTool$$1.prototype );
	AddXRefTool.prototype.constructor = AddXRefTool;

	

	return AddXRefTool;
}(substance.AnnotationTool));

var XrefPackage = {
  name: 'xref',
  configure: function(config) {
    config.addNode(XRef)
    config.addComponent(XRef.type, XRefComponent)
    config.addConverter('jats', XRefConverter)

    config.addCommand('edit-xref', EditXRefCommand, {nodeType: XRef.type})
    config.addCommand('add-xref', AddXRefCommand, {nodeType: XRef.type})

    config.addTool('add-xref', AddXRefTool, {target: 'insert'})
    config.addTool('edit-xref', EditXRefTool, { target: 'overlay' })

    config.addLabel('add-xref', 'Cross Reference')
    config.addIcon('add-xref', { 'fontawesome': 'fa-external-link' })
    config.addLabel(XRef.type, {
      en: 'Cross Reference'
    })
    config.addLabel('edit-xref', {
      en: 'Edit Reference'
    })
    config.addLabel('delete-xref', {
      en: 'Delete Reference'
    })
  }
}

var JATSPackage = {
  name: 'jats',
  configure: function(config) {
    config.import(AffPackage)
    config.import(ArticlePackage)
    config.import(ArticleMetaPackage)
    config.import(ArticleTitlePackage)
    config.import(ContribPackage)
    config.import(ContribGroupPackage)
    config.import(BackPackage)
    config.import(BodyPackage)
    config.import(BoldPackage)
    config.import(ItalicPackage)
    config.import(CaptionPackage)
    config.import(ExtLinkPackage)
    config.import(FigurePackage)
    config.import(FootnotePackage)
    config.import(FrontPackage)
    config.import(GraphicPackage)
    config.import(LabelPackage)
    config.import(MonospacePackage)
    config.import(ParagraphPackage)
    config.import(RefPackage)
    config.import(RefListPackage)
    config.import(SectionPackage)
    config.import(SubscriptPackage)
    config.import(SuperscriptPackage)
    config.import(TablePackage)
    config.import(TitlePackage)
    config.import(TitleGroupPackage)
    config.import(XrefPackage)

    config.addImporter('jats', JATSImporter)
    config.addExporter('jats', JATSExporter)
  }
}

var HeadingNode = (function (TextBlock$$1) {
  function HeadingNode () {
    TextBlock$$1.apply(this, arguments);
  }if ( TextBlock$$1 ) HeadingNode.__proto__ = TextBlock$$1;
  HeadingNode.prototype = Object.create( TextBlock$$1 && TextBlock$$1.prototype );
  HeadingNode.prototype.constructor = HeadingNode;

  

  return HeadingNode;
}(substance.TextBlock));

HeadingNode.type = "heading"

HeadingNode.define({
  // just a reference to the original node
  // which will be used to retain XML attributes
  sectionId: { type: 'id', optional: true },
  level: { type: "number", default: 1 }
})

var HeadingComponent = (function (TextBlockComponent$$1) {
  function HeadingComponent () {
    TextBlockComponent$$1.apply(this, arguments);
  }

  if ( TextBlockComponent$$1 ) HeadingComponent.__proto__ = TextBlockComponent$$1;
  HeadingComponent.prototype = Object.create( TextBlockComponent$$1 && TextBlockComponent$$1.prototype );
  HeadingComponent.prototype.constructor = HeadingComponent;

  HeadingComponent.prototype.render = function render ($$) {
    var el = TextBlockComponent$$1.prototype.render.call(this, $$)
    return el.addClass("sc-heading sm-level-"+this.props.node.level)
  };

  return HeadingComponent;
}(substance.TextBlockComponent));

var HeadingPackage$1 = {
  name: 'heading',
  configure: function(config) {
    config.addNode(HeadingNode)
    config.addComponent(HeadingNode.type, HeadingComponent)
    config.addConverter('html', substance.HeadingPackage.HeadingHTMLConverter)
    config.addTextType({
      name: 'heading1',
      data: {type: 'heading', level: 1}
    })
    config.addTextType({
      name: 'heading2',
      data: {type: 'heading', level: 2}
    })
    config.addTextType({
      name: 'heading3',
      data: {type: 'heading', level: 3}
    })
    config.addLabel('heading1', {
      en: 'Heading 1',
      de: 'Überschrift 1'
    })
    config.addLabel('heading2', {
      en: 'Heading 2',
      de: 'Überschrift 2'
    })
    config.addLabel('heading3', {
      en: 'Heading 3',
      de: 'Überschrift 3'
    })
  }
}

var CommonPackage = {
  name: 'common',
  configure: function(config) {
    config.addComponent('tool-target-insert', substance.ToolDropdown)
    config.addLabel('insert', 'Insert')
  }
}

var InlineWrapperJATSConverter = {

  type: 'inline-wrapper',

  matchElement: function(el, converter) {
    var blockConverter = converter._getConverterForElement(el, 'block')
    return Boolean(blockConverter && blockConverter.type !== 'unsupported')
  },

  import: function(el, node, converter) {
    node.id = converter.nextId('inline-wrapper')
    node.wrappedNode = converter.convertElement(el).id
  },

  export: function(node, el, converter) {
    return converter.convertNode(node.wrappedNode)
  }

}

var InlineWrapperPackage$1 = {
  name: 'inline-wrapper',
  configure: function(config) {
    config.import(substance.InlineWrapperPackage)
    config.addConverter('jats', InlineWrapperJATSConverter)
  }
}

var UnsupportedNode = (function (BlockNode$$1) {
  function UnsupportedNode () {
    BlockNode$$1.apply(this, arguments);
  }if ( BlockNode$$1 ) UnsupportedNode.__proto__ = BlockNode$$1;
  UnsupportedNode.prototype = Object.create( BlockNode$$1 && BlockNode$$1.prototype );
  UnsupportedNode.prototype.constructor = UnsupportedNode;

  

  return UnsupportedNode;
}(substance.BlockNode));

UnsupportedNode.type = 'unsupported'

UnsupportedNode.define({
  attributes: { type: 'object', default: {} },
  xmlContent: {type: 'string', default: ''},
  tagName: 'string'
})

var UnsupportedInlineNode = (function (InlineNode$$1) {
  function UnsupportedInlineNode () {
    InlineNode$$1.apply(this, arguments);
  }if ( InlineNode$$1 ) UnsupportedInlineNode.__proto__ = InlineNode$$1;
  UnsupportedInlineNode.prototype = Object.create( InlineNode$$1 && InlineNode$$1.prototype );
  UnsupportedInlineNode.prototype.constructor = UnsupportedInlineNode;

  

  return UnsupportedInlineNode;
}(substance.InlineNode));

UnsupportedInlineNode.type = 'unsupported-inline'

UnsupportedInlineNode.define({
  attributes: { type: 'object', default: {} },
  xmlContent: {type: 'string', default: ''},
  tagName: 'string'
})

var UnsupportedNodeComponent = (function (Component$$1) {
  function UnsupportedNodeComponent () {
    Component$$1.apply(this, arguments);
  }

  if ( Component$$1 ) UnsupportedNodeComponent.__proto__ = Component$$1;
  UnsupportedNodeComponent.prototype = Object.create( Component$$1 && Component$$1.prototype );
  UnsupportedNodeComponent.prototype.constructor = UnsupportedNodeComponent;

  UnsupportedNodeComponent.prototype.render = function render ($$) {
    var el = $$('span')
      .addClass('sc-unsupported-inline-node')
      .attr('data-id', this.props.node.id)
      .attr('contenteditable', false)
      .append(
        $$('button').addClass('se-toggle').append(
          $$('pre').append(
            $$('code').append(
              '<'+this.props.node.tagName+'>'
            )
          )
        )
      )
    return el
  };

  return UnsupportedNodeComponent;
}(substance.Component));

UnsupportedNodeComponent.fullWidth = true
UnsupportedNodeComponent.noStyle = true

var UnsupportedInlineNodeComponent = (function (Component$$1) {
  function UnsupportedInlineNodeComponent () {
    Component$$1.apply(this, arguments);
  }

  if ( Component$$1 ) UnsupportedInlineNodeComponent.__proto__ = Component$$1;
  UnsupportedInlineNodeComponent.prototype = Object.create( Component$$1 && Component$$1.prototype );
  UnsupportedInlineNodeComponent.prototype.constructor = UnsupportedInlineNodeComponent;

  UnsupportedInlineNodeComponent.prototype.render = function render ($$) {
    var el = $$('span')
      .addClass('sc-unsupported-inline-node')
      .attr('data-id', this.props.node.id)
      .attr('contenteditable', false)
      .append(
        '<'+this.props.node.tagName+'>'
      )
    return el
  };

  return UnsupportedInlineNodeComponent;
}(substance.Component));

var UnsupportedInlineNodeJATSConverter = {

  type: 'unsupported-inline',

  matchElement: function() {
    return true;
  },

  import: UnsupportedNodeJATSConverter.import,
  export: UnsupportedNodeJATSConverter.export

}

var UnsupportedInlineNodeCommand = (function (EditInlineNodeCommand$$1) {
	function UnsupportedInlineNodeCommand () {
		EditInlineNodeCommand$$1.apply(this, arguments);
	}if ( EditInlineNodeCommand$$1 ) UnsupportedInlineNodeCommand.__proto__ = EditInlineNodeCommand$$1;
	UnsupportedInlineNodeCommand.prototype = Object.create( EditInlineNodeCommand$$1 && EditInlineNodeCommand$$1.prototype );
	UnsupportedInlineNodeCommand.prototype.constructor = UnsupportedInlineNodeCommand;

	

	return UnsupportedInlineNodeCommand;
}(substance.EditInlineNodeCommand));

UnsupportedInlineNodeCommand.type = 'unsupported-inline'

/*
  Prompt shown when an unsupported node is selected.
*/

var UnsupportedInlineNodeTool = (function (Tool$$1) {
  function UnsupportedInlineNodeTool() {
    var args = [], len = arguments.length;
    while ( len-- ) args[ len ] = arguments[ len ];

    Tool$$1.apply(this, args)
    this.handleActions({
      'closeModal': this._closeModal,
      'xmlSaved': this._closeModal
    })
  }

  if ( Tool$$1 ) UnsupportedInlineNodeTool.__proto__ = Tool$$1;
  UnsupportedInlineNodeTool.prototype = Object.create( Tool$$1 && Tool$$1.prototype );
  UnsupportedInlineNodeTool.prototype.constructor = UnsupportedInlineNodeTool;


  UnsupportedInlineNodeTool.prototype._closeModal = function _closeModal () {
    this.setState({
      editXML: false
    })
  };

  UnsupportedInlineNodeTool.prototype._onEdit = function _onEdit () {
    this.setState({
      editXML: true
    })
  };

  UnsupportedInlineNodeTool.prototype._onDelete = function _onDelete () {
    var ds = this.context.documentSession
    ds.transaction(function(tx, args) {
      return substance.deleteSelection(tx, args)
    })
  };

  UnsupportedInlineNodeTool.prototype.render = function render ($$) {
    var el = $$('div').addClass('sc-unsupported-node-tool')
    var node = this.props.node
    var Modal = this.getComponent('modal')
    var Button$$1 = this.getComponent('button')

    el.append(
      $$(Button$$1, {
        icon: 'edit',
        style: this.props.style
      })
      .attr('title', 'Edit XML')
      .on('click', this._onEdit),
      $$(Button$$1, {
        icon: 'delete',
        style: this.props.style
      })
      .attr('title', 'Delete Element')
      .on('click', this._onDelete)
    )

    if (this.state.editXML) {
      el.append(
        $$(Modal, {
          width: 'medium'
        }).append(
          $$(EditXML, {
            node: node
          })
        )
      )
    }
    return el
  };

  return UnsupportedInlineNodeTool;
}(substance.Tool));

var UnsupportedNodePackage = {
  name: 'unsupported',
  configure: function(config) {
    config.addNode(UnsupportedNode)
    config.addNode(UnsupportedInlineNode)
    config.addComponent(UnsupportedNode.type, UnsupportedNodeComponent)
    config.addComponent(UnsupportedInlineNode.type, UnsupportedInlineNodeComponent)
    config.addCommand(UnsupportedInlineNode.type, UnsupportedInlineNodeCommand, {nodeType: UnsupportedInlineNode.type})
    config.addTool(UnsupportedInlineNode.type, UnsupportedInlineNodeTool, { overlay: true })
    config.addConverter('jats', UnsupportedNodeJATSConverter)
    config.addConverter('jats', UnsupportedInlineNodeJATSConverter)
  }
}

var AuthorPackage = {
  name: 'author',
  configure: function(config) {
    config.setInterfaceComponentClass(Author)

    // Now import base packages
    config.import(substance.BasePackage)
    config.import(substance.PersistencePackage)

    config.import(JATSPackage)
    config.import(HeadingPackage$1)
    config.import(CommonPackage)

    // support inline wrappers, for all hybrid types that can be
    // block-level but also inline.
    config.import(InlineWrapperPackage$1)
    // catch all converters
    config.import(UnsupportedNodePackage)

    // Override Importer/Exporter
    config.addImporter('jats', AuthorImporter)
    config.addExporter('jats', AuthorExporter)
  }
}

/*
  Manages a table of content for Publisher.

  Used by {@link ui/TOCPanel} and {@link ui/ScrollPane}).

  @class PublisherTOCProvider
  @component

  @prop {model/DocumentSession}
*/
var PublisherTOCProvider = (function (EventEmitter$$1) {
  function PublisherTOCProvider(documentSession) {
    EventEmitter$$1.call(this, documentSession)

    this.documentSession = documentSession
    this.entries = this.computeEntries()
    if (this.entries.length > 0) {
      this.activeEntry = this.entries[0].id
    } else {
      this.activeEntry = null;
    }
    this.documentSession.on('update', this.handleDocumentChange, this)
  }

  if ( EventEmitter$$1 ) PublisherTOCProvider.__proto__ = EventEmitter$$1;
  PublisherTOCProvider.prototype = Object.create( EventEmitter$$1 && EventEmitter$$1.prototype );
  PublisherTOCProvider.prototype.constructor = PublisherTOCProvider;

  PublisherTOCProvider.prototype.dispose = function dispose () {
    this.documentSession.disconnect(this)
  };

  PublisherTOCProvider.prototype.getDocument = function getDocument () {
    return this.documentSession.getDocument()
  };

  // Inspects a document change and recomputes the
  // entries if necessary
  PublisherTOCProvider.prototype.handleDocumentChange = function handleDocumentChange (change) { // eslint-disable-line
    var needsUpdate = false
    if (needsUpdate) {
      this.entries = this.computeEntries()
      this.emit('toc:updated')
    }
  };

  PublisherTOCProvider.prototype._computeEntriesForContainer = function _computeEntriesForContainer (container, level) {
    var doc = this.getDocument()
    var entries = []
    container.nodes.forEach(function(nodeId) {
      var node = doc.get(nodeId)
      if (node.type === 'section') {
        entries.push({
          id: node.id,
          name: node.getTitle(),
          level: level,
          node: node
        })

        // Sections may contain subsections
        entries = entries.concat(
          this._computeEntriesForContainer(node, level + 1)
        )
      }
    }.bind(this))
    return entries
  };

  PublisherTOCProvider.prototype.computeEntries = function computeEntries () {
    var doc = this.getDocument()
    var body = doc.get('body')
    var level = 1
    var entries = this._computeEntriesForContainer(body, level)
    return entries
  };

  PublisherTOCProvider.prototype.getEntries = function getEntries () {
    return this.entries
  };

  return PublisherTOCProvider;
}(substance.EventEmitter));

PublisherTOCProvider.prototype.markActiveEntry = substance.TOCProvider.prototype.markActiveEntry

var Publisher = (function (AbstractWriter$$1) {
  function Publisher () {
    AbstractWriter$$1.apply(this, arguments);
  }

  if ( AbstractWriter$$1 ) Publisher.__proto__ = AbstractWriter$$1;
  Publisher.prototype = Object.create( AbstractWriter$$1 && AbstractWriter$$1.prototype );
  Publisher.prototype.constructor = Publisher;

  Publisher.prototype.render = function render ($$) {
    var SplitPane$$1 = this.componentRegistry.get('split-pane')
    var el = $$('div').addClass('sc-publisher')
    el.append(
      $$(SplitPane$$1, {splitType: 'vertical', sizeB: '400px'}).append(
        this._renderMainSection($$),
        this._renderContextSection($$)
      )
    )
    return el
  };

  Publisher.prototype._renderContextSection = function _renderContextSection ($$) {
    return $$('div').addClass('se-context-section').append(
      $$(substance.TOC)
    )
  };

  Publisher.prototype._renderMainSection = function _renderMainSection ($$) {
    var SplitPane$$1 = this.componentRegistry.get('split-pane')
    var mainSection = $$('div').addClass('se-main-section')
    var splitPane = $$(SplitPane$$1, {splitType: 'horizontal'}).append(
      this._renderToolbar($$),
      this._renderContentPanel($$)
    );
    mainSection.append(splitPane)
    return mainSection
  };

  Publisher.prototype._renderContentPanel = function _renderContentPanel ($$) {
    var doc = this.documentSession.getDocument()
    var Layout$$1 = this.componentRegistry.get('layout')
    var ScrollPane$$1 = this.componentRegistry.get('scroll-pane')

    var contentPanel = $$(ScrollPane$$1, {
      tocProvider: this.tocProvider,
      scrollbarType: 'substance',
      scrollbarPosition: 'left',
      overlay: substance.ProseEditorOverlayTools,
      highlights: this.contentHighlights
    }).ref('contentPanel')

    var layout = $$(Layout$$1, {
      width: 'large'
    })

    var ArticleComponent = this.componentRegistry.get('article')

    var article = doc.get('article')
    layout.append(
      $$(ArticleComponent, {
        node: article,
        bodyId: 'body',
        disabled: this.props.disabled,
        configurator: this.props.configurator
      })
    )
    contentPanel.append(layout)
    return contentPanel
  };

  Publisher.prototype._scrollTo = function _scrollTo (nodeId) {
    this.refs.contentPanel.scrollTo(nodeId)
  };

  Publisher.prototype._getExporter = function _getExporter () {
    return this.props.configurator.createExporter('jats')
  };

  Publisher.prototype._getTOCProvider = function _getTOCProvider () {
    return new PublisherTOCProvider(this.documentSession)
  };

  return Publisher;
}(AbstractWriter));

var PublisherPackage = {
  name: 'publisher',
  configure: function(config) {
    config.setInterfaceComponentClass(Publisher)

    config.import(substance.BasePackage)
    config.import(substance.PersistencePackage)
    config.import(JATSPackage)
    config.import(CommonPackage)

    // support inline wrappers, for all hybrid types that can be
    // block-level but also inline.
    config.import(InlineWrapperPackage$1)
    // catch all converters
    config.import(UnsupportedNodePackage)
  }
}

var TagAffCommand = (function (Command$$1) {
  function TagAffCommand () {
    Command$$1.apply(this, arguments);
  }

  if ( Command$$1 ) TagAffCommand.__proto__ = Command$$1;
  TagAffCommand.prototype = Object.create( Command$$1 && Command$$1.prototype );
  TagAffCommand.prototype.constructor = TagAffCommand;

  TagAffCommand.prototype.getCommandState = function getCommandState (params, context) {
    var documentSession = context.documentSession
    var doc = documentSession.getDocument()

    var sel = this._getSelection(params)
    var disabled = true
    var stringName // author name without components

    if (sel.isPropertySelection() && !sel.isCollapsed()) {
      disabled = false
      stringName = substance.documentHelpers.getTextForSelection(doc, sel)
    }

    return {
      disabled: disabled,
      stringName: stringName,
      active: false
    }
  };

  TagAffCommand.prototype.execute = function execute (params, context) {
    var stringName = params.stringName
    var documentSession = context.documentSession

    documentSession.transaction(function(tx, args) {
      var contribGroupNodeId = tx.document.getContribGroup().id
      var contribGroupNode = tx.get(contribGroupNodeId)
      var newAff = {
        id: substance.uuid('aff'),
        type: 'aff',
        xmlContent: stringName,
        attributes: {
          generator: 'texture'
        }
      }

      var affNode = tx.create(newAff)
      contribGroupNode.show(affNode.id)
      args = substance.deleteSelection(tx, args)
      return args
    })

    return {status: 'ok'}
  };

  return TagAffCommand;
}(substance.Command));

var TagAffTool = (function (Tool$$1) {
	function TagAffTool () {
		Tool$$1.apply(this, arguments);
	}if ( Tool$$1 ) TagAffTool.__proto__ = Tool$$1;
	TagAffTool.prototype = Object.create( Tool$$1 && Tool$$1.prototype );
	TagAffTool.prototype.constructor = TagAffTool;

	

	return TagAffTool;
}(substance.Tool));

var TagRefCommand = (function (Command$$1) {
  function TagRefCommand () {
    Command$$1.apply(this, arguments);
  }

  if ( Command$$1 ) TagRefCommand.__proto__ = Command$$1;
  TagRefCommand.prototype = Object.create( Command$$1 && Command$$1.prototype );
  TagRefCommand.prototype.constructor = TagRefCommand;

  TagRefCommand.prototype.getCommandState = function getCommandState (params, context) {
    var documentSession = context.documentSession
    var doc = documentSession.getDocument()

    var sel = this._getSelection(params)
    var disabled = true
    var nodeIds // all nodes included in the selection

    if (sel.isPropertySelection()) {
      disabled = false
      nodeIds = [ sel.path[0] ]
    } else if (sel.isContainerSelection()) {
      var fragments = sel.getFragments()
      nodeIds =
        fragments.map(function (frag) { return frag.path[0]; })
      var isParagraph =
        function (nodeId) { return doc.get(nodeId).type === 'paragraph'; }
      var onlyParagraphs =
        function (nodeIds) { return nodeIds.every(isParagraph); }

      if (onlyParagraphs(nodeIds)) {
        disabled = false
      }
    }

    return {
      disabled: disabled,
      nodeIds: nodeIds,
      active: false
    }
  };

  TagRefCommand.prototype.execute = function execute (params, context) {
    var nodeIds = params.nodeIds
    var documentSession = context.documentSession
    var focusedSurface = context.surfaceManager.getFocusedSurface()

    documentSession.transaction(function(tx) {
      var refListId = tx.document.getRefList().id
      var refListNode = tx.get(refListId)

      nodeIds.forEach(function (nodeId) {
        var p = tx.get(nodeId)
        var newRef = {
          id: substance.uuid('ref'),
          type: 'ref',
          xmlContent: '<mixed-citation>'+p.content+'</mixed-citation>',
          attributes: {
            generator: 'texture'
          }
        }
        var refNode = tx.create(newRef)
        refListNode.show(refNode.id)

        // Remove original paragraphs from container
        // We need to look up the owning container
        // by inspecting the focused surface.
        var containerId = focusedSurface.getContainerId()
        if (containerId) {
          var container = tx.get(containerId)
          container.hide(nodeId)
          tx.delete(nodeId)
        }
      })

      return {
        selection: substance.Selection.nullSelection
      }
    })

    return {status: 'ok'}
  };

  return TagRefCommand;
}(substance.Command));

var TagRefTool = (function (Tool$$1) {
	function TagRefTool () {
		Tool$$1.apply(this, arguments);
	}if ( Tool$$1 ) TagRefTool.__proto__ = Tool$$1;
	TagRefTool.prototype = Object.create( Tool$$1 && Tool$$1.prototype );
	TagRefTool.prototype.constructor = TagRefTool;

	

	return TagRefTool;
}(substance.Tool));

var TagContribCommand = (function (Command$$1) {
  function TagContribCommand () {
    Command$$1.apply(this, arguments);
  }

  if ( Command$$1 ) TagContribCommand.__proto__ = Command$$1;
  TagContribCommand.prototype = Object.create( Command$$1 && Command$$1.prototype );
  TagContribCommand.prototype.constructor = TagContribCommand;

  TagContribCommand.prototype.getCommandState = function getCommandState (params, context) {
    var documentSession = context.documentSession
    var doc = documentSession.getDocument()

    var sel = this._getSelection(params)
    var disabled = true
    var stringName // author name without components

    if (sel.isPropertySelection() && !sel.isCollapsed()) {
      disabled = false
      stringName = substance.documentHelpers.getTextForSelection(doc, sel)
    }

    return {
      disabled: disabled,
      stringName: stringName,
      active: false
    }
  };

  TagContribCommand.prototype.execute = function execute (params, context) {
    var stringName = params.stringName
    var documentSession = context.documentSession

    documentSession.transaction(function(tx, args) {
      var contribGroupNodeId = tx.document.getContribGroup().id
      var contribGroupNode = tx.get(contribGroupNodeId)
      var newContrib = {
        id: substance.uuid('contrib'),
        type: 'contrib',
        xmlContent: '<string-name>'+stringName+'</string-name>',
        attributes: {
          generator: 'texture'
        }
      }

      var contribNode = tx.create(newContrib)
      contribGroupNode.show(contribNode.id)
      args = substance.deleteSelection(tx, args)
      return args
    })

    return {status: 'ok'}
  };

  return TagContribCommand;
}(substance.Command));

var TagContribTool = (function (Tool$$1) {
	function TagContribTool () {
		Tool$$1.apply(this, arguments);
	}if ( Tool$$1 ) TagContribTool.__proto__ = Tool$$1;
	TagContribTool.prototype = Object.create( Tool$$1 && Tool$$1.prototype );
	TagContribTool.prototype.constructor = TagContribTool;

	

	return TagContribTool;
}(substance.Tool));

var TaggingPackage = {
  name: 'tagging-example',
  configure: function(config) {

    // Tagging
    // -------

    // Needed by TextureToolbar (lookup via tool-target-{targetname})
    config.addComponent('tool-target-tag', substance.ToolDropdown)
    config.addIcon('tool-target-tag', { 'fontawesome': 'fa-bullseye' })
    config.addLabel('tag', 'Tag')

    // aff
    config.addCommand('tag-aff', TagAffCommand)
    config.addTool('tag-aff', TagAffTool, {target: 'tag'})
    config.addIcon('tag-aff', { 'fontawesome': 'fa-bullseye' })
    config.addLabel('tag-aff', 'Affiliation')

    // ref
    config.addCommand('tag-ref', TagRefCommand)
    config.addTool('tag-ref', TagRefTool, {target: 'tag'})

    config.addIcon('tag-ref', { 'fontawesome': 'fa-bullseye' })
    config.addLabel('tag-ref', 'Reference')

    //contrib
    config.addCommand('tag-contrib', TagContribCommand)
    config.addTool('tag-contrib', TagContribTool, {target: 'tag'})
    config.addIcon('tag-contrib', { 'fontawesome': 'fa-bullseye' })
    config.addLabel('tag-contrib', 'Author')
  }
}

// texture

exports.Texture = Texture;
exports.TextureConfigurator = TextureConfigurator;
exports.ExampleXMLStore = ExampleXMLStore;
exports.Author = Author;
exports.AuthorPackage = AuthorPackage;
exports.Publisher = Publisher;
exports.PublisherPackage = PublisherPackage;
exports.TaggingPackage = TaggingPackage;

Object.defineProperty(exports, '__esModule', { value: true });

})));

//# sourceMappingURL=./texture.js.map