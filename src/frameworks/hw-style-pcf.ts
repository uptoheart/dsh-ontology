import type { FrameworkDefinition, FrameworkDomain, FrameworkNode, FrameworkLevel } from '../shared-types.js'

// 华为风格参考框架（hw-style-pcf）
//
// 来源声明：依据公开资料（华为企业架构与流程管理白皮书、公开演讲与出版读物中
// 对 IPD / ISC / LTC / ITR / DSTE 等方法论的描述）重构的「华为风格」参考框架，
// 非官方授权体系；节点按制造业场景整理为 L1 流程类别 / L2 流程域 / L3 流程组
// 粗版，供 FDE 现场访谈与实体锚定使用，项目回流后逐步行业化细化。
//
// 编号沿用数字点分（1.0 / 1.1 / 1.1.1），与 apqc-process 同构：
// deriveOntologyCode / parseApqcCode / 双轴校验零改动。
// 双轴映射规则不变：域轴 = L1/L2，流程轴 = L3+。

const LEVELS: FrameworkLevel[] = [
  { id: 'L1', name: 'Process Category', label: '流程类别', order: 1 },
  { id: 'L2', name: 'Process Domain', label: '流程域', order: 2 },
  { id: 'L3', name: 'Process Group', label: '流程组', order: 3 },
]

function L2(code: string, name: string, label: string, children: FrameworkNode[], definition?: string): FrameworkNode {
  return { code, name, label, levelId: 'L2', definition, children }
}

function L3(code: string, name: string, label: string): FrameworkNode {
  return { code, name, label, levelId: 'L3' }
}

const domains: FrameworkDomain[] = [
  {
    id: 'HW-STRAT', code: '1.0',
    name: 'Strategy & Development', label: '战略与发展',
    definition: '确立企业方向与年度经营主线：从市场洞察到战略解码（DSTE），再到年度经营计划（BP）、预算与投资管理。',
    children: [
      L2('1.1', 'Strategic Planning (SP)', '战略规划', [
        L3('1.1.1', 'Market Insight', '市场洞察'),
        L3('1.1.2', 'Strategic Intent & Innovation Focus', '战略意图与创新焦点'),
        L3('1.1.3', 'Business Design', '业务设计'),
        L3('1.1.4', 'Strategy Decoding & Execution', '战略解码与执行'),
      ], 'DSTE 流程的前端：市场洞察、战略意图、创新焦点与业务设计，输出战略专题与解码。'),
      L2('1.2', 'Annual Business Plan (BP)', '年度经营计划', [
        L3('1.2.1', 'Business Objectives & KPI', '经营目标与KPI制定'),
        L3('1.2.2', 'Budgeting & Decomposition', '预算编制与分解'),
        L3('1.2.3', 'Business Monitoring & Rolling Forecast', '经营监控与滚动预测'),
      ]),
      L2('1.3', 'Investment & Industry Development', '投资与产业发展', [
        L3('1.3.1', 'Investment Initiation', '投资立项管理'),
        L3('1.3.2', 'M&A and Partnership', '并购与合作管理'),
      ]),
    ],
  },
  {
    id: 'HW-MKT', code: '2.0',
    name: 'Marketing & Service (LTC)', label: '营销与服务',
    definition: '从线索到回款（LTC）与从问题到解决（ITR）：市场、线索、机会点、合同、交付回款与客户服务全流程。',
    children: [
      L2('2.1', 'Market & Lead Management', '市场与线索管理 (ML)', [
        L3('2.1.1', 'Marketing Campaign', '市场推广'),
        L3('2.1.2', 'Lead Collection & Nurturing', '线索收集与培育'),
        L3('2.1.3', 'Lead Qualification & Distribution', '线索验证与分发'),
      ]),
      L2('2.2', 'Opportunity & Bidding', '机会点与投标管理', [
        L3('2.2.1', 'Opportunity Validation', '机会点验证'),
        L3('2.2.2', 'Solution & Proposal', '解决方案与报价编制'),
        L3('2.2.3', 'Bidding & Negotiation', '投标与商务谈判'),
      ]),
      L2('2.3', 'Contract Management', '合同管理', [
        L3('2.3.1', 'Contract Review', '合同评审'),
        L3('2.3.2', 'Contract Signing & Handover', '合同签订与交接'),
        L3('2.3.3', 'Contract Change & Closure', '合同变更与关闭'),
      ]),
      L2('2.4', 'Customer Service (ITR)', '客户服务管理 (ITR)', [
        L3('2.4.1', 'Complaint Intake', '客户投诉受理'),
        L3('2.4.2', 'Issue Resolution & Escalation', '服务问题处理与升级'),
        L3('2.4.3', 'Customer Satisfaction', '客户满意度管理'),
      ], '从问题到解决（ITR）：受理、分派、处理、升级与关闭。'),
    ],
  },
  {
    id: 'HW-IPD', code: '3.0',
    name: 'Product Development (IPD)', label: '产品研发',
    definition: '集成产品开发（IPD）：市场管理、Charter 立项、结构化开发流程、技术评审与产品数据管理。',
    children: [
      L2('3.1', 'Product Planning & Charter', '产品规划与立项', [
        L3('3.1.1', 'Market Management (MM)', '市场管理(MM)'),
        L3('3.1.2', 'Charter Development', '项目任务书(Charter)开发'),
        L3('3.1.3', 'Product Roadmap', '产品路标规划'),
      ]),
      L2('3.2', 'Product Development Execution', '产品开发管理', [
        L3('3.2.1', 'Concept & Plan Phase', '概念与计划阶段'),
        L3('3.2.2', 'Develop & Verify Phase', '开发与验证阶段'),
        L3('3.2.3', 'Launch & Lifecycle Management', '发布与生命周期管理'),
        L3('3.2.4', 'Technical Review (TR)', '技术评审(TR)'),
      ], '结构化开发流程：概念—计划—开发—验证—发布各阶段与决策评审/技术评审。'),
      L2('3.3', 'Technology & Platform', '技术与平台管理', [
        L3('3.3.1', 'Technology Planning & Research', '技术规划与预研'),
        L3('3.3.2', 'Common Building Block (CBB)', '共用基础模块(CBB)管理'),
      ]),
      L2('3.4', 'Product Data Management', '产品数据管理', [
        L3('3.4.1', 'Document & BOM Management', '图文档与BOM管理'),
        L3('3.4.2', 'Engineering Change (ECN)', '工程变更管理(ECN)'),
      ]),
    ],
  },
  {
    id: 'HW-ISC', code: '4.0',
    name: 'Integrated Supply Chain (ISC)', label: '集成供应链',
    definition: '集成供应链（ISC）：需求预测、产销协同（S&OP）、采购、仓储物流与订单履行，衔接制造交付。',
    children: [
      L2('4.1', 'Demand & Planning', '需求与计划管理', [
        L3('4.1.1', 'Demand Forecasting', '需求预测管理'),
        L3('4.1.2', 'Sales & Operations Planning (S&OP)', '产销协同(S&OP)'),
        L3('4.1.3', 'Master Production Schedule (MPS)', '主生产计划(MPS)'),
        L3('4.1.4', 'Material Requirement Planning (MRP)', '物料需求计划(MRP)'),
      ]),
      L2('4.2', 'Procurement', '采购管理', [
        L3('4.2.1', 'Supplier Qualification', '供应商认证与引入'),
        L3('4.2.2', 'Purchase Execution', '采购执行'),
        L3('4.2.3', 'Supplier Performance', '供应商绩效管理'),
        L3('4.2.4', 'Pricing & Cost Management', '采购价格与成本管理'),
      ]),
      L2('4.3', 'Warehousing & Logistics', '仓储与物流管理', [
        L3('4.3.1', 'Inbound Management', '入库管理'),
        L3('4.3.2', 'Outbound & Distribution', '出库与配送管理'),
        L3('4.3.3', 'Stocktaking', '库存盘点'),
        L3('4.3.4', 'Inventory Policy & Obsolete', '库存策略与呆滞管理'),
      ]),
      L2('4.4', 'Order Fulfillment', '订单履行与交付', [
        L3('4.4.1', 'Shipment Management', '发货管理'),
        L3('4.4.2', 'Delivery Confirmation', '交付确认与回单'),
      ]),
    ],
  },
  {
    id: 'HW-MFG', code: '5.0',
    name: 'Manufacturing & Delivery', label: '制造交付',
    definition: '制造核心环节：车间计划与执行（MES）、工艺管理、设备与工装管理、委外与齐套交付。',
    children: [
      L2('5.1', 'Production Planning & Execution', '生产计划与车间执行', [
        L3('5.1.1', 'Shop Floor Scheduling', '车间作业计划'),
        L3('5.1.2', 'Production Execution & Reporting', '生产执行与报工'),
        L3('5.1.3', 'Production Exception Handling', '生产异常处理'),
      ]),
      L2('5.2', 'Process Engineering', '工艺管理', [
        L3('5.2.1', 'Process Design & Validation', '工艺设计与验证'),
        L3('5.2.2', 'SOP Management', '作业指导书(SOP)管理'),
      ]),
      L2('5.3', 'Equipment & Tooling', '设备与工装管理', [
        L3('5.3.1', 'Equipment Ledger & Inspection', '设备台账与点检'),
        L3('5.3.2', 'Equipment Maintenance', '设备维护保养'),
        L3('5.3.3', 'Tooling & Mould Management', '工装模具管理'),
      ]),
      L2('5.4', 'Outsourcing & Delivery Sync', '委外与交付协同', [
        L3('5.4.1', 'Subcontract Management', '委外加工管理'),
        L3('5.4.2', 'Kitting & Shipment Coordination', '交付齐套与发运协调'),
      ]),
    ],
  },
  {
    id: 'HW-QUAL', code: '6.0',
    name: 'Quality Management', label: '质量管理',
    definition: '质量体系、质量控制（IQC/IPQC/OQC）与质量改进（客诉处理、CAPA、精益改善）。',
    children: [
      L2('6.1', 'Quality System', '质量体系管理', [
        L3('6.1.1', 'QMS Planning & Documentation', '质量体系策划与文件管理'),
        L3('6.1.2', 'Internal Audit & Management Review', '内审与管理评审'),
        L3('6.1.3', 'Certification & External Audit', '认证与外部审核应对'),
      ]),
      L2('6.2', 'Quality Control', '质量控制', [
        L3('6.2.1', 'Incoming Inspection (IQC)', '来料检验(IQC)'),
        L3('6.2.2', 'In-Process Inspection (IPQC)', '过程检验(IPQC)'),
        L3('6.2.3', 'Outgoing Inspection (OQC)', '成品检验(OQC)'),
        L3('6.2.4', 'Nonconforming Product Control', '不合格品管理'),
      ]),
      L2('6.3', 'Quality Improvement', '质量改进', [
        L3('6.3.1', 'Complaint & Quality Incident', '客诉与质量事故处理'),
        L3('6.3.2', 'Corrective & Preventive Action (CAPA)', '纠正与预防措施(CAPA)'),
        L3('6.3.3', 'Lean & Continuous Improvement', '精益与持续改善'),
      ]),
    ],
  },
  {
    id: 'HW-FIN', code: '7.0',
    name: 'Finance', label: '财经管理',
    definition: '核算与报告、资金收支、预算监控与经营分析、税务合规，支撑业务与财经一体化。',
    children: [
      L2('7.1', 'Accounting & Reporting', '核算与报告', [
        L3('7.1.1', 'General Ledger', '总账核算'),
        L3('7.1.2', 'AR & AP Management', '应收应付管理'),
        L3('7.1.3', 'Cost Accounting', '成本核算'),
        L3('7.1.4', 'Financial Reporting', '财务报告与披露'),
      ]),
      L2('7.2', 'Treasury Management', '资金管理', [
        L3('7.2.1', 'Collection & Receipt', '回款与收款管理'),
        L3('7.2.2', 'Payment Management', '付款管理'),
        L3('7.2.3', 'Cash Planning & Financing', '资金计划与融资'),
      ]),
      L2('7.3', 'Budget & Business Analysis', '预算与经营分析', [
        L3('7.3.1', 'Budget Execution Monitoring', '预算执行监控'),
        L3('7.3.2', 'Business Analysis & Alerting', '经营分析与预警'),
      ]),
      L2('7.4', 'Tax Management', '税务管理', [
        L3('7.4.1', 'Tax Filing', '纳税申报'),
        L3('7.4.2', 'Tax Planning & Risk', '税务筹划与风险管理'),
      ]),
    ],
  },
  {
    id: 'HW-HR', code: '8.0',
    name: 'Human Resources', label: '人力资源管理',
    definition: '组织岗位、招聘配置、培训发展、绩效激励与员工关系全生命周期管理。',
    children: [
      L2('8.1', 'Organization & Position', '组织与岗位管理', [
        L3('8.1.1', 'Organization Structure', '组织架构管理'),
        L3('8.1.2', 'Position & Headcount', '岗位与编制管理'),
      ]),
      L2('8.2', 'Recruitment & Staffing', '招聘与配置', [
        L3('8.2.1', 'Recruitment', '招聘管理'),
        L3('8.2.2', 'Onboarding / Transfer / Exit', '入转调离管理'),
      ]),
      L2('8.3', 'Training & Talent', '培训与人才发展', [
        L3('8.3.1', 'Training Plan & Delivery', '培训计划与实施'),
        L3('8.3.2', 'Talent Pipeline & Succession', '人才梯队与继任管理'),
      ]),
      L2('8.4', 'Performance & Incentive', '绩效与激励', [
        L3('8.4.1', 'Performance Goal & Review', '绩效目标与考核'),
        L3('8.4.2', 'Compensation & Incentive', '薪酬与激励管理'),
      ]),
      L2('8.5', 'Employee Relations', '员工关系', [
        L3('8.5.1', 'Labor Contract & Discipline', '劳动合同与纪律管理'),
        L3('8.5.2', 'Employee Communication & Care', '员工沟通与关怀'),
      ]),
    ],
  },
  {
    id: 'HW-IT', code: '9.0',
    name: 'Process & IT Services', label: '流程与信息服务',
    definition: '质量与流程 IT：流程架构与遵从性管理、IT 规划、应用建设运维、数据治理与信息安全。',
    children: [
      L2('9.1', 'Process Management', '流程管理', [
        L3('9.1.1', 'Process Architecture', '流程架构管理'),
        L3('9.1.2', 'Process Design & Release', '流程设计与发布'),
        L3('9.1.3', 'Process Compliance', '流程遵从性管理'),
      ]),
      L2('9.2', 'IT Planning & Architecture', 'IT规划与架构', [
        L3('9.2.1', 'IT Strategy & Architecture', 'IT战略与架构规划'),
        L3('9.2.2', 'IT Investment & Initiation', 'IT投资与立项'),
      ]),
      L2('9.3', 'Application & Operations', '应用建设与运维', [
        L3('9.3.1', 'Business Requirement Management', '业务需求管理'),
        L3('9.3.2', 'System Development & Implementation', '系统开发与实施'),
        L3('9.3.3', 'System Operations & Support', '系统运维与支持'),
      ]),
      L2('9.4', 'Data & Security', '数据与信息安全', [
        L3('9.4.1', 'Data Governance', '数据治理'),
        L3('9.4.2', 'Information Security', '信息安全管理'),
      ]),
    ],
  },
  {
    id: 'HW-ADMIN', code: '10.0',
    name: 'Administration & Support', label: '行政与支持服务',
    definition: '行政后勤、固定资产、法务合规与 EHS，保障业务运行的基础支撑。',
    children: [
      L2('10.1', 'Administration', '行政事务管理', [
        L3('10.1.1', 'Office & Logistics Service', '办公与后勤服务'),
        L3('10.1.2', 'Meeting & Travel', '会议与差旅管理'),
      ]),
      L2('10.2', 'Fixed Asset Management', '固定资产管理', [
        L3('10.2.1', 'Asset Purchase & Acceptance', '资产采购与验收'),
        L3('10.2.2', 'Asset Assignment & Transfer', '资产领用与调拨'),
        L3('10.2.3', 'Asset Count & Disposal', '资产盘点与处置'),
      ]),
      L2('10.3', 'Legal & Compliance', '法务与合规', [
        L3('10.3.1', 'Contract Legal Review', '合同法务审核'),
        L3('10.3.2', 'Intellectual Property', '知识产权管理'),
        L3('10.3.3', 'Compliance & Risk', '合规与风险管理'),
      ]),
      L2('10.4', 'EHS', '环境与安全(EHS)', [
        L3('10.4.1', 'Production Safety', '安全生产管理'),
        L3('10.4.2', 'Environment & Occupational Health', '环保与职业健康管理'),
      ]),
    ],
  },
]

export const HW_STYLE_PCF: FrameworkDefinition = {
  frameworkId: 'hw-style-pcf',
  name: 'HW-Style PCF (Manufacturing)',
  source: '依据公开资料（华为企业架构与流程白皮书、IPD/ISC/LTC/ITR 公开方法论）重构的华为风格参考框架，非官方授权体系；按制造业场景整理（L1–L3 粗版）',
  version: '0.1.0',
  description: '华为风格流程参考框架：10 个 L1 流程类别（战略、营销与服务、产品研发、集成供应链、制造交付、质量、财经、人力资源、流程与IT、行政支持），面向制造业现场访谈与实体锚定。',
  levels: LEVELS,
  domains,
}
