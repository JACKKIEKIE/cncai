import React from 'react';
import { AnimatePresence, motion } from 'framer-motion';

import { SessionSummary } from '../types';

interface HistoryDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  sessions: SessionSummary[];
  onSelectSession: (id: string) => void;
  onDeleteSession: (id: string) => void;
  currentSessionId: string | null;
}

const overlayTransition = {
  duration: 0.18,
  ease: [0.22, 1, 0.36, 1] as const
};

const HistoryDrawer: React.FC<HistoryDrawerProps> = ({
  isOpen,
  onClose,
  sessions,
  onSelectSession,
  onDeleteSession,
  currentSessionId
}) => {
  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={overlayTransition}
            className="fixed inset-0 z-[70] bg-slate-900/22 backdrop-blur-sm"
            onClick={onClose}
          />

          <motion.aside
            initial={{ y: 22, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 18, opacity: 0 }}
            transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
            className="pointer-events-auto fixed inset-x-0 bottom-0 z-[80] flex max-h-[82dvh] flex-col rounded-t-[2rem] border-t border-white/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.985),rgba(255,255,255,0.94))] p-4 shadow-[0_-12px_36px_-18px_rgba(31,38,135,0.12)] backdrop-blur-[44px] sm:inset-y-0 sm:left-0 sm:right-auto sm:max-h-none sm:w-full sm:max-w-md sm:rounded-none sm:rounded-r-[2rem] sm:border-r sm:border-t-0 sm:p-5 sm:shadow-[0_10px_36px_0_rgba(31,38,135,0.1)]"
            style={{ paddingBottom: 'max(1rem, calc(env(safe-area-inset-bottom) + 1rem))' }}
          >
            <div className="flex items-center justify-between gap-4">
              <div className="flex min-w-0 items-center gap-3 sm:gap-4">
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[1.2rem] bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(241,245,249,0.84))] text-slate-700 shadow-[0_10px_24px_-20px_rgba(15,23,42,0.16)] sm:h-14 sm:w-14 sm:rounded-[1.3rem]">
                  <i className="fa-regular fa-clock text-lg sm:text-xl" />
                </span>
                <div className="min-w-0">
                  <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">历史记录</div>
                  <h2 className="mt-1 truncate text-xl font-semibold tracking-tight text-slate-900 sm:text-2xl">已保存的加工任务</h2>
                </div>
              </div>

              <motion.button
                type="button"
                whileTap={{ scale: 0.94 }}
                onClick={onClose}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[1rem] border border-white/85 bg-[linear-gradient(180deg,rgba(255,255,255,0.99),rgba(248,250,252,0.96))] text-slate-500 transition-colors hover:bg-white hover:text-slate-900 sm:h-11 sm:w-11 sm:rounded-[1.1rem]"
              >
                <i className="fa-solid fa-xmark text-lg" />
              </motion.button>
            </div>

            <div className="mt-4 rounded-[1.4rem] border border-white/85 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(248,250,252,0.95))] px-4 py-3.5 text-sm leading-6 text-slate-500 shadow-[0_10px_24px_-20px_rgba(15,23,42,0.1)] sm:rounded-[1.55rem] sm:px-4 sm:py-4">
              这里会保留对话、工序、G 代码和模型配置，方便你随时回到任意一条加工任务继续处理。
            </div>

            <div className="mt-5 flex-1 space-y-3 overflow-y-auto overscroll-contain pr-1">
              {sessions.length === 0 && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="rounded-[1.55rem] border border-dashed border-slate-200 bg-[linear-gradient(180deg,rgba(255,255,255,0.97),rgba(248,250,252,0.94))] px-5 py-6 text-sm leading-7 text-slate-500"
                >
                  你还没有保存任何任务。先在主界面生成一次工艺，历史记录就会自动出现在这里。
                </motion.div>
              )}

              {sessions.map((session, index) => (
                <motion.div
                  key={session.id}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.03 * index, duration: 0.2 }}
                  className={`rounded-[1.5rem] border px-4 py-4 transition-all sm:px-5 ${
                    currentSessionId === session.id
                      ? 'border-sky-200 bg-sky-50/82 shadow-[0_16px_34px_-28px_rgba(14,165,233,0.22)]'
                      : 'border-white/85 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(248,250,252,0.95))] shadow-[0_10px_24px_-20px_rgba(15,23,42,0.1)]'
                  }`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <button
                      type="button"
                      onClick={() => onSelectSession(session.id)}
                      className="min-w-0 flex-1 text-left"
                    >
                      <div className="truncate text-sm font-semibold text-slate-900">{session.title}</div>
                      <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-slate-400">
                        <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white/96 px-2 py-1">
                          <i className="fa-regular fa-clock" />
                          {new Date(session.timestamp).toLocaleString('zh-CN')}
                        </span>
                      </div>
                      <div className="mt-3 text-sm leading-6 text-slate-500">{session.preview}</div>
                    </button>

                    <button
                      type="button"
                      onClick={() => onDeleteSession(session.id)}
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[1rem] border border-transparent bg-white/96 text-slate-400 transition-colors hover:border-rose-100 hover:text-rose-500"
                      title="删除任务"
                    >
                      <i className="fa-solid fa-trash-can text-xs" />
                    </button>
                  </div>

                  <div className="mt-4 flex items-center justify-between text-[11px] font-medium uppercase tracking-[0.16em] text-slate-400">
                    <span className="inline-flex items-center gap-1">
                      <i className="fa-solid fa-gears" />
                      {session.operationCount} 道工序
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <i className={`fa-solid ${session.mode === 'OPTIMIZE' ? 'fa-sliders' : 'fa-wand-magic'}`} />
                      {session.mode === 'OPTIMIZE' ? '优化' : '生成'}
                    </span>
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
};

export default HistoryDrawer;
