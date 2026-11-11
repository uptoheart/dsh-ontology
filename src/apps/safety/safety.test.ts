import { describe, it, expect } from 'vitest'
import { buildSeedSuite, SEED_RULES } from './seed.js'
import { DEFAULT_SCORE_MODEL } from './scoring/model.js'
import { assessSuite } from './scoring/index.js'
import { analyzeIncident } from './rca/engine.js'
import type { SafetyIncident } from './types.js'

const NOW = new Date('2026-06-01T00:00:00+08:00').getTime()

const incident: SafetyIncident = {
  id: 'INC-001',
  suiteId: 'chemical-safety-demo',
  title: '1#储罐动火闪爆',
  occurredAt: '2026-03-12',
  eventEntityId: 'event:EV-INC-01',
  areaCode: 'AREA-A',
  unitCode: 'UNIT-A1',
  equipmentCode: 'EQ-A1-T01',
  operationCode: 'OP-HOT-01',
  category: '机',
  consequences: '1 人重伤，储罐局部损毁',
  facts: [],
  suspectedCauses: ['cause:CAUSE-C1', 'cause:CAUSE-C2', 'cause:CAUSE-C4', 'cause:CAUSE-C5'],
  createdAt: NOW,
  updatedAt: NOW,
}

describe('chemical safety', () => {
  it('评级覆盖区域/装置/设备/作业并给出四色分布', () => {
    const suite = buildSeedSuite()
    const result = assessSuite(suite, SEED_RULES, DEFAULT_SCORE_MODEL, { now: NOW })

    expect(result.areas).toHaveLength(3)
    expect(result.units).toHaveLength(5)
    expect(result.equipments).toHaveLength(7)
    expect(result.operations).toHaveLength(10)
    expect(result.summary.total).toBe(5)
    expect(result.summary.red + result.summary.orange + result.summary.yellow + result.summary.blue).toBe(5)

    const hotWork = result.operations.find(o => o.entityId === 'op:OP-HOT-01')
    expect(hotWork).toBeDefined()
    expect(hotWork!.grade).toBe('red')

    const overdue = result.equipments.find(e => e.entityId === 'eq:EQ-A1-T02')
    expect(overdue!.penalties.some(p => p.refId === 'R-12')).toBe(true)

    const unitA1 = result.units.find(u => u.entityId === 'unit:UNIT-A1')
    expect(unitA1!.grade).toBe('red')
    expect(unitA1!.penalties.some(p => p.layer === 'D')).toBe(true)
  })

  it('根因分析输出因果链、根因排序与证据', () => {
    const suite = buildSeedSuite()
    const result = analyzeIncident(suite, incident, DEFAULT_SCORE_MODEL, { now: NOW })

    expect(result.graph.nodes.length).toBeGreaterThan(4)
    expect(result.graph.edges.length).toBeGreaterThan(3)
    expect(result.graph.nodes[0].type).toBe('event')

    const rootIds = result.roots.map(r => r.causeId)
    expect(rootIds).toContain('cause:CAUSE-C3')
    expect(rootIds).toContain('cause:CAUSE-C5')
    expect(result.roots.every(r => r.rankScore > 0)).toBe(true)
    expect(result.roots[0].rankScore).toBeGreaterThanOrEqual(result.roots[result.roots.length - 1].rankScore)

    expect(result.recommendations.length).toBeGreaterThan(0)
    expect(result.graph.nodes.some(n => n.type === 'barrier')).toBe(true)
    expect(result.graph.nodes.some(n => n.type === 'evidence')).toBe(true)
  })
})
