var gulp = require('gulp');
var gutil = require('gulp-util');
var shell = require('gulp-shell');
var nodemon = require('nodemon');
var browserify = require('browserify');
var shim = require('browserify-shim');
var underscorify = require('node-underscorify');
var clean = require('gulp-clean');
var connect = require('connect');
var serveStatic = require('serve-static');
var http = require('http');
var source = require('vinyl-source-stream');
var redis = require('redis');

gulp.task('redis-server', ['redis-exit-handler'], shell.task(['redis-server'], {quiet: true}));

gulp.task('redis-exit-handler', function() {
  process.on('exit', function() {
    gutil.log('shutting down redis-server...');
    var client = redis.createClient(6379, 'localhost');
    client.shutdown();
    gutil.log('redis server shutdown');
  });
});

gulp.task('node-server', function() {
  var nm = nodemon({script: 'index.js', ignore: ['client/*']});

  nm.on('restart', function() {
    gutil.log('reloading index.js');
  });
});

gulp.task('client-server', function(done) {
  var app = connect();

  app.use(serveStatic('client/build'));

  var server = http.createServer(app);

  server.listen(8000);

  server.on('listening', function() {
    gutil.log('listening for http on port 8000');
    done();
  });

  server.on('error', function(err) {
    gutil.log(err);
    done(err);
  });
});

gulp.task('clean-client', function() {
  return gulp.src('./client/build/**/*', {read: false})
    .pipe(clean());
});

gulp.task('client-static', ['clean-client'], function() {
  return gulp.src('client/static/**/*')
    .pipe(gulp.dest('client/build'));
});

var buildClient = function() {
  return browserify({entries: ['./client/dev/js/index.js'], basedir: '.'})
    .transform(shim)
    .transform(underscorify)
    .bundle()
    .pipe(source('index.js'))
    .pipe(gulp.dest('client/build'));
};

gulp.task('build-client', ['clean-client'], buildClient);
gulp.task('build-client-watch', buildClient);

gulp.task('watch-client', ['clean-client', 'build-client'], function() {
  gulp.watch('client/dev/js/**/*.js', ['build-client-watch']);
});

gulp.task('dev', ['redis-server', 'node-server', 'build-client', 'watch-client', 'client-static']);
