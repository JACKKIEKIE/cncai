from __future__ import annotations

import json
import math
import re
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable
from xml.sax.saxutils import escape

from PIL import Image as PILImage
from pypdf import PdfReader
from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_JUSTIFY, TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, StyleSheet1, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import (
    BaseDocTemplate,
    Frame,
    HRFlowable,
    Image,
    KeepTogether,
    PageBreak,
    PageTemplate,
    Paragraph,
    Spacer,
    Table,
    TableStyle,
)


ROOT = Path(__file__).resolve().parent
SOURCE = ROOT / "linguacnc-business-plan.md"
LAYOUT = ROOT / "business_plan_layout.json"
TARGET = ROOT / "linguacnc-business-plan.pdf"

FONT_REGULAR_PATH = r"C:\Windows\Fonts\msyh.ttc"
FONT_BOLD_PATH = r"C:\Windows\Fonts\msyhbd.ttc"
FONT_NAME = "BusinessPlanYaHei"
FONT_NAME_BOLD = "BusinessPlanYaHeiBold"


@dataclass
class Section:
    title: str
    lines: list[str]


def register_fonts() -> None:
    pdfmetrics.registerFont(TTFont(FONT_NAME, FONT_REGULAR_PATH))
    pdfmetrics.registerFont(TTFont(FONT_NAME_BOLD, FONT_BOLD_PATH))


def build_styles() -> StyleSheet1:
    styles = getSampleStyleSheet()

    styles.add(
        ParagraphStyle(
            name="CoverEyebrow",
            parent=styles["Normal"],
            fontName=FONT_NAME_BOLD,
            fontSize=11.5,
            leading=16,
            alignment=TA_LEFT,
            textColor=colors.HexColor("#1d4ed8"),
            backColor=colors.HexColor("#dbeafe"),
            borderPadding=(7, 14, 7, 14),
            borderRadius=11,
            spaceAfter=12,
        )
    )
    styles.add(
        ParagraphStyle(
            name="CoverTitle",
            parent=styles["Title"],
            fontName=FONT_NAME_BOLD,
            fontSize=27,
            leading=34,
            textColor=colors.HexColor("#10213a"),
            spaceAfter=6,
        )
    )
    styles.add(
        ParagraphStyle(
            name="CoverSubtitle",
            parent=styles["Normal"],
            fontName=FONT_NAME,
            fontSize=13.5,
            leading=20,
            textColor=colors.HexColor("#50627e"),
            spaceAfter=12,
        )
    )
    styles.add(
        ParagraphStyle(
            name="CoverSummary",
            parent=styles["Normal"],
            fontName=FONT_NAME,
            fontSize=11.4,
            leading=20,
            alignment=TA_JUSTIFY,
            textColor=colors.HexColor("#334155"),
            backColor=colors.HexColor("#ffffff"),
            borderPadding=12,
            borderRadius=14,
            spaceAfter=10,
        )
    )
    styles.add(
        ParagraphStyle(
            name="Label",
            parent=styles["Normal"],
            fontName=FONT_NAME_BOLD,
            fontSize=10.3,
            leading=14,
            alignment=TA_CENTER,
            textColor=colors.HexColor("#1d4ed8"),
            backColor=colors.HexColor("#edf4ff"),
            borderPadding=(6, 10, 6, 10),
            borderRadius=12,
        )
    )
    styles.add(
        ParagraphStyle(
            name="Meta",
            parent=styles["Normal"],
            fontName=FONT_NAME,
            fontSize=10.2,
            leading=16,
            textColor=colors.HexColor("#64748b"),
            alignment=TA_LEFT,
        )
    )
    styles.add(
        ParagraphStyle(
            name="TOCTitle",
            parent=styles["Heading1"],
            fontName=FONT_NAME_BOLD,
            fontSize=23,
            leading=30,
            textColor=colors.HexColor("#10213a"),
            spaceAfter=10,
        )
    )
    styles.add(
        ParagraphStyle(
            name="Body",
            parent=styles["Normal"],
            fontName=FONT_NAME,
            fontSize=11.2,
            leading=20,
            alignment=TA_JUSTIFY,
            firstLineIndent=22,
            textColor=colors.HexColor("#1f2937"),
            spaceAfter=6.5,
        )
    )
    styles.add(
        ParagraphStyle(
            name="BodyNoIndent",
            parent=styles["Normal"],
            fontName=FONT_NAME,
            fontSize=11.1,
            leading=19,
            alignment=TA_JUSTIFY,
            textColor=colors.HexColor("#475569"),
            spaceAfter=6.5,
        )
    )
    styles.add(
        ParagraphStyle(
            name="SectionTitle",
            parent=styles["Heading1"],
            fontName=FONT_NAME_BOLD,
            fontSize=18,
            leading=26,
            textColor=colors.HexColor("#10213a"),
            spaceBefore=6,
            spaceAfter=10,
        )
    )
    styles.add(
        ParagraphStyle(
            name="H2",
            parent=styles["Heading2"],
            fontName=FONT_NAME_BOLD,
            fontSize=14,
            leading=22,
            textColor=colors.HexColor("#1d4ed8"),
            spaceBefore=9,
            spaceAfter=5,
        )
    )
    styles.add(
        ParagraphStyle(
            name="H3",
            parent=styles["Heading3"],
            fontName=FONT_NAME_BOLD,
            fontSize=12.2,
            leading=19,
            textColor=colors.HexColor("#24364f"),
            spaceBefore=7,
            spaceAfter=3,
        )
    )
    styles.add(
        ParagraphStyle(
            name="BPBullet",
            parent=styles["Normal"],
            fontName=FONT_NAME,
            fontSize=11.1,
            leading=19,
            leftIndent=18,
            bulletIndent=2,
            textColor=colors.HexColor("#1f2937"),
            spaceAfter=4,
        )
    )
    styles.add(
        ParagraphStyle(
            name="Quote",
            parent=styles["Normal"],
            fontName=FONT_NAME,
            fontSize=10.9,
            leading=18,
            leftIndent=16,
            rightIndent=10,
            textColor=colors.HexColor("#334155"),
            backColor=colors.HexColor("#eff6ff"),
            borderPadding=10,
            borderRadius=10,
            spaceAfter=6,
        )
    )
    styles.add(
        ParagraphStyle(
            name="ChapterPill",
            parent=styles["Normal"],
            fontName=FONT_NAME_BOLD,
            fontSize=10.5,
            leading=15,
            textColor=colors.HexColor("#1d4ed8"),
            backColor=colors.HexColor("#dbeafe"),
            borderPadding=(6, 14, 6, 14),
            borderRadius=12,
            spaceAfter=12,
        )
    )
    styles.add(
        ParagraphStyle(
            name="ChapterNo",
            parent=styles["Title"],
            fontName=FONT_NAME_BOLD,
            fontSize=40,
            leading=44,
            textColor=colors.HexColor("#1d4ed8"),
            spaceAfter=2,
        )
    )
    styles.add(
        ParagraphStyle(
            name="ChapterTitle",
            parent=styles["Heading1"],
            fontName=FONT_NAME_BOLD,
            fontSize=24,
            leading=32,
            textColor=colors.HexColor("#10213a"),
            spaceAfter=8,
        )
    )
    styles.add(
        ParagraphStyle(
            name="ChapterSummary",
            parent=styles["Normal"],
            fontName=FONT_NAME,
            fontSize=11.6,
            leading=20,
            textColor=colors.HexColor("#475569"),
            alignment=TA_JUSTIFY,
            spaceAfter=8,
        )
    )
    styles.add(
        ParagraphStyle(
            name="BlockTitle",
            parent=styles["Heading2"],
            fontName=FONT_NAME_BOLD,
            fontSize=17,
            leading=25,
            textColor=colors.HexColor("#10213a"),
            alignment=TA_CENTER,
            spaceAfter=6,
        )
    )
    styles.add(
        ParagraphStyle(
            name="BlockBody",
            parent=styles["Normal"],
            fontName=FONT_NAME,
            fontSize=11,
            leading=18,
            textColor=colors.HexColor("#5b6b85"),
            alignment=TA_CENTER,
            spaceAfter=10,
        )
    )
    styles.add(
        ParagraphStyle(
            name="Caption",
            parent=styles["Normal"],
            fontName=FONT_NAME,
            fontSize=10,
            leading=15,
            alignment=TA_CENTER,
            textColor=colors.HexColor("#62748b"),
            spaceAfter=0,
        )
    )
    styles.add(
        ParagraphStyle(
            name="WebsiteUrl",
            parent=styles["Normal"],
            fontName=FONT_NAME_BOLD,
            fontSize=12.2,
            leading=18,
            textColor=colors.HexColor("#1d4ed8"),
            alignment=TA_LEFT,
            spaceAfter=6,
        )
    )
    styles.add(
        ParagraphStyle(
            name="Tiny",
            parent=styles["Normal"],
            fontName=FONT_NAME,
            fontSize=9.2,
            leading=14,
            textColor=colors.HexColor("#7b8ba5"),
        )
    )
    return styles


def load_layout() -> dict:
    return json.loads(LAYOUT.read_text(encoding="utf-8"))


def inline_format(text: str) -> str:
    text = escape(text.strip())
    text = re.sub(r"\*\*(.+?)\*\*", r"<b>\1</b>", text)
    text = re.sub(r"`(.+?)`", r"<b>\1</b>", text)
    return text


def parse_sections(markdown_text: str) -> list[Section]:
    sections: list[Section] = []
    current_title: str | None = None
    current_lines: list[str] = []

    for line in markdown_text.splitlines():
        if line.startswith("# "):
            continue
        if line.startswith("## "):
            if current_title is not None:
                sections.append(Section(current_title, current_lines))
            current_title = line[3:].strip()
            current_lines = []
        elif current_title is not None:
            current_lines.append(line)

    if current_title is not None:
        sections.append(Section(current_title, current_lines))
    return sections


def asset_path(relative_path: str) -> Path:
    return ROOT / relative_path.replace("/", "\\")


def fit_image(path: Path, max_width: float, max_height: float) -> Image:
    with PILImage.open(path) as image:
        width, height = image.size
    scale = min(max_width / width, max_height / height)
    return Image(str(path), width=width * scale, height=height * scale)


def draw_page(canvas, doc) -> None:
    page = canvas.getPageNumber()
    if page == 1:
        return
    canvas.saveState()
    canvas.setStrokeColor(colors.HexColor("#d7e3f6"))
    canvas.setLineWidth(0.5)
    canvas.line(18 * mm, 14 * mm, A4[0] - 18 * mm, 14 * mm)
    canvas.setFont(FONT_NAME, 8.8)
    canvas.setFillColor(colors.HexColor("#71839c"))
    canvas.drawString(18 * mm, 8.5 * mm, "灵语智造 LinguaCNC｜正式参赛版")
    canvas.drawCentredString(A4[0] / 2, 8.5 * mm, f"{page}")
    canvas.restoreState()


def extract_toc_titles(sections: Iterable[Section]) -> list[str]:
    return [section.title for section in sections]


def make_label_row(labels: list[str], styles: StyleSheet1) -> Table:
    cells = [
        Paragraph(inline_format(label), styles["Label"])
        for label in labels
    ]
    table = Table([cells], colWidths=[42 * mm] * len(cells))
    table.setStyle(
        TableStyle(
            [
                ("LEFTPADDING", (0, 0), (-1, -1), 0),
                ("RIGHTPADDING", (0, 0), (-1, -1), 8),
                ("TOPPADDING", (0, 0), (-1, -1), 0),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 0),
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
            ]
        )
    )
    return table


def add_cover(story: list, layout: dict, styles: StyleSheet1) -> None:
    cover = layout["cover"]
    hero = fit_image(asset_path(cover["heroAsset"]), 164 * mm, 88 * mm)
    story.extend(
        [
            Spacer(1, 12 * mm),
            Paragraph(cover["eyebrow"], styles["CoverEyebrow"]),
            Paragraph(cover["title"], styles["CoverTitle"]),
            Paragraph(cover["subtitle"], styles["CoverSubtitle"]),
            Paragraph(cover["summary"], styles["CoverSummary"]),
            Spacer(1, 2 * mm),
            make_label_row(cover["labels"], styles),
            Spacer(1, 8 * mm),
            hero,
            Spacer(1, 8 * mm),
            HRFlowable(color=colors.HexColor("#dbe7fb"), thickness=1.2, width="100%"),
            Spacer(1, 5 * mm),
            Paragraph(
                "文稿用途：正式申报正文 / 路演展示底稿 / 视觉升级版项目材料",
                styles["Meta"],
            ),
            Paragraph(
                "内容说明：保留占位信息，后续可继续替换团队、院校、导师、试点与财务口径。",
                styles["Meta"],
            ),
            Paragraph(
                f"项目入口：{layout['siteUrl']}",
                styles["Meta"],
            ),
            PageBreak(),
        ]
    )


def add_toc(story: list, sections: list[Section], styles: StyleSheet1) -> None:
    titles = extract_toc_titles(sections)
    story.append(Paragraph("目录", styles["TOCTitle"]))
    story.append(
        Paragraph(
            "本版本采用图文混排结构，兼顾正式申报场景的完整论证与路演答辩场景的视觉展示。以下目录按照正文逻辑顺序列出，便于评审快速定位重点章节。",
            styles["BodyNoIndent"],
        )
    )

    midpoint = math.ceil(len(titles) / 2)
    left = [Paragraph(f"{idx + 1}. {inline_format(title)}", styles["BodyNoIndent"]) for idx, title in enumerate(titles[:midpoint])]
    right = [Paragraph(f"{idx + 1 + midpoint}. {inline_format(title)}", styles["BodyNoIndent"]) for idx, title in enumerate(titles[midpoint:])]
    max_rows = max(len(left), len(right))
    rows = []
    for idx in range(max_rows):
        rows.append(
            [
                left[idx] if idx < len(left) else Paragraph("", styles["BodyNoIndent"]),
                right[idx] if idx < len(right) else Paragraph("", styles["BodyNoIndent"]),
            ]
        )

    toc_table = Table(rows, colWidths=[82 * mm, 82 * mm])
    toc_table.setStyle(
        TableStyle(
            [
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("LEFTPADDING", (0, 0), (-1, -1), 0),
                ("RIGHTPADDING", (0, 0), (-1, -1), 8),
                ("TOPPADDING", (0, 0), (-1, -1), 2),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
            ]
        )
    )
    story.extend([Spacer(1, 2 * mm), toc_table, PageBreak()])


def build_chapter_divider(chapter: dict, styles: StyleSheet1) -> list:
    image_path = asset_path(chapter["asset"])
    image = fit_image(image_path, 72 * mm, 96 * mm) if image_path.exists() else Spacer(1, 1)

    text_block = [
        Paragraph("正式参赛版章节", styles["ChapterPill"]),
        Paragraph(chapter["number"], styles["ChapterNo"]),
        Paragraph(chapter["title"], styles["ChapterTitle"]),
        Paragraph(chapter["summary"], styles["ChapterSummary"]),
    ]
    table = Table([[text_block, image]], colWidths=[96 * mm, 74 * mm])
    table.setStyle(
        TableStyle(
            [
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#ffffff")),
                ("BOX", (0, 0), (-1, -1), 1, colors.HexColor("#dbe7fb")),
                ("ROUNDEDCORNERS", (0, 0), (-1, -1), 18),
                ("LEFTPADDING", (0, 0), (-1, -1), 18),
                ("RIGHTPADDING", (0, 0), (-1, -1), 18),
                ("TOPPADDING", (0, 0), (-1, -1), 20),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 20),
            ]
        )
    )
    return [PageBreak(), Spacer(1, 20 * mm), table, PageBreak()]


def append_paragraph(story: list, styles: StyleSheet1, buffer: list[str]) -> None:
    if not buffer:
        return
    text = inline_format(" ".join(item.strip() for item in buffer if item.strip()))
    if text:
        story.append(Paragraph(text, styles["Body"]))
    buffer.clear()


def render_section_body(lines: list[str], styles: StyleSheet1) -> list:
    story: list = []
    buffer: list[str] = []

    for raw in lines:
        stripped = raw.strip()

        if not stripped:
            append_paragraph(story, styles, buffer)
            continue

        if stripped == "---":
            append_paragraph(story, styles, buffer)
            story.append(Spacer(1, 3 * mm))
            continue

        if stripped.startswith("### "):
            append_paragraph(story, styles, buffer)
            story.append(Paragraph(inline_format(stripped[4:]), styles["H2"]))
            continue

        if stripped.startswith("#### "):
            append_paragraph(story, styles, buffer)
            story.append(Paragraph(inline_format(stripped[5:]), styles["H3"]))
            continue

        if stripped.startswith("> "):
            append_paragraph(story, styles, buffer)
            story.append(Paragraph(inline_format(stripped[2:]), styles["Quote"]))
            continue

        bullet_match = re.match(r"^[-*]\s+(.+)$", stripped)
        if bullet_match:
            append_paragraph(story, styles, buffer)
            story.append(
                Paragraph(
                    inline_format(bullet_match.group(1)),
                    styles["BPBullet"],
                    bulletText="•",
                )
            )
            continue

        ordered_match = re.match(r"^\d+\.\s+(.+)$", stripped)
        if ordered_match:
            append_paragraph(story, styles, buffer)
            prefix = stripped.split(".", 1)[0]
            story.append(
                Paragraph(
                    inline_format(ordered_match.group(1)),
                    styles["BPBullet"],
                    bulletText=f"{prefix}.",
                )
            )
            continue

        buffer.append(stripped)

    append_paragraph(story, styles, buffer)
    return story


def make_gallery(block: dict, styles: StyleSheet1) -> list:
    story = [
        PageBreak(),
        Paragraph(block["title"], styles["BlockTitle"]),
        Paragraph(block["body"], styles["BlockBody"]),
        Spacer(1, 2 * mm),
    ]
    items = block["items"]
    rows = []
    col_width = 79 * mm
    image_height = 52 * mm
    current_row = []
    for item in items:
        image = fit_image(asset_path(item["asset"]), col_width, image_height)
        cell = [
            image,
            Spacer(1, 2 * mm),
            Paragraph(item["caption"], styles["Caption"]),
        ]
        current_row.append(cell)
        if len(current_row) == 2:
            rows.append(current_row)
            current_row = []
    if current_row:
        current_row.append(Spacer(1, 1))
        rows.append(current_row)

    table = Table(rows, colWidths=[80 * mm, 80 * mm])
    table.setStyle(
        TableStyle(
            [
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#ffffff")),
                ("BOX", (0, 0), (-1, -1), 1, colors.HexColor("#dbe7fb")),
                ("INNERGRID", (0, 0), (-1, -1), 0.8, colors.HexColor("#e8effc")),
                ("LEFTPADDING", (0, 0), (-1, -1), 10),
                ("RIGHTPADDING", (0, 0), (-1, -1), 10),
                ("TOPPADDING", (0, 0), (-1, -1), 12),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 12),
            ]
        )
    )
    story.extend([table, Spacer(1, 2 * mm)])
    return story


def make_image_block(block: dict, styles: StyleSheet1) -> list:
    image = fit_image(asset_path(block["asset"]), 160 * mm, 110 * mm)
    return [
        PageBreak(),
        Paragraph(block["title"], styles["BlockTitle"]),
        Paragraph(block["body"], styles["BlockBody"]),
        image,
        Spacer(1, 2 * mm),
    ]


def make_website_block(block: dict, styles: StyleSheet1) -> list:
    screenshot = fit_image(asset_path(block["asset"]), 100 * mm, 95 * mm)
    qr = fit_image(asset_path(block["qrAsset"]), 42 * mm, 42 * mm)
    right = [
        qr,
        Spacer(1, 4 * mm),
        Paragraph(block["url"], styles["WebsiteUrl"]),
        Paragraph(block["body"], styles["BodyNoIndent"]),
        Spacer(1, 2 * mm),
        Paragraph(block["footer"], styles["Tiny"]),
    ]
    table = Table([[screenshot, right]], colWidths=[104 * mm, 56 * mm])
    table.setStyle(
        TableStyle(
            [
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#ffffff")),
                ("BOX", (0, 0), (-1, -1), 1, colors.HexColor("#dbe7fb")),
                ("LEFTPADDING", (0, 0), (-1, -1), 12),
                ("RIGHTPADDING", (0, 0), (-1, -1), 12),
                ("TOPPADDING", (0, 0), (-1, -1), 12),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 12),
            ]
        )
    )
    return [
        PageBreak(),
        Paragraph(block["title"], styles["BlockTitle"]),
        Paragraph("将线上入口、二维码和真实页面截图作为项目成果证明材料纳入正文。", styles["BlockBody"]),
        table,
    ]


def build_block(block: dict, styles: StyleSheet1) -> list:
    block_type = block["type"]
    if block_type == "gallery":
        return make_gallery(block, styles)
    if block_type == "image":
        return make_image_block(block, styles)
    if block_type == "website":
        return make_website_block(block, styles)
    return []


def build_pdf() -> int:
    register_fonts()
    styles = build_styles()
    layout = load_layout()
    markdown = SOURCE.read_text(encoding="utf-8")
    sections = parse_sections(markdown)

    chapter_map = {item["at"]: item for item in layout["chapters"]}
    blocks_after: dict[str, list[dict]] = {}
    for block in layout["blocks"]:
        blocks_after.setdefault(block["after"], []).append(block)

    doc = BaseDocTemplate(
        str(TARGET),
        pagesize=A4,
        leftMargin=18 * mm,
        rightMargin=18 * mm,
        topMargin=18 * mm,
        bottomMargin=18 * mm,
        title="灵语智造 LinguaCNC 正式参赛版商业计划书",
        author="OpenAI Codex",
    )
    frame = Frame(doc.leftMargin, doc.bottomMargin, doc.width, doc.height, id="body")
    doc.addPageTemplates([PageTemplate(id="default", frames=[frame], onPage=draw_page)])

    story: list = []
    add_cover(story, layout, styles)
    add_toc(story, sections, styles)

    for section in sections:
        chapter = chapter_map.get(section.title)
        if chapter:
            story.extend(build_chapter_divider(chapter, styles))
        else:
            story.append(Paragraph(section.title, styles["SectionTitle"]))

        body_flowables = render_section_body(section.lines, styles)
        story.extend(body_flowables)

        for block in blocks_after.get(section.title, []):
            story.extend(build_block(block, styles))

    doc.build(story)
    return len(PdfReader(str(TARGET)).pages)


def main() -> None:
    pages = build_pdf()
    print(f"Generated: {TARGET}")
    print(f"Pages: {pages}")


if __name__ == "__main__":
    main()
