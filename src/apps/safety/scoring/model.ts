import type { ScoreModel } from '../types.js'

/** 默认评分模型（可被 datastorage/safety/scoring/model.json 覆盖） */
export const DEFAULT_SCORE_MODEL: ScoreModel = {
  version: '1.0.0',
  weights: { lec: 0.35, hazard: 0.25, compliance: 0.30, indicator: 0.10, propagation: 0.40 },
  grades: { red: 60, orange: 75, yellow: 90 },
  caps: { ifChildRed: 59, ifChildOrange: 74 },
  propagationWeights: { headcount: 0.5, stock: 0.3, output: 0.2 },
  rcaMaxDepth: 5,
  controllability: { engineering: 1.0, management: 0.9, training: 0.7 },
}

/** LEC 取值表（作业类型 → L/E/C）；企业口径可替换 */
export const LEC_TABLE: { key: string; L: number; E: number; C: number }[] = [
  { key: '动火', L: 3, E: 6, C: 15 },
  { key: '受限空间', L: 3, E: 6, C: 15 },
  { key: '高处', L: 3, E: 6, C: 7 },
  { key: '吊装', L: 3, E: 3, C: 7 },
  { key: '临时用电', L: 3, E: 6, C: 3 },
  { key: '断路', L: 1, E: 6, C: 7 },
  { key: '盲板抽堵', L: 3, E: 3, C: 15 },
  { key: '检维修', L: 3, E: 6, C: 7 },
  { key: '其他', L: 1, E: 6, C: 3 },
  // 设备类别
  { key: '常压储罐', L: 3, E: 6, C: 15 },
  { key: '反应釜', L: 3, E: 6, C: 15 },
  { key: '装车鹤管', L: 3, E: 6, C: 15 },
  { key: '输送泵', L: 3, E: 6, C: 7 },
  { key: '精馏塔', L: 3, E: 6, C: 7 },
  { key: '空压机', L: 1, E: 6, C: 3 },
]
