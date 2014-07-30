var socketio = require('socket.io-client');
var $ = require('jquery');
var app = require('./app');

$(window.document).ready(function() {
  var socket = socketio('http://localhost:8080');
  app.init(socket);
});
