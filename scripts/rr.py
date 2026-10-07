# Re-implementation of read_results() from redundant_features_v2.ipynb (pure pandas)
import numpy as np, pandas as pd
from pathlib import Path
import os
BASE = Path(os.environ.get('RESULTS_DIR', 'csv_files_from_z3'))
FL = pd.read_csv(BASE / 'model_flops.csv')
LBL = {'dofa': 'DOFA (base)', 'dofa_large': 'DOFA (large)', 'prithvi2_300': 'Prithvi-EO-2.0 (300M)', 'prithvi2_600': 'Prithvi-EO-2.0 (600M)',
       'terramind': 'TerraMind-1.0 (base)', 'terramind_large': 'TerraMind-1.0 (large)', 'ssl4eo_dino': 'SSL4EO ViT-S (Dino)', 'ssl4eo_moco': 'SSL4EO ViT-S (MoCo)',
       'timm_mae_base': 'CV MAE', 'timm_dinoV2_base': 'CV DinoV2', 'panopticon_vitb14': 'Panopticon', 'copernicusFM': 'Copernicus-FM'}
METRIC = {'m-brick-kiln': 'accuracy', 'm-eurosat': 'accuracy', 'm-so2sat': 'accuracy', 'm-bigearthnet': 'mAP', 'm-cashew-plant': 'mIoU', 'm-SA-crop-type': 'mIoU', 'oscd': 'mIoU'}
FLCOL = {'SlimAttn+SlimFFN': 'flops_SASF', 'SlimAttn': 'flops_SA', 'SlimFFN': 'flops_SF'}
RS = ['dofa', 'dofa_large', 'terramind', 'terramind_large', 'prithvi2_300', 'prithvi2_600', 'ssl4eo_moco', 'ssl4eo_dino']

def path(model, ds, task, slim='SlimAttn+SlimFFN'):
    p = BASE / model if (model.startswith('timm') or 'ViT base' in model) else BASE / slim / model
    fn = {'knn': f'knn_scores_5way_{ds}.csv', 'linear': f'linear_scores_5way_{ds}.csv', 'finetune': f'finetune_scores_3way_{ds}.csv',
          'segmentation': f'segmentation_scores_probe_{ds}.csv', 'cd': f'change-detection_scores_probe_{ds}.csv'}[task]
    return p / fn

def flop_style(model):
    if model.startswith('timm') or 'ViT base' in model: return 'vit_base'
    if 'implicit_order' in model: return 'terramind'
    return model

def read(model, ds, task, slim='SlimAttn+SlimFFN', metric=None):
    df = pd.read_csv(path(model, ds, task, slim))
    if 'dim' in df.columns: df = df[df.dim == df.dim.max()]
    m = metric or METRIC.get(ds, 'accuracy')
    g = df.groupby('scale')[m].agg(['mean', 'std', 'count']).reset_index()
    fl = FL[FL.model == flop_style(model)][['scale', FLCOL[slim]]].rename(columns={FLCOL[slim]: 'flops'})
    g = g.merge(fl, on='scale', how='left')
    g['compute'] = g.flops / g.flops.max()
    g['ret'] = g['mean'] / g.loc[np.isclose(g.scale, 1.0), 'mean'].iloc[0]
    g['model'] = model
    return g, df, m
