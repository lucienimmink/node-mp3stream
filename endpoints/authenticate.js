import fs from 'node:fs';
import { Crypto } from '@peculiar/webcrypto';
import db from './../modules/db.js';
import generateJWT from './../modules/generateJWT.js';
import { cryptoAlgorithm } from './../modules/crypto.js';

const crypto = new Crypto();

const ab2str = function ab2str(buf) {
  return new TextDecoder().decode(buf);
};

const encryptPassword = async (password) => {
  const publicKeyJSON = JSON.parse(
    fs.readFileSync('./.public-key.json', 'utf8')
  );
  const publicKey = await crypto.subtle.importKey(
    'jwk',
    publicKeyJSON,
    {
      name: cryptoAlgorithm.name,
      hash: cryptoAlgorithm.hash
    },
    false,
    ['encrypt']
  );
  const data = await crypto.subtle.encrypt(
    {
      name: cryptoAlgorithm.name
    },
    publicKey,
    new TextEncoder().encode(password)
  );
  const buffer = Buffer.from(data);
  return buffer.toString('base64');
};

export default async function(req, res) {
  const { encryptedPayload } = req.body;
  if (!encryptedPayload) {
    req.statusCode = 401;
    res.end();
    return;
  }
  const payloadBuffer = Buffer.from(encryptedPayload, 'base64');
  const privateKeyJSON = JSON.parse(
    fs.readFileSync('./.private-key.json', 'utf8')
  );
  const privateKey = await crypto.subtle.importKey(
    'jwk',
    privateKeyJSON,
    {
      name: cryptoAlgorithm.name,
      hash: cryptoAlgorithm.hash
    },
    false,
    ['decrypt']
  );
  try {
    const data = await crypto.subtle.decrypt(
      {
        name: cryptoAlgorithm.name,
      },
      privateKey,
      payloadBuffer
    );
    const payloadJSON = JSON.parse(ab2str(data));
    const encryptedPassword = await encryptPassword(payloadJSON.password);
    // this should contain name and password; use that to verify the account
    db(payloadJSON.name, payloadJSON.password, result => {
      if (!result) {
        res.statusCode = 401;
        res.end();
        return;
      }
      const jwt = generateJWT({
        name: payloadJSON.name,
        encryptedPassword
      });
      res.statusCode = 200;
      res.setHeader('Content-Type', 'application/json');
      res.write(
        JSON.stringify({
          jwt
        })
      );
      res.end();
    });
  } catch (e) {
    console.log('authentication failure', e);
    res.statusCode = 401;
    res.end();
    return;
  }
}
