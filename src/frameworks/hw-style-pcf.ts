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
  { id: 'L4', name: 'Sub-process', label: '子流程', order: 4 },
  { id: 'L5', name: 'Activity', label: '活动', order: 5 },
  { id: 'L6', name: 'Task', label: '任务', order: 6 },
]

function L2(code: string, name: string, label: string, children: FrameworkNode[], definition?: string): FrameworkNode {
  return { code, name, label, levelId: 'L2', definition, children }
}

function L3(code: string, name: string, label: string, children?: FrameworkNode[], definition?: string): FrameworkNode {
  return { code, name, label, levelId: 'L3', definition, children }
}

function L4(code: string, name: string, label: string, children?: FrameworkNode[]): FrameworkNode {
  return { code, name, label, levelId: 'L4', children }
}

function L5(code: string, name: string, label: string, children?: FrameworkNode[]): FrameworkNode {
  return { code, name, label, levelId: 'L5', children }
}

function L6(code: string, name: string, label: string): FrameworkNode {
  return { code, name, label, levelId: 'L6' }
}

const domains: FrameworkDomain[] = [
  {
    id: 'HW-STRAT', code: '1.0',
    name: 'Strategy & Development', label: '战略与发展',
    definition: '确立企业方向与年度经营主线：从市场洞察到战略解码（DSTE），再到年度经营计划（BP）、预算与投资管理。',
    children: [
      L2('1.1', 'Strategic Planning (SP)', '战略规划', [
        L3('1.1.1', 'Market Insight', '市场洞察', [
          L4('1.1.1.1', 'Macro Environment Analysis', '宏观环境分析', [
            L5('1.1.1.1.1', 'PESTEL Analysis', 'PESTEL分析', [
              L6('1.1.1.1.1.1', 'Analyze Policy Trends', '分析政策趋势'),
              L6('1.1.1.1.1.2', 'Analyze Economic Indicators', '分析经济指标'),
              L6('1.1.1.1.1.3', 'Analyze Technology Trends', '分析技术趋势'),
            ]),
            L5('1.1.1.1.2', 'Industry Trend Research', '行业趋势研究', [
              L6('1.1.1.1.2.1', 'Collect Industry Reports', '收集行业报告'),
              L6('1.1.1.1.2.2', 'Identify Growth Drivers', '识别增长驱动因素'),
            ]),
          ]),
          L4('1.1.1.2', 'Competitor Analysis', '竞争对手分析', [
            L5('1.1.1.2.1', 'Identify Key Competitors', '识别主要竞争对手', [
              L6('1.1.1.2.1.1', 'Map Competitor Landscape', '绘制竞争格局'),
              L6('1.1.1.2.1.2', 'Classify Competitor Types', '分类竞争对手类型'),
            ]),
            L5('1.1.1.2.2', 'Analyze Competitor Strategy', '分析竞争对手战略', [
              L6('1.1.1.2.2.1', 'Analyze Product Portfolio', '分析产品组合'),
              L6('1.1.1.2.2.2', 'Analyze Pricing Strategy', '分析定价策略'),
              L6('1.1.1.2.2.3', 'Analyze Market Share', '分析市场份额'),
            ]),
          ]),
          L4('1.1.1.3', 'Customer Needs Analysis', '客户需求分析', [
            L5('1.1.1.3.1', 'Collect Customer Feedback', '收集客户反馈', [
              L6('1.1.1.3.1.1', 'Conduct Customer Surveys', '开展客户调研'),
              L6('1.1.1.3.1.2', 'Analyze Complaint Data', '分析投诉数据'),
            ]),
            L5('1.1.1.3.2', 'Identify Unmet Needs', '识别未满足需求', [
              L6('1.1.1.3.2.1', 'Map Customer Journey', '绘制客户旅程'),
              L6('1.1.1.3.2.2', 'Prioritize Need Items', '排序需求项'),
            ]),
          ]),
        ]),
        L3('1.1.2', 'Strategic Intent & Innovation Focus', '战略意图与创新焦点', [
          L4('1.1.2.1', 'Define Strategic Vision', '定义战略愿景', [
            L5('1.1.2.1.1', 'Articulate Vision Statement', '阐述愿景声明', [
              L6('1.1.2.1.1.1', 'Define Long-term Goals', '定义长期目标'),
              L6('1.1.2.1.1.2', 'Align with Core Values', '对齐核心价值观'),
            ]),
            L5('1.1.2.1.2', 'Set Strategic Milestones', '设定战略里程碑', [
              L6('1.1.2.1.2.1', 'Define 3-Year Targets', '定义3年目标'),
              L6('1.1.2.1.2.2', 'Define 5-Year Targets', '定义5年目标'),
            ]),
          ]),
          L4('1.1.2.2', 'Identify Innovation Focus', '识别创新焦点', [
            L5('1.1.2.2.1', 'Technology Innovation', '技术创新', [
              L6('1.1.2.2.1.1', 'Identify Emerging Technologies', '识别新兴技术'),
              L6('1.1.2.2.1.2', 'Evaluate Technology Maturity', '评估技术成熟度'),
            ]),
            L5('1.1.2.2.2', 'Business Model Innovation', '商业模式创新', [
              L6('1.1.2.2.2.1', 'Explore New Revenue Models', '探索新收入模式'),
              L6('1.1.2.2.2.2', 'Evaluate Partnership Models', '评估合作模式'),
            ]),
          ]),
        ]),
        L3('1.1.3', 'Business Design', '业务设计', [
          L4('1.1.3.1', 'Customer Segmentation', '客户细分', [
            L5('1.1.3.1.1', 'Define Customer Segments', '定义客户细分', [
              L6('1.1.3.1.1.1', 'Segment by Industry', '按行业细分'),
              L6('1.1.3.1.1.2', 'Segment by Revenue', '按收入细分'),
              L6('1.1.3.1.1.3', 'Segment by Geography', '按地域细分'),
            ]),
            L5('1.1.3.1.2', 'Select Target Segments', '选择目标细分', [
              L6('1.1.3.1.2.1', 'Evaluate Segment Attractiveness', '评估细分吸引力'),
              L6('1.1.3.1.2.2', 'Assess Fit with Capabilities', '评估能力匹配度'),
            ]),
          ]),
          L4('1.1.3.2', 'Value Proposition Design', '价值主张设计', [
            L5('1.1.3.2.1', 'Define Value Elements', '定义价值要素', [
              L6('1.1.3.2.1.1', 'Identify Core Value', '识别核心价值'),
              L6('1.1.3.2.1.2', 'Define Differentiators', '定义差异化要素'),
            ]),
            L5('1.1.3.2.2', 'Design Profit Model', '设计盈利模式', [
              L6('1.1.3.2.2.1', 'Define Revenue Streams', '定义收入来源'),
              L6('1.1.3.2.2.2', 'Define Cost Structure', '定义成本结构'),
            ]),
          ]),
          L4('1.1.3.3', 'Strategic Control Points', '战略控制点设计', [
            L5('1.1.3.3.1', 'Identify Control Points', '识别控制点', [
              L6('1.1.3.3.1.1', 'Analyze Patent Portfolio', '分析专利组合'),
              L6('1.1.3.3.1.2', 'Evaluate Brand Strength', '评估品牌实力'),
            ]),
            L5('1.1.3.3.2', 'Build Control Points', '构建控制点', [
              L6('1.1.3.3.2.1', 'File Key Patents', '申请关键专利'),
              L6('1.1.3.3.2.2', 'Establish Industry Standards', '建立行业标准'),
            ]),
          ]),
        ]),
        L3('1.1.4', 'Strategy Decoding & Execution', '战略解码与执行', [
          L4('1.1.4.1', 'Strategy Decoding Workshop', '战略解码工作坊', [
            L5('1.1.4.1.1', 'Organize Decoding Session', '组织解码会议', [
              L6('1.1.4.1.1.1', 'Select Workshop Participants', '选择参会人员'),
              L6('1.1.4.1.1.2', 'Prepare Workshop Materials', '准备会议材料'),
            ]),
            L5('1.1.4.1.2', 'Define Strategic Initiatives', '定义战略举措', [
              L6('1.1.4.1.2.1', 'Identify Key Initiatives', '识别关键举措'),
              L6('1.1.4.1.2.2', 'Assign Initiative Owners', '分配举措负责人'),
            ]),
          ]),
          L4('1.1.4.2', 'Strategy Execution Tracking', '战略执行跟踪', [
            L5('1.1.4.2.1', 'Set Execution Metrics', '设定执行指标', [
              L6('1.1.4.2.1.1', 'Define KPIs for Initiatives', '定义举措KPI'),
              L6('1.1.4.2.1.2', 'Set Milestone Dates', '设定里程碑日期'),
            ]),
            L5('1.1.4.2.2', 'Monitor Execution Progress', '监控执行进展', [
              L6('1.1.4.2.2.1', 'Collect Progress Reports', '收集进展报告'),
              L6('1.1.4.2.2.2', 'Conduct Review Meetings', '召开评审会议'),
            ]),
          ]),
        ]),
      ], 'DSTE 流程的前端：市场洞察、战略意图、创新焦点与业务设计，输出战略专题与解码。'),
      L2('1.2', 'Annual Business Plan (BP)', '年度经营计划', [
        L3('1.2.1', 'Business Objectives & KPI', '经营目标与KPI制定', [
          L4('1.2.1.1', 'Define Annual Objectives', '定义年度目标', [
            L5('1.2.1.1.1', 'Set Revenue Targets', '设定收入目标', [
              L6('1.2.1.1.1.1', 'Analyze Historical Performance', '分析历史业绩'),
              L6('1.2.1.1.1.2', 'Set Growth Rate', '设定增长率'),
            ]),
            L5('1.2.1.1.2', 'Set Profit Targets', '设定利润目标', [
              L6('1.2.1.1.2.1', 'Define Gross Margin Target', '定义毛利率目标'),
              L6('1.2.1.1.2.2', 'Define Net Profit Target', '定义净利润目标'),
            ]),
          ]),
          L4('1.2.1.2', 'KPI Decomposition', 'KPI分解', [
            L5('1.2.1.2.1', 'Cascading to Departments', '分解到部门', [
              L6('1.2.1.2.1.1', 'Define Department KPIs', '定义部门KPI'),
              L6('1.2.1.2.1.2', 'Align Cross-department Metrics', '对齐跨部门指标'),
            ]),
            L5('1.2.1.2.2', 'Cascading to Individuals', '分解到个人', [
              L6('1.2.1.2.2.1', 'Define Individual Goals', '定义个人目标'),
              L6('1.2.1.2.2.2', 'Sign Performance Contracts', '签署绩效合同'),
            ]),
          ]),
        ]),
        L3('1.2.2', 'Budgeting & Decomposition', '预算编制与分解', [
          L4('1.2.2.1', 'Budget Preparation', '预算编制', [
            L5('1.2.2.1.1', 'Collect Budget Requests', '收集预算申请', [
              L6('1.2.2.1.1.1', 'Issue Budget Guidelines', '发布预算指南'),
              L6('1.2.2.1.1.2', 'Review Department Requests', '审查部门申请'),
            ]),
            L5('1.2.2.1.2', 'Consolidate Budget', '汇总预算', [
              L6('1.2.2.1.2.1', 'Aggregate Budget Items', '汇总预算项'),
              L6('1.2.2.1.2.2', 'Balance Revenue and Expenses', '平衡收支'),
            ]),
          ]),
          L4('1.2.2.2', 'Budget Approval & Release', '预算审批与下达', [
            L5('1.2.2.2.1', 'Budget Review', '预算审查', [
              L6('1.2.2.2.1.1', 'Conduct Budget Review Meeting', '召开预算审查会'),
              L6('1.2.2.2.1.2', 'Adjust Budget Items', '调整预算项'),
            ]),
            L5('1.2.2.2.2', 'Budget Release', '预算下达', [
              L6('1.2.2.2.2.1', 'Publish Approved Budget', '发布批准预算'),
              L6('1.2.2.2.2.2', 'Communicate Budget Targets', '传达预算目标'),
            ]),
          ]),
        ]),
        L3('1.2.3', 'Business Monitoring & Rolling Forecast', '经营监控与滚动预测', [
          L4('1.2.3.1', 'Business Performance Monitoring', '经营绩效监控', [
            L5('1.2.3.1.1', 'Collect Performance Data', '收集绩效数据', [
              L6('1.2.3.1.1.1', 'Gather Financial Reports', '收集财务报告'),
              L6('1.2.3.1.1.2', 'Gather Operational Reports', '收集运营报告'),
            ]),
            L5('1.2.3.1.2', 'Analyze Performance Gaps', '分析绩效差距', [
              L6('1.2.3.1.2.1', 'Compare Actual vs Target', '对比实际与目标'),
              L6('1.2.3.1.2.2', 'Identify Root Causes', '识别根本原因'),
            ]),
          ]),
          L4('1.2.3.2', 'Rolling Forecast', '滚动预测', [
            L5('1.2.3.2.1', 'Update Forecast Assumptions', '更新预测假设', [
              L6('1.2.3.2.1.1', 'Review Market Conditions', '审查市场状况'),
              L6('1.2.3.2.1.2', 'Adjust Growth Assumptions', '调整增长假设'),
            ]),
            L5('1.2.3.2.2', 'Generate Rolling Forecast', '生成滚动预测', [
              L6('1.2.3.2.2.1', 'Run Forecast Model', '运行预测模型'),
              L6('1.2.3.2.2.2', 'Review and Approve Forecast', '审查并批准预测'),
            ]),
          ]),
        ]),
      ]),
      L2('1.3', 'Investment & Industry Development', '投资与产业发展', [
        L3('1.3.1', 'Investment Initiation', '投资立项管理', [
          L4('1.3.1.1', 'Investment Opportunity Identification', '投资机会识别', [
            L5('1.3.1.1.1', 'Source Investment Opportunities', '发掘投资机会', [
              L6('1.3.1.1.1.1', 'Scan Market for Opportunities', '扫描市场机会'),
              L6('1.3.1.1.1.2', 'Evaluate Strategic Fit', '评估战略匹配度'),
            ]),
            L5('1.3.1.1.2', 'Pre-screen Opportunities', '初步筛选机会', [
              L6('1.3.1.1.2.1', 'Assess Financial Viability', '评估财务可行性'),
              L6('1.3.1.1.2.2', 'Assess Risk Level', '评估风险等级'),
            ]),
          ]),
          L4('1.3.1.2', 'Investment Proposal & Approval', '投资建议与审批', [
            L5('1.3.1.2.1', 'Prepare Investment Proposal', '准备投资建议书', [
              L6('1.3.1.2.1.1', 'Conduct Due Diligence', '开展尽职调查'),
              L6('1.3.1.2.1.2', 'Build Financial Model', '构建财务模型'),
              L6('1.3.1.2.1.3', 'Draft Investment Report', '起草投资报告'),
            ]),
            L5('1.3.1.2.2', 'Investment Committee Review', '投资委员会评审', [
              L6('1.3.1.2.2.1', 'Present Investment Case', '陈述投资方案'),
              L6('1.3.1.2.2.2', 'Obtain Approval Decision', '获取审批决定'),
            ]),
          ]),
        ]),
        L3('1.3.2', 'M&A and Partnership', '并购与合作管理', [
          L4('1.3.2.1', 'M&A Execution', '并购执行', [
            L5('1.3.2.1.1', 'Target Identification', '目标识别', [
              L6('1.3.2.1.1.1', 'Define Target Criteria', '定义目标标准'),
              L6('1.3.2.1.1.2', 'Build Target Shortlist', '建立目标候选名单'),
            ]),
            L5('1.3.2.1.2', 'Deal Negotiation & Closing', '交易谈判与交割', [
              L6('1.3.2.1.2.1', 'Negotiate Deal Terms', '谈判交易条款'),
              L6('1.3.2.1.2.2', 'Execute Legal Documents', '签署法律文件'),
              L6('1.3.2.1.2.3', 'Complete Transaction Closing', '完成交易交割'),
            ]),
          ]),
          L4('1.3.2.2', 'Partnership Management', '合作管理', [
            L5('1.3.2.2.1', 'Partner Selection', '合作伙伴选择', [
              L6('1.3.2.2.1.1', 'Evaluate Partner Capabilities', '评估伙伴能力'),
              L6('1.3.2.2.1.2', 'Assess Cultural Fit', '评估文化匹配度'),
            ]),
            L5('1.3.2.2.2', 'Partnership Operation', '合作运营', [
              L6('1.3.2.2.2.1', 'Establish Joint Governance', '建立联合治理机制'),
              L6('1.3.2.2.2.2', 'Monitor Partnership KPIs', '监控合作KPI'),
            ]),
          ]),
        ]),
      ]),
    ],
  },
  {
    id: 'HW-MKT', code: '2.0',
    name: 'Marketing & Service (LTC)', label: '营销与服务',
    definition: '从线索到回款（LTC）与从问题到解决（ITR）：市场、线索、机会点、合同、交付回款与客户服务全流程。',
    children: [
      L2('2.1', 'Market & Lead Management', '市场与线索管理 (ML)', [
        L3('2.1.1', 'Marketing Campaign', '市场推广', [
          L4('2.1.1.1', 'Campaign Planning', '市场活动策划', [
            L5('2.1.1.1.1', 'Define Campaign Objectives', '定义市场活动目标', [
              L6('2.1.1.1.1.1', 'Set Target Audience', '设定目标受众'),
              L6('2.1.1.1.1.2', 'Define KPI Metrics', '定义KPI指标'),
              L6('2.1.1.1.1.3', 'Determine Budget Allocation', '确定预算分配'),
            ]),
            L5('2.1.1.1.2', 'Design Campaign Strategy', '设计市场活动策略', [
              L6('2.1.1.1.2.1', 'Select Campaign Channels', '选择活动渠道'),
              L6('2.1.1.1.2.2', 'Create Campaign Content', '创建活动的内容'),
              L6('2.1.1.1.2.3', 'Plan Campaign Timeline', '规划活动时间表'),
            ]),
          ]),
          L4('2.1.1.2', 'Campaign Execution', '市场活动执行', [
            L5('2.1.1.2.1', 'Launch Campaign', '启动市场活动', [
              L6('2.1.1.2.1.1', 'Publish Campaign Materials', '发布活动材料'),
              L6('2.1.1.2.1.2', 'Monitor Campaign Progress', '监控活动进展'),
            ]),
            L5('2.1.1.2.2', 'Campaign Optimization', '活动优化调整', [
              L6('2.1.1.2.2.1', 'Analyze Campaign Data', '分析活动数据'),
              L6('2.1.1.2.2.2', 'Adjust Campaign Parameters', '调整活动参数'),
            ]),
          ]),
          L4('2.1.1.3', 'Campaign Evaluation', '市场活动评估', [
            L5('2.1.1.3.1', 'Measure Campaign Results', '测量活动结果', [
              L6('2.1.1.3.1.1', 'Collect Response Data', '收集响应数据'),
              L6('2.1.1.3.1.2', 'Calculate ROI', '计算投资回报率'),
            ]),
            L5('2.1.1.3.2', 'Generate Campaign Report', '生成活动报告', [
              L6('2.1.1.3.2.1', 'Compile Performance Metrics', '汇编绩效指标'),
              L6('2.1.1.3.2.2', 'Document Lessons Learned', '记录经验教训'),
            ]),
          ]),
        ]),
        L3('2.1.2', 'Lead Collection & Nurturing', '线索收集与培育', [
          L4('2.1.2.1', 'Lead Collection', '线索收集', [
            L5('2.1.2.1.1', 'Capture Lead Information', '捕获线索信息', [
              L6('2.1.2.1.1.1', 'Record Contact Details', '记录联系信息'),
              L6('2.1.2.1.1.2', 'Document Interest Areas', '记录兴趣领域'),
              L6('2.1.2.1.1.3', 'Log Source Channel', '记录来源渠道'),
            ]),
            L5('2.1.2.1.2', 'Lead Data Validation', '线索数据验证', [
              L6('2.1.2.1.2.1', 'Verify Contact Information', '验证联系信息'),
              L6('2.1.2.1.2.2', 'Check Duplicate Records', '检查重复记录'),
            ]),
          ]),
          L4('2.1.2.2', 'Lead Nurturing', '线索培育', [
            L5('2.1.2.2.1', 'Design Nurture Program', '设计培育计划', [
              L6('2.1.2.2.1.1', 'Segment Lead Categories', '细分线索类别'),
              L6('2.1.2.2.1.2', 'Create Content Calendar', '创建内容日历'),
            ]),
            L5('2.1.2.2.2', 'Execute Nurture Activities', '执行培育活动', [
              L6('2.1.2.2.2.1', 'Send Targeted Communications', '发送定向沟通'),
              L6('2.1.2.2.2.2', 'Track Engagement Metrics', '跟踪参与度指标'),
            ]),
          ]),
        ]),
        L3('2.1.3', 'Lead Qualification & Distribution', '线索验证与分发', [
          L4('2.1.3.1', 'Lead Qualification', '线索验证', [
            L5('2.1.3.1.1', 'Assess Lead Quality', '评估线索质量', [
              L6('2.1.3.1.1.1', 'Evaluate Budget Availability', '评估预算可用性'),
              L6('2.1.3.1.1.2', 'Confirm Decision Authority', '确认决策权限'),
              L6('2.1.3.1.1.3', 'Identify Timeline', '识别时间线'),
              L6('2.1.3.1.1.4', 'Determine Need Fit', '确定需求匹配度'),
            ]),
            L5('2.1.3.1.2', 'Score and Grade Leads', '线索评分与分级', [
              L6('2.1.3.1.2.1', 'Apply Scoring Model', '应用评分模型'),
              L6('2.1.3.1.2.2', 'Assign Lead Grade', '分配线索等级'),
            ]),
          ]),
          L4('2.1.3.2', 'Lead Distribution', '线索分发', [
            L5('2.1.3.2.1', 'Assign Sales Owner', '分配销售负责人', [
              L6('2.1.3.2.1.1', 'Match Territory Rules', '匹配区域规则'),
              L6('2.1.3.2.1.2', 'Consider Workload Balance', '考虑工作负载平衡'),
            ]),
            L5('2.1.3.2.2', 'Notify and Transfer', '通知与移交', [
              L6('2.1.3.2.2.1', 'Send Assignment Notification', '发送分配通知'),
              L6('2.1.3.2.2.2', 'Transfer Lead Records', '移交线索记录'),
            ]),
          ]),
        ]),
      ], '市场与线索管理：从市场活动到线索收集、培育、验证与分发的完整流程。'),
      L2('2.2', 'Opportunity & Bidding', '机会点与投标管理', [
        L3('2.2.1', 'Opportunity Validation', '机会点验证', [
          L4('2.2.1.1', 'Opportunity Assessment', '机会点评估', [
            L5('2.2.1.1.1', 'Analyze Customer Requirements', '分析客户需求', [
              L6('2.2.1.1.1.1', 'Identify Explicit Needs', '识别显性需求'),
              L6('2.2.1.1.1.2', 'Uncover Implicit Needs', '挖掘隐性需求'),
              L6('2.2.1.1.1.3', 'Validate Budget Confirmation', '验证预算确认'),
            ]),
            L5('2.2.1.1.2', 'Evaluate Win Probability', '评估赢单概率', [
              L6('2.2.1.1.2.1', 'Assess Competitive Position', '评估竞争态势'),
              L6('2.2.1.1.2.2', 'Review Historical Win Rate', '回顾历史赢单率'),
            ]),
          ]),
          L4('2.2.1.2', 'Go/No-Go Decision', '投标决策', [
            L5('2.2.1.2.1', 'Conduct Opportunity Review', '进行机会点评审', [
              L6('2.2.1.2.1.1', 'Prepare Opportunity Brief', '准备机会点简报'),
              L6('2.2.1.2.1.2', 'Organize Review Meeting', '组织评审会议'),
            ]),
            L5('2.2.1.2.2', 'Make Go/No-Go Decision', '做出投标决策', [
              L6('2.2.1.2.2.1', 'Apply Decision Criteria', '应用决策标准'),
              L6('2.2.1.2.2.2', 'Document Decision Rationale', '记录决策依据'),
            ]),
          ]),
        ]),
        L3('2.2.2', 'Solution & Proposal', '解决方案与报价编制', [
          L4('2.2.2.1', 'Solution Design', '解决方案设计', [
            L5('2.2.2.1.1', 'Develop Technical Solution', '开发技术解决方案', [
              L6('2.2.2.1.1.1', 'Design Architecture', '设计架构方案'),
              L6('2.2.2.1.1.2', 'Select Product Components', '选择产品组件'),
              L6('2.2.2.1.1.3', 'Define Integration Approach', '定义集成方案'),
            ]),
            L5('2.2.2.1.2', 'Develop Commercial Solution', '开发商务解决方案', [
              L6('2.2.2.1.2.1', 'Design Pricing Structure', '设计价格结构'),
              L6('2.2.2.1.2.2', 'Define Payment Terms', '定义付款条件'),
            ]),
          ]),
          L4('2.2.2.2', 'Proposal Preparation', '报价编制', [
            L5('2.2.2.2.1', 'Prepare Cost Estimation', '准备成本估算', [
              L6('2.2.2.2.1.1', 'Calculate Direct Costs', '计算直接成本'),
              L6('2.2.2.2.1.2', 'Estimate Indirect Costs', '估算间接成本'),
              L6('2.2.2.2.1.3', 'Determine Profit Margin', '确定利润率'),
            ]),
            L5('2.2.2.2.2', 'Compile Proposal Document', '编制报价文档', [
              L6('2.2.2.2.2.1', 'Write Technical Proposal', '编写技术方案'),
              L6('2.2.2.2.2.2', 'Write Commercial Proposal', '编写商务报价'),
              L6('2.2.2.2.2.3', 'Review and Approve', '审核与批准'),
            ]),
          ]),
        ]),
        L3('2.2.3', 'Bidding & Negotiation', '投标与商务谈判', [
          L4('2.2.3.1', 'Bid Submission', '投标提交', [
            L5('2.2.3.1.1', 'Prepare Bid Package', '准备投标文件', [
              L6('2.2.3.1.1.1', 'Complete Bid Forms', '填写投标表格'),
              L6('2.2.3.1.1.2', 'Attach Required Documents', '附必需文件'),
              L6('2.2.3.1.1.3', 'Package and Seal', '封装与密封'),
            ]),
            L5('2.2.3.1.2', 'Submit Bid', '提交投标', [
              L6('2.2.3.1.2.1', 'Deliver Before Deadline', '在截止前递交'),
              L6('2.2.3.1.2.2', 'Obtain Receipt Confirmation', '获取接收确认'),
            ]),
          ]),
          L4('2.2.3.2', 'Negotiation & Closure', '谈判与关闭', [
            L5('2.2.3.2.1', 'Conduct Negotiations', '进行谈判', [
              L6('2.2.3.2.1.1', 'Prepare Negotiation Strategy', '准备谈判策略'),
              L6('2.2.3.2.1.2', 'Execute Negotiation Sessions', '执行谈判会议'),
              L6('2.2.3.2.1.3', 'Document Agreed Terms', '记录达成条款'),
            ]),
            L5('2.2.3.2.2', 'Close Opportunity', '关闭机会点', [
              L6('2.2.3.2.2.1', 'Record Win/Loss Outcome', '记录赢单/丢单结果'),
              L6('2.2.3.2.2.2', 'Conduct Post-Bid Review', '进行投标后复盘'),
            ]),
          ]),
        ]),
      ], '机会点与投标管理：从机会验证、方案设计到投标谈判的完整流程。'),
      L2('2.3', 'Contract Management', '合同管理', [
        L3('2.3.1', 'Contract Review', '合同评审', [
          L4('2.3.1.1', 'Contract Preparation', '合同准备', [
            L5('2.3.1.1.1', 'Draft Contract Terms', '起草合同条款', [
              L6('2.3.1.1.1.1', 'Define Scope of Work', '定义工作范围'),
              L6('2.3.1.1.1.2', 'Specify Deliverables', '明确交付物'),
              L6('2.3.1.1.1.3', 'Set Milestones', '设定里程碑'),
            ]),
            L5('2.3.1.1.2', 'Define Commercial Terms', '定义商务条款', [
              L6('2.3.1.1.2.1', 'Set Pricing and Payment', '设定价格与付款'),
              L6('2.3.1.1.2.2', 'Define Warranty Terms', '定义保修条款'),
              L6('2.3.1.1.2.3', 'Specify Penalty Clauses', '规定违约条款'),
            ]),
          ]),
          L4('2.3.1.2', 'Contract Review Process', '合同评审流程', [
            L5('2.3.1.2.1', 'Legal Review', '法务评审', [
              L6('2.3.1.2.1.1', 'Check Legal Compliance', '检查法律合规性'),
              L6('2.3.1.2.1.2', 'Identify Legal Risks', '识别法律风险'),
            ]),
            L5('2.3.1.2.2', 'Financial Review', '财务评审', [
              L6('2.3.1.2.2.1', 'Verify Pricing Accuracy', '验证价格准确性'),
              L6('2.3.1.2.2.2', 'Assess Payment Risk', '评估付款风险'),
            ]),
            L5('2.3.1.2.3', 'Technical Review', '技术评审', [
              L6('2.3.1.2.3.1', 'Validate Technical Feasibility', '验证技术可行性'),
              L6('2.3.1.2.3.2', 'Confirm Delivery Capability', '确认交付能力'),
            ]),
          ]),
        ]),
        L3('2.3.2', 'Contract Signing & Handover', '合同签订与交接', [
          L4('2.3.2.1', 'Contract Signing', '合同签订', [
            L5('2.3.2.1.1', 'Finalize Contract', '最终确定合同', [
              L6('2.3.2.1.1.1', 'Incorporate Review Feedback', '纳入评审意见'),
              L6('2.3.2.1.1.2', 'Prepare Final Version', '准备最终版本'),
            ]),
            L5('2.3.2.1.2', 'Execute Signing', '执行签署', [
              L6('2.3.2.1.2.1', 'Obtain Authorized Signatures', '获取授权签字'),
              L6('2.3.2.1.2.2', 'Archive Signed Contract', '归档已签合同'),
            ]),
          ]),
          L4('2.3.2.2', 'Contract Handover', '合同交接', [
            L5('2.3.2.2.1', 'Internal Handover', '内部交接', [
              L6('2.3.2.2.1.1', 'Brief Delivery Team', '向交付团队简报'),
              L6('2.3.2.2.1.2', 'Transfer Contract Documents', '移交合同文档'),
            ]),
            L5('2.3.2.2.2', 'Setup Contract Tracking', '建立合同跟踪', [
              L6('2.3.2.2.2.1', 'Create Contract Record', '创建合同记录'),
              L6('2.3.2.2.2.2', 'Setup Milestone Alerts', '设置里程碑提醒'),
            ]),
          ]),
        ]),
        L3('2.3.3', 'Contract Change & Closure', '合同变更与关闭', [
          L4('2.3.3.1', 'Contract Change Management', '合同变更管理', [
            L5('2.3.3.1.1', 'Process Change Request', '处理变更请求', [
              L6('2.3.3.1.1.1', 'Receive Change Request', '接收变更请求'),
              L6('2.3.3.1.1.2', 'Evaluate Change Impact', '评估变更影响'),
              L6('2.3.3.1.1.3', 'Negotiate Change Terms', '协商变更条款'),
            ]),
            L5('2.3.3.1.2', 'Execute Change', '执行变更', [
              L6('2.3.3.1.2.1', 'Update Contract Documents', '更新合同文档'),
              L6('2.3.3.1.2.2', 'Communicate Changes', '沟通变更内容'),
            ]),
          ]),
          L4('2.3.3.2', 'Contract Closure', '合同关闭', [
            L5('2.3.3.2.1', 'Verify Completion', '验证完成', [
              L6('2.3.3.2.1.1', 'Confirm Deliverable Acceptance', '确认交付物验收'),
              L6('2.3.3.2.1.2', 'Verify Payment Completion', '验证付款完成'),
            ]),
            L5('2.3.3.2.2', 'Close Contract', '关闭合同', [
              L6('2.3.3.2.2.1', 'Generate Closure Report', '生成关闭报告'),
              L6('2.3.3.2.2.2', 'Archive Contract Records', '归档合同记录'),
            ]),
          ]),
        ]),
      ], '合同管理：从合同评审、签订交接到变更关闭的全生命周期管理。'),
      L2('2.4', 'Customer Service (ITR)', '客户服务管理 (ITR)', [
        L3('2.4.1', 'Complaint Intake', '客户投诉受理', [
          L4('2.4.1.1', 'Issue Registration', '问题登记', [
            L5('2.4.1.1.1', 'Receive Complaint', '接收投诉', [
              L6('2.4.1.1.1.1', 'Record Customer Information', '记录客户信息'),
              L6('2.4.1.1.1.2', 'Document Issue Description', '记录问题描述'),
              L6('2.4.1.1.1.3', 'Assign Case Number', '分配案例编号'),
            ]),
            L5('2.4.1.1.2', 'Categorize Issue', '问题分类', [
              L6('2.4.1.1.2.1', 'Determine Issue Type', '确定问题类型'),
              L6('2.4.1.1.2.2', 'Set Priority Level', '设定优先级'),
            ]),
          ]),
          L4('2.4.1.2', 'Initial Assessment', '初步评估', [
            L5('2.4.1.2.1', 'Triage Issue', '问题分诊', [
              L6('2.4.1.2.1.1', 'Assess Urgency', '评估紧急程度'),
              L6('2.4.1.2.1.2', 'Determine Resolution Path', '确定解决路径'),
            ]),
            L5('2.4.1.2.2', 'Assign Owner', '分配负责人', [
              L6('2.4.1.2.2.1', 'Route to Appropriate Team', '路由到适当团队'),
              L6('2.4.1.2.2.2', 'Notify Customer', '通知客户'),
            ]),
          ]),
        ]),
        L3('2.4.2', 'Issue Resolution & Escalation', '服务问题处理与升级', [
          L4('2.4.2.1', 'Issue Investigation', '问题调查', [
            L5('2.4.2.1.1', 'Root Cause Analysis', '根本原因分析', [
              L6('2.4.2.1.1.1', 'Gather Evidence', '收集证据'),
              L6('2.4.2.1.1.2', 'Analyze Problem Patterns', '分析问题模式'),
              L6('2.4.2.1.1.3', 'Identify Root Cause', '识别根本原因'),
            ]),
            L5('2.4.2.1.2', 'Develop Solution', '制定解决方案', [
              L6('2.4.2.1.2.1', 'Propose Resolution Options', '提出解决选项'),
              L6('2.4.2.1.2.2', 'Select Best Solution', '选择最佳方案'),
            ]),
          ]),
          L4('2.4.2.2', 'Escalation Management', '升级管理', [
            L5('2.4.2.2.1', 'Trigger Escalation', '触发升级', [
              L6('2.4.2.2.1.1', 'Check SLA Breach', '检查SLA违约'),
              L6('2.4.2.2.1.2', 'Escalate to Higher Level', '升级到更高层级'),
            ]),
            L5('2.4.2.2.2', 'Manage Escalated Issue', '管理已升级问题', [
              L6('2.4.2.2.2.1', 'Assign Senior Resources', '分配高级资源'),
              L6('2.4.2.2.2.2', 'Track Escalation Progress', '跟踪升级进展'),
            ]),
          ]),
          L4('2.4.2.3', 'Resolution Execution', '解决执行', [
            L5('2.4.2.3.1', 'Implement Solution', '实施解决方案', [
              L6('2.4.2.3.1.1', 'Execute Fix', '执行修复'),
              L6('2.4.2.3.1.2', 'Verify Resolution', '验证解决'),
            ]),
            L5('2.4.2.3.2', 'Communicate Resolution', '沟通解决方案', [
              L6('2.4.2.3.2.1', 'Inform Customer', '通知客户'),
              L6('2.4.2.3.2.2', 'Document Resolution', '记录解决方案'),
            ]),
          ]),
        ]),
        L3('2.4.3', 'Customer Satisfaction', '客户满意度管理', [
          L4('2.4.3.1', 'Satisfaction Survey', '满意度调查', [
            L5('2.4.3.1.1', 'Conduct Survey', '执行调查', [
              L6('2.4.3.1.1.1', 'Send Survey Questionnaire', '发送调查问卷'),
              L6('2.4.3.1.1.2', 'Collect Responses', '收集回复'),
            ]),
            L5('2.4.3.1.2', 'Analyze Results', '分析结果', [
              L6('2.4.3.1.2.1', 'Calculate Satisfaction Score', '计算满意度得分'),
              L6('2.4.3.1.2.2', 'Identify Improvement Areas', '识别改进领域'),
            ]),
          ]),
          L4('2.4.3.2', 'Case Closure & Follow-up', '案例关闭与跟进', [
            L5('2.4.3.2.1', 'Close Case', '关闭案例', [
              L6('2.4.3.2.1.1', 'Confirm Customer Acceptance', '确认客户接受'),
              L6('2.4.3.2.1.2', 'Archive Case Records', '归档案例记录'),
            ]),
            L5('2.4.3.2.2', 'Follow-up', '后续跟进', [
              L6('2.4.3.2.2.1', 'Schedule Follow-up Call', '安排回访'),
              L6('2.4.3.2.2.2', 'Monitor Recurrence', '监控复发情况'),
            ]),
          ]),
        ]),
      ], '从问题到解决（ITR）：受理、分派、处理、升级与关闭的完整客户服务流程。'),
    ],
  },
  {
    id: 'HW-IPD', code: '3.0',
    name: 'Product Development (IPD)', label: '产品研发',
    definition: '集成产品开发（IPD）：市场管理、Charter 立项、结构化开发流程、技术评审与产品数据管理。',
    children: [
      L2('3.1', 'Product Planning & Charter', '产品规划与立项', [
        L3('3.1.1', 'Market Management (MM)', '市场管理(MM)', [
          L4('3.1.1.1', 'Market Segmentation', '市场细分', [
            L5('3.1.1.1.1', 'Identify Market Segments', '识别市场细分', [
              L6('3.1.1.1.1.1', 'Analyze Customer Needs', '分析客户需求'),
              L6('3.1.1.1.1.2', 'Define Segment Criteria', '定义细分标准'),
            ]),
            L5('3.1.1.1.2', 'Evaluate Segment Attractiveness', '评估细分吸引力', [
              L6('3.1.1.1.2.1', 'Assess Market Size', '评估市场规模'),
              L6('3.1.1.1.2.2', 'Assess Growth Potential', '评估增长潜力'),
            ]),
          ]),
          L4('3.1.1.2', 'Market Positioning', '市场定位', [
            L5('3.1.1.2.1', 'Define Value Proposition', '定义价值主张', [
              L6('3.1.1.2.1.1', 'Identify Key Differentiators', '识别关键差异化要素'),
              L6('3.1.1.2.1.2', 'Validate with Customers', '与客户验证'),
            ]),
            L5('3.1.1.2.2', 'Develop Positioning Strategy', '制定定位策略', [
              L6('3.1.1.2.2.1', 'Define Target Position', '定义目标定位'),
              L6('3.1.1.2.2.2', 'Create Positioning Statement', '创建定位声明'),
            ]),
          ]),
        ]),
        L3('3.1.2', 'Charter Development', '项目任务书(Charter)开发', [
          L4('3.1.2.1', 'Charter Preparation', '任务书准备', [
            L5('3.1.2.1.1', 'Define Product Scope', '定义产品范围', [
              L6('3.1.2.1.1.1', 'Define Product Features', '定义产品特性'),
              L6('3.1.2.1.1.2', 'Define Target Market', '定义目标市场'),
              L6('3.1.2.1.1.3', 'Define Success Criteria', '定义成功标准'),
            ]),
            L5('3.1.2.1.2', 'Estimate Investment', '估算投资', [
              L6('3.1.2.1.2.1', 'Estimate Development Cost', '估算开发成本'),
              L6('3.1.2.1.2.2', 'Estimate Revenue Potential', '估算收入潜力'),
            ]),
          ]),
          L4('3.1.2.2', 'Charter Review & Approval', '任务书评审与批准', [
            L5('3.1.2.2.1', 'Charter Review', '任务书评审', [
              L6('3.1.2.2.1.1', 'Conduct IPMT Review', '执行IPMT评审'),
              L6('3.1.2.2.1.2', 'Address Review Comments', '处理评审意见'),
            ]),
            L5('3.1.2.2.2', 'Charter Approval', '任务书批准', [
              L6('3.1.2.2.2.1', 'Obtain IPMT Approval', '获取IPMT批准'),
              L6('3.1.2.2.2.2', 'Release Charter', '发布任务书'),
            ]),
          ]),
        ]),
        L3('3.1.3', 'Product Roadmap', '产品路标规划', [
          L4('3.1.3.1', 'Roadmap Development', '路标制定', [
            L5('3.1.3.1.1', 'Define Product Generations', '定义产品代际', [
              L6('3.1.3.1.1.1', 'Plan Current Generation', '规划当前代产品'),
              L6('3.1.3.1.1.2', 'Plan Next Generation', '规划下一代产品'),
            ]),
            L5('3.1.3.1.2', 'Define Release Timeline', '定义发布时间线', [
              L6('3.1.3.1.2.1', 'Set Release Dates', '设定发布日期'),
              L6('3.1.3.1.2.2', 'Align with Market Windows', '对齐市场窗口'),
            ]),
          ]),
          L4('3.1.3.2', 'Roadmap Management', '路标管理', [
            L5('3.1.3.2.1', 'Roadmap Review', '路标评审', [
              L6('3.1.3.2.1.1', 'Quarterly Roadmap Review', '季度路标评审'),
              L6('3.1.3.2.1.2', 'Adjust Roadmap Items', '调整路标项'),
            ]),
            L5('3.1.3.2.2', 'Roadmap Communication', '路标沟通', [
              L6('3.1.3.2.2.1', 'Publish Roadmap', '发布路标'),
              L6('3.1.3.2.2.2', 'Communicate to Stakeholders', '沟通给利益相关者'),
            ]),
          ]),
        ]),
      ]),
      L2('3.2', 'Product Development Execution', '产品开发管理', [
        L3('3.2.1', 'Concept & Plan Phase', '概念与计划阶段', [
          L4('3.2.1.1', 'Concept Phase', '概念阶段', [
            L5('3.2.1.1.1', 'Develop Concept', '开发概念', [
              L6('3.2.1.1.1.1', 'Define Product Vision', '定义产品愿景'),
              L6('3.2.1.1.1.2', 'Identify Key Requirements', '识别关键需求'),
              L6('3.2.1.1.1.3', 'Assess Technical Feasibility', '评估技术可行性'),
            ]),
            L5('3.2.1.1.2', 'Concept Review (CDCP)', '概念决策评审', [
              L6('3.2.1.1.2.1', 'Prepare Concept Package', '准备概念包'),
              L6('3.2.1.1.2.2', 'Conduct CDCP Review', '执行CDCP评审'),
            ]),
          ]),
          L4('3.2.1.2', 'Plan Phase', '计划阶段', [
            L5('3.2.1.2.1', 'Develop Detailed Plan', '制定详细计划', [
              L6('3.2.1.2.1.1', 'Define Product Specifications', '定义产品规格'),
              L6('3.2.1.2.1.2', 'Create Project Schedule', '创建项目计划'),
              L6('3.2.1.2.1.3', 'Estimate Resources and Budget', '估算资源与预算'),
            ]),
            L5('3.2.1.2.2', 'Plan Review (PDCP)', '计划决策评审', [
              L6('3.2.1.2.2.1', 'Prepare Plan Package', '准备计划包'),
              L6('3.2.1.2.2.2', 'Conduct PDCP Review', '执行PDCP评审'),
            ]),
          ]),
        ]),
        L3('3.2.2', 'Develop & Verify Phase', '开发与验证阶段', [
          L4('3.2.2.1', 'Development Phase', '开发阶段', [
            L5('3.2.2.1.1', 'Product Design', '产品设计', [
              L6('3.2.2.1.1.1', 'Detailed Design', '详细设计'),
              L6('3.2.2.1.1.2', 'Design Review (TR)', '技术评审(TR)'),
              L6('3.2.2.1.1.3', 'Prototype Development', '原型开发'),
            ]),
            L5('3.2.2.1.2', 'Integration & Testing', '集成与测试', [
              L6('3.2.2.1.2.1', 'Module Integration', '模块集成'),
              L6('3.2.2.1.2.2', 'System Testing', '系统测试'),
              L6('3.2.2.1.2.3', 'Bug Fix and Optimization', '缺陷修复与优化'),
            ]),
          ]),
          L4('3.2.2.2', 'Verification Phase', '验证阶段', [
            L5('3.2.2.2.1', 'Product Verification', '产品验证', [
              L6('3.2.2.2.1.1', 'Performance Testing', '性能测试'),
              L6('3.2.2.2.1.2', 'Reliability Testing', '可靠性测试'),
              L6('3.2.2.2.1.3', 'Compliance Testing', '合规性测试'),
            ]),
            L5('3.2.2.2.2', 'Verification Review (ADCP)', '验证决策评审', [
              L6('3.2.2.2.2.1', 'Prepare Verification Report', '准备验证报告'),
              L6('3.2.2.2.2.2', 'Conduct ADCP Review', '执行ADCP评审'),
            ]),
          ]),
        ]),
        L3('3.2.3', 'Launch & Lifecycle Management', '发布与生命周期管理', [
          L4('3.2.3.1', 'Product Launch', '产品发布', [
            L5('3.2.3.1.1', 'Launch Preparation', '发布准备', [
              L6('3.2.3.1.1.1', 'Prepare Marketing Materials', '准备营销材料'),
              L6('3.2.3.1.1.2', 'Train Sales Team', '培训销售团队'),
              L6('3.2.3.1.1.3', 'Setup Production Line', '建立生产线'),
            ]),
            L5('3.2.3.1.2', 'Launch Execution', '发布执行', [
              L6('3.2.3.1.2.1', 'Launch Review (GA)', '发布评审(GA)'),
              L6('3.2.3.1.2.2', 'Market Release', '市场发布'),
            ]),
          ]),
          L4('3.2.3.2', 'Lifecycle Management', '生命周期管理', [
            L5('3.2.3.2.1', 'Product Maintenance', '产品维护', [
              L6('3.2.3.2.1.1', 'Handle Customer Feedback', '处理客户反馈'),
              L6('3.2.3.2.1.2', 'Release Updates and Patches', '发布更新与补丁'),
            ]),
            L5('3.2.3.2.2', 'Product Retirement', '产品退市', [
              L6('3.2.3.2.2.1', 'Plan Retirement', '规划退市'),
              L6('3.2.3.2.2.2', 'Execute Retirement', '执行退市'),
            ]),
          ]),
        ]),
        L3('3.2.4', 'Technical Review (TR)', '技术评审(TR)', [
          L4('3.2.4.1', 'TR1-TR6 Reviews', 'TR1-TR6评审', [
            L5('3.2.4.1.1', 'TR1: Requirements Review', 'TR1: 需求评审', [
              L6('3.2.4.1.1.1', 'Review Requirements Completeness', '评审需求完整性'),
              L6('3.2.4.1.1.2', 'Validate Requirements Feasibility', '验证需求可行性'),
            ]),
            L5('3.2.4.1.2', 'TR2-TR3: Design Review', 'TR2-TR3: 设计评审', [
              L6('3.2.4.1.2.1', 'Review Architecture Design', '评审架构设计'),
              L6('3.2.4.1.2.2', 'Review Detailed Design', '评审详细设计'),
            ]),
            L5('3.2.4.1.3', 'TR4-TR6: Verification Review', 'TR4-TR6: 验证评审', [
              L6('3.2.4.1.3.1', 'Review Test Results', '评审测试结果'),
              L6('3.2.4.1.3.2', 'Validate Product Readiness', '验证产品就绪状态'),
            ]),
          ]),
        ]),
      ], '结构化开发流程：概念—计划—开发—验证—发布各阶段与决策评审/技术评审。'),
      L2('3.3', 'Technology & Platform', '技术与平台管理', [
        L3('3.3.1', 'Technology Planning & Research', '技术规划与预研', [
          L4('3.3.1.1', 'Technology Planning', '技术规划', [
            L5('3.3.1.1.1', 'Technology Roadmap', '技术路标制定', [
              L6('3.3.1.1.1.1', 'Identify Technology Trends', '识别技术趋势'),
              L6('3.3.1.1.1.2', 'Define Technology Milestones', '定义技术里程碑'),
            ]),
            L5('3.3.1.1.2', 'Technology Investment Plan', '技术投资计划', [
              L6('3.3.1.1.2.1', 'Estimate R&D Budget', '估算研发预算'),
              L6('3.3.1.1.2.2', 'Allocate Resources', '分配资源'),
            ]),
          ]),
          L4('3.3.1.2', 'Technology Research Execution', '预研执行', [
            L5('3.3.1.2.1', 'Research Project Initiation', '预研项目立项', [
              L6('3.3.1.2.1.1', 'Define Research Scope', '定义研究范围'),
              L6('3.3.1.2.1.2', 'Assign Research Team', '分配研究团队'),
            ]),
            L5('3.3.1.2.2', 'Research Execution & Review', '预研执行与评审', [
              L6('3.3.1.2.2.1', 'Conduct Technology Experiments', '开展技术实验'),
              L6('3.3.1.2.2.2', 'Document Research Results', '记录研究结果'),
              L6('3.3.1.2.2.3', 'Conduct Technology Readiness Review', '执行技术成熟度评审'),
            ]),
          ]),
        ]),
        L3('3.3.2', 'Common Building Block (CBB)', '共用基础模块(CBB)管理', [
          L4('3.3.2.1', 'CBB Planning', 'CBB规划', [
            L5('3.3.2.1.1', 'Identify CBB Candidates', '识别CBB候选', [
              L6('3.3.2.1.1.1', 'Analyze Product Commonalities', '分析产品共性'),
              L6('3.3.2.1.1.2', 'Define CBB Scope', '定义CBB范围'),
            ]),
            L5('3.3.2.1.2', 'CBB Development Plan', 'CBB开发计划', [
              L6('3.3.2.1.2.1', 'Define CBB Specifications', '定义CBB规格'),
              L6('3.3.2.1.2.2', 'Set CBB Development Schedule', '设定CBB开发计划'),
            ]),
          ]),
          L4('3.3.2.2', 'CBB Development & Reuse', 'CBB开发与重用', [
            L5('3.3.2.2.1', 'CBB Development', 'CBB开发', [
              L6('3.3.2.2.1.1', 'Design CBB Architecture', '设计CBB架构'),
              L6('3.3.2.2.1.2', 'Implement CBB', '实现CBB'),
              L6('3.3.2.2.1.3', 'Test and Validate CBB', '测试与验证CBB'),
            ]),
            L5('3.3.2.2.2', 'CBB Reuse Management', 'CBB重用管理', [
              L6('3.3.2.2.2.1', 'Publish CBB to Library', '发布CBB到库'),
              L6('3.3.2.2.2.2', 'Track CBB Reuse Rate', '跟踪CBB重用率'),
            ]),
          ]),
        ]),
      ]),
      L2('3.4', 'Product Data Management', '产品数据管理', [
        L3('3.4.1', 'Document & BOM Management', '图文档与BOM管理', [
          L4('3.4.1.1', 'Document Management', '图文档管理', [
            L5('3.4.1.1.1', 'Document Creation', '文档创建', [
              L6('3.4.1.1.1.1', 'Create Design Documents', '创建设计文档'),
              L6('3.4.1.1.1.2', 'Create Test Documents', '创建测试文档'),
            ]),
            L5('3.4.1.1.2', 'Document Review & Release', '文档评审与发布', [
              L6('3.4.1.1.2.1', 'Conduct Document Review', '执行文档评审'),
              L6('3.4.1.1.2.2', 'Approve and Release Document', '批准并发布文档'),
            ]),
          ]),
          L4('3.4.1.2', 'BOM Management', 'BOM管理', [
            L5('3.4.1.2.1', 'BOM Creation', 'BOM创建', [
              L6('3.4.1.2.1.1', 'Create EBOM', '创建EBOM'),
              L6('3.4.1.2.1.2', 'Create MBOM', '创建MBOM'),
            ]),
            L5('3.4.1.2.2', 'BOM Maintenance', 'BOM维护', [
              L6('3.4.1.2.2.1', 'Update BOM Items', '更新BOM项'),
              L6('3.4.1.2.2.2', 'Validate BOM Accuracy', '验证BOM准确性'),
            ]),
          ]),
        ]),
        L3('3.4.2', 'Engineering Change (ECN)', '工程变更管理(ECN)', [
          L4('3.4.2.1', 'Change Request', '变更请求', [
            L5('3.4.2.1.1', 'Submit Change Request', '提交变更请求', [
              L6('3.4.2.1.1.1', 'Describe Change Reason', '描述变更原因'),
              L6('3.4.2.1.1.2', 'Define Change Scope', '定义变更范围'),
            ]),
            L5('3.4.2.1.2', 'Change Impact Analysis', '变更影响分析', [
              L6('3.4.2.1.2.1', 'Analyze Cost Impact', '分析成本影响'),
              L6('3.4.2.1.2.2', 'Analyze Schedule Impact', '分析进度影响'),
              L6('3.4.2.1.2.3', 'Analyze Quality Impact', '分析质量影响'),
            ]),
          ]),
          L4('3.4.2.2', 'Change Execution', '变更执行', [
            L5('3.4.2.2.1', 'Change Review & Approval', '变更评审与批准', [
              L6('3.4.2.2.1.1', 'Conduct CCB Review', '执行CCB评审'),
              L6('3.4.2.2.1.2', 'Obtain Change Approval', '获取变更批准'),
            ]),
            L5('3.4.2.2.2', 'Change Implementation', '变更实施', [
              L6('3.4.2.2.2.1', 'Update Design Documents', '更新设计文档'),
              L6('3.4.2.2.2.2', 'Update BOM', '更新BOM'),
              L6('3.4.2.2.2.3', 'Notify Affected Parties', '通知相关方'),
            ]),
          ]),
        ]),
      ]),
    ],
  },
  {
    id: 'HW-ISC', code: '4.0',
    name: 'Integrated Supply Chain (ISC)', label: '集成供应链',
    definition: '集成供应链（ISC）：需求预测、产销协同（S&OP）、采购、仓储物流与订单履行，衔接制造交付。',
    children: [
      L2('4.1', 'Demand & Planning', '需求与计划管理', [
        L3('4.1.1', 'Demand Forecasting', '需求预测管理', [
          L4('4.1.1.1', 'Data Collection', '数据收集', [
            L5('4.1.1.1.1', 'Gather Historical Data', '收集历史数据', [
              L6('4.1.1.1.1.1', 'Extract Sales History', '提取销售历史'),
              L6('4.1.1.1.1.2', 'Collect Market Intelligence', '收集市场情报'),
            ]),
            L5('4.1.1.1.2', 'Clean and Validate Data', '清洗与验证数据', [
              L6('4.1.1.1.2.1', 'Remove Outliers', '剔除异常值'),
              L6('4.1.1.1.2.2', 'Fill Missing Values', '填补缺失值'),
            ]),
          ]),
          L4('4.1.1.2', 'Forecast Generation', '生成预测', [
            L5('4.1.1.2.1', 'Apply Forecasting Models', '应用预测模型', [
              L6('4.1.1.2.1.1', 'Run Statistical Models', '运行统计模型'),
              L6('4.1.1.2.1.2', 'Adjust for Seasonality', '季节性调整'),
            ]),
            L5('4.1.1.2.2', 'Review and Approve Forecast', '评审与批准预测', [
              L6('4.1.1.2.2.1', 'Conduct Consensus Meeting', '召开共识会议'),
              L6('4.1.1.2.2.2', 'Finalize Forecast', '确定最终预测'),
            ]),
          ]),
        ]),
        L3('4.1.2', 'Sales & Operations Planning (S&OP)', '产销协同(S&OP)', [
          L4('4.1.2.1', 'S&OP Process', 'S&OP流程', [
            L5('4.1.2.1.1', 'Demand Review', '需求评审', [
              L6('4.1.2.1.1.1', 'Present Demand Plan', '呈现需求计划'),
              L6('4.1.2.1.1.2', 'Align with Sales Team', '与销售团队对齐'),
            ]),
            L5('4.1.2.1.2', 'Supply Review', '供应评审', [
              L6('4.1.2.1.2.1', 'Assess Capacity Constraints', '评估产能约束'),
              L6('4.1.2.1.2.2', 'Identify Supply Gaps', '识别供应缺口'),
            ]),
            L5('4.1.2.1.3', 'Executive S&OP Meeting', '执行S&OP会议', [
              L6('4.1.2.1.3.1', 'Present Balanced Plan', '呈现平衡计划'),
              L6('4.1.2.1.3.2', 'Approve S&OP Plan', '批准S&OP计划'),
            ]),
          ]),
        ]),
        L3('4.1.3', 'Master Production Schedule (MPS)', '主生产计划(MPS)', [
          L4('4.1.3.1', 'MPS Development', 'MPS制定', [
            L5('4.1.3.1.1', 'Convert S&OP to MPS', '将S&OP转换为MPS', [
              L6('4.1.3.1.1.1', 'Disaggregate by Product', '按产品分解'),
              L6('4.1.3.1.1.2', 'Schedule by Time Bucket', '按时间桶排程'),
            ]),
            L5('4.1.3.1.2', 'MPS Validation', 'MPS验证', [
              L6('4.1.3.1.2.1', 'Check Capacity Feasibility', '检查产能可行性'),
              L6('4.1.3.1.2.2', 'Resolve Conflicts', '解决冲突'),
            ]),
          ]),
        ]),
        L3('4.1.4', 'Material Requirement Planning (MRP)', '物料需求计划(MRP)', [
          L4('4.1.4.1', 'MRP Run', 'MRP运算', [
            L5('4.1.4.1.1', 'Calculate Material Needs', '计算物料需求', [
              L6('4.1.4.1.1.1', 'Explode BOM', '展开BOM'),
              L6('4.1.4.1.1.2', 'Net Against Inventory', '扣减库存'),
              L6('4.1.4.1.1.3', 'Generate Purchase Requisitions', '生成采购申请'),
            ]),
            L5('4.1.4.1.2', 'MRP Results Review', 'MRP结果评审', [
              L6('4.1.4.1.2.1', 'Analyze Exceptions', '分析异常'),
              L6('4.1.4.1.2.2', 'Adjust Parameters', '调整参数'),
            ]),
          ]),
        ]),
      ]),
      L2('4.2', 'Procurement', '采购管理', [
        L3('4.2.1', 'Supplier Qualification', '供应商认证与引入', [
          L4('4.2.1.1', 'Supplier Sourcing', '供应商寻源', [
            L5('4.2.1.1.1', 'Identify Potential Suppliers', '识别潜在供应商', [
              L6('4.2.1.1.1.1', 'Market Research', '市场调研'),
              L6('4.2.1.1.1.2', 'Collect Supplier Information', '收集供应商信息'),
            ]),
            L5('4.2.1.1.2', 'Pre-qualification Screening', '资格预审', [
              L6('4.2.1.1.2.1', 'Review Basic Qualifications', '审查基本资质'),
              L6('4.2.1.1.2.2', 'Check Financial Stability', '检查财务稳定性'),
            ]),
          ]),
          L4('4.2.1.2', 'Supplier Audit', '供应商审核', [
            L5('4.2.1.2.1', 'On-site Audit', '现场审核', [
              L6('4.2.1.2.1.1', 'Assess Production Capability', '评估生产能力'),
              L6('4.2.1.2.1.2', 'Evaluate Quality System', '评估质量体系'),
              L6('4.2.1.2.1.3', 'Review Environmental Compliance', '审查环保合规'),
            ]),
            L5('4.2.1.2.2', 'Audit Report & Approval', '审核报告与批准', [
              L6('4.2.1.2.2.1', 'Compile Audit Findings', '汇编审核发现'),
              L6('4.2.1.2.2.2', 'Approve Supplier List', '批准供应商名录'),
            ]),
          ]),
        ]),
        L3('4.2.2', 'Purchase Execution', '采购执行', [
          L4('4.2.2.1', 'Purchase Order Processing', '采购订单处理', [
            L5('4.2.2.1.1', 'Create Purchase Order', '创建采购订单', [
              L6('4.2.2.1.1.1', 'Select Approved Supplier', '选择合格供应商'),
              L6('4.2.2.1.1.2', 'Specify Quantity and Delivery', '指定数量与交期'),
              L6('4.2.2.1.1.3', 'Confirm Pricing Terms', '确认价格条款'),
            ]),
            L5('4.2.2.1.2', 'Order Confirmation & Tracking', '订单确认与跟踪', [
              L6('4.2.2.1.2.1', 'Obtain Supplier Confirmation', '获取供应商确认'),
              L6('4.2.2.1.2.2', 'Monitor Delivery Progress', '监控交货进度'),
            ]),
          ]),
          L4('4.2.2.2', 'Goods Receipt & Inspection', '到货与检验', [
            L5('4.2.2.2.1', 'Receive Goods', '接收货物', [
              L6('4.2.2.2.1.1', 'Verify Delivery Quantity', '核对交货数量'),
              L6('4.2.2.2.1.2', 'Check Packaging Integrity', '检查包装完整性'),
            ]),
            L5('4.2.2.2.2', 'Incoming Quality Check', '来料质量检验', [
              L6('4.2.2.2.2.1', 'Execute IQC Inspection', '执行IQC检验'),
              L6('4.2.2.2.2.2', 'Record Inspection Results', '记录检验结果'),
            ]),
          ]),
        ]),
        L3('4.2.3', 'Supplier Performance', '供应商绩效管理', [
          L4('4.2.3.1', 'Performance Evaluation', '绩效评估', [
            L5('4.2.3.1.1', 'Collect Performance Data', '收集绩效数据', [
              L6('4.2.3.1.1.1', 'Track Delivery On-time Rate', '跟踪准时交货率'),
              L6('4.2.3.1.1.2', 'Track Quality Pass Rate', '跟踪质量合格率'),
              L6('4.2.3.1.1.3', 'Track Cost Competitiveness', '跟踪成本竞争力'),
            ]),
            L5('4.2.3.1.2', 'Score and Grade', '评分与分级', [
              L6('4.2.3.1.2.1', 'Calculate Performance Score', '计算绩效得分'),
              L6('4.2.3.1.2.2', 'Assign Supplier Grade', '分配供应商等级'),
            ]),
          ]),
          L4('4.2.3.2', 'Supplier Development', '供应商发展', [
            L5('4.2.3.2.1', 'Identify Improvement Areas', '识别改进领域', [
              L6('4.2.3.2.1.1', 'Analyze Performance Gaps', '分析绩效差距'),
              L6('4.2.3.2.1.2', 'Define Improvement Targets', '定义改进目标'),
            ]),
            L5('4.2.3.2.2', 'Execute Improvement Plan', '执行改进计划', [
              L6('4.2.3.2.2.1', 'Provide Technical Support', '提供技术支持'),
              L6('4.2.3.2.2.2', 'Monitor Improvement Progress', '监控改进进展'),
            ]),
          ]),
        ]),
        L3('4.2.4', 'Pricing & Cost Management', '采购价格与成本管理', [
          L4('4.2.4.1', 'Price Analysis', '价格分析', [
            L5('4.2.4.1.1', 'Market Price Research', '市场价格调研', [
              L6('4.2.4.1.1.1', 'Collect Market Prices', '收集市场价格'),
              L6('4.2.4.1.1.2', 'Analyze Price Trends', '分析价格趋势'),
            ]),
            L5('4.2.4.1.2', 'Cost Breakdown Analysis', '成本构成分析', [
              L6('4.2.4.1.2.1', 'Analyze Material Cost', '分析材料成本'),
              L6('4.2.4.1.2.2', 'Analyze Labor and Overhead', '分析人工与制造费用'),
            ]),
          ]),
          L4('4.2.4.2', 'Price Negotiation', '价格谈判', [
            L5('4.2.4.2.1', 'Prepare Negotiation', '准备谈判', [
              L6('4.2.4.2.1.1', 'Set Target Price', '设定目标价格'),
              L6('4.2.4.2.1.2', 'Define Negotiation Strategy', '制定谈判策略'),
            ]),
            L5('4.2.4.2.2', 'Execute Negotiation', '执行谈判', [
              L6('4.2.4.2.2.1', 'Conduct Price Negotiation', '进行价格谈判'),
              L6('4.2.4.2.2.2', 'Finalize Pricing Agreement', '确定价格协议'),
            ]),
          ]),
        ]),
      ]),
      L2('4.3', 'Warehousing & Logistics', '仓储与物流管理', [
        L3('4.3.1', 'Inbound Management', '入库管理', [
          L4('4.3.1.1', 'Goods Receipt', '收货', [
            L5('4.3.1.1.1', 'Receive Delivery', '接收送货', [
              L6('4.3.1.1.1.1', 'Verify Delivery Notice', '核对送货单'),
              L6('4.3.1.1.1.2', 'Check Vehicle and Seal', '检查车辆与封条'),
            ]),
            L5('4.3.1.1.2', 'Unloading & Counting', '卸货与清点', [
              L6('4.3.1.1.2.1', 'Execute Unloading', '执行卸货'),
              L6('4.3.1.1.2.2', 'Count Received Quantity', '清点收货数量'),
            ]),
          ]),
          L4('4.3.1.2', 'Put-away', '上架', [
            L5('4.3.1.2.1', 'Assign Storage Location', '分配储位', [
              L6('4.3.1.2.1.1', 'Determine Storage Zone', '确定存储区域'),
              L6('4.3.1.2.1.2', 'Assign Bin Location', '分配库位'),
            ]),
            L5('4.3.1.2.2', 'Execute Put-away', '执行上架', [
              L6('4.3.1.2.2.1', 'Move Goods to Location', '搬运货物到储位'),
              L6('4.3.1.2.2.2', 'Confirm Put-away in System', '系统确认上架'),
            ]),
          ]),
        ]),
        L3('4.3.2', 'Outbound & Distribution', '出库与配送管理', [
          L4('4.3.2.1', 'Order Picking', '拣货', [
            L5('4.3.2.1.1', 'Generate Pick List', '生成拣货单', [
              L6('4.3.2.1.1.1', 'Allocate Inventory', '分配库存'),
              L6('4.3.2.1.1.2', 'Generate Pick Wave', '生成拣货波次'),
            ]),
            L5('4.3.2.1.2', 'Execute Picking', '执行拣', [
              L6('4.3.2.1.2.1', 'Navigate to Location', '导航到库位'),
              L6('4.3.2.1.2.2', 'Pick and Verify Quantity', '拣货并核对数量'),
            ]),
          ]),
          L4('4.3.2.2', 'Shipping', '发货', [
            L5('4.3.2.2.1', 'Pack and Label', '包装与标识', [
              L6('4.3.2.2.1.1', 'Pack Goods for Shipment', '包装发货'),
              L6('4.3.2.2.1.2', 'Attach Shipping Labels', '粘贴运输标签'),
            ]),
            L5('4.3.2.2.2', 'Load and Dispatch', '装车与发运', [
              L6('4.3.2.2.2.1', 'Load onto Vehicle', '装车'),
              L6('4.3.2.2.2.2', 'Generate Shipping Document', '生成发货单'),
            ]),
          ]),
        ]),
        L3('4.3.3', 'Stocktaking', '库存盘点', [
          L4('4.3.3.1', 'Inventory Count', '库存清点', [
            L5('4.3.3.1.1', 'Plan Inventory Count', '盘点计划', [
              L6('4.3.3.1.1.1', 'Define Count Scope', '定义盘点范围'),
              L6('4.3.3.1.1.2', 'Assign Count Teams', '分配盘点小组'),
            ]),
            L5('4.3.3.1.2', 'Execute Count', '执行盘点', [
              L6('4.3.3.1.2.1', 'Count Physical Inventory', '清点实物'),
              L6('4.3.3.1.2.2', 'Record Count Results', '记录盘点结果'),
            ]),
          ]),
          L4('4.3.3.2', 'Variance Analysis & Adjustment', '差异分析与调整', [
            L5('4.3.3.2.1', 'Analyze Variance', '差异分析', [
              L6('4.3.3.2.1.1', 'Compare System vs Physical', '对比系统与实物'),
              L6('4.3.3.2.1.2', 'Investigate Root Cause', '调查根本原因'),
            ]),
            L5('4.3.3.2.2', 'Adjust Inventory', '库存调整', [
              L6('4.3.3.2.2.1', 'Approve Adjustment', '审批调整'),
              L6('4.3.3.2.2.2', 'Update System Records', '更新系统记录'),
            ]),
          ]),
        ]),
        L3('4.3.4', 'Inventory Policy & Obsolete', '库存策略与呆滞管理', [
          L4('4.3.4.1', 'Inventory Policy Management', '库存策略管理', [
            L5('4.3.4.1.1', 'Define Safety Stock', '定义安全库存', [
              L6('4.3.4.1.1.1', 'Calculate Safety Stock Level', '计算安全库存水平'),
              L6('4.3.4.1.1.2', 'Set Reorder Point', '设定再订货点'),
            ]),
            L5('4.3.4.1.2', 'Monitor Inventory Health', '监控库存健康', [
              L6('4.3.4.1.2.1', 'Track Inventory Turnover', '跟踪库存周转率'),
              L6('4.3.4.1.2.2', 'Track Days of Supply', '跟踪供应天数'),
            ]),
          ]),
          L4('4.3.4.2', 'Obsolete Inventory Management', '呆滞库存管理', [
            L5('4.3.4.2.1', 'Identify Obsolete Items', '识别呆滞项', [
              L6('4.3.4.2.1.1', 'Run Aging Report', '运行库龄报告'),
              L6('4.3.4.2.1.2', 'Flag Obsolete Items', '标记呆滞项'),
            ]),
            L5('4.3.4.2.2', 'Dispose Obsolete Items', '处理呆滞项', [
              L6('4.3.4.2.2.1', 'Evaluate Disposal Options', '评估处置方案'),
              L6('4.3.4.2.2.2', 'Execute Disposal', '执行处置'),
            ]),
          ]),
        ]),
      ]),
      L2('4.4', 'Order Fulfillment', '订单履行与交付', [
        L3('4.4.1', 'Shipment Management', '发货管理', [
          L4('4.4.1.1', 'Shipment Planning', '发货计划', [
            L5('4.4.1.1.1', 'Review Order Requirements', '审查订单需求', [
              L6('4.4.1.1.1.1', 'Verify Order Details', '核实订单明细'),
              L6('4.4.1.1.1.2', 'Check Credit Status', '检查信用状态'),
            ]),
            L5('4.4.1.1.2', 'Create Shipment Plan', '创建发货计划', [
              L6('4.4.1.1.2.1', 'Select Shipping Method', '选择运输方式'),
              L6('4.4.1.1.2.2', 'Schedule Shipment Date', '安排发货日期'),
            ]),
          ]),
          L4('4.4.1.2', 'Shipment Execution', '发货执行', [
            L5('4.4.1.2.1', 'Prepare Shipment', '准备发货', [
              L6('4.4.1.2.1.1', 'Pick and Pack Goods', '拣货与包装'),
              L6('4.4.1.2.1.2', 'Generate Shipping Documents', '生成运输单据'),
            ]),
            L5('4.4.1.2.2', 'Dispatch Shipment', '发运', [
              L6('4.4.1.2.2.1', 'Hand over to Carrier', '交接给承运商'),
              L6('4.4.1.2.2.2', 'Update Shipment Status', '更新发货状态'),
            ]),
          ]),
        ]),
        L3('4.4.2', 'Delivery Confirmation', '交付确认与回单', [
          L4('4.4.2.1', 'Delivery Tracking', '交付跟踪', [
            L5('4.4.2.1.1', 'Track In-transit Status', '跟踪在途状态', [
              L6('4.4.2.1.1.1', 'Monitor Shipment Location', '监控货物位置'),
              L6('4.4.2.1.1.2', 'Notify Customer of ETA', '通知客户预计到达时间'),
            ]),
            L5('4.4.2.1.2', 'Handle Delivery Exceptions', '处理交付异常', [
              L6('4.4.2.1.2.1', 'Identify Delivery Issues', '识别交付问题'),
              L6('4.4.2.1.2.2', 'Resolve Delivery Issues', '解决交付问题'),
            ]),
          ]),
          L4('4.4.2.2', 'Proof of Delivery', '回单管理', [
            L5('4.4.2.2.1', 'Obtain Delivery Confirmation', '获取交付确认', [
              L6('4.4.2.2.1.1', 'Collect Customer Signature', '收集客户签收'),
              L6('4.4.2.2.1.2', 'Record Delivery Condition', '记录交付状况'),
            ]),
            L5('4.4.2.2.2', 'Process Return Receipt', '处理回单', [
              L6('4.4.2.2.2.1', 'Archive Delivery Documents', '归档交付单据'),
              L6('4.4.2.2.2.2', 'Trigger Invoicing', '触发开票'),
            ]),
          ]),
        ]),
      ]),
    ],
  },
  {
    id: 'HW-MFG', code: '5.0',
    name: 'Manufacturing & Delivery', label: '制造交付',
    definition: '制造核心环节：车间计划与执行（MES）、工艺管理、设备与工装管理、委外与齐套交付。',
    children: [
      L2('5.1', 'Production Planning & Execution', '生产计划与车间执行', [
        L3('5.1.1', 'Shop Floor Scheduling', '车间作业计划', [
          L4('5.1.1.1', 'Work Order Release', '工单下达', [
            L5('5.1.1.1.1', 'Convert MPS to Work Orders', '将MPS转换为工单', [
              L6('5.1.1.1.1.1', 'Split Production Orders', '拆分生产订单'),
              L6('5.1.1.1.1.2', 'Assign Work Centers', '分配工作中心'),
              L6('5.1.1.1.1.3', 'Set Start and End Dates', '设定起止日期'),
            ]),
            L5('5.1.1.1.2', 'Material Kitting Check', '物料齐套检查', [
              L6('5.1.1.1.2.1', 'Verify Material Availability', '验证物料可用性'),
              L6('5.1.1.1.2.2', 'Resolve Material Shortages', '解决物料短缺'),
            ]),
          ]),
        ]),
        L3('5.1.2', 'Production Execution & Reporting', '生产执行与报工', [
          L4('5.1.2.1', 'Production Execution', '生产执行', [
            L5('5.1.2.1.1', 'Start Production', '开始生产', [
              L6('5.1.2.1.1.1', 'Issue Materials to Line', '发料到线边'),
              L6('5.1.2.1.1.2', 'Setup Equipment and Tooling', '设置设备与工装'),
              L6('5.1.2.1.1.3', 'First Article Inspection', '首件检验'),
            ]),
            L5('5.1.2.1.2', 'In-process Operations', '在制作业', [
              L6('5.1.2.1.2.1', 'Execute Assembly Operations', '执行装配作业'),
              L6('5.1.2.1.2.2', 'Record Production Data', '记录生产数据'),
              L6('5.1.2.1.2.3', 'Perform Self-inspection', '执行自检'),
            ]),
          ]),
          L4('5.1.2.2', 'Production Reporting', '生产报工', [
            L5('5.1.2.2.1', 'Report Completion', '报工完成', [
              L6('5.1.2.2.1.1', 'Record Output Quantity', '记录产出数量'),
              L6('5.1.2.2.1.2', 'Record Scrap Quantity', '记录报废数量'),
              L6('5.1.2.2.1.3', 'Record Labor Hours', '记录工时'),
            ]),
            L5('5.1.2.2.2', 'Update Production Status', '更新生产状态', [
              L6('5.1.2.2.2.1', 'Update Work Order Status', '更新工单状态'),
              L6('5.1.2.2.2.2', 'Trigger Next Operation', '触发下道工序'),
            ]),
          ]),
        ]),
        L3('5.1.3', 'Production Exception Handling', '生产异常处理', [
          L4('5.1.3.1', 'Exception Detection', '异常发现', [
            L5('5.1.3.1.1', 'Identify Exception Type', '识别异常类型', [
              L6('5.1.3.1.1.1', 'Equipment Breakdown', '设备故障'),
              L6('5.1.3.1.1.2', 'Material Defect', '物料缺陷'),
              L6('5.1.3.1.1.3', 'Quality Issue', '质量问题'),
            ]),
          ]),
          L4('5.1.3.2', 'Exception Resolution', '异常处理', [
            L5('5.1.3.2.1', 'Immediate Response', '即时响应', [
              L6('5.1.3.2.1.1', 'Stop Production if Needed', '必要时停线'),
              L6('5.1.3.2.1.2', 'Notify Relevant Teams', '通知相关团队'),
            ]),
            L5('5.1.3.2.2', 'Root Cause and Recovery', '根因与恢复', [
              L6('5.1.3.2.2.1', 'Analyze Root Cause', '分析根本原因'),
              L6('5.1.3.2.2.2', 'Implement Recovery Action', '实施恢复措施'),
              L6('5.1.3.2.2.3', 'Resume Production', '恢复生产'),
            ]),
          ]),
        ]),
      ]),
      L2('5.2', 'Process Engineering', '工艺管理', [
        L3('5.2.1', 'Process Design & Validation', '工艺设计与验证', [
          L4('5.2.1.1', 'Process Design', '工艺设计', [
            L5('5.2.1.1.1', 'Define Process Flow', '定义工艺流程', [
              L6('5.2.1.1.1.1', 'Design Process Steps', '设计工艺步骤'),
              L6('5.2.1.1.1.2', 'Define Process Parameters', '定义工艺参数'),
              L6('5.2.1.1.1.3', 'Design Process Layout', '设计工艺布局'),
            ]),
            L5('5.2.1.1.2', 'Process Simulation', '工艺仿真', [
              L6('5.2.1.1.2.1', 'Run Process Simulation', '运行工艺仿真'),
              L6('5.2.1.1.2.2', 'Optimize Process Design', '优化工艺设计'),
            ]),
          ]),
          L4('5.2.1.2', 'Process Validation', '工艺验证', [
            L5('5.2.1.2.1', 'Trial Production', '试生产', [
              L6('5.2.1.2.1.1', 'Execute Trial Run', '执行试产'),
              L6('5.2.1.2.1.2', 'Collect Trial Data', '收集试产数据'),
            ]),
            L5('5.2.1.2.2', 'Process Qualification', '工艺鉴定', [
              L6('5.2.1.2.2.1', 'Verify Process Capability', '验证工艺能力'),
              L6('5.2.1.2.2.2', 'Approve Process for Production', '批准工艺量产'),
            ]),
          ]),
        ]),
        L3('5.2.2', 'SOP Management', '作业指导书(SOP)管理', [
          L4('5.2.2.1', 'SOP Creation', 'SOP编制', [
            L5('5.2.2.1.1', 'Draft SOP', '起草SOP', [
              L6('5.2.2.1.1.1', 'Document Operation Steps', '记录操作步骤'),
              L6('5.2.2.1.1.2', 'Define Quality Checkpoints', '定义质量控制点'),
              L6('5.2.2.1.1.3', 'Add Safety Precautions', '添加安全注意事项'),
            ]),
            L5('5.2.2.1.2', 'SOP Review & Approval', 'SOP评审与批准', [
              L6('5.2.2.1.2.1', 'Conduct SOP Review', '执行SOP评审'),
              L6('5.2.2.1.2.2', 'Approve SOP Release', '批准SOP发布'),
            ]),
          ]),
          L4('5.2.2.2', 'SOP Distribution & Training', 'SOP分发与培训', [
            L5('5.2.2.2.1', 'SOP Distribution', 'SOP分发', [
              L6('5.2.2.2.1.1', 'Publish SOP to Workstations', '发布SOP到工位'),
              L6('5.2.2.2.1.2', 'Update SOP Version', '更新SOP版本'),
            ]),
            L5('5.2.2.2.2', 'Operator Training', '操作员培训', [
              L6('5.2.2.2.2.1', 'Conduct SOP Training', '执行SOP培训'),
              L6('5.2.2.2.2.2', 'Verify Operator Competency', '验证操作员能力'),
            ]),
          ]),
        ]),
      ]),
      L2('5.3', 'Equipment & Tooling', '设备与工装管理', [
        L3('5.3.1', 'Equipment Ledger & Inspection', '设备台账与点检', [
          L4('5.3.1.1', 'Equipment Ledger Management', '设备台账管理', [
            L5('5.3.1.1.1', 'Create Equipment Record', '创建设备记录', [
              L6('5.3.1.1.1.1', 'Register Equipment Info', '登记设备信息'),
              L6('5.3.1.1.1.2', 'Assign Equipment ID', '分配设备编号'),
            ]),
            L5('5.3.1.1.2', 'Maintain Equipment Data', '维护设备数据', [
              L6('5.3.1.1.2.1', 'Update Equipment Status', '更新设备状态'),
              L6('5.3.1.1.2.2', 'Record Equipment History', '记录设备历史'),
            ]),
          ]),
          L4('5.3.1.2', 'Equipment Inspection', '设备点检', [
            L5('5.3.1.2.1', 'Daily Inspection', '日常点检', [
              L6('5.3.1.2.1.1', 'Execute Daily Check', '执行日常检查'),
              L6('5.3.1.2.1.2', 'Record Inspection Results', '记录点检结果'),
            ]),
            L5('5.3.1.2.2', 'Periodic Inspection', '定期点检', [
              L6('5.3.1.2.2.1', 'Execute Periodic Check', '执行定期检查'),
              L6('5.3.1.2.2.2', 'Generate Inspection Report', '生成点检报告'),
            ]),
          ]),
        ]),
        L3('5.3.2', 'Equipment Maintenance', '设备维护保养', [
          L4('5.3.2.1', 'Preventive Maintenance', '预防性维护', [
            L5('5.3.2.1.1', 'Maintenance Planning', '维护计划', [
              L6('5.3.2.1.1.1', 'Create Maintenance Schedule', '制定维护计划'),
              L6('5.3.2.1.1.2', 'Assign Maintenance Tasks', '分配维护任务'),
            ]),
            L5('5.3.2.1.2', 'Maintenance Execution', '维护执行', [
              L6('5.3.2.1.2.1', 'Perform Maintenance', '执行维护'),
              L6('5.3.2.1.2.2', 'Record Maintenance History', '记录维护历史'),
            ]),
          ]),
          L4('5.3.2.2', 'Corrective Maintenance', ' corrective维护', [
            L5('5.3.2.2.1', 'Fault Diagnosis', '故障诊断', [
              L6('5.3.2.2.1.1', 'Identify Fault Type', '识别故障类型'),
              L6('5.3.2.2.1.2', 'Analyze Root Cause', '分析根本原因'),
            ]),
            L5('5.3.2.2.2', 'Repair Execution', '维修执行', [
              L6('5.3.2.2.2.1', 'Replace Damaged Parts', '更换损坏部件'),
              L6('5.3.2.2.2.2', 'Test after Repair', '维修后测试'),
              L6('5.3.2.2.2.3', 'Return to Production', '恢复生产'),
            ]),
          ]),
        ]),
        L3('5.3.3', 'Tooling & Mould Management', '工装模具管理', [
          L4('5.3.3.1', 'Tooling Lifecycle Management', '工装生命周期管理', [
            L5('5.3.3.1.1', 'Tooling Procurement', '工装采购', [
              L6('5.3.3.1.1.1', 'Define Tooling Specs', '定义工装规格'),
              L6('5.3.3.1.1.2', 'Procure and Accept Tooling', '采购与验收工装'),
            ]),
            L5('5.3.3.1.2', 'Tooling Usage Tracking', '工装使用跟踪', [
              L6('5.3.3.1.2.1', 'Record Tooling Usage Count', '记录工装使用次数'),
              L6('5.3.3.1.2.2', 'Monitor Tooling Wear', '监控工装磨损'),
            ]),
          ]),
          L4('5.3.3.2', 'Tooling Maintenance & Replacement', '工装维护与更换', [
            L5('5.3.3.2.1', 'Tooling Maintenance', '工装维护', [
              L6('5.3.3.2.1.1', 'Clean and Lubricate', '清洁与润滑'),
              L6('5.3.3.2.1.2', 'Repair Damaged Tooling', '修复损坏工装'),
            ]),
            L5('5.3.3.2.2', 'Tooling Replacement', '工装更换', [
              L6('5.3.3.2.2.1', 'Assess Tooling Life', '评估工装寿命'),
              L6('5.3.3.2.2.2', 'Replace Worn Tooling', '更换磨损工装'),
            ]),
          ]),
        ]),
      ]),
      L2('5.4', 'Outsourcing & Delivery Sync', '委外与交付协同', [
        L3('5.4.1', 'Subcontract Management', '委外加工管理', [
          L4('5.4.1.1', 'Subcontract Planning', '委外计划', [
            L5('5.4.1.1.1', 'Identify Subcontract Needs', '识别委外需求', [
              L6('5.4.1.1.1.1', 'Analyze Capacity Gap', '分析产能缺口'),
              L6('5.4.1.1.1.2', 'Define Subcontract Scope', '定义委外范围'),
            ]),
            L5('5.4.1.1.2', 'Select Subcontractor', '选择委外商', [
              L6('5.4.1.1.2.1', 'Evaluate Subcontractor Capability', '评估委外商能力'),
              L6('5.4.1.1.2.2', 'Negotiate Subcontract Terms', '谈判委外条款'),
            ]),
          ]),
          L4('5.4.1.2', 'Subcontract Execution', '委外执行', [
            L5('5.4.1.2.1', 'Issue Subcontract Order', '下达委外订单', [
              L6('5.4.1.2.1.1', 'Create Subcontract PO', '创建委外采购订单'),
              L6('5.4.1.2.1.2', 'Send Materials to Subcontractor', '发料给委外商'),
            ]),
            L5('5.4.1.2.2', 'Subcontract Tracking & Receipt', '委外跟踪与收货', [
              L6('5.4.1.2.2.1', 'Monitor Subcontract Progress', '监控委外进度'),
              L6('5.4.1.2.2.2', 'Receive and Inspect Subcontract Goods', '收货与检验委外品'),
            ]),
          ]),
        ]),
        L3('5.4.2', 'Kitting & Shipment Coordination', '交付齐套与发运协调', [
          L4('5.4.2.1', 'Kitting Management', '齐套管理', [
            L5('5.4.2.1.1', 'Kitting Check', '齐套检查', [
              L6('5.4.2.1.1.1', 'Verify Component Availability', '验证组件可用性'),
              L6('5.4.2.1.1.2', 'Identify Missing Items', '识别缺件'),
            ]),
            L5('5.4.2.1.2', 'Kitting Resolution', '齐套解决', [
              L6('5.4.2.1.2.1', 'Expedite Missing Items', '催交缺件'),
              L6('5.4.2.1.2.2', 'Confirm Kitting Complete', '确认齐套完成'),
            ]),
          ]),
          L4('5.4.2.2', 'Shipment Coordination', '发运协调', [
            L5('5.4.2.2.1', 'Coordinate Shipping', '协调运输', [
              L6('5.4.2.2.1.1', 'Book Transportation', '预订运输'),
              L6('5.4.2.2.1.2', 'Arrange Loading', '安排装车'),
            ]),
            L5('5.4.2.2.2', 'Track Delivery', '跟踪交付', [
              L6('5.4.2.2.2.1', 'Monitor In-transit Status', '监控在途状态'),
              L6('5.4.2.2.2.2', 'Confirm Customer Receipt', '确认客户收货'),
            ]),
          ]),
        ]),
      ]),
    ],
  },
  {
    id: 'HW-QUAL', code: '6.0',
    name: 'Quality Management', label: '质量管理',
    definition: '质量体系、质量控制（IQC/IPQC/OQC）与质量改进（客诉处理、CAPA、精益改善）。',
    children: [
      L2('6.1', 'Quality System', '质量体系管理', [
        L3('6.1.1', 'QMS Planning & Documentation', '质量体系策划与文件管理', [
          L4('6.1.1.1', 'QMS Strategy & Policy', '质量方针与目标', [
            L5('6.1.1.1.1', 'Define Quality Policy', '制定质量方针', [
              L6('6.1.1.1.1.1', 'Review Business Context', '评估业务环境'),
              L6('6.1.1.1.1.2', 'Draft Quality Policy Statement', '起草质量方针声明'),
              L6('6.1.1.1.1.3', 'Top Management Approval', '高层管理批准'),
            ]),
            L5('6.1.1.1.2', 'Deploy Quality Objectives', '分解质量目标', [
              L6('6.1.1.1.2.1', 'Set Company-level Targets', '制定公司级目标'),
              L6('6.1.1.1.2.2', 'Cascade to Departments', '分解到部门'),
              L6('6.1.1.1.2.3', 'Cascade to Individuals', '分解到个人'),
            ]),
          ]),
          L4('6.1.1.2', 'Document Management', '质量文件管理', [
            L5('6.1.1.2.1', 'Document Creation', '文件编制', [
              L6('6.1.1.2.1.1', 'Draft Quality Manual', '起草质量手册'),
              L6('6.1.1.2.1.2', 'Draft Procedure Documents', '起草程序文件'),
              L6('6.1.1.2.1.3', 'Draft Work Instructions', '起草作业指导书'),
            ]),
            L5('6.1.1.2.2', 'Document Control', '文件控制', [
              L6('6.1.1.2.2.1', 'Review and Approve Documents', '评审批准文件'),
              L6('6.1.1.2.2.2', 'Control Distribution and Versions', '控制分发与版本'),
              L6('6.1.1.2.2.3', 'Archive Obsolete Documents', '归档作废文件'),
            ]),
          ]),
          L4('6.1.1.3', 'Record Management', '质量记录管理', [
            L5('6.1.1.3.1', 'Define Record Requirements', '定义记录要求', [
              L6('6.1.1.3.1.1', 'Identify Required Records', '识别所需记录'),
              L6('6.1.1.3.1.2', 'Define Retention Periods', '定义保存期限'),
            ]),
            L5('6.1.1.3.2', 'Maintain Records', '维护记录', [
              L6('6.1.1.3.2.1', 'Collect and File Records', '收集归档记录'),
              L6('6.1.1.3.2.2', 'Ensure Record Integrity', '确保记录完整性'),
            ]),
          ]),
        ]),
        L3('6.1.2', 'Internal Audit & Management Review', '内审与管理评审', [
          L4('6.1.2.1', 'Internal Audit', '内部审核', [
            L5('6.1.2.1.1', 'Audit Planning', '审核策划', [
              L6('6.1.2.1.1.1', 'Create Annual Audit Schedule', '制定年度审核计划'),
              L6('6.1.2.1.1.2', 'Define Audit Scope and Criteria', '确定审核范围与准则'),
              L6('6.1.2.1.1.3', 'Assign Certified Auditors', '分配持证审核员'),
            ]),
            L5('6.1.2.1.2', 'Audit Execution', '审核实施', [
              L6('6.1.2.1.2.1', 'Conduct Opening Meeting', '召开首次会议'),
              L6('6.1.2.1.2.2', 'Perform On-site Audit', '执行现场审核'),
              L6('6.1.2.1.2.3', 'Document Nonconformities', '记录不符合项'),
              L6('6.1.2.1.2.4', 'Conduct Closing Meeting', '召开末次会议'),
            ]),
            L5('6.1.2.1.3', 'Audit Follow-up', '审核后续', [
              L6('6.1.2.1.3.1', 'Issue Audit Report', '出具审核报告'),
              L6('6.1.2.1.3.2', 'Track Corrective Actions', '跟踪纠正措施'),
              L6('6.1.2.1.3.3', 'Verify Effectiveness', '验证有效性'),
            ]),
          ]),
          L4('6.1.2.2', 'Management Review', '管理评审', [
            L5('6.1.2.2.1', 'Review Preparation', '评审准备', [
              L6('6.1.2.2.1.1', 'Collect Review Inputs', '收集评审输入'),
              L6('6.1.2.2.1.2', 'Prepare Review Agenda', '准备评审议程'),
            ]),
            L5('6.1.2.2.2', 'Review Execution', '评审实施', [
              L6('6.1.2.2.2.1', 'Conduct Management Review Meeting', '召开管理评审会议'),
              L6('6.1.2.2.2.2', 'Analyze QMS Performance Data', '分析体系绩效数据'),
              L6('6.1.2.2.2.3', 'Make Improvement Decisions', '做出改进决策'),
            ]),
            L5('6.1.2.2.3', 'Review Output Follow-up', '评审输出跟进', [
              L6('6.1.2.2.3.1', 'Publish Review Minutes', '发布评审纪要'),
              L6('6.1.2.2.3.2', 'Assign Improvement Actions', '分配改进措施'),
            ]),
          ]),
        ]),
        L3('6.1.3', 'Certification & External Audit', '认证与外部审核应对', [
          L4('6.1.3.1', 'Certification Management', '认证管理', [
            L5('6.1.3.1.1', 'Certification Application', '认证申请', [
              L6('6.1.3.1.1.1', 'Select Accredited Certification Body', '选择认可的认证机构'),
              L6('6.1.3.1.1.2', 'Prepare Application Package', '准备申请材料'),
              L6('6.1.3.1.1.3', 'Submit Formal Application', '提交正式申请'),
            ]),
            L5('6.1.3.1.2', 'Certification Audit', '认证审核', [
              L6('6.1.3.1.2.1', 'Stage 1 Document Review', '阶段一文件审查'),
              L6('6.1.3.1.2.2', 'Stage 2 On-site Audit', '阶段二现场审核'),
              L6('6.1.3.1.2.3', 'Handle Nonconformities', '处理不符合项'),
            ]),
            L5('6.1.3.1.3', 'Certificate Maintenance', '证书维护', [
              L6('6.1.3.1.3.1', 'Complete Surveillance Audits', '完成监督审核'),
              L6('6.1.3.1.3.2', 'Complete Re-certification Audit', '完成再认证审核'),
            ]),
          ]),
          L4('6.1.3.2', 'Customer/Regulator Audit', '客户/监管审核应对', [
            L5('6.1.3.2.1', 'Audit Preparation', '审核准备', [
              L6('6.1.3.2.1.1', 'Understand Audit Requirements', '了解审核要求'),
              L6('6.1.3.2.1.2', 'Pre-audit Self-check', '审核前自查'),
              L6('6.1.3.2.1.3', 'Prepare Supporting Evidence', '准备支持性证据'),
            ]),
            L5('6.1.3.2.2', 'Audit Execution', '审核执行', [
              L6('6.1.3.2.2.1', 'Greet and Brief Auditors', '迎接并介绍审核情况'),
              L6('6.1.3.2.2.2', 'Accompany During Audit', '陪同审核'),
              L6('6.1.3.2.2.3', 'Address Auditor Findings', '回应审核发现'),
            ]),
            L5('6.1.3.2.3', 'Audit Close-out', '审核关闭', [
              L6('6.1.3.2.3.1', 'Draft Corrective Actions', '起草纠正措施'),
              L6('6.1.3.2.3.2', 'Implement and Verify Actions', '实施并验证措施'),
              L6('6.1.3.2.3.3', 'Submit Evidence to Auditor', '提交证据给审核方'),
            ]),
          ]),
        ]),
      ]),
      L2('6.2', 'Quality Control', '质量控制', [
        L3('6.2.1', 'Incoming Inspection (IQC)', '来料检验(IQC)', [
          L4('6.2.1.1', 'Inspection Preparation', '检验准备', [
            L5('6.2.1.1.1', 'Receive Inspection Request', '接收检验请求', [
              L6('6.2.1.1.1.1', 'Check Delivery Notice', '核对到货通知'),
              L6('6.2.1.1.1.2', 'Retrieve Inspection Standards', '获取检验标准'),
            ]),
            L5('6.2.1.1.2', 'Sampling Plan', '抽样计划', [
              L6('6.2.1.1.2.1', 'Determine Sample Size', '确定样本量'),
              L6('6.2.1.1.2.2', 'Select Sampling Method', '选择抽样方法'),
            ]),
          ]),
          L4('6.2.1.2', 'Inspection Execution', '检验执行', [
            L5('6.2.1.2.1', 'Perform Inspection', '执行检验', [
              L6('6.2.1.2.1.1', 'Measure Dimensions', '测量尺寸'),
              L6('6.2.1.2.1.2', 'Test Functional Performance', '测试功能性能'),
              L6('6.2.1.2.1.3', 'Check Appearance', '检查外观'),
            ]),
            L5('6.2.1.2.2', 'Record Results', '记录结果', [
              L6('6.2.1.2.2.1', 'Enter Inspection Data', '录入检验数据'),
              L6('6.2.1.2.2.2', 'Generate Inspection Report', '生成检验报告'),
            ]),
          ]),
          L4('6.2.1.3', 'Disposition Decision', '处置决定', [
            L5('6.2.1.3.1', 'Make Accept/Reject Decision', '做出合格/不合格判定', [
              L6('6.2.1.3.1.1', 'Compare Against Specifications', '对照规格比较'),
              L6('6.2.1.3.1.2', 'Apply Acceptance Criteria', '应用接收标准'),
            ]),
            L5('6.2.1.3.2', 'Handle Nonconforming Materials', '处理不合格品', [
              L6('6.2.1.3.2.1', 'Segregate Nonconforming Items', '隔离不合格品'),
              L6('6.2.1.3.2.2', 'Initiate Return or Rework', '发起退货或返工'),
            ]),
          ]),
        ]),
        L3('6.2.2', 'In-Process Inspection (IPQC)', '过程检验(IPQC)', [
          L4('6.2.2.1', 'Patrol Inspection', '巡检', [
            L5('6.2.2.1.1', 'Execute Patrol Plan', '执行巡检计划', [
              L6('6.2.2.1.1.1', 'Check Process Parameters', '检查工艺参数'),
              L6('6.2.2.1.1.2', 'Verify Operator Compliance', '验证操作员合规性'),
              L6('6.2.2.1.1.3', 'Sample In-process Products', '抽取在制品样本'),
            ]),
            L5('6.2.2.1.2', 'Record and Report', '记录与报告', [
              L6('6.2.2.1.2.1', 'Log Patrol Findings', '记录巡检发现'),
              L6('6.2.2.1.2.2', 'Report Deviations', '报告偏差'),
            ]),
          ]),
          L4('6.2.2.2', 'First Article & Final Inspection', '首件与末件检验', [
            L5('6.2.2.2.1', 'First Article Inspection', '首件检验', [
              L6('6.2.2.2.1.1', 'Verify Setup Conditions', '验证设置条件'),
              L6('6.2.2.2.1.2', 'Inspect First Output', '检验首件产出'),
              L6('6.2.2.2.1.3', 'Approve for Mass Production', '批准批量生产'),
            ]),
            L5('6.2.2.2.2', 'Final Piece Inspection', '末件检验', [
              L6('6.2.2.2.2.1', 'Inspect Last Output', '检验末件产出'),
              L6('6.2.2.2.2.2', 'Confirm Batch Consistency', '确认批次一致性'),
            ]),
          ]),
        ]),
        L3('6.2.3', 'Outgoing Inspection (OQC)', '成品检验(OQC)', [
          L4('6.2.3.1', 'Final Product Inspection', '成品检验', [
            L5('6.2.3.1.1', 'Pre-shipment Inspection', '出货前检验', [
              L6('6.2.3.1.1.1', 'Verify Product Specifications', '验证产品规格'),
              L6('6.2.3.1.1.2', 'Check Packaging and Labeling', '检查包装与标识'),
              L6('6.2.3.1.1.3', 'Perform Functional Test', '执行功能测试'),
            ]),
            L5('6.2.3.1.2', 'Inspection Documentation', '检验文档', [
              L6('6.2.3.1.2.1', 'Generate Certificate of Conformity', '生成合格证'),
              L6('6.2.3.1.2.2', 'Prepare Inspection Report', '准备检验报告'),
            ]),
          ]),
          L4('6.2.3.2', 'Release Authorization', '放行授权', [
            L5('6.2.3.2.1', 'Quality Release', '质量放行', [
              L6('6.2.3.2.1.1', 'Review Inspection Results', '审查检验结果'),
              L6('6.2.3.2.1.2', 'Sign Release Authorization', '签署放行授权'),
            ]),
          ]),
        ]),
        L3('6.2.4', 'Nonconforming Product Control', '不合格品管理', [
          L4('6.2.4.1', 'Nonconformance Identification', '不合格识别', [
            L5('6.2.4.1.1', 'Detect and Report', '发现与报告', [
              L6('6.2.4.1.1.1', 'Identify Nonconformance', '识别不合格'),
              L6('6.2.4.1.1.2', 'Tag and Segregate', '标识与隔离'),
              L6('6.2.4.1.1.3', 'Log Nonconformance Record', '记录不合格记录'),
            ]),
          ]),
          L4('6.2.4.2', 'Nonconformance Disposition', '不合格处置', [
            L5('6.2.4.2.1', 'Review and Decide', '评审与决定', [
              L6('6.2.4.2.1.1', 'Convene MRB (Material Review Board)', '召开MRB评审'),
              L6('6.2.4.2.1.2', 'Determine Disposition Method', '确定处置方式'),
            ]),
            L5('6.2.4.2.2', 'Execute Disposition', '执行处置', [
              L6('6.2.4.2.2.1', 'Rework and Re-inspect', '返工与复检'),
              L6('6.2.4.2.2.2', 'Scrap and Dispose', '报废与处理'),
              L6('6.2.4.2.2.3', 'Return to Supplier', '退回供应商'),
            ]),
          ]),
        ]),
      ]),
      L2('6.3', 'Quality Improvement', '质量改进', [
        L3('6.3.1', 'Complaint & Quality Incident', '客诉与质量事故处理', [
          L4('6.3.1.1', 'Customer Complaint Handling', '客户投诉处理', [
            L5('6.3.1.1.1', 'Complaint Intake & Registration', '投诉受理登记', [
              L6('6.3.1.1.1.1', 'Receive Complaint from Customer', '接收客户投诉'),
              L6('6.3.1.1.1.2', 'Log Complaint Details', '记录投诉详情'),
              L6('6.3.1.1.1.3', 'Assign Complaint Owner', '分配投诉负责人'),
            ]),
            L5('6.3.1.1.2', 'Complaint Investigation', '投诉调查', [
              L6('6.3.1.1.2.1', 'Collect Complaint Evidence', '收集投诉证据'),
              L6('6.3.1.1.2.2', 'Analyze Complaint Data', '分析投诉数据'),
              L6('6.3.1.1.2.3', 'Conduct Root Cause Analysis', '进行根因分析'),
            ]),
            L5('6.3.1.1.3', 'Complaint Resolution', '投诉解决', [
              L6('6.3.1.1.3.1', 'Define Corrective Actions', '定义纠正措施'),
              L6('6.3.1.1.3.2', 'Execute Corrective Actions', '执行纠正措施'),
              L6('6.3.1.1.3.3', 'Confirm with Customer', '与客户确认'),
            ]),
            L5('6.3.1.1.4', 'Complaint Closure & Follow-up', '投诉关闭与跟进', [
              L6('6.3.1.1.4.1', 'Close Complaint Record', '关闭投诉记录'),
              L6('6.3.1.1.4.2', 'Track Effectiveness', '跟踪有效性'),
            ]),
          ]),
          L4('6.3.1.2', 'Quality Incident Management', '质量事故管理', [
            L5('6.3.1.2.1', 'Incident Reporting', '事故报告', [
              L6('6.3.1.2.1.1', 'Discover Quality Incident', '发现质量事故'),
              L6('6.3.1.2.1.2', 'Register and Classify Incident', '登记并分级事故'),
              L6('6.3.1.2.1.3', 'Escalate Based on Severity', '根据严重级别上报'),
            ]),
            L5('6.3.1.2.2', 'Incident Containment', '事故遏制', [
              L6('6.3.1.2.2.1', 'Stop Affected Production', '停止受影响生产'),
              L6('6.3.1.2.2.2', 'Segregate Affected Stock', '隔离受影响库存'),
              L6('6.3.1.2.2.3', 'Prevent Further Occurrence', '防止进一步发生'),
            ]),
            L5('6.3.1.2.3', 'Incident Investigation & Resolution', '事故调查与解决', [
              L6('6.3.1.2.3.1', 'Form Investigation Team', '成立调查小组'),
              L6('6.3.1.2.3.2', 'Investigate Root Cause', '调查根本原因'),
              L6('6.3.1.2.3.3', 'Implement Corrective Actions', '实施纠正措施'),
              L6('6.3.1.2.3.4', 'Verify Effectiveness', '验证措施有效性'),
            ]),
          ]),
        ]),
        L3('6.3.2', 'Corrective & Preventive Action (CAPA)', '纠正与预防措施(CAPA)', [
          L4('6.3.2.1', 'CAPA Initiation', 'CAPA发起', [
            L5('6.3.2.1.1', 'Identify CAPA Need', '识别CAPA需求', [
              L6('6.3.2.1.1.1', 'Analyze Nonconformance Trends', '分析不符合趋势'),
              L6('6.3.2.1.1.2', 'Review Audit Findings', '评审审核发现'),
              L6('6.3.2.1.1.3', 'Review Process Performance Data', '评审过程绩效数据'),
            ]),
            L5('6.3.2.1.2', 'Submit CAPA Request', '提交CAPA申请', [
              L6('6.3.2.1.2.1', 'Describe the Problem', '描述问题'),
              L6('6.3.2.1.2.2', 'Define Scope and Impact', '定义范围与影响'),
              L6('6.3.2.1.2.3', 'Assign CAPA Owner', '分配CAPA负责人'),
            ]),
          ]),
          L4('6.3.2.2', 'CAPA Analysis & Planning', 'CAPA分析与策划', [
            L5('6.3.2.2.1', 'Root Cause Analysis (RCA)', '根因分析(RCA)', [
              L6('6.3.2.2.1.1', 'Use 5-Why Analysis', '使用5-Why分析'),
              L6('6.3.2.2.1.2', 'Use Fishbone Diagram', '使用鱼骨图'),
              L6('6.3.2.2.1.3', 'Use FMEA', '使用FMEA分析'),
            ]),
            L5('6.3.2.2.2', 'Action Planning', '措施策划', [
              L6('6.3.2.2.2.1', 'Define Corrective Actions', '定义纠正措施'),
              L6('6.3.2.2.2.2', 'Define Preventive Actions', '定义预防措施'),
              L6('6.3.2.2.2.3', 'Set Timeline and Resources', '设定时间与资源'),
            ]),
          ]),
          L4('6.3.2.3', 'CAPA Implementation & Verification', 'CAPA实施与验证', [
            L5('6.3.2.3.1', 'Action Execution', '措施执行', [
              L6('6.3.2.3.1.1', 'Execute Corrective Actions', '执行纠正措施'),
              L6('6.3.2.3.1.2', 'Execute Preventive Actions', '执行预防措施'),
              L6('6.3.2.3.1.3', 'Document All Changes', '记录所有变更'),
            ]),
            L5('6.3.2.3.2', 'Effectiveness Verification', '有效性验证', [
              L6('6.3.2.3.2.1', 'Monitor Performance Metrics', '监控绩效指标'),
              L6('6.3.2.3.2.2', 'Verify Problem is Resolved', '验证问题已解决'),
              L6('6.3.2.3.2.3', 'Prevent Recurrence', '防止再发生'),
            ]),
            L5('6.3.2.3.3', 'CAPA Closure', 'CAPA关闭', [
              L6('6.3.2.3.3.1', 'Review Complete CAPA Record', '评审完整CAPA记录'),
              L6('6.3.2.3.3.2', 'Close CAPA File', '关闭CAPA档案'),
            ]),
          ]),
        ]),
        L3('6.3.3', 'Lean & Continuous Improvement', '精益与持续改善', [
          L4('6.3.3.1', 'Lean Tool Application', '精益工具应用', [
            L5('6.3.3.1.1', '5S Implementation', '5S实施', [
              L6('6.3.3.1.1.1', 'Sort (Seiri)', '整理'),
              L6('6.3.3.1.1.2', 'Set in Order (Seiton)', '整顿'),
              L6('6.3.3.1.1.3', 'Shine (Seiso)', '清扫'),
              L6('6.3.3.1.1.4', 'Standardize (Seiketsu)', '标准化'),
              L6('6.3.3.1.1.5', 'Sustain (Shitsuke)', '素养'),
            ]),
            L5('6.3.3.1.2', 'Value Stream Mapping (VSM)', '价值流图(VSM)', [
              L6('6.3.3.1.2.1', 'Map Current State', '绘制当前状态图'),
              L6('6.3.3.1.2.2', 'Identify Wastes', '识别七大浪费'),
              L6('6.3.3.1.2.3', 'Design Future State', '设计未来状态图'),
            ]),
            L5('6.3.3.1.3', 'Kaizen Event', '改善活动', [
              L6('6.3.3.1.3.1', 'Select Kaizen Topic', '选择改善主题'),
              L6('6.3.3.1.3.2', 'Conduct Kaizen Workshop', '举办改善工作坊'),
              L6('6.3.3.1.3.3', 'Implement Improvements', '实施改善方案'),
            ]),
          ]),
          L4('6.3.3.2', 'Six Sigma & Statistical Tools', '六西格玛与统计工具', [
            L5('6.3.3.2.1', 'DMAIC Methodology', 'DMAIC方法论', [
              L6('6.3.3.2.1.1', 'Define Project (Define)', '定义项目'),
              L6('6.3.3.2.1.2', 'Measure Current Performance', '测量当前绩效'),
              L6('6.3.3.2.1.3', 'Analyze Root Causes', '分析根因'),
              L6('6.3.3.2.1.4', 'Implement Improvements', '实施改善'),
              L6('6.3.3.2.1.5', 'Control and Sustain', '控制与保持'),
            ]),
            L5('6.3.3.2.2', 'Statistical Process Control (SPC)', '统计过程控制(SPC)', [
              L6('6.3.3.2.2.1', 'Select Control Charts', '选择控制图'),
              L6('6.3.3.2.2.2', 'Collect and Plot Data', '收集并绘制数据'),
              L6('6.3.3.2.2.3', 'Interpret Chart Patterns', '解释图型模式'),
              L6('6.3.3.2.2.4', 'Take Action on Out-of-control', '对失控采取行动'),
            ]),
          ]),
          L4('6.3.3.3', 'Improvement Culture & Recognition', '改善文化与奖励', [
            L5('6.3.3.3.1', 'Suggestion Scheme Management', '合理化建议管理', [
              L6('6.3.3.3.1.1', 'Promote Suggestion Scheme', '推广合理化建议'),
              L6('6.3.3.3.1.2', 'Evaluate and Approve Suggestions', '评审批准建议'),
              L6('6.3.3.3.1.3', 'Implement Good Suggestions', '实施好的建议'),
            ]),
            L5('6.3.3.3.2', 'Improvement Recognition', '改善表彰', [
              L6('6.3.3.3.2.1', 'Evaluate Improvement Results', '评估改善成果'),
              L6('6.3.3.3.2.2', 'Recognize Contributors', '表彰贡献者'),
              L6('6.3.3.3.2.3', 'Share Best Practices', '分享最佳实践'),
            ]),
          ]),
        ]),
      ]),
    ],
  },
  {
    id: 'HW-FIN', code: '7.0',
    name: 'Finance', label: '财经管理',
    definition: '核算与报告、资金收支、预算监控与经营分析、税务合规，支撑业务与财经一体化。',
    children: [
      L2('7.1', 'Accounting & Reporting', '核算与报告', [
        L3('7.1.1', 'General Ledger', '总账核算', [
          L4('7.1.1.1', 'Daily Bookkeeping', '日常记账', [
            L5('7.1.1.1.1', 'Transaction Entry', '交易录入', [
              L6('7.1.1.1.1.1', 'Review Source Documents', '审核原始凭证'),
              L6('7.1.1.1.1.2', 'Post Journal Entries', '录入记账凭证'),
              L6('7.1.1.1.1.3', 'Attach Supporting Documents', '粘贴原始凭证'),
            ]),
            L5('7.1.1.1.2', 'Journal Review & Approval', '凭证审核', [
              L6('7.1.1.1.2.1', 'Review Journal Accuracy', '审核凭证准确性'),
              L6('7.1.1.1.2.2', 'Approve for Posting', '批准过账'),
            ]),
          ]),
          L4('7.1.1.2', 'Ledger Closing', '账簿结转', [
            L5('7.1.1.2.1', 'Monthly Closing', '月结', [
              L6('7.1.1.2.1.1', 'Run Trial Balance', '编制试算平衡表'),
              L6('7.1.1.2.1.2', 'Make Adjusting Entries', '制作调整分录'),
              L6('7.1.1.2.1.3', 'Close Revenue and Expense', '结转损益类科目'),
            ]),
            L5('7.1.1.2.2', 'Annual Closing', '年结', [
              L6('7.1.1.2.2.1', 'Close All Temporary Accounts', '关闭所有临时科目'),
              L6('7.1.1.2.2.2', 'Transfer to Retained Earnings', '结转未分配利润'),
              L6('7.1.1.2.2.3', 'Open New Fiscal Year', '开启新会计年度'),
            ]),
          ]),
          L4('7.1.1.3', 'GL Reconciliation', '总账对账', [
            L5('7.1.1.3.1', 'Bank Reconciliation', '银行对账', [
              L6('7.1.1.3.1.1', 'Obtain Bank Statement', '获取银行对账单'),
              L6('7.1.1.3.1.2', 'Reconcile Bank and Book', '核对银行账与企业账'),
              L6('7.1.1.3.1.3', 'Identify and Resolve Differences', '识别并处理差异'),
            ]),
            L5('7.1.1.3.2', 'Subsidiary Ledger Reconciliation', '明细账对账', [
              L6('7.1.1.3.2.1', 'Reconcile AP Subsidiary', '核对应付明细账'),
              L6('7.1.1.3.2.2', 'Reconcile AR Subsidiary', '核对应收明细账'),
            ]),
          ]),
        ]),
        L3('7.1.2', 'AR & AP Management', '应收应付管理', [
          L4('7.1.2.1', 'Accounts Receivable', '应收账款管理', [
            L5('7.1.2.1.1', 'AR Invoice Processing', '应收开票', [
              L6('7.1.2.1.1.1', 'Verify Delivery Completion', '核实交付完成'),
              L6('7.1.2.1.1.2', 'Generate Sales Invoice', '开具销售发票'),
              L6('7.1.2.1.1.3', 'Post to AR Ledger', '过入应收明细账'),
            ]),
            L5('7.1.2.1.2', 'AR Aging & Follow-up', '应收账龄与催收', [
              L6('7.1.2.1.2.1', 'Generate AR Aging Report', '编制应收账龄表'),
              L6('7.1.2.1.2.2', 'Send Collection Reminders', '发送催收提醒'),
              L6('7.1.2.1.2.3', 'Escalate Overdue Accounts', '逾期升级处理'),
            ]),
            L5('7.1.2.1.3', 'AR Write-off', '坏账核销', [
              L6('7.1.2.1.3.1', 'Identify Bad Debt', '识别坏账'),
              L6('7.1.2.1.3.2', 'Obtain Write-off Approval', '获取核销批准'),
              L6('7.1.2.1.3.3', 'Record Write-off', '记录核销'),
            ]),
          ]),
          L4('7.1.2.2', 'Accounts Payable', '应付账款管理', [
            L5('7.1.2.2.1', 'AP Invoice Verification', '应付发票校验', [
              L6('7.1.2.2.1.1', 'Match PO, Receipt and Invoice (3-way)', '三单匹配(订单/收货/发票)'),
              L6('7.1.2.2.1.2', 'Verify Invoice Accuracy', '校验发票准确性'),
              L6('7.1.2.2.1.3', 'Code and Approve Invoice', '发票分摊与审批'),
            ]),
            L5('7.1.2.2.2', 'AP Payment Scheduling', '付款计划', [
              L6('7.1.2.2.2.1', 'Select Invoices for Payment', '选择待付款发票'),
              L6('7.1.2.2.2.2', 'Optimize Payment Terms', '优化付款条件'),
              L6('7.1.2.2.2.3', 'Create Payment Proposal', '生成付款计划'),
            ]),
          ]),
        ]),
        L3('7.1.3', 'Cost Accounting', '成本核算', [
          L4('7.1.3.1', 'Cost Estimation', '成本估算', [
            L5('7.1.3.1.1', 'Standard Cost Calculation', '标准成本计算', [
              L6('7.1.3.1.1.1', 'Calculate Material Cost', '计算材料成本'),
              L6('7.1.3.1.1.2', 'Calculate Labor Cost', '计算人工成本'),
              L6('7.1.3.1.1.3', 'Calculate Overhead', '计算制造费用'),
            ]),
            L5('7.1.3.1.2', 'Cost Simulation', '成本模拟', [
              L6('7.1.3.1.2.1', 'Run Cost Roll-up', '运行成本卷积'),
              L6('7.1.3.1.2.2', 'Analyze Cost Components', '分析成本构成'),
            ]),
          ]),
          L4('7.1.3.2', 'Actual Cost Calculation', '实际成本计算', [
            L5('7.1.3.2.1', 'Material Cost Variance', '材料成本差异', [
              L6('7.1.3.2.1.1', 'Calculate Purchase Price Variance', '计算价格差异'),
              L6('7.1.3.2.1.2', 'Calculate Usage Variance', '计算用量差异'),
            ]),
            L5('7.1.3.2.2', 'Production Cost Variance', '生产成本差异', [
              L6('7.1.3.2.2.1', 'Calculate Labor Efficiency Variance', '计算人工效率差异'),
              L6('7.1.3.2.2.2', 'Calculate Overhead Variance', '计算制造费用差异'),
            ]),
          ]),
          L4('7.1.3.3', 'Cost Analysis & Reporting', '成本分析与报告', [
            L5('7.1.3.3.1', 'Cost Center Analysis', '成本中心分析', [
              L6('7.1.3.3.1.1', 'Collect Cost Center Data', '收集成本中心数据'),
              L6('7.1.3.3.1.2', 'Analyze Cost Deviations', '分析成本偏差'),
            ]),
            L5('7.1.3.3.2', 'Product Cost Analysis', '产品成本分析', [
              L6('7.1.3.3.2.1', 'Analyze Product Profitability', '分析产品盈利性'),
              L6('7.1.3.3.2.2', 'Identify Cost Reduction Opportunities', '识别降本机会'),
            ]),
          ]),
        ]),
        L3('7.1.4', 'Financial Reporting', '财务报告与披露', [
          L4('7.1.4.1', 'Financial Statement Preparation', '财务报表编制', [
            L5('7.1.4.1.1', 'Primary Statements', '主要报表', [
              L6('7.1.4.1.1.1', 'Prepare Balance Sheet', '编制资产负债表'),
              L6('7.1.4.1.1.2', 'Prepare Income Statement', '编制利润表'),
              L6('7.1.4.1.1.3', 'Prepare Cash Flow Statement', '编制现金流量表'),
            ]),
            L5('7.1.4.1.2', 'Consolidation', '合并报表', [
              L6('7.1.4.1.2.1', 'Collect Subsidiary Data', '收集子公司数据'),
              L6('7.1.4.1.2.2', 'Eliminate Inter-company Transactions', '抵销内部交易'),
              L6('7.1.4.1.2.3', 'Prepare Consolidated Statements', '编制合并报表'),
            ]),
          ]),
          L4('7.1.4.2', 'External Disclosure', '对外披露', [
            L5('7.1.4.2.1', 'Disclosure Preparation', '披露准备', [
              L6('7.1.4.2.1.1', 'Compile Annual Report', '编制年报'),
              L6('7.1.4.2.1.2', 'Prepare Interim Reports', '编制中期报告'),
              L6('7.1.4.2.1.3', 'Prepare Notes to Financial Statements', '编制附注'),
            ]),
            L5('7.1.4.2.2', 'Audit & Filing', '审计与报送', [
              L6('7.1.4.2.2.1', 'Coordinate External Audit', '协调外部审计'),
              L6('7.1.4.2.2.2', 'Obtain Audit Opinion', '获取审计意见'),
              L6('7.1.4.2.2.3', 'File with Regulatory Authorities', '向监管机构报送'),
            ]),
          ]),
        ]),
      ]),
      L2('7.2', 'Treasury Management', '资金管理', [
        L3('7.2.1', 'Collection & Receipt', '回款与收款管理', [
          L4('7.2.1.1', 'Receipt Processing', '收款处理', [
            L5('7.2.1.1.1', 'Incoming Payment Identification', '来款识别', [
              L6('7.2.1.1.1.1', 'Monitor Bank Incoming Payments', '监控银行来款'),
              L6('7.2.1.1.1.2', 'Match Payment to Customer', '匹配付款客户'),
              L6('7.2.1.1.1.3', 'Identify Partial Payments', '识别部分付款'),
            ]),
            L5('7.2.1.1.2', 'Receipt Posting & Clearance', '收款过账与清账', [
              L6('7.2.1.1.2.1', 'Post Customer Receipt', '过账客户收款'),
              L6('7.2.1.1.2.2', 'Clear Open Invoices', '清账未清发票'),
              L6('7.2.1.1.2.3', 'Handle Over/Under Payments', '处理多付/少付'),
            ]),
          ]),
          L4('7.2.1.2', 'Customer Credit Management', '客户信用管理', [
            L5('7.2.1.2.1', 'Credit Limit Setting', '信用额度设定', [
              L6('7.2.1.2.1.1', 'Evaluate Customer Creditworthiness', '评估客户信用'),
              L6('7.2.1.2.1.2', 'Set Credit Limits', '设定信用额度'),
              L6('7.2.1.2.1.3', 'Monitor Credit Utilization', '监控额度使用'),
            ]),
            L5('7.2.1.2.2', 'Credit Block & Release', '信用冻结与释放', [
              L6('7.2.1.2.2.1', 'Block Sales Order on Credit Exceeded', '超额度冻结订单'),
              L6('7.2.1.2.2.2', 'Review and Release Credit Block', '评审并释放冻结'),
            ]),
          ]),
        ]),
        L3('7.2.2', 'Payment Management', '付款管理', [
          L4('7.2.2.1', 'Payment Execution', '付款执行', [
            L5('7.2.2.1.1', 'Payment Batch Processing', '付款批处理', [
              L6('7.2.2.1.1.1', 'Generate Payment Run', '生成付款批次'),
              L6('7.2.2.1.1.2', 'Review Payment List', '审核付款清单'),
              L6('7.2.2.1.1.3', 'Approve Payment Batch', '批准付款批次'),
            ]),
            L5('7.2.2.1.2', 'Bank Transfer Execution', '银行转账执行', [
              L6('7.2.2.1.2.1', 'Upload Payment File to Bank', '上传付款文件到银行'),
              L6('7.2.2.1.2.2', 'Confirm Bank Processing', '确认银行处理'),
              L6('7.2.2.1.2.3', 'Record Payment Completion', '记录付款完成'),
            ]),
          ]),
          L4('7.2.2.2', 'Payment Security & Authorization', '付款安全与授权', [
            L5('7.2.2.2.1', 'Dual Control', '双控管理', [
              L6('7.2.2.2.1.1', 'Separate Payment Creation and Approval', '分离付款创建与审批'),
              L6('7.2.2.2.1.2', 'Set Authorization Limits', '设定授权限额'),
            ]),
            L5('7.2.2.2.2', 'Fraud Prevention', '欺诈防范', [
              L6('7.2.2.2.2.1', 'Verify Bank Account Changes', '核实银行账户变更'),
              L6('7.2.2.2.2.2', 'Flag Unusual Payment Patterns', '标记异常付款模式'),
            ]),
          ]),
        ]),
        L3('7.2.3', 'Cash Planning & Financing', '资金计划与融资', [
          L4('7.2.3.1', 'Cash Flow Forecasting', '现金流预测', [
            L5('7.2.3.1.1', 'Short-term Forecast', '短期资金预测', [
              L6('7.2.3.1.1.1', 'Collect Cash Inflow Projections', '收集现金流入预测'),
              L6('7.2.3.1.1.2', 'Collect Cash Outflow Projections', '收集现金流出预测'),
              L6('7.2.3.1.1.3', 'Consolidate Weekly Cash Forecast', '汇总周度现金预测'),
            ]),
            L5('7.2.3.1.2', 'Medium & Long-term Forecast', '中长期资金预测', [
              L6('7.2.3.1.2.1', 'Prepare Monthly Cash Budget', '编制月度资金预算'),
              L6('7.2.3.1.2.2', 'Prepare Annual Cash Plan', '编制年度资金计划'),
            ]),
          ]),
          L4('7.2.3.2', 'Financing & Investment', '融资与投资', [
            L5('7.2.3.2.1', 'Short-term Financing', '短期融资', [
              L6('7.2.3.2.1.1', 'Evaluate Financing Needs', '评估融资需求'),
              L6('7.2.3.2.1.2', 'Negotiate Credit Facilities', '谈判授信额度'),
              L6('7.2.3.2.1.3', 'Execute Borrowing', '执行借款'),
            ]),
            L5('7.2.3.2.2', 'Temporary Investment', '临时投资', [
              L6('7.2.3.2.2.1', 'Identify Surplus Cash', '识别闲置资金'),
              L6('7.2.3.2.2.2', 'Evaluate Investment Options', '评估投资选项'),
              L6('7.2.3.2.2.3', 'Execute Investment', '执行投资'),
            ]),
          ]),
          L4('7.2.3.3', 'Bank Relationship Management', '银行关系管理', [
            L5('7.2.3.3.1', 'Bank Account Management', '银行账户管理', [
              L6('7.2.3.3.1.1', 'Open/Close Bank Accounts', '开立/关闭银行账户'),
              L6('7.2.3.3.1.2', 'Maintain Account Signatories', '维护账户印鉴'),
            ]),
            L5('7.2.3.3.2', 'Bank Service Evaluation', '银行服务评估', [
              L6('7.2.3.3.2.1', 'Evaluate Bank Fees', '评估银行费用'),
              L6('7.2.3.3.2.2', 'Evaluate Bank Service Quality', '评估银行服务质量'),
            ]),
          ]),
        ]),
      ]),
      L2('7.3', 'Budget & Business Analysis', '预算与经营分析', [
        L3('7.3.1', 'Budget Execution Monitoring', '预算执行监控', [
          L4('7.3.1.1', 'Budget Commitment Control', '预算承诺控制', [
            L5('7.3.1.1.1', 'Pre-commitment Check', '事前检查', [
              L6('7.3.1.1.1.1', 'Check Budget Availability Before PO', '下采购订单前检查预算'),
              L6('7.3.1.1.1.2', 'Check Budget Before Expense Claim', '报销前检查预算'),
              L6('7.3.1.1.1.3', 'Block if Budget Exceeded', '超预算时冻结'),
            ]),
            L5('7.3.1.1.2', 'Budget Transfer', '预算转移', [
              L6('7.3.1.1.2.1', 'Request Budget Transfer', '申请预算转移'),
              L6('7.3.1.1.2.2', 'Approve Budget Transfer', '审批预算转移'),
            ]),
          ]),
          L4('7.3.1.2', 'Actual vs Budget Analysis', '实际与预算对比', [
            L5('7.3.1.2.1', 'Variance Calculation', '差异计算', [
              L6('7.3.1.2.1.1', 'Collect Actual Financial Data', '收集实际财务数据'),
              L6('7.3.1.2.1.2', 'Calculate Budget Variance', '计算预算差异'),
              L6('7.3.1.2.1.3', 'Analyze Variance by Department', '按部门分析差异'),
            ]),
            L5('7.3.1.2.2', 'Variance Reporting', '差异报告', [
              L6('7.3.1.2.2.1', 'Prepare Budget Variance Report', '编制预算差异报告'),
              L6('7.3.1.2.2.2', 'Distribute to Responsibility Centers', '分发至责任中心'),
            ]),
          ]),
        ]),
        L3('7.3.2', 'Business Analysis & Alerting', '经营分析与预警', [
          L4('7.3.2.1', 'Key Performance Analysis', '关键绩效分析', [
            L5('7.3.2.1.1', 'Profitability Analysis', '盈利性分析', [
              L6('7.3.2.1.1.1', 'Analyze Gross Margin Trend', '分析毛利率趋势'),
              L6('7.3.2.1.1.2', 'Analyze Operating Margin', '分析营业利润率'),
              L6('7.3.2.1.1.3', 'Analyze Net Profit Margin', '分析净利率'),
            ]),
            L5('7.3.2.1.2', 'Efficiency Analysis', '运营效率分析', [
              L6('7.3.2.1.2.1', 'Analyze Asset Turnover', '分析资产周转率'),
              L6('7.3.2.1.2.2', 'Analyze Inventory Turnover', '分析库存周转率'),
              L6('7.3.2.1.2.3', 'Analyze Receivable Days (DSO)', '分析应收账款周转天数'),
            ]),
          ]),
          L4('7.3.2.2', 'Business Alert & Reporting', '经营预警与报告', [
            L5('7.3.2.2.1', 'Alert Threshold Management', '预警阈值管理', [
              L6('7.3.2.2.1.1', 'Define Alert Thresholds for KPIs', '定义KPI预警阈值'),
              L6('7.3.2.2.1.2', 'Monitor KPI vs Threshold', '监控KPI与阈值对比'),
            ]),
            L5('7.3.2.2.2', 'Management Reporting', '管理报告', [
              L6('7.3.2.2.2.1', 'Prepare Monthly Business Review', '编制月度经营分析报告'),
              L6('7.3.2.2.2.2', 'Prepare Quarterly Business Review', '编制季度经营分析报告'),
              L6('7.3.2.2.2.3', 'Present to Management Committee', '向管理委员会汇报'),
            ]),
          ]),
        ]),
      ]),
      L2('7.4', 'Tax Management', '税务管理', [
        L3('7.4.1', 'Tax Filing', '纳税申报', [
          L4('7.4.1.1', 'Tax Calculation', '税款计算', [
            L5('7.4.1.1.1', 'VAT Calculation', '增值税计算', [
              L6('7.4.1.1.1.1', 'Calculate Output VAT', '计算销项税额'),
              L6('7.4.1.1.1.2', 'Calculate Input VAT', '计算进项税额'),
              L6('7.4.1.1.1.3', 'Calculate VAT Payable', '计算应交增值税'),
            ]),
            L5('7.4.1.1.2', 'Corporate Income Tax Calculation', '企业所得税计算', [
              L6('7.4.1.1.2.1', 'Calculate Taxable Income', '计算应纳税所得额'),
              L6('7.4.1.1.2.2', 'Apply Tax Deductions and Credits', '应用税收减免'),
              L6('7.4.1.1.2.3', 'Calculate Tax Payable', '计算应交所得税'),
            ]),
          ]),
          L4('7.4.1.2', 'Tax Return Filing', '纳税申报', [
            L5('7.4.1.2.1', 'Return Preparation', '申报表编制', [
              L6('7.4.1.2.1.1', 'Prepare VAT Return', '编制增值税申报表'),
              L6('7.4.1.2.1.2', 'Prepare CIT Return (Annual)', '编制企业所得税年报'),
              L6('7.4.1.2.1.3', 'Prepare Other Tax Returns', '编制其他税种申报表'),
            ]),
            L5('7.4.1.2.2', 'Electronic Filing & Payment', '电子申报与缴税', [
              L6('7.4.1.2.2.1', 'Submit via E-Tax System', '电子税务局提交申报'),
              L6('7.4.1.2.2.2', 'Confirm Tax Authority Acknowledgment', '确认税务机关受理'),
              L6('7.4.1.2.2.3', 'Execute Tax Payment', '缴纳税款'),
            ]),
          ]),
        ]),
        L3('7.4.2', 'Tax Planning & Risk', '税务筹划与风险管理', [
          L4('7.4.2.1', 'Tax Planning', '税务筹划', [
            L5('7.4.2.1.1', 'Tax Incentive Utilization', '税收优惠利用', [
              L6('7.4.2.1.1.1', 'Identify Applicable Tax Incentives', '识别适用税收优惠'),
              L6('7.4.2.1.1.2', 'Prepare Incentive Application', '准备优惠申请材料'),
              L6('7.4.2.1.1.3', 'Obtain Incentive Approval', '获取优惠批准'),
            ]),
            L5('7.4.2.1.2', 'Cross-border Tax Planning', '跨境税务筹划', [
              L6('7.4.2.1.2.1', 'Analyze Transfer Pricing', '分析转让定价'),
              L6('7.4.2.1.2.2', 'Optimize Tax Structure', '优化税务架构'),
            ]),
          ]),
          L4('7.4.2.2', 'Tax Risk Management', '税务风险管理', [
            L5('7.4.2.2.1', 'Tax Risk Assessment', '税务风险评估', [
              L6('7.4.2.2.1.1', 'Conduct Tax Health Check', '进行税务健康检查'),
              L6('7.4.2.2.1.2', 'Identify High-risk Areas', '识别高风险领域'),
              L6('7.4.2.2.1.3', 'Develop Mitigation Plan', '制定缓解方案'),
            ]),
            L5('7.4.2.2.2', 'Tax Audit Response', '税务稽查应对', [
              L6('7.4.2.2.2.1', 'Receive Tax Audit Notice', '接收税务稽查通知'),
              L6('7.4.2.2.2.2', 'Prepare Audit Documentation', '准备稽查文档'),
              L6('7.4.2.2.2.3', 'Cooperate with Tax Authority', '配合税务机关稽查'),
              L6('7.4.2.2.2.4', 'Handle Tax Assessment', '处理税务处理决定'),
            ]),
          ]),
        ]),
      ]),
    ],
  },
  {
    id: 'HW-HR', code: '8.0',
    name: 'Human Resources', label: '人力资源管理',
    definition: '组织岗位、招聘配置、培训发展、绩效激励与员工关系全生命周期管理。',
    children: [
      L2('8.1', 'Organization & Position', '组织与岗位管理', [
        L3('8.1.1', 'Organization Structure', '组织架构管理', [
          L4('8.1.1.1', 'Organization Design', '组织设计', [
            L5('8.1.1.1.1', 'Define Organizational Model', '定义组织模式', [
              L6('8.1.1.1.1.1', 'Assess Business Needs', '评估业务需求'),
              L6('8.1.1.1.1.2', 'Choose Org Structure Type', '选择组织结构类型'),
              L6('8.1.1.1.1.3', 'Define Governance Model', '定义治理模式'),
            ]),
            L5('8.1.1.1.2', 'Org Chart Creation', '组织架构图创建', [
              L6('8.1.1.1.2.1', 'Create Department Structure', '创建部门结构'),
              L6('8.1.1.1.2.2', 'Define Reporting Lines', '定义汇报关系'),
            ]),
          ]),
          L4('8.1.1.2', 'Organization Change', '组织变更', [
            L5('8.1.1.2.1', 'Change Initiation', '变更发起', [
              L6('8.1.1.2.1.1', 'Identify Change Need', '识别变更需求'),
              L6('8.1.1.2.1.2', 'Draft Change Proposal', '起草变更方案'),
            ]),
            L5('8.1.1.2.2', 'Change Implementation', '变更实施', [
              L6('8.1.1.2.2.1', 'Obtain Approval for Change', '获取变更批准'),
              L6('8.1.1.2.2.2', 'Communicate Change', '传达变更'),
              L6('8.1.1.2.2.3', 'Update HR System', '更新HR系统'),
            ]),
          ]),
        ]),
        L3('8.1.2', 'Position & Headcount', '岗位与编制管理', [
          L4('8.1.2.1', 'Position Management', '岗位管理', [
            L5('8.1.2.1.1', 'Position Definition', '岗位定义', [
              L6('8.1.2.1.1.1', 'Create Job Description', '创建岗位说明书'),
              L6('8.1.2.1.1.2', 'Define Job Qualifications', '定义任职资格'),
              L6('8.1.2.1.1.3', 'Define Job Competencies', '定义岗位胜任力'),
            ]),
            L5('8.1.2.1.2', 'Position Grading', '岗位职级', [
              L6('8.1.2.1.2.1', 'Evaluate Position Value', '评估岗位价值'),
              L6('8.1.2.1.2.2', 'Assign Job Level / Grade', '分配职级/职等'),
            ]),
          ]),
          L4('8.1.2.2', 'Headcount Management', '编制管理', [
            L5('8.1.2.2.1', 'Headcount Planning', '编制计划', [
              L6('8.1.2.2.1.1', 'Define Approved Headcount', '定义批准编制数'),
              L6('8.1.2.2.1.2', 'Allocate Headcount to Departments', '分配编制到部门'),
            ]),
            L5('8.1.2.2.2', 'Headcount Control', '编制控制', [
              L6('8.1.2.2.2.1', 'Monitor Headcount Utilization', '监控编制使用情况'),
              L6('8.1.2.2.2.2', 'Approve Headcount Changes', '审批编制变更'),
            ]),
          ]),
        ]),
      ]),
      L2('8.2', 'Recruitment & Staffing', '招聘与配置', [
        L3('8.2.1', 'Recruitment', '招聘管理', [
          L4('8.2.1.1', 'Recruitment Planning', '招聘计划', [
            L5('8.2.1.1.1', 'Identify Hiring Need', '识别招聘需求', [
              L6('8.2.1.1.1.1', 'Receive Headcount Request', '接收编制申请'),
              L6('8.2.1.1.1.2', 'Validate Budget and Headcount', '验证预算与编制'),
              L6('8.2.1.1.1.3', 'Create Requisition', '创建招聘需求单'),
            ]),
            L5('8.2.1.1.2', 'Sourcing Strategy', '招聘渠道策略', [
              L6('8.2.1.1.2.1', 'Select Sourcing Channels', '选择招聘渠道'),
              L6('8.2.1.1.2.2', 'Write Job Advertisement', '撰写招聘广告'),
              L6('8.2.1.1.2.3', 'Publish Job Opening', '发布招聘信息'),
            ]),
          ]),
          L4('8.2.1.2', 'Candidate Assessment', '候选人评估', [
            L5('8.2.1.2.1', 'Resume Screening', '简历筛选', [
              L6('8.2.1.2.1.1', 'Review Candidate Resumes', '审阅候选人简历'),
              L6('8.2.1.2.1.2', 'Match to Job Requirements', '匹配岗位要求'),
              L6('8.2.1.2.1.3', 'Select Shortlist', '筛选入围名单'),
            ]),
            L5('8.2.1.2.2', 'Interview Process', '面试流程', [
              L6('8.2.1.2.2.1', 'Schedule Interviews', '安排面试'),
              L6('8.2.1.2.2.2', 'Conduct Panel Interviews', '进行结构化面试'),
              L6('8.2.1.2.2.3', 'Evaluate and Score Candidates', '评估并打分候选人'),
            ]),
            L5('8.2.1.2.3', 'Background Check & Offer', '背景调查与录用', [
              L6('8.2.1.2.3.1', 'Conduct Background Verification', '进行背景调查'),
              L6('8.2.1.2.3.2', 'Prepare Offer Letter', '准备录用通知'),
              L6('8.2.1.2.3.3', 'Extend and Negotiate Offer', '发放并谈录用条件'),
            ]),
          ]),
        ]),
        L3('8.2.2', 'Onboarding / Transfer / Exit', '入转调离管理', [
          L4('8.2.2.1', 'Onboarding', '入职管理', [
            L5('8.2.2.1.1', 'Pre-boarding Preparation', '入职前准备', [
              L6('8.2.2.1.1.1', 'Prepare Employee File', '准备员工档案'),
              L6('8.2.2.1.1.2', 'Set Up IT Accounts', '开通IT账号'),
              L6('8.2.2.1.1.3', 'Prepare Workstation and Equipment', '准备工位与设备'),
            ]),
            L5('8.2.2.1.2', 'Onboarding Day', '入职日', [
              L6('8.2.2.1.2.1', 'Welcome and Orientation', '欢迎与入职引导'),
              L6('8.2.2.1.2.2', 'Complete Employment Paperwork', '完成入职手续'),
              L6('8.2.2.1.2.3', 'Meet Team Members', '认识团队成员'),
            ]),
            L5('8.2.2.1.3', 'Probation Management', '试用期管理', [
              L6('8.2.2.1.3.1', 'Set Probation Goals', '设定试用期目标'),
              L6('8.2.2.1.3.2', 'Provide Regular Feedback', '定期提供反馈'),
              L6('8.2.2.1.3.3', 'Evaluate Probation Completion', '评估试用期完成'),
            ]),
          ]),
          L4('8.2.2.2', 'Internal Transfer', '内部调动', [
            L5('8.2.2.2.1', 'Transfer Initiation', '调动发起', [
              L6('8.2.2.2.1.1', 'Identify Transfer Opportunity', '识别调动机会'),
              L6('8.2.2.2.1.2', 'Discuss with Current Manager', '与当前主管沟通'),
              L6('8.2.2.2.1.3', 'Obtain Manager Approval', '获取主管批准'),
            ]),
            L5('8.2.2.2.2', 'Transfer Execution', '调动执行', [
              L6('8.2.2.2.2.1', 'Update Department and Position', '更新部门与岗位信息'),
              L6('8.2.2.2.2.2', 'Handover Work Responsibilities', '交接工作职责'),
              L6('8.2.2.2.2.3', 'Update HR Records', '更新HR系统记录'),
            ]),
          ]),
          L4('8.2.2.3', 'Offboarding', '离职管理', [
            L5('8.2.2.3.1', 'Resignation Processing', '辞职处理', [
              L6('8.2.2.3.1.1', 'Receive Resignation Notice', '接收辞职通知'),
              L6('8.2.2.3.1.2', 'Conduct Exit Interview', '进行离职面谈'),
              L6('8.2.2.3.1.3', 'Determine Last Working Day', '确定最后工作日'),
            ]),
            L5('8.2.2.3.2', 'Exit Formalities', '离职手续', [
              L6('8.2.2.3.2.1', 'Handover Company Property', '交接公司财产'),
              L6('8.2.2.3.2.2', 'Deactivate Access Accounts', '注销账号权限'),
              L6('8.2.2.3.2.3', 'Calculate Final Payroll', '计算离职薪资'),
            ]),
          ]),
        ]),
      ]),
      L2('8.3', 'Training & Talent', '培训与人才发展', [
        L3('8.3.1', 'Training Plan & Delivery', '培训计划与实施', [
          L4('8.3.1.1', 'Training Needs Analysis', '培训需求分析', [
            L5('8.3.1.1.1', 'Need Assessment', '需求评估', [
              L6('8.3.1.1.1.1', 'Conduct Training Survey', '进行培训需求调查'),
              L6('8.3.1.1.1.2', 'Analyze Skill Gaps', '分析技能差距'),
              L6('8.3.1.1.1.3', 'Prioritize Training Needs', '排序培训需求'),
            ]),
            L5('8.3.1.1.2', 'Training Plan Development', '培训计划制定', [
              L6('8.3.1.1.2.1', 'Define Training Objectives', '定义培训目标'),
              L6('8.3.1.1.2.2', 'Select Training Methods', '选择培训方式'),
              L6('8.3.1.1.2.3', 'Allocate Training Budget', '分配培训预算'),
            ]),
          ]),
          L4('8.3.1.2', 'Training Delivery', '培训实施', [
            L5('8.3.1.2.1', 'Internal Training', '内部培训', [
              L6('8.3.1.2.1.1', 'Organize Classroom Training', '组织课堂培训'),
              L6('8.3.1.2.1.2', 'Coordinate On-the-job Training', '协调在岗培训(OJT)'),
              L6('8.3.1.2.1.3', 'Conduct E-learning Programs', '组织在线学习'),
            ]),
            L5('8.3.1.2.2', 'External Training', '外部培训', [
              L6('8.3.1.2.2.1', 'Select External Training Provider', '选择外部培训机构'),
              L6('8.3.1.2.2.2', 'Register Employees for Training', '报名参训员工'),
              L6('8.3.1.2.2.3', 'Track Attendance and Completion', '跟踪出勤率和完成率'),
            ]),
          ]),
          L4('8.3.1.3', 'Training Effectiveness Evaluation', '培训效果评估', [
            L5('8.3.1.3.1', 'Reaction & Learning Evaluation', '反应与学习评估', [
              L6('8.3.1.3.1.1', 'Collect Training Feedback', '收集培训反馈'),
              L6('8.3.1.3.1.2', 'Administer Knowledge Test', '进行知识测试'),
            ]),
            L5('8.3.1.3.2', 'Application & Business Impact', '应用与业务影响', [
              L6('8.3.1.3.2.1', 'Measure Behavior Change', '测量行为改变'),
              L6('8.3.1.3.2.2', 'Measure Business Results', '测量业务成果'),
            ]),
          ]),
        ]),
        L3('8.3.2', 'Talent Pipeline & Succession', '人才梯队与继任管理', [
          L4('8.3.2.1', 'Talent Identification & Assessment', '人才识别与评估', [
            L5('8.3.2.1.1', 'Talent Pool Identification', '人才池识别', [
              L6('8.3.2.1.1.1', 'Define Critical Positions', '定义关键岗位'),
              L6('8.3.2.1.1.2', 'Identify High-potential Employees', '识别高潜力员工'),
            ]),
            L5('8.3.2.1.2', 'Assessment & Development Center', '评估与发展中心', [
              L6('8.3.2.1.2.1', 'Design Assessment Tools', '设计评估工具'),
              L6('8.3.2.1.2.2', 'Run Assessment Center', '举办评估中心'),
              L6('8.3.2.1.2.3', 'Generate Development Plan', '制定发展计划'),
            ]),
          ]),
          L4('8.3.2.2', 'Succession Planning', '继任计划', [
            L5('8.3.2.2.1', 'Successor Identification', '继任者识别', [
              L6('8.3.2.2.1.1', 'Map Critical Roles', '绘制关键岗位图谱'),
              L6('8.3.2.2.1.2', 'Identify Potential Successors', '识别潜在继任者'),
            ]),
            L5('8.3.2.2.2', 'Successor Development', '继任者培养', [
              L6('8.3.2.2.2.1', 'Create Individual Development Plan', '制定个人发展计划'),
              L6('8.3.2.2.2.2', 'Assign Mentors', '分配导师'),
              L6('8.3.2.2.2.3', 'Provide Stretch Assignments', '提供挑战性任务'),
            ]),
          ]),
        ]),
      ]),
      L2('8.4', 'Performance & Incentive', '绩效与激励', [
        L3('8.4.1', 'Performance Goal & Review', '绩效目标与考核', [
          L4('8.4.1.1', 'Goal Setting', '目标设定', [
            L5('8.4.1.1.1', 'Cascade Company Goals', '公司目标分解', [
              L6('8.4.1.1.1.1', 'Define Company OKRs/KPIs', '定义公司OKR/KPI'),
              L6('8.4.1.1.1.2', 'Cascade to Department Goals', '分解为部门目标'),
              L6('8.4.1.1.1.3', 'Cascade to Individual Goals', '分解为个人目标'),
            ]),
            L5('8.4.1.1.2', 'Performance Plan Agreement', '绩效计划沟通', [
              L6('8.4.1.1.2.1', 'Manager-Employee Goal Alignment', '主管与员工目标对齐'),
              L6('8.4.1.1.2.2', 'Agree on Performance Indicators', '确认绩效指标'),
            ]),
          ]),
          L4('8.4.1.2', 'Performance Review', '绩效评估', [
            L5('8.4.1.2.1', 'Ongoing Coaching', '持续辅导', [
              L6('8.4.1.2.1.1', 'Provide Regular Feedback', '定期反馈'),
              L6('8.4.1.2.1.2', 'Record Performance Evidence', '记录绩效证据'),
            ]),
            L5('8.4.1.2.2', 'Periodic Review', '周期考核', [
              L6('8.4.1.2.2.1', 'Employee Self-assessment', '员工自评'),
              L6('8.4.1.2.2.2', 'Manager Evaluation and Rating', '主管评估与定等'),
              L6('8.4.1.2.2.3', 'Review Calibration Meeting', '考核校准会议'),
              L6('8.4.1.2.2.4', 'Performance Interview', '绩效面谈'),
            ]),
          ]),
        ]),
        L3('8.4.2', 'Compensation & Incentive', '薪酬与激励管理', [
          L4('8.4.2.1', 'Compensation Design', '薪酬设计', [
            L5('8.4.2.1.1', 'Salary Structure', '薪酬结构', [
              L6('8.4.2.1.1.1', 'Conduct Salary Benchmarking', '进行薪酬调研'),
              L6('8.4.2.1.1.2', 'Design Salary Ranges', '设计薪酬带宽'),
              L6('8.4.2.1.1.3', 'Define Incentive Mix', '定义激励组合'),
            ]),
            L5('8.4.2.1.2', 'Compensation Review', '薪酬调整', [
              L6('8.4.2.1.2.1', 'Review Annual Salary Increase', '年度调薪审核'),
              L6('8.4.2.1.2.2', 'Approve Salary Adjustments', '审批薪酬调整'),
            ]),
          ]),
          L4('8.4.2.2', 'Incentive Implementation', '激励实施', [
            L5('8.4.2.2.1', 'Performance Bonus', '绩效奖金', [
              L6('8.4.2.2.1.1', 'Calculate Bonus Pool', '计算奖金池'),
              L6('8.4.2.2.1.2', 'Distribute Bonus by Performance', '按绩效分配奖金'),
              L6('8.4.2.2.1.3', 'Approve Bonus Distribution', '审批奖金分配'),
            ]),
            L5('8.4.2.2.2', 'Long-term Incentives', '长期激励', [
              L6('8.4.2.2.2.1', 'Design LTI Program', '设计长期激励方案'),
              L6('8.4.2.2.2.2', 'Allocate Equity/Options', '分配股权/期权'),
            ]),
          ]),
        ]),
      ]),
      L2('8.5', 'Employee Relations', '员工关系', [
        L3('8.5.1', 'Labor Contract & Discipline', '劳动合同与纪律管理', [
          L4('8.5.1.1', 'Labor Contract Management', '劳动合同管理', [
            L5('8.5.1.1.1', 'Contract Signing', '合同签订', [
              L6('8.5.1.1.1.1', 'Prepare Employment Contract', '准备劳动合同'),
              L6('8.5.1.1.1.2', 'Review and Sign Contract', '审阅与签订合同'),
              L6('8.5.1.1.1.3', 'Register with Labor Bureau', '劳动局备案'),
            ]),
            L5('8.5.1.1.2', 'Contract Renewal & Termination', '合同续签与终止', [
              L6('8.5.1.1.2.1', 'Assess Renewal Decision', '评估续签决定'),
              L6('8.5.1.1.2.2', 'Renew or Terminate Contract', '续签或终止合同'),
            ]),
          ]),
          L4('8.5.1.2', 'Discipline & Grievance', '纪律与申诉', [
            L5('8.5.1.2.1', 'Discipline Violation Handling', '违纪处理', [
              L6('8.5.1.2.1.1', 'Investigate Discipline Issue', '调查违纪问题'),
              L6('8.5.1.2.1.2', 'Issue Disciplinary Action', '下达纪律处分'),
              L6('8.5.1.2.1.3', 'Document in Personnel File', '记入人事档案'),
            ]),
            L5('8.5.1.2.2', 'Employee Grievance', '员工申诉', [
              L6('8.5.1.2.2.1', 'Receive Grievance', '接收申诉'),
              L6('8.5.1.2.2.2', 'Investigate and Resolve', '调查与解决'),
              L6('8.5.1.2.2.3', 'Provide Resolution Feedback', '反馈解决结果'),
            ]),
          ]),
        ]),
        L3('8.5.2', 'Employee Communication & Care', '员工沟通与关怀', [
          L4('8.5.2.1', 'Employee Communication', '员工沟通', [
            L5('8.5.2.1.1', 'Internal Communication Channels', '内部沟通渠道', [
              L6('8.5.2.1.1.1', 'Organize Town Hall Meetings', '组织全员大会'),
              L6('8.5.2.1.1.2', 'Publish Employee Newsletter', '发布员工通讯'),
              L6('8.5.2.1.1.3', 'Maintain Intranet Portal', '维护内网门户'),
            ]),
            L5('8.5.2.1.2', 'Employee Survey', '员工调查', [
              L6('8.5.2.1.2.1', 'Design Engagement Survey', '设计敬业度调查表'),
              L6('8.5.2.1.2.2', 'Analyze Survey Results', '分析调查结果'),
              L6('8.5.2.1.2.3', 'Create Improvement Action Plan', '制定改进行动计划'),
            ]),
          ]),
          L4('8.5.2.2', 'Employee Care & Wellbeing', '员工关怀', [
            L5('8.5.2.2.1', 'Welfare Programs', '福利项目', [
              L6('8.5.2.2.1.1', 'Administer Employee Benefits', '管理员工福利'),
              L6('8.5.2.2.1.2', 'Organize Social Activities', '组织团建活动'),
              L6('8.5.2.2.1.3', 'Support Employee Difficulties', '帮扶困难员工'),
            ]),
            L5('8.5.2.2.2', 'EAP & Work-life Balance', 'EAP与工作生活平衡', [
              L6('8.5.2.2.2.1', 'Provide EAP Services', '提供EAP心理咨询'),
              L6('8.5.2.2.2.2', 'Promote Work-life Balance', '促进工作生活平衡'),
            ]),
          ]),
        ]),
      ]),
    ],
  },
  {
    id: 'HW-IT', code: '9.0',
    name: 'Process & IT Services', label: '流程与信息服务',
    definition: '质量与流程 IT：流程架构与遵从性管理、IT 规划、应用建设运维、数据治理与信息安全。',
    children: [
      L2('9.1', 'Process Management', '流程管理', [
        L3('9.1.1', 'Process Architecture', '流程架构管理', [
          L4('9.1.1.1', 'Process Framework Design', '流程框架设计', [
            L5('9.1.1.1.1', 'Define Process Hierarchy', '定义流程层级', [
              L6('9.1.1.1.1.1', 'Define L1 Process Categories', '定义L1流程类别'),
              L6('9.1.1.1.1.2', 'Define L2 Process Domains', '定义L2流程域'),
              L6('9.1.1.1.1.3', 'Define L3 Process Groups', '定义L3流程组'),
            ]),
            L5('9.1.1.1.2', 'Process Architecture Review', '流程架构评审', [
              L6('9.1.1.1.2.1', 'Review Architecture Completeness', '评审架构完整性'),
              L6('9.1.1.1.2.2', 'Align with Business Strategy', '对齐业务战略'),
            ]),
          ]),
          L4('9.1.1.2', 'Process Metric Definition', '流程度量指标', [
            L5('9.1.1.2.1', 'Define Process KPIs', '定义流程KPI', [
              L6('9.1.1.2.1.1', 'Identify Key Process Metrics', '识别关键流程指标'),
              L6('9.1.1.2.1.2', 'Define Target Values', '定义目标值'),
              L6('9.1.1.2.1.3', 'Define Data Collection Method', '定义数据采集方法'),
            ]),
            L5('9.1.1.2.2', 'Process Dashboard', '流程仪表板', [
              L6('9.1.1.2.2.1', 'Build Process Performance Dashboard', '搭建流程绩效仪表板'),
              L6('9.1.1.2.2.2', 'Define Review Frequency', '设定评审频率'),
            ]),
          ]),
        ]),
        L3('9.1.2', 'Process Design & Release', '流程设计与发布', [
          L4('9.1.2.1', 'Process Design', '流程设计', [
            L5('9.1.2.1.1', 'As-is Analysis', '现状分析', [
              L6('9.1.2.1.1.1', 'Map Current Process', '绘制当前流程'),
              L6('9.1.2.1.1.2', 'Identify Pain Points', '识别痛点'),
              L6('9.1.2.1.1.3', 'Measure Current Performance', '测量当前绩效'),
            ]),
            L5('9.1.2.1.2', 'To-be Design', '目标设计', [
              L6('9.1.2.1.2.1', 'Design Target Process', '设计目标流程'),
              L6('9.1.2.1.2.2', 'Define Process Roles & Responsibilities', '定义流程角色与职责'),
              L6('9.1.2.1.2.3', 'Define Process Controls', '定义流程控制点'),
            ]),
          ]),
          L4('9.1.2.2', 'Process Validation & Release', '流程验证与发布', [
            L5('9.1.2.2.1', 'Process Walkthrough', '流程演练', [
              L6('9.1.2.2.1.1', 'Conduct Dry-run', '进行流程演练'),
              L6('9.1.2.2.1.2', 'Identify Gaps and Fix', '识别差距并修复'),
            ]),
            L5('9.1.2.2.2', 'Process Approval & Communication', '流程审批与发布', [
              L6('9.1.2.2.2.1', 'Obtain Process Owner Approval', '获取流程负责人批准'),
              L6('9.1.2.2.2.2', 'Obtain Management Sponsorship', '获取管理层支持'),
              L6('9.1.2.2.2.3', 'Communicate New/Updated Process', '传达新/更新流程'),
            ]),
          ]),
        ]),
        L3('9.1.3', 'Process Compliance', '流程遵从性管理', [
          L4('9.1.3.1', 'Process Audit', '流程审计', [
            L5('9.1.3.1.1', 'Compliance Assessment', '遵从性评估', [
              L6('9.1.3.1.1.1', 'Define Audit Scope', '定义审计范围'),
              L6('9.1.3.1.1.2', 'Execute Process Audit', '执行流程审计'),
              L6('9.1.3.1.1.3', 'Document Noncompliance', '记录不合规项'),
            ]),
            L5('9.1.3.1.2', 'Compliance Remediation', '合规整改', [
              L6('9.1.3.1.2.1', 'Create Remediation Plan', '制定整改计划'),
              L6('9.1.3.1.2.2', 'Implement Corrective Actions', '实施纠正措施'),
              L6('9.1.3.1.2.3', 'Verify Remediation Effectiveness', '验证整改有效性'),
            ]),
          ]),
          L4('9.1.3.2', 'Process Training & Awareness', '流程培训与意识', [
            L5('9.1.3.2.1', 'Process Training', '流程培训', [
              L6('9.1.3.2.1.1', 'Develop Process Training Materials', '开发流程培训材料'),
              L6('9.1.3.2.1.2', 'Conduct Process Training Sessions', '举办流程培训'),
              L6('9.1.3.2.1.3', 'Assess Training Effectiveness', '评估培训效果'),
            ]),
            L5('9.1.3.2.2', 'Process Awareness Promotion', '流程意识提升', [
              L6('9.1.3.2.2.1', 'Share Process Success Stories', '分享流程成功案例'),
              L6('9.1.3.2.2.2', 'Promote Process Culture', '倡导流程文化'),
            ]),
          ]),
        ]),
      ]),
      L2('9.2', 'IT Planning & Architecture', 'IT规划与架构', [
        L3('9.2.1', 'IT Strategy & Architecture', 'IT战略与架构规划', [
          L4('9.2.1.1', 'IT Strategy Development', 'IT战略制定', [
            L5('9.2.1.1.1', 'Business-IT Alignment', '业务与IT对齐', [
              L6('9.2.1.1.1.1', 'Understand Business Strategy', '理解业务战略'),
              L6('9.2.1.1.1.2', 'Map IT to Business Capabilities', '将IT映射到业务能力'),
              L6('9.2.1.1.1.3', 'Define IT Vision and Roadmap', '定义IT愿景与路标'),
            ]),
            L5('9.2.1.1.2', 'IT Budget Planning', 'IT预算规划', [
              L6('9.2.1.1.2.1', 'Estimate IT Investment Needs', '估算IT投资需求'),
              L6('9.2.1.1.2.2', 'Define IT Budget Allocation', '定义IT预算分配'),
            ]),
          ]),
          L4('9.2.1.2', 'Enterprise Architecture', '企业架构', [
            L5('9.2.1.2.1', 'Application Architecture', '应用架构', [
              L6('9.2.1.2.1.1', 'Define Application Landscape', '定义应用全景图'),
              L6('9.2.1.2.1.2', 'Define Application Integration', '定义应用集成方式'),
              L6('9.2.1.2.1.3', 'Manage Application Lifecycle', '管理应用生命周期'),
            ]),
            L5('9.2.1.2.2', 'Infrastructure Architecture', '基础设施架构', [
              L6('9.2.1.2.2.1', 'Design Network Architecture', '设计网络架构'),
              L6('9.2.1.2.2.2', 'Design Server & Storage Architecture', '设计服务器与存储架构'),
              L6('9.2.1.2.2.3', 'Define Cloud Strategy', '定义云战略'),
            ]),
          ]),
        ]),
        L3('9.2.2', 'IT Investment & Initiation', 'IT投资与立项', [
          L4('9.2.2.1', 'IT Project Proposal', 'IT项目立项', [
            L5('9.2.2.1.1', 'Business Case Development', '商业论证', [
              L6('9.2.2.1.1.1', 'Define Business Problem', '定义业务问题'),
              L6('9.2.2.1.1.2', 'Propose IT Solution', '提出IT解决方案'),
              L6('9.2.2.1.1.3', 'Analyze Costs and Benefits', '分析成本与收益'),
              L6('9.2.2.1.1.4', 'Assess Risks', '评估风险'),
            ]),
            L5('9.2.2.1.2', 'Project Approval', '项目审批', [
              L6('9.2.2.1.2.1', 'Submit for Steering Committee Review', '提交指导委员会评审'),
              L6('9.2.2.1.2.2', 'Obtain Budget Approval', '获取预算批准'),
            ]),
          ]),
          L4('9.2.2.2', 'IT Portfolio Management', 'IT投资组合管理', [
            L5('9.2.2.2.1', 'Portfolio Review', '组合评审', [
              L6('9.2.2.2.1.1', 'Review IT Project Portfolio', '评审IT项目组合'),
              L6('9.2.2.2.1.2', 'Balance Resources Across Projects', '平衡项目间资源'),
            ]),
            L5('9.2.2.2.2', 'Project Prioritization', '项目优先级', [
              L6('9.2.2.2.2.1', 'Score and Rank IT Projects', '评分排序IT项目'),
              L6('9.2.2.2.2.2', 'Communicate Prioritization Decisions', '传达优先级决定'),
            ]),
          ]),
        ]),
      ]),
      L2('9.3', 'Application & Operations', '应用建设与运维', [
        L3('9.3.1', 'Business Requirement Management', '业务需求管理', [
          L4('9.3.1.1', 'Requirements Elicitation', '需求获取', [
            L5('9.3.1.1.1', 'User Interview & Workshop', '用户访谈与工作坊', [
              L6('9.3.1.1.1.1', 'Identify Stakeholders', '识别干系人'),
              L6('9.3.1.1.1.2', 'Conduct Requirement Workshops', '举办需求工作坊'),
              L6('9.3.1.1.1.3', 'Document User Requirements', '记录用户需求'),
            ]),
            L5('9.3.1.1.2', 'Requirement Documentation', '需求文档化', [
              L6('9.3.1.1.2.1', 'Create Functional Specification', '创建功能规格说明书'),
              L6('9.3.1.1.2.2', 'Define Non-functional Requirements', '定义非功能需求'),
              L6('9.3.1.1.2.3', 'Define Acceptance Criteria', '定义验收标准'),
            ]),
          ]),
          L4('9.3.1.2', 'Requirements Analysis & Management', '需求分析与管理', [
            L5('9.3.1.2.1', 'Requirements Analysis', '需求分析', [
              L6('9.3.1.2.1.1', 'Prioritize Requirements', '需求优先级排序'),
              L6('9.3.1.2.1.2', 'Identify Dependencies', '识别需求依赖'),
              L6('9.3.1.2.1.3', 'Assess Feasibility', '评估可行性'),
            ]),
            L5('9.3.1.2.2', 'Requirements Traceability', '需求追溯', [
              L6('9.3.1.2.2.1', 'Create Requirements Traceability Matrix', '创建需求追溯矩阵'),
              L6('9.3.1.2.2.2', 'Track Requirement Changes', '跟踪需求变更'),
            ]),
          ]),
        ]),
        L3('9.3.2', 'System Development & Implementation', '系统开发与实施', [
          L4('9.3.2.1', 'Software Development', '软件开发', [
            L5('9.3.2.1.1', 'Design & Development', '设计与开发', [
              L6('9.3.2.1.1.1', 'System Design', '系统设计'),
              L6('9.3.2.1.1.2', 'Code Development', '代码开发'),
              L6('9.3.2.1.1.3', 'Unit Testing', '单元测试'),
            ]),
            L5('9.3.2.1.2', 'System Testing', '系统测试', [
              L6('9.3.2.1.2.1', 'Integration Testing', '集成测试'),
              L6('9.3.2.1.2.2', 'User Acceptance Testing (UAT)', '用户验收测试'),
              L6('9.3.2.1.2.3', 'Performance & Security Testing', '性能与安全测试'),
            ]),
          ]),
          L4('9.3.2.2', 'System Implementation', '系统实施', [
            L5('9.3.2.2.1', 'Deployment Preparation', '上线准备', [
              L6('9.3.2.2.1.1', 'Prepare Production Environment', '准备生产环境'),
              L6('9.3.2.2.1.2', 'Data Migration Planning', '数据迁移计划'),
              L6('9.3.2.2.1.3', 'Develop Training Materials', '开发培训材料'),
            ]),
            L5('9.3.2.2.2', 'Go-live & Cutover', '上线切换', [
              L6('9.3.2.2.2.1', 'Execute Data Migration', '执行数据迁移'),
              L6('9.3.2.2.2.2', 'System Cutover', '系统切换'),
              L6('9.3.2.2.2.3', 'Hypercare Support', '上线支持期'),
            ]),
          ]),
        ]),
        L3('9.3.3', 'System Operations & Support', '系统运维与支持', [
          L4('9.3.3.1', 'IT Service Management', 'IT服务管理', [
            L5('9.3.3.1.1', 'Incident Management', '事件管理', [
              L6('9.3.3.1.1.1', 'Receive Incident Report', '接收事件报告'),
              L6('9.3.3.1.1.2', 'Classify and Prioritize Incident', '分类与排序事件'),
              L6('9.3.3.1.1.3', 'Assign and Resolve Incident', '分配并解决事件'),
              L6('9.3.3.1.1.4', 'Close and Review Incident', '关闭与复盘事件'),
            ]),
            L5('9.3.3.1.2', 'Change Management', '变更管理', [
              L6('9.3.3.1.2.1', 'Submit Change Request', '提交变更请求'),
              L6('9.3.3.1.2.2', 'Assess Change Impact', '评估变更影响'),
              L6('9.3.3.1.2.3', 'CAB Review and Approval', 'CAB评审与批准'),
              L6('9.3.3.1.2.4', 'Implement and Verify Change', '实施与验证变更'),
            ]),
          ]),
          L4('9.3.3.2', 'System Monitoring & Maintenance', '系统监控与维护', [
            L5('9.3.3.2.1', 'Proactive Monitoring', '主动监控', [
              L6('9.3.3.2.1.1', 'Monitor System Availability', '监控系统可用性'),
              L6('9.3.3.2.1.2', 'Monitor System Performance', '监控系统性能'),
              L6('9.3.3.2.1.3', 'Monitor System Security', '监控系统安全'),
            ]),
            L5('9.3.3.2.2', 'Preventive Maintenance', '预防性维护', [
              L6('9.3.3.2.2.1', 'Apply Security Patches', '应用安全补丁'),
              L6('9.3.3.2.2.2', 'Upgrade System Components', '升级系统组件'),
              L6('9.3.3.2.2.3', 'Backup and Restore Testing', '备份与恢复测试'),
            ]),
          ]),
        ]),
      ]),
      L2('9.4', 'Data & Security', '数据与信息安全', [
        L3('9.4.1', 'Data Governance', '数据治理', [
          L4('9.4.1.1', 'Data Strategy & Stewardship', '数据战略与责任', [
            L5('9.4.1.1.1', 'Data Strategy', '数据战略', [
              L6('9.4.1.1.1.1', 'Define Data Governance Framework', '定义数据治理框架'),
              L6('9.4.1.1.1.2', 'Define Data Principles', '定义数据原则'),
            ]),
            L5('9.4.1.1.2', 'Data Stewardship', '数据责任人', [
              L6('9.4.1.1.2.1', 'Assign Data Owners', '分配数据所有者'),
              L6('9.4.1.1.2.2', 'Assign Data Stewards', '分配数据管家'),
              L6('9.4.1.1.2.3', 'Define Data Accountability', '定义数据责任'),
            ]),
          ]),
          L4('9.4.1.2', 'Data Quality Management', '数据质量管理', [
            L5('9.4.1.2.1', 'Data Quality Assessment', '数据质量评估', [
              L6('9.4.1.2.1.1', 'Define Data Quality Dimensions', '定义数据质量维度'),
              L6('9.4.1.2.1.2', 'Measure Data Quality', '测量数据质量'),
              L6('9.4.1.2.1.3', 'Report Data Quality Issues', '报告数据质量问题'),
            ]),
            L5('9.4.1.2.2', 'Data Quality Improvement', '数据质量改进', [
              L6('9.4.1.2.2.1', 'Root Cause Analysis of Quality Issues', '质量问题根因分析'),
              L6('9.4.1.2.2.2', 'Implement Data Cleansing', '实施数据清洗'),
              L6('9.4.1.2.2.3', 'Establish Data Quality Rules', '建立数据质量规则'),
            ]),
          ]),
          L4('9.4.1.3', 'Master Data Management', '主数据管理', [
            L5('9.4.1.3.1', 'Master Data Definition', '主数据定义', [
              L6('9.4.1.3.1.1', 'Define Master Data Domains', '定义主数据领域'),
              L6('9.4.1.3.1.2', 'Define Master Data Attributes', '定义主数据属性'),
            ]),
            L5('9.4.1.3.2', 'Master Data Maintenance', '主数据维护', [
              L6('9.4.1.3.2.1', 'Create Master Data Records', '创建主数据记录'),
              L6('9.4.1.3.2.2', 'Update Master Data Records', '更新主数据记录'),
              L6('9.4.1.3.2.3', 'Distribute Master Data to Systems', '分发主数据到各系统'),
            ]),
          ]),
        ]),
        L3('9.4.2', 'Information Security', '信息安全管理', [
          L4('9.4.2.1', 'Security Policy & Risk', '安全策略与风险', [
            L5('9.4.2.1.1', 'Security Policy Framework', '安全策略框架', [
              L6('9.4.2.1.1.1', 'Define Information Security Policy', '定义信息安全策略'),
              L6('9.4.2.1.1.2', 'Define Security Standards', '定义安全标准'),
              L6('9.4.2.1.1.3', 'Define Security Procedures', '定义安全程序'),
            ]),
            L5('9.4.2.1.2', 'Security Risk Assessment', '安全风险评估', [
              L6('9.4.2.1.2.1', 'Identify Information Assets', '识别信息资产'),
              L6('9.4.2.1.2.2', 'Identify Threats and Vulnerabilities', '识别威胁与漏洞'),
              L6('9.4.2.1.2.3', 'Assess and Prioritize Risks', '评估与排序风险'),
            ]),
          ]),
          L4('9.4.2.2', 'Security Controls & Monitoring', '安全控制与监控', [
            L5('9.4.2.2.1', 'Access Control', '访问控制', [
              L6('9.4.2.2.1.1', 'Define Role-based Access Rights', '定义基于角色的访问权限'),
              L6('9.4.2.2.1.2', 'Manage User Lifecycle Access', '管理用户生命周期权限'),
              L6('9.4.2.2.1.3', 'Conduct Access Review', '定期权限审查'),
            ]),
            L5('9.4.2.2.2', 'Security Monitoring & Incident Response', '安全监控与事件响应', [
              L6('9.4.2.2.2.1', 'Monitor Security Events', '监控安全事件'),
              L6('9.4.2.2.2.2', 'Detect Security Incidents', '检测安全事件'),
              L6('9.4.2.2.2.3', 'Respond to Security Incidents', '响应安全事件'),
              L6('9.4.2.2.2.4', 'Post-incident Review', '事件复盘'),
            ]),
          ]),
          L4('9.4.2.3', 'Data Privacy & Compliance', '数据隐私与合规', [
            L5('9.4.2.3.1', 'Data Privacy Management', '数据隐私管理', [
              L6('9.4.2.3.1.1', 'Identify Personal Data', '识别个人数据'),
              L6('9.4.2.3.1.2', 'Define Data Retention Policies', '定义数据保留策略'),
              L6('9.4.2.3.1.3', 'Ensure GDPR/PIPL Compliance', '确保GDPR/个保法合规'),
            ]),
            L5('9.4.2.3.2', 'Backup & Business Continuity', '备份与业务连续性', [
              L6('9.4.2.3.2.1', 'Implement Backup Strategy', '实施备份策略'),
              L6('9.4.2.3.2.2', 'Test Disaster Recovery Plan', '测试灾难恢复计划'),
              L6('9.4.2.3.2.3', 'Maintain Business Continuity Plan', '维护业务连续性计划'),
            ]),
          ]),
        ]),
      ]),
    ],
  },
  {
    id: 'HW-ADMIN', code: '10.0',
    name: 'Administration & Support', label: '行政与支持服务',
    definition: '行政后勤、固定资产、法务合规与 EHS，保障业务运行的基础支撑。',
    children: [
      L2('10.1', 'Administration', '行政事务管理', [
        L3('10.1.1', 'Office & Logistics Service', '办公与后勤服务', [
          L4('10.1.1.1', 'Office Space Management', '办公空间管理', [
            L5('10.1.1.1.1', 'Space Planning', '空间规划', [
              L6('10.1.1.1.1.1', 'Assess Space Requirements', '评估空间需求'),
              L6('10.1.1.1.1.2', 'Plan Office Layout', '规划办公布局'),
              L6('10.1.1.1.1.3', 'Allocate Seats to Departments', '分配座位到部门'),
            ]),
            L5('10.1.1.1.2', 'Facility Maintenance', '设施维护', [
              L6('10.1.1.1.2.1', 'Manage Building Services', '管理物业服务'),
              L6('10.1.1.1.2.2', 'Coordinate Repairs', '协调维修'),
              L6('10.1.1.1.2.3', 'Manage Cleaning Services', '管理保洁服务'),
            ]),
          ]),
          L4('10.1.1.2', 'Logistics Support', '后勤保障', [
            L5('10.1.1.2.1', 'Supply & Stationery', '物资与文具', [
              L6('10.1.1.2.1.1', 'Manage Office Supplies Inventory', '管理办公用品库存'),
              L6('10.1.1.2.1.2', 'Process Supply Requests', '处理物资申请'),
              L6('10.1.1.2.1.3', 'Replenish Supplies', '补充库存'),
            ]),
            L5('10.1.1.2.2', 'Mail & Courier', '邮件与快递', [
              L6('10.1.1.2.2.1', 'Manage Incoming Mail', '管理收件'),
              L6('10.1.1.2.2.2', 'Manage Outgoing Mail & Couriers', '管理发件与快递'),
            ]),
          ]),
        ]),
        L3('10.1.2', 'Meeting & Travel', '会议与差旅管理', [
          L4('10.1.2.1', 'Meeting Management', '会议管理', [
            L5('10.1.2.1.1', 'Meeting Room Reservation', '会议室预订', [
              L6('10.1.2.1.1.1', 'Check Room Availability', '查询会议室空闲'),
              L6('10.1.2.1.1.2', 'Reserve Meeting Room', '预订会议室'),
              L6('10.1.2.1.1.3', 'Arrange Meeting Setup', '安排会议布置'),
            ]),
            L5('10.1.2.1.2', 'Meeting Services', '会议服务', [
              L6('10.1.2.1.2.1', 'Provide Audio/Visual Support', '提供音视频支持'),
              L6('10.1.2.1.2.2', 'Arrange Catering', '安排餐饮茶点'),
              L6('10.1.2.1.2.3', 'Take Meeting Minutes', '记录会议纪要'),
            ]),
          ]),
          L4('10.1.2.2', 'Travel Management', '差旅管理', [
            L5('10.1.2.2.1', 'Travel Arrangement', '差旅安排', [
              L6('10.1.2.2.1.1', 'Submit Travel Request', '提交差旅申请'),
              L6('10.1.2.2.1.2', 'Book Flights and Hotels', '预订机票酒店'),
              L6('10.1.2.2.1.3', 'Arrange Ground Transportation', '安排地面交通'),
            ]),
            L5('10.1.2.2.2', 'Travel Expense Reimbursement', '差旅报销', [
              L6('10.1.2.2.2.1', 'Collect Expense Receipts', '收集费用票据'),
              L6('10.1.2.2.2.2', 'Submit Expense Report', '提交报销单'),
              L6('10.1.2.2.2.3', 'Review and Approve Expense', '审核与批准报销'),
              L6('10.1.2.2.2.4', 'Process Payment', '处理付款'),
            ]),
          ]),
        ]),
      ]),
      L2('10.2', 'Fixed Asset Management', '固定资产管理', [
        L3('10.2.1', 'Asset Purchase & Acceptance', '资产采购与验收', [
          L4('10.2.1.1', 'Asset Purchase', '资产采购', [
            L5('10.2.1.1.1', 'Purchase Request', '采购申请', [
              L6('10.2.1.1.1.1', 'Identify Asset Need', '识别资产需求'),
              L6('10.2.1.1.1.2', 'Draft Purchase Specification', '起草采购规格'),
              L6('10.2.1.1.1.3', 'Submit Purchase Request', '提交采购申请'),
            ]),
            L5('10.2.1.1.2', 'Vendor Selection & Order', '供应商选择与下单', [
              L6('10.2.1.1.2.1', 'Identify Potential Vendors', '识别潜在供应商'),
              L6('10.2.1.1.2.2', 'Compare and Select Vendor', '比较并选择供应商'),
              L6('10.2.1.1.2.3', 'Issue Purchase Order', '下达采购订单'),
            ]),
          ]),
          L4('10.2.1.2', 'Asset Acceptance & Registration', '资产验收与登记', [
            L5('10.2.1.2.1', 'Acceptance Inspection', '验收检查', [
              L6('10.2.1.2.1.1', 'Receive Delivered Asset', '接收交付资产'),
              L6('10.2.1.2.1.2', 'Inspect Asset Condition', '检查资产状况'),
              L6('10.2.1.2.1.3', 'Confirm Acceptance', '确认验收'),
            ]),
            L5('10.2.1.2.2', 'Asset Registration', '资产登记', [
              L6('10.2.1.2.2.1', 'Create Asset Record', '创建资产记录'),
              L6('10.2.1.2.2.2', 'Assign Asset Tag/Code', '分配资产标签/编码'),
              L6('10.2.1.2.2.3', 'Update Asset Ledger', '更新资产台账'),
            ]),
          ]),
        ]),
        L3('10.2.2', 'Asset Assignment & Transfer', '资产领用与调拨', [
          L4('10.2.2.1', 'Asset Assignment', '资产领用', [
            L5('10.2.2.1.1', 'Asset Issue', '资产发放', [
              L6('10.2.2.1.1.1', 'Receive Asset Request', '接收资产领用申请'),
              L6('10.2.2.1.1.2', 'Approve Asset Issue', '审批资产发放'),
              L6('10.2.2.1.1.3', 'Hand Over Asset to User', '移交资产给使用人'),
            ]),
            L5('10.2.2.1.2', 'Asset Responsibility Acknowledgment', '资产责任确认', [
              L6('10.2.2.1.2.1', 'User Signs Asset Receipt', '使用人签收资产'),
              L6('10.2.2.1.2.2', 'Update Asset Custodian', '更新资产保管人'),
            ]),
          ]),
          L4('10.2.2.2', 'Asset Transfer', '资产调拨', [
            L5('10.2.2.2.1', 'Inter-department Transfer', '部门间调拨', [
              L6('10.2.2.2.1.1', 'Initiate Transfer Request', '发起调拨申请'),
              L6('10.2.2.2.1.2', 'Approve Transfer', '审批调拨'),
              L6('10.2.2.2.1.3', 'Execute Asset Handover', '执行资产交接'),
            ]),
            L5('10.2.2.2.2', 'Inter-site Transfer', '跨地点调拨', [
              L6('10.2.2.2.2.1', 'Pack and Ship Asset', '包装与发运资产'),
              L6('10.2.2.2.2.2', 'Receive and Unpack at Destination', '目的地接收与开箱'),
              L6('10.2.2.2.2.3', 'Update Asset Location', '更新资产位置'),
            ]),
          ]),
        ]),
        L3('10.2.3', 'Asset Count & Disposal', '资产盘点与处置', [
          L4('10.2.3.1', 'Asset Inventory', '资产盘点', [
            L5('10.2.3.1.1', 'Physical Count', '实地盘点', [
              L6('10.2.3.1.1.1', 'Prepare Count Schedule', '准备盘点计划'),
              L6('10.2.3.1.1.2', 'Conduct Physical Verification', '进行实物核对'),
              L6('10.2.3.1.1.3', 'Record Count Results', '记录盘点结果'),
            ]),
            L5('10.2.3.1.2', 'Inventory Reconciliation', '盘点对账', [
              L6('10.2.3.1.2.1', 'Reconcile Physical vs Book', '核对实物与账面'),
              L6('10.2.3.1.2.2', 'Investigate Variances', '调查差异原因'),
              L6('10.2.3.1.2.3', 'Adjust Asset Records', '调整资产记录'),
            ]),
          ]),
          L4('10.2.3.2', 'Asset Disposal', '资产处置', [
            L5('10.2.3.2.1', 'Disposal Assessment', '处置评估', [
              L6('10.2.3.2.1.1', 'Identify Obsolete/Depreciated Assets', '识别报废/折旧资产'),
              L6('10.2.3.2.1.2', 'Assess Disposal Method', '评估处置方式'),
              L6('10.2.3.2.1.3', 'Approve Disposal', '审批处置'),
            ]),
            L5('10.2.3.2.2', 'Disposal Execution', '处置执行', [
              L6('10.2.3.2.2.1', 'Sell or Scrap Asset', '出售或报废资产'),
              L6('10.2.3.2.2.2', 'Calculate Asset Write-off', '计算资产核销'),
              L6('10.2.3.2.2.3', 'Update Asset and Accounting Records', '更新资产与会计记录'),
            ]),
          ]),
        ]),
      ]),
      L2('10.3', 'Legal & Compliance', '法务与合规', [
        L3('10.3.1', 'Contract Legal Review', '合同法务审核', [
          L4('10.3.1.1', 'Contract Drafting & Review', '合同起草与审核', [
            L5('10.3.1.1.1', 'Contract Drafting', '合同起草', [
              L6('10.3.1.1.1.1', 'Collect Contract Requirements', '收集合同需求'),
              L6('10.3.1.1.1.2', 'Draft Contract Template', '起草合同文本'),
              L6('10.3.1.1.1.3', 'Include Legal Protections', '加入法律保护条款'),
            ]),
            L5('10.3.1.1.2', 'Contract Review', '合同审核', [
              L6('10.3.1.1.2.1', 'Review Clauses for Legal Risk', '审核条款法律风险'),
              L6('10.3.1.1.2.2', 'Negotiate Contract Terms', '协商合同条款'),
              L6('10.3.1.1.2.3', 'Obtain Legal Approval', '获取法务批准'),
            ]),
          ]),
          L4('10.3.1.2', 'Contract Execution & Archive', '合同签署与归档', [
            L5('10.3.1.2.1', 'Contract Signing', '合同签署', [
              L6('10.3.1.2.1.1', 'Arrange Signing Ceremony', '安排签约仪式'),
              L6('10.3.1.2.1.2', 'Collect Authorized Signatures', '收集授权签字'),
              L6('10.3.1.2.1.3', 'Distribute Signed Copies', '分发签署副本'),
            ]),
            L5('10.3.1.2.2', 'Contract Archive & Management', '合同归档与管理', [
              L6('10.3.1.2.2.1', 'Archive Contract Documents', '归档合同文件'),
              L6('10.3.1.2.2.2', 'Track Contract Expiry', '跟踪合同到期'),
              L6('10.3.1.2.2.3', 'Manage Contract Renewal', '管理合同续签'),
            ]),
          ]),
        ]),
        L3('10.3.2', 'Intellectual Property', '知识产权管理', [
          L4('10.3.2.1', 'IP Creation & Protection', '知识产权创造与保护', [
            L5('10.3.2.1.1', 'IP Identification', 'IP识别', [
              L6('10.3.2.1.1.1', 'Identify Patentable Inventions', '识别可专利发明'),
              L6('10.3.2.1.1.2', 'Register Trademarks', '注册商标'),
              L6('10.3.2.1.1.3', 'Register Copyrights', '登记版权'),
            ]),
            L5('10.3.2.1.2', 'IP Filing & Prosecution', 'IP申请与维护', [
              L6('10.3.2.1.2.1', 'Prepare Patent Application', '准备专利申请'),
              L6('10.3.2.1.2.2', 'File with Patent Office', '向专利局提交'),
              L6('10.3.2.1.2.3', 'Respond to Office Actions', '答复审查意见'),
              L6('10.3.2.1.2.4', 'Pay Maintenance Fees', '缴纳年费/维护费'),
            ]),
          ]),
          L4('10.3.2.2', 'IP Enforcement & Licensing', 'IP维权与许可', [
            L5('10.3.2.2.1', 'IP Infringement Monitoring', 'IP侵权监控', [
              L6('10.3.2.2.1.1', 'Monitor Competitor Products', '监控竞品产品'),
              L6('10.3.2.2.1.2', 'Detect Potential Infringement', '发现潜在侵权'),
            ]),
            L5('10.3.2.2.2', 'IP Licensing & Litigation', 'IP许可与诉讼', [
              L6('10.3.2.2.2.1', 'Negotiate IP License Agreements', '谈判IP许可协议'),
              L6('10.3.2.2.2.2', 'Initiate Legal Action for Infringement', '发起侵权诉讼'),
              L6('10.3.2.2.2.3', 'Defend Against IP Claims', '应对IP纠纷应诉'),
            ]),
          ]),
        ]),
        L3('10.3.3', 'Compliance & Risk', '合规与风险管理', [
          L4('10.3.3.1', 'Compliance Program', '合规体系', [
            L5('10.3.3.1.1', 'Compliance Framework', '合规框架', [
              L6('10.3.3.1.1.1', 'Identify Applicable Laws & Regulations', '识别适用法律法规'),
              L6('10.3.3.1.1.2', 'Develop Compliance Policies', '制定合规政策'),
              L6('10.3.3.1.1.3', 'Define Compliance Organization', '定义合规组织架构'),
            ]),
            L5('10.3.3.1.2', 'Compliance Training & Monitoring', '合规培训与监控', [
              L6('10.3.3.1.2.1', 'Conduct Compliance Training', '举办合规培训'),
              L6('10.3.3.1.2.2', 'Monitor Compliance Status', '监控合规状态'),
              L6('10.3.3.1.2.3', 'Investigate Compliance Violations', '调查合规违规'),
            ]),
          ]),
          L4('10.3.3.2', 'Legal Risk Management', '法律风险管理', [
            L5('10.3.3.2.1', 'Legal Risk Assessment', '法律风险评估', [
              L6('10.3.3.2.1.1', 'Identify Legal Risks', '识别法律风险'),
              L6('10.3.3.2.1.2', 'Assess Risk Likelihood & Impact', '评估风险可能性与影响'),
              L6('10.3.3.2.1.3', 'Prioritize Legal Risks', '排序法律风险'),
            ]),
            L5('10.3.3.2.2', 'Legal Risk Mitigation', '法律风险缓释', [
              L6('10.3.3.2.2.1', 'Develop Risk Mitigation Plan', '制定风险缓释计划'),
              L6('10.3.3.2.2.2', 'Implement Risk Controls', '实施风险控制措施'),
              L6('10.3.3.2.2.3', 'Purchase Insurance Coverage', '购买保险保障'),
            ]),
          ]),
        ]),
      ]),
      L2('10.4', 'EHS', '环境与安全(EHS)', [
        L3('10.4.1', 'Production Safety', '安全生产管理', [
          L4('10.4.1.1', 'Safety Management System', '安全管理体系', [
            L5('10.4.1.1.1', 'Safety Policy & Rules', '安全政策与规程', [
              L6('10.4.1.1.1.1', 'Establish Safety Management Policy', '建立安全管理方针'),
              L6('10.4.1.1.1.2', 'Define Safety Rules & Procedures', '定义安全规则与程序'),
              L6('10.4.1.1.1.3', 'Establish Safety Accountability', '建立安全责任制'),
            ]),
            L5('10.4.1.1.2', 'Safety Training & Promotion', '安全培训与宣传', [
              L6('10.4.1.1.2.1', 'Conduct Safety Induction Training', '进行安全入职培训'),
              L6('10.4.1.1.2.2', 'Conduct Regular Safety Drills', '定期安全演练'),
              L6('10.4.1.1.2.3', 'Promote Safety Culture', '宣传安全文化'),
            ]),
          ]),
          L4('10.4.1.2', 'Hazard Control & Incident', '危险源控制与事故', [
            L5('10.4.1.2.1', 'Hazard Identification & Control', '危险源识别与控制', [
              L6('10.4.1.2.1.1', 'Identify Workplace Hazards', '识别工作场所危险源'),
              L6('10.4.1.2.1.2', 'Assess Risk Level', '评估风险等级'),
              L6('10.4.1.2.1.3', 'Implement Hazard Control Measures', '实施危险源控制措施'),
              L6('10.4.1.2.1.4', 'Provide Personal Protective Equipment', '提供个人防护装备'),
            ]),
            L5('10.4.1.2.2', 'Safety Incident Management', '安全事故管理', [
              L6('10.4.1.2.2.1', 'Report Safety Incident', '上报安全事故'),
              L6('10.4.1.2.2.2', 'Investigate Root Cause', '调查根因'),
              L6('10.4.1.2.2.3', 'Implement Corrective Actions', '实施纠正措施'),
              L6('10.4.1.2.2.4', 'Document and Learn from Incident', '记录并学习事故经验'),
            ]),
          ]),
        ]),
        L3('10.4.2', 'Environment & Occupational Health', '环保与职业健康管理', [
          L4('10.4.2.1', 'Environmental Management', '环境管理', [
            L5('10.4.2.1.1', 'Environmental Compliance', '环境合规', [
              L6('10.4.2.1.1.1', 'Identify Environmental Regulations', '识别环境法规要求'),
              L6('10.4.2.1.1.2', 'Obtain Environmental Permits', '取得环境许可证'),
              L6('10.4.2.1.1.3', 'Monitor Emissions & Discharges', '监控排放与废水'),
            ]),
            L5('10.4.2.1.2', 'Waste Management', '废弃物管理', [
              L6('10.4.2.1.2.1', 'Segregate Waste Types', '分类各类废弃物'),
              L6('10.4.2.1.2.2', 'Dispose Hazardous Waste Properly', '合规处置危险废物'),
              L6('10.4.2.1.2.3', 'Promote Recycling & Reduction', '推动回收与减量化'),
            ]),
          ]),
          L4('10.4.2.2', 'Occupational Health', '职业健康管理', [
            L5('10.4.2.2.1', 'Occupational Disease Prevention', '职业病预防', [
              L6('10.4.2.2.1.1', 'Identify Occupational Hazards', '识别职业病危害因素'),
              L6('10.4.2.2.1.2', 'Monitor Workplace Exposure', '监控工作场所暴露'),
              L6('10.4.2.2.1.3', 'Provide Health Protection Facilities', '提供健康防护设施'),
            ]),
            L5('10.4.2.2.2', 'Health Check & Wellness', '健康检查与促进', [
              L6('10.4.2.2.2.1', 'Arrange Pre-employment Health Check', '安排入职体检'),
              L6('10.4.2.2.2.2', 'Arrange Periodic Health Check', '安排定期体检'),
              L6('10.4.2.2.2.3', 'Promote Employee Wellness Programs', '推动员工健康计划'),
            ]),
          ]),
        ]),
      ]),
    ],
  },
]

export const HW_STYLE_PCF: FrameworkDefinition = {
  frameworkId: 'hw-style-pcf',
  name: 'HW-Style PCF (Manufacturing)',
  source: '依据公开资料（华为企业架构与流程白皮书、IPD/ISC/LTC/ITR 公开方法论）重构的华为风格参考框架，非官方授权体系；按制造业场景整理（L1–L6 完整版）',
  version: '0.2.0',
  description: '华为风格流程参考框架：10 个 L1 流程类别（战略、营销与服务、产品研发、集成供应链、制造交付、质量、财经、人力资源、流程与IT、行政支持），L1-L6 六级完整层级（流程类别→流程域→流程组→子流程→活动→任务），面向制造业现场访谈与实体锚定。',
  levels: LEVELS,
  domains,
}