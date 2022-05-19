"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.isAltDown = isAltDown;
exports.isBackspaceDown = isBackspaceDown;
exports.isCtrlCDown = isCtrlCDown;

function isAltDown(e) {
  if (!e.originalEvent) return false;
  return e.originalEvent.altKey;
}

function isCtrlCDown(e) {
  if (e.ctrlKey && e.key === "c") {
    e.preventDefault();
    return true;
  }

  return false;
}

function isBackspaceDown(e) {
  if (e.keyCode === 8) {
    e.preventDefault();
    return true;
  }

  return false;
}