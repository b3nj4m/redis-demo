module.exports = {
  init: function(socket) {
    window.console.log('init', socket);

    socket.emit('get', 'beans', function(val) {
      window.console.log('beans', window.JSON.parse(val));
    });
  }
};
