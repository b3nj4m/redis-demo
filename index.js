var _ = require('underscore');
var cluster = require('cluster');
var express = require('express');
var msgpack = require('msgpack');
var bodyParser = require('body-parser');
var http = require('http');
var socketio = require('socket.io');
var redis = require('redis');
var Q = require('q');
var os = require('os');

//TODO pipe redis pub/sub through messagepack to socket.io
if (cluster.isMaster) {
  for (var i = 0; i < os.cpus().length; i++) {
    cluster.fork();
  }
}
else {
  var worker = cluster.worker;

  var app = express();

  var server = http.createServer(app);
  var io = socketio(server);

  var redisClient = redis.createClient(6379, 'localhost', {return_buffers: true});

  var redisGet = Q.nbind(redisClient.get, redisClient);
  var redisSet = Q.nbind(redisClient.set, redisClient);

  function log() {
    return console.log.apply(console, ['worker', worker.id].concat(_.toArray(arguments)));
  }

  function get(key) {
    log('get', key);

    return redisGet(key).then(function(val) {
      try {
        log('packed value', val);
        val = msgpack.unpack(val);
        log('unpacked value', val);
      }
      catch (err) {
        console.log('error', err);
        throw err;
      }
      finally {
        return val;
      }
    },
    function(err) {
      throw err;
    });
  }

  function set(key, val) {
    var defer = Q.defer();

    log('set', key, val);

    try {
      val = JSON.parse(val);
      val = msgpack.pack(val);
    }
    catch (err) {
      log('error', err);
      defer.reject(err);
    }
    finally {
      redisSet(key, val).then(function() {
        defer.resolve();
      },
      function(err) {
        defer.reject(err);
      });
    }

    return defer.promise;
  }

  app.use(bodyParser.text({type: 'application/*'}));

  app.use(express.static('build'));

  app.get('/:key', function(req, res) {
    get(req.params.key).then(function(val) {
      res.set('Content-Type', 'application/json');
      res.send(val);
    },
    function(err) {
      res.send(err);
    });
  });

  app.post('/:key', function(req, res) {
    set(req.params.key, req.body).then(function() {
      res.send();
    },
    function(err) {
      res.send(err);
    });
  });

  io.on('connection', function(socket) {
    socket.on('get', function(key, fn) {
      get(key).then(fn);
    });

    socket.on('set', function(key, val, fn) {
      set(key, val).then(fn);
    });
  });

  server.listen(8080);
}
