const validateJwt = require('./../modules/validateJwt'),
    log4js = require('log4js');

log4js.loadAppender('file');
log4js.addAppender(log4js.appenders.file('logs/mp3stream.log'), 'progress');
var logger = log4js.getLogger('progress');
logger.setLevel('INFO');

module.exports = function(req, res) {
    var jwt = req.query.jwt;
    validateJwt(jwt, function(val) {
        if (val) {
            // progress should be written to the output folder as a file progress.txt containing the actual percentage
            var hasProgressFile = false;
            try {
                hasProgressFile = fs.statSync('public/data/progress.txt').isFile();
            } catch (e) {
                hasProgressFile = false;
            }
            // console.log('has progress file? ', hasProgressFile);
            if (hasProgressFile) {
                var progress = fs.readFileSync('public/data/progress.txt', 'utf8');
                res.statusCode = 200;
                res.write(JSON.stringify({
                    progress: progress,
                    status: (progress == '100') ? 'ready' : 'scanning'
                }));
            } else {
                res.statusCode = 200;
                res.write(JSON.stringify({
                    status: 'ready'
                }));
            }
            res.end();
        } else {
            logger.warn("User not authorized");
            res.statusCode = 401;
            res.end();
        }
    })
};