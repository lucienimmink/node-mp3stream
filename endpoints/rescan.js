import { existsSync, readFileSync } from 'node:fs';
import { execFile } from 'node:child_process';
import validateJwt from './../modules/validateJwt.js';
import createLogger from './../modules/logger.js';
import { hasSseClients, publishSse } from './../modules/sseClients.js';

const logger = createLogger('rescan');
const progressFile = './public/data/progress.txt';

const parseProgress = (progress) => {
  return JSON.stringify({
    progress,
    status: progress == '100' ? 'ready' : 'scanning',
  });
};

const poll = (force) => {
  if (!hasSseClients()) return;
  if (force) {
    void publishSse(parseProgress());
    setTimeout(() => {
      poll(false);
    }, 1000);
  } else {
    // read progress file
    const hasProgressFile = existsSync(progressFile);
    let progress = '';
    if (hasProgressFile) {
      progress = readFileSync(progressFile, 'utf8');
    }
    void publishSse(parseProgress(progress));
    // if progress is not 100, poll again
    if (progress != '100') {
      setTimeout(() => {
        poll(false);
      }, 1000);
    }
  }
};

function initiateScan() {
  execFile('python3', ['--version'], function (error, stdout, stderr) {
    if (error) {
      logger.error(`Python3 is needed to scan files: ${error.message}`);
      return;
    }
    const out = stdout || stderr;
    if (/^Python 3(?:\.|$)/.test(out.trim())) {
      logger.info('python3 is installed');
      const outdir = process.env.MUSICDB;
      if (!process.env.MUSICPATH || !outdir) {
        logger.error('Cannot scan without MUSICPATH and MUSICDB configured');
        return;
      }
      execFile(
        'python3',
        [
          './node_modules/scanner.py/scanner.py',
          process.env.MUSICPATH,
          '--destpath',
          outdir,
        ],
        function (scanError, scanStdout, scanStderr) {
          if (scanError) {
            logger.error(`Music scan failed: ${scanError.message}`);
            if (scanStderr) logger.error(scanStderr);
            return;
          }
          logger.info(scanStdout);
        }
      );
      poll(true);
    } else {
      logger.error(
        'Python issued an unexpected version, version discovered: ' + out
      );
    }
  });
}

export default async function rescan(c) {
  if (!(await validateJwt(c.req.query("jwt")))) {
    logger.warn('User not authorized');
    return c.body(null, 401);
  }
  initiateScan();
  return c.body(null, 204);
}
