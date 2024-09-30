import { existsSync, readFileSync } from 'node:fs';
import { exec } from 'node:child_process';
import validateJwt from './../modules/validateJwt.js';
import createLogger from './../modules/logger.js';

const logger = createLogger('rescan');
const progressFile = './public/data/progress.txt';

const parseProgress = (progress) => {
  return JSON.stringify({
    progress,
    status: progress == '100' ? 'ready' : 'scanning',
  });
};

const poll = (req, force) => {
  const clients = req.app.locals.clients;
  if (!clients) return;
  if (force) {
    clients.forEach(client => {
      client.res.write(`event: message\n`);
      client.res.write(`data: ${parseProgress()}\n\n`);
    });
    setTimeout(() => {
      poll(req, false);
    }, 1000);
  } else {
    // read progress file
    const hasProgressFile = existsSync(progressFile);
    let progress = '';
    if (hasProgressFile) {
      progress = readFileSync(progressFile, 'utf8');
    }
    // tell clients the progress is updated
    clients.forEach(client => {
      client.res.write(`event: message\n`);
      client.res.write(`data: ${parseProgress(progress)}\n\n`);
    });
    // if progress is not 100, poll again
    if (progress != '100') {
      setTimeout(() => {
        poll(req, false);
      }, 1000);
    }
  }
};

function initiateScan(req) {
  exec('python --version', function (error, stdout, stderr) {
    const out = stdout || stderr;
    let hasPython = false;
    if (out.indexOf('2.') !== 0) {
      logger.info('python is installed');
      hasPython = true;
    }
    if (hasPython) {
      // spawn python process
      const outdir = process.env.MUSICDB;
      exec(
        `python ./node_modules/scanner.py/scanner.py ${process.env.MUSICPATH} --destpath ${outdir}`,
        function (error, stdout, stderr) {
          logger.info(stdout);
        }
      );
      poll(req, true);
    } else {
      logger.fatal(
        'Python is needed to scan all files on the system; cannot continue'
      );
    }
  });
}

export default function (req, res) {
  const jwt = req.query.jwt;
  validateJwt(jwt, function (val) {
    if (val) {
      initiateScan(req);
      res.statusCode = 204;
      res.end();
    } else {
      logger.warn('User not authorized');
      res.statusCode = 401;
      res.end();
    }
  });
}
