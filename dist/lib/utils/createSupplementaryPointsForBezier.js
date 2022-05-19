"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = createSupplementaryPointsForBezier;

var Constants = _interopRequireWildcard(require("@mapbox/mapbox-gl-draw/src/constants"));

var _mathjs = require("mathjs");

var _createBezierPoint = _interopRequireDefault(require("./createBezierPoint"));

var _createBezierHandle = _interopRequireDefault(require("./createBezierHandle"));

var _bezierUtils = require("./bezierUtils");

var _BezierGroup = _interopRequireDefault(require("./BezierGroup"));

var _createBezierHandleLine = _interopRequireDefault(require("./createBezierHandleLine"));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _getRequireWildcardCache(nodeInterop) { if (typeof WeakMap !== "function") return null; var cacheBabelInterop = new WeakMap(); var cacheNodeInterop = new WeakMap(); return (_getRequireWildcardCache = function _getRequireWildcardCache(nodeInterop) { return nodeInterop ? cacheNodeInterop : cacheBabelInterop; })(nodeInterop); }

function _interopRequireWildcard(obj, nodeInterop) { if (!nodeInterop && obj && obj.__esModule) { return obj; } if (obj === null || typeof obj !== "object" && typeof obj !== "function") { return { default: obj }; } var cache = _getRequireWildcardCache(nodeInterop); if (cache && cache.has(obj)) { return cache.get(obj); } var newObj = {}; var hasPropertyDescriptor = Object.defineProperty && Object.getOwnPropertyDescriptor; for (var key in obj) { if (key !== "default" && Object.prototype.hasOwnProperty.call(obj, key)) { var desc = hasPropertyDescriptor ? Object.getOwnPropertyDescriptor(obj, key) : null; if (desc && (desc.get || desc.set)) { Object.defineProperty(newObj, key, desc); } else { newObj[key] = obj[key]; } } } newObj.default = obj; if (cache) { cache.set(obj, newObj); } return newObj; }

function createSupplementaryPointsForBezier(geojson) {
  var options = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};
  var {
    properties
  } = geojson;
  var bezierGroup = getBezierGroup(properties.user_bezierGroup);
  if (!bezierGroup) return null;
  var supplementaryPoints = [];
  var selectedCoordPaths = [];
  var bezierCurveId = 0;

  if (options.selectedPaths) {
    selectedCoordPaths = options.selectedPaths;
  }

  var featureId = options.featureId; // Draw all control points

  bezierGroup.bezierCurves.forEach(bezierCurve => {
    for (var i = 0; i < bezierCurve.nodes.length; i++) {
      var node = bezierCurve.nodes[i];
      var coord_path = bezierGroup.bezierCurves.length > 1 ? "".concat(bezierCurveId, ".").concat(i) : "".concat(i);
      var selected = selectedCoordPaths.includes(coord_path);
      supplementaryPoints.push((0, _createBezierPoint.default)(properties.id, node.coords, coord_path, selected));
    }

    bezierCurveId++;
  }); // Draw Selected node handles

  selectedCoordPaths.forEach(coordPath => {
    // Move Bezier Points
    var node = bezierGroup.getBezierCurveAndNodeFromCoordPath(coordPath).node;

    if (node.handle) {
      var handleVertex = (0, _createBezierHandle.default)(properties.id, node.handle, coordPath, false);
      handleVertex.properties.handle = true;
      handleVertex.properties.handleInverse = false;
      supplementaryPoints.push(handleVertex);
    }

    if (node.handle2 || node.handle) {
      var inverseHandleVertex = (0, _createBezierHandle.default)(properties.id, node.handle2 ? node.handle2 : (0, _bezierUtils.mirrorHandle)(node.coords, node.handle), coordPath, false);
      inverseHandleVertex.properties.handle = true;
      inverseHandleVertex.properties.handleInverse = true;
      supplementaryPoints.push(inverseHandleVertex);
    } // Draw Handle lines


    if (node.handle) {
      if (node.handle2) {
        supplementaryPoints.push((0, _createBezierHandleLine.default)(properties.id, [node.handle, node.coords, node.handle2]));
      } else {
        supplementaryPoints.push((0, _createBezierHandleLine.default)(properties.id, [node.handle, (0, _bezierUtils.mirrorHandle)(node.coords, node.handle)]));
      }
    }
  }); // Draw mid points

  if (options.midpoints && featureId) {
    for (var i = 0; i < bezierGroup.bezierCurves.length; i++) {
      var bezierCurve = bezierGroup.bezierCurves[i]; // Loop into curve vertices by bezierSteps / 2 so we find the middle position

      var vertIndex = 0;

      for (var j = 0; j < bezierCurve.nodes.length; j++) {
        var node = bezierCurve.nodes[j];
        var nextNodeIndex = j < bezierCurve.nodes.length - 1 ? j + 1 : 0;
        if (!bezierCurve.closed && nextNodeIndex === 0) continue; //Ignore last point if curve is not closed

        var nextNode = bezierCurve.nodes[nextNodeIndex]; //if node is Bezier, then we have n=beziersteps vertices
        //if node is not Bezier, then the same apply if nextnode is Bezier.

        var midPointCoords = void 0;

        if (node.handle || !node.handle && nextNode.handle) {
          // Create a midPoint here
          // FIRST METHOD : less accurate to find the middle vertice position
          // const midPointVerticeIndex = vertIndex + parseInt(bezierCurve.bezierSteps/2);
          // midPointCoords = bezierCurve.verts[midPointVerticeIndex];
          // SECOND METHOD : more expensive but more accurate to find the middle vertice
          var nextNodeVerticeIndex = vertIndex + parseInt(bezierCurve.bezierSteps);
          midPointCoords = getMidPointVertex(bezierCurve.verts, vertIndex, nextNodeVerticeIndex);
          vertIndex += bezierCurve.bezierSteps;
        } else if (!node.handle && !nextNode.handle) {
          // This is two Points without bezier, there are no vertices inBetween
          // Create a midPoint between node & nextNode position
          midPointCoords = [(node.coords[0] + nextNode.coords[0]) / 2, (node.coords[1] + nextNode.coords[1]) / 2];
          vertIndex += 1;
        }

        if (midPointCoords) {
          var mid = {
            lng: midPointCoords[0],
            lat: midPointCoords[1]
          };
          var coordPath = bezierGroup.bezierCurves.length > 1 ? "".concat(i, ".").concat(j) : "".concat(j);
          var midPoint = {
            type: Constants.geojsonTypes.FEATURE,
            properties: {
              meta: Constants.meta.MIDPOINT,
              parent: featureId,
              lng: mid.lng,
              lat: mid.lat,
              coord_path: coordPath
            },
            geometry: {
              type: Constants.geojsonTypes.POINT,
              coordinates: [mid.lng, mid.lat]
            }
          };
          supplementaryPoints.push(midPoint);
        }
      }
    }
  }

  return supplementaryPoints;
}

function getMidPointVertex(verts, startIndex, endIndex) {
  var pS = verts[startIndex];
  var pE = verts[endIndex];
  var smallestDistDiff = 99999999;
  var midVertexId = -1;

  for (var i = 1; i < endIndex - startIndex - 1; i++) {
    var vIndex = startIndex + i;
    var pI = verts[vIndex];
    var distDiff = (0, _mathjs.abs)((0, _mathjs.distance)(pS, pI) - (0, _mathjs.distance)(pE, pI));

    if (distDiff < smallestDistDiff) {
      smallestDistDiff = distDiff;
      midVertexId = vIndex;
    }
  }

  if (midVertexId !== -1) {
    return verts[midVertexId];
  }

  return null;
}

function getBezierGroup(bezierGroupFromProps) {
  if (bezierGroupFromProps == null) return null; // recreate bezier group from itself to ensure it has the functions : Bezier Group from the props has no functions

  bezierGroupFromProps = new _BezierGroup.default(bezierGroupFromProps.bezierCurves);
  return bezierGroupFromProps;
}