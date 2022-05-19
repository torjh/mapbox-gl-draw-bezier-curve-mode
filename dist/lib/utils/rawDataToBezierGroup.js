"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = rawDataToBezierGroup;

var _BezierGroup = _interopRequireDefault(require("./BezierGroup"));

var _BezierCurve = _interopRequireDefault(require("./BezierCurve"));

var _BezierNode = _interopRequireDefault(require("./BezierNode"));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

// Convert input raw data to a bezier curve.
// Data should respect following format :
// BEZIERGROUP indicating we start a group of beziercurves
// BEZIERCURVE indicating we start a new bezier curve inside the group
// - One line per node.
// - Each node is represented by a pair of lat / lon separated by spaces
// - Value 1 & 2 = node coordinates
// - Value 3 & 4 (optional) = Bezier handle
// - Value 5 & 6 (optional) = Bezier handle2 (if handles are broken) 
// CLOSED to close the current bezier curve : this will loop to the first node.
function rawDataToBezierGroup(data) {
  var bezierGroups = [];
  var bezierGroup = new _BezierGroup.default();
  var bezierCurve = new _BezierCurve.default();
  var bezierGroupTextMatch = 'BEZIERGROUP';
  var bezierCurveTextMatch = 'BEZIERCURVE';
  var closedTextMatch = 'CLOSED';
  var lines = data.split("\n");

  for (var i = 0; i < lines.length; i++) {
    var line = lines[i]; // CHECK NEW BEZIERGROUP

    if (line === bezierGroupTextMatch) {
      // Add bezierCurve to group
      if (bezierCurve.nodes.length > 0) {
        bezierGroup.bezierCurves.push(bezierCurve);
        bezierCurve = new _BezierCurve.default();
      } // Add bezierGroup to List if it is not the first one


      if (bezierGroup.bezierCurves.length > 0) {
        bezierGroups.push(bezierGroup);
        bezierGroup = new _BezierGroup.default();
      }
    } // CHECK NEW BEZIERCURVE


    if (line === bezierCurveTextMatch) {
      // Add bezierCurve to Group if it is not the first one
      if (bezierCurve.nodes.length > 0) {
        bezierGroup.bezierCurves.push(bezierCurve);
        bezierCurve = new _BezierCurve.default();
      }
    } // CHECK CLOSED CURVE
    else if (line === closedTextMatch) {
      bezierCurve.closed = true;
    } // PARSE NODE DATA
    else {
      var arr = line.split(' ');

      if (arr.length >= 2) {
        var lat = parseFloat(arr[0]);
        var lng = parseFloat(arr[1]);
        var node = new _BezierNode.default([lng, lat]);

        if (arr.length >= 4) {
          var _lat = parseFloat(arr[2]);

          var _lng = parseFloat(arr[3]);

          node.handle = [_lng, _lat];
        }

        if (arr.length >= 6) {
          var _lat2 = parseFloat(arr[4]);

          var _lng2 = parseFloat(arr[5]);

          node.handle2 = [_lng2, _lat2];
        }

        if (node.coords) {
          bezierCurve.nodes.push(node);
        }
      }
    }
  }

  if (bezierCurve.nodes.length > 0) {
    // add last bezierCurve to group
    bezierGroup.bezierCurves.push(bezierCurve);
  } // add bezier Group to list


  bezierGroups.push(bezierGroup);
  return bezierGroups;
}