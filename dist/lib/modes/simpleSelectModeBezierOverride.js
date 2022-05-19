"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;

var _mapboxGlDraw = _interopRequireDefault(require("@mapbox/mapbox-gl-draw"));

var _create_supplementary_points = _interopRequireDefault(require("@mapbox/mapbox-gl-draw/src/lib/create_supplementary_points"));

var _move_features = _interopRequireDefault(require("@mapbox/mapbox-gl-draw/src/lib/move_features"));

var Constants = _interopRequireWildcard(require("@mapbox/mapbox-gl-draw/src/constants"));

var _dragBezierPoints = _interopRequireDefault(require("../utils/dragBezierPoints"));

var _createSupplementaryPointsForBezier = _interopRequireDefault(require("../utils/createSupplementaryPointsForBezier"));

var _copyBezierGroupToClipboard = _interopRequireDefault(require("../utils/copyBezierGroupToClipboard"));

var _additional_selectors = require("../utils/additional_selectors");

var _BezierGroup = _interopRequireDefault(require("../utils/BezierGroup"));

function _getRequireWildcardCache(nodeInterop) { if (typeof WeakMap !== "function") return null; var cacheBabelInterop = new WeakMap(); var cacheNodeInterop = new WeakMap(); return (_getRequireWildcardCache = function _getRequireWildcardCache(nodeInterop) { return nodeInterop ? cacheNodeInterop : cacheBabelInterop; })(nodeInterop); }

function _interopRequireWildcard(obj, nodeInterop) { if (!nodeInterop && obj && obj.__esModule) { return obj; } if (obj === null || typeof obj !== "object" && typeof obj !== "function") { return { default: obj }; } var cache = _getRequireWildcardCache(nodeInterop); if (cache && cache.has(obj)) { return cache.get(obj); } var newObj = {}; var hasPropertyDescriptor = Object.defineProperty && Object.getOwnPropertyDescriptor; for (var key in obj) { if (key !== "default" && Object.prototype.hasOwnProperty.call(obj, key)) { var desc = hasPropertyDescriptor ? Object.getOwnPropertyDescriptor(obj, key) : null; if (desc && (desc.get || desc.set)) { Object.defineProperty(newObj, key, desc); } else { newObj[key] = obj[key]; } } } newObj.default = obj; if (cache) { cache.set(obj, newObj); } return newObj; }

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var SimpleSelectModeBezierOverride = _mapboxGlDraw.default.modes.simple_select;

SimpleSelectModeBezierOverride.dragMove = function (state, e) {
  // Dragging when drag move is enabled
  state.dragMoving = true;
  e.originalEvent.stopPropagation();
  var delta = {
    lng: e.lngLat.lng - state.dragMoveLocation.lng,
    lat: e.lngLat.lat - state.dragMoveLocation.lat
  };
  (0, _move_features.default)(this.getSelected(), delta); // Move bezier control points & handles

  (0, _dragBezierPoints.default)(this, delta);
  state.dragMoveLocation = e.lngLat;
};

SimpleSelectModeBezierOverride.toDisplayFeatures = function (state, geojson, display) {
  geojson.properties.active = this.isSelected(geojson.properties.id) ? Constants.activeStates.ACTIVE : Constants.activeStates.INACTIVE;
  display(geojson);
  this.fireActionable();
  if (geojson.properties.active !== Constants.activeStates.ACTIVE || geojson.geometry.type === Constants.geojsonTypes.POINT) return; // If Bezier curve create supplementary points for bezier points instead

  var supplementaryPoints = geojson.properties.user_bezierGroup ? (0, _createSupplementaryPointsForBezier.default)(geojson) : (0, _create_supplementary_points.default)(geojson);

  if (supplementaryPoints) {
    supplementaryPoints.forEach(display);
  }
};

SimpleSelectModeBezierOverride.onKeyDown = function (state, e) {
  if ((0, _additional_selectors.isCtrlCDown)(e)) {
    (0, _copyBezierGroupToClipboard.default)(this.getSelected());
  }
};

SimpleSelectModeBezierOverride.onCombineFeatures = function () {
  var selectedFeatures = this.getSelected();
  if (selectedFeatures.length === 0 || selectedFeatures.length < 2) return;
  var featureType = selectedFeatures[0].type.replace('Multi', '');
  var isBezierGroup = selectedFeatures[0].properties.bezierGroup != null; // Verify all features are of the same type

  for (var i = 0; i < selectedFeatures.length; i++) {
    var feature = selectedFeatures[i]; // Check non corresponding features

    if (feature.type.replace('Multi', '') !== featureType) {
      return;
    } // Check BezierCurve compatibility


    if (isBezierGroup !== (feature.properties.bezierGroup != null)) {
      return;
    }
  } // Decide which onCombine we will use


  if (isBezierGroup) {
    return this.onCombineFeaturesBezier();
  } else {
    return this.onCombineFeaturesDefault();
  }
};

SimpleSelectModeBezierOverride.onCombineFeaturesBezier = function () {
  var bezierCurves = [];
  var featuresCombined = [];
  var selectedFeatures = this.getSelected();

  for (var i = 0; i < selectedFeatures.length; i++) {
    var feature = selectedFeatures[i];
    var bezierGroup = feature.properties.bezierGroup; // Multi

    if (bezierGroup.bezierCurves.length > 1) {
      bezierGroup.bezierCurves.forEach(bezierCurve => {
        bezierCurves.push(bezierCurve);
      });
    } // Single
    else {
      bezierCurves.push(bezierGroup.bezierCurves[0]);
    }

    featuresCombined.push(feature.toGeoJSON());
  }

  if (bezierCurves.length > 1) {
    var _bezierGroup = new _BezierGroup.default(bezierCurves);

    var multiFeature = this.newFeature(_bezierGroup.geojson);
    multiFeature.incomingCoords(_bezierGroup.vertices);
    multiFeature.properties.bezierGroup = _bezierGroup;
    this.addFeature(multiFeature);
    this.deleteFeature(this.getSelectedIds(), {
      silent: true
    });
    this.setSelected([multiFeature.id]);
    this.map.fire(Constants.events.COMBINE_FEATURES, {
      createdFeatures: [multiFeature.toGeoJSON()],
      deletedFeatures: featuresCombined
    });
  }

  this.fireActionable();
};

SimpleSelectModeBezierOverride.onCombineFeaturesDefault = function () {
  var selectedFeatures = this.getSelected();
  var coordinates = [],
      featuresCombined = [];
  var featureType = selectedFeatures[0].type.replace('Multi', '');

  for (var i = 0; i < selectedFeatures.length; i++) {
    var feature = selectedFeatures[i];

    if (feature.type.includes('Multi')) {
      feature.getCoordinates().forEach(subcoords => {
        coordinates.push(subcoords);
      });
    } else {
      coordinates.push(feature.getCoordinates());
    }

    featuresCombined.push(feature.toGeoJSON());
  }

  if (featuresCombined.length > 1) {
    var multiFeature = this.newFeature({
      type: Constants.geojsonTypes.FEATURE,
      properties: featuresCombined[0].properties,
      geometry: {
        type: "Multi".concat(featureType),
        coordinates
      }
    });
    this.addFeature(multiFeature);
    this.deleteFeature(this.getSelectedIds(), {
      silent: true
    });
    this.setSelected([multiFeature.id]);
    this.map.fire(Constants.events.COMBINE_FEATURES, {
      createdFeatures: [multiFeature.toGeoJSON()],
      deletedFeatures: featuresCombined
    });
  }

  this.fireActionable();
};

SimpleSelectModeBezierOverride.onUncombineFeatures = function () {
  var _this = this;

  var selectedFeatures = this.getSelected();
  if (selectedFeatures.length === 0) return;
  var createdFeatures = [];
  var featuresUncombined = [];

  var _loop = function _loop(i) {
    var feature = selectedFeatures[i];
    var bezierGroup = feature.properties.bezierGroup;

    if (_this.isInstanceOf('MultiFeature', feature)) {
      // Bezier curve behaviour
      if (bezierGroup) {
        bezierGroup.bezierCurves.forEach(bezierCurve => {
          var newBezierGroup = new _BezierGroup.default([bezierCurve]);

          var subFeature = _this.newFeature(newBezierGroup.geojson);

          _this.addFeature(subFeature);

          createdFeatures.push(subFeature.toGeoJSON());

          _this.select([subFeature.id]);
        });

        _this.deleteFeature(feature.id, {
          silent: true
        });
      } // Default behaviour
      else {
        feature.getFeatures().forEach(subFeature => {
          _this.addFeature(subFeature);

          subFeature.properties = feature.properties;
          createdFeatures.push(subFeature.toGeoJSON());

          _this.select([subFeature.id]);
        });

        _this.deleteFeature(feature.id, {
          silent: true
        });
      }

      featuresUncombined.push(feature.toGeoJSON());
    }
  };

  for (var i = 0; i < selectedFeatures.length; i++) {
    _loop(i);
  }

  if (createdFeatures.length > 1) {
    this.map.fire(Constants.events.UNCOMBINE_FEATURES, {
      createdFeatures,
      deletedFeatures: featuresUncombined
    });
  }

  this.fireActionable();
};

var _default = SimpleSelectModeBezierOverride;
exports.default = _default;