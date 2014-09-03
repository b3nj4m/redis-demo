var _ = require('underscore');
var cluster = require('cluster');
var sticky = require('sticky-session');
var express = require('express');
var msgpack = require('msgpack');
var bodyParser = require('body-parser');
var http = require('http');
var socketio = require('socket.io');
var redis = require('redis');
var socketRedis = require('socket.io-redis');
var Q = require('q');

sticky(function() {
  var worker = cluster.worker;

  var app = express();

  var server = http.createServer(app);
  var io = socketio(server);
  io.adapter(socketRedis({host: 'localhost'}));

  var redisClient = createRedisClient();

  var redisGet = Q.nbind(redisClient.get, redisClient);
  var redisSet = Q.nbind(redisClient.set, redisClient);

  function createRedisClient() {
    return redis.createClient(6379, 'localhost', {return_buffers: true});
  }

  function redisSubscribe(channel) {
    var defer = Q.defer();

    var client = createRedisClient();

    Q.ninvoke(client, 'subscribe', channel).then(function() {
      defer.resolve(client);
    },
    function(err) {
      defer.reject(err);
    });

    return defer.promise;
  }

  function redisUnsubscribe(channel, client) {
    return Q.ninvoke(client, 'unsubscribe', channel);
  }

  function subscribe(channel, socket) {
    return redisSubscribe(channel).then(function(client) {
      subscribedChannels[channel] = client;

      socket.on('message', function(message, fn) {
        client.publish(channel, msgpack.pack(message)).then(fn);
      });
      client.on('message', function(channel, message) {
        socket.to(channel).emit('message', msgpack.unpack(message));
      });
    });
  }

  function unsubscribe(channel, client, socket) {
    return redisUnsubscribe(channel, client).then(function() {
      socket.leave(channel);
    });
  }

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
      //TODO parse isn't needed when using socket.io
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

  function subscribe(channel) {
    log('subscribe', channel);

    return redisSubscribe(channel);
  }

  function unsubscribe(channel) {
    log('unsubscribe', channel);

    return redisUnsubscribe(channel);
  }

  function handleErrorHttp(req, res) {
    return function(err) {
      res.status(500).send(err);
    };
  }

  app.use(bodyParser.text({type: 'application/*'}));

  app.use(express.static('client/build'));

  app.get('/api/:key', function(req, res) {
    get(req.params.key).then(function(val) {
      res.set('Content-Type', 'application/json');
      res.send(val);
    }, handleErrorHttp(req, res));
  });

  app.post('/api/:key', function(req, res) {
    set(req.params.key, req.body).then(function() {
      res.send();
    }, handleErrorHttp(req, res));
  });

  app.post('/api/subscribe/:channel', function(req, res) {
    subscribe(req.params.channel).then(function() {
      res.send();
    }, handleErrorHttp(req, res));
  });

  app.post('/api/unsubscribe/:channel', function(req, res) {
    unsubscribe(req.params.channel).then(function() {
      res.send();
    }, handleErrorHttp(req, res));
  });

  io.on('connection', function(socket) {
    var subscribedChannels = {};

    socket.on('get', function(key, fn) {
      get(key).then(fn);
    });

    socket.on('set', function(key, val, fn) {
      set(key, val).then(fn);
    });

    socket.on('message', function(channel, data) {
      io.to(channel).emit('message', data);
    });

    socket.on('subscribe', function(channel) {
      socket.join(channel);
    });

    socket.on('unsubscribe', function(channel) {
      socket.leave(channel);
    });
  });

  return server;
}).listen(8080);
