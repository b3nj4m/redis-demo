var Backbone = require('backbone');
var $ = require('jquery');
var app = require('./app');

Backbone.$ = $;

$(window.document).ready(function() {
  app.init();
});
