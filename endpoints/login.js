import validateJwt from './../modules/validateJwt.js';
import createLogger from './../modules/logger.js';

const logger = createLogger('login');

export default function (req, res) {
  logger.info('Starting authentication');
  // decode the JWT token
  if (req.headers['x-cred']) {
    validateJwt(req.headers['x-cred'], function (valid) {
      res.jsonp({
        success: valid,
      });
    });
  } else {
    res.statusCode = 401;
    res.end();
  }
}
