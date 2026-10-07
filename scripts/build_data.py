# Build static/js/data.js directly from the raw CSV results (replaces the PDF-digitised curves).
import sys, json
sys.path.insert(0, sys.argv[1])
from rr import *
OUT = sys.argv[2]
r4 = lambda v: round(float(v), 4)
DS = {'m-eurosat': ('knn', 'Accuracy (macro)', 'Scene classification, single-label, 10 classes'),
      'm-bigearthnet': ('knn', 'mAP (macro)', 'Scene classification, multi-label, 43 classes'),
      'm-brick-kiln': ('knn', 'Accuracy (macro)', 'Scene classification, binary'),
      'm-so2sat': ('knn', 'Accuracy (macro)', 'Scene classification, 17 local climate zones'),
      'm-cashew-plant': ('segmentation', 'mIoU', 'Semantic segmentation, 7 classes'),
      'm-SA-crop-type': ('segmentation', 'mIoU', 'Semantic segmentation, 10 crop types'),
      'oscd': ('cd', 'mIoU (change & no-change)', 'Change detection, binary')}

def curve(model, ds, task, slim='SlimAttn+SlimFFN', metric=None):
    g, _, _ = read(model, ds, task, slim, metric)
    g = g.groupby('compute', as_index=False)['mean'].mean().sort_values('compute')  # identical-FLOP scales are averaged, as seaborn does
    return [[r4(c), r4(m)] for c, m in zip(g.compute, g['mean'])]

data = {'posthoc': {}, 'native': {}}
for ds, (task, yl, desc) in DS.items():
    data['posthoc'][ds] = dict(ylabel=yl, desc=desc, series=[dict(label=LBL[m], pts=curve(m, ds, task)) for m in RS + ['panopticon_vitb14', 'copernicusFM'] if path(m, ds, task).exists()])

NAT = {'MAE ViT base 1.00': 'MAE: regular training', 'MAE ViT base slimable': 'MAE: slimmable training',
       'MoCo ViT base 1.00': 'MoCo: regular training', 'MoCo ViT base slimable': 'MoCo: slimmable training'}
for ds in ['m-eurosat', 'm-bigearthnet', 'm-brick-kiln', 'm-so2sat']:
    data['native'][ds] = dict(ylabel=DS[ds][1], series=[dict(label=l, pts=curve(f'{k} epoch099', ds, 'knn')) for k, l in NAT.items()])

# Fig. 1: replicate the paper's 10%-wide compute bins (floor) and seaborn's mean ± 2 SD over all rows in a bin
def rows(model, ds):
    _, df, m = read(model, ds, 'knn')
    fl = FL[FL.model == flop_style(model)][['scale', 'flops_SASF']]
    df = df.merge(fl, on='scale'); df['compute'] = df.flops_SASF / df.flops_SASF.max()
    df['ret'] = df[m] / df[np.isclose(df.scale, 1.0)][m].iloc[0]   # notebook: first row at s = 1.0
    df['val'] = df[m]; df['bin'] = (df.compute * 10).astype(int) / 10
    return df
def binned(df, col, label):
    g = df.groupby('bin')[col].agg(['mean', 'std']).reset_index().fillna(0)
    s = dict(label=label, color=label, pts=[[r4(b), r4(m)] for b, m in zip(g['bin'], g['mean'])])
    lo = [[r4(b), r4(m - 2 * sd)] for b, m, sd in zip(g['bin'], g['mean'], g['std'])]
    hi = [[r4(b), r4(m + 2 * sd)] for b, m, sd in zip(g['bin'], g['mean'], g['std'])]
    return s, dict(color=label, pts=lo + hi[::-1])
rs4 = pd.concat([rows(m, d) for m in RS for d in ['m-brick-kiln', 'm-eurosat', 'm-so2sat', 'm-bigearthnet']])
specs = [(rs4, 'RS FMs @ 4 RS datasets (avg.)'), (rows('timm_dinoV2_base', 'ImageNet010'), 'CV DINOv2 @ ImageNet-10'),
         (rows('timm_mae_base', 'ImageNet010'), 'CV MAE @ ImageNet-10'), (rows('timm_mae_base', 'ImageNet100'), 'CV MAE @ ImageNet-100')]
S, B = zip(*[binned(d, 'ret', l) for d, l in specs])
data['fig1a'] = dict(ylabel='Rel. retention rate', series=list(S), bands=list(B))
eu = pd.concat([rows(m, 'm-eurosat') for m in RS]); mae = rows('timm_mae_base', 'm-eurosat')
S, B = zip(*[binned(eu, 'val', 'RS FMs @ m-eurosat'), binned(mae, 'val', 'CV MAE @ m-eurosat')])
data['fig1b'] = dict(ylabel='Accuracy on m-eurosat', series=list(S), bands=list(B),
                     refs=[dict(label='CV MAE @ m-eurosat', y=r4(mae[np.isclose(mae.scale, 1.0)].val.mean()))])

# Rebuttal analyses. x = relative compute of each model (the OpenReview tables were indexed by width factor s).
def comp(model, scales):
    f = FL[FL.model == model].set_index('scale').flops_SASF
    return [r4(f[s] / f.max()) for s in scales]
def at(model, ds, task, scales):
    g, _, _ = read(model, ds, task); g = g.set_index('scale')
    return [r4(g.loc[s, 'mean']) for s in scales]
S3, S5 = [0.01, 0.1, 1.0], [0.001, 0.01, 0.1, 0.5, 1.0]
B3 = ['dofa', 'prithvi2_300', 'terramind']
reb = {'finetune': {ds: {LBL[m]: {'x': comp(m, S5), 'linear': at(m, ds, 'linear', S5), 'finetune': at(m, ds, 'finetune', S5)} for m in B3}
                    for ds in ['m-eurosat', 'm-bigearthnet']},
       'newfms': {p: {ds: {LBL[m]: {'x': comp(m, S5), 'y': at(m, ds, p, S5)} for m in B3 + ['panopticon_vitb14', 'copernicusFM']}
                      for ds in ['m-eurosat', 'm-bigearthnet']} for p in ['knn', 'linear']}}
# From notebook outputs (features not in the CSV export), all five widths s = 0.001, 0.01, 0.1, 0.5, 1.0
reb['geo'] = {LBL[m]: {'x': comp(m, S5), **v} for m, v in {
    'dofa': {'Cultural-10': [.29, .30, .32, .37, .39], 'random': [.69, .69, .73, .79, .74]},
    'prithvi2_300': {'Cultural-10': [.31, .30, .33, .33, .36], 'random': [.79, .79, .81, .81, .84]},
    'terramind': {'Cultural-10': [.29, .29, .33, .36, .38], 'random': [.78, .79, .81, .85, .88]}}.items()}
reb['imbalance'] = {LBL[m]: {'x': comp(m, S5), **v} for m, v in {
    'dofa': {'0.01': [.47, .47, .50, .57, .54], '0.1': [.63, .63, .66, .75, .74], '0.2': [.67, .67, .69, .79, .77], '0.5': [.70, .70, .73, .82, .80], '1.0': [.71, .71, .75, .84, .82]},
    'prithvi2_300': {'0.01': [.48, .48, .50, .55, .53], '0.1': [.69, .69, .72, .76, .77], '0.2': [.74, .74, .76, .79, .80], '0.5': [.78, .78, .79, .81, .83], '1.0': [.79, .79, .80, .83, .83]},
    'terramind': {'0.01': [.43, .43, .46, .53, .56], '0.1': [.62, .63, .67, .75, .77], '0.2': [.67, .67, .71, .78, .81], '0.5': [.70, .70, .75, .82, .84], '1.0': [.74, .74, .78, .85, .86]}}.items()}
# Class-wise AP: worst/best class by mean AP over the five widths (as in the notebook)
reb['classwise'] = {LBL[m]: {'x': comp(m, S5), **v} for m, v in {
    'dofa': {'hardest': ['Dump sites', [.04, .05, .06, .16, .04]], 'easiest': ['Sea and ocean', [.73, .73, .71, .86, .82]]},
    'prithvi2_300': {'hardest': ['Sport and leisure facilities', [.13, .13, .15, .16, .22]], 'easiest': ['Bare rock', [.86, .88, .94, .94, .96]]},
    'terramind': {'hardest': ['Dump sites', [.07, .13, .23, .24, .26]], 'easiest': ['Bare rock', [.89, .88, .91, .94, .96]]}}.items()}

open(OUT, 'w').write('/* Generated from the raw result CSVs (scripts/build_data.py). Rebuttal geo/imbalance/class-wise\n'
                     '   values are the notebook outputs. x is always relative compute (FLOPs / full-width FLOPs). */\n'
                     'window.PAPER_DATA = ' + json.dumps(data, separators=(',', ':')) + ';\n'
                     'window.REBUTTAL_DATA = ' + json.dumps(reb, separators=(',', ':')) + ';\n')
print('ok', len(open(OUT).read()))
