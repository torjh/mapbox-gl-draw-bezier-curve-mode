"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;

class BezierNode {
  constructor() {
    var coords = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : [];
    var handle = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : null;
    var handle2 = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : null;
    this.coords = coords;
    this.handle = handle;
    this.handle2 = handle2;
  }

}

exports.default = BezierNode;