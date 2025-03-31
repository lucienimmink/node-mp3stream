import fs from 'node:fs';
import prompts from 'prompts';
import config from './../config.json' with { type: 'json' };
import askUser from './askUser.js';

const JSONToEnvArray = json => {
  return Object.keys(json).map(key => `${key.toUpperCase()}=${json[key]}\n`);
};

const setEnv = array => {
  array.forEach(key => {
    process.env[key] = array[key];
  });
};

export default async function() {
  const { port } = await prompts({
    type: 'number',
    name: 'port',
    message: 'On which port do you want to listen?',
  });
  const { ssl } = await prompts({
    type: 'confirm',
    name: 'ssl',
    message: 'Do you want to use SSL? (yes/no)',
    initial: true
  });
  const { musicpath } = await prompts({
    type: 'text',
    name: 'musicpath',
    message: 'Where are the music files stored?'
  });
  // username/password are part of askuser!
  config.port = port;
  config.musicpath = musicpath;
  config.useSSL = ssl;

  const envArray = JSONToEnvArray(config);
  setEnv(envArray);
  fs.writeFileSync("./.env", envArray.join(""));

  await askUser();
}
