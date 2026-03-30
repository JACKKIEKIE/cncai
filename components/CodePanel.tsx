import React, { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';

import { CNCOutput, MachineOperationType } from '../types';

interface CodePanelProps {
  data: CNCOutput | null;
  onCodeChange?: (newCode: string) => void;
  onDeleteOperation?: (index: number) => void;
  onAuditRequest?: (gcode: string) => Promise<void> | void;
  isAuditing?: boolean;
  lastAuditedAt?: number | null;
  isMobile?: boolean;
}

type MobileSection = 'editor' | 'review';

function formatTimestamp(value: number | null | undefined) {
  if (!value) {
    return '尚未检查';
  }

  return new Date(value).toLocaleString('zh-CN');
}

function severityLabel(value: 'critical' | 'warning' | 'info') {
  if (value === 'critical') {
    return '高风险';
  }
  if (value === 'warning') {
    return '提醒';
  }
  return '提示';
}

function severityIcon(value: 'critical' | 'warning' | 'info') {
  if (value === 'critical') {
    return 'fa-triangle-exclamation';
  }
  if (value === 'warning') {
    return 'fa-bell';
  }
  return 'fa-circle-info';
}

function operationLabel(type: MachineOperationType) {
  switch (type) {
    case MachineOperationType.CIRCULAR_POCKET:
      return '圆型腔';
    case MachineOperationType.RECTANGULAR_POCKET:
      return '矩形槽';
    case MachineOperationType.DRILL:
      return '钻孔';
    case MachineOperationType.FACE_MILL:
      return '面铣';
    case MachineOperationType.CONTOUR:
      return '轮廓';
    case MachineOperationType.BOSS_MILLING:
      return '保凸台';
    case MachineOperationType.RUN_MYSCREEN:
      return 'HMI';
    default:
      return type;
  }
}

const CodePanel: React.FC<CodePanelProps> = ({
  data,
  onCodeChange,
  onDeleteOperation,
  onAuditRequest,
  isAuditing,
  lastAuditedAt,
  isMobile = false
}) => {
  const [copied, setCopied] = useState(false);
  const [localCode, setLocalCode] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [mobileSection, setMobileSection] = useState<MobileSection>('editor');

  useEffect(() => {
    setLocalCode(data?.gcode || '');
    setIsEditing(false);
    setMobileSection('editor');
  }, [data]);

  const visibleOperations = useMemo(
    () =>
      data?.operations
        .map((operation, index) => ({ operation, index }))
        .filter((item) => item.operation?.type !== MachineOperationType.GENERAL_CHAT) ?? [],
    [data]
  );

  async function copyToClipboard() {
    await navigator.clipboard.writeText(localCode);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  }

  function downloadCode() {
    if (!data) {
      return;
    }
    const blob = new Blob([localCode], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = data.isScreen ? 'EasyScreen.com' : 'program.mpf';
    link.click();
    URL.revokeObjectURL(url);
  }

  function handleChange(value: string) {
    setLocalCode(value);
    onCodeChange?.(value);
  }

  function toggleEditing() {
    setIsEditing((current) => !current);
    if (isMobile) {
      setMobileSection('editor');
    }
  }

  if (!data) {
    return (
      <div className="glass-panel flex h-full w-full items-center justify-center rounded-[2rem] border border-white/85 bg-[linear-gradient(180deg,rgba(255,255,255,0.97),rgba(255,255,255,0.93))] p-8 shadow-[0_16px_36px_-20px_rgba(31,38,135,0.1)] backdrop-blur-[48px]">
        <div className="max-w-sm text-center">
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-[1.6rem] bg-[linear-gradient(180deg,#0f172a,#1e293b)] text-white shadow-[0_16px_36px_-24px_rgba(15,23,42,0.36)]">
            <i className="fa-solid fa-code text-3xl" />
          </div>
          <h3 className="mt-5 text-xl font-semibold tracking-tight text-slate-900">这里会显示 G 代码与安全检查</h3>
          <p className="mt-3 text-sm leading-7 text-slate-500">
            先在左侧生成加工结果，随后你可以在这里查看、编辑、重新检查并导出程序。
          </p>
        </div>
      </div>
    );
  }

  const audit = data.audit;

  const actionButtons = [
    {
      icon: isAuditing ? 'fa-spinner fa-spin' : 'fa-shield-halved',
      label: isAuditing ? '检查中' : '重新检查',
      onClick: () => onAuditRequest?.(localCode)
    },
    {
      icon: isEditing ? 'fa-check' : 'fa-pen-to-square',
      label: isEditing ? '完成编辑' : '编辑代码',
      onClick: toggleEditing
    },
    {
      icon: copied ? 'fa-check' : 'fa-copy',
      label: copied ? '已复制' : '复制',
      onClick: copyToClipboard
    },
    {
      icon: 'fa-download',
      label: '导出程序',
      onClick: downloadCode,
      accent: true
    }
  ];

  const codeView = isEditing ? (
    <textarea
      value={localCode}
      onChange={(event) => handleChange(event.target.value)}
      spellCheck={false}
      className="h-full min-h-0 w-full resize-none bg-transparent px-4 py-4 font-mono text-[12px] leading-6 text-slate-700 outline-none sm:px-6 sm:py-5 sm:text-[13px]"
    />
  ) : (
    <pre className="h-full min-h-0 overflow-auto px-4 py-4 font-mono text-[12px] leading-6 text-slate-700 sm:px-6 sm:py-5 sm:text-[13px]">
      <code>{localCode}</code>
    </pre>
  );

  const operationChips = visibleOperations.length ? (
    <div className={`flex gap-2 ${isMobile ? 'overflow-x-auto pb-1' : 'flex-wrap'}`}>
      {visibleOperations.map(({ operation, index }) => (
        <motion.div
          key={`${operation.type}-${index}`}
          whileHover={{ y: -1.5 }}
          className={`flex shrink-0 items-center gap-2 rounded-full border border-slate-200 bg-white/96 shadow-[0_8px_20px_-18px_rgba(15,23,42,0.12)] ${
            isMobile ? 'px-3 py-1.5 text-[11px]' : 'px-4 py-2 text-xs'
          } text-slate-600`}
        >
          <span className="font-semibold text-slate-800">{operationLabel(operation.type)}</span>
          <span className="font-mono">D{operation.tool_diameter}</span>
          {onDeleteOperation && (
            <button
              type="button"
              onClick={() => onDeleteOperation(index)}
              className="flex h-5 w-5 items-center justify-center rounded-full bg-slate-100 text-slate-400 transition-colors hover:bg-rose-50 hover:text-rose-500"
              aria-label={`删除第 ${index + 1} 道工序`}
            >
              <i className="fa-solid fa-xmark text-[10px]" />
            </button>
          )}
        </motion.div>
      ))}
    </div>
  ) : null;

  const auditView = (
    <div className={`space-y-3 ${isMobile ? '' : 'mt-4'}`}>
      {isMobile && operationChips && (
        <div className="rounded-[1.35rem] border border-white/85 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(248,250,252,0.96))] p-3 shadow-[0_10px_24px_-20px_rgba(15,23,42,0.08)]">
          <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">工序</div>
          {operationChips}
        </div>
      )}

      {audit ? (
        <>
          <div className="rounded-[1.35rem] border border-white/85 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(248,250,252,0.96))] px-4 py-4 shadow-[0_10px_24px_-20px_rgba(15,23,42,0.08)]">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className={`font-semibold tracking-tight text-slate-900 ${isMobile ? 'text-[2rem]' : 'text-4xl'}`}>{audit.score}</div>
                <div className="mt-1 text-xs text-slate-400">最近检查：{formatTimestamp(lastAuditedAt)}</div>
              </div>
              <span
                className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-medium ${
                  audit.passed ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'
                }`}
              >
                <i className={`fa-solid ${audit.passed ? 'fa-circle-check' : 'fa-triangle-exclamation'}`} />
                {audit.passed ? '可继续' : '建议修复'}
              </span>
            </div>
            <div className="mt-3 text-sm leading-6 text-slate-500">
              {audit.passed ? '代码通过基础检查，可以继续核对刀路与机床约束。' : '建议先修复风险，再导出到机床。'}
            </div>
          </div>

          {audit.issues.length === 0 ? (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-[1.45rem] border border-emerald-200 bg-emerald-50 px-4 py-4 text-sm font-medium leading-6 text-emerald-700"
            >
              暂未发现明显风险，可以继续检查刀具、坐标系和夹具设置。
            </motion.div>
          ) : (
            audit.issues.slice(0, isMobile ? 3 : 4).map((issue, index) => (
              <motion.div
                key={`${issue.message}-${index}`}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.04 * index, duration: 0.22 }}
                className={`rounded-[1.45rem] border px-4 py-4 ${
                  issue.severity === 'critical'
                    ? 'border-rose-200 bg-rose-50'
                    : issue.severity === 'warning'
                      ? 'border-amber-200 bg-amber-50'
                      : 'border-sky-200 bg-sky-50'
                }`}
              >
                <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-white/76 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-600">
                  <i className={`fa-solid ${severityIcon(issue.severity)}`} />
                  {severityLabel(issue.severity)}
                </div>
                <div className="text-sm font-semibold text-slate-800">{issue.message}</div>
                {issue.line ? <div className="mt-2 text-xs text-slate-400">代码行：{issue.line}</div> : null}
                {issue.suggestion ? <div className="mt-2 text-xs leading-5 text-slate-500">{issue.suggestion}</div> : null}
              </motion.div>
            ))
          )}
        </>
      ) : (
        <div className="rounded-[1.45rem] border border-dashed border-slate-200 bg-[linear-gradient(180deg,rgba(255,255,255,0.97),rgba(248,250,252,0.95))] px-4 py-5 text-sm leading-6 text-slate-500">
          生成程序后会自动执行安全检查；如果你手动修改了代码，也可以点击上方“重新检查”。
        </div>
      )}
    </div>
  );

  if (isMobile) {
    return (
      <div className="glass-panel flex h-full w-full flex-col overflow-hidden rounded-[2rem] border border-white/85 bg-[linear-gradient(180deg,rgba(255,255,255,0.97),rgba(255,255,255,0.93))] shadow-[0_16px_36px_-20px_rgba(31,38,135,0.1)] backdrop-blur-[48px]">
        <div className="border-b border-white/70 px-4 py-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">G-CODE</div>
              <div className="mt-1.5 flex flex-wrap items-center gap-2">
                <h2 className="text-[1.55rem] font-semibold tracking-tight text-slate-900">{data.isScreen ? 'HMI 程序' : '数控程序'}</h2>
                <span className="rounded-full border border-slate-200 bg-white/96 px-3 py-1 text-[11px] font-medium text-slate-500">
                  {isEditing ? '编辑中' : '只读'}
                </span>
              </div>
              <div className="mt-2 text-xs text-slate-400">最近检查：{formatTimestamp(lastAuditedAt)}</div>
            </div>
            {audit ? (
              <div className="shrink-0 rounded-[1rem] border border-emerald-200 bg-emerald-50 px-3 py-2 text-right text-xs font-medium text-emerald-700">
                <div>安全评分</div>
                <div className="mt-1 text-lg font-semibold leading-none">{audit.score}</div>
              </div>
            ) : null}
          </div>

          <div className="mt-4 grid grid-cols-2 gap-2">
            {actionButtons.map((action) => (
              <motion.button
                key={action.label}
                whileTap={{ scale: 0.97 }}
                onClick={action.onClick}
                className={`inline-flex items-center justify-center gap-2 rounded-[1rem] border px-3 py-2.5 text-[13px] font-medium transition-colors ${
                  action.accent
                    ? 'border-sky-300/60 bg-gradient-to-br from-[#0a84ff] to-[#2563eb] text-white shadow-[0_18px_36px_-24px_rgba(10,132,255,0.48)]'
                    : 'border-slate-200 bg-white text-slate-600 hover:border-sky-200 hover:text-sky-700'
                }`}
              >
                <i className={`fa-solid ${action.icon} text-[12px]`} />
                <span>{action.label}</span>
              </motion.button>
            ))}
          </div>

          <div className="mt-4 flex items-center rounded-[1rem] border border-white/90 bg-white/88 p-1 shadow-[0_10px_24px_-20px_rgba(15,23,42,0.12)]">
            {[
              { key: 'editor' as const, label: '代码', icon: 'fa-code' },
              { key: 'review' as const, label: '检查', icon: 'fa-shield-halved' }
            ].map((item) => (
              <button
                key={item.key}
                type="button"
                onClick={() => setMobileSection(item.key)}
                className={`relative flex flex-1 items-center justify-center gap-2 rounded-[0.9rem] px-3 py-2 text-sm font-medium transition-colors ${
                  mobileSection === item.key ? 'text-slate-900' : 'text-slate-500'
                }`}
              >
                {mobileSection === item.key ? (
                  <motion.span
                    layoutId="mobile-code-panel-tab"
                    className="absolute inset-0 rounded-[0.9rem] bg-white shadow-[0_12px_24px_-20px_rgba(15,23,42,0.14)]"
                    transition={{ type: 'spring', stiffness: 380, damping: 34 }}
                  />
                ) : null}
                <span className="relative flex items-center gap-2">
                  <i className={`fa-solid ${item.icon} text-[12px]`} />
                  <span>{item.label}</span>
                </span>
              </button>
            ))}
          </div>
        </div>

        <div className="min-h-0 flex-1">
          {mobileSection === 'editor' ? (
            <div className="flex h-full min-h-0 flex-col">
              {operationChips ? <div className="border-b border-white/70 px-4 py-3">{operationChips}</div> : null}
              <div className="min-h-0 flex-1">{codeView}</div>
            </div>
          ) : (
            <div className="h-full overflow-y-auto px-4 py-4">{auditView}</div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="glass-panel flex h-full w-full flex-col overflow-hidden rounded-[2rem] border border-white/85 bg-[linear-gradient(180deg,rgba(255,255,255,0.97),rgba(255,255,255,0.93))] shadow-[0_16px_36px_-20px_rgba(31,38,135,0.1)] backdrop-blur-[48px]">
      <div className="flex flex-col gap-4 border-b border-white/60 px-6 py-5 xl:flex-row xl:flex-wrap xl:items-center xl:justify-between">
        <div>
          <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">G-CODE</div>
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <h2 className="text-2xl font-semibold tracking-tight text-slate-900">{data.isScreen ? 'HMI 面板代码' : '数控程序'}</h2>
            <span className="rounded-full border border-slate-200 bg-white/96 px-3 py-1.5 text-xs font-medium text-slate-500">
              {isEditing ? '编辑中' : '只读'}
            </span>
            {audit ? (
              <span className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-700">
                <i className="fa-solid fa-shield-halved" />
                安全评分 {audit.score}/100
              </span>
            ) : null}
          </div>
          <div className="mt-2 text-xs text-slate-400">最近检查：{formatTimestamp(lastAuditedAt)}</div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {actionButtons.map((action) => (
            <motion.button
              key={action.label}
              whileHover={{ y: -1.5, scale: 1.01 }}
              whileTap={{ scale: 0.97 }}
              onClick={action.onClick}
              className={`inline-flex items-center justify-center gap-2 rounded-full border px-4 py-2.5 text-sm font-medium transition-colors ${
                action.accent
                  ? 'border-sky-300/60 bg-gradient-to-br from-[#0a84ff] to-[#2563eb] text-white shadow-[0_18px_36px_-24px_rgba(10,132,255,0.48)]'
                  : 'border-slate-200 bg-white text-slate-600 hover:border-sky-200 hover:text-sky-700'
              }`}
            >
              <i className={`fa-solid ${action.icon}`} />
              <span>{action.label}</span>
            </motion.button>
          ))}
        </div>
      </div>

      {operationChips ? <div className="border-b border-white/60 px-6 py-4">{operationChips}</div> : null}

      <div className="grid min-h-0 flex-1 gap-0 xl:grid-cols-[1fr_340px]">
        <div className="min-h-0 overflow-hidden">{codeView}</div>
        <div className="border-t border-white/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.97),rgba(248,250,252,0.95))] p-5 backdrop-blur-[44px] xl:border-l xl:border-t-0">
          <div className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
            <i className="fa-solid fa-shield-halved" />
            <span>安全检查</span>
          </div>
          {auditView}
        </div>
      </div>
    </div>
  );
};

export default CodePanel;
