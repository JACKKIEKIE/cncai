import React, { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';

import SimulationPanel from './SimulationPanel';
import {
  PUBLIC_DEMO_CODE_PREVIEW,
  PUBLIC_DEMO_FORUM_POST,
  PUBLIC_DEMO_HIGHLIGHTS,
  PUBLIC_DEMO_LOCKED_FEATURES,
  PUBLIC_DEMO_MESSAGES,
  PUBLIC_DEMO_OPEN_FEATURES,
  PUBLIC_DEMO_RESULT,
  PUBLIC_DEMO_ROLES
} from '../src/publicDemoData';

type DemoTab = 'story' | 'sim' | 'code' | 'sheet';

const demoTabs: Array<{ key: DemoTab; label: string; icon: string }> = [
  { key: 'story', label: '项目故事', icon: 'fa-sparkles' },
  { key: 'sim', label: '3D 仿真', icon: 'fa-cube' },
  { key: 'code', label: '程序预览', icon: 'fa-code' },
  { key: 'sheet', label: '工艺摘要', icon: 'fa-file-lines' }
];

function formatOperationTitle(index: number, operationType: string) {
  return `OP${String(index + 1).padStart(2, '0')} · ${operationType}`;
}

const PublicDemoApp: React.FC = () => {
  const [activeTab, setActiveTab] = useState<DemoTab>('story');
  const [copied, setCopied] = useState(false);

  const latestResult = useMemo(
    () => [...PUBLIC_DEMO_MESSAGES].reverse().find((message) => message.cncResult)?.cncResult ?? PUBLIC_DEMO_RESULT,
    []
  );

  useEffect(() => {
    document.title = 'LinguaCNC Demo | 论坛试用版';
  }, []);

  async function copyForumPost() {
    await navigator.clipboard.writeText(PUBLIC_DEMO_FORUM_POST);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  }

  return (
    <div className="ios-shell fixed inset-0 overflow-auto text-slate-900">
      <div className="ios-ambient-orb ios-ambient-orb--blue left-[5%] top-[6%] h-64 w-64" />
      <div className="ios-ambient-orb ios-ambient-orb--mint right-[10%] top-[22%] h-52 w-52 [animation-delay:-6s]" />
      <div className="ios-ambient-orb ios-ambient-orb--gold left-[18%] bottom-[10%] h-56 w-56 [animation-delay:-9s]" />

      <div className="relative mx-auto flex min-h-full w-full max-w-7xl flex-col px-4 pb-8 pt-5 sm:px-6 lg:px-8">
        <section className="liquid-glass-panel liquid-glass-panel-strong overflow-hidden rounded-[2.2rem] px-5 py-6 sm:px-8 sm:py-8">
          <div className="flex flex-wrap items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
            <span className="liquid-glass-pill rounded-full px-3 py-1">Forum Demo</span>
            <span className="liquid-glass-pill rounded-full px-3 py-1">核心能力已精简保护</span>
            <span className="liquid-glass-pill rounded-full px-3 py-1">Android APK Ready</span>
          </div>

          <div className="mt-6 grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">LinguaCNC Demo</div>
              <h1 className="mt-3 max-w-3xl text-[2.25rem] font-semibold leading-[1.02] tracking-[-0.05em] text-slate-950 sm:text-[3.4rem]">
                用一句中文需求，
                <br />
                让外界看懂你在做的 AI CNC 项目。
              </h1>
              <p className="mt-4 max-w-2xl text-base leading-8 text-slate-600 sm:text-lg">
                这是一个专门面向论坛发布的试用版。它保留“项目目标、代表性工艺样例、程序预览与 3D 仿真”，关闭完整工艺内核、后处理策略与私有工作流，既能吸引志同道合的人，也不会把主项目底牌公开出去。
              </p>

              <div className="mt-6 flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => setActiveTab('sim')}
                  className="inline-flex items-center gap-2 rounded-[1.2rem] bg-gradient-to-br from-[#0a84ff] to-[#2563eb] px-5 py-3 text-sm font-semibold text-white shadow-[0_18px_36px_-24px_rgba(10,132,255,0.42)]"
                >
                  <i className="fa-solid fa-cube" />
                  先看 3D 仿真
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('code')}
                  className="liquid-glass-pill inline-flex items-center gap-2 rounded-[1.2rem] px-5 py-3 text-sm font-semibold text-slate-700"
                >
                  <i className="fa-solid fa-code" />
                  看程序预览
                </button>
                <a
                  href="mailto:jackoikpig@gmail.com?subject=LinguaCNC%20Demo%20%E8%AE%BA%E5%9D%9B%E4%BA%A4%E6%B5%81"
                  className="liquid-glass-pill inline-flex items-center gap-2 rounded-[1.2rem] px-5 py-3 text-sm font-semibold text-slate-700"
                >
                  <i className="fa-solid fa-envelope" />
                  联系作者
                </a>
              </div>
            </div>

            <div className="grid gap-3">
              {PUBLIC_DEMO_HIGHLIGHTS.map((item) => (
                <div key={item.title} className="liquid-glass-pill rounded-[1.5rem] px-4 py-4">
                  <div className="text-sm font-semibold text-slate-900">{item.title}</div>
                  <div className="mt-1.5 text-sm leading-6 text-slate-500">{item.body}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="mt-5 grid gap-5 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="liquid-glass-panel rounded-[2rem] p-4 sm:p-5">
            <div className="flex items-center justify-between gap-4">
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">对外公开什么</div>
                <div className="mt-1 text-xl font-semibold tracking-tight text-slate-900">公开版保留代表性体验</div>
              </div>
              <div className="rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700">安全可展示</div>
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {PUBLIC_DEMO_OPEN_FEATURES.map((item) => (
                <div key={item} className="rounded-[1.25rem] border border-white/90 bg-white/90 px-4 py-3 text-sm text-slate-700 shadow-[0_10px_20px_-18px_rgba(15,23,42,0.12)]">
                  <i className="fa-solid fa-circle-check mr-2 text-emerald-500" />
                  {item}
                </div>
              ))}
            </div>
          </div>

          <div className="liquid-glass-panel rounded-[2rem] p-4 sm:p-5">
            <div className="flex items-center justify-between gap-4">
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">保护什么</div>
                <div className="mt-1 text-xl font-semibold tracking-tight text-slate-900">主项目核心能力不对外暴露</div>
              </div>
              <div className="rounded-full bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-700">知识产权保护</div>
            </div>
            <div className="mt-4 space-y-3">
              {PUBLIC_DEMO_LOCKED_FEATURES.map((item) => (
                <div key={item} className="rounded-[1.25rem] border border-white/90 bg-white/90 px-4 py-3 text-sm text-slate-700 shadow-[0_10px_20px_-18px_rgba(15,23,42,0.12)]">
                  <i className="fa-solid fa-lock mr-2 text-amber-500" />
                  {item}
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="mt-5">
          <div className="liquid-glass-panel rounded-[2rem] p-3 sm:p-4">
            <div className="flex flex-wrap gap-2">
              {demoTabs.map((tab) => (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setActiveTab(tab.key)}
                  className={`relative inline-flex items-center gap-2 rounded-[1rem] px-4 py-2.5 text-sm font-medium transition-colors ${activeTab === tab.key ? 'text-slate-900' : 'text-slate-500'}`}
                >
                  {activeTab === tab.key ? <motion.span layoutId="demo-tab-pill" className="liquid-glass-pill absolute inset-0 rounded-[1rem]" transition={{ type: 'spring', stiffness: 360, damping: 32 }} /> : null}
                  <span className="relative flex items-center gap-2">
                    <i className={`fa-solid ${tab.icon}`} />
                    {tab.label}
                  </span>
                </button>
              ))}
            </div>

            <div className="mt-4">
              {activeTab === 'story' ? (
                <div className="grid gap-5 xl:grid-cols-[0.95fr_1.05fr]">
                  <div className="rounded-[1.6rem] border border-white/90 bg-[linear-gradient(180deg,rgba(255,255,255,0.99),rgba(248,250,252,0.96))] p-4 shadow-[0_12px_28px_-20px_rgba(15,23,42,0.12)]">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">样例对话</div>
                    <div className="mt-4 space-y-3">
                      {PUBLIC_DEMO_MESSAGES.map((message) => {
                        const isUser = message.role === 'user';
                        return (
                          <div key={message.id} className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
                            <div className={`max-w-[92%] rounded-[1.35rem] px-4 py-3 text-sm leading-7 shadow-[0_10px_24px_-20px_rgba(15,23,42,0.12)] ${isUser ? 'rounded-br-lg border border-slate-200 bg-white text-slate-900' : 'rounded-bl-lg border border-sky-100 bg-sky-50/80 text-slate-700'}`}>
                              <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">{message.meta?.providerLabel}</div>
                              <div className="mt-1.5 whitespace-pre-wrap">{message.text}</div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <div className="rounded-[1.6rem] border border-white/90 bg-[linear-gradient(180deg,rgba(255,255,255,0.99),rgba(248,250,252,0.96))] p-4 shadow-[0_12px_28px_-20px_rgba(15,23,42,0.12)]">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">这版 Demo 传达什么</div>
                    <div className="mt-4 grid gap-3 md:grid-cols-3">
                      <div className="rounded-[1.3rem] bg-slate-950 px-4 py-4 text-white">
                        <div className="text-[11px] uppercase tracking-[0.18em] text-white/60">1</div>
                        <div className="mt-2 text-base font-semibold">自然语言是入口</div>
                        <div className="mt-2 text-sm leading-6 text-white/72">不先讲复杂 CAM 菜单，而是先让人看懂“需求如何变成加工意图”。</div>
                      </div>
                      <div className="rounded-[1.3rem] bg-white px-4 py-4 text-slate-900 shadow-[0_12px_24px_-20px_rgba(15,23,42,0.16)]">
                        <div className="text-[11px] uppercase tracking-[0.18em] text-slate-400">2</div>
                        <div className="mt-2 text-base font-semibold">样例流程可验证</div>
                        <div className="mt-2 text-sm leading-6 text-slate-500">外界能看到工序、代码和仿真，不会觉得这是空概念或 PPT 产品。</div>
                      </div>
                      <div className="rounded-[1.3rem] bg-white px-4 py-4 text-slate-900 shadow-[0_12px_24px_-20px_rgba(15,23,42,0.16)]">
                        <div className="text-[11px] uppercase tracking-[0.18em] text-slate-400">3</div>
                        <div className="mt-2 text-base font-semibold">核心能力被锁住</div>
                        <div className="mt-2 text-sm leading-6 text-slate-500">论坛版只是窗口，不是把主项目内核完整放出来给别人抄。</div>
                      </div>
                    </div>
                    <div className="mt-4 rounded-[1.35rem] border border-dashed border-sky-200 bg-sky-50/75 px-4 py-4 text-sm leading-7 text-slate-600">
                      公开版定位：用于论坛首发、产品方向验证、社区招募和潜在合作沟通。
                    </div>
                  </div>
                </div>
              ) : null}

              {activeTab === 'sim' ? (
                <div className="h-[66vh] min-h-[420px] overflow-hidden rounded-[1.6rem]">
                  <SimulationPanel data={latestResult} />
                </div>
              ) : null}

              {activeTab === 'code' ? (
                <div className="grid gap-5 xl:grid-cols-[0.82fr_1.18fr]">
                  <div className="rounded-[1.6rem] border border-white/90 bg-[linear-gradient(180deg,rgba(255,255,255,0.99),rgba(248,250,252,0.96))] p-4 shadow-[0_12px_28px_-20px_rgba(15,23,42,0.12)]">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">程序预览</div>
                        <div className="mt-1 text-lg font-semibold tracking-tight text-slate-900">只展示代表性片段</div>
                      </div>
                      <div className="rounded-full bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-700">核心细节已脱敏</div>
                    </div>
                    <pre className="mt-4 overflow-auto rounded-[1.35rem] bg-slate-950 px-4 py-4 font-mono text-[12px] leading-6 text-slate-100">
                      <code>{PUBLIC_DEMO_CODE_PREVIEW}</code>
                    </pre>
                  </div>

                  <div className="rounded-[1.6rem] border border-white/90 bg-[linear-gradient(180deg,rgba(255,255,255,0.99),rgba(248,250,252,0.96))] p-4 shadow-[0_12px_28px_-20px_rgba(15,23,42,0.12)]">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">样例输出摘要</div>
                    <div className="mt-3 rounded-[1.35rem] bg-white/92 px-4 py-4 text-sm leading-7 text-slate-600 shadow-[0_10px_20px_-18px_rgba(15,23,42,0.12)]">
                      {latestResult.explanation}
                    </div>
                    <div className="mt-4 grid gap-3 sm:grid-cols-2">
                      <div className="rounded-[1.25rem] border border-white/90 bg-white/92 px-4 py-4 shadow-[0_10px_20px_-18px_rgba(15,23,42,0.12)]">
                        <div className="text-[11px] uppercase tracking-[0.18em] text-slate-400">样例评分</div>
                        <div className="mt-2 text-3xl font-semibold tracking-tight text-slate-900">{latestResult.audit?.score ?? 0}</div>
                        <div className="mt-2 text-sm text-slate-500">对外版仅保留代表性安全提示，不暴露完整审计规则。</div>
                      </div>
                      <div className="rounded-[1.25rem] border border-white/90 bg-white/92 px-4 py-4 shadow-[0_10px_20px_-18px_rgba(15,23,42,0.12)]">
                        <div className="text-[11px] uppercase tracking-[0.18em] text-slate-400">样例边界</div>
                        <div className="mt-2 text-sm leading-7 text-slate-500">
                          不支持论坛访客输入真实工件、修改刀具库、导出正式机床程序或反推完整工艺策略。
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ) : null}

              {activeTab === 'sheet' ? (
                <div className="grid gap-5 xl:grid-cols-[0.95fr_1.05fr]">
                  <div className="rounded-[1.6rem] border border-white/90 bg-[linear-gradient(180deg,rgba(255,255,255,0.99),rgba(248,250,252,0.96))] p-4 shadow-[0_12px_28px_-20px_rgba(15,23,42,0.12)]">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">样例工件</div>
                    <div className="mt-4 grid gap-3 sm:grid-cols-2">
                      <div className="rounded-[1.25rem] bg-white px-4 py-4 shadow-[0_10px_20px_-18px_rgba(15,23,42,0.12)]">
                        <div className="text-[11px] uppercase tracking-[0.18em] text-slate-400">Material</div>
                        <div className="mt-2 text-lg font-semibold text-slate-900">{latestResult.stock.material}</div>
                      </div>
                      <div className="rounded-[1.25rem] bg-white px-4 py-4 shadow-[0_10px_20px_-18px_rgba(15,23,42,0.12)]">
                        <div className="text-[11px] uppercase tracking-[0.18em] text-slate-400">Size</div>
                        <div className="mt-2 text-lg font-semibold text-slate-900">
                          {latestResult.stock.length} × {latestResult.stock.width} × {latestResult.stock.height}
                        </div>
                      </div>
                    </div>
                    <div className="mt-4 rounded-[1.35rem] border border-sky-100 bg-sky-50/80 px-4 py-4 text-sm leading-7 text-slate-600">
                      这个公开样例聚焦“铝板圆腔 + 四孔定位”场景，足够说明项目方向，但不会泄露完整工艺覆盖范围。
                    </div>
                  </div>

                  <div className="rounded-[1.6rem] border border-white/90 bg-[linear-gradient(180deg,rgba(255,255,255,0.99),rgba(248,250,252,0.96))] p-4 shadow-[0_12px_28px_-20px_rgba(15,23,42,0.12)]">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">工序摘要</div>
                    <div className="mt-4 space-y-3">
                      {latestResult.operations.map((operation, index) => (
                        <div key={`${operation.type}-${index}`} className="rounded-[1.3rem] bg-white px-4 py-4 shadow-[0_10px_20px_-18px_rgba(15,23,42,0.12)]">
                          <div className="flex flex-wrap items-center justify-between gap-3">
                            <div className="text-sm font-semibold text-slate-900">{formatOperationTitle(index, operation.type)}</div>
                            <div className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
                              {operation.tool_type} / D{operation.tool_diameter}
                            </div>
                          </div>
                          <div className="mt-2 grid gap-2 text-sm text-slate-500 sm:grid-cols-3">
                            <div>主轴: {operation.spindle_speed} rpm</div>
                            <div>进给: {operation.feed_rate} mm/min</div>
                            <div>切深: {operation.z_depth} mm</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </section>

        <section className="mt-5 grid gap-5 xl:grid-cols-[0.95fr_1.05fr]">
          <div className="liquid-glass-panel rounded-[2rem] p-4 sm:p-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">论坛发帖</div>
                <div className="mt-1 text-xl font-semibold tracking-tight text-slate-900">可直接复制的招募文案</div>
              </div>
              <button
                type="button"
                onClick={copyForumPost}
                className={`rounded-[1rem] px-4 py-2 text-sm font-semibold ${copied ? 'bg-emerald-500 text-white' : 'bg-slate-950 text-white'}`}
              >
                {copied ? '已复制' : '复制文案'}
              </button>
            </div>
            <pre className="mt-4 overflow-auto rounded-[1.35rem] bg-slate-950 px-4 py-4 font-mono text-[12px] leading-6 text-slate-100">
              <code>{PUBLIC_DEMO_FORUM_POST}</code>
            </pre>
          </div>

          <div className="liquid-glass-panel rounded-[2rem] p-4 sm:p-5">
            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">招募方向</div>
            <div className="mt-3 flex flex-wrap gap-2">
              {PUBLIC_DEMO_ROLES.map((role) => (
                <span key={role} className="rounded-full bg-white/90 px-3 py-2 text-sm font-medium text-slate-700 shadow-[0_8px_18px_-16px_rgba(15,23,42,0.14)]">
                  {role}
                </span>
              ))}
            </div>
            <div className="mt-5 rounded-[1.35rem] border border-white/90 bg-white/92 px-4 py-4 text-sm leading-7 text-slate-600 shadow-[0_10px_20px_-18px_rgba(15,23,42,0.12)]">
              如果你想找的是懂制造的人、懂 AI 的人、会做产品的人，而不是单纯围观者，这个版本已经足够支撑一次公开亮相。
            </div>
            <div className="mt-4 flex flex-wrap gap-3">
              <a
                href="https://github.com/JACKKIEKIE/cncai"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 rounded-[1rem] bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white"
              >
                <i className="fa-brands fa-github" />
                查看仓库
              </a>
              <a
                href="mailto:jackoikpig@gmail.com?subject=LinguaCNC%20Demo%20%E5%90%88%E4%BD%9C%E4%BA%A4%E6%B5%81"
                className="liquid-glass-pill inline-flex items-center gap-2 rounded-[1rem] px-4 py-2.5 text-sm font-semibold text-slate-700"
              >
                <i className="fa-solid fa-paper-plane" />
                申请交流
              </a>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
};

export default PublicDemoApp;
