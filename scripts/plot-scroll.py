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
series = [(-.27, 'scriptMeanMs', 'Mean, JS only', '#7a5cc4'), (0, 'meanMs', 'Mean, full frame', '#087e8b'), (.27, 'p95Ms', 'p95, full frame', '#c56b16')]
for shift, key, label, color in series:
    bars = ax.barh([v + shift for v in y], [row[key] for row in rows], height=.25, label=label, color=color)
    ax.bar_label(bars, labels=[f"{row[key]:.2f} ms" for row in rows], padding=5, fontsize=10)
ax.set_yticks(y, [f"{row['library']}\n{row['meanRows']:.1f} rows in DOM" for row in rows])
ax.invert_yaxis()
ax.set_xlim(0, max(row['p95Ms'] for row in rows) * 1.2)
ax.set_xlabel('Main-thread work per scroll frame (ms) — lower is better')
env = data['environment']
fig.text(.02, .95, 'Scroll benchmark · 200,000 rows', weight='bold', fontsize=15)
fig.text(.02, .89, f"{data['runs']} runs · {data['samplesPerEngine']} jumps per engine · {env['browser']} · {env['cpu']} · {data['recordedDate']}", color='#555555', fontsize=10)
ax.xaxis.grid(True, color='#dddddd', linewidth=.6)
ax.set_axisbelow(True)
ax.spines[['top', 'right', 'left']].set_visible(False)
fig.legend(loc='upper right', bbox_to_anchor=(.98, .995), frameon=False, ncol=3)
fig.text(.02, .025, 'Scroll event dispatch to end of the same frame. Excludes vsync idle time, raster and compositor threads.', fontsize=9, color='#555555')
fig.savefig(root / 'docs/scroll-performance.svg', metadata={'Date': data['recordedDate']})
fig.savefig(root / 'docs/scroll-performance.png', dpi=150)
