// state variables
var panorama;
var voiceCommand = '';
var gesture = '';
var oneHandPresent = false;
var doingInteractiveZoom = false;
var lastAction;
var interval;
var continueAction = false;
var gestureTimer = false;
var undoPanos = [];
var numVoiceErrors = 0;
var maxVoiceErrors = 3;
var notifications = [];


// constants
var moveTimeout = 1000;
var rotateTimeout = 50;
var zoomTimeout = 50;
var continueTimeout = 1000;


// google maps streetview + geocoding functions
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
        console.log(results);
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

// cookie things
function getCookie(cname) {
    let name = cname + "=";
    let decodedCookie = decodeURIComponent(document.cookie);
    let ca = decodedCookie.split(';');
    for(let i = 0; i <ca.length; i++) {
      let c = ca[i];
      while (c.charAt(0) == ' ') {
        c = c.substring(1);
      }
      if (c.indexOf(name) == 0) {
        return c.substring(name.length, c.length);
      }
    }
    return "{}";
}

let savedLocations = JSON.parse(getCookie("locations"));

// helper functions
function updateGestureUI(gestureType) {
    let display = document.getElementById('gesture-container');
    display.textContent = 'COMMAND: ' + gestureType;
}

function updateTranscriptUI(transcript) {
    let display = document.getElementById('transcript-container');
    display.textContent = 'TRANSCRIPT: ' + transcript;
}

function updateHandsInRangeUI(inRange) {
    let display = document.getElementById('in-range-info');
    let border = document.getElementById('pano-border');
    let color = inRange ? '#3edc73' : 'white';
    let text = inRange ? 'Hands In Range' : 'Hands Not In Range';
    border.style.backgroundColor = color;
    display.textContent = text;
}

function updateNotificationUI() {
    let display = document.getElementById('notification-container');
    display.innerHTML = notifications.toString().replace(",", "<br>");
}

setInterval(() => {
    if (panorama.getLinks().length <= 1 && !notifications.includes("You hit a dead end!")) notifications.push("You hit a dead end!");
    else if (panorama.getLinks().length > 1 && notifications.includes("You hit a dead end!")) notifications.splice(notifications.indexOf("You hit a dead end!"), 1);
    updateNotificationUI();
}, 100);

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
    lastAction = () => changeRotation(hand, xd, yd);
    setTimeout(() => gestureTimer = false , rotateTimeout );
    return newGesture;
}

function changePosition(hand, change) {
    var newGesture = 'MOVE';
    var currHeading = panorama.getPov().heading;

    if (hand) currHeading +=  Math.atan(hand.direction[0] / hand.direction[2]) * 180 / Math.PI;
    else currHeading += change;

    var links = panorama.getLinks();

    if (!links.length) return "";

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

function changeZoom(hand1, hand2, change) {
    var zoomChange;
    var newGesture = "";
    if (hand1 && hand2) {
        let rightHand = hand1.type === "right" ? hand1 : hand2;
        if (rightHand.palmVelocity[0] > 25) {
            newGesture = 'ZOOM IN';
            zoomChange = 0.1;
        }
        else if (rightHand.palmVelocity[0] < -25) {
            newGesture = 'ZOOM OUT';
            zoomChange = -0.1;
        }
    }
    else {
        zoomChange = change / 100.;
    }
    let zoom = panorama.getZoom();
    if ((zoomChange !== 0) && ((zoom + zoomChange) >= 0)) {
        undoPanos.push(() => panorama.setZoom(zoom));
        panorama.setZoom(zoom + zoomChange);
        gestureTimer = true;
        lastAction = () => changeZoom(hand1, hand2, change);
        setTimeout(() => gestureTimer = false , zoomTimeout );
    }
    return newGesture;
}

function interactiveZoom(hand) {
    newGesture = 'ZOOM';

    // parse hand data to get thumb-index distance
    var thumbPos = hand.thumb.bones.at(-1).nextJoint;
    var indexPos = hand.indexFinger.bones.at(-1).nextJoint;
    var dist2 = Math.pow(thumbPos[0] - indexPos[0], 2) + Math.pow(thumbPos[1] - indexPos[1], 2) + Math.pow(thumbPos[2] - indexPos[2], 2);
    var dist = Math.round(Math.sqrt(dist2));

    // normalize distance
    var scaleMin = 50;
    var scaleMax = 100;
    var scaleFactor = 5.0;
    var zoom;
    if (dist < scaleMin) zoom = 0.0;
    else if (dist > scaleMax) zoom = scaleFactor * 1.0;
    else zoom = scaleFactor * (dist - scaleMin) / (scaleMax - scaleMin);

    // change zoom
    let currZoom = panorama.getZoom();
    panorama.setZoom(zoom);

    gestureTimer = true;
    lastAction = () => interactiveZoom(hand);
    setTimeout(() => gestureTimer = false , zoomTimeout );

    return newGesture;
}


// Gesture loop
Leap.loop({ frame: function(frame) {
    var newGesture = gesture;
    var hands = frame.hands;
    oneHandPresent = hands.length && hands.length === 1;

    // interactive zoom gesture
    if (oneHandPresent && voiceCommand === 'ZOOM') doingInteractiveZoom = true;
    if (doingInteractiveZoom && !oneHandPresent) doingInteractiveZoom = false;
    if (doingInteractiveZoom) {
        newGesture = interactiveZoom(frame.hands[0]);
        updateGestureUI(newGesture);
        if (newGesture !== gesture) continueAction = false;
    }
    if (doingInteractiveZoom && voiceCommand === 'STOP_ZOOM') doingInteractiveZoom = false;

    // update hands in range ui
    let inRange = hands.length > 0;
    updateHandsInRangeUI(inRange);
    
    if (!hands.length) return;

    var hand = frame.hands[0];
    var movePointing = hand.indexFinger.extended && !(hand.thumb.extended) && !(hand.pinky.extended) && !(hand.middleFinger.extended) && !(hand.ringFinger.extended);
    var undoPointing = !(hand.indexFinger.extended) && hand.thumb.extended && !(hand.pinky.extended) && !(hand.middleFinger.extended) && !(hand.ringFinger.extended);
    var palmVel = hand.palmVelocity;
    var palmVelX = palmVel[0];
    var palmVelY = palmVel[1];
    var velMag = (palmVelX ** 2 + palmVelY ** 2) ** 0.5;
    
    if (gestureTimer) return;

    // move gesture
    if (movePointing) {
        let pointingDirection = hand.indexFinger.direction;
        if (pointingDirection[1] > 0.3) moveTimeout *= 1.1;
        else if (pointingDirection[1] < -0.3) moveTimeout /= 1.1;
        newGesture = changePosition(hand, null);
        if (newGesture !== gesture) continueAction = false;
    }

    // rotate gesture
    else if (hands.length == 1 && velMag > 100 && hand.grabStrength > 0.9) {
        newGesture = changeRotation(hand, null);
        if (newGesture !== gesture) continueAction = false;
    }

    // new gesture overwrites
    if (!continueAction && interval && (newGesture !== gesture)) {
        clearInterval(interval);
        interval = null;
    }

    gesture = newGesture;
    updateGestureUI(gesture);
}});


// Speech loop
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
    updateTranscriptUI(transcript);
  
    var processed = false;
    // console.log(transcript);  // for debugging

    // clear notification ui if user talks again
    if (transcript && notifications.includes('Sorry I didn\'t catch that. Can you say that again?')) notifications.splice(notifications.indexOf('Sorry I didn\'t catch that. Can you say that again?'), 1); 
    if (transcript && notifications.includes('The saved location you tried to delete does not exist!')) notifications.splice(notifications.indexOf('The saved location you tried to delete does not exist!'), 1); 
    updateNotificationUI();

    // opening instructions tab
    if (userSaid(transcript, ["how", "open", "help"])) {
        if (!document.getElementById('offcanvasRight').classList.contains("show")) {
            $('#offcanvas-toggle').click();
        }
        if (userSaid(transcript, ["rotate", "tilt", "pan", "turn"])) $("#accordion-rotate-button").click(); 
        else if (userSaid(transcript, ["move"])) $("#accordion-move-button").click(); 
        else if (userSaid(transcript, ["zoom"])) $("#accordion-zoom-button").click(); 
        else if (userSaid(transcript, ["continue", "keep", "stop"])) $("#accordion-continue-button").click(); 
        else if (userSaid(transcript, ["change", "modify"])) $("#accordion-modify-button").click(); 
        else if (userSaid(transcript, ["transport", "go to"])) $("#accordion-transport-button").click(); 
        else if (userSaid(transcript, ["undo"])) $("#accordion-undo-button").click(); 
        else if (userSaid(transcript, ["save", "bookmark"])) $("#accordion-save-button").click(); 
        else if (userSaid(transcript, ["remove", "delete"])) $("#accordion-remove-button").click(); 
        processed = true;
    }

    // closing instructions tab
    else if (userSaid(transcript, ["close"])) {
        if (document.getElementById('offcanvasRight').classList.contains("show")) $('#offcanvas-toggle').click();
        processed = true;
    }

    // rotations
    else if (userSaid(transcript, ["rotate right", "turn right", "pan right", "tilt right"])) {
        let degree = 90;
        if (userSaid(transcript, ["°"])) {
            let splitted = transcript.split("°")[0].split(" ");
            degree = parseInt(splitted[splitted.length - 1]) || wordsToNumbers(splitted[splitted.length - 1]);
        }
        else if (userSaid(transcript, ["degrees"]) ) {
            let splitted = transcript.split("degrees")[0].split(" ");
            degree = parseInt(splitted[splitted.length - 2]) || wordsToNumbers(splitted[splitted.length - 2]);
        }
        changeRotation(null, degree, 0);
        continueAction = false;
        gesture = "ROTATE";
        processed = true;
    } 
    else if (userSaid(transcript, ["rotate left", "turn left", "pan left", "tilt left"])) {
        let degree = 90;
        if (userSaid(transcript, ["°"])) {
            let splitted = transcript.split("°")[0].split(" ");
            degree = parseInt(splitted[splitted.length - 1]) || wordsToNumbers(splitted[splitted.length - 1]);
        }
        else if (userSaid(transcript, ["degrees"]) ) {
            let splitted = transcript.split("degrees")[0].split(" ");
            degree = parseInt(splitted[splitted.length - 2]) || wordsToNumbers(splitted[splitted.length - 2]);
        }
        changeRotation(null, -degree, 0);
        continueAction = false;
        gesture = "ROTATE";
        processed = true;
    }
    else if (userSaid(transcript, ["rotate up", "turn up", "pan up", "tilt up"])) {
        let degree = 25;
        if (userSaid(transcript, ["°"])) {
            let splitted = transcript.split("°")[0].split(" ");
            degree = parseInt(splitted[splitted.length - 1]) || wordsToNumbers(splitted[splitted.length - 1]);
        }
        else if (userSaid(transcript, ["degrees"]) ) {
            let splitted = transcript.split("degrees")[0].split(" ");
            degree = parseInt(splitted[splitted.length - 2]) || wordsToNumbers(splitted[splitted.length - 2]);
        }
        changeRotation(null, 0, degree);
        continueAction = false;
        gesture = "ROTATE";
        processed = true;
    }
    else if (userSaid(transcript, ["rotate down", "turn down", "pan down", "tilt down"])) {
        let degree = 25;
        if (userSaid(transcript, ["°"])) {
            let splitted = transcript.split("°")[0].split(" ");
            degree = parseInt(splitted[splitted.length - 1]) || wordsToNumbers(splitted[splitted.length - 1]);
        }
        else if (userSaid(transcript, ["degrees"]) ) {
            let splitted = transcript.split("degrees")[0].split(" ");
            degree = parseInt(splitted[splitted.length - 2]) || wordsToNumbers(splitted[splitted.length - 2]);
        }
        changeRotation(null, 0, -degree);
        continueAction = false;
        gesture = "ROTATE";
        processed = true;
    }

    // transport
    else if (userSaid(transcript, ["go to", "move to", "transport to"])) {
        let splitted = transcript.split("to ");
        let query = splitted[splitted.length - 1];
        if (savedLocations[query]) panorama.setPano(savedLocations[query]);
        else geocode(query);
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

    // move to next intersection
    else if (userSaid(transcript, ["next block", "next street", "next intersection"])) {
        gesture = "MOVE";
        updateGestureUI(gesture);
        (function repeat(){
            setTimeout(function() {
               changePosition(null, 0);
               if (panorama.getLinks().length >= 4 || panorama.getLinks().length === 1) return;
               repeat();
           }, 200);
         })();
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
        let zoom = 25;
        if (userSaid(transcript, ["%"])) {
            let splitted = transcript.split("%")[0].split(" ");
            zoom = parseInt(splitted[splitted.length - 1]) || wordsToNumbers(splitted[splitted.length - 1]);
        }
        else if (userSaid(transcript, ["percent"]) ) {
            let splitted = transcript.split("percent")[0].split(" ");
            zoom = parseInt(splitted[splitted.length - 2]) || wordsToNumbers(splitted[splitted.length - 2]);
        }
        changeZoom(null, null, zoom);
        continueAction = false;
        gesture = 'ZOOM IN';
        processed = true;
    }
    else if (userSaid(transcript, ["zoom out"])) {
        let zoom = 25;
        if (userSaid(transcript, ["%"])) {
            let splitted = transcript.split("%")[0].split(" ");
            zoom = parseInt(splitted[splitted.length - 1]) || wordsToNumbers(splitted[splitted.length - 1]);
        }
        else if (userSaid(transcript, ["percent"]) ) {
            let splitted = transcript.split("percent")[0].split(" ");
            zoom = parseInt(splitted[splitted.length - 2]) || wordsToNumbers(splitted[splitted.length - 2]);
        }
        changeZoom(null, null, -zoom);
        continueAction = false;
        gesture = 'ZOOM OUT';
        processed = true;
    }
    else if (userSaid(transcript, ["zoom"])) {  // interactive zoom
        voiceCommand = 'ZOOM';
        continueAction = false;
        processed = true;
    }
    else if (userSaid(transcript, ["stop", "done"])) {
        voiceCommand = 'STOP_ZOOM';
        continueAction = false;
        processed = true;
    }

    // faster/slower
    else if (userSaid(transcript, ["fast"])) {
        if (continueAction) {
            clearInterval(interval);
            continueTimeout /= 1.5;
            interval = setInterval(lastAction, continueTimeout);
        }
        else if (gesture === "MOVE") moveTimeout /= 1.5;
        else if (gesture === "ROTATE") rotateTimeout /= 1.5;
        else if (gesture === "ZOOM") zoomTimeout /= 1.5;

    }
    else if (userSaid(transcript, ["slow"])) {
        if (continueAction) {
            clearInterval(interval);
            continueTimeout *= 1.5;
            interval = setInterval(lastAction, continueTimeout);
        }
        else if (gesture === "MOVE") moveTimeout *= 1.5;
        else if (gesture === "ROTATE") rotateTimeout *= 1.5;
        else if (gesture === "ZOOM") zoomTimeout *= 1.5;
    }

    // undo
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

    // save location
    else if (userSaid(transcript, ["save as", "bookmark as"])) {
        let splitted = transcript.split("as ");
        let query = splitted[splitted.length - 1];
        savedLocations[query] = panorama.getPano();
        document.cookie = "locations=" + JSON.stringify(savedLocations);
        processed = true;
    }

    // remove location
    else if (userSaid(transcript, ["remove"])) {
        let splitted = transcript.split("remove");
        let query = splitted[splitted.length - 1];
        if (savedLocations.hasOwnProperty(query)) delete savedLocations[query];
        else notifications.push('The saved location you tried to delete does not exist!');
        document.cookie = "locations=" + JSON.stringify(savedLocations);
        processed = true;
    }

    else {
        if (!continueAction && interval) {
            clearInterval(interval);
            interval = null;
        }
    
        if (processed) updateGestureUI(gesture);

        // handle any potential voice errors
        voiceCommand = (transcript.length > 0) ? "UNKNOWN" : "";
        if (voiceCommand === "UNKNOWN") numVoiceErrors += 1;
        if (numVoiceErrors > maxVoiceErrors) {
            if (!notifications.includes('Sorry I didn\'t catch that. Can you say that again?')) notifications.push('Sorry I didn\'t catch that. Can you say that again?');
            updateNotificationUI();
            numVoiceErrors = 0;
        }
    
        return processed;
    }

};

window.initStreetView = initStreetView;