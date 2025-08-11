import '@src/Popup.css';
import { t } from '@extension/i18n';
import { PROJECT_URL_OBJECT, useStorage, withErrorBoundary, withSuspense } from '@extension/shared';
import { projectsStorage } from '@extension/storage';
import { exampleThemeStorage } from '@extension/storage';
import { cn, ErrorDisplay, LoadingSpinner, ToggleButton } from '@extension/ui';

const notificationOptions = {
  type: 'basic',
  iconUrl: chrome.runtime.getURL('icon-34.png'),
  title: 'Injecting content script error',
  message: 'You cannot inject script here!',
} as const;

const Popup = () => {
  const { isLight } = useStorage(exampleThemeStorage);
  const logo = isLight ? 'popup/logo_vertical.svg' : 'popup/logo_vertical_dark.svg';

  const goGithubSite = () => chrome.tabs.create(PROJECT_URL_OBJECT);

  const injectContentScript = async () => {
    const [tab] = await chrome.tabs.query({ currentWindow: true, active: true });

    if (tab.url!.startsWith('about:') || tab.url!.startsWith('chrome:')) {
      chrome.notifications.create('inject-error', notificationOptions);
    }

    await chrome.scripting
      .executeScript({
        target: { tabId: tab.id! },
        files: ['/content-runtime/example.iife.js', '/content-runtime/all.iife.js'],
      })
      .catch(err => {
        // Handling errors related to other paths
        if (err.message.includes('Cannot access a chrome:// URL')) {
          chrome.notifications.create('inject-error', notificationOptions);
        }
      });
  };

  const takeScreenshot = async (canvasId?: string) => {
    const [tab] = await chrome.tabs.query({ currentWindow: true, active: true });
    if (!tab?.id) return;
    // Prompt to pick a project or create a new one
    const state = await projectsStorage.get();
    const existingProjects = Object.values(state.projects || {});
    let chosenProjectId: string | undefined = state.currentProjectId;

    if (existingProjects.length > 0) {
      // use a simple prompt for now; later we can replace with a nicer UI dialog
      const options = existingProjects.map(p => p.id).join('\n');
      const answer = window.prompt(
        `Choose a project id or type NEW to create one:\n${options}`,
        chosenProjectId || (existingProjects[0]?.id ?? ''),
      );
      if (answer && answer.toUpperCase() === 'NEW') {
        const resNew = await chrome.runtime.sendMessage({ type: 'NEW_PROJECT' });
        if (!resNew?.ok) {
          chrome.notifications.create('new-project-error', {
            type: 'basic',
            iconUrl: chrome.runtime.getURL('icon-34.png'),
            title: 'New Project failed',
            message: resNew?.error || 'Unknown error',
          });
          return;
        }
        chosenProjectId = resNew.projectId;
      } else if (answer) {
        chosenProjectId = answer;
      }
    } else {
      const resNew = await chrome.runtime.sendMessage({ type: 'NEW_PROJECT' });
      if (!resNew?.ok) {
        chrome.notifications.create('new-project-error', {
          type: 'basic',
          iconUrl: chrome.runtime.getURL('icon-34.png'),
          title: 'New Project failed',
          message: resNew?.error || 'Unknown error',
        });
        return;
      }
      chosenProjectId = resNew.projectId;
    }

    const res = await chrome.runtime.sendMessage({
      type: 'TAKE_PAGE_SCREENSHOT',
      canvasId,
      projectId: chosenProjectId,
    });
    if (!res?.ok) {
      chrome.notifications.create('screenshot-error', {
        type: 'basic',
        iconUrl: chrome.runtime.getURL('icon-34.png'),
        title: 'Screenshot failed',
        message: res?.error || 'Unknown error',
      });
    } else {
      chrome.notifications.create('screenshot-saved', {
        type: 'basic',
        iconUrl: chrome.runtime.getURL('icon-34.png'),
        title: 'Screenshot saved',
        message: `Saved to Downloads/${res.filename}`,
      });
      // open projects page focusing the project and canvas
      const url = chrome.runtime.getURL(
        `projects/index.html?projectId=${encodeURIComponent(res.projectId)}&canvasId=${encodeURIComponent(res.canvasId)}`,
      );
      await chrome.tabs.create({ url });
    }
  };

  const openProjects = async () => {
    const url = chrome.runtime.getURL('projects/index.html');
    await chrome.tabs.create({ url });
  };

  const newProject = async () => {
    const res = await chrome.runtime.sendMessage({ type: 'NEW_PROJECT' });
    if (!res?.ok) {
      chrome.notifications.create('new-project-error', {
        type: 'basic',
        iconUrl: chrome.runtime.getURL('icon-34.png'),
        title: 'New Project failed',
        message: res?.error || 'Unknown error',
      });
    } else {
      chrome.notifications.create('new-project-created', {
        type: 'basic',
        iconUrl: chrome.runtime.getURL('icon-34.png'),
        title: 'Project created',
        message: `${res.projectId}`,
      });
      await openProjects();
    }
  };

  return (
    <div className={cn('App', isLight ? 'bg-slate-50' : 'bg-gray-800')}>
      <header className={cn('App-header', isLight ? 'text-gray-900' : 'text-gray-100')}>
        <button onClick={goGithubSite}>
          <img src={chrome.runtime.getURL(logo)} className="App-logo" alt="logo" />
        </button>
        <p>
          Edit <code>pages/popup/src/Popup.tsx</code>
        </p>
        <button
          className={cn(
            'mt-4 rounded px-4 py-1 font-bold shadow hover:scale-105',
            isLight ? 'bg-blue-200 text-black' : 'bg-gray-700 text-white',
          )}
          onClick={injectContentScript}>
          {t('injectButton')}
        </button>
        <button
          className={cn(
            'mt-2 rounded px-4 py-1 font-bold shadow hover:scale-105',
            isLight ? 'bg-green-200 text-black' : 'bg-green-700 text-white',
          )}
          onClick={() => void takeScreenshot()}>
          Take Screenshots
        </button>
        <div className="mt-2 flex gap-2">
          <button
            className={cn(
              'rounded px-3 py-1 font-bold shadow hover:scale-105',
              isLight ? 'bg-green-200 text-black' : 'bg-green-700 text-white',
            )}
            onClick={() => takeScreenshot('canvas-1')}>
            Shot → Canvas 1
          </button>
          <button
            className={cn(
              'rounded px-3 py-1 font-bold shadow hover:scale-105',
              isLight ? 'bg-green-200 text-black' : 'bg-green-700 text-white',
            )}
            onClick={() => takeScreenshot('canvas-2')}>
            Shot → Canvas 2
          </button>
          <button
            className={cn(
              'rounded px-3 py-1 font-bold shadow hover:scale-105',
              isLight ? 'bg-green-200 text-black' : 'bg-green-700 text-white',
            )}
            onClick={() => takeScreenshot('canvas-3')}>
            Shot → Canvas 3
          </button>
        </div>
        <div className="mt-4 flex gap-2">
          <button
            className={cn(
              'rounded px-3 py-1 font-bold shadow hover:scale-105',
              isLight ? 'bg-purple-200 text-black' : 'bg-purple-700 text-white',
            )}
            onClick={openProjects}>
            Open Projects
          </button>
          <button
            className={cn(
              'rounded px-3 py-1 font-bold shadow hover:scale-105',
              isLight ? 'bg-amber-200 text-black' : 'bg-amber-700 text-white',
            )}
            onClick={newProject}>
            New Project
          </button>
        </div>
        <ToggleButton>{t('toggleTheme')}</ToggleButton>
      </header>
    </div>
  );
};

export default withErrorBoundary(withSuspense(Popup, <LoadingSpinner />), ErrorDisplay);
