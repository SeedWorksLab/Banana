import { availableUpdate } from '../../src/updates/update-policy';

const release = {
  tag_name: 'v0.3.0',
  html_url: 'https://github.com/SeedWorksLab/Banana/releases/tag/v0.3.0',
  assets: [{ name: 'banana-0.3.0.apk',
    browser_download_url: 'https://github.com/SeedWorksLab/Banana/releases/download/v0.3.0/banana-0.3.0.apk' }],
};
it('offers only a newer official APK', () => {
  expect(availableUpdate(release, '0.2.0', null)).toMatchObject({ version: '0.3.0' });
  expect(availableUpdate(release, '0.3.0', null)).toBeNull();
  expect(availableUpdate(release, '0.4.0', null)).toBeNull();
});
it('remembers ignored versions independent of the tag prefix', () => {
  expect(availableUpdate(release, '0.2.0', 'v0.3.0')).toBeNull();
  expect(availableUpdate(release, '0.2.0', '0.2.9')).not.toBeNull();
});
it('rejects untrusted links, malformed versions, drafts and prereleases', () => {
  for (const patch of [
    { html_url: 'https://untrusted.example.test' }, { tag_name: 'broken' },
    { draft: true }, { prerelease: true }, { assets: [] },
    { assets: [{ name: 'banana.apk', browser_download_url: 'https://untrusted.example.test/banana.apk' }] },
  ]) expect(availableUpdate({ ...release, ...patch }, '0.2.0', null)).toBeNull();
});
