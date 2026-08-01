const firebaseClientFields = require('../shared/firebase-client-env.json');

function createFirebaseClientConfig(environment) {
  const missingVariables = [];
  const config = {};

  for (const { envName, configKey } of firebaseClientFields) {
    const rawValue = environment?.[envName];

    if (typeof rawValue !== 'string' || rawValue.trim().length === 0) {
      missingVariables.push(envName);
      continue;
    }

    config[configKey] = rawValue.trim();
  }

  if (missingVariables.length > 0) {
    throw new Error(
      `Configuração Firebase em falta: ${missingVariables.join(', ')}`,
    );
  }

  return Object.freeze(config);
}

module.exports = {
  firebaseClientFields,
  createFirebaseClientConfig,
};
