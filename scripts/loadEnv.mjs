// Carrega o .env.local para process.env.
//
// Substitui o `node --env-file-if-exists=`: o parser nativo do Node engasga-se
// com valores entre aspas que contêm sequências `\n` (o nosso
// FIREBASE_PRIVATE_KEY) e perde silenciosamente a variável seguinte. O Next.js
// usa o dotenv e não sofre disto, por isso o problema era só dos scripts.
//
// Variáveis já presentes no ambiente ganham sempre ao ficheiro.
import fs from 'node:fs';
import path from 'node:path';

export function loadEnv(ficheiro = '.env.local') {
  const caminho = path.resolve(process.cwd(), ficheiro);
  if (!fs.existsSync(caminho)) return {};

  const carregadas = {};

  for (const linhaBruta of fs.readFileSync(caminho, 'utf8').split(/\r?\n/)) {
    const linha = linhaBruta.trim();
    if (!linha || linha.startsWith('#')) continue;

    const separador = linha.indexOf('=');
    if (separador < 1) continue;

    const nome = linha.slice(0, separador).trim();
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(nome)) continue;

    let valor = linha.slice(separador + 1).trim();

    const aspas = valor[0];
    if (
      (aspas === '"' || aspas === "'") &&
      valor.endsWith(aspas) &&
      valor.length > 1
    ) {
      valor = valor.slice(1, -1);
      // Só entre aspas duplas é que \n e \" têm significado.
      if (aspas === '"')
        valor = valor.replace(/\\n/g, '\n').replace(/\\"/g, '"');
    } else {
      // Sem aspas, um # inicia comentário.
      const comentario = valor.indexOf(' #');
      if (comentario !== -1) valor = valor.slice(0, comentario).trim();
    }

    carregadas[nome] = valor;
    if (process.env[nome] === undefined) process.env[nome] = valor;
  }

  return carregadas;
}

export default loadEnv;
