import React, { useMemo, useState } from 'react';

import { Tool, ToolType } from '../types';

interface ToolLibraryProps {
  isOpen: boolean;
  onClose: () => void;
  tools: Tool[];
  onCreateTool: (tool: Tool) => Promise<void> | void;
  onUpdateTool: (tool: Tool) => Promise<void> | void;
  onDeleteTool: (id: string) => Promise<void> | void;
}

const EMPTY_TOOL: Tool = {
  id: '',
  name: '',
  type: ToolType.END_MILL,
  diameter: 10,
  description: ''
};

const ToolLibrary: React.FC<ToolLibraryProps> = ({
  isOpen,
  onClose,
  tools,
  onCreateTool,
  onUpdateTool,
  onDeleteTool
}) => {
  const [draft, setDraft] = useState<Tool>(EMPTY_TOOL);
  const [editingId, setEditingId] = useState<string | null>(null);

  const nextToolId = useMemo(() => {
    const numericIds = tools
      .map((tool) => Number.parseInt(tool.id.replace(/^\D+/g, ''), 10))
      .filter((value) => Number.isFinite(value));
    return `T${(Math.max(0, ...numericIds) + 1).toString()}`;
  }, [tools]);

  if (!isOpen) {
    return null;
  }

  async function handleSubmit() {
    const payload: Tool = {
      ...draft,
      id: draft.id || nextToolId,
      name: draft.name.trim() || '未命名刀具',
      description: draft.description?.trim() || ''
    };

    if (editingId) {
      await onUpdateTool(payload);
    } else {
      await onCreateTool(payload);
    }

    setDraft(EMPTY_TOOL);
    setEditingId(null);
  }

  function handleEdit(tool: Tool) {
    setEditingId(tool.id);
    setDraft(tool);
  }

  function resetDraft() {
    setEditingId(null);
    setDraft(EMPTY_TOOL);
  }

  return (
    <div
      className="fixed inset-0 z-[80] flex items-end justify-center p-2 sm:items-center sm:p-4 lg:p-8"
      style={{
        paddingTop: 'max(0.625rem, calc(env(safe-area-inset-top) + 0.625rem))',
        paddingBottom: 'max(0.75rem, calc(env(safe-area-inset-bottom) + 0.75rem))'
      }}
    >
      <div className="absolute inset-0 bg-slate-900/24 backdrop-blur-sm" onClick={onClose} />

      <div className="pointer-events-auto relative flex h-[calc(100dvh-0.75rem)] w-full max-w-6xl flex-col overflow-hidden rounded-[2rem] border border-white/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.985),rgba(255,255,255,0.95))] shadow-[0_14px_42px_-28px_rgba(15,23,42,0.22)] backdrop-blur-[44px] sm:h-auto sm:max-h-[92vh]">
        <div className="flex items-start justify-between gap-4 border-b border-white/70 px-4 py-4 sm:px-6 sm:py-5 lg:px-8">
          <div className="min-w-0">
            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">刀具库</div>
            <h2 className="mt-2 text-xl font-semibold tracking-tight text-slate-900 sm:text-2xl">给 AI 一套更贴近车间实际的刀具上下文</h2>
            <p className="mt-2 hidden max-w-2xl text-sm leading-6 text-slate-500 sm:block">
              这里配置的刀具会参与 AI 的工艺规划。刀具越真实，自动生成的工序、进给与策略就越可靠。
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-white/85 bg-[linear-gradient(180deg,rgba(255,255,255,0.99),rgba(248,250,252,0.96))] text-slate-500 transition-colors hover:bg-white hover:text-slate-900 sm:h-11 sm:w-11"
          >
            <i className="fa-solid fa-xmark text-lg" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4 sm:px-6 sm:py-5 lg:px-8 lg:py-6">
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px] lg:gap-6">
            <section className="order-2 min-h-0 space-y-3 lg:order-1">
              <div className="flex items-center justify-between px-1">
                <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">已配置刀具</div>
                <div className="rounded-full border border-slate-200 bg-white/92 px-2.5 py-1 text-[11px] font-medium text-slate-500">
                  {tools.length} 把
                </div>
              </div>

              {tools.length === 0 ? (
                <div className="rounded-[1.5rem] border border-white/85 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(248,250,252,0.95))] px-5 py-5 text-sm leading-6 text-slate-500 shadow-[0_10px_24px_-20px_rgba(15,23,42,0.08)]">
                  还没有刀具条目。你可以先添加一把常用刀具，后续 AI 生成工艺时会优先参考这里的配置。
                </div>
              ) : (
                <div className="space-y-3">
                  {tools.map((tool) => (
                    <div
                      key={tool.id}
                      className="rounded-[1.5rem] border border-white/85 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(248,250,252,0.95))] px-4 py-4 shadow-[0_10px_24px_-20px_rgba(15,23,42,0.1)] sm:px-5"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex min-w-0 items-center gap-3 sm:gap-4">
                          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-slate-900 text-sm font-semibold text-white shadow-[0_10px_24px_-20px_rgba(15,23,42,0.18)] sm:h-12 sm:w-12">
                            {tool.id}
                          </div>
                          <div className="min-w-0">
                            <div className="truncate text-sm font-semibold text-slate-900">{tool.name}</div>
                            <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                              <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-1">{tool.type}</span>
                              <span>D{tool.diameter} mm</span>
                            </div>
                            {tool.description && <div className="mt-2 text-xs leading-5 text-slate-500">{tool.description}</div>}
                          </div>
                        </div>

                        <div className="flex shrink-0 items-center gap-2">
                          <button
                            type="button"
                            onClick={() => handleEdit(tool)}
                            className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/85 bg-white/96 text-slate-500 transition-colors hover:bg-white hover:text-sky-700"
                            title="编辑刀具"
                          >
                            <i className="fa-solid fa-pen text-xs" />
                          </button>
                          <button
                            type="button"
                            onClick={() => onDeleteTool(tool.id)}
                            className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/85 bg-white/96 text-slate-500 transition-colors hover:bg-white hover:text-rose-500"
                            title="删除刀具"
                          >
                            <i className="fa-solid fa-trash-can text-xs" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section className="order-1 rounded-[1.6rem] border border-white/85 bg-[linear-gradient(180deg,rgba(255,255,255,0.99),rgba(248,250,252,0.96))] p-4 shadow-[0_10px_24px_-20px_rgba(15,23,42,0.1)] sm:rounded-[1.75rem] sm:p-5 lg:order-2 lg:sticky lg:top-0">
              <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">{editingId ? '编辑刀具' : '新增刀具'}</div>

              <div className="mt-4 grid gap-4 sm:mt-5">
                <label className="grid gap-2">
                  <span className="text-xs font-medium text-slate-500">刀具编号</span>
                  <input
                    value={draft.id}
                    onChange={(event) => setDraft((current) => ({ ...current, id: event.target.value }))}
                    placeholder={nextToolId}
                    className="rounded-2xl border border-slate-200 bg-white/98 px-4 py-3 text-sm text-slate-800 outline-none transition-colors focus:border-sky-300"
                  />
                </label>

                <label className="grid gap-2">
                  <span className="text-xs font-medium text-slate-500">刀具名称</span>
                  <input
                    value={draft.name}
                    onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))}
                    placeholder="例如：10mm 平底铣刀"
                    className="rounded-2xl border border-slate-200 bg-white/98 px-4 py-3 text-sm text-slate-800 outline-none transition-colors focus:border-sky-300"
                  />
                </label>

                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="grid gap-2">
                    <span className="text-xs font-medium text-slate-500">类型</span>
                    <select
                      value={draft.type}
                      onChange={(event) =>
                        setDraft((current) => ({
                          ...current,
                          type: event.target.value as ToolType
                        }))
                      }
                      className="rounded-2xl border border-slate-200 bg-white/98 px-4 py-3 text-sm text-slate-800 outline-none transition-colors focus:border-sky-300"
                    >
                      {Object.values(ToolType).map((type) => (
                        <option key={type} value={type}>
                          {type}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="grid gap-2">
                    <span className="text-xs font-medium text-slate-500">直径</span>
                    <input
                      type="number"
                      min="0"
                      step="0.1"
                      value={draft.diameter}
                      onChange={(event) =>
                        setDraft((current) => ({
                          ...current,
                          diameter: Number.parseFloat(event.target.value) || 0
                        }))
                      }
                      className="rounded-2xl border border-slate-200 bg-white/98 px-4 py-3 text-sm text-slate-800 outline-none transition-colors focus:border-sky-300"
                    />
                  </label>
                </div>

                <label className="grid gap-2">
                  <span className="text-xs font-medium text-slate-500">说明</span>
                  <textarea
                    value={draft.description}
                    onChange={(event) => setDraft((current) => ({ ...current, description: event.target.value }))}
                    placeholder="写下刀具用途、适合的加工阶段，或机床上的使用备注。"
                    className="min-h-[108px] rounded-2xl border border-slate-200 bg-white/98 px-4 py-3 text-sm text-slate-800 outline-none transition-colors focus:border-sky-300 sm:min-h-[120px]"
                  />
                </label>
              </div>
            </section>
          </div>
        </div>

        <div
          className="flex items-center justify-between gap-3 border-t border-white/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(248,250,252,0.96))] px-4 py-3 sm:px-6 sm:py-4 lg:px-8"
          style={{ paddingBottom: 'max(0.875rem, calc(env(safe-area-inset-bottom) + 0.875rem))' }}
        >
          <button
            type="button"
            onClick={resetDraft}
            className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-500 transition-colors hover:text-slate-800"
          >
            清空
          </button>

          <button
            type="button"
            onClick={handleSubmit}
            className="rounded-full border border-sky-300/60 bg-gradient-to-br from-[#0a84ff] to-[#2563eb] px-5 py-2 text-sm font-medium text-white shadow-[0_18px_36px_-24px_rgba(10,132,255,0.48)]"
          >
            {editingId ? '保存刀具' : '添加刀具'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ToolLibrary;
