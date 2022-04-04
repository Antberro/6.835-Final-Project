let panorama;

function initStreetView() {
    const stata = { lat: 42.362059, lng: -71.090931 };
    const sv = new window.google.maps.StreetViewService();

    // set up panorama viewer
    panorama = new window.google.maps.StreetViewPanorama(
        document.getElementById('pano')
    );

    // set initial sv camera
    sv.getPanorama({ location: stata, radius: 50 }).then(processSVData);
}

function processSVData({ data }) {
    const location = data.location;
    panorama.setPano(location.pano);
    panorama.setZoom(0);
    panorama.setPano({
        heading: 0,
        pitch: 0,
    });
    panorama.setVisible(true);
}

var cursor;
var cursorPosition;

// Main loop
Leap.loop({ hand: function(hand) {
    cursorPosition = hand.screenPosition();
    cursor.setScreenPosition(cursorPosition);
    console.log(cursorPosition);
}}).use('screenPosition', {scale: LEAPSCALE});