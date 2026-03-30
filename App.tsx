import React, { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { AnimatePresence, motion } from 'framer-motion';

import ChatPanel from './components/ChatPanel';
import CodePanel from './components/CodePanel';
import HistoryDrawer from './components/HistoryDrawer';
import LiveSession from './components/LiveSession';
import SetupSheet, { SetupSheetContent } from './components/SetupSheet';
import SimulationPanel from './components/SimulationPanel';
import ToolLibrary from './components/ToolLibrary';
import { bootstrapNativePermissions } from './services/nativePermissionService';
import { hasNativeIOSShell, postNativeShellMessage } from './services/nativeRuntimeService';
import {
  buildSessionFromState,
  createTool,
  deleteTool,
  getSession,
  listSessionSummaries,
  loadWorkspace,
  removeSession,
  savePreferences as saveLocalPreferences,
  saveSession as saveLocalSession,
  updateTool
} from './services/localWorkspaceService';
import { auditCode, analyzeRequest, Attachment, listProviderStatuses } from './services/modelService';
import { generateCNCCode } from './services/cncGenerator';
import { parseGCodeToPath } from './services/gcodeParser';
import {
  AppMode,
  ChatMessage,
  CNCOutput,
  MachineOperationType,
  ModelOption,
  OperationParams,
  PrimaryAppMode,
  ProviderKey,
  SessionSummary,
  StockDimensions,
  SyncState,
  Tool,
  ToolType
} from './types';

type StageView = 'sim' | 'code';
type MobileView = 'task' | 'sim' | 'code' | 'setup';

const DEFAULT_STOCK: StockDimensions = {
  shape: 'RECTANGULAR',
  width: 100,
  length: 100,
  height: 20,
  diameter: 0,
  material: '铝合金'
};

const DEMO_PROMPT = '请帮我在 100x100x20 的铝板中心铣一个直径 50mm、深度 5mm 的圆形型腔，并给出合适的刀具、工序和 G 代码。';

const desktopStageTabs: Array<{ key: StageView; label: string; icon: string }> = [
  { key: 'sim', label: '3D 仿真', icon: 'fa-cube' },
  { key: 'code', label: 'G 代码', icon: 'fa-code' }
];

const mobileTabs: Array<{ key: MobileView; label: string; icon: string }> = [
  { key: 'task', label: '\u5bf9\u8bdd', icon: 'fa-comments' },
  { key: 'sim', label: '\u4eff\u771f', icon: 'fa-cube' },
  { key: 'code', label: '\u4ee3\u7801', icon: 'fa-shield-halved' },
  { key: 'setup', label: '\u5de5\u827a\u5355', icon: 'fa-file-lines' }
];

function createSessionTitle(messages: ChatMessage[]) {
  const firstUserMessage = messages.find((message) => message.role === 'user');
  if (!firstUserMessage?.text) {
    return '未命名任务';
  }

  return firstUserMessage.text.length > 24 ? `${firstUserMessage.text.slice(0, 24)}...` : firstUserMessage.text;
}

function safeOperation(rawOperation: unknown): OperationParams {
  return {
    type: MachineOperationType.GENERAL_CHAT,
    x: 0,
    y: 0,
    z_start: 0,
    z_depth: 0,
    feed_rate: 0,
    spindle_speed: 0,
    tool_diameter: 0,
    tool_type: ToolType.END_MILL,
    step_down: 0,
    ...(typeof rawOperation === 'object' && rawOperation ? rawOperation : {})
  };
}

function upsertSummary(collection: SessionSummary[], summary: SessionSummary) {
  return [summary, ...collection.filter((item) => item.id !== summary.id)].sort((left, right) => right.timestamp - left.timestamp);
}

function formatSavedTime(value: number | null) {
  if (!value) {
    return '尚未保存';
  }
  return new Date(value).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
}

function summarizeUiError(message: string) {
  if (/(429|quota|rate.?limit|resource_exhausted|quotaMetric|quotaId|generativelanguage)/i.test(message)) {
    return 'Gemini 当前配额不足，请稍后重试或切换模型。';
  }
  if (/(network|fetch|timeout|连接|failed to fetch|econn|socket)/i.test(message)) {
    return '请求失败，请检查网络后重试。';
  }
  return '请求失败，请稍后再试。';
}

const stageTransition = {
  initial: { opacity: 0, y: 18, scale: 0.985, filter: 'blur(10px)' },
  animate: { opacity: 1, y: 0, scale: 1, filter: 'blur(0px)' },
  exit: { opacity: 0, y: -14, scale: 0.992, filter: 'blur(8px)' },
  transition: { duration: 0.38, ease: [0.22, 1, 0.36, 1] as const }
};

const App: React.FC = () => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [operations, setOperations] = useState<OperationParams[]>([]);
  const [currentStock, setCurrentStock] = useState<StockDimensions>(DEFAULT_STOCK);
  const [cncData, setCncData] = useState<CNCOutput | null>(null);
  const [tools, setTools] = useState<Tool[]>([]);
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [mode, setMode] = useState<PrimaryAppMode>('GENERATE');
  const [model, setModel] = useState<ModelOption>('auto');
  const [stageView, setStageView] = useState<StageView>('sim');
  const [mobileView, setMobileView] = useState<MobileView>('task');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isAuditing, setIsAuditing] = useState(false);
  const [customPath, setCustomPath] = useState<THREE.CurvePath<THREE.Vector3> | null>(null);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [isToolLibraryOpen, setIsToolLibraryOpen] = useState(false);
  const [isSetupSheetOpen, setIsSetupSheetOpen] = useState(false);
  const [isLiveSessionOpen, setIsLiveSessionOpen] = useState(false);
  const [syncState, setSyncState] = useState<SyncState>('idle');
  const [lastSavedAt, setLastSavedAt] = useState<number | null>(null);
  const [lastAuditedAt, setLastAuditedAt] = useState<number | null>(null);
  const [activeProviderKey, setActiveProviderKey] = useState<ProviderKey | 'system' | undefined>();
  const [activeProviderLabel, setActiveProviderLabel] = useState('Gemini');
  const [loadError, setLoadError] = useState('');
  const [isReady, setIsReady] = useState(false);
  const [isStageInfoOpen, setIsStageInfoOpen] = useState(false);
  const [isAboutSheetOpen, setIsAboutSheetOpen] = useState(false);
  const [isSplashVisible, setIsSplashVisible] = useState(true);
  const [pendingDeleteOperationIndex, setPendingDeleteOperationIndex] = useState<number | null>(null);
  const [isNativeIOSShellEnabled, setIsNativeIOSShellEnabled] = useState(() => hasNativeIOSShell());

  const saveTimerRef = useRef<number | null>(null);
  const auditTimerRef = useRef<number | null>(null);
  const preferencesTimerRef = useRef<number | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const desktopStageInfoRef = useRef<HTMLDivElement | null>(null);
  const mobileStageInfoRef = useRef<HTMLDivElement | null>(null);
  const loadErrorTimerRef = useRef<number | null>(null);

  const providers = useMemo(() => listProviderStatuses(), []);
  const providerMap = useMemo(() => new Map(providers.map((provider) => [provider.key, provider.label])), [providers]);
  const latestCncResult = useMemo(() => [...messages].reverse().find((message) => message.cncResult)?.cncResult ?? null, [messages]);
  const effectiveCncData = cncData ?? latestCncResult;
  const effectiveOperations = operations.length ? operations : effectiveCncData?.operations ?? [];
  const effectiveStock = cncData?.stock ?? effectiveCncData?.stock ?? currentStock;
  const effectiveCustomPath = useMemo(() => {
    if (customPath) {
      return customPath;
    }
    if (effectiveCncData?.gcode && !effectiveCncData.isScreen) {
      return parseGCodeToPath(effectiveCncData.gcode);
    }
    return null;
  }, [customPath, effectiveCncData]);
  const liveAvailable = providers.find((provider) => provider.key === 'gemini')?.enabled ?? false;
  const hasMobileConversation = messages.length > 0;
  const showMobileCompactHeader = !isNativeIOSShellEnabled && mobileView !== 'task';
  const mobileContentBottomPadding = isNativeIOSShellEnabled
    ? 'calc(env(safe-area-inset-bottom) + 7.35rem)'
    : hasMobileConversation
      ? 'calc(env(safe-area-inset-bottom) + 5.45rem)'
      : 'calc(env(safe-area-inset-bottom) + 6.9rem)';
  const pendingDeleteOperation = pendingDeleteOperationIndex != null ? effectiveOperations[pendingDeleteOperationIndex] : null;
  const mobileWorkspaceMeta =
    mobileView === 'sim'
      ? {
          title: '3D 仿真',
          subtitle: '刀路、扣料与机床视角',
          icon: 'fa-cube',
          accentClass: 'from-sky-500 to-blue-600'
        }
      : mobileView === 'code'
        ? {
            title: 'G 代码',
            subtitle: '编辑、复核与导出程序',
            icon: 'fa-code',
            accentClass: 'from-slate-800 to-slate-600'
          }
        : {
            title: '加工工艺单',
            subtitle: '整理毛坯、工序与安全状态',
            icon: 'fa-file-lines',
            accentClass: 'from-emerald-500 to-teal-600'
          };

  useEffect(() => {
    void bootstrapNativePermissions();
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => setIsSplashVisible(false), 1350);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    const handleNativeShellAvailability = () => setIsNativeIOSShellEnabled(hasNativeIOSShell());
    const handleNativeNavigate = (event: Event) => {
      const nextView = (event as CustomEvent<{ view?: MobileView }>).detail?.view;
      if (!nextView) return;
      setMobileView(nextView);
    };
    const handleNativeHistory = () => setIsHistoryOpen(true);
    const handleNativeAbout = () => setIsAboutSheetOpen(true);
    const handleNativeSetup = () => setMobileView('setup');
    const handleNativeReset = () => handleReset();

    window.addEventListener('linguacnc:native-shell-availability', handleNativeShellAvailability);
    window.addEventListener('linguacnc:navigate', handleNativeNavigate as EventListener);
    window.addEventListener('linguacnc:open-history', handleNativeHistory);
    window.addEventListener('linguacnc:open-about', handleNativeAbout);
    window.addEventListener('linguacnc:open-setup', handleNativeSetup);
    window.addEventListener('linguacnc:reset', handleNativeReset);

    handleNativeShellAvailability();

    return () => {
      window.removeEventListener('linguacnc:native-shell-availability', handleNativeShellAvailability);
      window.removeEventListener('linguacnc:navigate', handleNativeNavigate as EventListener);
      window.removeEventListener('linguacnc:open-history', handleNativeHistory);
      window.removeEventListener('linguacnc:open-about', handleNativeAbout);
      window.removeEventListener('linguacnc:open-setup', handleNativeSetup);
      window.removeEventListener('linguacnc:reset', handleNativeReset);
    };
  }, []);

  useEffect(() => {
    const workspace = loadWorkspace();
    setTools(workspace.tools);
    setSessions(workspace.summaries);
    setModel(workspace.preferences.defaultModel);
    setMode(workspace.preferences.defaultMode);
    setIsReady(true);

    return () => {
      if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);
      if (auditTimerRef.current) window.clearTimeout(auditTimerRef.current);
      if (preferencesTimerRef.current) window.clearTimeout(preferencesTimerRef.current);
      if (loadErrorTimerRef.current) window.clearTimeout(loadErrorTimerRef.current);
      abortControllerRef.current?.abort();
    };
  }, []);

  useEffect(() => {
    if (!loadError) {
      return;
    }
    if (loadErrorTimerRef.current) {
      window.clearTimeout(loadErrorTimerRef.current);
    }
    loadErrorTimerRef.current = window.setTimeout(() => setLoadError(''), 4200);
    return () => {
      if (loadErrorTimerRef.current) {
        window.clearTimeout(loadErrorTimerRef.current);
      }
    };
  }, [loadError]);

  useEffect(() => {
    if (!isReady) return;
    if (preferencesTimerRef.current) window.clearTimeout(preferencesTimerRef.current);
    preferencesTimerRef.current = window.setTimeout(() => {
      saveLocalPreferences({ defaultModel: model, defaultMode: mode });
    }, 250);
  }, [isReady, mode, model]);

  useEffect(() => {
    if (!isReady || messages.length === 0) return;
    if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);
    setSyncState('saving');
    saveTimerRef.current = window.setTimeout(() => {
      persistSession();
    }, 360);
  }, [isReady, messages, cncData, operations, currentStock, mode, activeProviderKey]);

  useEffect(() => {
    if (!isNativeIOSShellEnabled) {
      return;
    }

    postNativeShellMessage({
      type: 'viewChange',
      view: mobileView,
      hasConversation: messages.length > 0
    });
  }, [isNativeIOSShellEnabled, messages.length, mobileView]);

  useEffect(() => {
    if (!isStageInfoOpen) return;
    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node | null;
      const clickedDesktop = desktopStageInfoRef.current && target && desktopStageInfoRef.current.contains(target);
      const clickedMobile = mobileStageInfoRef.current && target && mobileStageInfoRef.current.contains(target);
      if (!clickedDesktop && !clickedMobile) {
        setIsStageInfoOpen(false);
      }
    };
    document.addEventListener('pointerdown', handlePointerDown);
    return () => document.removeEventListener('pointerdown', handlePointerDown);
  }, [isStageInfoOpen]);

  useEffect(() => {
    if (cncData || !latestCncResult) {
      return;
    }

    setCncData(latestCncResult);
    setOperations(latestCncResult.operations);
    setCurrentStock(latestCncResult.stock);
    if (latestCncResult.gcode && !latestCncResult.isScreen) {
      setCustomPath(parseGCodeToPath(latestCncResult.gcode));
    }
  }, [cncData, latestCncResult]);

  function persistSession() {
    try {
      const payload = buildSessionFromState({
        id: currentSessionId,
        title: createSessionTitle(messages),
        messages,
        cncData: effectiveCncData,
        operations: effectiveOperations,
        stock: effectiveStock,
        mode,
        provider: activeProviderKey
      });
      const saved = saveLocalSession(payload);
      setCurrentSessionId(saved.session.id);
      setSessions((current) => upsertSummary(current, saved.summary));
      setLastSavedAt(saved.savedAt);
      setSyncState('saved');
    } catch (error) {
      console.error('保存会话失败', error);
      setSyncState('error');
    }
  }

  function handleReset() {
    setMessages([]);
    setOperations([]);
    setCurrentStock(DEFAULT_STOCK);
    setCncData(null);
    setCurrentSessionId(null);
    setCustomPath(null);
    setSyncState('idle');
    setLastSavedAt(null);
    setLastAuditedAt(null);
    setActiveProviderKey(undefined);
    setActiveProviderLabel('Gemini');
    setStageView('sim');
    setMobileView('task');
    setLoadError('');
    setIsAboutSheetOpen(false);
    setIsStageInfoOpen(false);
    setPendingDeleteOperationIndex(null);
  }

  async function handleLoadSession(id: string) {
    const session = getSession(id);
    if (!session) {
      setLoadError('没有找到这条历史任务。');
      return;
    }
    setPendingDeleteOperationIndex(null);
    setCurrentSessionId(session.id);
    setMessages(session.messages);
    setOperations(session.operations);
    setCurrentStock(session.stock);
    setCncData(session.cncData);
    setMode(session.mode || 'GENERATE');
    setActiveProviderKey(session.provider);
    setActiveProviderLabel(session.provider ? providerMap.get(session.provider as ProviderKey) || 'AI 助手' : 'AI 助手');
    setLastSavedAt(session.lastSavedAt || session.timestamp);
    setLastAuditedAt(session.cncData?.audit ? session.lastSavedAt || session.timestamp : null);
    setCustomPath(session.cncData?.gcode ? parseGCodeToPath(session.cncData.gcode) : null);
    setStageView('sim');
    setMobileView('task');
    setIsHistoryOpen(false);
  }

  function handleDeleteSession(id: string) {
    removeSession(id);
    setSessions(listSessionSummaries());
    if (currentSessionId === id) handleReset();
  }

  function handleStopGeneration() {
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
    setIsProcessing(false);
  }

  async function requestAudit(nextCode: string) {
    if (!nextCode.trim()) return;
    setIsAuditing(true);
    try {
      const payload = await auditCode(nextCode);
      setLastAuditedAt(payload.auditedAt);
      setCncData((current) => (current ? { ...current, gcode: nextCode, audit: payload.result } : current));
    } catch (error) {
      console.error('安全检查失败', error);
      setLoadError(summarizeUiError(error instanceof Error ? error.message : '安全检查失败。'));
    } finally {
      setIsAuditing(false);
    }
  }

  function handleCodeEdit(nextCode: string) {
    setCncData((current) => (current ? { ...current, gcode: nextCode } : current));
    setCustomPath(parseGCodeToPath(nextCode));
    if (auditTimerRef.current) window.clearTimeout(auditTimerRef.current);
    auditTimerRef.current = window.setTimeout(() => void requestAudit(nextCode), 800);
  }

  function handleDeleteOperation(index: number) {
    if (index < 0 || index >= effectiveOperations.length) return;
    setPendingDeleteOperationIndex(index);
  }

  function confirmDeleteOperation() {
    if (pendingDeleteOperationIndex == null || pendingDeleteOperationIndex < 0 || pendingDeleteOperationIndex >= effectiveOperations.length) {
      setPendingDeleteOperationIndex(null);
      return;
    }

    const deleteIndex = pendingDeleteOperationIndex;
    setPendingDeleteOperationIndex(null);
    const nextOperations = effectiveOperations.filter((_, operationIndex) => operationIndex !== deleteIndex);
    setOperations(nextOperations);
    if (!nextOperations.length) {
      setCncData(null);
      setCustomPath(null);
      return;
    }

    const nextResult = generateCNCCode(effectiveStock, nextOperations, effectiveCncData?.explanation || '已删除一道工序。');
    setCncData(nextResult);
    setCustomPath(parseGCodeToPath(nextResult.gcode));
    void requestAudit(nextResult.gcode);
  }

  function handleCreateTool(tool: Tool) {
    const created = createTool(tool);
    setTools((current) => [...current.filter((item) => item.id !== created.id), created].sort((left, right) => left.id.localeCompare(right.id)));
  }

  function handleUpdateTool(tool: Tool) {
    const updated = updateTool(tool);
    setTools((current) => current.map((item) => (item.id === updated.id ? updated : item)));
  }

  function handleDeleteTool(id: string) {
    deleteTool(id);
    setTools((current) => current.filter((tool) => tool.id !== id));
  }

  async function handleSendMessage(text: string, attachment: Attachment | null, selectedModel: ModelOption, selectedMode: PrimaryAppMode) {
    setIsProcessing(true);
    setLoadError('');

    const controller = new AbortController();
    abortControllerRef.current = controller;

    const userMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      text: text || (attachment ? `已上传附件：${attachment.fileName}` : '提交了一条空白请求。'),
      attachmentName: attachment?.fileName,
      meta: { mode: selectedMode as AppMode, timestamp: Date.now() }
    };

    const requestHistory = [...messages, userMessage];
    setMessages(requestHistory);

    try {
      const payload = await analyzeRequest(text, attachment, selectedModel, selectedMode, controller.signal, tools, requestHistory, operations);
      const analysis = payload.analysis;
      const explanation = analysis.explanation || '已生成新的加工建议。';
      const operation = safeOperation(analysis.operation);
      const rawStock = analysis.stock || currentStock;

      let nextOperations = operations;
      let nextResult: CNCOutput | null = null;

      if (selectedMode === 'OPTIMIZE' && analysis.optimized_gcode) {
        nextResult = {
          gcode: analysis.optimized_gcode,
          explanation,
          operations: operations.length ? operations : [operation],
          stock: rawStock
        };
        setCurrentStock(rawStock);
      } else if (analysis.screen_code) {
        const screenOperation: OperationParams = { ...operation, type: MachineOperationType.RUN_MYSCREEN };
        nextOperations = operations.length ? operations : [screenOperation];
        nextResult = {
          gcode: analysis.screen_code,
          explanation,
          operations: nextOperations,
          stock: rawStock,
          isScreen: true
        };
      } else if (operation.type === MachineOperationType.GENERAL_CHAT) {
        nextResult =
          cncData ||
          {
            gcode: '',
            explanation,
            operations,
            stock: currentStock
          };
      } else {
        const stockResetRequested = /(毛坯|材料|尺寸|stock|material|blank|size|原料|板材)/i.test(text);
        const effectiveStock = operations.length > 0 && !stockResetRequested ? currentStock : rawStock;
        nextOperations = [...operations, operation];
        nextResult = generateCNCCode(effectiveStock, nextOperations, explanation);
        setCurrentStock(effectiveStock);
        setOperations(nextOperations);
      }

      if (nextResult && nextResult.gcode && !nextResult.isScreen) {
        const auditPayload = await auditCode(nextResult.gcode);
        nextResult = { ...nextResult, audit: auditPayload.result };
        setLastAuditedAt(auditPayload.auditedAt);
        setCustomPath(parseGCodeToPath(nextResult.gcode));
      } else {
        setCustomPath(null);
      }

      setCncData(nextResult);
      setActiveProviderKey(payload.provider);
      setActiveProviderLabel(payload.providerLabel);
      setStageView('sim');
      setMobileView('task');

      const aiMessage: ChatMessage = {
        id: crypto.randomUUID(),
        role: 'ai',
        text: explanation,
        cncResult: nextResult || undefined,
        meta: {
          provider: payload.provider,
          providerLabel: payload.providerLabel,
          latencyMs: payload.latencyMs,
          mode: selectedMode as AppMode,
          timestamp: Date.now()
        }
      };

      setMessages((current) => [...current, aiMessage]);
    } catch (error) {
      if ((error as Error).name === 'AbortError') {
        return;
      }

      console.error('AI 请求失败', error);
      const message = error instanceof Error ? error.message : 'AI 请求失败。';
      setLoadError(summarizeUiError(message));
    } finally {
      if (abortControllerRef.current === controller) {
        abortControllerRef.current = null;
      }
      setIsProcessing(false);
    }
  }

  const stageInfoItems = [
    {
      icon: 'fa-cube',
      label: '毛坯',
      value:
        effectiveStock.shape === 'CYLINDRICAL'
          ? `D ${effectiveStock.diameter} x ${effectiveStock.height}`
          : `${effectiveStock.length} x ${effectiveStock.width} x ${effectiveStock.height}`
    },
    {
      icon: 'fa-gears',
      label: '工序',
      value: `${effectiveOperations.filter((item) => item.type !== MachineOperationType.GENERAL_CHAT).length} 道`
    },
    {
      icon: 'fa-shield-halved',
      label: '安全',
      value: effectiveCncData?.audit ? `${effectiveCncData.audit.score} / 100` : '待检查'
    },
    {
      icon: 'fa-floppy-disk',
      label: '保存',
      value: `${syncState === 'saving' ? '保存中' : syncState === 'saved' ? '已保存' : syncState === 'error' ? '异常' : '待开始'} · ${formatSavedTime(lastSavedAt)}`
    },
    {
      icon: 'fa-microphone-lines',
      label: '语音',
      value: liveAvailable ? '可用' : '待配置'
    }
  ];

  const aboutSections = [
    {
      title: '灵语智造是什么',
      body: '它把对话、工艺规划、G 代码、安全审查和 3D 仿真收在一个界面里，让你可以从一句需求直接走到可执行的加工结果。'
    },
    {
      title: '怎么开始最快',
      body: '你可以直接描述需求、上传图纸，或者打开语音模式。发送过一次对话后，任务页会自动切成紧凑工作态，把聊天区让出来。'
    },
    {
      title: '四个主入口做什么',
      body: '对话负责需求和迭代，仿真查看刀路与扣料，代码用于检查和修改 G 代码，工艺单用于整理最终加工方案。'
    }
  ];

  const renderStageInfoPopover = () => (
    <AnimatePresence>
      {isStageInfoOpen && (
        <motion.div
          initial={{ opacity: 0, y: 8, scale: 0.985 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 6, scale: 0.985 }}
          transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
          className="liquid-glass-panel liquid-glass-panel-soft fixed left-3 right-3 top-[calc(env(safe-area-inset-top)+4.75rem)] z-[85] max-h-[46vh] overflow-y-auto rounded-[1.45rem] p-3 sm:absolute sm:left-auto sm:right-0 sm:top-[calc(100%+0.75rem)] sm:max-h-none sm:w-[min(80vw,300px)] sm:overflow-visible"
        >
          <div className="grid grid-cols-2 gap-2">
            {stageInfoItems.map((item) => (
              <div key={item.label} className="liquid-glass-pill rounded-[1rem] px-3 py-2.5">
                <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                  <i className={`fa-solid ${item.icon}`} />
                  <span>{item.label}</span>
                </div>
                <div className="mt-1 text-sm font-medium text-slate-700">{item.value}</div>
              </div>
            ))}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );

  const stageComponent =
    stageView === 'code' ? (
      <CodePanel
        data={effectiveCncData}
        onCodeChange={handleCodeEdit}
        onDeleteOperation={handleDeleteOperation}
        onAuditRequest={requestAudit}
        isAuditing={isAuditing}
        lastAuditedAt={lastAuditedAt}
        isMobile={false}
      />
    ) : (
      <SimulationPanel data={effectiveCncData} customPath={effectiveCustomPath} />
    );

  return (
    <div className="ios-shell fixed inset-0 overflow-hidden text-slate-900">
      <div className="ios-ambient-orb ios-ambient-orb--blue left-[5%] top-[8%] h-60 w-60" />
      <div className="ios-ambient-orb ios-ambient-orb--rose right-[7%] top-[12%] h-48 w-48 [animation-delay:-4s]" />
      <div className="ios-ambient-orb ios-ambient-orb--mint bottom-[10%] left-[16%] h-52 w-52 [animation-delay:-7s]" />
      <div className="ios-ambient-orb ios-ambient-orb--amber bottom-[7%] right-[9%] h-60 w-60 [animation-delay:-10s]" />

      <AnimatePresence>
        {loadError && (
          <div className="pointer-events-none fixed inset-x-0 z-[90] flex justify-center px-3" style={{ bottom: 'max(1rem, calc(env(safe-area-inset-bottom) + 6.25rem))' }}>
            <motion.div
              initial={{ opacity: 0, y: 12, scale: 0.985 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.99 }}
              transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
              className="liquid-glass-panel pointer-events-auto flex w-full max-w-[420px] items-start gap-3 rounded-[1.5rem] border-amber-200/80 px-4 py-3 text-sm text-slate-600"
            >
              <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-amber-50 text-amber-500">
                <i className="fa-solid fa-exclamation text-xs" />
              </span>
              <div className="min-w-0 flex-1 leading-6">{loadError}</div>
              <button type="button" onClick={() => setLoadError('')} className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-slate-400 transition-colors hover:bg-white hover:text-slate-700">
                <i className="fa-solid fa-xmark" />
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isSplashVisible ? (
          <motion.div
            initial={{ opacity: 1 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.42, ease: [0.22, 1, 0.36, 1] }}
            className="pointer-events-none absolute inset-0 z-[95] overflow-hidden"
          >
            <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(245,247,250,0.78),rgba(255,255,255,0.92))]" />
            <motion.div
              initial={{ scale: 0.92, opacity: 0.6 }}
              animate={{ scale: 1.08, opacity: 1 }}
              transition={{ duration: 1.2, ease: [0.22, 1, 0.36, 1] }}
              className="absolute left-1/2 top-1/2 h-72 w-72 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(circle,rgba(10,132,255,0.22),rgba(122,184,255,0.12)_40%,transparent_72%)] blur-2xl"
            />
            <motion.div
              initial={{ y: 14, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
              className="absolute inset-0 flex items-center justify-center"
            >
              <div className="liquid-glass-panel liquid-glass-panel-strong rounded-[2rem] px-8 py-7 text-center">
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-[1.5rem] bg-[linear-gradient(135deg,#0a84ff,#7ab8ff)] text-white shadow-[0_18px_36px_-22px_rgba(10,132,255,0.55)]">
                  <i className="fa-solid fa-microchip text-2xl" />
                </div>
                <div className="mt-4 text-[11px] font-semibold uppercase tracking-[0.28em] text-slate-400">AI CNC</div>
                <div className="mt-2 text-[2rem] font-semibold tracking-tight text-slate-900">LinguaCNC</div>
                <div className="mt-2 text-sm text-slate-500">让刀路、对话和仿真自然接上。</div>
              </div>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <AnimatePresence>
        {isAboutSheetOpen ? (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[74] bg-slate-900/20 backdrop-blur-[8px]"
              onClick={() => setIsAboutSheetOpen(false)}
            />
            <motion.div
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 14 }}
              transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
              className="liquid-glass-panel liquid-glass-panel-strong fixed inset-x-3 bottom-[calc(env(safe-area-inset-bottom)+1rem)] z-[75] rounded-[1.9rem] p-4 sm:left-1/2 sm:top-1/2 sm:bottom-auto sm:w-[min(92vw,540px)] sm:-translate-x-1/2 sm:-translate-y-1/2 sm:p-5"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">About</div>
                  <div className="mt-1 text-xl font-semibold tracking-tight text-slate-900">关于灵语智造</div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsAboutSheetOpen(false)}
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/92 text-slate-400 transition-colors hover:text-slate-700"
                >
                  <i className="fa-solid fa-xmark" />
                </button>
              </div>

              <div className="mt-4 space-y-3 max-h-[55vh] overflow-y-auto pr-1">
                {aboutSections.map((section) => (
                  <div key={section.title} className="liquid-glass-pill rounded-[1.15rem] px-4 py-3">
                    <div className="text-sm font-semibold text-slate-900">{section.title}</div>
                    <div className="mt-1.5 text-sm leading-6 text-slate-500">{section.body}</div>
                  </div>
                ))}
              </div>
            </motion.div>
          </>
        ) : null}
      </AnimatePresence>

      <AnimatePresence>
        {pendingDeleteOperationIndex != null ? (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[76] bg-slate-900/22 backdrop-blur-[10px]"
              onClick={() => setPendingDeleteOperationIndex(null)}
            />
            <motion.div
              initial={{ opacity: 0, y: 18, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 12, scale: 0.99 }}
              transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
              className="liquid-glass-panel liquid-glass-panel-strong fixed inset-x-3 bottom-[calc(env(safe-area-inset-bottom)+1rem)] z-[77] rounded-[1.9rem] p-4 sm:left-1/2 sm:top-1/2 sm:bottom-auto sm:w-[min(92vw,420px)] sm:-translate-x-1/2 sm:-translate-y-1/2 sm:p-5"
            >
              <div className="flex items-start gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[1rem] bg-rose-50 text-rose-500 shadow-[0_14px_30px_-24px_rgba(244,63,94,0.45)]">
                  <i className="fa-solid fa-trash-can text-sm" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">Delete</div>
                  <div className="mt-1 text-lg font-semibold tracking-tight text-slate-900">确定删除这道工序吗？</div>
                  <div className="mt-2 text-sm leading-6 text-slate-500">
                    这会删除第 {pendingDeleteOperationIndex + 1} 道工序{pendingDeleteOperation ? `（${pendingDeleteOperation.type}）` : ''}，并同步重算 G 代码与安全检查。
                  </div>
                </div>
              </div>

              <div className="mt-5 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setPendingDeleteOperationIndex(null)}
                  className="inline-flex h-11 items-center justify-center rounded-full border border-slate-200 bg-white px-5 text-sm font-medium text-slate-600 transition-colors hover:border-slate-300 hover:text-slate-900"
                >
                  取消
                </button>
                <motion.button
                  type="button"
                  whileTap={{ scale: 0.97 }}
                  onClick={confirmDeleteOperation}
                  className="inline-flex h-11 items-center justify-center rounded-full border border-rose-300/60 bg-gradient-to-br from-rose-500 to-rose-600 px-5 text-sm font-medium text-white shadow-[0_18px_36px_-24px_rgba(244,63,94,0.48)]"
                >
                  确认删除
                </motion.button>
              </div>
            </motion.div>
          </>
        ) : null}
      </AnimatePresence>

      <HistoryDrawer
        isOpen={isHistoryOpen}
        onClose={() => setIsHistoryOpen(false)}
        sessions={sessions}
        onSelectSession={handleLoadSession}
        onDeleteSession={handleDeleteSession}
        currentSessionId={currentSessionId}
      />
      <ToolLibrary
        isOpen={isToolLibraryOpen}
        onClose={() => setIsToolLibraryOpen(false)}
        tools={tools}
        onCreateTool={handleCreateTool}
        onUpdateTool={handleUpdateTool}
        onDeleteTool={handleDeleteTool}
      />
      <SetupSheet isOpen={isSetupSheetOpen} onClose={() => setIsSetupSheetOpen(false)} data={effectiveCncData} />
      <AnimatePresence>{isLiveSessionOpen && <LiveSession onClose={() => setIsLiveSessionOpen(false)} initialVideoEnabled={false} />}</AnimatePresence>

      <div
        className="relative flex h-full min-h-0 flex-col p-3 lg:p-5"
        style={{
          paddingTop: isNativeIOSShellEnabled ? 'max(84px, calc(env(safe-area-inset-top) + 72px))' : 'max(12px, calc(env(safe-area-inset-top) + 10px))',
          paddingLeft: 'max(12px, calc(env(safe-area-inset-left) + 12px))',
          paddingRight: 'max(12px, calc(env(safe-area-inset-right) + 12px))'
        }}
      >
        <div className="hidden min-h-0 flex-1 gap-5 xl:grid xl:grid-cols-[430px_minmax(0,1fr)]">
          <motion.div
            initial={{ opacity: 0, x: -22, scale: 0.985 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
            className="min-h-0"
          >
            <ChatPanel
              messages={messages}
              isProcessing={isProcessing}
              mode={mode}
              model={model}
              providers={providers}
              activeProviderLabel={activeProviderLabel}
              syncState={syncState}
              lastSavedAt={lastSavedAt}
              onModeChange={setMode}
              onModelChange={setModel}
              onSendMessage={handleSendMessage}
              onStop={handleStopGeneration}
              onReset={handleReset}
              onOpenHistory={() => setIsHistoryOpen(true)}
              onOpenTools={() => setIsToolLibraryOpen(true)}
              onOpenSetupSheet={() => setIsSetupSheetOpen(true)}
              onStartLiveSession={() => setIsLiveSessionOpen(true)}
              onUseDemo={() => handleSendMessage(DEMO_PROMPT, null, model, 'GENERATE')}
            />
          </motion.div>

          <motion.section
            initial={{ opacity: 0, x: 20, scale: 0.985 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            transition={{ duration: 0.48, ease: [0.22, 1, 0.36, 1] }}
            className="liquid-glass-panel liquid-glass-panel-strong flex min-h-0 flex-col rounded-[2.2rem] p-4"
          >
            <div className="liquid-glass-panel liquid-glass-panel-soft mb-4 rounded-[1.8rem] p-4">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="flex min-w-0 items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-[1.25rem] bg-[linear-gradient(135deg,#0a84ff,#7ab8ff)] text-white shadow-[0_14px_32px_-22px_rgba(10,132,255,0.6)]">
                    <i className="fa-solid fa-cubes text-lg" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400">Stage</div>
                    <div className="truncate text-lg font-semibold tracking-tight text-slate-900">仿真与代码</div>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <div className="liquid-glass-pill flex items-center rounded-[1.2rem] p-1.5">
                    {desktopStageTabs.map((tab) => (
                      <button
                        key={tab.key}
                        type="button"
                        onClick={() => setStageView(tab.key)}
                        className={`liquid-glass-segment relative flex min-w-[112px] items-center justify-center gap-2 rounded-[1rem] px-4 py-2.5 text-sm font-medium transition-colors ${
                          stageView === tab.key ? 'text-slate-900' : 'text-slate-500'
                        }`}
                      >
                        {stageView === tab.key && (
                          <motion.span
                            layoutId="desktop-stage-pill"
                            className="liquid-glass-pill absolute inset-0 rounded-[1rem]"
                            transition={{ type: 'spring', stiffness: 360, damping: 32 }}
                          />
                        )}
                        <span className="relative flex items-center gap-2">
                          <i className={`fa-solid ${tab.icon} text-[13px]`} />
                          <span>{tab.label}</span>
                        </span>
                      </button>
                    ))}
                  </div>

                  <motion.button
                    type="button"
                    whileHover={{ y: -1, scale: 1.01 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => setIsSetupSheetOpen(true)}
                    className="flex h-11 items-center gap-2 rounded-[1rem] border border-sky-300/60 bg-gradient-to-br from-[#0a84ff] to-[#2563eb] px-4 text-sm font-medium text-white shadow-[0_16px_32px_-22px_rgba(10,132,255,0.5)]"
                  >
                    <i className="fa-solid fa-file-lines text-[13px]" />
                    <span>工艺单</span>
                  </motion.button>

                  <div className="relative" ref={desktopStageInfoRef}>
                    <motion.button
                      type="button"
                      whileHover={{ y: -1, scale: 1.01 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => setIsStageInfoOpen((current) => !current)}
                      title="舞台信息"
                      aria-label="舞台信息"
                      className="liquid-glass-pill flex h-11 w-11 items-center justify-center rounded-[1rem] text-slate-500 transition-colors hover:bg-white hover:text-slate-900"
                    >
                      <i className="fa-solid fa-circle-info text-sm" />
                    </motion.button>
                    {renderStageInfoPopover()}
                  </div>
                </div>
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-hidden">
              <AnimatePresence mode="wait">
                <motion.div key={stageView} {...stageTransition} className="h-full">
                  {stageComponent}
                </motion.div>
              </AnimatePresence>
            </div>
          </motion.section>
        </div>
        <div className="flex min-h-0 flex-1 flex-col xl:hidden">
          <AnimatePresence initial={false}>
            {showMobileCompactHeader ? (
              <motion.div
                key="mobile-compact-header"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
                className="liquid-glass-panel liquid-glass-panel-soft mb-2.5 flex items-center justify-between gap-3 rounded-[1.55rem] px-4 py-3"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-[1.15rem] bg-gradient-to-br ${mobileWorkspaceMeta.accentClass} text-white shadow-[0_18px_36px_-24px_rgba(15,23,42,0.28)]`}>
                    <i className={`fa-solid ${mobileWorkspaceMeta.icon} text-sm`} />
                  </div>
                  <div className="min-w-0">
                    <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400">iPhone Workspace</div>
                    <div className="mt-0.5 truncate text-[15px] font-semibold tracking-tight text-slate-900">{mobileWorkspaceMeta.title}</div>
                    <div className="truncate text-[11px] text-slate-500">{mobileWorkspaceMeta.subtitle}</div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="relative" ref={mobileStageInfoRef}>
                    <motion.button
                      type="button"
                      whileTap={{ scale: 0.94 }}
                      onClick={() => setIsStageInfoOpen((current) => !current)}
                      title="舞台信息"
                      aria-label="舞台信息"
                      className="liquid-glass-pill flex h-10 w-10 items-center justify-center rounded-[1rem] text-slate-500"
                    >
                      <i className="fa-solid fa-circle-info" />
                    </motion.button>
                    {renderStageInfoPopover()}
                  </div>
                  <motion.button
                    type="button"
                    whileTap={{ scale: 0.94 }}
                    onClick={() => setIsHistoryOpen(true)}
                    className="liquid-glass-pill flex h-10 w-10 items-center justify-center rounded-[1rem] text-slate-500"
                  >
                    <i className="fa-regular fa-clock" />
                  </motion.button>
                </div>
              </motion.div>
            ) : null}
          </AnimatePresence>

          <div className="min-h-0 flex-1" style={{ paddingBottom: mobileContentBottomPadding }}>
            <AnimatePresence mode="wait">
              <motion.div key={mobileView} {...stageTransition} className="h-full">
                {mobileView === 'task' ? (
                  <ChatPanel
                    messages={messages}
                    isProcessing={isProcessing}
                    mode={mode}
                    model={model}
                    providers={providers}
                    activeProviderLabel={activeProviderLabel}
                    syncState={syncState}
                    lastSavedAt={lastSavedAt}
                    onModeChange={setMode}
                    onModelChange={setModel}
                    onSendMessage={handleSendMessage}
                    onStop={handleStopGeneration}
                    onReset={handleReset}
                    onOpenHistory={() => setIsHistoryOpen(true)}
                    onOpenTools={() => setIsToolLibraryOpen(true)}
                    onOpenSetupSheet={() => setMobileView('setup')}
                    onStartLiveSession={() => setIsLiveSessionOpen(true)}
                    onUseDemo={() => handleSendMessage(DEMO_PROMPT, null, model, 'GENERATE')}
                    onOpenAbout={() => setIsAboutSheetOpen(true)}
                    layoutMode={hasMobileConversation ? 'mobile-conversation' : 'mobile-empty'}
                    nativeShellEnabled={isNativeIOSShellEnabled}
                  />
                ) : mobileView === 'sim' ? (
                  <SimulationPanel data={effectiveCncData} customPath={effectiveCustomPath} />
                ) : mobileView === 'code' ? (
                  <CodePanel
                    data={effectiveCncData}
                    onCodeChange={handleCodeEdit}
                    onDeleteOperation={handleDeleteOperation}
                    onAuditRequest={requestAudit}
                    isAuditing={isAuditing}
                    lastAuditedAt={lastAuditedAt}
                    isMobile
                  />
                ) : (
                  <div className="liquid-glass-panel liquid-glass-panel-strong h-full overflow-hidden rounded-[2rem]">
                    <SetupSheetContent data={effectiveCncData} showCloseButton={false} />
                  </div>
                )}
              </motion.div>
            </AnimatePresence>
          </div>

          {!isNativeIOSShellEnabled ? (
            <div className="pointer-events-none fixed inset-x-0 z-40 flex justify-center" style={{ bottom: 'calc(env(safe-area-inset-bottom) + 12px)' }}>
            <div className={`liquid-glass-nav pointer-events-auto flex w-[min(94vw,520px)] items-center justify-between rounded-[2.2rem] ${hasMobileConversation ? 'px-2.5 py-2.5' : 'px-3.5 py-3.5'}`}>
              {mobileTabs.map((item) => (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => setMobileView(item.key)}
                  className={`liquid-glass-segment relative flex min-w-[68px] flex-col items-center rounded-[1.2rem] text-[11px] font-medium transition-colors ${
                    hasMobileConversation ? 'gap-1 px-2.5 py-2' : 'gap-1.5 px-3 py-2.5'
                  } ${mobileView === item.key ? 'text-slate-900' : 'text-slate-500'}`}
                >
                  {mobileView === item.key && (
                    <motion.span
                      layoutId="mobile-nav-pill"
                      className="liquid-glass-pill absolute inset-0 rounded-[1.2rem]"
                      transition={{ type: 'spring', stiffness: 360, damping: 32 }}
                    />
                  )}
                  <span className={`relative flex flex-col items-center ${hasMobileConversation ? 'gap-1' : 'gap-1.5'}`}>
                    <i className={`fa-solid ${item.icon} ${hasMobileConversation ? 'text-[14px]' : 'text-[15px]'}`} />
                    <span>{item.label}</span>
                  </span>
                </button>
              ))}
            </div>
            </div>
          ) : null}
        </div>

      </div>
    </div>
  );
};

export default App;
