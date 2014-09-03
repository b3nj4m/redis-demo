var _ = require('underscore');
var Q = require('q');

module.exports = {
  //TODO one socket per channel joined
  init: function(socket) {
    window.socket = socket;
    window.join = Q.nbind(socket.emit, socket, 'subscribe');
    window.leave = Q.nbind(socket.emit, socket, 'unsubscribe');
    window.send = Q.nbind(socket.emit, socket, 'message');
    socket.on('message', function(message) {
      var el = window.document.createElement('div');
      el.innerHTML = window.JSON.stringify(message);
      el.className = 'message';
      window.document.body.appendChild(el);
    });
  }
};
