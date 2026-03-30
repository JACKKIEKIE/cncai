import fs from "fs";
import React from "react";
import ReactMarkdown from "react-markdown";
import { renderToStaticMarkup } from "react-dom/server";

const root = new URL("./", import.meta.url);
const sourcePath = new URL("./linguacnc-business-plan.md", root);
const layoutPath = new URL("./business_plan_layout.json", root);
const outputPath = new URL("./linguacnc-business-plan.html", root);

const markdown = fs.readFileSync(sourcePath, "utf8");
const layout = JSON.parse(fs.readFileSync(layoutPath, "utf8"));

function splitSections(text) {
  const lines = text.split(/\r?\n/);
  const sections = [];
  let current = null;

  for (const line of lines) {
    if (line.startsWith("# ")) continue;
    if (line.startsWith("## ")) {
      if (current) sections.push(current);
      current = { title: line.slice(3).trim(), lines: [] };
    } else if (current) {
      current.lines.push(line);
    }
  }
  if (current) sections.push(current);
  return sections;
}

function mdToHtml(text) {
  return renderToStaticMarkup(React.createElement(ReactMarkdown, { children: text }));
}

function imagePath(relativePath) {
  return `./${relativePath.replace(/\\/g, "/")}`;
}

function renderGallery(block) {
  const cards = block.items
    .map(
      (item) => `
      <figure class="gallery-card">
        <img src="${imagePath(item.asset)}" alt="${item.caption}" />
        <figcaption>${item.caption}</figcaption>
      </figure>`
    )
    .join("");

  return `
    <section class="visual-block">
      <div class="visual-head">
        <h3>${block.title}</h3>
        <p>${block.body}</p>
      </div>
      <div class="gallery-grid">${cards}</div>
    </section>
  `;
}

function renderImageBlock(block) {
  return `
    <section class="visual-block">
      <div class="visual-head">
        <h3>${block.title}</h3>
        <p>${block.body}</p>
      </div>
      <figure class="hero-figure single">
        <img src="${imagePath(block.asset)}" alt="${block.title}" />
      </figure>
    </section>
  `;
}

function renderWebsiteBlock(block) {
  return `
    <section class="visual-block website-block">
      <div class="visual-head">
        <h3>${block.title}</h3>
        <p>${block.body}</p>
      </div>
      <div class="website-grid">
        <figure class="hero-figure">
          <img src="${imagePath(block.asset)}" alt="线上 demo 截图" />
        </figure>
        <div class="website-card">
          <img class="qr" src="${imagePath(block.qrAsset)}" alt="demo 二维码" />
          <a href="${block.url}" class="site-url">${block.url}</a>
          <p>${block.footer}</p>
        </div>
      </div>
    </section>
  `;
}

function renderBlock(block) {
  if (block.type === "gallery") return renderGallery(block);
  if (block.type === "image") return renderImageBlock(block);
  if (block.type === "website") return renderWebsiteBlock(block);
  return "";
}

const sections = splitSections(markdown);
const chapterMap = new Map(layout.chapters.map((item) => [item.at, item]));
const blocksMap = new Map();
for (const block of layout.blocks) {
  if (!blocksMap.has(block.after)) blocksMap.set(block.after, []);
  blocksMap.get(block.after).push(block);
}

const tocItems = sections
  .map((section, index) => `<li><span>${String(index + 1).padStart(2, "0")}</span><strong>${section.title}</strong></li>`)
  .join("");

const bodySections = sections
  .map((section) => {
    const chapter = chapterMap.get(section.title);
    const bodyHtml = mdToHtml(section.lines.join("\n"));
    const divider = chapter
      ? `
      <section class="chapter-divider">
        <div class="chapter-text">
          <div class="chapter-pill">正式参赛版章节</div>
          <div class="chapter-no">${chapter.number}</div>
          <h2>${chapter.title}</h2>
          <p>${chapter.summary}</p>
        </div>
        <figure class="chapter-figure">
          <img src="${imagePath(chapter.asset)}" alt="${chapter.title}" />
        </figure>
      </section>`
      : "";
    const heading = chapter ? "" : `<h2 class="section-title">${section.title}</h2>`;
    const blocks = (blocksMap.get(section.title) || []).map(renderBlock).join("");
    return `
      ${divider}
      <section class="content-section">
        ${heading}
        <div class="section-body markdown-body">${bodyHtml}</div>
      </section>
      ${blocks}
    `;
  })
  .join("");

const coverLabels = layout.cover.labels
  .map((label) => `<span class="cover-label">${label}</span>`)
  .join("");

const html = `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>灵语智造 LinguaCNC 正式参赛版商业计划书</title>
  <style>
    @page { size: A4; margin: 18mm 14mm; }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: "Microsoft YaHei", "PingFang SC", "Noto Sans CJK SC", sans-serif;
      background:
        radial-gradient(circle at top left, rgba(59,130,246,.12), transparent 30%),
        radial-gradient(circle at top right, rgba(99,102,241,.08), transparent 28%),
        linear-gradient(180deg, #edf4ff 0%, #f8fbff 34%, #eef5ff 100%);
      color: #1f2937;
      line-height: 1.85;
    }
    .page {
      width: 210mm;
      min-height: 297mm;
      margin: 0 auto;
      padding: 18mm 14mm;
      background: rgba(255,255,255,.9);
      box-shadow: 0 12px 36px rgba(28, 52, 92, .08);
    }
    .cover-card, .chapter-divider, .visual-block, .content-section, .toc-card {
      background: rgba(255,255,255,.86);
      border: 1px solid rgba(207, 224, 247, .95);
      border-radius: 26px;
      box-shadow: 0 10px 30px rgba(55, 88, 138, .06);
      backdrop-filter: blur(16px);
    }
    .cover-card {
      padding: 28px;
      margin-bottom: 28px;
    }
    .cover-pill, .chapter-pill {
      display: inline-flex;
      align-items: center;
      padding: 8px 16px;
      border-radius: 999px;
      background: #dbeafe;
      color: #1d4ed8;
      font-size: 13px;
      font-weight: 700;
      letter-spacing: .2px;
    }
    .cover-card h1 {
      margin: 18px 0 6px;
      font-size: 34px;
      line-height: 1.2;
      color: #10213a;
    }
    .cover-subtitle {
      margin: 0 0 14px;
      color: #4d5f7b;
      font-size: 16px;
    }
    .cover-summary {
      margin: 0;
      padding: 16px 18px;
      border-left: 4px solid #2563eb;
      border-radius: 18px;
      background: rgba(248, 251, 255, .9);
      color: #344861;
      text-align: justify;
    }
    .cover-labels {
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
      margin: 18px 0 20px;
    }
    .cover-label {
      display: inline-flex;
      padding: 8px 14px;
      border-radius: 999px;
      background: #edf4ff;
      color: #1d4ed8;
      font-size: 13px;
      font-weight: 700;
    }
    .cover-hero img, .chapter-figure img, .hero-figure img, .gallery-card img, .website-card .qr {
      width: 100%;
      display: block;
      border-radius: 18px;
    }
    .cover-meta {
      margin-top: 18px;
      padding-top: 14px;
      border-top: 1px solid #dbe7fb;
      color: #64748b;
      font-size: 12px;
    }
    .toc-card {
      padding: 24px 26px;
      margin-bottom: 28px;
    }
    .toc-card h2 {
      margin: 0 0 10px;
      font-size: 28px;
      color: #10213a;
    }
    .toc-card p {
      margin: 0 0 16px;
      color: #4d5f7b;
    }
    .toc-list {
      list-style: none;
      margin: 0;
      padding: 0;
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 8px 18px;
    }
    .toc-list li {
      display: flex;
      gap: 12px;
      padding: 6px 0;
      border-bottom: 1px dashed #e2ebfb;
      font-size: 14px;
    }
    .toc-list span {
      color: #1d4ed8;
      font-weight: 700;
      min-width: 22px;
    }
    .chapter-divider {
      display: grid;
      grid-template-columns: 1.05fr .95fr;
      gap: 22px;
      padding: 28px;
      margin: 0 0 26px;
      align-items: center;
    }
    .chapter-no {
      margin-top: 10px;
      font-size: 46px;
      line-height: 1;
      font-weight: 800;
      color: #2563eb;
    }
    .chapter-divider h2 {
      margin: 8px 0 10px;
      font-size: 30px;
      color: #10213a;
    }
    .chapter-divider p {
      margin: 0;
      color: #516279;
      text-align: justify;
    }
    .content-section {
      padding: 24px 26px;
      margin-bottom: 24px;
    }
    .section-title {
      margin: 0 0 14px;
      font-size: 24px;
      color: #10213a;
    }
    .markdown-body h1 { display: none; }
    .markdown-body h2 {
      margin: 18px 0 8px;
      font-size: 20px;
      color: #1d4ed8;
    }
    .markdown-body h3 {
      margin: 14px 0 6px;
      font-size: 16px;
      color: #24364f;
    }
    .markdown-body p {
      margin: 8px 0;
      text-align: justify;
      font-size: 14px;
      color: #263649;
    }
    .markdown-body ul, .markdown-body ol {
      margin: 10px 0 10px 24px;
      padding: 0;
    }
    .markdown-body li {
      margin: 4px 0;
      font-size: 14px;
      color: #263649;
    }
    .markdown-body blockquote {
      margin: 12px 0;
      padding: 12px 14px;
      border-left: 4px solid #60a5fa;
      border-radius: 12px;
      background: #f3f8ff;
      color: #42566f;
    }
    .visual-block {
      padding: 24px 26px;
      margin-bottom: 28px;
    }
    .visual-head {
      text-align: center;
      margin-bottom: 16px;
    }
    .visual-head h3 {
      margin: 0 0 8px;
      font-size: 24px;
      color: #10213a;
    }
    .visual-head p {
      margin: 0 auto;
      max-width: 760px;
      color: #596b84;
      text-align: center;
    }
    .gallery-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 18px;
    }
    .gallery-card {
      margin: 0;
      padding: 14px;
      border-radius: 22px;
      background: #f8fbff;
      border: 1px solid #dbe7fb;
    }
    .gallery-card figcaption {
      margin-top: 10px;
      text-align: center;
      color: #64748b;
      font-size: 13px;
    }
    .hero-figure {
      margin: 0;
      padding: 14px;
      border-radius: 24px;
      background: #f8fbff;
      border: 1px solid #dbe7fb;
    }
    .hero-figure.single {
      max-width: 920px;
      margin: 0 auto;
    }
    .website-grid {
      display: grid;
      grid-template-columns: 1.2fr .8fr;
      gap: 18px;
      align-items: start;
    }
    .website-card {
      padding: 18px;
      border-radius: 24px;
      background: #f8fbff;
      border: 1px solid #dbe7fb;
      text-align: left;
    }
    .website-card .qr {
      width: 180px;
      margin: 0 0 16px;
    }
    .site-url {
      display: inline-block;
      margin-bottom: 10px;
      color: #1d4ed8;
      font-weight: 700;
      text-decoration: none;
      word-break: break-all;
    }
    .site-url:hover { text-decoration: underline; }
    .footer-note {
      margin-top: 24px;
      padding-top: 14px;
      border-top: 1px solid #dbe7fb;
      color: #7b8ba5;
      font-size: 12px;
    }
    @media print {
      body { background: white; }
      .page {
        width: auto;
        min-height: auto;
        margin: 0;
        padding: 0;
        box-shadow: none;
        background: white;
      }
      .cover-card, .chapter-divider, .visual-block, .content-section, .toc-card {
        box-shadow: none;
        backdrop-filter: none;
      }
    }
  </style>
</head>
<body>
  <main class="page">
    <section class="cover-card">
      <div class="cover-pill">${layout.cover.eyebrow}</div>
      <h1>${layout.cover.title}</h1>
      <p class="cover-subtitle">${layout.cover.subtitle}</p>
      <p class="cover-summary">${layout.cover.summary}</p>
      <div class="cover-labels">${coverLabels}</div>
      <figure class="cover-hero">
        <img src="${imagePath(layout.cover.heroAsset)}" alt="封面主视觉" />
      </figure>
      <div class="cover-meta">
        项目入口：<a href="${layout.siteUrl}">${layout.siteUrl}</a><br />
        文稿用途：正式申报正文 / 路演展示底稿 / 视觉升级版项目材料
      </div>
    </section>

    <section class="toc-card">
      <h2>目录</h2>
      <p>本版本采用图文混排结构，兼顾正式申报场景的完整论证与路演答辩场景的视觉展示，以下为主要章节目录。</p>
      <ol class="toc-list">${tocItems}</ol>
    </section>

    ${bodySections}

    <div class="footer-note">本 HTML 与 PDF 共用同一正文源和同一版式配置，可继续替换团队、学校、导师、试点与图片素材。</div>
  </main>
</body>
</html>`;

fs.writeFileSync(outputPath, html, "utf8");
console.log(outputPath.pathname);
