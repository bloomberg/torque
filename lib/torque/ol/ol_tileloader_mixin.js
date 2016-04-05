var mapProjection = require("./projection.js");

ol.TileLoader = function(tileSize){
    this._tileSize = tileSize;
    this._tiles = {};
    this._tilesLoading = {};
    this._tilesToLoad = 0;

    this._mecratorProjection = ol.proj.getTransform("EPSG:3857", "EPSG:4326");
    this._olProjection = ol.proj.getTransform("EPSG:4326", "EPSG:3857");
    this._updateTiles = this._updateTiles.bind(this);
};

ol.TileLoader.prototype._initTileLoader = function(map) {
    this._map = map;
    this._view = map.getView();
    this._centerChangedId = this._view.on("change:center", function(e){
        this._updateTiles();
    },  this);
    this._resolutionChangedId = this._view.on("change:resolution", this._updateTiles);
    this._updateTiles();
};
ol.TileLoader.prototype._removeTileLoader = function() {
    this._view.unByKey(this._centerChangedId);
    this._view.unByKey(this._resolutionChangedId );

    this._removeTiles();
};

ol.TileLoader.prototype._removeTiles = function () {
    for (var key in this._tiles) {
        this._removeTile(key);
    }
};

ol.TileLoader.prototype._reloadTiles = function() {
    this._removeTiles();
    this._updateTiles();
};

ol.TileLoader.prototype._updateTiles = function () {
    if (!this._map) { return; }

    var bounds = this._getExtent();

    var zoom = this._view.getZoom();
    var tileSize = this._tileSize;

    var mapTopLeft = mapProjection.toMapPoint(bounds[3], bounds[0], zoom, tileSize);
    var mapBottomRight =  mapProjection.toMapPoint(bounds[1], bounds[2], zoom, tileSize);

    var nwTilePoint = {
            x: Math.floor(mapTopLeft.x / tileSize),
            y: Math.floor(mapTopLeft.y / tileSize)
        },
        seTilePoint = {
            x:  Math.floor(mapBottomRight.x / tileSize),
            y: Math.floor(mapBottomRight.y / tileSize)
        };

    this._addTilesFromCenterOut(nwTilePoint, seTilePoint, zoom);
    this._removeOtherTiles(nwTilePoint, seTilePoint);
};

ol.TileLoader.prototype._removeOtherTiles = function(nwTilePoint, seTilePoint) {
    var kArr, x, y, key;
    var zoom = this._view.getZoom();

    for (key in this._tiles) {
        if (this._tiles.hasOwnProperty(key)) {
            kArr = key.split(':');
            x = parseInt(kArr[0], 10);
            y = parseInt(kArr[1], 10);
            z = parseInt(kArr[2], 10);

            // remove tile if it's out of bounds
            if (z !== zoom || x < nwTilePoint.x|| x > seTilePoint.x || y < nwTilePoint.y || y > seTilePoint.y) {
                this._removeTile(key);
            }
        }
    }
};

ol.TileLoader.prototype._getExtent  = function()
{
    var view = this._map.getView();
    var extent = this._mecratorProjection(view.calculateExtent(this._map.getSize()));
    if (Math.abs(extent[0] - extent[2]) >= 360) {
        extent[0] = mapProjection.earthBounding.west;
        extent[2] = mapProjection.earthBounding.east;
    }
    else {
        if(extent[0] >= -180 && extent[2] <=180) {
            return extent;
        }
        var center = ol.extent.getCenter(extent);
        var width = ol.extent.getWidth(extent);

        center[0] = this._normalizeLongitude(center[0]);

        extent[0] = center[0] - width /2;
        extent[2] = center[1] + width /2;

        if(extent[0] < mapProjection.earthBounding.west)
            extent[0] = mapProjection.earthBounding.west;

        if(extent[1] > mapProjection.earthBounding.east)
            extent[1] = mapProjection.earthBounding.east;
    }

    return extent;
};

ol.TileLoader.prototype._removeTile = function (key) {
    this.fire('tileRemoved', this._tiles[key]);
    delete this._tiles[key];
    delete this._tilesLoading[key];
};

ol.TileLoader.prototype._tileKey = function(tilePoint) {
    return tilePoint.x + ':' + tilePoint.y + ':' + tilePoint.zoom;
};

ol.TileLoader.prototype._tileShouldBeLoaded = function (tilePoint) {
    var k = this._tileKey(tilePoint);
    return !(k in this._tiles) && !(k in this._tilesLoading);
};

ol.TileLoader.prototype._tileLoaded = function(tilePoint, tileData) {
        this._tilesToLoad--;
        var k = this._tileKey(tilePoint);
        this._tiles[k] = tileData;
        delete this._tilesLoading[k];
        if(this._tilesToLoad === 0) {
            this.fire("tilesLoaded");
        }
};

ol.TileLoader.prototype._normalizeLongitude = function(lon) {
    while (lon < -180 ) lon += 360;
    while (lon > 180) lon -= 360;
    return lon;
};

ol.TileLoader.prototype.getTilePos = function (tilePoint) {
    var zoom = this._view.getZoom();
    tilePoint = {
        x: tilePoint.x * this._tileSize,
        y: tilePoint.y * this._tileSize
    };


    var extent = this._mecratorProjection(this._view.calculateExtent(this._map.getSize()));
    var bounds = this._getExtent();
    var topLeft = this._getTopLeftInPixels();

    var offsetX = 0, offsetY = 0;

    if(topLeft[0] > 0) offsetX = topLeft[0];
    if(topLeft[1] > 0) offsetY = topLeft[1];

    var divTopLeft = mapProjection.toMapPoint(bounds[3], bounds[0], zoom, this._tileSize);

    return {
        x: offsetX + tilePoint.x - divTopLeft.x,
        y: offsetY + tilePoint.y - divTopLeft.y
    };
};

ol.TileLoader.prototype._getTopLeftInPixels = function(){
    var center = this._mecratorProjection(this._view.getCenter());
    var w = Math.floor(Math.abs(center[0]) / 180);

    if(w == 0){
        return this._map.getPixelFromCoordinate(this._olProjection([mapProjection.earthBounding.west,
           mapProjection.earthBounding.north]));
    }
    else{
        var normLon = this._normalizeLongitude(center[0]);
        var diff = normLon > 0 ? 180 + normLon : 180 - Math.abs(normLon);
        return this._map.getPixelFromCoordinate(this._olProjection([center[0] - diff,
            mapProjection.earthBounding.north]));
    }
};

ol.TileLoader.prototype._addTilesFromCenterOut = function (nwTilePoint, seTilePoint, zoom) {
        var queue = [],
            center = {
                x: (nwTilePoint.x + seTilePoint.x) * 0.5,
                y: (nwTilePoint.y + seTilePoint.y) * 0.5
            };

        var j, i, point;

        for (j = nwTilePoint.y; j <= seTilePoint.y; j++) {
            for (i = nwTilePoint.x; i <= seTilePoint.x; i++) {
                point = {
                    x: i,
                    y: j,
                    zoom: zoom
                };

                if (this._tileShouldBeLoaded(point)) {
                    queue.push(point);
                }
            }
        }

        var tilesToLoad = queue.length;

        if (tilesToLoad === 0) { return; }

        function distanceToCenterSq(point) {
            var dx = point.x - center.x;
            var dy = point.y - center.y;
            return dx * dx + dy * dy;
        }

        // load tiles in order of their distance to center
        queue.sort(function (a, b) {
            return distanceToCenterSq(a) - distanceToCenterSq(b);
        });

        this._tilesToLoad += tilesToLoad;

        for (i = 0; i < tilesToLoad; i++) {
            var t = queue[i];
            var k = this._tileKey(t);
            this._tilesLoading[k] = t;
            // events
            this.fire('tileAdded', t);
        }

        this.fire("tilesLoading");
    };

module.exports = ol.TileLoader;
