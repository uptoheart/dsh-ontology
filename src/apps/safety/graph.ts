import type { OntologyEntity, OntologyRelation, SuiteData } from '../../shared-types.js'

export interface SuiteIndex {
  suite: SuiteData
  byId: Map<string, OntologyEntity>
  out: Map<string, OntologyRelation[]>
  inn: Map<string, OntologyRelation[]>
  kindOf(id: string): string | undefined
  outgoing(id: string, type?: string): OntologyRelation[]
  incoming(id: string, type?: string): OntologyRelation[]
  targets(id: string, type: string): string[]
  sources(id: string, type: string): string[]
  ofKind(kind: string): OntologyEntity[]
}

export function buildIndex(suite: SuiteData): SuiteIndex {
  const byId = new Map<string, OntologyEntity>()
  const out = new Map<string, OntologyRelation[]>()
  const inn = new Map<string, OntologyRelation[]>()

  for (const e of suite.entities) byId.set(e.id, e)
  for (const r of suite.relations) {
    if (!out.has(r.from)) out.set(r.from, [])
    out.get(r.from)!.push(r)
    if (!inn.has(r.to)) inn.set(r.to, [])
    inn.get(r.to)!.push(r)
  }

  const matching = (list: OntologyRelation[] | undefined, type?: string) =>
    (list ?? []).filter(r => !type || r.type === type)

  return {
    suite,
    byId,
    out,
    inn,
    kindOf: id => byId.get(id)?.kind,
    outgoing: (id, type) => matching(out.get(id), type),
    incoming: (id, type) => matching(inn.get(id), type),
    targets: (id, type) => matching(out.get(id), type).map(r => r.to),
    sources: (id, type) => matching(inn.get(id), type).map(r => r.from),
    ofKind: kind => suite.entities.filter(e => e.kind === kind),
  }
}
