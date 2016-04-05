
module.exports = {
    earthBounding :
    {
        north : 85.05112878,
        west: -180,
        south : -85.05112878,
        east: 180
    },
    clip: function(number, min, max){
        return Math.min(Math.max(number, min), max);
    },
    getMapSize: function(zoom, tileSize){
      return Math.pow(2.0, zoom) * tileSize;
    },
    toMapPoint: function(lat, long, zoom, tileSize){
        lat = this.clip(lat, this.earthBounding.south, this.earthBounding.north);
        long = this.clip(long, this.earthBounding.west, this.earthBounding.east);
        var x = (long + 180.0) / 360.0;
        var sinLat = Math.sin(lat * Math.PI / 180.0);
        var y = 0.5 - Math.log((1.0 + sinLat) / (1.0 - sinLat)) / (4.0 * Math.PI);

        var mapSize = this.getMapSize(zoom, tileSize);

        var pointX = this.clip(x * mapSize + 0.5, 0.0, mapSize - 1.0);
        var pointY = this.clip(y * mapSize + 0.5, 0.0, mapSize - 1.0);

        return {
            x: Math.floor(pointX),
            y: Math.floor(pointY),
                zoom: zoom
        };
    }
};
