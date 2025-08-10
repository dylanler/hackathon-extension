import 'webextension-polyfill';
import env from '@extension/env';
import { exampleThemeStorage, projectsStorage } from '@extension/storage';

exampleThemeStorage.get().then(theme => {
  console.log('theme', theme);
});

console.log('Background loaded');
console.log("Edit 'chrome-extension/src/background/index.ts' and save to reload.");

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type === 'NEW_PROJECT') {
    (async () => {
      const now = new Date();
      const timestamp = now.toISOString().replace(/[:.]/g, '-').replace('T', '_').replace('Z', '');
      const projectId = `project_${timestamp}`;
      try {
        const current = await projectsStorage.get();
        const next = { ...current };
        next.currentProjectId = projectId;
        next.projects[projectId] = {
          id: projectId,
          createdAt: now.toISOString(),
          screenshots: [],
        };
        await projectsStorage.set(next);
        sendResponse({ ok: true, projectId });
      } catch (err) {
        console.error('create project failed', err);
        sendResponse({ ok: false, error: (err as Error).message });
      }
    })();
    return true;
  }
  if (message?.type === 'TAKE_PAGE_SCREENSHOT') {
    (async () => {
      try {
        const state = await projectsStorage.get();
        let { currentProjectId } = state;
        if (!currentProjectId) {
          const nowCreate = new Date();
          const ts = nowCreate.toISOString().replace(/[:.]/g, '-').replace('T', '_').replace('Z', '');
          currentProjectId = `project_${ts}`;
          state.currentProjectId = currentProjectId;
          state.projects[currentProjectId] = {
            id: currentProjectId,
            createdAt: nowCreate.toISOString(),
            screenshots: [],
          };
          await projectsStorage.set(state);
        }
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

        const baseDir = env.CEB_SCREENSHOT_DIR || 'projects';
        const filename = `${baseDir}/${currentProjectId}/${baseName}`;

        const downloadId = await new Promise<number>((resolve, reject) => {
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
        // Persist metadata in storage for rendering in Projects page
        const updated = await projectsStorage.get();
        const project = updated.projects[currentProjectId];
        const shotId = `${Date.now()}`;
        project.screenshots.push({
          id: shotId,
          dataUrl: imageUri,
          filename,
          createdAt: new Date().toISOString(),
          pageTitle: tab.title || undefined,
          pageUrl: tab.url || undefined,
        });
        await projectsStorage.set(updated);

        sendResponse({ ok: true, filename, projectId: currentProjectId, downloadId });
      } catch (err) {
        console.error('screenshot failed', err);
        sendResponse({ ok: false, error: (err as Error).message });
      }
    })();
    return true;
  }
  return undefined;
});
