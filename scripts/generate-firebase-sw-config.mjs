#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import firebaseClientConfigModule from '../lib/firebaseClientConfig.js';

const { createFirebaseClientConfig, firebaseClientFields } =
  firebaseClientConfigModule;

function renderServiceWorkerConfig(config) {
  const serializedConfig = JSON.stringify(config, null, 2).replace(
    /</g,
    '\\u003c',
  );

  return `self.__EMPREGOSTP_FIREBASE_CONFIG__ = Object.freeze(${serializedConfig});\n`;
}

function resolveOutputPath() {
  if (process.env.FIREBASE_SW_CONFIG_OUTPUT) {
    return path.resolve(process.env.FIREBASE_SW_CONFIG_OUTPUT);
  }

  return path.resolve(process.cwd(), 'public', 'firebase-sw-config.js');
}

function generateServiceWorkerConfig() {
  const environment = Object.fromEntries(
    firebaseClientFields.map(({ envName }) => [envName, process.env[envName]]),
  );
  const config = createFirebaseClientConfig(environment);
  const outputPath = resolveOutputPath();
  const temporaryPath = `${outputPath}.tmp-${process.pid}`;

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });

  try {
    fs.writeFileSync(temporaryPath, renderServiceWorkerConfig(config), 'utf8');
    fs.renameSync(temporaryPath, outputPath);
  } finally {
    if (fs.existsSync(temporaryPath)) {
      fs.unlinkSync(temporaryPath);
    }
  }

  process.stdout.write(
    `Configuração Firebase do service worker gerada em ${path.relative(process.cwd(), outputPath)}.\n`,
  );
}

try {
  generateServiceWorkerConfig();
} catch (error) {
  const message =
    error instanceof Error
      ? error.message
      : 'Falha desconhecida ao gerar configuração Firebase';
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
}
