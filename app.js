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
	var path = req.query.path;
	if (settings.loggedIn) {
		fs.exists(path, function(exists) {
			if (exists) {
				logger.info("going to stream " + path);
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
			account: account,
			passwd: passwd
		}, {
			username: String,
			passwd: String
		},function (rows) {
			var user = rows.length && rows[0];
			if (user.passwd === passwd) {
				res.jsonp({
					success : true
				});	
				settings.loggedIn = true;
				logger.info("User "+ account +" authenticated");
			} else {
				res.jsonp({
					success : false
				});
				logger.error("User "+ account +" NOT authenticated");
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
