var express = require('express'), fs = require('fs'), dblite = require('dblite'), log4js = require('log4js');
var fs = require('fs'), app = module.exports, mm = require('musicmetadata'), util = require('util'), _ = require("lodash"), async = require("async"), df = require("duration-format");
var app = express();
var settings = {
	loggedIn: true
};
// setup logging
log4js.loadAppender('file');
log4js.addAppender(log4js.appenders.file('logs/mp3stream.log'), 'mp3stream');
var logger = log4js.getLogger('mp3stream');
logger.setLevel('INFO');

// var dir = "/volume1/music";
var dir = "c:\\users\\lucien.immink\\music";
var WORKERS = 10; // how many concurent streams do we want to handle?

var list = [];
var nrScanned = 0;


/* CORS */
var allowCrossDomain = function (req, res, next) {
	res.header('Access-Control-Allow-Origin', '*');
	res.header('Access-Control-Allow-Methods', 'GET');
	res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, Content-Length, X-Requested-With');

	res.setHeader("Cache-Control", "public, max-age=4320000"); // 12 hours
	res.setHeader("Expires", new Date(Date.now() + 4320000).toUTCString());
	// intercept OPTIONS method
	if ('OPTIONS' == req.method) {
		res.send(200);
	} else {
		next();
	}
};

app.configure(function () {
	app.use(allowCrossDomain);
	app.use(express.bodyParser());
});

/*
 serve all files stored in the web folder as normal files; you can store the website that will use the streamer in this folder.
 if you don't want this; please remove the next 2 lines.
 */
app.use(app.router);
app.use(express.static('public'));

/**
 * Streams a given mp3; if a user is logged in
 */
app.get('/listen', function (req, res) {
	var path = dir + req.query.path, full = req.query.full;
	if (settings.loggedIn) {
		fs.exists(path, function (exists) {
			if (exists) {
				if (!full) {
					logger.info("going to partial stream " + path);
					fs.readFile(path, 'binary', function (err, file) {
						var header = {};
						var range = req.headers.range;
						var parts = range.replace(/bytes=/, "").split("-");
						var partialstart = parts[0];
						var partialend = parts[1];

						var total = file.length;

						var start = parseInt(partialstart, 10);
						var end = partialend ? parseInt(partialend, 10) : total - 1;

						header["Content-Range"] = "bytes " + start + "-" + end + "/" + (total);
						header["Accept-Ranges"] = "bytes";
						header["Content-Length"] = (end - start) + 1;
						header["Connection"] = "close";

						res.writeHead(206, header);
						res.write(file.slice(start, end) + '0', "binary");
						res.end();
						return;
					});
				} else {
					logger.info("going to fully stream " + path);
					var stat = fs.statSync(path);

					res.writeHead(200, {
						'Content-Type': 'audio/mpeg',
						'Content-Length': stat.size
					});

					var readStream = fs.createReadStream(path);
					// We replaced all the event handlers with a simple call to util.pump()
					readStream.pipe(res);
				}

			} else {
				logger.warn("no file with name " + path + " found");
				res.writeHead(404);
				res.end();
			}
		});
	} else {
		logger.warn("User not authorized");
		res.writeHead(401);
		res.end();
	}
});


/**
 * Login a user
 */
app.post('/login', function (req, res) {
	logger.info("Starting authentication");
	var account = req.body.account, passwd = req.body.passwd, server = req.query.server;
	// for now always accept the login
	// send the response as JSONP
	if (account && passwd) {
		// have a sqlite db with users and passwords; it's not the responsibility of this app to create it.
		var db = dblite('users.db');
		db.query('SELECT * FROM users WHERE username = :account AND password = :passwd', {
			account: account,
			passwd: passwd
		}, {
				username: String,
				passwd: String
			}, function (rows) {
				var user = rows.length && rows[0];
				if (user.passwd === passwd) {
					res.jsonp({
						success: true
					});
					settings.loggedIn = true;
					logger.info("User " + account + " authenticated");
				} else {
					res.jsonp({
						success: false
					});
					logger.error("User " + account + " NOT authenticated");
				}
			});
	} else {
		res.jsonp({
			success: false
		});
		logger.warn("No user specified, NOT authenticated");
	}
});
logger.info("Starting node-mp3stream");
app.listen(16881);

app.get('/rescan', function (req, res) {
	if (settings.loggedIn) {
        nrScanned = 0;
        start = new Date();
		walk(dir, function (err, results) {
			totalFiles = (results) ? results.length : 0;
			logger.info("starting scan for", totalFiles, "files");
            list = [];
			setupParse(results);
            res.writeHead(204);
		    res.end();
		});
	} else {
		logger.warn("User not authorized");
		res.writeHead(401);
		res.end();
	}
});

// redirect everything to index if not in predefined list
app.get(/^(?!\/rescan|\/listen|\/data\/.*|\/dist.*|\/global.*|\/systemjs.*|\/node_modules\/.*|\/app.*).*$/, function (req, res) {
    res.sendfile('public/index.html');
});



var start = new Date();
var Track = function (data, file) {
	this.artist = data.artist[0];
	this.albumartist = data.albumartist[0];
	this.album = data.album;
	this.year = data.year;
	this.number = data.track.no;
	this.disc = data.disk.no;
	this.title = data.title;
	this.duration = data.duration * 1000;
	this.id = this.artist + "|" + this.album + "|" + this.number + "|" + this.title;
	var f = file.toString();
	var secretIndex = dir.length;
	this.path = f.substring(secretIndex);
};


var extractData = function (data, file, callback) {
	var track = new Track(data, file);
	list.push(track);
	if (callback) callback();
}

// walk over a directory recursivly
var walk = function (dir, done) {
	var results = [];
	fs.readdir(dir, function (err, list) {
		if (err)
			return done(err);
		var i = 0;
		(function next() {
			var file = list[i++];
			if (!file)
				return done(null, results);
			file = dir + '/' + file;
			fs.stat(file, function (err, stat) {
				if (stat && stat.isDirectory()) {
					walk(file, function (err, res) {
						results = results.concat(res);
						next();
					});
				} else {
					var ext = file.split(".");
					ext = ext[ext.length - 1];
					if (ext === 'mp3') {
						results.push(file);
					}
					next();
				}
			});
		})();
	});
};

var setupParse = function (results) {

	var q = async.queue(function (fileName, callback) {
		var parser = mm(fs.createReadStream(fileName), { duration: true }, function (err, result) {
			if (err) {
				callback();
			}
			extractData(result, fileName, callback);
		});
	}, WORKERS);

	if (results) {
		q.push(results, function (err) {
			if (list.length % 250 === 0) {
				logger.info('scanned', list.length, 'songs');
			}
			if (list.length === totalFiles) {
				fs.writeFile('./public/data/node-music.json', JSON.stringify(list), function (err) {
					if (err) {
						logger.error("err", err);
					}
					var stop = new Date();
					logger.info("Done scanning, time taken:", df(stop - start, '#{2H}:#{2M}:#{2S}'));
				});
			}
		});
	}
};