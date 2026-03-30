import React from 'react';

import {
  CNCOutput,
  ProviderStatus,
  SessionSummary,
  SyncState,
  Tool
} from '../types';

interface OverviewPanelProps {
  data: CNCOutput | null;
  sessions: SessionSummary[];
  tools: Tool[];
  providers: ProviderStatus[];
  activeProviderLabel?: string;
  syncState: SyncState;
  lastSavedAt: number | null;
  onOpenHistory: () => void;
  onOpenToolLibrary: () => void;
  onOpenSetupSheet: () => void;
  onUseDemo: () => void;
}

function formatTimestamp(value: number | null) {
  if (!value) {
    return 'Not synced yet';
  }

  return new Date(value).toLocaleString();
}

function syncCopy(syncState: SyncState) {
  switch (syncState) {
    case 'saving':
      return 'Saving workspace';
    case 'saved':
      return 'Synced to local server';
    case 'error':
      return 'Sync needs attention';
    default:
      return 'Ready';
  }
}

const OverviewPanel: React.FC<OverviewPanelProps> = ({
  data,
  sessions,
  tools,
  providers,
  activeProviderLabel,
  syncState,
  lastSavedAt,
  onOpenHistory,
  onOpenToolLibrary,
  onOpenSetupSheet,
  onUseDemo
}) => {
  const enabledProviders = providers.filter((provider) => provider.enabled);
  const audit = data?.audit;

  if (!data) {
    return (
      <div className="glass-panel h-full w-full rounded-[2rem] border border-white/60 bg-white/55 p-6 lg:p-8 backdrop-blur-2xl shadow-[0_20px_80px_-42px_rgba(15,23,42,0.35)]">
        <div className="flex h-full flex-col gap-6">
          <div className="rounded-[2rem] border border-white/70 bg-[radial-gradient(circle_at_top_left,_rgba(255,255,255,0.95),_rgba(239,246,255,0.78)_38%,_rgba(226,232,240,0.62)_100%)] p-6 shadow-[inset_0_1px_0_rgba(255,255,255,0.8)] lg:p-8">
            <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
              <div className="max-w-2xl">
                <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-sky-200/70 bg-white/75 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-sky-700">
                  <span className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_14px_rgba(52,211,153,0.85)]" />
                  Intelligent CAM Workspace
                </div>
                <h2 className="max-w-xl text-3xl font-semibold tracking-tight text-slate-900 lg:text-[2.5rem]">
                  Build machining flows that feel premium before they feel industrial.
                </h2>
                <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-600 lg:text-[15px]">
                  Start with a natural-language brief, a drawing, or a model upload. LinguaCNC keeps the
                  workflow calm, precise, and presentation-ready while exposing the signals a professional team expects.
                </p>
              </div>

              <div className="grid gap-3 sm:grid-cols-3 lg:w-[360px] lg:grid-cols-1">
                <button
                  onClick={onUseDemo}
                  className="rounded-2xl border border-sky-300/60 bg-gradient-to-br from-sky-500 to-blue-600 px-5 py-4 text-left text-white shadow-[0_20px_40px_-24px_rgba(37,99,235,0.75)] transition-transform duration-300 hover:-translate-y-0.5"
                >
                  <div className="text-xs font-semibold uppercase tracking-[0.18em] text-sky-100">Quick start</div>
                  <div className="mt-2 text-base font-semibold">Open the sample machining brief</div>
                </button>
                <button
                  onClick={onOpenHistory}
                  className="rounded-2xl border border-white/70 bg-white/70 px-5 py-4 text-left shadow-sm transition-colors hover:bg-white"
                >
                  <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Recent work</div>
                  <div className="mt-2 text-base font-semibold text-slate-800">{sessions.length} saved sessions</div>
                </button>
                <button
                  onClick={onOpenToolLibrary}
                  className="rounded-2xl border border-white/70 bg-white/70 px-5 py-4 text-left shadow-sm transition-colors hover:bg-white"
                >
                  <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Tooling</div>
                  <div className="mt-2 text-base font-semibold text-slate-800">{tools.length} tools in the library</div>
                </button>
              </div>
            </div>
          </div>

          <div className="grid flex-1 gap-4 lg:grid-cols-[1.2fr_0.8fr]">
            <div className="grid gap-4 md:grid-cols-3">
              <div className="rounded-[1.75rem] border border-white/70 bg-white/68 p-5 shadow-[0_14px_40px_-28px_rgba(15,23,42,0.35)]">
                <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">System status</div>
                <div className="mt-4 flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-900 text-white">
                    <i className="fa-solid fa-sparkles text-sm" />
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-slate-900">{syncCopy(syncState)}</div>
                    <div className="text-xs text-slate-500">Last update {formatTimestamp(lastSavedAt)}</div>
                  </div>
                </div>
              </div>

              <div className="rounded-[1.75rem] border border-white/70 bg-white/68 p-5 shadow-[0_14px_40px_-28px_rgba(15,23,42,0.35)]">
                <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Providers ready</div>
                <div className="mt-4 flex flex-wrap gap-2">
                  {enabledProviders.map((provider) => (
                    <span
                      key={provider.key}
                      className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700"
                    >
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                      {provider.label}
                    </span>
                  ))}
                </div>
              </div>

              <div className="rounded-[1.75rem] border border-white/70 bg-white/68 p-5 shadow-[0_14px_40px_-28px_rgba(15,23,42,0.35)]">
                <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Design promise</div>
                <div className="mt-4 space-y-2 text-sm text-slate-600">
                  <div>Consumer-grade calm</div>
                  <div>Professional-grade traceability</div>
                  <div>Single flow from prompt to export</div>
                </div>
              </div>
            </div>

            <div className="rounded-[1.75rem] border border-white/70 bg-white/68 p-5 shadow-[0_14px_40px_-28px_rgba(15,23,42,0.35)]">
              <div className="flex items-center justify-between">
                <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">How the workspace flows</div>
                <span className="rounded-full border border-slate-200 bg-white/80 px-3 py-1 text-[11px] font-medium text-slate-500">
                  {activeProviderLabel || 'Choose a provider'}
                </span>
              </div>
              <div className="mt-5 space-y-4">
                {[
                  'Describe a part, upload a drawing, or open a sample brief.',
                  'Review the generated operations, stock assumptions, and safety score.',
                  'Inspect the simulation, fine-tune the code, and export with confidence.'
                ].map((line, index) => (
                  <div key={line} className="flex gap-4">
                    <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-slate-900 text-sm font-semibold text-white">
                      {index + 1}
                    </div>
                    <p className="pt-1 text-sm leading-6 text-slate-600">{line}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="glass-panel h-full w-full rounded-[2rem] border border-white/60 bg-white/55 p-6 backdrop-blur-2xl shadow-[0_20px_80px_-42px_rgba(15,23,42,0.35)] lg:p-7">
      <div className="grid h-full gap-4 xl:grid-cols-[1.15fr_0.85fr]">
        <div className="flex flex-col gap-4">
          <div className="rounded-[1.75rem] border border-white/70 bg-white/74 p-5 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Current program</div>
                <div className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">
                  {data.isScreen ? 'HMI screen package' : 'Machining flow ready for review'}
                </div>
                <p className="mt-2 max-w-xl text-sm leading-6 text-slate-600">{data.explanation}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <span className="rounded-full border border-white/70 bg-white px-3 py-1 text-xs font-medium text-slate-600">
                  {syncCopy(syncState)}
                </span>
                <span className="rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-xs font-medium text-sky-700">
                  {activeProviderLabel || 'AI provider'}
                </span>
                {audit && (
                  <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700">
                    Safety {audit.score}/100
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <div className="rounded-[1.75rem] border border-white/70 bg-white/72 p-5 shadow-sm">
              <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Stock</div>
              <div className="mt-4 space-y-3 text-sm text-slate-600">
                <div className="flex items-center justify-between">
                  <span>Material</span>
                  <span className="font-semibold text-slate-800">{data.stock.material}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Geometry</span>
                  <span className="font-semibold text-slate-800">{data.stock.shape}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>X / Y / Z</span>
                  <span className="font-mono text-[13px] text-slate-800">
                    {data.stock.length} / {data.stock.width} / {data.stock.height}
                  </span>
                </div>
              </div>
            </div>

            <div className="rounded-[1.75rem] border border-white/70 bg-white/72 p-5 shadow-sm">
              <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Operations</div>
              <div className="mt-4 text-3xl font-semibold tracking-tight text-slate-900">{data.operations.length}</div>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                Structured around a single centered work coordinate system and ready for simulation.
              </p>
            </div>

            <div className="rounded-[1.75rem] border border-white/70 bg-white/72 p-5 shadow-sm">
              <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Workspace sync</div>
              <div className="mt-4 text-sm font-semibold text-slate-900">{formatTimestamp(lastSavedAt)}</div>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                Sessions are persisted on the local server so they can be reopened across devices and shells.
              </p>
            </div>
          </div>

          <div className="rounded-[1.75rem] border border-white/70 bg-white/72 p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Operation chain</div>
              <button
                onClick={onOpenSetupSheet}
                className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-600 transition-colors hover:border-sky-200 hover:text-sky-700"
              >
                Open process sheet
              </button>
            </div>

            <div className="mt-5 space-y-3">
              {data.operations.map((operation, index) => (
                <div
                  key={`${operation.type}-${index}`}
                  className="flex items-center gap-4 rounded-2xl border border-white/70 bg-white/86 px-4 py-3 shadow-[0_12px_30px_-26px_rgba(15,23,42,0.55)]"
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-900 text-sm font-semibold text-white">
                    {index + 1}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-semibold text-slate-900">{operation.type}</div>
                    <div className="mt-1 text-xs text-slate-500">
                      Feed {operation.feed_rate} | Spindle {operation.spindle_speed} | Tool D{operation.tool_diameter}
                    </div>
                  </div>
                  <div className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[11px] font-medium text-slate-600">
                    Z{operation.z_start} {'->'} Z{operation.z_start - operation.z_depth}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-4">
          <div className="rounded-[1.75rem] border border-white/70 bg-white/72 p-5 shadow-sm">
            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Safety snapshot</div>
            {audit ? (
              <div className="mt-4">
                <div className="flex items-end justify-between gap-4">
                  <div className="text-4xl font-semibold tracking-tight text-slate-900">{audit.score}</div>
                  <div
                    className={`rounded-full px-3 py-1 text-xs font-medium ${
                      audit.passed ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'
                    }`}
                  >
                    {audit.passed ? 'Ready for review' : 'Needs attention'}
                  </div>
                </div>
                <div className="mt-4 space-y-3">
                  {audit.issues.slice(0, 3).map((issue, index) => (
                    <div key={`${issue.message}-${index}`} className="rounded-2xl border border-slate-200 bg-white/80 px-4 py-3">
                      <div className="text-sm font-semibold text-slate-800">{issue.message}</div>
                      {issue.suggestion && <div className="mt-1 text-xs leading-5 text-slate-500">{issue.suggestion}</div>}
                    </div>
                  ))}
                  {audit.issues.length === 0 && (
                    <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">
                      No immediate safety risks were found in the generated output.
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="mt-4 rounded-2xl border border-slate-200 bg-white/80 px-4 py-5 text-sm leading-6 text-slate-500">
                Run the first generation to receive a safety score and machining warnings here.
              </div>
            )}
          </div>

          <div className="rounded-[1.75rem] border border-white/70 bg-white/72 p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Workspace assets</div>
              <button
                onClick={onOpenToolLibrary}
                className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-600 transition-colors hover:border-sky-200 hover:text-sky-700"
              >
                Manage tools
              </button>
            </div>
            <div className="mt-4 space-y-3">
              {tools.slice(0, 4).map((tool) => (
                <div key={tool.id} className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white/80 px-4 py-3">
                  <div>
                    <div className="text-sm font-semibold text-slate-800">{tool.name}</div>
                    <div className="text-xs text-slate-500">{tool.type}</div>
                  </div>
                  <div className="font-mono text-sm text-slate-700">D{tool.diameter}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-[1.75rem] border border-white/70 bg-white/72 p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Recent sessions</div>
              <button
                onClick={onOpenHistory}
                className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-600 transition-colors hover:border-sky-200 hover:text-sky-700"
              >
                Open history
              </button>
            </div>
            <div className="mt-4 space-y-3">
              {sessions.slice(0, 4).map((session) => (
                <div key={session.id} className="rounded-2xl border border-slate-200 bg-white/82 px-4 py-3">
                  <div className="text-sm font-semibold text-slate-800">{session.title}</div>
                  <div className="mt-1 text-xs leading-5 text-slate-500">{session.preview}</div>
                </div>
              ))}
              {sessions.length === 0 && (
                <div className="rounded-2xl border border-dashed border-slate-200 bg-white/70 px-4 py-5 text-sm leading-6 text-slate-500">
                  The first completed session will appear here for quick reopening.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default OverviewPanel;
