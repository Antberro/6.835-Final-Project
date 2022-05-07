# **Google StreetBuddy**

A multimodal user interface that uses gestures and speech to create a more natural Google Street View experience.

#  Requirements
### Software
* [Leap Hand Tracking Software](https://developer.leapmotion.com/tracking-software-download)
* [Leap Motion API](https://developer-archive.leapmotion.com/documentation/javascript/api/Leap_Classes.html)
* [Google Maps Javascript API](https://developers.google.com/maps/documentation/javascript/overview)
* [Google Maps Geocoding API](https://developers.google.com/maps/documentation/geocoding/overview)
* [Google Maps Directions API](https://developers.google.com/maps/documentation/directions/overview)
* [Web Speech API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Speech_API)
* [Node.js](https://nodejs.org/en/)
* [Bootstrap](https://getbootstrap.com/)

### Hardware
* Leap Motion
* Laptop 
  * Microphone
  * Speaker
  * Desktop

# Installation
To install all libraries needed, run `npm i` in the project directory.

# Usage
Make sure Leap Motion is connected to computer. Navigate to the project directory and run:
```bash
node server.js
```
This will start the backend server on your machine. In Chrome go to http://localhost:8000. Give the browser permission to access the microphone and enjoy!

# File Breakdown
* server.js
* public/
    * index.html
    * img/
        * avatar.png
        * move.gif
        * rotate.gif
        * zoom.gif
    * css/
        * styles.css
    * js/
        * streetview.js
    * lib/

**server.js:** runs local server for displaying webpage.

**public/index.html:** defines structure of webpage.

**public/img:** holds gifs of gesture demonstrations and icon for use in map.

**public/css/styles.css:** defines styling of webpage.

**public/js/streetview.js:** main script containing ui logic.

**public/lib:** folder containing additional libraries (from miniproject 3).