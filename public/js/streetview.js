let panorama;

function initStreetView() {
    const stata = { lat: 42.362059, lng: -71.090931 };
    const sv = new window.google.maps.StreetViewService();

    // set up panorama viewer
    panorama = new window.google.maps.StreetViewPanorama(
        document.getElementById('pano')
    );

    var marker = new google.maps.Marker({
        position: stata,
        panorama,
        title: "Hello World!",
      });

    marker.setMap(panorama);

    panorama.addListener('click', (event) => {
        console.log('click at ' + event.latLng);
    });

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

function click(x, y) {
    var ev = new MouseEvent('click', {
        'view': window,
        'bubbles': true,
        'cancelable': true,
        'screenX': x,
        'screenY': y
    });

    el = document.elementFromPoint(x, y);

    el.dispatchEvent(ev);

    console.log(ev);
}


// Initialize cursor position
window.addEventListener('load', () => {
    let cursor = document.getElementById('cursor');
    cursor.style.position = 'absolute';
    cursor.style.left = 0;
    cursor.style.top = 0;
});

var cursorPosition;
var gestureTimer = false;

function changeRotation(hand) {
    var palmVelX = hand.palmVelocity[0];
    var palmVelY = hand.palmVelocity[1];
        var xDirection = Math.abs(palmVelX) > Math.abs(palmVelY);
        var xChange = xDirection ? 5 : 0;
        var yChange = xDirection ? 0 : 5;
        if (palmVelX > 0) xChange *= -1;
        if (palmVelY > 0) yChange *= -1;
        var newHeading = panorama.getPov().heading + xChange;
        if (newHeading >= 360) newHeading -= 360;
        else if (newHeading < 0) newHeading += 360;
        var newPitch = panorama.getPov().pitch + yChange;
        if (newPitch >= 90) newPitch = 90;
        else if (newPitch <= -90) newPitch = -90;
        gestureTimer = true;
        panorama.setPov({
            heading: newHeading,
            pitch: newPitch
        });
        setTimeout(() => gestureTimer = false , 50 );
}

function changeZoom(hand1, hand2) {

    console.log(hand1.palmVelocity);
    console.log(hand2.palmVelocity);
    console.log();

    if (hand1.palmVelocity[0] > 25) {
        panorama.setZoom(panorama.getZoom() + 0.1);
        gestureTimer = true;
        setTimeout(() => gestureTimer = false , 50 );
    }
    else if (hand1.palmVelocity[0] < -25) {
        panorama.setZoom(panorama.getZoom() - 0.1);
        gestureTimer = true;
        setTimeout(() => gestureTimer = false , 50 );
    }

    

}

function changePosition(hand) {
        var currHeading = panorama.getPov().heading;
        var direction = Math.atan(hand.direction[0] / hand.direction[2]) * 180 / Math.PI;
        currHeading += direction;

        var links = panorama.getLinks();

        for (let link of links) {
            // remember to change this
            link.diff = Math.abs(currHeading - link.heading);
        }
        links = links.sort((obj1, obj2) => obj1.diff - obj2.diff);

        var newPano = links[0].pano;
        panorama.setPano(newPano);

        gestureTimer = true;
        setTimeout(() => gestureTimer = false , 50 );
}

// Main loop
Leap.loop({ frame: function(frame) {
    var hands = frame.hands;

    if (!hands.length) return;

    var hand = frame.hands[0];
    var pointing = hand.indexFinger.extended && !(hand.thumb.extended) && !(hand.pinky.extended) && !(hand.middleFinger.extended) && !(hand.ringFinger.extended);
    var palmVel = hand.palmVelocity;
    var palmVelX = palmVel[0];
    var palmVelY = palmVel[1];
    var velMag = (palmVelX ** 2 + palmVelY ** 2) ** 0.5;
    
    if (gestureTimer) return;

    if (hands.length > 1) changeZoom(hand, hands[1]);
    else if (pointing) changePosition(hand);
    else if (velMag > 100 && hand.grabStrength > 0.9) changeRotation(hand);
    

}});