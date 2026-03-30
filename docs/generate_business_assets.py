from __future__ import annotations

import json
from pathlib import Path

import qrcode
from PIL import Image, ImageChops, ImageDraw, ImageFilter, ImageFont, ImageOps


ROOT = Path(__file__).resolve().parent
LAYOUT_PATH = ROOT / "business_plan_layout.json"
ASSET_ROOT = ROOT / "assets"
PPT_SLIDES = ASSET_ROOT / "ppt" / "slides"
DEMO_ROOT = ASSET_ROOT / "demo"
GENERATED_ROOT = ASSET_ROOT / "generated"

FONT_REGULAR = Path(r"C:\Windows\Fonts\msyh.ttc")
FONT_BOLD = Path(r"C:\Windows\Fonts\msyhbd.ttc")


def load_font(path: Path, size: int) -> ImageFont.FreeTypeFont:
    return ImageFont.truetype(str(path), size=size)


def ensure_dirs() -> None:
    GENERATED_ROOT.mkdir(parents=True, exist_ok=True)


def make_gradient(size: tuple[int, int], top: str, bottom: str) -> Image.Image:
    width, height = size
    base = Image.new("RGB", size, top)
    top_rgb = ImageColor(top)
    bottom_rgb = ImageColor(bottom)
    draw = ImageDraw.Draw(base)
    for y in range(height):
        ratio = y / max(height - 1, 1)
        color = tuple(
            int(top_rgb[i] + (bottom_rgb[i] - top_rgb[i]) * ratio) for i in range(3)
        )
        draw.line([(0, y), (width, y)], fill=color)
    return base


def ImageColor(hex_value: str) -> tuple[int, int, int]:
    value = hex_value.strip().lstrip("#")
    return tuple(int(value[i : i + 2], 16) for i in (0, 2, 4))


def rounded_mask(size: tuple[int, int], radius: int) -> Image.Image:
    mask = Image.new("L", size, 0)
    draw = ImageDraw.Draw(mask)
    draw.rounded_rectangle((0, 0, size[0], size[1]), radius=radius, fill=255)
    return mask


def place_card(
    canvas: Image.Image,
    source: Image.Image,
    box: tuple[int, int, int, int],
    radius: int = 28,
    shadow_offset: tuple[int, int] = (10, 16),
) -> None:
    x, y, w, h = box
    shadow = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    shadow_draw = ImageDraw.Draw(shadow)
    shadow_draw.rounded_rectangle((0, 0, w, h), radius=radius, fill=(39, 73, 138, 58))
    shadow = shadow.filter(ImageFilter.GaussianBlur(18))
    canvas.alpha_composite(shadow, (x + shadow_offset[0], y + shadow_offset[1]))

    fitted = ImageOps.fit(source.convert("RGB"), (w, h), method=Image.Resampling.LANCZOS)
    card = Image.new("RGBA", (w, h), (255, 255, 255, 255))
    card.paste(fitted, (0, 0))
    border = Image.new("RGBA", (w, h), (255, 255, 255, 0))
    border_draw = ImageDraw.Draw(border)
    border_draw.rounded_rectangle(
        (0, 0, w - 1, h - 1), radius=radius, outline=(255, 255, 255, 185), width=3
    )
    mask = rounded_mask((w, h), radius)
    card.putalpha(mask)
    canvas.alpha_composite(card, (x, y))
    canvas.alpha_composite(border, (x, y))


def draw_pill(
    draw: ImageDraw.ImageDraw,
    xy: tuple[int, int],
    text: str,
    fill: str,
    text_fill: str,
    font: ImageFont.FreeTypeFont,
) -> int:
    bbox = draw.textbbox((0, 0), text, font=font)
    width = bbox[2] - bbox[0] + 34
    height = bbox[3] - bbox[1] + 18
    x, y = xy
    draw.rounded_rectangle((x, y, x + width, y + height), radius=height // 2, fill=fill)
    draw.text((x + 17, y + 8), text, font=font, fill=text_fill)
    return width


def generate_qr(url: str) -> Path:
    qr = qrcode.QRCode(border=2, box_size=10)
    qr.add_data(url)
    qr.make(fit=True)
    image = qr.make_image(fill_color="#0f3b89", back_color="white").convert("RGB")
    image = ImageOps.expand(image, border=20, fill="white")
    target = GENERATED_ROOT / "demo-qr.png"
    image.save(target)
    return target


def generate_cover_collage(layout: dict) -> Path:
    canvas = Image.new("RGBA", (1800, 1100), (245, 248, 255, 255))
    bg_draw = ImageDraw.Draw(canvas)
    bg_draw.ellipse((-200, -180, 520, 430), fill=(208, 228, 255, 235))
    bg_draw.ellipse((1200, -140, 1880, 500), fill=(220, 234, 255, 220))
    bg_draw.ellipse((1080, 620, 1870, 1280), fill=(232, 241, 255, 245))
    bg_draw.ellipse((-260, 720, 420, 1280), fill=(242, 247, 255, 245))

    title_font = load_font(FONT_BOLD, 72)
    body_font = load_font(FONT_REGULAR, 28)
    pill_font = load_font(FONT_BOLD, 24)
    small_font = load_font(FONT_REGULAR, 22)

    bg_draw.text((110, 120), "AI 数控编程", font=title_font, fill="#0f1d33")
    bg_draw.text((110, 210), "与三维仿真协同平台", font=title_font, fill="#1d4ed8")
    bg_draw.text(
        (115, 330),
        "融合自然语言交互、结构化工序生成、G 代码输出、\n三维切削仿真、工艺单管理与多端部署的智能制造工具。",
        font=body_font,
        fill="#44556f",
        spacing=10,
    )

    pill_x = 112
    for text, fill, text_fill in (
        ("开源社区驱动", "#dbeafe", "#1d4ed8"),
        ("教学与企业双场景", "#e7f7ee", "#15803d"),
        ("正式参赛版视觉", "#fdf2f8", "#be185d"),
    ):
        width = draw_pill(bg_draw, (pill_x, 452), text, fill, text_fill, pill_font)
        pill_x += width + 18

    bg_draw.rounded_rectangle((96, 528, 690, 770), radius=34, fill=(255, 255, 255, 210))
    bg_draw.text((128, 564), "项目亮点", font=load_font(FONT_BOLD, 34), fill="#10213a")
    bullet_y = 622
    bullets = [
        "自然语言与图纸输入驱动数控编程",
        "结构化工序 + 规则引擎提升稳定性",
        "Three.js 仿真与工艺单形成闭环",
        "已完成线上 demo 部署与多端适配"
    ]
    for item in bullets:
        bg_draw.ellipse((126, bullet_y + 10, 140, bullet_y + 24), fill="#2563eb")
        bg_draw.text((160, bullet_y), item, font=small_font, fill="#334155")
        bullet_y += 42

    cards = [
        ("slide-11.png", (830, 92, 420, 270)),
        ("slide-12.png", (1288, 150, 390, 250)),
        ("slide-14.png", (864, 410, 454, 290)),
        ("demo-home.png", (1330, 462, 302, 480))
    ]
    for name, box in cards:
        path = PPT_SLIDES / name
        if not path.exists():
            path = DEMO_ROOT / name
        image = Image.open(path)
        place_card(canvas, image, box)

    accent = Image.new("RGBA", canvas.size, (0, 0, 0, 0))
    accent_draw = ImageDraw.Draw(accent)
    accent_draw.rounded_rectangle((770, 64, 1722, 1028), radius=48, outline=(255, 255, 255, 138), width=4)
    accent = accent.filter(ImageFilter.GaussianBlur(0.5))
    canvas.alpha_composite(accent)

    target = GENERATED_ROOT / "cover-collage.png"
    canvas.convert("RGB").save(target, quality=95)
    return target


def generate_finance_overview() -> Path:
    width, height = 1600, 940
    canvas = Image.new("RGB", (width, height), "#f7faff")
    draw = ImageDraw.Draw(canvas)
    title_font = load_font(FONT_BOLD, 54)
    sub_font = load_font(FONT_REGULAR, 24)
    card_title = load_font(FONT_BOLD, 28)
    num_font = load_font(FONT_BOLD, 48)
    axis_font = load_font(FONT_REGULAR, 22)

    draw.text((88, 70), "三年财务预测概览", font=title_font, fill="#0f1d33")
    draw.text((90, 150), "单位：万元。基于教育版订阅、企业试点、服务收入与私有化部署的保守测算。", font=sub_font, fill="#5b6b85")

    metrics = [
        ("第一年", "80", "验证产品价值与样板客户"),
        ("第二年", "260", "区域复制与标准版拓展"),
        ("第三年", "680", "平台增长与高客单转化")
    ]
    x = 88
    for label, value, desc in metrics:
        draw.rounded_rectangle((x, 214, x + 440, 382), radius=32, fill="white", outline="#d6e4fb", width=3)
        draw.text((x + 34, 246), label, font=card_title, fill="#1d4ed8")
        draw.text((x + 34, 295), value, font=num_font, fill="#10213a")
        draw.text((x + 150, 312), "预计营业收入", font=sub_font, fill="#66768f")
        draw.text((x + 34, 352), desc, font=axis_font, fill="#5b6b85")
        x += 470

    chart_box = (90, 438, 1500, 840)
    draw.rounded_rectangle(chart_box, radius=36, fill="white", outline="#d6e4fb", width=3)
    origin_x, origin_y = 180, 760
    chart_w, chart_h = 1230, 250
    draw.line((origin_x, origin_y - chart_h, origin_x, origin_y), fill="#aac4ef", width=3)
    draw.line((origin_x, origin_y, origin_x + chart_w, origin_y), fill="#aac4ef", width=3)

    y_labels = [0, 150, 300, 450, 600, 750]
    max_value = 750
    for val in y_labels:
        y = origin_y - int(chart_h * (val / max_value))
        draw.line((origin_x, y, origin_x + chart_w, y), fill="#eef4ff", width=2)
        draw.text((114, y - 12), str(val), font=axis_font, fill="#7b8ba5")

    years = ["第一年", "第二年", "第三年"]
    revenue = [80, 260, 680]
    cost = [110, 232, 515]
    profit = [-30, 28, 165]
    colors = ["#2563eb", "#93c5fd", "#ef4444"]
    legends = [("营业收入", colors[0]), ("成本费用", colors[1]), ("净利润", colors[2])]

    legend_x = 1020
    for idx, (label, color) in enumerate(legends):
        lx = legend_x + idx * 156
        draw.rounded_rectangle((lx, 470, lx + 28, 498), radius=10, fill=color)
        draw.text((lx + 40, 468), label, font=axis_font, fill="#355072")

    cluster_w = chart_w // 3
    bar_w = 54
    for idx, year in enumerate(years):
        cx = origin_x + cluster_w * idx + 110
        values = [revenue[idx], cost[idx], max(profit[idx], 0)]
        for series_idx, value in enumerate(values):
            bx = cx + series_idx * 84
            bar_h = int(chart_h * (value / max_value))
            by = origin_y - bar_h
            draw.rounded_rectangle((bx, by, bx + bar_w, origin_y), radius=18, fill=colors[series_idx])
            draw.text((bx + 4, by - 34), str(value if series_idx < 2 else profit[idx]), font=axis_font, fill="#334155")
        if profit[idx] < 0:
            bx = cx + 2 * 84
            neg_h = int(chart_h * (abs(profit[idx]) / max_value))
            draw.rounded_rectangle((bx, origin_y, bx + bar_w, origin_y + neg_h), radius=18, fill="#fecaca")
            draw.text((bx + 2, origin_y + neg_h + 6), str(profit[idx]), font=axis_font, fill="#991b1b")
        draw.text((cx + 22, 790), year, font=axis_font, fill="#334155")

    target = GENERATED_ROOT / "finance-overview.png"
    canvas.save(target, quality=95)
    return target


def generate_roadmap_overview() -> Path:
    width, height = 1600, 980
    canvas = Image.new("RGB", (width, height), "#f7faff")
    draw = ImageDraw.Draw(canvas)
    title_font = load_font(FONT_BOLD, 54)
    sub_font = load_font(FONT_REGULAR, 24)
    card_title = load_font(FONT_BOLD, 28)
    body_font = load_font(FONT_REGULAR, 24)

    draw.text((92, 70), "项目实施路径与里程碑", font=title_font, fill="#0f1d33")
    draw.text((94, 150), "围绕原型打磨、样板验证、标准化交付与平台增长四阶段推进，形成可检查、可落地、可复制的执行路线。", font=sub_font, fill="#5b6b85")

    stages = [
        ("阶段一", "0-6 个月", "原型稳定化", ["完善演示主流程", "补强案例库", "建立校内样板"]),
        ("阶段二", "6-12 个月", "标准试用版", ["推出教育标准包", "沉淀课程模板", "启动企业试点"]),
        ("阶段三", "12-24 个月", "商业交付版", ["强化权限与部署", "拓展设备适配", "形成签约能力"]),
        ("阶段四", "24-36 个月", "平台增长版", ["拓展生态合作", "沉淀知识库", "提升复购与壁垒"])
    ]
    line_y = 410
    draw.line((150, line_y, 1450, line_y), fill="#c8daf7", width=8)
    for idx, (stage, period, title, bullets) in enumerate(stages):
        card_x = 90 + idx * 365
        top = 220 if idx % 2 == 0 else 470
        draw.rounded_rectangle((card_x, top, card_x + 310, top + 250), radius=30, fill="white", outline="#d6e4fb", width=3)
        draw.rounded_rectangle((card_x + 24, top + 24, card_x + 128, top + 70), radius=22, fill="#dbeafe")
        draw.text((card_x + 42, top + 34), stage, font=load_font(FONT_BOLD, 22), fill="#1d4ed8")
        draw.text((card_x + 176, top + 34), period, font=load_font(FONT_REGULAR, 20), fill="#64748b")
        draw.text((card_x + 24, top + 88), title, font=card_title, fill="#10213a")
        bullet_y = top + 140
        for item in bullets:
            draw.ellipse((card_x + 26, bullet_y + 10, card_x + 38, bullet_y + 22), fill="#2563eb")
            draw.text((card_x + 52, bullet_y), item, font=body_font, fill="#41536e")
            bullet_y += 42
        circle_x = card_x + 156
        draw.ellipse((circle_x - 18, line_y - 18, circle_x + 18, line_y + 18), fill="#1d4ed8", outline="white", width=6)
        if top < line_y:
            draw.line((circle_x, top + 250, circle_x, line_y - 18), fill="#a7c2ef", width=5)
        else:
            draw.line((circle_x, line_y + 18, circle_x, top), fill="#a7c2ef", width=5)

    target = GENERATED_ROOT / "roadmap-overview.png"
    canvas.save(target, quality=95)
    return target


def main() -> None:
    ensure_dirs()
    layout = json.loads(LAYOUT_PATH.read_text(encoding="utf-8"))
    generate_qr(layout["siteUrl"])
    generate_cover_collage(layout)
    generate_finance_overview()
    generate_roadmap_overview()


if __name__ == "__main__":
    main()
