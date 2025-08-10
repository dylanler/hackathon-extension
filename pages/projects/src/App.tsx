import React, { useMemo, useRef, useState } from 'react';
import { useStorage, withErrorBoundary, withSuspense } from '@extension/shared';
import { projectsStorage, type ScreenshotItem } from '@extension/storage';
import { cn, ErrorDisplay, LoadingSpinner } from '@extension/ui';

type Tool = 'select' | 'arrow' | 'text';

const Toolbar = ({ tool, setTool }: { tool: Tool; setTool: (t: Tool) => void }) => {
  return (
    <div className="flex gap-2 p-2 border-b border-gray-200 bg-white">
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

const RightPanel = ({ onMentionAll, latestImage }: { onMentionAll: () => void; latestImage?: string }) => {
  const [messages, setMessages] = useState<
    { role: 'user' | 'assistant'; content?: string; image?: string }[]
  >([]);
  const [text, setText] = useState('');

  const handleSend = () => {
    if (!text.trim()) return;
    setMessages(prev => [...prev, { role: 'user', content: text }]);
    setText('');
  };

  const handleKeyDown: React.KeyboardEventHandler<HTMLTextAreaElement> = e => {
    if (e.key === '@') {
      e.preventDefault();
      if (latestImage) {
        setMessages(prev => [...prev, { role: 'user', image: latestImage }]);
      }
      onMentionAll();
    }
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex h-full w-96 flex-col border-l border-gray-200 bg-white">
      <div className="p-3 font-semibold">AI Assistant</div>
      <div className="flex-1 space-y-2 overflow-auto p-3 text-sm">
        {messages.map((m, i) => (
          <div key={i} className={cn('rounded p-2', m.role === 'user' ? 'bg-blue-50' : 'bg-gray-100')}>
            {m.image ? <img src={m.image} alt="attachment" className="max-w-full" /> : m.content}
          </div>
        ))}
        <div className="text-xs text-gray-500">
          Tip: type <code>@</code> to attach the full page (latest screenshot) to the chat.
        </div>
      </div>
      <div className="border-t p-2">
        <textarea
          value={text}
          onChange={e => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          className="h-24 w-full resize-none rounded border p-2 text-sm outline-none"
          placeholder="Ask anything... (Cmd/Ctrl+Enter to send)"
        />
        <div className="mt-2 flex justify-end">
          <button onClick={handleSend} className="rounded bg-blue-600 px-3 py-1 text-sm text-white">
            Send
          </button>
        </div>
      </div>
    </div>
  );
};

const CanvasBoard = ({ screenshots }: { screenshots: ScreenshotItem[] }) => {
  const [tool, setTool] = useState<Tool>('select');
  const [arrows, setArrows] = useState<Array<{ x1: number; y1: number; x2: number; y2: number }>>([]);
  const [texts, setTexts] = useState<Array<{ x: number; y: number; text: string }>>([]);
  const svgRef = useRef<SVGSVGElement>(null);
  const [draft, setDraft] = useState<{ x1: number; y1: number; x2: number; y2: number } | null>(null);

  const handlePointerDown: React.MouseEventHandler<HTMLDivElement> = e => {
    const board = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - board.left;
    const y = e.clientY - board.top;
    if (tool === 'arrow') setDraft({ x1: x, y1: y, x2: x, y2: y });
    if (tool === 'text') setTexts(prev => [...prev, { x, y, text: 'Text' }]);
  };
  const handlePointerMove: React.MouseEventHandler<HTMLDivElement> = e => {
    if (tool !== 'arrow' || !draft) return;
    const board = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - board.left;
    const y = e.clientY - board.top;
    setDraft({ ...draft, x2: x, y2: y });
  };
  const handlePointerUp: React.MouseEventHandler<HTMLDivElement> = () => {
    if (tool !== 'arrow' || !draft) return;
    setArrows(prev => [...prev, draft]);
    setDraft(null);
  };

  const onMentionAll = () => {
    // no-op here; handled in parent via prop if needed
  };

  return (
    <div className="flex h-full flex-1 flex-col">
      <Toolbar tool={tool} setTool={setTool} />
      <div
        className="relative h-full w-full flex-1 overflow-auto bg-[conic-gradient(at_10%_10%,#fafafa,_#f1f5f9)]"
        onMouseDown={handlePointerDown}
        onMouseMove={handlePointerMove}
        onMouseUp={handlePointerUp}>
        <div className="relative m-6 inline-block bg-white shadow">
          {screenshots.map(s => (
            <img key={s.id} src={s.dataUrl} alt={s.filename} className="block max-w-full" />
          ))}
          <svg ref={svgRef} className="pointer-events-none absolute left-0 top-0 h-full w-full">
            {arrows.map((a, i) => (
              <Arrow key={i} {...a} />
            ))}
            {draft ? <Arrow {...draft} /> : null}
          </svg>
          {texts.map((t, i) => (
            <div
              key={i}
              className="absolute -translate-x-1/2 -translate-y-1/2 rounded bg-yellow-200 px-1 text-xs"
              style={{ left: t.x, top: t.y }}
              contentEditable>
              {t.text}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

const Arrow = ({ x1, y1, x2, y2 }: { x1: number; y1: number; x2: number; y2: number }) => {
  const angle = Math.atan2(y2 - y1, x2 - x1);
  const headLength = 10;
  const hx1 = x2 - headLength * Math.cos(angle - Math.PI / 6);
  const hy1 = y2 - headLength * Math.sin(angle - Math.PI / 6);
  const hx2 = x2 - headLength * Math.cos(angle + Math.PI / 6);
  const hy2 = y2 - headLength * Math.sin(angle + Math.PI / 6);
  return (
    <g stroke="#ef4444" strokeWidth={2} fill="none">
      <line x1={x1} y1={y1} x2={x2} y2={y2} />
      <polyline points={`${hx1},${hy1} ${x2},${y2} ${hx2},${hy2}`} />
    </g>
  );
};

const ProjectsApp = () => {
  const { projects, currentProjectId } = useStorage(projectsStorage);
  const project = useMemo(() => (currentProjectId ? projects[currentProjectId] : undefined), [
    currentProjectId,
    projects,
  ]);

  const screenshots = project?.screenshots ?? [];
  const latestImage = screenshots.length > 0 ? screenshots[screenshots.length - 1].dataUrl : undefined;

  return (
    <div className="flex h-screen w-screen">
      <CanvasBoard screenshots={screenshots} />
      <RightPanel onMentionAll={() => {}} latestImage={latestImage} />
    </div>
  );
};

export default withErrorBoundary(withSuspense(ProjectsApp, <LoadingSpinner />), ErrorDisplay);


