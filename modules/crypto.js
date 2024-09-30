import fs from 'node:fs';
import { Crypto } from '@peculiar/webcrypto';
import createLogger from './logger.js';

const logger = createLogger('crypto');
const crypto = new Crypto();

const cryptoAlgorithm = {
  name: 'RSA-OAEP',
  hash: 'SHA-512',
};

export const generateKeys = async () => {
  const { privateKey, publicKey } = await crypto.subtle.generateKey(
    {
      name: cryptoAlgorithm.name,
      hash: cryptoAlgorithm.hash,
      publicExponent: new Uint8Array([1, 0, 1]), // 0x03 or 0x010001
      modulusLength: 4096, // 1024, 2048, or 4096
    },
    true,
    ['encrypt', 'decrypt']
  );
  const publicJWK = await crypto.subtle.exportKey('jwk', publicKey);
  const privateJWK = await crypto.subtle.exportKey('jwk', privateKey);
  fs.writeFileSync('./.public-key.json', JSON.stringify(publicJWK));
  fs.writeFileSync('./.private-key.json', JSON.stringify(privateJWK));
  logger.info('Generated and stored a new keypair');
};

export const doKeysExist = () => {
  return (
    fs.existsSync('./.public-key.json') && fs.existsSync('./.private-key.json')
  );
};

export { cryptoAlgorithm };

export default {
  generateKeys,
  doKeysExist,
  cryptoAlgorithm,
};
