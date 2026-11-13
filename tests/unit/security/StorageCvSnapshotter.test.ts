import { Storage } from '@google-cloud/storage';

import { StorageCvSnapshotter } from '@/infrastructure/firebase/applications/FirestoreApplicationSubmissionStore';

describe('private application CV snapshots', () => {
  test('removes permanent download credentials in the copy request before publishing the snapshot', async () => {
    const bucket = new Storage({ projectId: 'demo-cv-test' }).bucket(
      'demo-cv-test',
    );
    const source = bucket.file('cvUrl/candidate/cv.pdf');
    const request = jest
      .spyOn(source, 'request')
      .mockImplementation((_options, callback) => {
        if (!callback) throw new Error('Missing copy callback');
        callback(null, { done: true });
      });
    const locate = jest.fn().mockResolvedValue(source);

    const path = await new StorageCvSnapshotter(locate).copy(
      source.name,
      'application-1',
      'attempt-1',
    );

    expect(path).toMatch(
      /^applicationSnapshots\/application-1\/[a-f0-9]{24}\/cv.pdf$/,
    );
    expect(request).toHaveBeenCalledTimes(1);
    const [options] = request.mock.calls[0] ?? [];
    expect(options).toMatchObject({
      method: 'POST',
      uri: `/rewriteTo/b/${bucket.name}/o/${encodeURIComponent(String(path))}`,
      json: {
        cacheControl: 'private, no-store',
        metadata: { firebaseStorageDownloadTokens: null },
      },
    });
  });

  test('a failed private copy does not return an accessible snapshot key', async () => {
    const error = new Error('copy failed');
    const onError = jest.fn();
    const copy = jest.fn().mockRejectedValue(error);
    const locate = jest
      .fn()
      .mockResolvedValue({ bucket: { file: jest.fn() }, copy });

    await expect(
      new StorageCvSnapshotter(locate, onError).copy(
        'cvUrl/candidate/cv.pdf',
        'application-1',
        'attempt-1',
      ),
    ).resolves.toBeNull();
    expect(onError).toHaveBeenCalledWith(error);
  });
});
