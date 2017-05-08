const dblite = require('dblite'),
    log4js = require('log4js'),
    jwt = require('jwt-simple');

let knownJWTTokens = {};

log4js.loadAppender('file');
log4js.addAppender(log4js.appenders.file('logs/mp3stream.log'), 'authentication');
var logger = log4js.getLogger('authentication');
logger.setLevel('INFO');

const parseToken = function(token) {
    if (!token) {
        return false;
    }
    let decoded = jwt.decode(token, 'jsmusicdbnext')
    if (typeof decoded === 'string') {
        decoded = JSON.parse(decoded);
    }
    return decoded;
};
const checkUser = function(account, passwd, cb, jwt) {
    if (account && passwd) {
        const db = dblite('users.db');
        db.query('SELECT * FROM users WHERE username = :account AND password = :passwd', {
            account: account,
            passwd: passwd
        }, {
            username: String,
            passwd: String
        }, function(rows) {
            var user = rows.length && rows[0];
            if (user.passwd === passwd) {
                logger.info("User " + account + " authenticated");
                knownJWTTokens[jwt] = true;
                cb(true)
            } else {
                logger.error("User " + account + " NOT authenticated");
                knownJWTTokens[jwt] = false;
                cb(false);
            }
        });
    } else {
        logger.warn("No user specified, NOT authenticated");
        knownJWTTokens[jwt] = false;
        cb(false);
    }
};


module.exports = function(jwt, cb) {
    if (!knownJWTTokens[jwt]) {
        var decoded = parseToken(jwt);
        if (!decoded) {
            cb(false);
        }
        checkUser(decoded.name, decoded.password, cb, jwt);
    } else {
        cb(true);
    }
};