const express = require('express');
const app = express();
const host = 'localhost';
const port = 8000;

app.use(express.static(__dirname + '/public'));

app.get('/', function (req, res) {
    res.sendFile('./index.html');
})

app.listen(port, function() {
    console.log(`Server is running on http://${host}:${port}`);
})
