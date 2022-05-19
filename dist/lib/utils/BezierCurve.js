"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;

var Constants = _interopRequireWildcard(require("@mapbox/mapbox-gl-draw/src/constants"));

var _bezierUtils = require("./bezierUtils");

var _mathjs = require("mathjs");

function _getRequireWildcardCache(nodeInterop) { if (typeof WeakMap !== "function") return null; var cacheBabelInterop = new WeakMap(); var cacheNodeInterop = new WeakMap(); return (_getRequireWildcardCache = function _getRequireWildcardCache(nodeInterop) { return nodeInterop ? cacheNodeInterop : cacheBabelInterop; })(nodeInterop); }

function _interopRequireWildcard(obj, nodeInterop) { if (!nodeInterop && obj && obj.__esModule) { return obj; } if (obj === null || typeof obj !== "object" && typeof obj !== "function") { return { default: obj }; } var cache = _getRequireWildcardCache(nodeInterop); if (cache && cache.has(obj)) { return cache.get(obj); } var newObj = {}; var hasPropertyDescriptor = Object.defineProperty && Object.getOwnPropertyDescriptor; for (var key in obj) { if (key !== "default" && Object.prototype.hasOwnProperty.call(obj, key)) { var desc = hasPropertyDescriptor ? Object.getOwnPropertyDescriptor(obj, key) : null; if (desc && (desc.get || desc.set)) { Object.defineProperty(newObj, key, desc); } else { newObj[key] = obj[key]; } } } newObj.default = obj; if (cache) { cache.set(obj, newObj); } return newObj; }

class BezierCurve {
  constructor() {
    var nodes = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : [];
    var closed = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : false;
    var name = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : "";
    this.nodes = nodes;
    this.name = name;
    this.closed = closed;
    this.bezierSteps = 19;
    this.nodesToDelete = [];
    this.nodesToMerge = [];
    this.nodesToSplit = [];
    this.verts = this.vertices;
  }

  get vertices() {
    var verts = [];

    for (var i = 0; i < this.nodes.length; i++) {
      var node = this.nodes[i];

      if (i < this.nodes.length - 1) {
        var nextNode = this.nodes[i + 1];
        verts.push(...this.getVerticesBetweenNodes(node, nextNode));
      } else if (i === this.nodes.length - 1) // Last Node
        {
          verts.push(node.coords);
        }
    } // Finish by close loop lastNode to first node


    if (this.closed) {
      var _node = this.nodes[this.nodes.length - 1];
      var _nextNode = this.nodes[0];
      verts.push(...this.getVerticesBetweenNodes(_node, _nextNode)); // add last vertex at starting next node pos

      verts.push(_nextNode.coords);
    }

    return verts;
  }

  getVerticesBetweenNodes(node, nextNode) {
    var verts = []; // Begin by adding a vertex at node position, it will do the job for POINT TO POINT

    verts.push(node.coords); // Bezier Curve management

    if (node.handle || nextNode.handle) {
      var p1 = node.coords;
      var p2;
      var p3;
      var p4 = nextNode.coords; // p2

      if (node.handle) {
        p2 = node.handle;
      } else {
        // find p2 as half of vector towards next node handle (mirrored)
        var nextNodeHandle = nextNode.handle2 ? nextNode.handle2 : (0, _bezierUtils.mirrorHandle)(nextNode.coords, nextNode.handle);
        var p2X = node.coords[0] + (nextNodeHandle[0] - node.coords[0]) * 0.5;
        var p2Y = node.coords[1] + (nextNodeHandle[1] - node.coords[1]) * 0.5;
        p2 = [p2X, p2Y];
      } // p3


      if (nextNode.handle) {
        p3 = nextNode.handle2 ? nextNode.handle2 : (0, _bezierUtils.mirrorHandle)(nextNode.coords, nextNode.handle);
      } else {
        // find p3 as half vector towards node handle
        var p3X = nextNode.coords[0] + (node.handle[0] - nextNode.coords[0]) * 0.5;
        var p3Y = nextNode.coords[1] + (node.handle[1] - nextNode.coords[1]) * 0.5;
        p3 = [p3X, p3Y];
      }

      for (var s = 1; s < this.bezierSteps; s++) {
        var t = s / this.bezierSteps;
        var point = (0, _bezierUtils.bezierCurve4pts)(p1, p2, p3, p4, t);
        verts.push(point);
      }
    }

    return verts;
  }

  reverseNodesArray() {
    // Reverse array of nodes
    this.nodes.reverse(); // Mirror handles if any

    this.nodes.forEach(node => {
      if (node.handle && !node.handle2) {
        node.handle = (0, _bezierUtils.mirrorHandle)(node.coords, node.handle);
      } else if (node.handle && node.handle2) {
        // Inverse Handle2 & handle1
        var tmpHandle2 = node.handle2;
        node.handle2 = node.handle;
        node.handle = tmpHandle2;
      }
    });
  }

  get geojson() {
    var lineString = {
      type: Constants.geojsonTypes.FEATURE,
      properties: {
        bezierCurve: this
      },
      geometry: {
        type: Constants.geojsonTypes.LINE_STRING,
        coordinates: this.vertices
      }
    };
    return lineString;
  }

  getDistance() {
    return (0, _mathjs.random)(0, 100);
  }

  removeNode(node) {
    this.removeNodes([node]);
  }

  removeNodes(nodes) {
    this.nodes = this.nodes.filter(item => !nodes.includes(item));
  }

  removeLastNode() {
    this.nodes.pop();
  }

  removeMarkedNodes() {
    this.removeNodes(this.nodesToDelete); // Clean list

    this.nodesToDelete = [];
  }

  mode_CombineMergeNodesAverage(curveId) {
    // Create groups of nodes that follow each other
    var groupOfNodes = this.getGroupOfFollowingNodes(curveId); // Create new node in between the nodes

    groupOfNodes.forEach(subGroup => {
      // Parse "0.1" to get right integer
      subGroup = subGroup.map(id => {
        return parseInt(id.split('.')[1]);
      }); // Average coordinates & Handles if any

      var coordX = 0,
          coordY = 0;
      var numHandles = 0;
      var coordHandleX = 0,
          coordHandleY = 0;

      for (var i = 0; i < subGroup.length; i++) {
        var node = this.nodes[subGroup[i]];

        if (node) {
          coordX += node.coords[0];
          coordY += node.coords[1];

          if (node.handle) {
            coordHandleX += node.handle[0];
            coordHandleY += node.handle[1];
            numHandles++;
          }
        }
      }

      coordX = coordX / subGroup.length;
      coordY = coordY / subGroup.length; // move first node of list

      var moveNode = this.nodes[subGroup[0]];
      moveNode.coords = [coordX, coordY]; // Move Handle if any

      if (numHandles > 0) {
        coordHandleX = coordHandleX / numHandles;
        coordHandleY = coordHandleY / numHandles;
        moveNode.handle = [coordHandleX, coordHandleY];
      } // Remove merged nodes


      var nodesToDelete = subGroup.map(id => {
        return this.nodes[id];
      });
      nodesToDelete.shift(); //remove first item as we are moving it

      this.removeNodes(nodesToDelete);
    });
  }

  getGroupOfFollowingNodes(curveId) {
    // Create groups of nodes that follow each other
    var group = [];
    var subGroup = [];

    for (var i = 0; i < this.nodes.length; i++) {
      var node = this.nodes[i];
      var nodeFound = false;

      for (var j = 0; j < this.nodesToMerge.length; j++) {
        var nodeToMerge = this.nodesToMerge[j];

        if (node === nodeToMerge) {
          subGroup.push("".concat(curveId, ".").concat(i));
          nodeFound = true;
        }
      }

      if (!nodeFound && subGroup.length > 0) {
        group.push(subGroup);
        subGroup = [];
      }
    }

    if (subGroup.length > 0) {
      group.push(subGroup);
    } // LOOP Management : verify if extreme numbers connect, if so match them


    if (group.length >= 2) {
      var firstSubgroup = group[0];
      var firstId = parseInt(firstSubgroup[0].split('.')[1]);
      var lastSubgroup = group[group.length - 1];
      var lastId = parseInt(lastSubgroup[lastSubgroup.length - 1].split('.')[1]);

      if (firstId === 0 && lastId === this.nodes.length - 1) {
        //Add last Subgroup elements to first one
        firstSubgroup.unshift(...lastSubgroup); //Remove last subgroup

        group.pop();
      }
    }

    return group;
  }

  getNodeIndex(node) {
    for (var i = 0; i < this.nodes.length; i++) {
      if (node === this.nodes[i]) {
        return i;
      }
    }

    return -1;
  }

  getRawData() {
    var data = '';
    this.nodes.forEach(node => {
      var line = '';

      if (node.coords) {
        line += "".concat(node.coords[1], " ").concat(node.coords[0]);
      }

      if (node.handle) {
        line += " ".concat(node.handle[1], " ").concat(node.handle[0]);
      }

      if (node.handle2) {
        line += " ".concat(node.handle2[1], " ").concat(node.handle2[0]);
      }

      data += line + '\n';
    });

    if (this.closed) {
      data += 'CLOSED\n';
    }

    return data;
  }

  getNodeToSplitIndexes() {
    var splitIndexes = [];

    if (this.nodesToSplit != null) {
      for (var i = 0; i < this.nodesToSplit.length; i++) {
        var node = this.nodesToSplit[i];
        var nodeIndex = this.getNodeIndex(node);

        if (nodeIndex !== 0 && nodeIndex !== this.nodes.length - 1) {
          // Dont add first & last node because they are not valida candidate for split
          splitIndexes.push(nodeIndex);
        }
      }
    }

    return splitIndexes;
  }

}

exports.default = BezierCurve;