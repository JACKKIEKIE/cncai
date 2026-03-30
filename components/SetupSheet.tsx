import React from 'react';

import { CNCOutput } from '../types';

interface SetupSheetProps {
  isOpen: boolean;
  onClose: () => void;
  data: CNCOutput | null;
}

interface SetupSheetContentProps {
  data: CNCOutput | null;
  onClose?: () => void;
  showCloseButton?: boolean;
  showPrintButton?: boolean;
  className?: string;
}

function estimateRunTime(data: CNCOutput | null) {
  if (!data) {
    return { minutes: 0, seconds: 0 };
  }

  let totalTimeSec = 0;
  data.operations.forEach((operation) => {
    if (operation.feed_rate > 0) {
      const passes = Math.ceil(Math.abs(operation.z_depth) / Math.max(operation.step_down || 1, 1));
      const pathLength = (operation.width || 50) * 2 + (operation.length || 50) * 2;
      totalTimeSec += (pathLength * passes * 60) / operation.feed_rate;
    }
    totalTimeSec += 12;
  });

  return {
    minutes: Math.floor(totalTimeSec / 60),
    seconds: Math.floor(totalTimeSec % 60)
  };
}

function renderEmptyState() {
  return (
    <div className="flex h-full min-h-[360px] flex-col items-center justify-center gap-4 rounded-[1.8rem] border border-white/85 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(248,250,252,0.95))] px-6 text-center shadow-[0_12px_30px_-22px_rgba(15,23,42,0.14)] backdrop-blur-[36px]">
      <div className="flex h-16 w-16 items-center justify-center rounded-[1.4rem] bg-slate-100 text-slate-400">
        <i className="fa-solid fa-file-lines text-2xl" />
      </div>
      <div>
        <h2 className="text-lg font-semibold tracking-tight text-slate-900">还没有加工工艺单</h2>
        <p className="mt-2 text-sm leading-6 text-slate-500">生成一次加工结果后，这里会展示毛坯信息、工序清单和预计工时。</p>
      </div>
    </div>
  );
}

export const SetupSheetContent: React.FC<SetupSheetContentProps> = ({
  data,
  onClose,
  showCloseButton = true,
  showPrintButton = true,
  className = ''
}) => {
  if (!data) {
    return renderEmptyState();
  }

  const { stock, operations } = data;
  const { minutes, seconds } = estimateRunTime(data);

  return (
    <div
      className={`flex h-full min-h-0 flex-col overflow-hidden rounded-[2rem] border border-white/85 bg-[linear-gradient(180deg,rgba(255,255,255,0.985),rgba(255,255,255,0.96))] shadow-[0_12px_40px_-28px_rgba(15,23,42,0.22)] backdrop-blur-[40px] ${className}`.trim()}
    >
      <div className="flex items-start justify-between gap-4 border-b border-slate-200 bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(248,250,252,0.93))] px-4 py-4 sm:px-6 sm:py-6">
        <div className="flex min-w-0 gap-3 sm:gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[1.1rem] bg-[#0a84ff] text-white shadow-[0_16px_32px_-22px_rgba(10,132,255,0.42)] sm:h-16 sm:w-16 sm:rounded-[1.25rem]">
            <i className="fa-solid fa-file-invoice text-xl sm:text-2xl" />
          </div>
          <div className="min-w-0">
            <h1 className="text-xl font-bold text-slate-800 sm:text-2xl">加工工艺单</h1>
            <p className="mt-1 text-sm text-slate-500">
              程序名：<span className="font-mono font-bold text-slate-700">AI_CAM_PROG</span>
            </p>
            <p className="text-sm text-slate-500">日期：{new Date().toLocaleDateString('zh-CN')}</p>
          </div>
        </div>

        <div className="text-right">
          <div className="text-2xl font-mono font-bold text-slate-700 sm:text-3xl">
            {minutes}m {seconds}s
          </div>
          <div className="mt-1 text-xs font-bold uppercase tracking-widest text-slate-400">预计工时</div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto overscroll-contain px-4 py-4 print:overflow-visible sm:px-6 sm:py-6">
        <div className="grid gap-8 lg:grid-cols-[1fr_0.9fr]">
          <div className="space-y-6">
            <section>
              <h3 className="mb-3 border-b border-slate-100 pb-1 text-sm font-bold uppercase tracking-wider text-slate-400">毛坯信息</h3>
              <div className="grid gap-4 rounded-[1.5rem] border border-slate-200 bg-slate-50 p-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="text-xs text-slate-400">形状</div>
                    <div className="font-medium text-slate-700">{stock.shape}</div>
                  </div>
                  <div>
                    <div className="text-xs text-slate-400">材料</div>
                    <div className="font-medium text-slate-700">{stock.material}</div>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div className="rounded-xl border border-slate-100 bg-white p-3 text-center">
                    <div className="text-[10px] uppercase tracking-wider text-slate-400">Length</div>
                    <div className="mt-1 font-mono font-bold text-slate-700">{stock.length}</div>
                  </div>
                  <div className="rounded-xl border border-slate-100 bg-white p-3 text-center">
                    <div className="text-[10px] uppercase tracking-wider text-slate-400">Width</div>
                    <div className="mt-1 font-mono font-bold text-slate-700">{stock.width}</div>
                  </div>
                  <div className="rounded-xl border border-slate-100 bg-white p-3 text-center">
                    <div className="text-[10px] uppercase tracking-wider text-slate-400">Height</div>
                    <div className="mt-1 font-mono font-bold text-slate-700">{stock.height}</div>
                  </div>
                </div>
              </div>
            </section>

            <section>
              <h3 className="mb-3 border-b border-slate-100 pb-1 text-sm font-bold uppercase tracking-wider text-slate-400">装夹与坐标系</h3>
              <div className="flex items-center gap-4 rounded-[1.5rem] border border-blue-100 bg-blue-50 p-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-full border-2 border-blue-200 bg-white">
                  <i className="fa-solid fa-crosshairs text-xl text-blue-500" />
                </div>
                <div>
                  <div className="font-bold text-slate-700">G54 - 顶面中心</div>
                  <div className="text-xs leading-5 text-slate-500">X0 / Y0 位于工件中心，Z0 位于工件顶面。</div>
                </div>
              </div>
            </section>
          </div>

          <section>
            <h3 className="mb-3 border-b border-slate-100 pb-1 text-sm font-bold uppercase tracking-wider text-slate-400">装夹示意</h3>
            <div className="relative min-h-[260px] overflow-hidden rounded-[1.5rem] border border-slate-200 bg-slate-100">
              <div
                className="absolute inset-0"
                style={{
                  backgroundImage:
                    'linear-gradient(rgba(203,213,225,0.8) 1px, transparent 1px), linear-gradient(90deg, rgba(203,213,225,0.8) 1px, transparent 1px)',
                  backgroundSize: '22px 22px'
                }}
              />
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="relative border-2 border-slate-400 bg-white shadow-xl" style={{ width: '62%', aspectRatio: `${stock.width}/${stock.length}` }}>
                  <div className="absolute left-1/2 top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2">
                    <div className="absolute left-0 top-1/2 h-[2px] w-full bg-red-500" />
                    <div className="absolute left-1/2 top-0 h-full w-[2px] bg-red-500" />
                  </div>
                  <div className="absolute left-1/2 top-1/2 translate-x-2 translate-y-2 rounded bg-white/90 px-1 text-[10px] font-bold text-red-600">G54</div>
                </div>
              </div>
            </div>
          </section>
        </div>

        <section className="mt-8">
          <h3 className="mb-3 border-b border-slate-100 pb-1 text-sm font-bold uppercase tracking-wider text-slate-400">刀具与工序</h3>
          <div className="overflow-hidden rounded-[1.5rem] border border-slate-200">
            <div className="overflow-x-auto">
              <table className="min-w-[640px] w-full text-left text-sm">
                <thead className="bg-slate-50 text-slate-500">
                  <tr>
                    <th className="p-3">序号</th>
                    <th className="p-3">工序</th>
                    <th className="p-3">刀具</th>
                    <th className="p-3">转速</th>
                    <th className="p-3 text-right">进给</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {operations.map((operation, index) => (
                    <tr key={`${operation.type}-${index}`}>
                      <td className="p-3 font-mono font-bold text-slate-700">OP{index + 1}</td>
                      <td className="p-3 text-slate-700">{operation.type}</td>
                      <td className="p-3 text-slate-600">
                        {operation.tool_type} / D{operation.tool_diameter}
                      </td>
                      <td className="p-3 font-mono text-slate-600">{operation.spindle_speed}</td>
                      <td className="p-3 text-right font-mono text-slate-600">{operation.feed_rate}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      </div>

      {(showCloseButton || showPrintButton) && (
        <div className="flex justify-end gap-3 border-t border-slate-200 bg-white px-4 py-4 print:hidden sm:px-6">
          {showCloseButton && onClose ? (
            <button type="button" onClick={onClose} className="rounded-lg px-4 py-2 text-sm text-slate-600 transition-colors hover:bg-slate-100">
              关闭
            </button>
          ) : null}
          {showPrintButton ? (
            <button
              type="button"
              onClick={() => window.print()}
              className="flex items-center gap-2 rounded-lg bg-[#0a84ff] px-4 py-2 text-sm font-bold text-white shadow-[0_14px_28px_-18px_rgba(10,132,255,0.35)] transition-colors hover:bg-[#0077ed]"
            >
              <i className="fa-solid fa-print" />
              打印 / 存为 PDF
            </button>
          ) : null}
        </div>
      )}
    </div>
  );
};

const SetupSheet: React.FC<SetupSheetProps> = ({ isOpen, onClose, data }) => {
  if (!isOpen || !data) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end justify-center p-0 sm:items-center sm:p-4"
      style={{
        paddingTop: 'max(0.75rem, calc(env(safe-area-inset-top) + 0.75rem))',
        paddingBottom: 'max(0.75rem, calc(env(safe-area-inset-bottom) + 0.75rem))'
      }}
    >
      <div className="absolute inset-0 bg-black/36 backdrop-blur-sm" onClick={onClose} />
      <div className="pointer-events-auto relative h-[calc(100dvh-0.75rem)] w-full max-w-4xl sm:h-auto sm:max-h-[92vh]">
        <SetupSheetContent data={data} onClose={onClose} />
      </div>
    </div>
  );
};

export default SetupSheet;
