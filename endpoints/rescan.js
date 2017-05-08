const validateJwt = require('./../modules/validateJwt'),
    log4js = require('log4js');

log4js.loadAppender('file');
log4js.addAppender(log4js.appenders.file('logs/mp3stream.log'), 'rescan');
var logger = log4js.getLogger('rescan');
logger.setLevel('INFO');


function initiateScan() {
    var exec = require('child_process').exec;
    exec('python --version', function(error, stdout, stderr) {
        var out = stdout = stderr;
        var hasPython = false;
        if (out.indexOf('2.') !== 0) {
            logger.info('python is installed');
            hasPython = true;
        }
        if (hasPython) {
            // spawn python process
            var outdir = config.musicdb;
            outdir = outdir.substring(0, outdir.indexOf('node-music.json'));
            exec('python ./node_modules/scanner.py/scanner.py ' + dir + ' --destpath ' + outdir, function(error, stdout, stderr) {
                logger.info(stdout);
            });
        } else {
            logger.fatal("Python is needed to scan all files on the system; cannot continue");
        }
    });
};

module.exports = function(req, res) {
    var jwt = req.query.jwt;
    validateJwt(jwt, function(val) {
        if (val) {
            initiateScan();
            res.statusCode = 204;
            res.end();
        } else {
            logger.warn("User not authorized");
            res.statusCode = 401;
            res.end();
        }
    });
};