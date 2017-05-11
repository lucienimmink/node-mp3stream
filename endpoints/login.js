var validateJwt = require('./../modules/validateJwt'),
    log4js = require('log4js'),
    jwt = require('jwt-simple');

log4js.loadAppender('file');
log4js.addAppender(log4js.appenders.file('logs/mp3stream.log'), 'login');
var logger = log4js.getLogger('login');
logger.setLevel('INFO');

module.exports = function(req, res) {
    logger.info("Starting authentication");
    // decode the JWT token
    if (req.headers["x-cred"]) {
        var decoded = validateJwt(req.headers["x-cred"], function(valid) {
            res.jsonp({
                success: valid
            });
        });
    } else {
        res.statusCode = 401;
        res.end();
    };
};