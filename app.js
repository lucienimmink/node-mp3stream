var express = require('express'), fs = require('fs');
var app = express();
var settings = {
	loggedIn : false
};

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

	fs.exists(path, function(exists) {
		if (exists) {
			console.log("going to stream", path);
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
			console.error("no file with name", path, "found");
		}
	});

});

/**
 * Login a user
 */
app.get('/login', function(req, res) {
	var account = req.query.account, passwd = req.query.passwd, server = req.query.server;
	// for now always accept the login
	// send the response as JSONP
	res.jsonp({
		success : true
	});
	settings.loggedIn = true;
});

app.listen(2000);
