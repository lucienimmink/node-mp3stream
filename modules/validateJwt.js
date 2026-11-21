import fs from 'node:fs/promises';
import { Crypto } from '@peculiar/webcrypto';
import { verify } from 'hono/jwt';
import db from './db.js';
import { cryptoAlgorithm } from './crypto.js';
import getJwtSecret from './jwtSecret.js';
import createLogger from './logger.js';

const knownJWTTokens = Object.create(null);

const crypto = new Crypto();
const logger = createLogger('validateJwt');

const decryptPassword = async (encrypted) => {
  const payloadBuffer = Buffer.from(encrypted, 'base64');
  const privateKeyJSON = JSON.parse(
    await fs.readFile('./.private-key.json', 'utf8')
  );
  const privateKey = await crypto.subtle.importKey(
    'jwk',
    privateKeyJSON,
    {
      name: cryptoAlgorithm.name,
      hash: cryptoAlgorithm.hash,
    },
    false,
    ['decrypt']
  );
  const data = await crypto.subtle.decrypt(
    {
      name: cryptoAlgorithm.name,
    },
    privateKey,
    payloadBuffer
  );
  return new TextDecoder().decode(data);
};

const parseToken = async (token) => {
  if (typeof token !== 'string' || token.length > 8192) {
    return null;
  }
  const secret = getJwtSecret();
  try {
    const decoded = await verify(token, secret, 'HS256');
    const now = Math.floor(Date.now() / 1000);
    if (
      !decoded ||
      typeof decoded !== 'object' ||
      !Number.isInteger(decoded.iat) ||
      !Number.isInteger(decoded.exp) ||
      decoded.iat > now ||
      decoded.exp <= now ||
      decoded.exp <= decoded.iat
    ) {
      return null;
    }
    return decoded;
  } catch (e) {
    return null;
  }
};

export default async function validateJwt(jwt) {
  if (!jwt) {
    return false;
  }
  const decoded = await parseToken(jwt);
  if (!decoded) {
    return false;
  }
  if (knownJWTTokens[jwt] === true) {
    return true;
  }

  let password = decoded.password;
  if (decoded.encryptedPassword) {
    try {
      password = await decryptPassword(decoded.encryptedPassword);
    } catch (error) {
      logger.warn(`Unable to decrypt password from JWT: ${error.message}`);
      return false;
    }
  }
  if (typeof decoded.name !== 'string' || typeof password !== 'string') {
    return false;
  }
  return new Promise((resolve, reject) => {
    db(decoded.name, password, resolve, jwt, knownJWTTokens).catch(reject);
  });
}
