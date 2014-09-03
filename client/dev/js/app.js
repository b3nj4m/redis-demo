var Server = require('./server');

module.exports = {
  init: function() {
    var server = new Server();
    server.on('message', function(channel, message) {
      var el = window.document.createElement('div');
      el.innerHTML = '#' + channel + ': ' + window.JSON.stringify(message);
      el.className = 'message';
      window.document.body.appendChild(el);
    });
    window.server = server;
  }
};
