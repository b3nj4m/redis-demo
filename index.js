var _ = require('underscore');
var cluster = require('cluster');
var express = require('express');
var msgpack = require('msgpack');
var bodyParser = require('body-parser');
var redis = require('redis');
var Q = require('q');
var os = require('os');

if (cluster.isMaster) {
  for (var i = 0; i < os.cpus().length; i++) {
    cluster.fork();
  }
}
else {
  var worker = cluster.worker;

  var app = express();
  app.use(bodyParser.text({type: 'application/*'}));

  var redisClient = redis.createClient(6379, 'localhost', {return_buffers: true});

  var redisGet = Q.nbind(redisClient.get, redisClient);
  var redisSet = Q.nbind(redisClient.set, redisClient);

  var log = function() {
    return console.log.apply(console, ['worker', worker.id].concat(_.toArray(arguments)));
  };

  app.use(express.static('build'));

  app.get('/get/:key', function(req, res) {
    log('get', req.params.key);
    redisGet(req.params.key).then(function(val) {
      try {
        log('packed value', val);
        val = msgpack.unpack(val);
        log('unpacked value', val);
      }
      catch (err) {
        res.send(err);
      }
      finally {
        res.set('Content-Type', 'application/json');
        res.send(val);
      }
    },
    function(err) {
      res.send(err);
    });
  });

  app.post('/set/:key', function(req, res) {
    log('set', req.params.key, req.body);
    var val;
    try {
      val = JSON.parse(req.body);
      val = msgpack.pack(req.body);
    }
    catch (err) {
      log('error', err);
      res.send(err);
    }
    finally {
      redisSet(req.params.key, val).then(function() {
        res.send();
      },
      function(err) {
        res.send(err);
      });
    }
  });

  app.listen(8080);
}
