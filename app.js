var express = require('express'),
    fs = require('fs'),
    compression = require('compression'),
    shrinkRay = require('shrink-ray'),
    http2 = require('http2'),
    expressHTTP2Workaround = require('express-http2-workaround'),
    log4js = require('log4js'),
    cors = require('./modules/cors'),
    cache = require('./modules/cache'),
    imageProxy = require('./endpoints/imageProxy'),
    rescan = require('./endpoints/rescan'),
    progress = require('./endpoints/progress'),
    login = require('./endpoints/login'),
    listen = require('./endpoints/listen'),
    config = require('./config.json'),
    ask = require('./modules/ask'),
    askUser = require('./modules/askUser'),
    _ = require("lodash"),
    del = require('delete'),
    symlinkOrCopySync = require('symlink-or-copy').sync,
    package = require('./package.json'),
    app = express();

// set-up main logger
log4js.loadAppender('file');
log4js.addAppender(log4js.appenders.file('logs/mp3stream.log'), 'mp3stream');
var logger = log4js.getLogger('mp3stream');
logger.setLevel('DEBUG');

// set-up express
app.use(expressHTTP2Workaround({ express: express, http2: http2 }));
app.use(compression());
app.use(cors);
app.use(cache);
app.use(express.static('./public'));

// check if config is set-up if not ask for input
var addUserMode = process.argv[2] === "adduser";
if (addUserMode) {
    askUser();
    return;
}
if (config.ask || !config.path) {
    // ask user to set-up configuration
    ask();
    return;
} else {
    // link website
    if (config.useJSMusicDB) {
        logger.info("Setting up website ...");
        var filesAndFolders = ['css', 'fonts', 'global', 'js', 'index.html', 'manifest.json', 'sw.js'];
        // remove current build if present; this ensures we have the most up2date prebuilt binaries on all platforms
        _.forEach(filesAndFolders, function(value) {
            del.sync('public/' + value);
            symlinkOrCopySync('node_modules/jsmusicdbnext-prebuilt/' + value, 'public/' + value);
        });
    }
    // set-up endpoints
    app.get('/data/image-proxy', imageProxy);
    app.get('/listen', listen);
    app.post('/login', login);
    app.get('/rescan', rescan);
    app.get('/progress', progress);
}

// redirect everything to index if not in predefined list
app.get(/^(?!\/rescan|\/listen|\/progress|\/data\/.*|\/dist.*|\/global.*|\/dist-systemjs.*|\/sw.js|\/manifest.json|\/js\/.*|\/app.*|\/css\/.*|\/fonts\/.*|\/fonts\/glyphs\/.*).*$/, function(req, res) {
    res.sendFile('public/index.html', { root: __dirname });
});

// start-up express
if (config.useSSL) {
    var privateKey = fs.readFileSync(config.sslKey, 'utf8');
    var certificate = fs.readFileSync(config.sslCert, 'utf8');
    var credentials = {
        key: privateKey,
        cert: certificate
    };
    var httpsServer = http2.createServer(credentials, app);
    httpsServer.listen(config.port);
    logger.info(`node mp3stream ${package.version} is set-up and running in http/2 mode`);
} else {
    app.listen(config.port);
    logger.info(`node mp3stream ${package.version} is set-up and running in http mode`);
}