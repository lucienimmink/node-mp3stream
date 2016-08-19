var express = require('express'), fs = require('fs'), dblite = require('dblite'), log4js = require('log4js');
var fs = require('fs'), app = module.exports, mm = require('musicmetadata'), util = require('util'), _ = require("lodash"), async = require("async"), df = require("duration-format");
var app = express();
var settings = {
	loggedIn: true
};
var dblite = require('dblite');
var CommandAsker = require('command-asker');
var del = require('delete');
var symlinkOrCopySync = require('symlink-or-copy').sync;

var config = require('./config.json');
var addUserMode = process.argv[2] === "adduser";

var jwt = require('jwt-simple');

// enter interactive setup mode if the ask parameter is set or the path has not been set.
if (config.ask || !config.path) {
	var a = new CommandAsker([
		{ key: 'port', ask: 'On which port do you want to listen? ' },
		{ key: 'ssl', ask: 'Do you want to use SSL? (yes/no)' },
		{ key: 'path', ask: 'Where are the music files stored? ' },
		{ key: 'username', ask: 'What username do you want to use to authenticate? ', required: true },
		{ key: 'password', ask: 'What password do you want to use ? ', required: true }
	]);

	a.ask(function (response) {
		// set the new config file
		config.ask = false;
		config.port = response.port;
		config.path = response.path;
		config.useSSL = (response.ssl.toLowerCase() === 'yes' || response.ssl.toLowerCase() === 'true' || response.ssl === 1) ? true : false;
		fs.writeFileSync('./config.json', JSON.stringify(config));

		// setup the Database
		var db = dblite('./users.db');
		db.query("CREATE TABLE IF NOT EXISTS users (username TEXT, password TEXT)", function (err, res) {
			db.query('INSERT OR REPLACE INTO users VALUES(?, ?)', [response.username, response.password], function (err, res) {
				console.log("Config and user database has been set-up. Restart the app to start streaming.");
				if (config.useSSL) console.info("Please update the paths of the SSL cert and key. Most likely you have to restart the app as root");
				db.close();
				a.close();
			});
		});
	});
} else if (addUserMode) {
	var a = new CommandAsker([
		{ key: 'username', ask: 'What username do you want to use to authenticate? ', required: true },
		{ key: 'password', ask: 'What password do you want to use ? ', required: true }
	]);
	a.ask(function (response) {
		// setup the Database
		var db = dblite('./users.db');
		db.query('INSERT OR REPLACE INTO users VALUES(?, ?)', [response.username, response.password], function (err, res) {
			console.log("Config and user database has been set-up. Restart the app to start streaming.");
			db.close();
			a.close();
		});
	});
} else {

	// setup logging
	log4js.loadAppender('file');
	log4js.addAppender(log4js.appenders.file('logs/mp3stream.log'), 'mp3stream');
	var logger = log4js.getLogger('mp3stream');
	logger.setLevel('INFO');

	var dir = config.path;
	var WORKERS = 10; // how many concurent streams do we want to handle?

	var list = [];
	var nrScanned = 0;

	if (config.useJSMusicDB) {
		var filesAndFolders = ['css', 'fonts', 'global', 'js', 'index.html', 'manifest.json'];
		// remove current build if present; this ensures we have the most up2date prebuilt binaries on all platforms
		_.forEach(filesAndFolders, function (value) {
			del.sync('public/' + value);
			symlinkOrCopySync('node_modules/jsmusicdbnext-prebuilt/' + value, 'public/' + value);
		});
	}


	/* CORS */
	var allowCrossDomain = function (req, res, next) {
		res.header('Access-Control-Allow-Origin', '*');
		res.header('Access-Control-Allow-Methods', 'GET');
		res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, Content-Length, X-Requested-With, X-Cred');

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
		// decode the JWT token
		var account, passwrd;
		if (req.headers["x-cred"]) {
			var decoded = jwt.decode(req.headers["x-cred"], 'jsmusicdbnext');
			if (typeof decoded === 'string') {
				decoded = JSON.parse(decoded);
			}
			account = decoded.name;
			passwd = decoded.password;
		} else {
			console.error('We only allow JWT logins from now on');
			res.jsonp({
				success: false
			});
			return false;
		}
		

		// for now always accept the login
		// send the response as JSONP
		if (account && passwd) {
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
						logger.info("User " + account + " authenticated");
						res.jsonp({
							success: true
						});
						settings.loggedIn = true;
					} else {
						logger.error("User " + account + " NOT authenticated");
						res.jsonp({
							success: false
						});
						settings.loggedIn = false;
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
	if (config.useSSL) {
		var fs = require('fs');
		var https = require('https');
		var privateKey  = fs.readFileSync(config.sslKey, 'utf8');
		var certificate = fs.readFileSync(config.sslCert, 'utf8');
		var credentials = {key: privateKey, cert: certificate};
		var httpsServer = https.createServer(credentials, app);
		httpsServer.listen(config.port);
	} else {
		app.listen(config.port);
	}

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
	app.get(/^(?!\/rescan|\/listen|\/data\/.*|\/dist.*|\/global.*|\/dist-systemjs.*|\/js\/.*|\/app.*|\/css\/.*|\/fonts\/.*|\/fonts\/glyphs\/.*).*$/, function (req, res) {
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
					fs.writeFile(config.musicdb, JSON.stringify(list), function (err) {
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

	var hasMusicDB = fs.existsSync(config.musicdb);
	if (!hasMusicDB) {
		// initiate a scan
		nrScanned = 0;
		start = new Date();
		walk(dir, function (err, results) {
			totalFiles = (results) ? results.length : 0;
			logger.info("starting scan for", totalFiles, "files");
			list = [];
			setupParse(results);
		});
	}
}