import fs from 'node:fs/promises';
import { Crypto } from '@peculiar/webcrypto';
import jwt from 'jwt-simple';
import db from './db.js';
import { cryptoAlgorithm } from './crypto.js';

const knownJWTTokens = {};

const crypto = new Crypto();

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

const parseToken = (token) => {
  if (!token) {
    return false;
  }
  try {
    let decoded = jwt.decode(token, 'jsmusicdbnext');
    if (typeof decoded === 'string') {
      return JSON.parse(decoded);
    }
    return decoded;
  } catch (e) {
    return null;
  }
};

export default async function validateJwt(jwt, cb) {
  if (!knownJWTTokens[jwt]) {
    const decoded = parseToken(jwt);
    if (!decoded) {
      cb(false);
    }
    // for now we keep support for unencrypted passwords as well; for now :)
    let password = decoded?.password;
    if (decoded?.encryptedPassword) {
      try {
        password = await decryptPassword(decoded.encryptedPassword);
      } catch (e) {}
    }
    db(decoded?.name, password, cb, jwt, knownJWTTokens);
  } else {
    cb(true);
  }
}
