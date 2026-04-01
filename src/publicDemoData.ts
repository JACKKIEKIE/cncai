import { ChatMessage, CNCOutput, MachineOperationType, ToolType } from '../types';

export const PUBLIC_DEMO_RESULT: CNCOutput = {
  gcode: `%\nO1001 (LINGUACNC PUBLIC DEMO)\nG21 G17 G90 G54\nT1 M6\nS3800 M3\nG0 X-78 Y-58 Z18\nG1 Z-0.4 F600\nG1 X78 F1200\nG1 Y58\nG1 X-78\nG1 Y-58\nG0 Z18\nT2 M6\nS6200 M3\nG0 X0 Y0 Z18\nG1 Z-1.2 F420\nG3 I22 J0 F860\nG1 Z-2.4 F420\nG3 I22 J0 F860\nG1 Z-4.0 F420\nG3 I22 J0 F860\nG0 Z18\nT3 M6\nS5200 M3\nG0 X-36 Y28 Z18\nG81 X-36 Y28 Z-8 R2 F260\nX36 Y28\nX-36 Y-28\nX36 Y-28\nG80\nG0 Z18\nM5\nM30\n%`,
  explanation:
    '论坛 Demo 版固定展示一块 160x120x20 铝板的样例流程，重点演示自然语言意图、工艺拆解、可视化仿真与程序预览如何收在同一个界面里。正式版中的自由输入、多轮优化、后处理细节与真实审计规则在公开版中已关闭。',
  stock: {
    shape: 'RECTANGULAR',
    width: 120,
    length: 160,
    height: 20,
    diameter: 0,
    material: '6061 铝板'
  },
  operations: [
    {
      type: MachineOperationType.FACE_MILL,
      x: 0,
      y: 0,
      z_start: 0,
      z_depth: 0.4,
      width: 156,
      length: 116,
      feed_rate: 1200,
      spindle_speed: 3800,
      tool_diameter: 16,
      tool_type: ToolType.FACE_MILL,
      step_down: 0.4
    },
    {
      type: MachineOperationType.CIRCULAR_POCKET,
      x: 0,
      y: 0,
      z_start: 0,
      z_depth: 4,
      diameter: 44,
      feed_rate: 860,
      spindle_speed: 6200,
      tool_diameter: 8,
      tool_type: ToolType.END_MILL,
      step_down: 1.2
    },
    {
      type: MachineOperationType.DRILL,
      x: -36,
      y: 28,
      z_start: 0,
      z_depth: 8,
      feed_rate: 260,
      spindle_speed: 5200,
      tool_diameter: 6,
      tool_type: ToolType.DRILL,
      step_down: 8
    },
    {
      type: MachineOperationType.DRILL,
      x: 36,
      y: 28,
      z_start: 0,
      z_depth: 8,
      feed_rate: 260,
      spindle_speed: 5200,
      tool_diameter: 6,
      tool_type: ToolType.DRILL,
      step_down: 8
    },
    {
      type: MachineOperationType.DRILL,
      x: -36,
      y: -28,
      z_start: 0,
      z_depth: 8,
      feed_rate: 260,
      spindle_speed: 5200,
      tool_diameter: 6,
      tool_type: ToolType.DRILL,
      step_down: 8
    },
    {
      type: MachineOperationType.DRILL,
      x: 36,
      y: -28,
      z_start: 0,
      z_depth: 8,
      feed_rate: 260,
      spindle_speed: 5200,
      tool_diameter: 6,
      tool_type: ToolType.DRILL,
      step_down: 8
    }
  ],
  audit: {
    passed: true,
    score: 91,
    issues: [
      {
        severity: 'warning',
        message: '论坛版仅保留代表性程序片段，真实后处理与机床适配规则已关闭。',
        suggestion: '正式联机前仍需在主项目中完成机床模板与刀补校验。'
      },
      {
        severity: 'info',
        message: '建议首发场景聚焦“自然语言到样例刀路”的可视化体验。',
        suggestion: '这样既能突出项目目标，也不会泄露完整工艺引擎。'
      }
    ]
  }
};

export const PUBLIC_DEMO_CODE_PREVIEW = [
  '%',
  'O1001 (LINGUACNC PUBLIC DEMO)',
  'G21 G17 G90 G54',
  'T1 M6',
  'S3800 M3',
  'G0 X-78 Y-58 Z18',
  'G1 Z-0.4 F600',
  'G1 X78 F1200',
  'G1 Y58',
  'G1 X-78',
  'G1 Y-58',
  '; demo 版仅展示代表性刀路',
  '; 已省略真实后处理、刀补与模板细节',
  'T2 M6',
  'S6200 M3',
  'G0 X0 Y0 Z18',
  'G1 Z-1.2 F420',
  'G3 I22 J0 F860',
  '...',
  'M30',
  '%'
].join('\n');

export const PUBLIC_DEMO_MESSAGES: ChatMessage[] = [
  {
    id: 'demo-user-1',
    role: 'user',
    text: '我想知道自然语言能不能直接变成一个可验证的 CNC 试切流程？',
    meta: { provider: 'system', providerLabel: '论坛访客', timestamp: Date.now() - 120000 }
  },
  {
    id: 'demo-ai-1',
    role: 'ai',
    text: '可以。这版公开 Demo 不暴露真实工艺引擎，而是固定展示一条代表性样例：从一句需求，到工序拆解、样例 G 代码和 3D 仿真同屏联动。',
    meta: { provider: 'system', providerLabel: 'LinguaCNC Demo', timestamp: Date.now() - 90000 }
  },
  {
    id: 'demo-user-2',
    role: 'user',
    text: '那先给我看一个铝板圆腔 + 四孔定位的典型样例。',
    meta: { provider: 'system', providerLabel: '论坛访客', timestamp: Date.now() - 70000 }
  },
  {
    id: 'demo-ai-2',
    role: 'ai',
    text: '已加载公开样例。你现在看到的是“自然语言意图 -> 工艺拆解 -> 程序预览 -> 3D 仿真”的精简闭环，适合论坛展示与招募同路人。',
    cncResult: PUBLIC_DEMO_RESULT,
    meta: { provider: 'system', providerLabel: 'LinguaCNC Demo', timestamp: Date.now() - 45000 }
  }
];

export const PUBLIC_DEMO_HIGHLIGHTS = [
  {
    title: '项目目标',
    body: '让中文制造场景第一次可以用自然语言快速试跑 CAM 思路，而不是先被传统软件门槛挡住。'
  },
  {
    title: '公开策略',
    body: 'Demo 只展示固定样例、可视化结果和产品方向，不公开完整刀路引擎、后处理策略和模型路由。'
  },
  {
    title: '论坛价值',
    body: '足够让外界看懂你在做什么，也足够克制，不会把最核心的知识产权摊在公开环境里。'
  }
];

export const PUBLIC_DEMO_LOCKED_FEATURES = [
  '关闭真实 AI 对话生成与多轮工艺优化',
  '隐藏完整后处理模板、刀补规则与真实机床适配',
  '不开放刀具库编辑、历史工程和私有工作流',
  '程序预览仅保留代表性片段，避免核心参数策略泄露'
];

export const PUBLIC_DEMO_OPEN_FEATURES = [
  '固定样例的自然语言意图展示',
  '代表性工序拆解与安全提示',
  '3D 仿真与程序预览联动',
  '面向论坛的项目说明与社区招募入口'
];

export const PUBLIC_DEMO_ROLES = ['机械/CNC', '前端/Three.js', 'AI/Agent', '产品/运营'];

export const PUBLIC_DEMO_FORUM_POST = `项目名：LinguaCNC Demo

我们在做一个面向中文制造场景的 AI CNC 助手。

这次公开的是论坛试用版，不包含完整工艺内核，只展示一条固定样例流程：
自然语言意图 -> 工序拆解 -> 样例 G 代码 -> 3D 仿真预览。

我想找的是愿意一起把这件事做深的人：
- 机械 / CNC 工艺
- AI / Agent
- 前端可视化 / Three.js
- 产品表达与社区共建

如果你对“AI + 制造”这条路感兴趣，欢迎交流。`;
