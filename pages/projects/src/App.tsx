// @ts-nocheck
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Tldraw, type Editor, toDomPrecision, createShapeId } from 'tldraw';
import 'tldraw/tldraw.css';
import { useStorage, withErrorBoundary, withSuspense } from '@extension/shared';
import { projectsStorage, type ScreenshotItem } from '@extension/storage';
import { cn, ErrorDisplay, LoadingSpinner } from '@extension/ui';
import { useChat } from '@ai-sdk/react';

type Tool = 'select' | 'arrow' | 'text';

const Toolbar = ({ tool, setTool }: { tool: Tool; setTool: (t: Tool) => void }) => {
  return (
    <div className="flex gap-2 border-b border-gray-200 bg-white p-2">
      {(['select', 'arrow', 'text'] as Tool[]).map(t => (
        <button
          key={t}
          className={cn('rounded border px-3 py-1 text-sm', tool === t ? 'bg-blue-600 text-white' : 'bg-gray-100')}
          onClick={() => setTool(t)}>
          {t}
        </button>
      ))}
    </div>
  );
};

const RightPanel = ({ editor, activeCanvasName }: { editor: Editor | null; activeCanvasName?: string }) => {
  const { messages, input, setInput, append, isLoading } = useChat({ api: '/api/chat' });

  const handleKeyDown: React.KeyboardEventHandler<HTMLTextAreaElement> = async e => {
    if (e.key === '@') {
      e.preventDefault();
      if (!editor) return;
      try {
        const { blob } = await editor.toImage('png', { background: true });
        const dataUrl = await new Promise<string>(resolve => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.readAsDataURL(blob);
        });
        await append(
          { role: 'user', content: input || `Screenshot of ${activeCanvasName || 'Canvas'}` },
          { data: { imageDataUrl: dataUrl, canvasName: activeCanvasName || 'Canvas' } },
        );
        setInput('');
      } catch (err) {
        console.error('capture canvas failed', err);
      }
    }
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      if (!input.trim()) return;
      await append({ role: 'user', content: input });
      setInput('');
    }
  };

  return (
    <div className="flex h-full w-96 flex-col border-l border-gray-200 bg-white">
      <div className="p-3 font-semibold">AI Assistant</div>
      <div className="flex-1 space-y-2 overflow-auto p-3 text-sm">
        {messages.map((m: any) => (
          <div key={m.id} className={cn('rounded p-2', m.role === 'user' ? 'bg-blue-50' : 'bg-gray-100')}>
            {typeof m.content === 'string' ? <div>{m.content}</div> : null}
          </div>
        ))}
        <div className="text-xs text-gray-500">
          Tip: type <code>@</code> to attach the current canvas as an image.
        </div>
      </div>
      <div className="border-t p-2">
        <textarea
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          className="h-24 w-full resize-none rounded border p-2 text-sm outline-none"
          placeholder={isLoading ? 'Thinking…' : 'Ask anything... (@ to attach canvas, Cmd/Ctrl+Enter to send)'}
        />
      </div>
    </div>
  );
};

const CanvasBoard = ({
  screenshots,
  persistenceKey,
  onEditor,
  onConfirmDeletions,
}: {
  screenshots: ScreenshotItem[];
  persistenceKey: string;
  onEditor: (e: Editor | null) => void;
  onConfirmDeletions?: (deletedDataUrls: Set<string>) => void;
}) => {
  const [tool, setTool] = useState<Tool>('select');
  const editorRef = useRef<Editor | null>(null);
  const scanTimerRef = useRef<number | null>(null);
  const seenDataUrlsRef = useRef<Set<string>>(new Set());
  const missCountsRef = useRef<Map<string, number>>(new Map());

  const addImageToEditor = async (editor: Editor, shot: ScreenshotItem, x: number, y: number) => {
    const assetId = `asset:${crypto.randomUUID()}` as any;
    const mimeType = (() => {
      try {
        if (shot.dataUrl?.startsWith('data:')) {
          const semi = shot.dataUrl.indexOf(';');
          if (semi > 5) return shot.dataUrl.slice(5, semi);
        }
      } catch {}
      return 'image/png';
    })();
    editor.createAssets([
      {
        id: assetId,
        type: 'image',
        typeName: 'asset',
        props: {
          src: shot.dataUrl,
          w: 800,
          h: 450,
          name: shot.filename,
          isAnimated: false,
          mimeType,
        },
        meta: { screenshotId: shot.id },
      } as any,
    ]);
    const shapeId = createShapeId();
    editor.createShapes([
      {
        id: shapeId,
        type: 'image',
        x: toDomPrecision(x),
        y: toDomPrecision(y),
        props: {
          w: 800,
          h: 450,
          assetId,
          playing: false,
          flipX: false,
          flipY: false,
        },
      } as any,
    ]);
  };

  const mountImages = async (editor: Editor) => {
    // Clear previous images only (keep other user drawings)
    // Note: optional: we skip clearing to preserve drawings; we only add new images if not already added
    let y = 100;
    const startX = 100;
    for (const shot of screenshots) {
      if (!shot?.dataUrl) continue;
      await addImageToEditor(editor, shot, startX, y);
      // mark this dataUrl as seen at least once on canvas
      seenDataUrlsRef.current.add(shot.dataUrl);
      y += 490;
    }
    editor.setCurrentTool(tool);
  };

  const onEditorMount = (editor: Editor) => {
    editorRef.current = editor;
    onEditor(editor);
    void mountImages(editor);
    // re-mount after a short delay to avoid racing with internal persistence restore
    window.setTimeout(() => void mountImages(editor), 100);
    window.setTimeout(() => void mountImages(editor), 500);
    if (scanTimerRef.current) window.clearInterval(scanTimerRef.current);
    // poll canvas and handle deletions with debounce + self-heal
    scanTimerRef.current = window.setInterval(() => {
      try {
        const e = editorRef.current as any;
        if (!e) return;
        const shapes = Array.from(e.getCurrentPageShapes?.() ?? []);
        const assetIds = new Set<string>();
        for (const s of shapes) {
          if (s?.type === 'image' && s?.props?.assetId) assetIds.add(s.props.assetId);
        }
        const presentDataUrls = new Set<string>();
        for (const id of assetIds) {
          const asset = e.getAsset?.(id);
          const src = asset?.props?.src || asset?.src;
          if (typeof src === 'string' && src) presentDataUrls.add(src);
        }
        // Update seen set with whatever is currently on canvas
        for (const url of presentDataUrls) seenDataUrlsRef.current.add(url);

        // Determine expected urls from props and persist immediate deletions
        const expected = new Set<string>();
        for (const s of screenshots) if (s.dataUrl) expected.add(s.dataUrl);
        const confirmedDeleted = new Set<string>();
        expected.forEach(u => {
          if (!presentDataUrls.has(u) && seenDataUrlsRef.current.has(u)) {
            confirmedDeleted.add(u);
          }
        });
        if (confirmedDeleted.size > 0) onConfirmDeletions?.(confirmedDeleted);
      } catch {}
    }, 2000) as unknown as number;
  };

  useEffect(() => {
    return () => {
      if (scanTimerRef.current) {
        window.clearInterval(scanTimerRef.current);
        scanTimerRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (!editorRef.current) return;
    // Re-mount images when screenshots change
    void mountImages(editorRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(screenshots)]);

  useEffect(() => {
    if (!editorRef.current) return;
    editorRef.current.setCurrentTool(tool);
  }, [tool]);

  return (
    <div className="flex h-full flex-1 flex-col">
      <Toolbar tool={tool} setTool={setTool} />
      <div className="relative h-full w-full flex-1 overflow-hidden bg-gray-50">
        <Tldraw onMount={onEditorMount} persistenceKey={persistenceKey} />
      </div>
    </div>
  );
};

// Arrow tool removed in favor of tldraw's built-in tools

const ProjectsApp = () => {
  const { projects, currentProjectId } = useStorage(projectsStorage);
  const search = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : undefined;
  const urlProjectId = search?.get('projectId') || undefined;
  const urlCanvasId = search?.get('canvasId') || undefined;
  const project = useMemo(
    () => (urlProjectId ? projects[urlProjectId] : currentProjectId ? projects[currentProjectId] : undefined),
    [currentProjectId, projects, urlProjectId],
  );
  const [activeCanvasId, setActiveCanvasId] = useState<string | undefined>(
    () => urlCanvasId || project?.canvases?.[0]?.id,
  );
  const editorRef = useRef<Editor | null>(null);
  const [availableProjects, setAvailableProjects] = useState<string[]>([]);
  const [selectedProject, setSelectedProject] = useState<string | undefined>(undefined);
  const [isScanning, setIsScanning] = useState(false);

  useEffect(() => {
    if (urlCanvasId) setActiveCanvasId(urlCanvasId);
  }, [urlCanvasId]);

  useEffect(() => {
    if (project && !activeCanvasId) setActiveCanvasId(project.canvases?.[0]?.id);
  }, [project, activeCanvasId]);

  const canvases = project?.canvases ?? [];

  const filteredScreenshots = useMemo(() => {
    const shots = project?.screenshots ?? [];
    return activeCanvasId ? shots.filter(s => s.canvasId === activeCanvasId) : shots;
  }, [project, activeCanvasId]);

  const normalizeBaseDir = (raw: string | undefined): string => {
    let dir = (raw || '').trim();
    if (/^(~|\/|\\|[A-Za-z]:)/.test(dir)) {
      const parts = dir.split(/[\\/]+/g).filter(Boolean);
      dir = parts.length ? parts[parts.length - 1] : 'projects';
    }
    dir = dir.replace(/^[\\/]+|[\\/]+$/g, '');
    return dir || 'projects';
  };

  // If we just came from a screenshot action, hydrate the dataUrl for immediate mounting
  useEffect(() => {
    const hydrateLastScreenshot = async () => {
      try {
        const session = await chrome.storage.session.get(['lastScreenshot']);
        const last = session?.lastScreenshot;
        if (!last || !last.projectId) return;
        const state = await projectsStorage.get();
        const p = state.projects[last.projectId];
        if (!p) return;
        const item = p.screenshots.find(s => s.filename === last.filename);
        if (item && !item.dataUrl) {
          item.dataUrl = last.dataUrl;
          await projectsStorage.set(state);
          // clear the hint after hydration
          await chrome.storage.session.remove('lastScreenshot');
        }
      } catch {}
    };
    void hydrateLastScreenshot();
  }, []);

  const persistenceKey = useMemo(() => {
    const pid = project?.id ?? 'no-project';
    const cid = activeCanvasId ?? 'default-canvas';
    return `projects-canvas-${pid}-${cid}`;
  }, [project?.id, activeCanvasId]);

  // Hydrate from Downloads dir and prune removed files/projects
  useEffect(() => {
    const hydrateFromDownloads = async () => {
      try {
        const baseDirRaw = (process.env?.CEB_SCREENSHOT_DIR as string) || 'projects';
        const baseDir = normalizeBaseDir(baseDirRaw);
        if (!('downloads' in chrome) || !chrome.downloads?.search) return;
        const safeSeg = baseDir.replace(/[-/\\^$*+?.()|[\]{}]/g, r => `\\${r}`);
        const regex = `(?:^|[\\/])${safeSeg}(?:[\\/].+)?$`;
        let items: any[] = [];
        try {
          items = await chrome.downloads.search({ filenameRegex: regex });
        } catch {
          // Fallback: broad query by segment
          try {
            // @ts-ignore - query is allowed in Downloads API
            items = await chrome.downloads.search({ query: [baseDir] });
          } catch {}
        }
        const projectToFiles = new Map<string, { filename: string; exists: boolean }[]>();
        for (const it of items) {
          const full = it.filename || '';
          const parts = full.split(/[/\\]/g);
          const partsLower = parts.map(p => p.toLowerCase());
          const idx = partsLower.findIndex(p => p === baseDir.toLowerCase());
          if (idx >= 0 && parts[idx + 1]) {
            const pid = parts[idx + 1];
            const rel = `${baseDir}/${parts.slice(idx + 1).join('/')}`;
            const arr = projectToFiles.get(pid) || [];
            arr.push({ filename: rel, exists: (it as any).exists ?? true });
            projectToFiles.set(pid, arr);
          }
        }

        const current = await projectsStorage.get();
        // ensure projects exist for found files and add missing screenshots (no aggressive pruning)
        for (const [pid, files] of projectToFiles.entries()) {
          if (!current.projects[pid]) {
            current.projects[pid] = {
              id: pid,
              createdAt: new Date().toISOString(),
              screenshots: [],
              canvases: [{ id: 'canvas-1', name: 'Canvas 1' }],
            };
          }
          const proj = current.projects[pid];
          const byFilename = new Map(proj.screenshots.map(s => [s.filename, true] as const));
          for (const f of files) {
            if (!f.exists) continue;
            if (!byFilename.has(f.filename)) {
              proj.screenshots.push({
                id: `${Date.now()}_${Math.random().toString(36).slice(2)}`,
                dataUrl: '',
                filename: f.filename,
                createdAt: new Date().toISOString(),
                canvasId: proj.canvases?.[0]?.id,
              });
            }
          }
        }
        await projectsStorage.set(current);
      } catch (err) {
        console.warn('hydrateFromDownloads failed', err);
      }
    };
    void hydrateFromDownloads();
    const onFocus = () => void hydrateFromDownloads();
    window.addEventListener('focus', onFocus);
    const interval = window.setInterval(() => void hydrateFromDownloads(), 15000);
    return () => {
      window.removeEventListener('focus', onFocus);
      window.clearInterval(interval);
    };
  }, []);

  // Ensure URL-provided canvas exists / ensure at least one canvas when a project is selected
  useEffect(() => {
    (async () => {
      if (!project) return;
      if (urlCanvasId) {
        const exists = project.canvases?.some(c => c.id === urlCanvasId);
        if (!exists) {
          const state = await projectsStorage.get();
          const p = state.projects[project.id];
          if (!p) return;
          p.canvases = [
            ...(p.canvases || []),
            { id: urlCanvasId, name: urlCanvasId.replace(/-/g, ' ').replace(/^./, s => s.toUpperCase()) },
          ];
          await projectsStorage.set(state);
          setActiveCanvasId(urlCanvasId);
        }
      } else if (!project.canvases || project.canvases.length === 0) {
        const state = await projectsStorage.get();
        const p = state.projects[project.id];
        if (!p) return;
        p.canvases = [{ id: 'canvas-1', name: 'Canvas 1' }];
        await projectsStorage.set(state);
        setActiveCanvasId('canvas-1');
      }
    })();
  }, [project?.id, urlCanvasId]);

  // Scan downloads for projects and hydrate list and storage
  const scanAndHydrateProjects = async () => {
    setIsScanning(true);
    try {
      const baseDir = normalizeBaseDir(process.env?.CEB_SCREENSHOT_DIR as string);
      if (!('downloads' in chrome) || !chrome.downloads?.search) return;
      const safe = baseDir.replace(/[-\/\\^$*+?.()|[\]{}]/g, r => `\\${r}`);
      const regex = `(?:^|[\\/])${safe}(?:[\\/].+)?$`;
      let items: any[] = [];
      try {
        items = await chrome.downloads.search({ filenameRegex: regex });
      } catch {
        try {
          // @ts-ignore
          items = await chrome.downloads.search({ query: [baseDir] });
        } catch {}
      }
      const projectToFiles = new Map<string, { filename: string; exists: boolean }[]>();
      for (const it of items) {
        const full = it.filename || '';
        const parts = full.split(/[\/\\]/g);
        const partsLower = parts.map(p => p.toLowerCase());
        const idx = partsLower.findIndex(p => p === baseDir.toLowerCase());
        if (idx >= 0 && parts[idx + 1]) {
          const pid = parts[idx + 1];
          const rel = `${baseDir}/${parts.slice(idx + 1).join('/')}`;
          const arr = projectToFiles.get(pid) || [];
          arr.push({ filename: rel, exists: (it as any).exists ?? true });
          projectToFiles.set(pid, arr);
        }
      }

      const current = await projectsStorage.get();
      // Ensure projects exist and at least one canvas for each discovered project
      for (const [pid, files] of projectToFiles.entries()) {
        if (!current.projects[pid]) {
          current.projects[pid] = {
            id: pid,
            createdAt: new Date().toISOString(),
            screenshots: [],
            canvases: [{ id: 'canvas-1', name: 'Canvas 1' }],
          };
        }
        const proj = current.projects[pid];
        const byFilename = new Map(proj.screenshots.map(s => [s.filename, true] as const));
        for (const f of files) {
          if (!f.exists) continue;
          if (!byFilename.has(f.filename)) {
            proj.screenshots.push({
              id: `${Date.now()}_${Math.random().toString(36).slice(2)}`,
              dataUrl: '',
              filename: f.filename,
              createdAt: new Date().toISOString(),
              canvasId: proj.canvases?.[0]?.id,
            });
          }
        }
      }
      await projectsStorage.set(current);

      // Populate dropdown from both discovered and existing storage
      const pids = Array.from(
        new Set<string>([
          ...Object.keys(current.projects || {}),
          ...Array.from(projectToFiles.keys()),
        ]),
      ).sort();
      setAvailableProjects(pids);
      if (!selectedProject && pids.length > 0) setSelectedProject(pids[0]);
    } finally {
      setIsScanning(false);
    }
  };

  useEffect(() => {
    void scanAndHydrateProjects();
    const onFocus = () => void scanAndHydrateProjects();
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, []);

  return (
    <div className="flex h-screen w-screen flex-col">
      <div className="flex items-center gap-2 border-b border-gray-200 bg-white p-2">
        <div className="text-sm text-gray-600">Load project:</div>
        <select
          className="rounded border px-2 py-1 text-sm"
          value={selectedProject || ''}
          onChange={e => setSelectedProject(e.target.value || undefined)}>
          <option value="">Select…</option>
          {availableProjects.map(pid => (
            <option key={pid} value={pid}>
              {pid}
            </option>
          ))}
        </select>
        <button
          className="rounded border bg-gray-50 px-2 py-1 text-sm"
          onClick={() => void scanAndHydrateProjects()}
          disabled={isScanning}>
          {isScanning ? 'Scanning…' : 'Refresh'}
        </button>
        <button
          className="rounded border bg-blue-600 px-3 py-1 text-sm text-white disabled:opacity-50"
          onClick={async () => {
            if (!selectedProject) return;
            const state = await projectsStorage.get();
            if (!state.projects[selectedProject]) {
              state.projects[selectedProject] = {
                id: selectedProject,
                createdAt: new Date().toISOString(),
                screenshots: [],
                canvases: [{ id: 'canvas-1', name: 'Canvas 1' }],
              };
            }
            state.currentProjectId = selectedProject;
            await projectsStorage.set(state);
            const canv = state.projects[selectedProject].canvases || [];
            const firstCanvas = canv[0]?.id;
            setActiveCanvasId(firstCanvas);
            // Update URL for deep-linking
            const url = new URL(window.location.href);
            url.searchParams.set('projectId', selectedProject);
            if (firstCanvas) url.searchParams.set('canvasId', firstCanvas);
            window.history.replaceState({}, '', url.toString());
          }}
          disabled={!selectedProject}>
          Load
        </button>
        <div className="ml-auto text-xs text-gray-500">Dir: {process.env?.CEB_SCREENSHOT_DIR || 'projects'}</div>
      </div>
      <div className="flex min-h-0 flex-1">
        <div className="w-56 space-y-2 border-r border-gray-200 bg-white p-2">
          <div className="mb-2 text-xs font-semibold text-gray-600">Canvases</div>
          {canvases.map(c => (
            <div
              key={c.id}
              className={cn(
                'flex items-center gap-2 rounded border px-2 py-1',
                activeCanvasId === c.id ? 'border-blue-300 bg-blue-50' : 'bg-gray-50',
              )}>
              <button
                onClick={() => setActiveCanvasId(c.id)}
                className={cn(
                  'flex-1 truncate text-left text-sm',
                  activeCanvasId === c.id ? 'text-blue-800' : 'text-gray-800',
                )}
                title={c.name}>
                {c.name}
              </button>
              <button
                className="rounded bg-red-100 px-2 py-0.5 text-xs text-red-700 hover:bg-red-200"
                onClick={async () => {
                  const confirmed = window.confirm(
                    'Delete this canvas? This will also remove its screenshots from state.',
                  );
                  if (!confirmed || !project) return;
                  const state = await projectsStorage.get();
                  const p = state.projects[project.id];
                  if (!p) return;
                  p.canvases = (p.canvases || []).filter(x => x.id !== c.id);
                  p.screenshots = (p.screenshots || []).filter(s => s.canvasId !== c.id);
                  if (activeCanvasId === c.id) {
                    setActiveCanvasId(p.canvases?.[0]?.id);
                  }
                  await projectsStorage.set(state);
                }}
                title="Delete canvas">
                Delete
              </button>
            </div>
          ))}
          {canvases.length === 0 && (
            <div className="text-xs text-gray-500">No canvases. Take a screenshot from the popup to create one.</div>
          )}
        </div>
        <CanvasBoard
          screenshots={filteredScreenshots}
          persistenceKey={persistenceKey}
          onEditor={e => {
            editorRef.current = e;
          }}
          onConfirmDeletions={async deletedDataUrls => {
            if (!project) return;
            const state = await projectsStorage.get();
            const p = state.projects[project.id];
            if (!p) return;
            const before = p.screenshots.length;
            p.screenshots = p.screenshots.filter(s => !s.dataUrl || !deletedDataUrls.has(s.dataUrl));
            if (p.screenshots.length !== before) await projectsStorage.set(state);
          }}
        />
        <RightPanel editor={editorRef.current} activeCanvasName={canvases.find(c => c.id === activeCanvasId)?.name} />
      </div>
    </div>
  );
};

export default withErrorBoundary(withSuspense(ProjectsApp, <LoadingSpinner />), ErrorDisplay);
