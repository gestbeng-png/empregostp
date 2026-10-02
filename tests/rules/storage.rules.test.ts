import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';

const projectId = 'empregostp';
const candidatoId = 'rules-candidato';
const outroId = 'rules-outro';
const vagaId = 'rules-vaga';

// O mesmo formato que pages/vaga/[id].js constroi ao enviar um anexo.
const caminho = `candidaturas/${candidatoId}/${vagaId}/cv-1787705020566-Ata_1_.pdf`;

function pdf() {
  return new Uint8Array([0x25, 0x50, 0x44, 0x46]);
}

describe('storage.rules para anexos de candidatura', () => {
  let environment: RulesTestEnvironment;

  beforeAll(async () => {
    environment = await initializeTestEnvironment({
      projectId,
      storage: {
        rules: readFileSync(join(process.cwd(), 'storage.rules'), 'utf8'),
      },
    });
  });

  afterAll(async () => {
    await environment?.cleanup();
  });

  test('o dono envia o anexo para a pasta da sua candidatura', async () => {
    const storage = environment.authenticatedContext(candidatoId).storage();

    await assertSucceeds(
      uploadBytes(ref(storage, caminho), pdf(), {
        contentType: 'application/pdf',
      }),
    );
  });

  test('o dono lê de volta o anexo (getDownloadURL depois do envio)', async () => {
    const storage = environment.authenticatedContext(candidatoId).storage();
    await uploadBytes(ref(storage, caminho), pdf(), {
      contentType: 'application/pdf',
    });

    await assertSucceeds(getDownloadURL(ref(storage, caminho)));
  });

  test('outro candidato não escreve na pasta alheia', async () => {
    const storage = environment.authenticatedContext(outroId).storage();

    await assertFails(
      uploadBytes(ref(storage, caminho), pdf(), {
        contentType: 'application/pdf',
      }),
    );
  });

  test('outro candidato não lê o anexo alheio', async () => {
    const dono = environment.authenticatedContext(candidatoId).storage();
    await uploadBytes(ref(dono, caminho), pdf(), {
      contentType: 'application/pdf',
    });

    const intruso = environment.authenticatedContext(outroId).storage();
    await assertFails(getDownloadURL(ref(intruso, caminho)));
  });

  test('sem sessão não se envia nada', async () => {
    const storage = environment.unauthenticatedContext().storage();

    await assertFails(
      uploadBytes(ref(storage, caminho), pdf(), {
        contentType: 'application/pdf',
      }),
    );
  });
});
