"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = copyBezierGroupToClipboard;

var _BezierGroup = _interopRequireDefault(require("./BezierGroup"));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function copyBezierGroupToClipboard(selectedFeatures) {
  if (selectedFeatures.length > 0) {
    var copiedText = '';
    selectedFeatures.forEach(feature => {
      if (feature && feature.properties.bezierGroup) {
        // ReInstance beziergroup to keep all functions present
        var bezierGroup = new _BezierGroup.default(feature.properties.bezierGroup.bezierCurves);
        copiedText += bezierGroup.getRawData();
      } else {
        console.error("No Bezier Group copied in Memory : feature1 is null or feature1 is not a bezier Group");
      }
    });

    if (copiedText !== '') {
      // Put Raw data in a textarea & copy it in memory
      var el = document.createElement('textarea');
      el.value = copiedText;
      document.body.appendChild(el);
      el.select();
      document.execCommand('copy');
      document.body.removeChild(el);
      console.log("Selected Bezier Group copied In Memory");
    }
  } else {
    console.error("No Bezier Group copied in Memory : selectedFeatures.length = 0");
  }
}