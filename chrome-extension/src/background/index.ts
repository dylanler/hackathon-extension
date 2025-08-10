import 'webextension-polyfill';
import env from '@extension/env';
import { exampleThemeStorage } from '@extension/storage';

exampleThemeStorage.get().then(theme => {
  console.log('theme', theme);
});

console.log('Background loaded');
console.log("Edit 'chrome-extension/src/background/index.ts' and save to reload.");

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type === 'TAKE_PAGE_SCREENSHOT') {
    (async () => {
      try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (!tab?.id) throw new Error('No active tab');
        const imageUri = await new Promise<string>((resolve, reject) => {
          try {
            chrome.tabs.captureVisibleTab({ format: 'png' }, dataUrl => {
              const lastError = chrome.runtime.lastError;
              if (lastError) {
                reject(new Error(lastError.message));
                return;
              }
              resolve(dataUrl);
            });
          } catch (e) {
            reject(e as Error);
          }
        });

        const now = new Date();
        const timestamp = now.toISOString().replace(/[:.]/g, '-').replace('T', '_').replace('Z', '');
        const titleSlug = (tab.title || 'page').replace(/[^a-z0-9-_]+/gi, '_').slice(0, 60);
        const baseName = `${titleSlug || 'page'}_${timestamp}.png`;

        const subdir = env.CEB_SCREENSHOT_DIR || 'screenshots';
        const filename = `${subdir}/${baseName}`;

        await new Promise<number>((resolve, reject) => {
          try {
            chrome.downloads.download(
              {
                url: imageUri,
                filename,
                saveAs: false,
                conflictAction: 'uniquify',
              },
              downloadId => {
                const lastError = chrome.runtime.lastError;
                if (lastError) {
                  reject(new Error(lastError.message));
                  return;
                }
                resolve(downloadId);
              },
            );
          } catch (e) {
            reject(e as Error);
          }
        });
        sendResponse({ ok: true, filename });
      } catch (err) {
        console.error('screenshot failed', err);
        sendResponse({ ok: false, error: (err as Error).message });
      }
    })();
    return true;
  }
  return undefined;
});
