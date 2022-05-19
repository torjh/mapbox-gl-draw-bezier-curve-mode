"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;

var CommonSelectors = _interopRequireWildcard(require("@mapbox/mapbox-gl-draw/src/lib/common_selectors"));

var _double_click_zoom = _interopRequireDefault(require("@mapbox/mapbox-gl-draw/src/lib/double_click_zoom"));

var Constants = _interopRequireWildcard(require("@mapbox/mapbox-gl-draw/src/constants"));

var _create_vertex = _interopRequireDefault(require("@mapbox/mapbox-gl-draw/src/lib/create_vertex"));

var _BezierGroup = _interopRequireDefault(require("../utils/BezierGroup"));

var _BezierCurve = _interopRequireDefault(require("../utils/BezierCurve"));

var _BezierNode = _interopRequireDefault(require("../utils/BezierNode"));

var _createBezierPoint = _interopRequireDefault(require("../utils/createBezierPoint"));

var _createBezierHandle = _interopRequireDefault(require("../utils/createBezierHandle"));

var _createBezierHandleLine = _interopRequireDefault(require("../utils/createBezierHandleLine"));

var _bezierUtils = require("../utils/bezierUtils");

var _additional_selectors = require("../utils/additional_selectors");

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _getRequireWildcardCache(nodeInterop) { if (typeof WeakMap !== "function") return null; var cacheBabelInterop = new WeakMap(); var cacheNodeInterop = new WeakMap(); return (_getRequireWildcardCache = function _getRequireWildcardCache(nodeInterop) { return nodeInterop ? cacheNodeInterop : cacheBabelInterop; })(nodeInterop); }

function _interopRequireWildcard(obj, nodeInterop) { if (!nodeInterop && obj && obj.__esModule) { return obj; } if (obj === null || typeof obj !== "object" && typeof obj !== "function") { return { default: obj }; } var cache = _getRequireWildcardCache(nodeInterop); if (cache && cache.has(obj)) { return cache.get(obj); } var newObj = {}; var hasPropertyDescriptor = Object.defineProperty && Object.getOwnPropertyDescriptor; for (var key in obj) { if (key !== "default" && Object.prototype.hasOwnProperty.call(obj, key)) { var desc = hasPropertyDescriptor ? Object.getOwnPropertyDescriptor(obj, key) : null; if (desc && (desc.get || desc.set)) { Object.defineProperty(newObj, key, desc); } else { newObj[key] = obj[key]; } } } newObj.default = obj; if (cache) { cache.set(obj, newObj); } return newObj; }

var DrawBezierCurve = {};
var draw = null;

DrawBezierCurve.onSetup = function (opts) {
  opts = opts || {};
  var featureId = opts.featureId;

  if (featureId) {
    console.log("option featureId is currently ignored on DrawBezierCurve");
  }

  var line;
  var direction = 'forward';
  var bezierGroup = new _BezierGroup.default([new _BezierCurve.default()]);
  line = this.newFeature(bezierGroup.geojson);
  this.addFeature(line);
  draw = this;
  this.clearSelectedFeatures();

  _double_click_zoom.default.disable(this);

  this.updateUIClasses({
    mouse: Constants.cursors.ADD
  });
  this.activateUIButton(Constants.types.LINE);
  this.setActionableState({
    trash: true
  });
  var lastMouseOverVertexPath = -1;
  var state = {
    line,
    direction,
    lastMouseOverVertexPath
  };
  return state;
};

DrawBezierCurve.clickAnywhere = function (state, e) {
  var bezierGroup = getBezierGroup(state);
  var bezierCurve = bezierGroup.bezierCurves[0];
  this.updateUIClasses({
    mouse: Constants.cursors.ADD
  });
  var node1 = new _BezierNode.default([e.lngLat.lng, e.lngLat.lat]);
  bezierCurve.nodes.push(node1); //if first node we prepare next node to match cursor position while its moving

  if (bezierCurve.nodes.length === 1) {
    var node2 = new _BezierNode.default([e.lngLat.lng, e.lngLat.lat]);
    bezierCurve.nodes.push(node2);
  }

  bezierGroup.refreshFeature(state.line);
};

DrawBezierCurve.clickOnVertex = function (state, e) {
  var bezierGroup = getBezierGroup(state);
  var bezierCurve = bezierGroup.bezierCurves[0]; // In draw mode, if vertex is the first one, we want to close loop on it

  var isFirstVertex = e.featureTarget.properties.coord_path === 0;

  if (isFirstVertex) {
    // Close loop bezier Curve
    bezierCurve.closed = true;
  }

  bezierGroup.refreshFeature(state.line);
  return this.changeMode(Constants.modes.SIMPLE_SELECT, {
    featureIds: [state.line.id]
  });
};

DrawBezierCurve.onMouseMove = function (state, e) {
  var bezierGroup = getBezierGroup(state);
  var bezierCurve = bezierGroup.bezierCurves[0]; // On mousemove that is not a drag, stop extended interactions.

  this.map.dragPan.enable(); //move next node at cursor position

  if (bezierCurve.nodes.length > 0) {
    var lastNode = bezierCurve.nodes[bezierCurve.nodes.length - 1];
    lastNode.coords = [e.lngLat.lng, e.lngLat.lat];
    bezierGroup.refreshFeature(state.line);
  }

  if (CommonSelectors.isVertex(e)) {
    this.updateUIClasses({
      mouse: Constants.cursors.POINTER
    });
    state.lastMouseOverVertexPath = e.featureTarget.properties.coord_path;
  } else {
    state.lastMouseOverVertexPath = -1;
  }
};

DrawBezierCurve.onMouseDown = function (state, e) {
  if ((0, _additional_selectors.isAltDown)(e)) {
    this.map.dragPan.disable();
  }
};

DrawBezierCurve.onMouseUp = function (state, e) {
  if (state.dragging) {
    DrawBezierCurve.onEndDrag(state, e);
  }
};

DrawBezierCurve.onStartDrag = function (state, e) {
  var bezierGroup = getBezierGroup(state);
  var bezierCurve = bezierGroup.bezierCurves[0]; // Check if we start dragging on the first node,that means we should close the curve.

  if (!bezierCurve.closed && isCurveClosable(bezierCurve) && state.lastMouseOverVertexPath === 0) {
    bezierCurve.closed = true;
    bezierCurve.nodes.pop(); // delete last node as we will now edit the first node as we are closing the curve

    bezierGroup.refreshFeature(state.line);
  }

  state.dragging = true; //if no nodes we start a new bezier curve : so create a new node

  if (bezierCurve.nodes.length === 0) {
    var lnglat = [e.lngLat.lng, e.lngLat.lat];
    var node = new _BezierNode.default(lnglat, lnglat);
    bezierCurve.nodes.push(node);
    bezierGroup.refreshFeature(state.line);
  }
};

DrawBezierCurve.onDrag = function (state, e) {
  if ((0, _additional_selectors.isAltDown)(e)) {
    if (!state.dragging) {
      DrawBezierCurve.onStartDrag(state, e);
      return;
    }

    var bezierGroup = getBezierGroup(state);
    var bezierCurve = bezierGroup.bezierCurves[0];
    var lnglat = [e.lngLat.lng, e.lngLat.lat];

    if (bezierCurve.nodes.length > 0) {
      if (!bezierCurve.closed) {
        var lastNode = bezierCurve.nodes[bezierCurve.nodes.length - 1];
        lastNode.handle = lnglat;
      } else {
        // if curve closed : we should edit the first node instead
        var firstNode = bezierCurve.nodes[0];
        firstNode.handle = lnglat;
      }

      bezierGroup.refreshFeature(state.line);
    }
  }
};

DrawBezierCurve.onEndDrag = function (state, e) {
  state.dragging = false;
  var bezierGroup = getBezierGroup(state);
  var bezierCurve = bezierGroup.bezierCurves[0];
  var lnglat = [e.lngLat.lng, e.lngLat.lat];

  if (!bezierCurve.closed) {
    // Create node at mouse pos
    var node = new _BezierNode.default(lnglat);
    bezierCurve.nodes.push(node);
    bezierGroup.refreshFeature(state.line);
  } else {
    //if curve is closed we should return to simple select mode.
    // this mode will pop the last node so we need to add one.
    bezierCurve.nodes.push(new _BezierNode.default(lnglat)); // The node that will be immediately deleted by change mode > On Stop

    bezierGroup.refreshFeature(state.line);
    return draw.changeMode(Constants.modes.SIMPLE_SELECT, {
      featureIds: [state.line.id]
    });
  }
};

DrawBezierCurve.removeLastNode = function (state, e) {
  var bezierGroup = getBezierGroup(state);
  var bezierCurve = bezierGroup.bezierCurves[0];
  bezierCurve.nodes.pop();
  bezierGroup.refreshFeature(state.line);
};

DrawBezierCurve.onTap = DrawBezierCurve.onClick = function (state, e) {
  // Right click or Mouse wheel click
  if (e.originalEvent.button === 2 || e.originalEvent.button === 1) {
    DrawBezierCurve.removeLastNode(state, e);
    return;
  }

  if (CommonSelectors.isVertex(e)) return this.clickOnVertex(state, e);
  this.clickAnywhere(state, e);
};

DrawBezierCurve.onKeyUp = function (state, e) {
  if (CommonSelectors.isEnterKey(e)) {
    this.changeMode(Constants.modes.SIMPLE_SELECT, {
      featureIds: [state.line.id]
    });
  } else if (CommonSelectors.isEscapeKey(e)) {
    this.deleteFeature([state.line.id], {
      silent: true
    });
    this.changeMode(Constants.modes.SIMPLE_SELECT);
  }
};

DrawBezierCurve.onStop = function (state) {
  _double_click_zoom.default.enable(this);

  this.activateUIButton(); // check to see if we've deleted this feature

  if (this.getFeature(state.line.id) === undefined) return; //remove last added nodes

  var bezierGroup = getBezierGroup(state);
  var bezierCurve = bezierGroup.bezierCurves[0];
  bezierCurve.removeLastNode();
  bezierGroup.refreshFeature(state.line);

  if (state.line.isValid()) {
    this.map.fire(Constants.events.CREATE, {
      features: [state.line.toGeoJSON()]
    });
  } else {
    this.deleteFeature([state.line.id], {
      silent: true
    });
    this.changeMode(Constants.modes.SIMPLE_SELECT, {}, {
      silent: true
    });
  }
};

DrawBezierCurve.onTrash = function (state) {
  this.deleteFeature([state.line.id], {
    silent: true
  });
  this.changeMode(Constants.modes.SIMPLE_SELECT);
};

DrawBezierCurve.toDisplayFeatures = function (state, geojson, display) {
  var isActiveLine = geojson.properties.id === state.line.id;
  geojson.properties.active = isActiveLine ? Constants.activeStates.ACTIVE : Constants.activeStates.INACTIVE;
  if (!isActiveLine) return display(geojson);
  var bezierGroup = getBezierGroup(state);
  var bezierCurve = bezierGroup.bezierCurves[0];

  if (state.dragging) {
    //if dragging : display current node & handles
    var node = bezierCurve.closed ? bezierCurve.nodes[0] : bezierCurve.nodes[bezierCurve.nodes.length - 1]; // If curve is closed we should display the first node instead

    var path = bezierCurve.nodes.length - 1; //display node: 

    display((0, _createBezierPoint.default)(state.line.id, node.coords, path, false)); // Draw Handle lines

    if (node.handle) {
      if (node.handle2) {
        display((0, _createBezierHandleLine.default)(state.line.id, [node.handle, node.coords, node.handle2]));
      } else {
        display((0, _createBezierHandleLine.default)(state.line.id, [node.handle, (0, _bezierUtils.mirrorHandle)(node.coords, node.handle)]));
      }
    } // Draw Handles


    if (node.handle) {
      //display handle
      display((0, _createBezierHandle.default)(state.line.id, node.handle, path, false)); //display mirror handle

      var handle2 = (0, _bezierUtils.mirrorHandle)(node.coords, node.handle);
      display((0, _createBezierHandle.default)(state.line.id, handle2, path, false));
    }
  } else {
    // Only render the line if it has at least one real coordinate
    if (bezierCurve.nodes.length < 2) return;
    var penultNode = bezierCurve.nodes[bezierCurve.nodes.length - 2]; //avant dernier node

    var _path = bezierCurve.nodes.length - 1;

    geojson.properties.meta = Constants.meta.FEATURE;
    display((0, _create_vertex.default)(state.line.id, //parentId
    penultNode.coords, //coordinates
    "".concat(_path), //path
    false //selected
    ));
  } // Display first point to allow for finishing a curve into a closed loop


  if (!bezierCurve.closed && isCurveClosable(bezierCurve)) {
    var firstNode = bezierCurve.nodes[0];
    var _path2 = 0;
    display((0, _createBezierPoint.default)(state.line.id, firstNode.coords, _path2, false));
  }

  display(geojson);
};

function getBezierGroup(state) {
  //Ensure the state bezierGroup is also modified
  var bezierGroupFromProps = state.line.properties.bezierGroup;
  if (bezierGroupFromProps == null) return null; // recreate bezier group from itself to ensure it has the functions : Bezier Group from the props has no functions

  bezierGroupFromProps = new _BezierGroup.default(bezierGroupFromProps.bezierCurves);
  return bezierGroupFromProps;
}

function isCurveClosable(bezierCurve) {
  // Curve is closable if there is atleast 2 points with handles, or at least 3 points without handles
  // there is always 1 more node under mouse pos. so we have to count 1 more node
  if (bezierCurve.nodes.length < 3) {
    return false;
  }

  if (bezierCurve.nodes.length === 3) {
    var node1 = bezierCurve.nodes[0];
    var node2 = bezierCurve.nodes[1];

    if (!node1.handle && !node2.handle) {
      return false;
    }
  }

  return true;
}

var _default = DrawBezierCurve;
exports.default = _default;