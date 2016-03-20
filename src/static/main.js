function isSameCoord(first, second) {
    return Math.abs(first.lat() - second.lat()) < 0.001 && Math.abs(first.lng() - second.lng()) < 0.001;
}

function getCoordinates(geocoder, locationName, cb) {
    geocoder.geocode({address: locationName}, function(results) {
        if(results && results.length != 0 && results[0].geometry != null) {
            var coords = results[0].geometry.location;
            cb(coords)
        }
    });
}

function generateCityMarkerContent(city) {
    return new google.maps.InfoWindow({
        content: (
            '<div class="container-fluid">' +
            city.auctions.map(function(auction) {
                return (
                    '<div class="row">' +
                    '<div class="col-xs-3">' +
                    '<img src="' + auction.imageUrl  + '">' +
                    '</div>' +
                    '<h3 class="col-xs-7" style="margin: 0; padding: 0;">' +
                    '<a href="http://allegro.pl/show_item.php?item=' + auction.itemId + '" target="_blank">' +
                    auction.title +
                    '</a>' +
                    '</h3>' +
                    '<h4 class="col-xs-2">' +
                    auction.price + ' zł' +
                    '</h4>' +
                    '</div>'
                );
            }).join() +
            '</div>'
        )
    });
}


function City(map, locationName, coords) {
    var that = this;

    that.name = locationName;
    that.position = coords;
    that.auctions = []
    that.circle = createCityCircle(coords, map);
    that.marker = createCityMarker(coords, map);
    that.addAuction = addAuction;

    function createCityCircle(position, map) {
        var strokeColor = '#FF0000';
        return new google.maps.Circle({
            strokeColor: strokeColor,
            strokeOpacity: 0.8,
            strokeWeight: 2,
            fillColor: strokeColor,
            fillOpacity: 0.35,
            map: map,
            center: position,
            radius: 0
        });
    }

    function createCityMarker(position, map) {
        var marker = new google.maps.Marker({
            position: position,
            animation: google.maps.Animation.DROP,
            map: map,
            icon: {
                url: 'http://ulotki.pl/images/allegro_icon.png',
                scaledSize: new google.maps.Size(24, 24)
            }
        });
        marker.addListener('click', function() {
            var infoWindow = generateCityMarkerContent(that);
            infoWindow.open(map, marker);
        });
        return marker;
    }

    function updateLook() {
        that.circle.setRadius(Math.sqrt(that.auctions.length * 100) * 500);
        that.marker.setVisible(that.auctions.length > 0);
    }

    function addAuction(auction) {
        var marker = new google.maps.Marker({
            position: that.position,
            animation: google.maps.Animation.DROP,
            map: map,
            icon: {
                url: auction.imageUrl,
                scaledSize: new google.maps.Size(34, 34)
            }
        });

        setTimeout(function() {
            marker.setMap(null);
            that.auctions.push(auction);
            updateLook();
        }, 500);
        setTimeout(function() { that.auctions.shift(); updateLook(); }, 30000);
    }
}


function CityCache(map, geocoder) {
    var that = this;
    var cache = [];
    var locationNameToCity = {};

    that.getCity = getCity;

    function getNearestCityFromCache(position) {
        for(var i=0; i < cache.length; i++) {
            if(isSameCoord(cache[i].position, position)) {
                return cache[i]
            }
        }
    }

    function getCity(locationName, cb) {
        var city = locationNameToCity[locationName];
        if(city){
            cb(city);
        } else {
            getCoordinates(geocoder, locationName, function(coordinates) {
                var city = getNearestCityFromCache(coordinates);
                if(!city) {
                    city = new City(map, locationName, coordinates);
                    cache.push(city);
                }
                locationNameToCity[locationName] = city;
                cb(city);
            });
        }
    }
}

function initMap() {
    var socket = io();
    var geocoder = new google.maps.Geocoder();
    var map = new google.maps.Map(document.getElementById('map'), {
        center: {lat: 52.05, lng: 19.45},
        zoom: 6
    });
    var cache = new CityCache(map, geocoder);

    function onEvent(data) {
        cache.getCity(data.location, function(city) {
            city.addAuction(data);
        });
    }

    socket.on('event', onEvent);
}


/*
 Item {
 itemId: '5982214477',
 location: 'Skwierzyna',
 price: '59.95',
 imageUrl: 'http://img07.allegroimg.pl/photos/128x96/59/82/21/44/5982214477',
 title: 'RĘKAWICE ANTYPRZECIĘCIOWE OCHRONNE DLA PILARZA HIT' }
 */
