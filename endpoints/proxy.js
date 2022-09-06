const request = require("request");
const logger = require("../modules/logger")("proxy");
const validateJwt = require("./../modules/validateJwt");
const url = require("url");

module.exports = (req, res) => {
    const queryData = url.parse(req.url, true).query;
    const { remote, jwt } = queryData;
    validateJwt(jwt, function (val) {
        if (val) {
            if (remote) {
                logger.info(`fetching ${remote}`);
                request({
                    url: remote,
                    method: 'GET'
                }, function (error, response, body) {
                    res.write(body);
                    res.end();
                })
            } else {
                logger.warn('No remote given');
                res.end();
            }
        } else {
            res.statusCode = 401;
            res.end();
        }
    });
    
};
