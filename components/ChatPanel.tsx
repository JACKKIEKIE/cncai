import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';

import { Attachment } from '../services/modelService';
import {
  ChatMessage,
  MachineOperationType,
  ModelOption,
  PrimaryAppMode,
  ProviderStatus,
  SyncState
} from '../types';

type ChatPanelLayoutMode = 'default' | 'mobile-empty' | 'mobile-conversation';

interface ChatPanelProps {
  messages: ChatMessage[];
  isProcessing: boolean;
  mode: PrimaryAppMode;
  model: ModelOption;
  providers: ProviderStatus[];
  activeProviderLabel?: string;
  syncState: SyncState;
  lastSavedAt: number | null;
  onModeChange: (mode: PrimaryAppMode) => void;
  onModelChange: (model: ModelOption) => void;
  onSendMessage: (text: string, attachment: Attachment | null, model: ModelOption, mode: PrimaryAppMode) => void;
  onStop: () => void;
  onReset: () => void;
  onOpenHistory: () => void;
  onOpenTools: () => void;
  onOpenSetupSheet: () => void;
  onStartLiveSession?: () => void;
  onUseDemo: () => void;
  onOpenAbout?: () => void;
  layoutMode?: ChatPanelLayoutMode;
  nativeShellEnabled?: boolean;
}

const MODEL_OPTIONS: Array<{ value: ModelOption; label: string; description: string }> = [
  { value: 'auto', label: '自动选择', description: '根据请求内容自动挑选最合适的模型。' },
  { value: 'gemini-2.5-pro', label: 'Gemini 2.5 Pro', description: '适合复杂工艺规划和长上下文推理。' },
  { value: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash', description: '响应更快，适合日常生成与试跑。' },
  { value: 'qwen-plus', label: '通义千问 Plus', description: '国内访问更稳定，适合常规加工问答。' },
  { value: 'qwen3.5-plus', label: '通义千问 3.5 Plus', description: '结构化输出更稳，适合流程整理。' },
  { value: 'mimo-v2-flash', label: '小米 MiMo', description: '轻量快捷，适合短文本与即时反馈。' }
];

function formatSavedAt(value: number | null) {
  if (!value) return '尚未保存';
  return new Date(value).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
}

function syncLabel(syncState: SyncState) {
  if (syncState === 'saving') return '保存中';
  if (syncState === 'saved') return '已保存';
  if (syncState === 'error') return '保存异常';
  return '待开始';
}

function getModelOption(model: ModelOption) {
  return MODEL_OPTIONS.find((option) => option.value === model) ?? MODEL_OPTIONS[0];
}

const ChatPanel: React.FC<ChatPanelProps> = ({
  messages,
  isProcessing,
  mode,
  model,
  providers,
  activeProviderLabel,
  syncState,
  lastSavedAt,
  onModeChange,
  onModelChange,
  onSendMessage,
  onStop,
  onReset,
  onOpenHistory,
  onOpenTools,
  onOpenSetupSheet,
  onStartLiveSession,
  onUseDemo,
  onOpenAbout,
  layoutMode = 'default',
  nativeShellEnabled = false
}) => {
  const [inputText, setInputText] = useState('');
  const [attachment, setAttachment] = useState<Attachment | null>(null);
  const [isStatusOpen, setIsStatusOpen] = useState(false);
  const [isModelPickerOpen, setIsModelPickerOpen] = useState(false);
  const [isEasterEggOpen, setIsEasterEggOpen] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const statusLayerRef = useRef<HTMLDivElement>(null);
  const easterEggHoldRef = useRef<number | null>(null);
  const easterEggHideRef = useRef<number | null>(null);

  const hasConversation = messages.length > 0;
  const isMobileConversationLayout = layoutMode === 'mobile-conversation';
  const isMobileEmptyLayout = layoutMode === 'mobile-empty';
  const shouldShowCompactChrome = !nativeShellEnabled;
  const usesAboutSheet = Boolean(onOpenAbout);
  const currentModel = getModelOption(model);
  const enabledProviders = useMemo(() => providers.filter((provider) => provider.enabled), [providers]);

  const statusItems = useMemo(
    () => [
      { label: '状态', value: syncLabel(syncState) },
      { label: '助手', value: activeProviderLabel || 'AI 助手' },
      { label: '最近保存', value: formatSavedAt(lastSavedAt) },
      { label: '模型数', value: `${enabledProviders.length} 个` }
    ],
    [activeProviderLabel, enabledProviders.length, lastSavedAt, syncState]
  );

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isProcessing]);

  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.style.height = '0px';
    textarea.style.height = `${Math.min(textarea.scrollHeight, isMobileConversationLayout ? 120 : hasConversation ? 132 : 150)}px`;
  }, [hasConversation, inputText, isMobileConversationLayout]);

  useEffect(() => {
    if (!isStatusOpen || usesAboutSheet) return;
    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node | null;
      if (statusLayerRef.current && target && !statusLayerRef.current.contains(target)) {
        setIsStatusOpen(false);
      }
    };
    document.addEventListener('pointerdown', handlePointerDown);
    return () => document.removeEventListener('pointerdown', handlePointerDown);
  }, [isStatusOpen, usesAboutSheet]);

  useEffect(() => {
    return () => {
      if (attachment?.previewUrl) URL.revokeObjectURL(attachment.previewUrl);
      if (easterEggHoldRef.current) window.clearTimeout(easterEggHoldRef.current);
      if (easterEggHideRef.current) window.clearTimeout(easterEggHideRef.current);
    };
  }, [attachment]);

  function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (attachment?.previewUrl) URL.revokeObjectURL(attachment.previewUrl);
    const previewUrl = file.type.startsWith('image/') ? URL.createObjectURL(file) : null;
    setAttachment({ file, fileName: file.name, mimeType: file.type || 'application/octet-stream', previewUrl });
    event.target.value = '';
  }

  function clearAttachment() {
    if (attachment?.previewUrl) URL.revokeObjectURL(attachment.previewUrl);
    setAttachment(null);
  }

  function handleSend() {
    if ((!inputText.trim() && !attachment) || isProcessing) return;
    onSendMessage(inputText.trim(), attachment, model, mode);
    setInputText('');
    clearAttachment();
  }

  function handleModelSelect(nextModel: ModelOption) {
    onModelChange(nextModel);
    setIsModelPickerOpen(false);
  }

  function triggerEasterEgg() {
    if (easterEggHideRef.current) window.clearTimeout(easterEggHideRef.current);
    setIsEasterEggOpen(true);
    easterEggHideRef.current = window.setTimeout(() => setIsEasterEggOpen(false), 2600);
  }

  function handleBrandPointerDown() {
    if (easterEggHoldRef.current) window.clearTimeout(easterEggHoldRef.current);
    easterEggHoldRef.current = window.setTimeout(() => {
      triggerEasterEgg();
      easterEggHoldRef.current = null;
    }, 700);
  }

  function cancelBrandPointerHold() {
    if (!easterEggHoldRef.current) return;
    window.clearTimeout(easterEggHoldRef.current);
    easterEggHoldRef.current = null;
  }

  const compactActions = [
    { icon: 'fa-regular fa-clock', label: '历史', onClick: onOpenHistory },
    { icon: 'fa-solid fa-screwdriver-wrench', label: '刀具库', onClick: onOpenTools },
    { icon: 'fa-solid fa-file-lines', label: '工艺单', onClick: onOpenSetupSheet },
    { icon: 'fa-solid fa-plus', label: '新建', onClick: onReset },
    {
      icon: 'fa-solid fa-circle-info',
      label: usesAboutSheet ? '关于' : '工作区信息',
      onClick: usesAboutSheet ? () => onOpenAbout?.() : () => setIsStatusOpen((current) => !current)
    }
  ];

  const quickStartActions = [
    {
      icon: 'fa-regular fa-pen-to-square',
      title: '描述需求',
      accent: false,
      onClick: () => setInputText('请根据我接下来的工件需求，生成加工工序和 G 代码。')
    },
    { icon: 'fa-solid fa-paperclip', title: '上传图纸', accent: false, onClick: () => fileInputRef.current?.click() },
    { icon: 'fa-solid fa-wand-magic', title: 'Demo', accent: true, onClick: onUseDemo }
  ];

  return (
    <div className="glass-panel relative flex h-full min-h-0 w-full flex-col overflow-hidden rounded-[2.05rem] border border-white/85 bg-[linear-gradient(180deg,rgba(255,255,255,0.975),rgba(255,255,255,0.94))] shadow-[0_16px_36px_-20px_rgba(31,38,135,0.1)] backdrop-blur-[48px]">
      <input ref={fileInputRef} type="file" accept="image/*,.pdf,.step,.stp,.dxf,.dwg,.zip" className="hidden" onChange={handleFileChange} />

      {hasConversation && shouldShowCompactChrome ? (
        <div className={`border-b border-white/60 ${isMobileConversationLayout ? 'px-3 py-2' : 'px-3 py-2.5 sm:px-5 sm:py-3.5 lg:px-6'}`}>
          <div className="flex items-center gap-2 overflow-x-auto pb-0.5">
            {onStartLiveSession ? (
              <button
                type="button"
                onClick={onStartLiveSession}
                title="打开语音模式"
                aria-label="打开语音模式"
                className={`inline-flex shrink-0 items-center justify-center rounded-full border border-sky-300/55 bg-gradient-to-br from-[#0a84ff] to-[#2563eb] text-sm font-semibold text-white shadow-[0_16px_32px_-24px_rgba(10,132,255,0.44)] ${isMobileConversationLayout ? 'h-9 w-9' : 'gap-2 h-10 px-3.5'}`}
              >
                <i className="fa-solid fa-microphone-lines text-xs" />
                {!isMobileConversationLayout ? <span>语音</span> : null}
              </button>
            ) : null}

            <div className={`inline-flex shrink-0 items-center rounded-[1.05rem] border border-white/90 bg-[linear-gradient(180deg,rgba(255,255,255,0.99),rgba(248,250,252,0.95))] shadow-[0_10px_24px_-20px_rgba(15,23,42,0.14)] backdrop-blur-[44px] ${isMobileConversationLayout ? 'gap-1 p-1' : 'gap-1.5 p-1.5'}`}>
              {compactActions.map((action) => (
                <button
                  key={action.label}
                  type="button"
                  onClick={action.onClick}
                  title={action.label}
                  aria-label={action.label}
                  className={`group inline-flex items-center justify-center rounded-[0.95rem] text-sm text-slate-500 transition-colors hover:bg-white hover:text-slate-900 ${isMobileConversationLayout ? 'h-[2.125rem] w-[2.125rem]' : 'h-9 w-9'}`}
                >
                  <span className={`flex items-center justify-center bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(241,245,249,0.88))] shadow-[inset_0_1px_1px_rgba(255,255,255,0.7),0_8px_16px_-12px_rgba(15,23,42,0.24)] ${isMobileConversationLayout ? 'h-[1.625rem] w-[1.625rem] rounded-[0.7rem]' : 'h-7 w-7 rounded-[0.8rem]'}`}>
                    <i className={`${action.icon} text-[11px]`} />
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      ) : null}

      <div className={`min-h-0 flex-1 overflow-y-auto overscroll-contain ${hasConversation ? (isMobileConversationLayout ? 'px-2.5 py-2.5' : 'px-3 py-3 sm:px-5 sm:py-5 lg:px-6') : (isMobileEmptyLayout ? 'px-3 py-3' : 'px-4 py-3 sm:px-5 sm:py-5 lg:px-6')}`}>
        {!hasConversation ? (
          <div className={`mx-auto w-full ${isMobileEmptyLayout ? 'max-w-none' : 'max-w-[430px]'}`}>
            <div className={`rounded-[1.7rem] border border-white/90 bg-[linear-gradient(180deg,rgba(255,255,255,0.99),rgba(248,250,252,0.95))] shadow-[0_18px_40px_-28px_rgba(15,23,42,0.14)] backdrop-blur-[48px] ${isMobileEmptyLayout ? 'p-3' : 'p-4 sm:rounded-[1.85rem] sm:p-5'}`}>
              <div className={`flex flex-col ${isMobileEmptyLayout ? 'gap-3' : 'gap-3'}`}>
                <div className={`flex items-start justify-between gap-3 ${isMobileEmptyLayout ? '' : 'sm:flex-row sm:items-start sm:justify-between'}`}>
                  <div className="flex min-w-0 items-center gap-3 select-none" onPointerDown={handleBrandPointerDown} onPointerUp={cancelBrandPointerHold} onPointerLeave={cancelBrandPointerHold} onPointerCancel={cancelBrandPointerHold}>
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[1.15rem] bg-[linear-gradient(135deg,#0a84ff,#7ab8ff)] text-white shadow-[0_14px_32px_-22px_rgba(10,132,255,0.6)]">
                      <i className="fa-solid fa-microchip text-lg" />
                    </div>
                    <div className="min-w-0 pr-1">
                      <div className={`font-semibold uppercase text-slate-400 ${isMobileEmptyLayout ? 'text-[10px] tracking-[0.18em]' : 'text-[11px] tracking-[0.24em]'}`}>AI CNC</div>
                      <h2 className={`max-w-full text-slate-900 ${isMobileEmptyLayout ? 'mt-1 text-[1.55rem] font-semibold leading-[1.05] tracking-[-0.03em]' : 'text-[1.85rem] font-semibold leading-none tracking-tight sm:text-[2rem]'}`}>LinguaCNC</h2>
                    </div>
                  </div>

                  {onStartLiveSession ? (
                    <button
                      type="button"
                      onClick={onStartLiveSession}
                      title="打开语音模式"
                      aria-label="打开语音模式"
                      className={`${isMobileEmptyLayout ? 'flex h-11 w-11 shrink-0 items-center justify-center rounded-full' : 'inline-flex h-11 w-full items-center justify-center gap-3 rounded-[1.15rem] px-4 text-left sm:w-auto sm:min-w-[180px] sm:justify-start'} border border-sky-300/55 bg-gradient-to-br from-[#0a84ff] to-[#2563eb] text-white shadow-[0_18px_36px_-24px_rgba(10,132,255,0.45)]`}
                    >
                      <span className={`flex items-center justify-center ${isMobileEmptyLayout ? 'h-9 w-9 rounded-full bg-white/12' : 'h-8 w-8 rounded-[0.95rem] bg-white/18'}`}>
                        <i className="fa-solid fa-microphone-lines text-sm" />
                      </span>
                      {!isMobileEmptyLayout ? (
                        <span className="min-w-0">
                          <span className="block text-[10px] font-semibold uppercase tracking-[0.18em] text-sky-100/95">VOICE</span>
                          <span className="block truncate text-sm font-semibold">语音模式</span>
                        </span>
                      ) : null}
                    </button>
                  ) : null}
                </div>

                {shouldShowCompactChrome ? (
                  <div className="flex items-center gap-2 overflow-x-auto pb-1">
                    <div className="inline-flex shrink-0 items-center gap-1.5 rounded-[1.15rem] border border-white/90 bg-[linear-gradient(180deg,rgba(255,255,255,0.99),rgba(248,250,252,0.95))] p-1.5 shadow-[0_10px_24px_-20px_rgba(15,23,42,0.14)] backdrop-blur-[44px]">
                      {compactActions.map((action) => (
                        <button key={action.label} type="button" onClick={action.onClick} title={action.label} aria-label={action.label} className="group inline-flex h-10 w-10 items-center justify-center rounded-[1rem] text-sm text-slate-500 transition-colors hover:bg-white hover:text-slate-900">
                          <span className="flex h-8 w-8 items-center justify-center rounded-[0.95rem] bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(241,245,249,0.88))] shadow-[inset_0_1px_1px_rgba(255,255,255,0.7),0_8px_16px_-12px_rgba(15,23,42,0.24)]">
                            <i className={`${action.icon} text-sm`} />
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                ) : null}

                {isMobileEmptyLayout ? (
                  <div className="pt-1">
                    <button
                      type="button"
                      onClick={onUseDemo}
                      className="mx-auto flex min-h-[58px] min-w-[156px] w-auto items-center justify-center gap-3 rounded-[1.25rem] border border-sky-300/60 bg-gradient-to-br from-[#0a84ff] to-[#2563eb] px-5 py-3 text-center text-sm font-semibold text-white shadow-[0_18px_36px_-22px_rgba(10,132,255,0.42)]"
                    >
                      <span className="flex h-9 w-9 items-center justify-center rounded-full bg-white/18">
                        <i className="fa-solid fa-wand-magic text-sm" />
                      </span>
                      <span>Demo</span>
                    </button>
                  </div>
                ) : (
                  <>
                    <div>
                      <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">Quick Start</div>
                      <h3 className="mt-2 text-[1.08rem] font-semibold tracking-tight text-slate-900 sm:text-[1.24rem]">描述、上传，或直接试跑</h3>
                      <p className="mt-1.5 text-sm leading-6 text-slate-500">保留最短开始路径，下面输入框就是主操作区。</p>
                    </div>

                    <div className="grid grid-cols-3 gap-2">
                      {quickStartActions.map((action) => (
                        <button key={action.title} type="button" onClick={action.onClick} className={`flex min-h-[66px] min-w-0 flex-col items-center justify-center gap-2 rounded-[1.1rem] border px-2 py-2.5 text-center text-[12px] font-medium transition-all ${action.accent ? 'border-sky-300/60 bg-gradient-to-br from-[#0a84ff] to-[#2563eb] text-white shadow-[0_16px_32px_-22px_rgba(10,132,255,0.42)]' : 'border-white/90 bg-[linear-gradient(180deg,rgba(255,255,255,0.99),rgba(248,250,252,0.96))] text-slate-700 shadow-[0_10px_24px_-20px_rgba(15,23,42,0.1)]'}`}>
                          <span className={`flex h-8 w-8 items-center justify-center rounded-full ${action.accent ? 'bg-white/18' : 'bg-slate-100'}`}>
                            <i className={`${action.icon} text-sm ${action.accent ? 'text-white' : 'text-slate-600'}`} />
                          </span>
                          <span className="leading-4">{action.title}</span>
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className={`${isMobileConversationLayout ? 'space-y-2.5' : 'space-y-3 sm:space-y-4'}`}>
            {messages.map((message) => {
              const isUser = message.role === 'user';
              const operationCount = message.cncResult?.operations.filter((operation) => operation.type !== MachineOperationType.GENERAL_CHAT).length || 0;

              return (
                <div key={message.id} className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
                  <div className={`rounded-[1.45rem] px-4 py-3 shadow-[0_10px_28px_-22px_rgba(15,23,42,0.12)] ${isMobileConversationLayout ? 'max-w-[98%]' : 'max-w-[95%] sm:max-w-[90%]'} ${isUser ? 'rounded-br-lg border border-slate-200/90 bg-[linear-gradient(180deg,rgba(255,255,255,0.99),rgba(248,250,252,0.96))] text-slate-900' : 'rounded-bl-lg border border-white/90 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(248,250,252,0.95))] text-slate-800'}`}>
                    <div className={`whitespace-pre-wrap text-[15px] ${isMobileConversationLayout ? 'leading-[1.65rem]' : 'leading-7'}`}>{message.text}</div>
                    {message.attachmentName ? <div className="mt-3 inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-100 px-3 py-1.5 text-xs text-slate-600"><i className="fa-solid fa-paperclip text-[10px]" />{message.attachmentName}</div> : null}
                    {message.meta?.providerLabel || operationCount > 0 ? <div className="mt-3.5 flex flex-wrap items-center gap-2">{message.meta?.providerLabel ? <span className="rounded-full bg-sky-50 px-3 py-1.5 text-[11px] font-medium text-sky-700">{message.meta.providerLabel}</span> : null}{operationCount > 0 ? <span className="rounded-full bg-slate-100 px-3 py-1.5 text-[11px] font-medium text-slate-600">共 {operationCount} 道工序</span> : null}</div> : null}
                  </div>
                </div>
              );
            })}

            {isProcessing ? <div className="flex justify-start"><div className="rounded-[1.45rem] rounded-bl-lg border border-white/90 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(248,250,252,0.95))] px-4 py-3 text-sm text-slate-600 shadow-[0_8px_22px_-18px_rgba(15,23,42,0.12)]">正在分析需求并生成工艺，请稍等…</div></div> : null}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      <div className={`border-t border-white/60 ${isMobileConversationLayout ? 'px-2.5 py-2.5' : hasConversation ? 'px-3 py-2.5 sm:px-5 sm:py-3.5 lg:px-6' : 'px-4 py-3 sm:px-5 sm:py-4 lg:px-6'}`}>
        <div className={`mb-2 flex flex-col gap-2 ${isMobileConversationLayout ? '' : 'sm:flex-row sm:flex-wrap sm:items-center sm:justify-between'}`}>
          <div className="inline-flex items-center rounded-full border border-white/90 bg-[linear-gradient(180deg,rgba(255,255,255,0.99),rgba(248,250,252,0.95))] p-0.5 shadow-[0_8px_20px_-18px_rgba(15,23,42,0.12)] backdrop-blur-[44px]">
            {(['GENERATE', 'OPTIMIZE'] as PrimaryAppMode[]).map((item) => {
              const active = mode === item;

              return (
                <button key={item} type="button" onClick={() => onModeChange(item)} className={`relative rounded-full text-[12px] font-medium transition-colors ${isMobileConversationLayout ? 'px-3 py-1.5' : 'px-3.5 py-1.5'} ${active ? 'text-slate-900' : 'text-slate-500'}`}>
                  {active ? <motion.span layoutId="mode-pill" className="absolute inset-0 rounded-full bg-white shadow-[0_10px_20px_-18px_rgba(15,23,42,0.18)]" transition={{ type: 'spring', stiffness: 360, damping: 32 }} /> : null}
                  <span className="relative flex items-center gap-2"><i className={`fa-solid ${item === 'GENERATE' ? 'fa-wand-magic' : 'fa-sliders'} text-[11px]`} /><span>{item === 'GENERATE' ? '生成' : '优化'}</span></span>
                </button>
              );
            })}
          </div>

          <button type="button" onClick={() => setIsModelPickerOpen(true)} className={`inline-flex items-center gap-2 rounded-full border border-white/90 bg-[linear-gradient(180deg,rgba(255,255,255,0.99),rgba(248,250,252,0.95))] px-3 text-sm font-medium text-slate-600 shadow-[0_8px_20px_-18px_rgba(15,23,42,0.12)] backdrop-blur-[44px] ${isMobileConversationLayout ? 'h-9 w-full justify-between' : 'h-9 w-full justify-between sm:w-auto sm:min-w-[220px]'}`}>
            <span className="flex min-w-0 items-center gap-2"><i className="fa-solid fa-sliders text-[10px]" /><span className="truncate">{currentModel.label}</span></span>
            <i className="fa-solid fa-chevron-down text-[10px] text-slate-400" />
          </button>
        </div>

        <AnimatePresence>
          {attachment ? (
            <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 4 }} className="mb-2 flex items-center justify-between gap-3 rounded-[1.1rem] border border-white/90 bg-[linear-gradient(180deg,rgba(255,255,255,0.99),rgba(248,250,252,0.96))] px-3 py-2 shadow-[0_10px_24px_-20px_rgba(15,23,42,0.1)]">
              <div className="min-w-0">
                <div className="truncate text-sm font-medium text-slate-700">{attachment.fileName}</div>
                <div className="text-[11px] text-slate-400">{attachment.mimeType}</div>
              </div>
              <button type="button" onClick={clearAttachment} className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-500">
                <i className="fa-solid fa-xmark text-xs" />
              </button>
            </motion.div>
          ) : null}
        </AnimatePresence>

        <div className="flex items-end gap-2">
          <button type="button" onClick={() => fileInputRef.current?.click()} title="上传附件" aria-label="上传附件" className={`flex shrink-0 items-center justify-center rounded-[1.15rem] border border-white/90 bg-[linear-gradient(180deg,rgba(255,255,255,0.99),rgba(248,250,252,0.96))] text-slate-500 shadow-[0_12px_24px_-20px_rgba(15,23,42,0.12)] transition-colors hover:bg-white hover:text-slate-900 ${isMobileConversationLayout ? 'h-11 w-11' : 'h-12 w-12'}`}>
            <i className="fa-solid fa-plus" />
          </button>

          <div className="flex min-w-0 flex-1 items-end gap-3 rounded-[1.4rem] border border-white/90 bg-[linear-gradient(180deg,rgba(255,255,255,0.99),rgba(248,250,252,0.96))] px-4 py-3 shadow-[0_14px_30px_-20px_rgba(15,23,42,0.12)] backdrop-blur-[44px]">
            <textarea
              ref={textareaRef}
              value={inputText}
              onChange={(event) => setInputText(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && !event.shiftKey) {
                  event.preventDefault();
                  handleSend();
                }
              }}
              rows={1}
              placeholder={hasConversation ? '继续描述下一步，或上传图纸。' : '描述工件需求，或上传图纸让我开始。'}
              className="max-h-[150px] min-h-[24px] flex-1 resize-none border-0 bg-transparent p-0 text-[15px] leading-7 text-slate-800 outline-none placeholder:text-slate-400"
            />

            <button type="button" onClick={isProcessing ? onStop : handleSend} disabled={!isProcessing && !inputText.trim() && !attachment} className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-white shadow-[0_16px_32px_-22px_rgba(10,132,255,0.45)] transition-all ${isProcessing ? 'bg-gradient-to-br from-rose-500 to-rose-600' : inputText.trim() || attachment ? 'bg-gradient-to-br from-[#0a84ff] to-[#2563eb]' : 'bg-slate-200 text-slate-400 shadow-none'}`}>
              <i className={`fa-solid ${isProcessing ? 'fa-stop' : 'fa-arrow-up'} text-sm`} />
            </button>
          </div>
        </div>
      </div>

      {!usesAboutSheet ? (
        <AnimatePresence>
          {isStatusOpen ? (
            <motion.div ref={statusLayerRef} initial={{ opacity: 0, y: 10, scale: 0.985 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 8, scale: 0.985 }} transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }} className="absolute right-3 top-20 z-30 w-[min(88vw,280px)] rounded-[1.3rem] border border-white/90 bg-[linear-gradient(180deg,rgba(255,255,255,0.99),rgba(248,250,252,0.97))] p-3 shadow-[0_22px_38px_-24px_rgba(15,23,42,0.22)] backdrop-blur-[44px] sm:right-5">
              <div className="grid grid-cols-2 gap-2">
                {statusItems.map((item) => (
                  <div key={item.label} className="rounded-[1rem] border border-white/90 bg-white/90 px-3 py-2.5">
                    <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">{item.label}</div>
                    <div className="mt-1 text-sm font-medium text-slate-700">{item.value}</div>
                  </div>
                ))}
              </div>
            </motion.div>
          ) : null}
        </AnimatePresence>
      ) : null}

      <AnimatePresence>
        {isModelPickerOpen ? (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 z-40 bg-slate-900/18 backdrop-blur-[8px]" onClick={() => setIsModelPickerOpen(false)} />
            <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 18 }} transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }} className="absolute inset-x-3 bottom-3 z-50 rounded-[1.6rem] border border-white/90 bg-[linear-gradient(180deg,rgba(255,255,255,0.985),rgba(248,250,252,0.96))] p-3 shadow-[0_24px_56px_-28px_rgba(15,23,42,0.22)] backdrop-blur-[52px] sm:inset-x-auto sm:right-5 sm:top-[calc(100%-15.5rem)] sm:w-[320px] sm:bottom-auto">
              <div className="mb-2 flex items-center justify-between px-1">
                <div>
                  <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Model</div>
                  <div className="mt-1 text-lg font-semibold tracking-tight text-slate-900">选择模型</div>
                </div>
                <button type="button" onClick={() => setIsModelPickerOpen(false)} className="flex h-9 w-9 items-center justify-center rounded-full bg-white/90 text-slate-400 transition-colors hover:text-slate-700">
                  <i className="fa-solid fa-xmark" />
                </button>
              </div>

              <div className="mt-2 space-y-2">
                {MODEL_OPTIONS.map((option) => {
                  const active = option.value === model;

                  return (
                    <button key={option.value} type="button" onClick={() => handleModelSelect(option.value)} className={`flex w-full items-start gap-3 rounded-[1.15rem] border px-3 py-3 text-left transition-all ${active ? 'border-sky-200 bg-sky-50/90 shadow-[0_14px_28px_-24px_rgba(10,132,255,0.28)]' : 'border-white/90 bg-white/92 hover:border-slate-200 hover:bg-white'}`}>
                      <span className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${active ? 'border-sky-400 bg-sky-500 text-white' : 'border-slate-300 bg-white text-transparent'}`}>
                        <i className="fa-solid fa-check text-[10px]" />
                      </span>
                      <span className="min-w-0">
                        <span className="block text-sm font-semibold text-slate-900">{option.label}</span>
                        <span className="mt-1 block text-xs leading-5 text-slate-500">{option.description}</span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </motion.div>
          </>
        ) : null}
      </AnimatePresence>

      <AnimatePresence>
        {isEasterEggOpen ? (
          <motion.div initial={{ opacity: 0, scale: 0.985 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.99 }} transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }} className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(10,132,255,0.16),transparent_34%),radial-gradient(circle_at_80%_18%,rgba(255,55,95,0.14),transparent_30%),radial-gradient(circle_at_50%_80%,rgba(48,209,88,0.14),transparent_34%)]" />
            <div className="relative rounded-[1.5rem] border border-white/85 bg-[linear-gradient(180deg,rgba(255,255,255,0.76),rgba(255,255,255,0.62))] px-5 py-4 text-center shadow-[0_22px_48px_-26px_rgba(15,23,42,0.18)] backdrop-blur-[40px]">
              <div className="text-[11px] font-semibold uppercase tracking-[0.28em] text-slate-400">Secret</div>
              <div className="mt-2 text-lg font-semibold tracking-tight text-slate-900">你发现了 LinguaCNC 的星云角落</div>
              <div className="mt-1 text-sm text-slate-500">优雅一点，刀路也会更温柔。</div>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
};

export default ChatPanel;
