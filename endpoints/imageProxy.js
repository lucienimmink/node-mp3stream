const request = require('request'),
    url = require('url');

module.exports = function(req, res) {
    var queryData = url.parse(req.url, true).query;
    if (queryData.url) {
        request({
            url: queryData.url
        }).on('error', function(e) {
            res.end(e);
        }).on('response', function(r) {
            delete r.headers['age'];
            delete r.headers['connection'];
            var expires = new Date(Date.now());
            expires.setDate(expires.getDate() + 1);
            expires.setFullYear(expires.getFullYear() + 1);
            r.headers['cache-control'] = `public, max-age=${expires.getTime()}`; // A year and a day
            r.headers['expires'] = new Date(expires.getTime()).toUTCString();
        }).pipe(res);
    } else {
        res.end("no url found");
    }
};