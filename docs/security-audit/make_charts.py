# -*- coding: utf-8 -*-
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from collections import Counter
from audit_data import FINDINGS, COLORS, SEV_LABEL, CATEGORIES

plt.rcParams["font.family"] = "DejaVu Sans"

# ---------- Donut chart: findings by severity ----------
sev_order = ["critica", "alta", "media", "baixa", "informativa"]
counts = Counter(f["sev"] for f in FINDINGS)
sizes = [counts.get(s, 0) for s in sev_order]
labels = [f"{SEV_LABEL[s]} ({counts.get(s,0)})" for s in sev_order]
colors = [COLORS[s] for s in sev_order]

# drop zero-count slices
sizes2, labels2, colors2 = [], [], []
for s, l, c in zip(sizes, labels, colors):
    if s > 0:
        sizes2.append(s); labels2.append(l); colors2.append(c)

fig, ax = plt.subplots(figsize=(5.2, 4.4), dpi=200)
wedges, _ = ax.pie(
    sizes2, colors=colors2, startangle=90,
    wedgeprops=dict(width=0.42, edgecolor="white", linewidth=2),
)
ax.set_aspect("equal")
total = sum(sizes2)
ax.text(0, 0.06, str(total), ha="center", va="center", fontsize=26, fontweight="bold", color="#1f2937")
ax.text(0, -0.16, "achados", ha="center", va="center", fontsize=11, color="#6b7280")
ax.legend(wedges, labels2, loc="center left", bbox_to_anchor=(1.0, 0.5), frameon=False, fontsize=10)
plt.title("Achados por severidade", fontsize=13, fontweight="bold", color="#1f2937", pad=14)
plt.tight_layout()
plt.savefig("chart_severidade.png", dpi=200, bbox_inches="tight", transparent=True)
plt.close()

# ---------- Bar chart: findings by category ----------
cat_short = ["Banco sem\ntranca", "Permissão no\nnavegador", "IDOR", "Chaves\nexpostas", "XSS"]
cat_counts = Counter(f["cat"] for f in FINDINGS)
values = [cat_counts.get(c, 0) for c in CATEGORIES]

fig, ax = plt.subplots(figsize=(6.6, 4.2), dpi=200)
bar_colors = ["#7a8c3a", "#7a8c3a", "#7a8c3a", "#7a8c3a", "#7a8c3a"]
bars = ax.bar(cat_short, values, color="#B91C1C", width=0.55, zorder=3)
for i, f in enumerate(FINDINGS):
    pass
# color bars by dominant severity present in that category (use highest severity color)
sev_rank = {"critica": 4, "alta": 3, "media": 2, "baixa": 1, "informativa": 0}
for idx, cat in enumerate(CATEGORIES):
    cat_findings = [f for f in FINDINGS if f["cat"] == cat]
    if cat_findings:
        top = max(cat_findings, key=lambda f: sev_rank[f["sev"]])
        bars[idx].set_color(COLORS[top["sev"]])

ax.set_ylim(0, max(values) + 1.5)
ax.set_ylabel("Número de achados", fontsize=10, color="#374151")
ax.spines["top"].set_visible(False)
ax.spines["right"].set_visible(False)
ax.spines["left"].set_color("#d1d5db")
ax.spines["bottom"].set_color("#d1d5db")
ax.tick_params(axis="x", labelsize=9, colors="#374151")
ax.tick_params(axis="y", labelsize=9, colors="#374151")
ax.yaxis.set_major_locator(plt.MaxNLocator(integer=True))
ax.grid(axis="y", color="#e5e7eb", zorder=0)
for i, v in enumerate(values):
    ax.text(i, v + 0.08, str(v), ha="center", va="bottom", fontsize=11, fontweight="bold", color="#1f2937")
plt.title("Achados por categoria", fontsize=13, fontweight="bold", color="#1f2937", pad=14)
plt.tight_layout()
plt.savefig("chart_categoria.png", dpi=200, bbox_inches="tight", transparent=True)
plt.close()

print("charts ok")
