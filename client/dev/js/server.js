var io = require('socket.io-client');
var Q = require('q');

function Server(socket, opts) {
  this.socket = io();
  this.join = Q.nbind(this.socket.emit, this.socket, 'subscribe');
  this.leave = Q.nbind(this.socket.emit, this.socket, 'unsubscribe');
  this.send = Q.nbind(this.socket.emit, this.socket, 'message');
  this.on = Q.nbind(this.socket.on, this.socket);
}

module.exports = Server;
