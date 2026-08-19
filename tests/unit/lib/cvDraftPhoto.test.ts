import {
  CV_LOCAL_PHOTO_MAX_DATA_URL_LENGTH,
  encodeCanvasAsStorableCvPhoto,
  isStorableLocalCvPhoto,
  mergeCvDraftWithLocalPhoto,
} from '../../../lib/cvDraftPhoto';

describe('fotografia local do rascunho de CV', () => {
  test('mantém a fotografia local quando a versão remota mais recente a omite', () => {
    const photo = 'data:image/jpeg;base64,LOCAL';
    const remoteDraft = {
      form: { fullName: 'Nome atualizado online' },
      currentStep: 2,
    };

    expect(mergeCvDraftWithLocalPhoto(remoteDraft, photo)).toEqual({
      form: { fullName: 'Nome atualizado online', photo },
      currentStep: 2,
    });
  });

  test('respeita uma fotografia explicitamente presente no rascunho remoto', () => {
    const remoteDraft = {
      form: { photo: '', fullName: 'Ana' },
    };

    expect(
      mergeCvDraftWithLocalPhoto(
        remoteDraft,
        'data:image/jpeg;base64,LOCAL',
      ),
    ).toBe(remoteDraft);
  });

  test('não recupera data URLs locais acima do limite seguro', () => {
    const oversizedPhoto = `data:image/jpeg;base64,${'A'.repeat(
      CV_LOCAL_PHOTO_MAX_DATA_URL_LENGTH,
    )}`;

    expect(isStorableLocalCvPhoto(oversizedPhoto)).toBe(false);
    expect(
      mergeCvDraftWithLocalPhoto(
        { form: { fullName: 'Ana' } },
        oversizedPhoto,
      ),
    ).toEqual({ form: { fullName: 'Ana' } });
  });

  test('reduz progressivamente a qualidade até obter uma imagem armazenável', () => {
    const oversized = `data:image/jpeg;base64,${'A'.repeat(120)}`;
    const optimized = 'data:image/jpeg;base64,OK';
    const canvas = {
      toDataURL: jest
        .fn()
        .mockReturnValueOnce(oversized)
        .mockReturnValueOnce(oversized)
        .mockReturnValueOnce(optimized),
    };

    expect(encodeCanvasAsStorableCvPhoto(canvas, 100)).toBe(optimized);
    expect(canvas.toDataURL).toHaveBeenCalledTimes(3);
    expect(canvas.toDataURL).toHaveBeenNthCalledWith(1, 'image/jpeg', 0.9);
    expect(canvas.toDataURL).toHaveBeenNthCalledWith(3, 'image/jpeg', 0.66);
  });

  test('falha de forma explícita se nenhuma codificação couber no limite', () => {
    const canvas = {
      toDataURL: jest
        .fn()
        .mockReturnValue(`data:image/jpeg;base64,${'A'.repeat(120)}`),
    };

    expect(encodeCanvasAsStorableCvPhoto(canvas, 100)).toBe('');
    expect(canvas.toDataURL).toHaveBeenCalledTimes(5);
  });
});
