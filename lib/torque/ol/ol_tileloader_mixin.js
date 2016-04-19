ol.TileLoader = function(tileSize){
    this._tileSize = tileSize;
    this._tiles = {};
    this._tilesLoading = {};
    this._tilesToLoad = 0;
    this._updateTiles = this._updateTiles.bind(this);

    this._tileGrid = ol.tilegrid.createXYZ({
        extent: ol.tilegrid.extentFromProjection('EPSG:3857'),
        tileSize: tileSize
    });
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

    var zoom = this._view.getZoom();
    var extent = this._view.calculateExtent(this._map.getSize());
    var tileRange = this._tileGrid.getTileRangeForExtentAndZ(extent, zoom);

    this._addTilesFromCenterOut(tileRange, zoom);
    this._removeOtherTiles(tileRange);
};

ol.TileLoader.prototype._removeOtherTiles = function(tileRange) {
    var kArr, x, y, z, key;
    var zoom = this._view.getZoom();

    for (key in this._tiles) {
        if (this._tiles.hasOwnProperty(key)) {
            kArr = key.split(':');
            x = parseInt(kArr[0], 10);
            y = parseInt(kArr[1], 10);
            z = parseInt(kArr[2], 10);

            // remove tile if it's out of bounds
            if (z !== zoom || x < tileRange.minX || x > tileRange.maxX || ((-y-1) < tileRange.minY) || (-y-1) > tileRange.maxY) {
                this._removeTile(key);
            }
        }
    }
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

ol.TileLoader.prototype.getTilePos = function (tilePoint) {
    var zoom = this._view.getZoom();
    var extent = this._tileGrid.getTileCoordExtent([zoom, tilePoint.x, -tilePoint.y-1]);
    var topLeft = this._map.getPixelFromCoordinate([extent[0], extent[3]]);

    return {
        x: topLeft[0],
        y: topLeft[1]
    };
};

ol.TileLoader.prototype._addTilesFromCenterOut = function (tileRange, zoom) {
        var queue = [];
        var j, i, point;

        for (j = tileRange.minY; j <= tileRange.maxY; j++) {
            for (i = tileRange.minX; i <= tileRange.maxX; i++) {
                point = {
                    x: i,
                    y: -j - 1,
                    zoom: zoom
                };

                if (this._tileShouldBeLoaded(point)) {
                    queue.push(point);
                }
            }
        }

        var tilesToLoad = queue.length;

        if (tilesToLoad === 0) { return; }

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
