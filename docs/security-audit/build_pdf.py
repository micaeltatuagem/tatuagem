# -*- coding: utf-8 -*-
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import cm
from reportlab.lib import colors as rl_colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_LEFT, TA_CENTER, TA_JUSTIFY
from reportlab.platypus import (
    BaseDocTemplate, PageTemplate, Frame, Paragraph, Spacer, Table, TableStyle,
    Image, PageBreak, KeepTogether, HRFlowable, ListFlowable, ListItem
)
from reportlab.pdfgen import canvas as pdfcanvas

from audit_data import (
    FINDINGS, STRENGTHS, RECOMMENDATIONS, GITHUB_ISSUES, COLORS, SEV_LABEL,
    PROJECT_NAME, AUDIT_DATE, COMMIT_SHA, SCOPE_TEXT, METHODOLOGY_TEXT,
    FIXED_IDS, VERIFIED_OK_IDS, POST_AUDIT_NOTE,
)

OUT = "relatorio-auditoria-seguranca.pdf"
REPORT_TITLE = "Relatório de Auditoria de Segurança"

PAGE_W, PAGE_H = A4
MARGIN = 2 * cm

# ---------------------------------------------------------------------------
# Styles
# ---------------------------------------------------------------------------
styles = getSampleStyleSheet()

styles.add(ParagraphStyle(name="CoverTitle", fontName="Helvetica-Bold", fontSize=25,
                           leading=30, textColor=rl_colors.HexColor("#111111"), alignment=TA_LEFT))
styles.add(ParagraphStyle(name="CoverSub", fontName="Helvetica", fontSize=14,
                           leading=18, textColor=rl_colors.HexColor("#7a8c3a"), alignment=TA_LEFT))
styles.add(ParagraphStyle(name="CoverMeta", fontName="Helvetica", fontSize=10.5,
                           leading=16, textColor=rl_colors.HexColor("#374151"), alignment=TA_LEFT))
styles.add(ParagraphStyle(name="H1", fontName="Helvetica-Bold", fontSize=17, leading=21,
                           textColor=rl_colors.HexColor("#111111"), spaceBefore=6, spaceAfter=10))
styles.add(ParagraphStyle(name="H2", fontName="Helvetica-Bold", fontSize=12.5, leading=16,
                           textColor=rl_colors.HexColor("#1f2937"), spaceBefore=12, spaceAfter=6))
styles.add(ParagraphStyle(name="Body", fontName="Helvetica", fontSize=9.4, leading=13.4,
                           textColor=rl_colors.HexColor("#1f2937"), alignment=TA_JUSTIFY, spaceAfter=5))
styles.add(ParagraphStyle(name="BodySmall", fontName="Helvetica", fontSize=8.4, leading=12,
                           textColor=rl_colors.HexColor("#374151"), alignment=TA_JUSTIFY, spaceAfter=4))
styles.add(ParagraphStyle(name="Mono", fontName="Courier", fontSize=8, leading=11.5,
                           textColor=rl_colors.HexColor("#111111"), backColor=rl_colors.HexColor("#f3f4f6"),
                           borderPadding=5, spaceAfter=5, spaceBefore=2))
styles.add(ParagraphStyle(name="FindTitle", fontName="Helvetica-Bold", fontSize=10.8, leading=14,
                           textColor=rl_colors.HexColor("#111111"), spaceBefore=2, spaceAfter=3))
styles.add(ParagraphStyle(name="Label", fontName="Helvetica-Bold", fontSize=8.6, leading=12,
                           textColor=rl_colors.HexColor("#6b7280")))
styles.add(ParagraphStyle(name="TocEntry", fontName="Helvetica", fontSize=10, leading=16,
                           textColor=rl_colors.HexColor("#1f2937")))
styles.add(ParagraphStyle(name="Footer", fontName="Helvetica", fontSize=7.6,
                           textColor=rl_colors.HexColor("#9ca3af")))
styles.add(ParagraphStyle(name="IssueBody", fontName="Courier", fontSize=7.6, leading=10.8,
                           textColor=rl_colors.HexColor("#111111")))

SEV_ORDER = ["critica", "alta", "media", "baixa", "informativa"]


def sev_chip(sev):
    c = COLORS[sev]
    return f'<font color="{c}"><b>{SEV_LABEL[sev].upper()}</b></font>'


def para(txt, style="Body"):
    return Paragraph(txt, styles[style])


# ---------------------------------------------------------------------------
# Page decorations (header/footer)
# ---------------------------------------------------------------------------
class NumberedCanvas:
    pass


def draw_header_footer(c: pdfcanvas.Canvas, doc):
    c.saveState()
    # Header line (skip on cover page)
    if doc.page > 1:
        c.setFont("Helvetica", 8)
        c.setFillColor(rl_colors.HexColor("#9ca3af"))
        c.drawString(MARGIN, PAGE_H - 1.35 * cm, "Relatório de Auditoria de Segurança — micaeltatuagem/tatuagem")
        c.setStrokeColor(rl_colors.HexColor("#e5e7eb"))
        c.setLineWidth(0.6)
        c.line(MARGIN, PAGE_H - 1.5 * cm, PAGE_W - MARGIN, PAGE_H - 1.5 * cm)
        # Footer
        c.setLineWidth(0.6)
        c.line(MARGIN, 1.5 * cm, PAGE_W - MARGIN, 1.5 * cm)
        c.setFont("Helvetica", 8)
        c.drawString(MARGIN, 1.15 * cm, "micaeltatuagem.com.br — auditoria interna")
        c.drawRightString(PAGE_W - MARGIN, 1.15 * cm, f"Página {doc.page - 1}")
    c.restoreState()


doc = BaseDocTemplate(
    OUT, pagesize=A4,
    leftMargin=MARGIN, rightMargin=MARGIN, topMargin=MARGIN, bottomMargin=MARGIN,
    title=REPORT_TITLE, author="Auditoria automatizada (Claude)",
)

frame_cover = Frame(MARGIN, MARGIN, PAGE_W - 2 * MARGIN, PAGE_H - 2 * MARGIN, id="cover")
frame_normal = Frame(MARGIN, MARGIN, PAGE_W - 2 * MARGIN, PAGE_H - 2 * MARGIN - 0.4 * cm, id="normal")

doc.addPageTemplates([
    PageTemplate(id="Cover", frames=[frame_cover], onPage=draw_header_footer),
    PageTemplate(id="Normal", frames=[frame_normal], onPage=draw_header_footer),
])

story = []

# ===========================================================================
# CAPA
# ===========================================================================
story.append(Spacer(1, 3.0 * cm))
story.append(para(REPORT_TITLE, "CoverTitle"))
story.append(para(f"— {PROJECT_NAME}", "CoverSub"))
story.append(Spacer(1, 0.8 * cm))
story.append(HRFlowable(width="100%", thickness=1.2, color=rl_colors.HexColor("#7a8c3a")))
story.append(Spacer(1, 0.5 * cm))

meta_rows = [
    ["Data da auditoria", AUDIT_DATE],
    ["Commit auditado", COMMIT_SHA],
    ["Repositório", "github.com/" + PROJECT_NAME + " (público)"],
    ["Tipo de auditoria", "Revisão estática de código-fonte (SAST manual)"],
]
meta_table = Table(meta_rows, colWidths=[4.5 * cm, 10.5 * cm])
meta_table.setStyle(TableStyle([
    ("FONTNAME", (0, 0), (0, -1), "Helvetica-Bold"),
    ("FONTNAME", (1, 0), (1, -1), "Helvetica"),
    ("FONTSIZE", (0, 0), (-1, -1), 9.5),
    ("TEXTCOLOR", (0, 0), (0, -1), rl_colors.HexColor("#6b7280")),
    ("TEXTCOLOR", (1, 0), (1, -1), rl_colors.HexColor("#111111")),
    ("BOTTOMPADDING", (0, 0), (-1, -1), 7),
    ("TOPPADDING", (0, 0), (-1, -1), 0),
    ("VALIGN", (0, 0), (-1, -1), "TOP"),
]))
story.append(meta_table)
story.append(Spacer(1, 0.7 * cm))

story.append(para("<b>Escopo auditado</b>", "H2"))
story.append(para(SCOPE_TEXT, "BodySmall"))
story.append(Spacer(1, 0.2 * cm))
story.append(para("<b>Nota metodológica</b>", "H2"))
story.append(para(METHODOLOGY_TEXT, "BodySmall"))

story.append(Spacer(1, 0.5 * cm))
story.append(HRFlowable(width="100%", thickness=0.6, color=rl_colors.HexColor("#e5e7eb")))
story.append(Spacer(1, 0.25 * cm))
story.append(para(
    "Este relatório foi gerado por uma revisão manual assistida do código-fonte publicado no repositório. "
    "Achados são reportados apenas quando verificados diretamente no código; onde a verificação completa "
    "dependia de configuração externa ao repositório (ex.: políticas RLS do Supabase), isso é declarado "
    "explicitamente em cada achado.", "BodySmall"))

story.append(PageBreak())
story[-1] = story[-1]  # noop
# Switch to normal template from here on
from reportlab.platypus import NextPageTemplate
story.insert(len(story) - 1, NextPageTemplate("Normal"))

# ===========================================================================
# RESUMO EXECUTIVO
# ===========================================================================
story.append(para("Resumo executivo", "H1"))

if FIXED_IDS:
    fix_box = Table(
        [[Paragraph(f'<font color="{COLORS["forte"]}"><b>✓ Status pós-auditoria:</b></font> '
                    f'{POST_AUDIT_NOTE}', styles["BodySmall"])]],
        colWidths=[17.0 * cm],
    )
    fix_box.setStyle(TableStyle([
        ("BOX", (0, 0), (-1, -1), 0.8, rl_colors.HexColor(COLORS["forte"])),
        ("BACKGROUND", (0, 0), (-1, -1), rl_colors.HexColor("#ecfdf5")),
        ("TOPPADDING", (0, 0), (-1, -1), 8),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
        ("LEFTPADDING", (0, 0), (-1, -1), 10),
        ("RIGHTPADDING", (0, 0), (-1, -1), 10),
    ]))
    story.append(fix_box)
    story.append(Spacer(1, 0.3 * cm))

sev_counts = {s: 0 for s in SEV_ORDER}
for f in FINDINGS:
    sev_counts[f["sev"]] += 1

summary_cells = []
for s in SEV_ORDER:
    summary_cells.append([
        Paragraph(f'<font size="20" color="{COLORS[s]}"><b>{sev_counts[s]}</b></font>', styles["Body"]),
        Paragraph(f'<font size="8" color="#6b7280">{SEV_LABEL[s]}</font>', styles["Body"]),
    ])
sumtab = Table([[c[0] for c in summary_cells], [c[1] for c in summary_cells]],
                colWidths=[3.16 * cm] * 5)
sumtab.setStyle(TableStyle([
    ("ALIGN", (0, 0), (-1, -1), "CENTER"),
    ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
    ("BOX", (0, 0), (-1, -1), 0.6, rl_colors.HexColor("#e5e7eb")),
    ("INNERGRID", (0, 0), (-1, -1), 0.6, rl_colors.HexColor("#e5e7eb")),
    ("TOPPADDING", (0, 0), (-1, 0), 10),
    ("BOTTOMPADDING", (0, 1), (-1, 1), 10),
]))
story.append(sumtab)
story.append(Spacer(1, 0.4 * cm))

charts_tbl = Table([[
    Image("chart_severidade.png", width=8.4 * cm, height=6.9 * cm),
    Image("chart_categoria.png", width=8.4 * cm, height=6.9 * cm),
]], colWidths=[8.4 * cm, 8.4 * cm])
charts_tbl.setStyle(TableStyle([("VALIGN", (0, 0), (-1, -1), "TOP")]))
story.append(charts_tbl)

story.append(Spacer(1, 0.3 * cm))
story.append(para(
    "O achado crítico (C1) e três dos quatro achados de severidade alta (A2, A4, e parte de A1) formam uma "
    "cadeia única: a ausência de autenticação real no painel do Guia habilita escrita irrestrita em "
    "guia_verbetes, que por sua vez alimenta um path traversal na geração estática e um vetor de XSS via "
    "href — corrigir C1 neutraliza a explorabilidade prática de A2 e A4, mas ambos devem ser corrigidos "
    "de forma independente (defesa em profundidade).", "Body"))

story.append(PageBreak())

# ===========================================================================
# PONTOS FORTES E FRACOS
# ===========================================================================
story.append(para("Pontos fortes", "H1"))
story.append(para(
    "O que foi verificado no código e está protegido corretamente — evidencia a cobertura desta auditoria.",
    "BodySmall"))
story.append(Spacer(1, 0.15 * cm))

strength_items = []
for s in STRENGTHS:
    strength_items.append(ListItem(
        Paragraph(f'<font color="{COLORS["forte"]}"><b>{s["title"]}</b></font><br/>'
                  f'<font size="8.4" color="#4b5563">{s["evidence"]}</font>', styles["BodySmall"]),
        bulletColor=rl_colors.HexColor(COLORS["forte"]), leftIndent=12, spaceAfter=8,
    ))
story.append(ListFlowable(strength_items, bulletType="bullet", start="circle"))

story.append(Spacer(1, 0.5 * cm))
weak_header = para("Pontos fracos — riscos centrais", "H1")
weak_summary = [
    ("C1", "Painel do Guia sem autenticação real; endpoint público sem login algum"),
    ("A1", "Senha admin do Guia exposta permanentemente no histórico git"),
    ("A2", "Path traversal via slug não sanitizado na geração estática do Guia"),
    ("A3", "Sem rate limiting na senha que protege a escrita de todo o repositório"),
    ("A4", "XSS armazenado via URL javascript: em campo gravável sem autenticação"),
    ("M1/M2", "IDOR: enumeração de clientes por código de indicação e por WhatsApp"),
    ("M3/M4", "Regras de negócio e dado sensível (CPF/RG/saúde) dependem de RLS não verificável no repo"),
]
rows = [[Paragraph(f"<b>{i}</b>", styles["BodySmall"]), Paragraph(d, styles["BodySmall"])] for i, d in weak_summary]
wt = Table(rows, colWidths=[2.0 * cm, 14.8 * cm])
wt.setStyle(TableStyle([
    ("VALIGN", (0, 0), (-1, -1), "TOP"),
    ("TOPPADDING", (0, 0), (-1, -1), 4),
    ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
    ("LINEBELOW", (0, 0), (-1, -2), 0.4, rl_colors.HexColor("#e5e7eb")),
]))
story.append(KeepTogether([weak_header, Spacer(1, 0.1 * cm), wt]))

story.append(PageBreak())

# ===========================================================================
# ACHADOS DETALHADOS
# ===========================================================================
story.append(para("Achados detalhados", "H1"))
story.append(para(
    "Cada achado lista arquivo(s) e linha(s) exatos, descrição do problema, impacto, condição de "
    "explorabilidade e sugestão de correção. Achados marcados como \"item de verificação\" não foram "
    "confirmados como vulnerabilidade a partir do código-fonte — o repositório não contém as políticas RLS "
    "do Supabase, que vivem só no dashboard.", "BodySmall"))
story.append(Spacer(1, 0.2 * cm))

cat_order = ["1. Banco sem tranca", "2. Permissão no navegador", "3. IDOR", "4. Chaves expostas", "5. XSS"]
for cat in cat_order:
    cat_findings = [f for f in FINDINGS if f["cat"] == cat]
    if not cat_findings:
        story.append(para(f"<b>{cat}</b> — categoria não aplicável / sem achados verificados.", "H2"))
        continue
    story.append(para(cat, "H2"))
    for f in sorted(cat_findings, key=lambda x: -{"critica": 4, "alta": 3, "media": 2, "baixa": 1, "informativa": 0}[x["sev"]]):
        block = []
        header = f'[{f["id"]}] {sev_chip(f["sev"])} — {f["title"]}'
        if f["id"] in FIXED_IDS:
            header += f'  <font color="{COLORS["forte"]}"><b>[CORRIGIDO]</b></font>'
        elif f["id"] in VERIFIED_OK_IDS:
            header += f'  <font color="{COLORS["forte"]}"><b>[VERIFICADO OK]</b></font>'
        block.append(Paragraph(header, styles["FindTitle"]))
        if f["id"] in FIXED_IDS:
            block.append(Paragraph(f'<font color="{COLORS["forte"]}">✓ {FIXED_IDS[f["id"]]}</font>', styles["BodySmall"]))
        elif f["id"] in VERIFIED_OK_IDS:
            block.append(Paragraph(f'<font color="{COLORS["forte"]}">✓ {VERIFIED_OK_IDS[f["id"]]}</font>', styles["BodySmall"]))
        files_txt = "<br/>".join(f"• {ff}" for ff in f["files"])
        block.append(Paragraph(f'<b>Arquivo:linha</b><br/>{files_txt}', styles["BodySmall"]))
        block.append(Paragraph(f'<b>Descrição:</b> {f["desc"]}', styles["Body"]))
        block.append(Paragraph(f'<b>Impacto:</b> {f.get("impact_short", f["impact"])}', styles["Body"]))
        block.append(Paragraph(f'<b>Condição de explorabilidade:</b> {f["exploit_cond"]}', styles["BodySmall"]))
        block.append(Paragraph(f'<b>Sugestão de correção:</b> {f["fix"]}', styles["Body"]))
        block.append(Spacer(1, 0.15 * cm))
        block.append(HRFlowable(width="100%", thickness=0.4, color=rl_colors.HexColor("#e5e7eb")))
        block.append(Spacer(1, 0.15 * cm))
        story.append(KeepTogether(block))

story.append(PageBreak())

# ===========================================================================
# TABELA RESUMO
# ===========================================================================
story.append(para("Tabela de achados", "H1"))
table_data = [["Sev.", "Arquivo:linha", "Descrição"]]
for f in sorted(FINDINGS, key=lambda x: -{"critica": 4, "alta": 3, "media": 2, "baixa": 1, "informativa": 0}[x["sev"]]):
    chip = Paragraph(f'<font color="{COLORS[f["sev"]]}"><b>{SEV_LABEL[f["sev"]]}</b></font>', styles["BodySmall"])
    loc = Paragraph(f'[{f["id"]}] ' + f["files"][0].split(" (")[0], styles["BodySmall"])
    desc_txt = f["title"]
    if f["id"] in FIXED_IDS:
        desc_txt += f' <font color="{COLORS["forte"]}"><b>[CORRIGIDO]</b></font>'
    elif f["id"] in VERIFIED_OK_IDS:
        desc_txt += f' <font color="{COLORS["forte"]}"><b>[VERIFICADO OK]</b></font>'
    desc = Paragraph(desc_txt, styles["BodySmall"])
    table_data.append([chip, loc, desc])

find_table = Table(table_data, colWidths=[2.5 * cm, 5.1 * cm, 9.2 * cm], repeatRows=1)
find_table.setStyle(TableStyle([
    ("BACKGROUND", (0, 0), (-1, 0), rl_colors.HexColor("#111111")),
    ("TEXTCOLOR", (0, 0), (-1, 0), rl_colors.white),
    ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
    ("FONTSIZE", (0, 0), (-1, 0), 8.6),
    ("VALIGN", (0, 0), (-1, -1), "TOP"),
    ("TOPPADDING", (0, 0), (-1, -1), 5),
    ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
    ("LINEBELOW", (0, 1), (-1, -1), 0.4, rl_colors.HexColor("#e5e7eb")),
    ("ROWBACKGROUNDS", (0, 1), (-1, -1), [rl_colors.white, rl_colors.HexColor("#f9fafb")]),
]))
story.append(find_table)

story.append(PageBreak())

# ===========================================================================
# RECOMENDAÇÕES PRIORIZADAS
# ===========================================================================
story.append(para("Recomendações priorizadas", "H1"))
prio_colors = {"P1": "#B91C1C", "P2": "#EA580C", "P3": "#2563EB"}
rec_rows = [["Prioridade", "Recomendação"]]
for p, txt in RECOMMENDATIONS:
    chip = Paragraph(f'<font color="{prio_colors[p]}"><b>{p}</b></font>', styles["Body"])
    rec_rows.append([chip, Paragraph(txt, styles["BodySmall"])])
rec_table = Table(rec_rows, colWidths=[2.2 * cm, 14.6 * cm], repeatRows=1)
rec_table.setStyle(TableStyle([
    ("BACKGROUND", (0, 0), (-1, 0), rl_colors.HexColor("#111111")),
    ("TEXTCOLOR", (0, 0), (-1, 0), rl_colors.white),
    ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
    ("VALIGN", (0, 0), (-1, -1), "TOP"),
    ("TOPPADDING", (0, 0), (-1, -1), 6),
    ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
    ("LINEBELOW", (0, 1), (-1, -1), 0.4, rl_colors.HexColor("#e5e7eb")),
    ("ROWBACKGROUNDS", (0, 1), (-1, -1), [rl_colors.white, rl_colors.HexColor("#f9fafb")]),
]))
story.append(rec_table)

story.append(PageBreak())

# ===========================================================================
# ISSUES PARA O GITHUB
# ===========================================================================
story.append(para("Issues para o GitHub", "H1"))
story.append(para(
    "Texto completo de cada issue em Markdown, pronto para copiar e colar no GitHub. Achados triviais "
    "relacionados foram agrupados numa issue única para não gerar spam.", "BodySmall"))
story.append(Spacer(1, 0.2 * cm))

for i, issue in enumerate(GITHUB_ISSUES, start=1):
    block = []
    block.append(Paragraph(f"--- ISSUE {i} ---", styles["Label"]))
    block.append(Spacer(1, 0.1 * cm))
    labels_txt = ", ".join(issue["labels"])
    block.append(Paragraph(f'<b>Título:</b> {issue["title"]}<br/><b>Labels:</b> {labels_txt}', styles["BodySmall"]))
    block.append(Spacer(1, 0.1 * cm))
    md_body = issue["body"].replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
    md_body_html = md_body.replace("\n", "<br/>")
    block.append(Paragraph(md_body_html, styles["IssueBody"]))
    block.append(Spacer(1, 0.1 * cm))
    block.append(Paragraph(f"--- FIM ISSUE {i} ---", styles["Label"]))
    block.append(Spacer(1, 0.35 * cm))
    story.append(KeepTogether(block[:2]))
    story.extend(block[2:])

doc.build(story)
print("PDF gerado:", OUT)
