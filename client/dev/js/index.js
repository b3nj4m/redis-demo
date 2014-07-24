var socketio = require('socket.io-client');
var $ = require('jquery');
var app = require('./app');

$.ready(function() {
  var io = socketio('http://localhost:8080');

  io.on('connection', function(socket) {
    app.init(socket);
  });
});
