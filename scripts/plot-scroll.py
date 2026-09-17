"""Render the recorded scroll result; this script does not run the benchmark."""
import json
from pathlib import Path
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt

root = Path(__file__).resolve().parents[1]
data = json.loads((root / 'docs/scroll-results.json').read_text(encoding='utf-8-sig'))
rows = data['results']
plt.rcParams.update({'font.family': 'DejaVu Sans', 'font.size': 11, 'svg.fonttype': 'none'})
fig, ax = plt.subplots(figsize=(10, 5.3))
fig.subplots_adjust(left=.20, right=.98, bottom=.23, top=.80)
y = list(range(len(rows)))
for shift, key, label, color in [(-.18, 'meanMs', 'Mean', '#087e8b'), (.18, 'p95Ms', 'p95', '#c56b16')]:
    bars = ax.barh([v + shift for v in y], [row[key] for row in rows], height=.30, label=label, color=color)
    ax.bar_label(bars, labels=[f"{row[key]:.2f} ms" if key == 'meanMs' else f"{row[key]:.1f} ms" for row in rows], padding=5, fontsize=10)
ax.set_yticks(y, [row['library'] for row in rows])
ax.invert_yaxis()
ax.set_xlim(0, 40)
ax.set_xlabel('Two-frame scroll latency (ms) — lower is better')
fig.text(.02, .95, 'Scroll benchmark · 200,000 rows', weight='bold', fontsize=15)
fig.text(.02, .89, 'One recorded run · 54 samples per engine · September 17, 2026', color='#555555', fontsize=10)
ax.xaxis.grid(True, color='#dddddd', linewidth=.6)
ax.set_axisbelow(True)
ax.spines[['top', 'right', 'left']].set_visible(False)
fig.legend(loc='upper right', bbox_to_anchor=(.98, .995), frameon=False, ncol=2)
fig.text(.02, .025, 'Includes frame scheduling; not pure rendering CPU time. No raw samples or confidence intervals available.', fontsize=9, color='#555555')
fig.savefig(root / 'docs/scroll-performance.svg', metadata={'Date': data['recordedDate']})
fig.savefig(root / 'docs/scroll-performance.png', dpi=150)
