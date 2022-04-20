let panorama;

function initStreetView() {
    const starting = { lat: 42.359032, lng: -71.093580 };
    const sv = new window.google.maps.StreetViewService();

    // set up panorama viewer
    panorama = new window.google.maps.StreetViewPanorama(
        document.getElementById('pano')
    );

    // set initial sv camera
    sv.getPanorama({ location: starting, radius: 50 }).then(processSVData);
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

function geocode(query) {
    let geocoder = new window.google.maps.Geocoder();
    geocoder.geocode( { 'address': query}, function(results, status) {
        if (status == 'OK') {
            // console.log(results[0].geometry.location);
            let currPano = panorama.getPano();
            undoPanos.push(() => panorama.setPano(currPano));
            panorama.setPosition(new google.maps.LatLng(results[0].geometry.location));
        } else {
          console.log('Geocode was not successful for the following reason: ' + status);
        }
      });  
}

var gesture = '';
var cursorPosition;
var lastAction;
var interval;
var continueAction = false;
var gestureTimer = false;

var undoPanos = [];

var moveTimeout = 1000;
var continueTimeout = 1000;

function updateGestureUI(gestureType) {
    let display = document.getElementById('gesture-container');
    display.textContent = 'DETECTED COMMAND: ' + gestureType;
}

function changeRotation(hand, xd, yd) {
    var newGesture = 'ROTATE';
    var xChange, yChange;
    if (hand) {
        var palmVelX = hand.palmVelocity[0];
        var palmVelY = hand.palmVelocity[1];
        var xDirection = Math.abs(palmVelX) > Math.abs(palmVelY);
        var xChange = xDirection ? 5 : 0;
        var yChange = xDirection ? 0 : 5;
        if (palmVelX > 0) xChange *= -1;
        if (palmVelY > 0) yChange *= -1;
    }
    else {
        xChange = xd;
        yChange = yd;
    }
    var pov = panorama.getPov()
    var newHeading = pov.heading + xChange;
    if (newHeading >= 360) newHeading -= 360;
    else if (newHeading < 0) newHeading += 360;
    var newPitch = pov.pitch + yChange;
    if (newPitch >= 90) newPitch = 90;
    else if (newPitch <= -90) newPitch = -90;
    gestureTimer = true;
    undoPanos.push(() => panorama.setPov({heading: pov.heading, pitch: pov.pitch}));
    panorama.setPov({
        heading: newHeading,
        pitch: newPitch
    });
    lastAction = () => changeRotation(hand1, xd, yd);
    setTimeout(() => gestureTimer = false , 50 );
    return newGesture;
}

function changeZoom(hand1, hand2, change) {
    var zoomChange;
    var newGesture = "";
    if (hand1 && hand2) {
        if (hand1.palmVelocity[0] > 25) {
            newGesture = 'ZOOM IN';
            zoomChange = 0.1;
        }
        else if (hand1.palmVelocity[0] < -25) {
            newGesture = 'ZOOM OUT';
            zoomChange = -0.1;
        }
    }
    else {
        zoomChange = change;
    }
    let zoom = panorama.getZoom();
    if ((zoomChange !== 0) && ((zoom + zoomChange) > 0)) {
        undoPanos.push(() => panorama.setZoom(zoom));
        panorama.setZoom(zoom + zoomChange);
        gestureTimer = true;
        lastAction = () => changeZoom(hand1, hand2, change);
        setTimeout(() => gestureTimer = false , 50 );
    }
    return newGesture;
}

function changePosition(hand, change) {
    var newGesture = 'MOVE';
    var currHeading = panorama.getPov().heading;

    if (hand) currHeading +=  Math.atan(hand.direction[0] / hand.direction[2]) * 180 / Math.PI;
    else currHeading += change;

    var links = panorama.getLinks();

    for (let link of links) {
        // should double check this
        var diff1 = Math.abs(currHeading - link.heading);
        var diff2 = Math.abs(Math.abs(currHeading - link.heading) - 360);
        link.diff = diff1 < diff2 ? diff1 : diff2;
    }
    links = links.sort((obj1, obj2) => obj1.diff - obj2.diff);

    var newPano = links[0].pano;
    let id = panorama.getPano();
    undoPanos.push(() => panorama.setPano(id));
    panorama.setPano(newPano);

    gestureTimer = true;
    lastAction = () => changePosition(hand, change);
    setTimeout(() => gestureTimer = false , moveTimeout );
    return newGesture;
}

function myMod(x, base) {
    return ((x % base) + base) % base;
}

// Gesture loop
Leap.loop({ frame: function(frame) {
    var hands = frame.hands;

    if (!hands.length) return;

    var hand = frame.hands[0];
    var movePointing = hand.indexFinger.extended && !(hand.thumb.extended) && !(hand.pinky.extended) && !(hand.middleFinger.extended) && !(hand.ringFinger.extended);
    var undoPointing = !(hand.indexFinger.extended) && hand.thumb.extended && !(hand.pinky.extended) && !(hand.middleFinger.extended) && !(hand.ringFinger.extended);
    var redoPointing = !(hand.indexFinger.extended) && !(hand.thumb.extended) && hand.pinky.extended && !(hand.middleFinger.extended) && !(hand.ringFinger.extended);
    var palmVel = hand.palmVelocity;
    var palmVelX = palmVel[0];
    var palmVelY = palmVel[1];
    var velMag = (palmVelX ** 2 + palmVelY ** 2) ** 0.5;
    
    if (gestureTimer) return;

    var newGesture = gesture;

    // zoom gesture
    if (hands.length > 1 && hand.grabStrength > 0.9 && hands[1].grabStrength > 0.9) {
        newGesture = changeZoom(hand, hands[1], null);
        if (newGesture !== gesture) continueAction = false;
    }
    // move gesture
    else if (movePointing) {
        let pointingDirection = hand.indexFinger.direction;
        if (pointingDirection[1] > 0.3) moveTimeout *= 1.1;
        else if (pointingDirection[1] < -0.3) moveTimeout /= 1.1;
        newGesture = changePosition(hand, null);
        if (newGesture !== gesture) continueAction = false;
    }
    // undo gesture
    else if (undoPointing && undoPanos.length) {
        undoPanos.pop()();
        continueAction = false;
        newGesture = 'UNDO';
    }
    // rotate gesture
    else if (hands.length == 1 && velMag > 100 && hand.grabStrength > 0.9) {
        newGesture = changeRotation(hand, null);
        if (newGesture !== gesture) continueAction = false;
    }
    // continue gesture
    else if (hand.pitch() < -1 && lastAction && !continueAction) {
        lastAction();
        interval = setInterval(lastAction, continueTimeout);
        continueAction = true;
    }
    // stop gesture
    else if (hand.pitch() > 1 && interval) {
        newGesture = "STOP";
        if (newGesture !== gesture) continueAction = false;
    }

    // new gesture overwrites
    if (!continueAction && interval && (newGesture !== gesture)) {
        clearInterval(interval);
        interval = null;
    }

    gesture = newGesture;
    // console.log(gesture);
    updateGestureUI(gesture);
}});


// speech loop
var processSpeech = function(transcript) {
    // Helper function to detect if any commands appear in a string
    var userSaid = function(str, commands) {
      for (var i = 0; i < commands.length; i++) {
        if (str.indexOf(commands[i]) > -1)
          return true;
      }
      return false;
    };
  
    transcript = transcript.toLowerCase();
  
    var processed = false;

    console.log(transcript);

    // rotations
    if (userSaid(transcript, ["rotate right up", "rotate upright", "rotate right and up", "rotate up and right", "turn right up", "turn upright", "turn right and up", "turn up and right"])) {
        changeRotation(null, 90, 25);
        continueAction = false;
        gesture = "ROTATE";
        processed = true;
    } 
    else if (userSaid(transcript, ["rotate write down", "rotate downright", "rotate right and down", "rotate down and right", "turn write down", "turn downright", "turn right and down", "turn down and right"])) {
        changeRotation(null, 90, -25);
        continueAction = false;
        gesture = "ROTATE";
        processed = true;
    }
    else if (userSaid(transcript, ["rotate left up", "rotate up left", "rotate left and up", "rotate up and left", "turn left up", "turn up left", "turn left and up", "turn up and left"])) {
        changeRotation(null, -90, 25);
        continueAction = false;
        gesture = "ROTATE";
        processed = true;
    }
    else if (userSaid(transcript, ["rotate left down", "rotate down left", "rotate left and down", "rotate down and left", "turn left down", "turn down left", "turn left and down", "turn down and left"])) {
        changeRotation(null, -90, -25);
        continueAction = false;
        gesture = "ROTATE";
        processed = true;
    }
    else if (userSaid(transcript, ["rotate right", "turn right"])) {
        changeRotation(null, 90, 0);
        continueAction = false;
        gesture = "ROTATE";
        processed = true;
    } 
    else if (userSaid(transcript, ["rotate left", "turn left"])) {
        changeRotation(null, -90, 0);
        continueAction = false;
        gesture = "ROTATE";
        processed = true;
    }
    else if (userSaid(transcript, ["rotate up", "turn up"])) {
        changeRotation(null, 0, 25);
        continueAction = false;
        gesture = "ROTATE";
        processed = true;
    }
    else if (userSaid(transcript, ["rotate down", "turn down"])) {
        changeRotation(null, 0, -25);
        continueAction = false;
        gesture = "ROTATE";
        processed = true;
    }

    // transport
    else if (userSaid(transcript, ["go to", "move to", "transport to"])) {
        let splitted = transcript.split("to");
        let query = splitted[splitted.length - 1];
        geocode(query);
        continueAction = false;
        gesture = "MOVE";
        processed = true;
    }

    // do the move move
    else if (userSaid(transcript, ["move forward", "moves forward", "go forward", "move straight", "moves straight", "go straight"])) {
        changePosition(null, 0);
        continueAction = false;
        gesture = "MOVE";
        processed = true;
    }
    else if (userSaid(transcript, ["move backward", "moves backward", "go backward", "go back", "move back"])) {
        changePosition(null, 180);
        continueAction = false;
        gesture = "MOVE";
        processed = true;
    }
    else if (userSaid(transcript, ["move slight right", "move slightly right", "move right slightly", "go slight right", "go slightly right", "go right slightly", "moves slight right", "moves slightly right", "moves right slightly"])) {
        changePosition(null, 45);
        continueAction = false;
        gesture = "MOVE";
        processed = true;
    }
    else if (userSaid(transcript, ["move slight left", "move slightly left", "move left slightly", "go slight left", "go slightly left", "go left slightly", "moves slight left", "moves slightly left", "moves left slightly"])) {
        changePosition(null, -45);
        continueAction = false;
        gesture = "MOVE";
        processed = true;
    }
    else if (userSaid(transcript, ["move right", "moves right", "go right",])) {
        changePosition(null, 90);
        continueAction = false;
        gesture = "MOVE";
        processed = true;
    }
    else if (userSaid(transcript, ["move left", "moves left", "go left"])) {
        changePosition(null, -90);
        continueAction = false;
        gesture = "MOVE";
        processed = true;
    }

    // zoom
    else if (userSaid(transcript, ["zoom in a little"])) {
        changeZoom(null, null, 0.1);
        continueAction = false;
        gesture = 'ZOOM IN';
        processed = true;
    }
    else if (userSaid(transcript, ["zoom out a little"])) {
        changeZoom(null, null, -0.1);
        continueAction = false;
        gesture = 'ZOOM OUT';
        processed = true;
    }
    else if (userSaid(transcript, ["zoom in a lot"])) {
        changeZoom(null, null, 0.5);
        continueAction = false;
        gesture = 'ZOOM IN';
        processed = true;
    }
    else if (userSaid(transcript, ["zoom out a lot"])) {
        changeZoom(null, null, -0.5);
        continueAction = false;
        gesture = 'ZOOM OUT';
        processed = true;
    }
    else if (userSaid(transcript, ["zoom in"])) {
        changeZoom(null, null, 0.25);
        continueAction = false;
        gesture = 'ZOOM IN';
        processed = true;
    }
    else if (userSaid(transcript, ["zoom out"])) {
        changeZoom(null, null, -0.25);
        continueAction = false;
        gesture = 'ZOOM OUT';
        processed = true;
    }

    // faster/slower
    else if (userSaid(transcript, ["faster"]) && continueAction) {
        clearInterval(interval);
        continueTimeout /= 1.5;
        interval = setInterval(lastAction, continueTimeout);
    }
    else if (userSaid(transcript, ["slower"]) && continueAction) {
        clearInterval(interval);
        continueTimeout *= 1.5;
        interval = setInterval(lastAction, continueTimeout);
    }

    else if (userSaid(transcript, ["faster"]) && gesture === "MOVE") {
        moveTimeout /= 1.5;
    }
    else if (userSaid(transcript, ["slower"]) && gesture === "MOVE") {
        moveTimeout *= 1.5;
    }

    // undo/redo
    else if (userSaid(transcript, ["undo"]) && undoPanos.length) {
        undoPanos.pop()();
        continueAction = false;
        gesture = 'UNDO';
        processed = true;
    }

    // continue  
    else if (userSaid(transcript, ["continue", "keep"]) && lastAction && !continueAction) {
        lastAction();
        interval = setInterval(lastAction, continueTimeout);
        continueAction = true;
    }

    // stop 
    else if (userSaid(transcript, ["stop"]) && lastAction && continueAction) {
        continueAction = false;
        gesture = 'STOP';
        processed = true;
    }

    if (!continueAction && interval) {
        clearInterval(interval);
        interval = null;
    }

    if (processed) updateGestureUI(gesture);

    return processed;
};