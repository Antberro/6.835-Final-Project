function initialize() {
    const mit = { lat: 42.360001, lng: -71.092003 };
    const map = new google.maps.Map(document.getElementById("map"), {
      center: mit,
      zoom: 14,
    });
    const panorama = new google.maps.StreetViewPanorama(
      document.getElementById("pano"),
      {
        position: mit,
        pov: {
          heading: 34,
          pitch: 10,
        },
      }
    );
  
    map.setStreetView(panorama);
  }