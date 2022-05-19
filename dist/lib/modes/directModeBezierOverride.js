"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;

var _mapboxGlDraw = _interopRequireDefault(require("@mapbox/mapbox-gl-draw"));

var _create_supplementary_points = _interopRequireDefault(require("@mapbox/mapbox-gl-draw/src/lib/create_supplementary_points"));

var _move_features = _interopRequireDefault(require("@mapbox/mapbox-gl-draw/src/lib/move_features"));

var Constants = _interopRequireWildcard(require("@mapbox/mapbox-gl-draw/src/constants"));

var _constrain_feature_movement = _interopRequireDefault(require("@mapbox/mapbox-gl-draw/src/lib/constrain_feature_movement"));

var _common_selectors = require("@mapbox/mapbox-gl-draw/src/lib/common_selectors");

var _double_click_zoom = _interopRequireDefault(require("@mapbox/mapbox-gl-draw/src/lib/double_click_zoom"));

var _dragBezierPoints = _interopRequireDefault(require("../utils/dragBezierPoints"));

var _bezierUtils = require("../utils/bezierUtils");

var _createSupplementaryPointsForBezier = _interopRequireDefault(require("../utils/createSupplementaryPointsForBezier"));

var _copyBezierGroupToClipboard = _interopRequireDefault(require("../utils/copyBezierGroupToClipboard"));

var _additional_selectors = require("../utils/additional_selectors");

var _BezierGroup = _interopRequireDefault(require("../utils/BezierGroup"));

var _BezierNode = _interopRequireDefault(require("../utils/BezierNode"));

function _getRequireWildcardCache(nodeInterop) { if (typeof WeakMap !== "function") return null; var cacheBabelInterop = new WeakMap(); var cacheNodeInterop = new WeakMap(); return (_getRequireWildcardCache = function _getRequireWildcardCache(nodeInterop) { return nodeInterop ? cacheNodeInterop : cacheBabelInterop; })(nodeInterop); }

function _interopRequireWildcard(obj, nodeInterop) { if (!nodeInterop && obj && obj.__esModule) { return obj; } if (obj === null || typeof obj !== "object" && typeof obj !== "function") { return { default: obj }; } var cache = _getRequireWildcardCache(nodeInterop); if (cache && cache.has(obj)) { return cache.get(obj); } var newObj = {}; var hasPropertyDescriptor = Object.defineProperty && Object.getOwnPropertyDescriptor; for (var key in obj) { if (key !== "default" && Object.prototype.hasOwnProperty.call(obj, key)) { var desc = hasPropertyDescriptor ? Object.getOwnPropertyDescriptor(obj, key) : null; if (desc && (desc.get || desc.set)) { Object.defineProperty(newObj, key, desc); } else { newObj[key] = obj[key]; } } } newObj.default = obj; if (cache) { cache.set(obj, newObj); } return newObj; }

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

// import {noTarget, , isActiveFeature, isInactiveFeature, isShiftDown} from '@mapbox/mapbox-gl-draw/src/lib/common_selectors';
var DirectModeBezierOverride = _mapboxGlDraw.default.modes.direct_select;
var isVertex = (0, _common_selectors.isOfMetaType)(Constants.meta.VERTEX);
var isMidpoint = (0, _common_selectors.isOfMetaType)(Constants.meta.MIDPOINT);
var draw = null;

DirectModeBezierOverride.onSetup = function (opts) {
  var featureId = opts.featureId;
  var feature = this.getFeature(featureId);
  draw = this;

  if (!feature) {
    throw new Error('You must provide a featureId to enter direct_select mode');
  }

  if (feature.type === Constants.geojsonTypes.POINT) {
    throw new TypeError('direct_select mode doesn\'t handle point features');
  }

  var state = {
    featureId,
    feature,
    dragMoveLocation: opts.startPos || null,
    dragMoving: false,
    canDragMove: false,
    selectedCoordPaths: opts.coordPath ? [opts.coordPath] : []
  };
  this.setSelectedCoordinates(this.pathsToCoordinates(featureId, state.selectedCoordPaths));
  this.setSelected(featureId);

  _double_click_zoom.default.disable(this);

  this.setActionableState({
    trash: true
  });
  return state;
};

DirectModeBezierOverride.onVertex = function (state, e) {
  this.startDragging(state, e);
  var props = e.featureTarget.properties;
  state.handleSelected = 0;
  var coordPath = props.coord_path; // Bezier Point or Handle Management

  if (props.bezierPoint || props.bezierHandle) {
    var bezierGroup = getBezierGroup(state);
    var result = bezierGroup.getBezierCurveAndNodeFromCoordPath(coordPath);
    var node = result.node;

    if (props.bezierPoint) {
      if ((0, _additional_selectors.isAltDown)(e)) {
        if (node) {
          // If No Handles : Create new Handles (delayed in the drag event)
          if (!node.handle) {
            state.createNewHandles = true;
          } // If Handle : Delete Handles
          else if (node.handle || node.handle2) {
            node.handle = node.handle2 = null;
            bezierGroup.refreshFeature(state.feature);
          }
        }
      } // state.selectedCoordPaths = [];

    }

    if (props.bezierHandle) {
      state.handleSelected = props.handleInverse ? -1 : 1;
      state.selectedCoordPaths = [props.coord_path]; // Break Handle Symetry with Alt 

      if ((0, _additional_selectors.isAltDown)(e)) {
        state.breakHandleSymetry = true;
      } // Reenable handle Symetry with Shift
      else if ((0, _common_selectors.isShiftDown)(e)) {
        if (node) {
          if (node.handle2) {
            // if handle 2 was selected, copy inverse to handle 1
            if (state.handleSelected === -1) {
              node.handle = (0, _bezierUtils.mirrorHandle)(node.coords, node.handle2);
            }

            node.handle2 = undefined;
            bezierGroup.refreshFeature(state.feature);
          }
        }
      }

      return;
    }
  } //Select Vertex 


  var selectedIndex = state.selectedCoordPaths.indexOf(props.coord_path);

  if (!(0, _common_selectors.isShiftDown)(e) && selectedIndex === -1) {
    state.selectedCoordPaths = [props.coord_path];
  } else if ((0, _common_selectors.isShiftDown)(e) && selectedIndex === -1) {
    state.selectedCoordPaths.push(props.coord_path);
  }

  var selectedCoordinates = this.pathsToCoordinates(state.featureId, state.selectedCoordPaths);
  this.setSelectedCoordinates(selectedCoordinates);
};

DirectModeBezierOverride.onMidpoint = function (state, e) {
  var bezierGroup = getBezierGroup(state);

  if (bezierGroup) {
    this.startDragging(state, e);
    var props = e.featureTarget.properties; //get bezierCurve & previous node

    var result = bezierGroup.getBezierCurveAndNodeFromCoordPath(props.coord_path);
    var bezierCurve = result.bezierCurve;
    var bezierCurveIndex = result.bezierCurveIndex;
    var nodeIndex = result.nodeIndex;
    var newNode = new _BezierNode.default([props.lng, props.lat]);
    var newCoordPath = bezierGroup.bezierCurves.length > 1 ? "".concat(bezierCurveIndex, ".").concat(nodeIndex + 1) : "".concat(nodeIndex + 1); // insert node into nodes

    bezierCurve.nodes.splice(nodeIndex + 1, 0, newNode);
    bezierGroup.refreshFeature(state.feature);
    this.fireUpdate();
    state.selectedCoordPaths = [newCoordPath];
    var selectedCoordinates = this.pathsToCoordinates(state.featureId, state.selectedCoordPaths);
    this.setSelectedCoordinates(selectedCoordinates);
  }
};

DirectModeBezierOverride.dragFeature = function (state, e, delta) {
  (0, _move_features.default)(this.getSelected(), delta); // Move bezier control points & handles

  (0, _dragBezierPoints.default)(this, delta);
  state.dragMoveLocation = e.lngLat;
};

DirectModeBezierOverride.dragVertex = function (state, e, delta) {
  var bezierGroup = getBezierGroup(state);

  if (bezierGroup) {
    if (state.createNewHandles) {
      var coordPath = state.selectedCoordPaths[state.selectedCoordPaths.length - 1];
      var node = bezierGroup.getBezierCurveAndNodeFromCoordPath(coordPath).node;

      if (node) {
        if (!node.handle && !node.handle2) {
          node.handle = [node.coords[0], node.coords[1]];
        }

        state.createNewHandles = false;
        state.handleSelected = 1;
      }
    }

    if (state.handleSelected === 0) {
      // Move Bezier Point
      state.selectedCoordPaths.forEach(coordPath => {
        // Move Bezier Points
        var node = bezierGroup.getBezierCurveAndNodeFromCoordPath(coordPath).node; // Move main point only if no handle Selected (=0)

        node.coords[0] += delta.lng;
        node.coords[1] += delta.lat;

        if (node.handle) {
          node.handle[0] += delta.lng;
          node.handle[1] += delta.lat;
        }

        if (node.handle2) {
          node.handle2[0] += delta.lng;
          node.handle2[1] += delta.lat;
        }
      });
    } else {
      // Move Bezier Handles (only last selected)
      var _coordPath = state.selectedCoordPaths[state.selectedCoordPaths.length - 1];
      var _node = bezierGroup.getBezierCurveAndNodeFromCoordPath(_coordPath).node;

      if (_node) {
        // If createSecondaryHandle and handle2 was not defined, create the handle2 by mirroring handle 1
        if (state.breakHandleSymetry && !_node.handle2) {
          state.breakHandleSymetry = false;
          _node.handle2 = (0, _bezierUtils.mirrorHandle)(_node.coords, _node.handle);
        }

        if (!_node.handle2) {
          // If no handle2 it means that handles are linked
          if (_node.handle) {
            _node.handle[0] += delta.lng * state.handleSelected;
            _node.handle[1] += delta.lat * state.handleSelected;
          }
        } else {
          // If handle 2 then they are unlinked, we should move them indepentely base on the handleSelected
          if (state.handleSelected === 1) {
            _node.handle[0] += delta.lng;
            _node.handle[1] += delta.lat;
          } else if (state.handleSelected === -1) {
            _node.handle2[0] += delta.lng;
            _node.handle2[1] += delta.lat;
          }
        }
      }
    }

    bezierGroup.refreshFeature(state.feature);
    this.fireUpdate();
  } // IF NOT A BEZIER GROUP : classic handling
  else {
    var selectedCoords = state.selectedCoordPaths.map(coord_path => state.feature.getCoordinate(coord_path));
    var selectedCoordPoints = selectedCoords.map(coords => ({
      type: Constants.geojsonTypes.FEATURE,
      properties: {},
      geometry: {
        type: Constants.geojsonTypes.POINT,
        coordinates: coords
      }
    }));
    var constrainedDelta = (0, _constrain_feature_movement.default)(selectedCoordPoints, delta);

    for (var i = 0; i < selectedCoords.length; i++) {
      var coord = selectedCoords[i];
      state.feature.updateCoordinate(state.selectedCoordPaths[i], coord[0] + constrainedDelta.lng, coord[1] + constrainedDelta.lat);
    }
  }
};

DirectModeBezierOverride.onKeyDown = function (state, e) {
  if ((0, _additional_selectors.isCtrlCDown)(e)) {
    (0, _copyBezierGroupToClipboard.default)(this.getSelected());
  }
};

DirectModeBezierOverride.onTrash = function (state) {
  var bezierGroup = getBezierGroup(state); // Mark Nodes for deletion

  state.selectedCoordPaths.forEach(coordPath => {
    var result = bezierGroup.getBezierCurveAndNodeFromCoordPath(coordPath);
    var bezierCurve = result.bezierCurve;
    var node = result.node;
    bezierCurve.nodesToDelete.push(node);
  }); // Remove nodes

  bezierGroup.removeMarkedNodes();
  bezierGroup.refreshFeature(state.feature);
  this.fireUpdate();
  state.selectedCoordPaths = [];
  this.clearSelectedCoordinates();
  this.fireActionable(state);

  if (state.feature.isValid() === false) {
    this.deleteFeature([state.featureId]);
    this.changeMode(Constants.modes.SIMPLE_SELECT, {});
  }
};

DirectModeBezierOverride.onMouseMove = function (state, e) {
  // On mousemove that is not a drag, stop vertex movement.
  var isFeature = (0, _common_selectors.isActiveFeature)(e);
  var onVertex = isVertex(e);
  var onMidpoint = isMidpoint(e);
  var noCoords = state.selectedCoordPaths.length === 0;
  if (onMidpoint) this.updateUIClasses({
    mouse: Constants.cursors.ADD
  });else if (isFeature && noCoords) this.updateUIClasses({
    mouse: Constants.cursors.MOVE
  });else if (onVertex && !noCoords) this.updateUIClasses({
    mouse: Constants.cursors.MOVE
  });else this.updateUIClasses({
    mouse: Constants.cursors.NONE
  });
  this.stopDragging(state); // Skip render

  return true;
};

DirectModeBezierOverride.onMouseOut = function (state) {
  // As soon as you mouse leaves the canvas, update the feature
  if (state.dragMoving) this.fireUpdate(); // Skip render

  return true;
};

DirectModeBezierOverride.onCombineFeatures = function (state) {
  if (state.selectedCoordPaths.length === 0) return; // Mark down nodes to merge for future processing

  var bezierGroup = getBezierGroup(state);
  state.selectedCoordPaths.forEach(coordPath => {
    var result = bezierGroup.getBezierCurveAndNodeFromCoordPath(coordPath);
    var bezierCurve = result.bezierCurve;
    var node = result.node;
    bezierCurve.nodesToMerge.push(node);
  }); // Merge nodes

  bezierGroup.mergeMarkedNodes();
  var feature = bezierGroup.refreshFeature(state.feature, draw, true); // Force recreate feature as we may go from a multiline string to a single string

  state.featureId = feature.id;
  state.feature = feature;
  this.fireUpdate();
  state.selectedCoordPaths = [];
  var selectedCoordinates = this.pathsToCoordinates(state.featureId, state.selectedCoordPaths);
  this.setSelectedCoordinates(selectedCoordinates);
  this.fireActionable(state);

  if (state.feature.isValid() === false) {
    this.deleteFeature([state.featureId]);
    this.changeMode(Constants.modes.SIMPLE_SELECT, {});
  }

  this.doRender(state.featureId);
};

DirectModeBezierOverride.onUncombineFeatures = function (state) {
  if (state.selectedCoordPaths.length === 0) return; // Mark down nodes to split for future processing

  var bezierGroup = getBezierGroup(state);
  state.selectedCoordPaths.forEach(coordPath => {
    var result = bezierGroup.getBezierCurveAndNodeFromCoordPath(coordPath);
    var bezierCurve = result.bezierCurve;
    var node = result.node;
    bezierCurve.nodesToSplit.push(node);
  }); // Split nodes

  bezierGroup.splitMarkedNodes();
  var feature = bezierGroup.refreshFeature(state.feature, draw, true); // Force recreate feature as we may go from a multiline string to a single string

  state.featureId = feature.id;
  state.feature = feature;
  this.fireUpdate();
  state.selectedCoordPaths = [];
  var selectedCoordinates = this.pathsToCoordinates(state.featureId, state.selectedCoordPaths);
  this.setSelectedCoordinates(selectedCoordinates);
  this.fireActionable(state);

  if (state.feature.isValid() === false) {
    this.deleteFeature([state.featureId]);
    this.changeMode(Constants.modes.SIMPLE_SELECT, {});
  }

  this.doRender(state.featureId);
};

DirectModeBezierOverride.toDisplayFeatures = function (state, geojson, display) {
  if (state.featureId === geojson.properties.id) {
    geojson.properties.active = Constants.activeStates.ACTIVE; //If Bezier curve create supplementary points for bezier points instead

    var supplementaryPoints = geojson.properties.user_bezierGroup ? (0, _createSupplementaryPointsForBezier.default)(geojson, {
      featureId: state.featureId,
      midpoints: true,
      selectedPaths: state.selectedCoordPaths
    }) : (0, _create_supplementary_points.default)(geojson, {
      map: this.map,
      midpoints: true,
      selectedPaths: state.selectedCoordPaths
    });
    supplementaryPoints.forEach(display);
    display(geojson);
  } else {
    geojson.properties.active = Constants.activeStates.INACTIVE;
    display(geojson);
  }

  this.fireActionable(state);
};

function getBezierGroup(state) {
  //Ensure the state bezierGroup is also modified
  var bezierGroupFromProps = state.feature.properties.bezierGroup;
  if (bezierGroupFromProps == null) return null; // recreate bezier group from itself to ensure it has the functions : Bezier Group from the props has no functions

  bezierGroupFromProps = new _BezierGroup.default(bezierGroupFromProps.bezierCurves);
  return bezierGroupFromProps;
}

var _default = DirectModeBezierOverride;
exports.default = _default;