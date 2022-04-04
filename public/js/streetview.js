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
        heading: 270,
        pitch: 0,
    });
    panorama.setVisible(true);
}