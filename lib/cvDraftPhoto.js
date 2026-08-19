export const CV_LOCAL_PHOTO_MAX_DATA_URL_LENGTH = 1_500_000;

const CV_PHOTO_JPEG_QUALITIES = [0.9, 0.78, 0.66, 0.54, 0.42];

export function isStorableLocalCvPhoto(value) {
  return (
    typeof value === 'string' &&
    /^data:image\//i.test(value) &&
    value.length <= CV_LOCAL_PHOTO_MAX_DATA_URL_LENGTH
  );
}

export function mergeCvDraftWithLocalPhoto(draft, localPhoto) {
  if (
    !draft ||
    typeof draft !== 'object' ||
    Array.isArray(draft) ||
    !draft.form ||
    typeof draft.form !== 'object' ||
    Array.isArray(draft.form) ||
    Object.prototype.hasOwnProperty.call(draft.form, 'photo') ||
    !isStorableLocalCvPhoto(localPhoto)
  ) {
    return draft;
  }

  return {
    ...draft,
    form: {
      ...draft.form,
      photo: localPhoto,
    },
  };
}

export function encodeCanvasAsStorableCvPhoto(
  canvas,
  maxLength = CV_LOCAL_PHOTO_MAX_DATA_URL_LENGTH,
) {
  if (!canvas || typeof canvas.toDataURL !== 'function') return '';

  for (const quality of CV_PHOTO_JPEG_QUALITIES) {
    const encoded = canvas.toDataURL('image/jpeg', quality);
    if (
      typeof encoded === 'string' &&
      /^data:image\/jpeg/i.test(encoded) &&
      encoded.length <= maxLength
    ) {
      return encoded;
    }
  }

  return '';
}
