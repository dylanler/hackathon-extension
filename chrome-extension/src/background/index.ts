import 'webextension-polyfill';
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
          canvases: [],
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
        const sanitizePathSegment = (seg: string) => seg.replace(/[^A-Za-z0-9-_]+/g, '_');
        const sanitizeBaseDir = (dirRaw: string) => {
          let dir = (dirRaw || '').trim();
          // If looks like absolute or home path, collapse to last segment only
          if (/^(~|\/|\\|[A-Za-z]:)/.test(dir)) {
            const parts = dir.split(/[\\/]+/g).filter(Boolean);
            dir = parts.length ? parts[parts.length - 1] : 'projects';
          }
          // strip leading/trailing slashes just in case
          dir = dir.replace(/^[\\/]+|[\\/]+$/g, '');
          // allow nested simple segments only (still relative)
          dir = dir
            .split(/[\\/]+/g)
            .map(sanitizePathSegment)
            .filter(Boolean)
            .join('/');
          return dir || 'projects';
        };

        const state = await projectsStorage.get();
        // Determine project
        let targetProjectId: string | undefined = message.projectId || state.currentProjectId;
        if (!targetProjectId) {
          const nowCreate = new Date();
          const ts = nowCreate.toISOString().replace(/[:.]/g, '-').replace('T', '_').replace('Z', '');
          targetProjectId = `project_${ts}`;
          state.currentProjectId = targetProjectId;
          state.projects[targetProjectId] = {
            id: targetProjectId,
            createdAt: nowCreate.toISOString(),
            screenshots: [],
            canvases: [],
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
        let baseName = `${titleSlug || 'page'}_${timestamp}.png`;
        baseName = baseName.replace(/^\.+/, ''); // no leading dots
        if (!baseName.toLowerCase().endsWith('.png')) baseName = `${baseName}.png`;

        const baseDir = sanitizeBaseDir(process.env.CEB_SCREENSHOT_DIR || 'projects');
        const projectDir = sanitizePathSegment(targetProjectId) || 'project_unknown';
        let filename = `${baseDir}/${projectDir}/${baseName}`;

        const tryDownload = async (proposed: string) =>
          await new Promise<number>((resolve, reject) => {
            try {
              chrome.downloads.download(
                {
                  url: imageUri,
                  filename: proposed,
                  saveAs: false,
                  conflictAction: 'uniquify',
                },
                did => {
                  const lastError = chrome.runtime.lastError;
                  if (lastError) {
                    reject(new Error(`${lastError.message} | proposed=${proposed}`));
                    return;
                  }
                  resolve(did);
                },
              );
            } catch (e) {
              reject(e as Error);
            }
          });

        let downloadId: number;
        try {
          downloadId = await tryDownload(filename);
        } catch (e) {
          console.warn('Primary download failed, trying fallback path', e);
          const fallback = `${baseDir}/${baseName}`;
          downloadId = await tryDownload(fallback);
          filename = fallback;
        }
        // Persist metadata in storage for rendering in Projects page
        const updated = await projectsStorage.get();
        const project = updated.projects[targetProjectId];
        // always create a new canvas on each capture unless a specific canvasId is provided explicitly
        let canvasId: string | undefined = message.canvasId;
        if (!canvasId) {
          const existing = project.canvases ?? [];
          const nextIndex = existing.length + 1;
          canvasId = `canvas-${nextIndex}`;
          project.canvases = [...existing, { id: canvasId, name: `Canvas ${nextIndex}` }];
        }
        const shotId = `${Date.now()}`;
        project.screenshots.push({
          id: shotId,
          dataUrl: imageUri,
          filename,
          createdAt: new Date().toISOString(),
          pageTitle: tab.title || undefined,
          pageUrl: tab.url || undefined,
          canvasId,
        });
        await projectsStorage.set(updated);

        // Also drop a session hint for immediate hydration by the projects UI
        try {
          await chrome.storage.session.set({
            lastScreenshot: {
              projectId: targetProjectId,
              canvasId,
              filename,
              dataUrl: imageUri,
              createdAt: new Date().toISOString(),
            },
          });
        } catch {}

        sendResponse({ ok: true, filename, projectId: targetProjectId, canvasId, downloadId });
      } catch (err) {
        const msg = (err as Error).message || String(err);
        console.error('screenshot failed', msg);
        sendResponse({ ok: false, error: msg });
      }
    })();
    return true;
  }
  return undefined;
});
