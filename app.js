var express = require('express'), fs = require('fs'), dblite = require('dblite'), log4js = require('log4js');
var app = express();
var settings = {
	loggedIn : false
};
// setup logging
log4js.loadAppender('file');
log4js.addAppender(log4js.appenders.file('logs/mp3stream.log'), 'mp3stream');
var logger = log4js.getLogger('mp3stream');
logger.setLevel('INFO');

/* CORS */
var allowCrossDomain = function(req, res, next) {
	res.header('Access-Control-Allow-Origin', '*');
	res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,OPTIONS');
	res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, Content-Length, X-Requested-With');

	// intercept OPTIONS method
	if ('OPTIONS' == req.method) {
		res.send(200);
	} else {
		next();
	}
};

app.configure(function() {
	app.use(allowCrossDomain);
});

/*
 serve all files stored in the web folder as normal files; you can store the website that will use the streamer in this folder.
 if you don't want this; please remove the next 2 lines.
 */
app.use(app.router);
app.use(express.static(__dirname + "/web"));

/**
 * Streams a given mp3; if a user is logged in
 */
app.get('/listen', function(req, res) {
	var path = req.query.path, full = req.query.full;
	if (settings.loggedIn) {
		fs.exists(path, function(exists) {
			if (exists) {
				if (!full) {
					logger.info("going to partial stream " + path);
					fs.readFile(path, 'binary', function(err, file) {
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
						'Content-Type' : 'audio/mpeg',
						'Content-Length' : stat.size
					});

					var readStream = fs.createReadStream(path);
					// We replaced all the event handlers with a simple call to util.pump()
					readStream.pipe(res);
				}

			} else {
				logger.warn("no file with name " + path + " found");
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
app.get('/login', function(req, res) {
	logger.info("Starting authentication");
	var account = req.query.account, passwd = req.query.passwd, server = req.query.server;
	// for now always accept the login
	// send the response as JSONP
	if (account && passwd) {
		// have a sqlite db with users and passwords; it's not the responsibility of this app to create it.
		var db = dblite('users.db');
		db.query('SELECT * FROM users WHERE username = :account AND password = :passwd', {
			account : account,
			passwd : passwd
		}, {
			username : String,
			passwd : String
		}, function(rows) {
			var user = rows.length && rows[0];
			if (user.passwd === passwd) {
				res.jsonp({
					success : true
				});
				settings.loggedIn = true;
				logger.info("User " + account + " authenticated");
			} else {
				res.jsonp({
					success : false
				});
				logger.error("User " + account + " NOT authenticated");
			}
		});
	} else {
		res.jsonp({
			success : false
		});
		logger.warn("No user specified, NOT authenticated");
	}
});
logger.info("Starting node-mp3stream");
app.listen(2000);
