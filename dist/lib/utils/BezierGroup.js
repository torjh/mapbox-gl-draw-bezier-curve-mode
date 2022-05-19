"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;

var Constants = _interopRequireWildcard(require("@mapbox/mapbox-gl-draw/src/constants"));

var _BezierCurve = _interopRequireDefault(require("./BezierCurve"));

var _BezierNode = _interopRequireDefault(require("./BezierNode"));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _getRequireWildcardCache(nodeInterop) { if (typeof WeakMap !== "function") return null; var cacheBabelInterop = new WeakMap(); var cacheNodeInterop = new WeakMap(); return (_getRequireWildcardCache = function _getRequireWildcardCache(nodeInterop) { return nodeInterop ? cacheNodeInterop : cacheBabelInterop; })(nodeInterop); }

function _interopRequireWildcard(obj, nodeInterop) { if (!nodeInterop && obj && obj.__esModule) { return obj; } if (obj === null || typeof obj !== "object" && typeof obj !== "function") { return { default: obj }; } var cache = _getRequireWildcardCache(nodeInterop); if (cache && cache.has(obj)) { return cache.get(obj); } var newObj = {}; var hasPropertyDescriptor = Object.defineProperty && Object.getOwnPropertyDescriptor; for (var key in obj) { if (key !== "default" && Object.prototype.hasOwnProperty.call(obj, key)) { var desc = hasPropertyDescriptor ? Object.getOwnPropertyDescriptor(obj, key) : null; if (desc && (desc.get || desc.set)) { Object.defineProperty(newObj, key, desc); } else { newObj[key] = obj[key]; } } } newObj.default = obj; if (cache) { cache.set(obj, newObj); } return newObj; }

class BezierGroup {
  constructor() {
    var bezierCurves = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : [];
    // by instanciating new BezierCurves it will keep all its functions.
    // Because if we use bezierCurves directly it will lose all its functions in some cases.
    var newBezierCurves = [];
    bezierCurves.forEach(bezierCurve => {
      newBezierCurves.push(new _BezierCurve.default(bezierCurve.nodes, bezierCurve.closed));
    });
    this.bezierCurves = newBezierCurves;
  }

  get vertices() {
    var verts = []; // If only one bezier Curve we just return the vertices of the bezier curve

    if (this.bezierCurves.length === 1) {
      return this.bezierCurves[0].vertices;
    } // If more than one bezier Curve we return each bezier curve vertices as an array element


    this.bezierCurves.forEach(bezierCurve => {
      verts.push(bezierCurve.vertices);
    });
    return verts;
  }

  get geojson() {
    //Type is either a line string if only one bezier curve, or a multi line string if more than one bezier curve
    var type = this.bezierCurves.length === 1 ? Constants.geojsonTypes.LINE_STRING : Constants.geojsonTypes.MULTI_LINE_STRING;
    var lineString = {
      type: Constants.geojsonTypes.FEATURE,
      properties: {
        bezierGroup: this
      },
      geometry: {
        type: type,
        coordinates: this.vertices
      }
    };
    return lineString;
  }

  removeBezierCurves(bezierCurves) {
    this.bezierCurves = this.bezierCurves.filter(item => !bezierCurves.includes(item));
  }

  removeMarkedNodes() {
    this.bezierCurves.forEach(bezierCurve => {
      bezierCurve.removeMarkedNodes();
    });
  }

  refreshFeature(feature) {
    var draw = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : null;
    var forceRecreateFeature = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : false;

    if (forceRecreateFeature && draw != null) {
      // Generate new feature & delete old one
      var newFeature = draw.newFeature(this.geojson);
      draw.addFeature(newFeature);
      newFeature.properties = feature.properties;
      newFeature.properties.bezierGroup = this;
      draw.select([newFeature.id]);
      draw.deleteFeature(feature.id, {
        silent: true
      });
      return newFeature;
    } else {
      // Juste update feature
      feature.incomingCoords(this.vertices);
      feature.properties.bezierGroup = this;
      return feature;
    }
  }

  getRawData() {
    var data = 'BEZIERGROUP\n';
    this.bezierCurves.forEach(bezierCurve => {
      data += 'BEZIERCURVE\n';
      data += bezierCurve.getRawData();
    });
    return data;
  }

  getBezierCurveAndNodeFromCoordPath(coordPath) {
    var bezierCurve;
    var bezierCurveIndex;
    var nodeIndex;
    var split = coordPath.split('.'); // If more than one curve in the group : coordpath will have the following format : 0.1

    if (this.bezierCurves.length > 1) {
      bezierCurveIndex = parseInt(split[0]);
      bezierCurve = this.bezierCurves[bezierCurveIndex];
      nodeIndex = parseInt(split[1]);
    } // If only one bezier Curve, then use the first one and coordpath is the index of the node
    else {
      bezierCurveIndex = 0;
      bezierCurve = this.bezierCurves[bezierCurveIndex];
      nodeIndex = parseInt(coordPath);
    }

    var node = bezierCurve.nodes[nodeIndex];
    return {
      bezierCurve: bezierCurve,
      bezierCurveIndex: bezierCurveIndex,
      node: node,
      nodeIndex: nodeIndex
    };
  } /////////////////////////////////////////////////////////////////
  ///////// MERGE NODES ///////////////////////////////////////////
  ////////////////////////////////////////////////////////////////


  mergeMarkedNodes() {
    if (!this.TryConnectTwoLimitNodesOnSeparateCurves()) {
      if (!this.TryConnectTwoLimitNodesOnSameCurve()) {
        // Default behaviour : merge all nodes to average
        this.MergeNodesToAverage();
      }
    } // Reset nodesToMerge array


    this.bezierCurves.forEach(bezierCurve => {
      bezierCurve.nodesToMerge = [];
    });
  }

  TryConnectTwoLimitNodesOnSeparateCurves() {
    // Check that only two nodes are marked for merge
    // Check this nodes are on two separate curves that are not closed
    var numNodesToMerge = 0;
    var curvesToMerge = [];
    var result = true;
    this.bezierCurves.forEach(bezierCurve => {
      if (bezierCurve.nodesToMerge) {
        if (bezierCurve.nodesToMerge.length > 1) return result = false;
        if (bezierCurve.nodesToMerge.length === 1 && bezierCurve.closed) return result = false;
        numNodesToMerge += bezierCurve.nodesToMerge.length;
        if (numNodesToMerge > 2) return result = false;

        if (bezierCurve.nodesToMerge.length === 1) {
          curvesToMerge.push(bezierCurve);
        }
      }
    });
    if (!result) return false;
    if (curvesToMerge.length !== 2) return false;
    var c1 = curvesToMerge[0];
    var c2 = curvesToMerge[1];
    var n1 = c1.nodesToMerge[0];
    var n2 = c2.nodesToMerge[0];
    var n1index = c1.getNodeIndex(n1);
    var n2index = c2.getNodeIndex(n2); // Check this nodes are on the edge of the curve.

    if ((n1index === 0 || n1index === c1.nodes.length - 1) && (n2index === 0 || n2index === c2.nodes.length - 1)) {
      /////////////////////////////////////
      // Lets Merge the two separate curves
      /////////////////////////////////////
      // console.log("ConnectTwoLimitNodesOnSeparateCurves");
      // Reverse curve1 nodes if necessary
      if (n1index === 0) {
        c1.reverseNodesArray();
      } // Reverse c2 nodes if necessary


      if (n2index === c2.nodes.length - 1) {
        c2.reverseNodesArray();
      } // add the node of n2 to n1


      c2.nodes.forEach(c2Node => {
        c1.nodes.push(c2Node);
      }); // remove c2 from bezier group

      this.removeBezierCurves([c2]);
      return true;
    }

    return false;
  }

  TryConnectTwoLimitNodesOnSameCurve() {
    // Check that only two nodes are marked for merge
    // Check this nodes are on a same curve that is not closed
    var numNodesToMerge = 0;
    var result = true;
    var c = null;
    this.bezierCurves.forEach(bezierCurve => {
      if (bezierCurve.nodesToMerge && bezierCurve.nodesToMerge.length > 0) {
        if (bezierCurve.nodesToMerge.length !== 2) return result = false;
        if (bezierCurve.nodesToMerge.length === 2 && bezierCurve.closed) return result = false;
        numNodesToMerge += bezierCurve.nodesToMerge.length;
        if (numNodesToMerge > 2) return result = false;
        c = bezierCurve;
      }
    });
    if (!result || c.nodesToMerge.length !== 2 || c === null || c.closed) return false;
    var n1 = c.nodesToMerge[0];
    var n2 = c.nodesToMerge[1];
    var n1index = c.getNodeIndex(n1);
    var n2index = c.getNodeIndex(n2); // Check this nodes are on each end of the curve.

    if (n1index === 0 && n2index === c.nodes.length - 1 || n1index === c.nodes.length - 1 && n2index === 0) {
      /////////////////////////////////////
      // Lets connect the points & close the curve
      /////////////////////////////////////
      // console.log("ConnectTwoLimitNodesOnSameCurve");
      c.closed = true;
      return true;
    }

    return false;
  }

  MergeNodesToAverage() {
    // console.log("MergeNodesToAverage");
    var curveId = 0;
    this.bezierCurves.forEach(bezierCurve => {
      bezierCurve.mode_CombineMergeNodesAverage(curveId);
      curveId++;
    });
  } /////////////////////////////////////////////////////////////////
  ///////// SPLIT NODES ///////////////////////////////////////////
  ////////////////////////////////////////////////////////////////


  splitMarkedNodes() {
    var newBezierCurves = [];
    this.bezierCurves.forEach(bezierCurve => {
      if (bezierCurve.nodesToSplit.length > 0 && bezierCurve.closed && bezierCurve.nodes.length >= 2) {
        //First break closed curve & create new point at same position
        var node = bezierCurve.nodesToSplit[0];
        var nodeIndex = bezierCurve.getNodeIndex(node); //Loop array n times, where n = nodeIndex. so that node is first in array and other values have looped.
        // ex if node is index 2: 0,1,2,3 will become 2,3,0,1

        for (var i = 0; i < nodeIndex; i++) {
          var nodeToLoop = bezierCurve.nodes[0];
          bezierCurve.nodes.shift();
          bezierCurve.nodes.push(nodeToLoop);
        } // Copy node at the end (dont use references)


        var newNode = this.getNodeCopy(node);
        bezierCurve.nodes.push(newNode); // Open the curve

        bezierCurve.closed = false; // Remove node from nodesToSplit array

        bezierCurve.nodesToSplit = bezierCurve.nodesToSplit.filter(item => ![node].includes(item));
      } // Split remaining nodes to split the curves into independant ones


      if (bezierCurve.nodesToSplit.length > 0 && !bezierCurve.closed && bezierCurve.nodes.length > 2) {
        var splitIndexes = bezierCurve.getNodeToSplitIndexes();
        var newNodes = [];

        for (var _i = 0; _i < bezierCurve.nodes.length; _i++) {
          if (splitIndexes.includes(_i)) {
            newNodes.push(this.getNodeCopy(bezierCurve.nodes[_i]));
            var newBezierCurve = new _BezierCurve.default(newNodes.slice()); // Create new beziercurve from newNodes portion

            newBezierCurves.push(newBezierCurve); // add the freshly created bezier curve 

            newNodes = []; // reset nodes for next portion
          }

          newNodes.push(this.getNodeCopy(bezierCurve.nodes[_i]));
        } // Create last curve if nodes remain


        if (newNodes.length > 0) {
          var _newBezierCurve = new _BezierCurve.default(newNodes.slice()); // Create new beziercurve from newNodes portion


          newBezierCurves.push(_newBezierCurve); // add the freshly created bezier curve 

          newNodes = []; // reset nodes for next portion
        }
      } else {
        // If no nodes on this curve, then we just add the curve 
        newBezierCurves.push(bezierCurve);
      } //Reapply bezierCurves


      this.bezierCurves = newBezierCurves;
    }); // Reset nodesToSplit array

    this.bezierCurves.forEach(bezierCurve => {
      bezierCurve.nodesToSplit = [];
    });
  }

  getNodeCopy(node) {
    var newCoords = [node.coords[0], node.coords[1]];
    var newHandle = null;

    if (node.handle) {
      newHandle = [node.handle[0], node.handle[1]];
    }

    var newHandle2 = null;

    if (node.handle2) {
      newHandle2 = [node.handle2[0], node.handle2[1]];
    }

    return new _BezierNode.default(newCoords, newHandle, newHandle2);
  }

}

exports.default = BezierGroup;