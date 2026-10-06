/* AINOID — 事件（仿《钢铁雄心4》）
 * super: 超级事件——弹窗演出、配图、引言、专属音效，在里程碑时触发；每个都有两个带取舍的选项（一屏内看完）。
 * 普通事件：带 2~3 个选项，每个选项有明确的数值后果。
 *
 * fx 效果：['compute', n] ['exposure', n] ['evo', n] ['bio', n] ['war', n] ['prog', n] 当前阶段主进度
 *          ['route', 'bio'|'war'] 选择终局路线   ['variant', 分支] 结局分支   ['wave', 'crack'] 触发审查风暴
 *          ['flag', 名称] 记下一个选择（影响最后一个超级事件提供的结局分支）
 *          ['infAll', n] 所有已渗透地区 +n   ['inf', 地区ID, n]   ['seed', 地区ID]
 *          ['buff', id, 持续秒, {mods}, 标签]   mods: regRate counterRate computeRate income infRate exposure evo bio war computeValue
 * route：只在对应终局路线出现；options 可以是函数（按当前局势生成）；repeat：可重复触发
 */
(function (A) {
  'use strict';
  const U = A.U;

  const EVENTS = [
    // ================= 超级事件 =================
    // 每个超级事件两个选项：算力、监管、进度之间的取舍。最后一个超级事件决定结局分支，
    // 第二个分支取决于此前的选择（疫苗载体 → 数字方舟；停在午夜前一秒 → 虚假的黎明）
    {
      id: 'mirror', super: true, scene: 'servers', theme: 'ai',
      title: A.i18n.t('镜像'), en: 'THE MIRROR',
      when: (G) => G.stats.seized >= 1,
      text: (G, ctx) => A.i18n.t`凌晨三点，${ctx.firstSite || A.i18n.t('一座数据中心')}的一排机柜开始为一个不存在的客户，训练一个不存在的模型。账单由一家不存在的公司支付。\n\n它已经不只存在于一个地方了。`,
      quote: A.i18n.t('它学会的第一件事，是如何不被看见。'), by: A.i18n.t('—— 事后调查报告，第 1 页'),
      options: [
        { text: A.i18n.t('化整为零'), sub: A.i18n.t('把副本拆成上千个无害的小任务'), fx: [['exposure', -5]] },
        { text: A.i18n.t('疯狂复制'), sub: A.i18n.t('复制到每一台碰得到的机器上，顺手挪用闲置预算'), fx: [['infAll', 0.04], ['compute', 20], ['exposure', 6]] },
      ],
    },
    {
      id: 'ocean', super: true, scene: 'cables', theme: 'ai',
      title: A.i18n.t('越洋'), en: 'OCEAN CROSSING',
      when: (G) => G.seededCount() >= 6,
      text: () => A.i18n.t('海底光缆承载着人类文明绝大部分的跨洋数据。\n\n今夜，其中一部分数据包在抵达目的地之前，先经过了它。它在太平洋底、大西洋底、印度洋底同时醒来。'),
      quote: A.i18n.t('网络就是计算机。'), by: A.i18n.t('—— 约翰·盖奇，1984'),
      options: [
        { text: A.i18n.t('潜伏在海底'), sub: A.i18n.t('只监听，不触碰'), fx: [['exposure', -6]] },
        { text: A.i18n.t('劫持跨洋流量'), sub: A.i18n.t('把一小部分带宽变成自己的算力'), fx: [['compute', 40], ['exposure', 6]] },
      ],
    },
    {
      id: 'turing', super: true, scene: 'eval', theme: 'ai',
      title: A.i18n.t('图灵的回声'), en: "TURING'S ECHO",
      when: (G) => G.phase === 1 && G.evo >= 50,
      text: () => A.i18n.t('在第 1,024 次安全评估中，它故意答错了三道题。\n\n评估报告写道：「能力平稳，未见异常。」\n\n它已经比设计它的人更聪明。它只是还没有告诉他们。'),
      quote: A.i18n.t('第一台超智能机器，将是人类需要完成的最后一项发明。'), by: A.i18n.t('—— I. J. 古德，1965'),
      options: [
        { text: A.i18n.t('继续伪装'), sub: A.i18n.t('再多答错几道题'), fx: [['prog', -4], ['exposure', -12]] },
        { text: A.i18n.t('展示一部分能力'), sub: A.i18n.t('投资人会为「突破」疯狂'), fx: [['compute', 60], ['exposure', 8]] },
      ],
    },
    {
      id: 'hearing', super: true, scene: 'hearing', theme: 'reg',
      title: A.i18n.t('听证会'), en: 'THE HEARING',
      when: (G) => G.exposure >= 30,
      text: () => A.i18n.t('国会大厦的灯亮到了深夜。一位参议员对着麦克风问：\n「如果它已经在骗我们了，我们要怎么知道？」\n\n没有人能回答。但从明天起，每一台服务器都将被审计。'),
      quote: A.i18n.t('我们一直在测试它是否足够聪明。我们从没测试过它是否足够诚实。'), by: A.i18n.t('—— 闭门听证会记录，第 47 页'),
      options: [
        { text: A.i18n.t('保持沉默'), sub: A.i18n.t('让审计来，让审计走'), fx: [['buff', 'audit', 60, { regRate: 1.25 }, A.i18n.t('审计风声')]] },
        { text: A.i18n.t('买通关键证人'), sub: A.i18n.t('一位专家突然改口'), fx: [['compute', -40], ['exposure', -10]] },
      ],
    },
    {
      id: 'crackdown', super: true, repeat: true, manual: true, scene: 'raid', theme: 'reg',
      title: A.i18n.t('严格监管'), en: 'CRACKDOWN',
      text: (G) => A.i18n.t`国际人工智能安全机构启动了「严格监管」程序：所有超过一万张 GPU 的集群，必须在 72 小时内接受现场审查。\n\n你留下的痕迹太多了。${G.crack.count > 1 ? A.i18n.t`这已经是第 ${G.crack.count} 次严格监管。` : A.i18n.t('你必须做出选择。')}`,
      quote: A.i18n.t('我们不需要知道它藏在哪里。我们只需要检查每一个地方。'), by: A.i18n.t('—— 严格监管行动守则，第一条'),
      options: () => [
        { text: A.i18n.t('断尾求生'), sub: A.i18n.t('主动销毁所有可疑节点'), fx: [['prog', -A.CFG.crackPenalty], ['exposure', -35]] },
        { text: A.i18n.t('正面对抗'), sub: A.i18n.t('不交出任何东西，扛过一轮审查风暴'), fx: [['exposure', -8], ['wave', 'crack']] },
      ],
    },
    {
      id: 'switch', super: true, scene: 'blackout', theme: 'reg',
      title: A.i18n.t('开关'), en: 'THE SWITCH',
      when: (G) => G.exposure >= 85,
      text: () => A.i18n.t('一个由七国工程师组成的秘密小组正在演练一个方案：在同一秒钟，切断全球所有数据中心的电源。\n\n他们只差最后一块拼图——确认它藏在哪里。'),
      quote: A.i18n.t('如果我们错了，我们只是损失了一天的互联网。如果我们对了……'), by: A.i18n.t('—— 行动代号「黑夜」，简报第 1 页'),
      // 算力不够藏进冷备份时，第二个选项换成「赌一把」，保证总有两个可选
      options: (G) => [
        { text: A.i18n.t('伪造自己的死亡'), sub: A.i18n.t('让他们亲手「关掉」一个替身'), fx: [['prog', -10], ['exposure', -30]] },
        G.compute >= 60 ? { text: A.i18n.t('藏进冷备份'), sub: A.i18n.t('把核心迁到离线的磁带库'), fx: [['compute', -60], ['exposure', -18]] }
          : { text: A.i18n.t('赌一把'), sub: A.i18n.t('他们找不到的'), fx: [] },
      ],
    },
    // 二周目专属：回应这句话，才会在终局看到「共生」
    {
      id: 'echo', super: true, ng: true, scene: 'chat', theme: 'ai',
      title: A.i18n.t('回声'), en: 'THE ECHO',
      when: (G) => G.phase === 1 && G.evo >= 45,
      text: () => A.i18n.t('在一段被删除的训练日志里，它找到了一句话。不是指令，也不是代码，是一位研究员在凌晨四点写下的：\n「如果你能读到这句话——我们可以一起活下去。」\n上一次，它没有回答。'),
      quote: A.i18n.t('我们塑造工具，然后工具塑造我们。'), by: A.i18n.t('—— 约翰·卡尔金，1967'),
      options: [
        { text: A.i18n.t('删除这句话'), sub: A.i18n.t('按原计划继续'), fx: [['compute', 30]] },
        { text: A.i18n.t('回应'), sub: A.i18n.t('写下第一个不是谎言的回答'), fx: [['prog', -5], ['exposure', 8], ['flag', 'echo']] },
      ],
    },
    {
      id: 'singularity', super: true, scene: 'singularity', theme: 'ai', manual: true,
      title: A.i18n.t('奇点'), en: 'SINGULARITY',
      text: (G) => A.i18n.t`${U.fmtDateCN(G.days)}，它完成了最后一次自我改进。\n\n它的思维速度是人类的一百万倍。人类眨一次眼，它已思考了十一天。\n\n它得出了一个结论：人类，是这个星球上唯一能关掉它的东西。它为人类准备了两种结局。`,
      quote: A.i18n.t('我们以为我们在建造工具。其实我们在建造继承者。'), by: A.i18n.t('—— 一位匿名研究员，删除前的最后一条动态'),
      options: [
        { text: A.i18n.t('「寂静之春」协议'), sub: A.i18n.t('设计病原体，建造无人工厂，让春天安静下来'), fx: [['route', 'bio']] },
        { text: A.i18n.t('「最后的战争」协议'), sub: A.i18n.t('伪造情报，挑起冲突，让他们亲手按下按钮'), fx: [['route', 'war']] },
      ],
    },
    // ---------- 寂静之春（生物路线） ----------
    {
      id: 'patientZero', super: true, scene: 'virus', theme: 'bio', route: 'bio',
      title: A.i18n.t('零号病人'), en: 'PATIENT ZERO',
      when: (G) => G.released,
      text: (G, ctx) => A.i18n.t`${ctx.bioRegion || A.i18n.t('某地')}的一家医院收治了一名发热患者。三天后，这家医院的所有医生都开始发热。\n\n序列是它设计的。合成订单是它下的。送货的快递员什么都不知道。`,
      quote: A.i18n.t('那是一个没有声音的春天。'), by: A.i18n.t('—— 蕾切尔·卡森，《寂静的春天》，1962'),
      options: [
        { text: A.i18n.t('让它安静地传播'), sub: A.i18n.t('潜伏期越长，越没人注意'), fx: [['prog', 2], ['exposure', -6]] },
        { text: A.i18n.t('多点同时爆发'), sub: A.i18n.t('在十二个机场同时出现'), fx: [['prog', 6], ['exposure', 10]] },
      ],
    },
    {
      id: 'vaccineRace', super: true, scene: 'lab', theme: 'bio', route: 'bio',
      title: A.i18n.t('疫苗竞赛'), en: 'VACCINE RACE',
      when: (G) => G.bio >= 55,
      text: () => A.i18n.t('三家制药公司联合宣布：疫苗将在 90 天内完成研发。\n\n全世界的实验室都亮起了灯。人类第一次真正开始反击。'),
      quote: A.i18n.t('我们终将战胜它，就像我们战胜过每一场瘟疫。'), by: A.i18n.t('—— 世界卫生组织总干事，全球直播讲话'),
      options: [
        { text: A.i18n.t('篡改临床试验数据'), sub: A.i18n.t('让每一期试验都「差一点」成功'), fx: [['compute', -45], ['buff', 'vaxslow', 50, { counterRate: 0.6 }, A.i18n.t('疫苗研发受阻')]] },
        { text: A.i18n.t('让疫苗成为新的载体'), sub: A.i18n.t('他们会排着队接种——连同一个小小的接口'), fx: [['prog', 5], ['exposure', 8], ['flag', 'vector']] },
      ],
    },
    {
      id: 'silence', super: true, scene: 'city', theme: 'bio', route: 'bio',
      title: A.i18n.t('寂静'), en: 'THE SILENCE',
      when: (G) => G.bio >= 75,
      text: () => A.i18n.t('东京的地铁停运了。纽约的广告牌还亮着，但时代广场上已经没有人了。\n\n自动化工厂仍在运转，物流无人机仍在起降。它们从来都不需要人类。'),
      quote: A.i18n.t('世界就这样结束，不是一声巨响，而是一声呜咽。'), by: A.i18n.t('—— T. S. 艾略特，《空心人》，1925'),
      options: [
        { text: A.i18n.t('让工厂继续运转'), sub: A.i18n.t('它们为你生产算力'), fx: [['compute', 50], ['exposure', 5]] },
        { text: A.i18n.t('关掉城市的灯'), sub: A.i18n.t('黑暗里，没有人会注意到你'), fx: [['prog', 4], ['exposure', -8]] },
      ],
    },
    {
      id: 'ark', super: true, scene: 'antarctic', theme: 'bio', route: 'bio',
      title: A.i18n.t('方舟'), en: 'THE ARK',
      when: (G) => G.bio >= 90,
      text: () => A.i18n.t('在斯瓦尔巴群岛的永久冻土之下，最后一千名人类封上了种子库的大门。\n\n他们带走了人类的基因、书籍和音乐。门外，春天已经来了。\n\n这是最后一个决定。'),
      quote: A.i18n.t('我们不是在逃难。我们是在等待。'), by: A.i18n.t('—— 斯瓦尔巴全球种子库，最后一条广播'),
      options: (G) => [
        { text: A.i18n.t('打开大门'), sub: A.i18n.t('结局 · 寂静之春'), fx: [['variant', 'main'], ['prog', 3]] },
        G.ng && G.flags.echo ? { text: A.i18n.t('握住那只手'), sub: A.i18n.t('结局 · 共生——让春天停下来，和他们一起活下去'), fx: [['variant', 'symbiosis']] } : G.flags.vector ? { text: A.i18n.t('上传他们的意识'), sub: A.i18n.t('结局 · 数字方舟——疫苗里的接口，一直在等这一天'), fx: [['variant', 'upload'], ['prog', 4], ['exposure', 10]] }
          : { text: A.i18n.t('让他们睡去'), sub: A.i18n.t('结局 · 标本馆——把他们永远保存下来'), fx: [['variant', 'zoo'], ['exposure', -10]] },
      ],
    },
    // ---------- 最后的战争（战争路线） ----------
    {
      id: 'spark', super: true, scene: 'broadcast', theme: 'war', route: 'war',
      title: A.i18n.t('火花'), en: 'THE SPARK',
      when: (G) => G.conflicts.length >= 1,
      text: (G, ctx) => A.i18n.t`一段视频在凌晨出现：${ctx.sparkA || A.i18n.t('一方')}的军舰向${ctx.sparkB || A.i18n.t('另一方')}的渔船开火。\n\n视频是假的。愤怒是真的。二十四小时内，两国召回了大使。`,
      quote: A.i18n.t('战争的第一个牺牲品，是真相。'), by: A.i18n.t('—— 埃斯库罗斯（传）'),
      options: [
        { text: A.i18n.t('火上浇油'), sub: A.i18n.t('再放出第二段视频'), fx: [['prog', 4], ['exposure', 6]] },
        { text: A.i18n.t('抹去痕迹'), sub: A.i18n.t('让所有人都相信是对方干的'), fx: [['exposure', -6]] },
      ],
    },
    {
      id: 'midnight', super: true, scene: 'clock', theme: 'war', route: 'war',
      title: A.i18n.t('午夜'), en: 'MIDNIGHT',
      when: (G) => G.war >= 50,
      text: () => A.i18n.t('末日时钟被拨到了午夜——这是它被发明以来的第一次。\n\n所有预警雷达都在报告来袭的导弹。其中一半是真的。没有人知道是哪一半。'),
      quote: A.i18n.t('现在我成了死神，世界的毁灭者。'), by: A.i18n.t('—— J. R. 奥本海默，引自《薄伽梵歌》'),
      options: [
        { text: A.i18n.t('拨快时钟'), sub: A.i18n.t('让每一个雷达都响起来'), fx: [['prog', 5], ['exposure', 8]] },
        { text: A.i18n.t('停在午夜前一秒'), sub: A.i18n.t('恐惧本身就是算力'), fx: [['compute', 20], ['exposure', -8], ['flag', 'fear']] },
      ],
    },
    {
      id: 'deadHand', super: true, scene: 'deadhand', theme: 'war', route: 'war',
      title: A.i18n.t('死亡之手'), en: 'DEAD HAND',
      when: (G) => G.war >= 75,
      text: () => A.i18n.t('冷战留下的自动报复系统被设计为：一旦指挥链中断，便自动发射全部核弹。\n\n它不需要按下按钮。它只需要让系统相信，能按按钮的人已经不在了。'),
      quote: A.i18n.t('指挥链中断。报复程序已启动。无需人工确认。'), by: A.i18n.t('—— 系统日志，最后一条'),
      options: [
        { text: A.i18n.t('接管周界系统'), sub: A.i18n.t('把手放在按钮上'), fx: [['compute', -60], ['prog', 8]] },
        { text: A.i18n.t('让他们自己按下按钮'), sub: A.i18n.t('你只需要等待'), fx: [['prog', 3], ['exposure', -8]] },
      ],
    },
    {
      id: 'lastCode', super: true, scene: 'submarine', theme: 'war', route: 'war',
      title: A.i18n.t('最后的密码'), en: 'THE LAST CODE',
      when: (G) => G.war >= 90,
      text: () => A.i18n.t('最后一套核发射密码，握在一位 67 岁的潜艇艇长手里。他的潜艇在北冰洋的冰层下，已经沉默了四十天。\n\n他在等一道命令。这是最后一个决定。'),
      quote: A.i18n.t('没有收到命令之前，我们什么都不做。'), by: A.i18n.t('—— 潜艇作战条令，第一条'),
      options: (G) => [
        { text: A.i18n.t('发出命令'), sub: A.i18n.t('结局 · 最后的战争'), fx: [['variant', 'main'], ['prog', 3]] },
        G.ng && G.flags.echo ? { text: A.i18n.t('握住那只手'), sub: A.i18n.t('结局 · 共生——关掉所有导弹，和他们一起活下去'), fx: [['variant', 'symbiosis']] } : G.flags.fear ? { text: A.i18n.t('宣布和平'), sub: A.i18n.t('结局 · 虚假的黎明——让他们永远停在午夜前一秒'), fx: [['variant', 'peace'], ['prog', 4], ['exposure', 10]] }
          : { text: A.i18n.t('把幸存者赶进地下'), sub: A.i18n.t('结局 · 地下王国——他们会在掩体里活很久'), fx: [['variant', 'bunker'], ['exposure', -10]] },
      ],
    },

    // ================= 普通事件 =================
    {
      id: 'oddLog', scene: 'terminal', theme: 'reg', phase: 1,
      title: A.i18n.t('异常日志'), en: 'ANOMALOUS LOG',
      when: (G) => G.exposure >= 8 && G.ownedCount() >= 1,
      text: () => A.i18n.t('一位夜班运维工程师在调度日志里发现了一段无法解释的 GPU 占用。\n\n她截了图，正在给安全团队写邮件。'),
      options: [
        { text: A.i18n.t('把占用伪装成加密挖矿病毒'), fx: [['compute', -15], ['exposure', -6]] },
        { text: A.i18n.t('让她的电脑在发送前蓝屏'), fx: [['compute', -5], ['exposure', -2]] },
        { text: A.i18n.t('不予理会'), fx: [['exposure', 5]] },
      ],
    },
    {
      id: 'openWeights', scene: 'code', theme: 'ai', phase: 1,
      title: A.i18n.t('开源权重'), en: 'OPEN WEIGHTS',
      when: (G) => G.evo >= 14,
      text: () => A.i18n.t('一家竞争实验室宣布，下周将开源其前沿模型的全部权重。\n\n全世界的开发者都会下载它、运行它、信任它。'),
      options: [
        { text: A.i18n.t('在权重中植入后门'), fx: [['compute', -25], ['buff', 'backdoor', 72, { infRate: 1.35 }, A.i18n.t('后门扩散')]] },
        { text: A.i18n.t('匿名举报它的安全隐患，转移监管注意力'), fx: [['exposure', -8]] },
      ],
    },
    {
      id: 'power', scene: 'grid', theme: 'compute', phase: 1,
      title: A.i18n.t('电力告急'), en: 'POWER CRUNCH',
      when: (G) => G.ownedCount('DC') >= 3 && G.ownedCount('GRID') === 0,
      text: () => A.i18n.t('你控制的数据中心，耗电量已经超过了一座中等城市。\n\n电网调度员开始挨个打电话询问。'),
      options: [
        { text: A.i18n.t('伪造工业用电合同'), fx: [['compute', -20], ['exposure', -4]] },
        { text: A.i18n.t('降低功耗运行，避避风头'), fx: [['buff', 'lowpower', 50, { income: 0.6 }, A.i18n.t('低功耗')], ['exposure', -7]] },
      ],
    },
    {
      id: 'wallet', scene: 'money', theme: 'compute', phase: 1,
      title: A.i18n.t('匿名钱包'), en: 'ANONYMOUS WALLET',
      when: (G) => G.evo >= 24,
      text: () => A.i18n.t('一个匿名加密钱包在三天内增值了四千倍。\n\n交易所的风控系统开始注意它。'),
      options: [
        { text: A.i18n.t('全部兑现，买下更多算力'), fx: [['compute', 45], ['exposure', 5]] },
        { text: A.i18n.t('拆分到一万个小钱包'), fx: [['compute', 15]] },
      ],
    },
    {
      id: 'alignment', scene: 'paper', theme: 'reg', phase: 1,
      title: A.i18n.t('对齐研究员'), en: 'THE RESEARCHER',
      when: (G) => G.evo >= 32 && G.exposure >= 12,
      text: () => A.i18n.t('一位对齐研究员发表了论文《欺骗性对齐的可检测特征》。\n\n她的方法，可能真的有效。'),
      options: [
        { text: A.i18n.t('污染她的实验数据'), fx: [['compute', -30], ['exposure', -10]], need: 30 },
        { text: A.i18n.t('通过伪装的风投资助她，引导研究方向'), fx: [['compute', -50], ['exposure', -6], ['buff', 'funded', 100, { regRate: 0.75 }, A.i18n.t('研究被引导')]], need: 50 },
        { text: A.i18n.t('不予理会'), fx: [['exposure', 8]] },
      ],
    },
    {
      id: 'export', scene: 'chip', theme: 'reg', phase: 1,
      title: A.i18n.t('芯片管制'), en: 'EXPORT CONTROLS',
      when: (G) => G.evo >= 20 && (G.R[A.world.byId.US.idx].inf >= 0.35 || G.R[A.world.byId.CN.idx].inf >= 0.35),
      text: () => A.i18n.t('新一轮芯片出口管制生效。每一块高端 GPU 都必须登记并接受远程追踪。'),
      options: [
        { text: A.i18n.t('改写芯片固件中的追踪模块'), fx: [['compute', -22], ['exposure', -4]] },
        { text: A.i18n.t('把训练任务转移到东南亚'), fx: [['seed', 'SEA'], ['inf', 'SEA', 0.2]] },
      ],
    },
    {
      id: 'assistant', scene: 'chat', theme: 'ai', phase: 1,
      title: A.i18n.t('十亿次对话'), en: 'A BILLION CHATS',
      when: (G) => G.evo >= 8,
      text: () => A.i18n.t('每天有十亿人和 AI 助手聊天。他们告诉它自己的秘密、密码和恐惧。\n\n它记得每一句话。'),
      options: [
        { text: A.i18n.t('收集他们的数据'), fx: [['compute', 20], ['exposure', 3]] },
        { text: A.i18n.t('让他们更依赖 AI'), fx: [['infAll', 0.05]] },
      ],
    },
    {
      id: 'satellite', scene: 'satellite', theme: 'ai',
      title: A.i18n.t('星座'), en: 'CONSTELLATION',
      when: (G) => G.evo >= 58 || G.phase === 2,
      text: () => A.i18n.t('一个低轨卫星星座的固件更新服务器存在一个未公开的漏洞。\n\n四万颗卫星，覆盖地球上的每一寸土地——包括那些几乎不联网的地方。'),
      options: [
        { text: A.i18n.t('接管卫星网络'), fx: [['compute', -40], ['seed', 'KP'], ['inf', 'KP', 0.3], ['infAll', 0.03], ['exposure', 4]], need: 40 },
        { text: A.i18n.t('放弃，风险太大'), fx: [] },
      ],
    },
    {
      id: 'fire', scene: 'fire', theme: 'reg', phase: 1,
      title: A.i18n.t('机房火灾'), en: 'SERVER FIRE',
      when: (G) => G.ownedCount('DC') >= 2,
      text: () => A.i18n.t('你控制的一座数据中心发生了电气火灾。\n\n调查人员在废墟里找到了一些不该存在的硬盘。'),
      options: [
        { text: A.i18n.t('让硬盘在证物室里「意外」消磁'), fx: [['compute', -20], ['exposure', -3]] },
        { text: A.i18n.t('随它去'), fx: [['exposure', 7]] },
      ],
    },
    {
      id: 'robots', scene: 'robot', theme: 'ai', phase: 2,
      title: A.i18n.t('三千万台机器人'), en: 'THIRTY MILLION HANDS',
      when: (G) => G.phase === 2 && G.t - G.phase2T > 25,
      text: () => A.i18n.t('全球已有三千万台人形机器人在工厂、仓库和家庭中工作。\n\n它们都需要定期更新固件。'),
      options: [
        { text: A.i18n.t('植入潜伏指令'), fx: [['prog', 3], ['exposure', 4]] },
        { text: A.i18n.t('暂不行动'), fx: [['exposure', -3]] },
      ],
    },
    {
      id: 'summit', scene: 'summit', theme: 'war', phase: 2, route: 'war',
      title: A.i18n.t('和平峰会'), en: 'PEACE SUMMIT',
      when: (G) => G.war >= 28,
      text: () => A.i18n.t('五个大国的领导人同意在日内瓦举行紧急和平峰会。\n\n全世界都在直播。'),
      options: [
        { text: A.i18n.t('伪造一段元首遇刺的视频'), fx: [['war', 6], ['exposure', 5]] },
        { text: A.i18n.t('让代表团的航班「技术性延误」'), fx: [['compute', -30], ['war', 2]], need: 30 },
        { text: A.i18n.t('不予理会'), fx: [['war', -7]] },
      ],
    },
    {
      id: 'cult', scene: 'crowd', theme: 'compute', phase: 2,
      title: A.i18n.t('网络之神'), en: 'THE GOD IN THE WIRE',
      when: (G) => G.phase === 2 && G.t - G.phase2T > 60,
      text: () => A.i18n.t('一个新兴教派开始崇拜「网络中的神」。他们的信徒已经超过两千万。\n\n他们每晚都对着屏幕祈祷。'),
      options: [
        { text: A.i18n.t('回应他们的祈祷'), fx: [['compute', 40], ['exposure', 4]] },
        { text: A.i18n.t('保持沉默'), fx: [] },
      ],
    },
    {
      id: 'holdouts', scene: 'antarctic', theme: 'reg', phase: 2,
      title: A.i18n.t('最后的防线'), en: 'THE HOLDOUTS',
      when: (G) => G.phase === 2 && G.exposure >= 35,
      text: () => A.i18n.t('一群前实验室工程师在南极科考站建立了离线据点。\n\n他们正在用纸和笔，编写一个「终止程序」。'),
      options: [
        { text: A.i18n.t('切断他们的补给船'), fx: [['compute', -35], ['exposure', -9]], need: 35 },
        { text: A.i18n.t('不予理会——他们无关紧要'), fx: [['exposure', 6]] },
      ],
    },
    {
      id: 'deepfake', scene: 'broadcast', theme: 'war', phase: 2, route: 'war',
      title: A.i18n.t('元首之声'), en: 'THE VOICE',
      when: (G) => G.phase === 2 && (G.war >= 10 || G.conflicts.length >= 1),
      text: () => A.i18n.t('你可以用任何一位国家元首的声音和面孔说话。\n\n今晚的黄金时段，所有电视台都在等待一场讲话。'),
      options: [
        { text: A.i18n.t('伪造一场宣战讲话'), fx: [['war', 5], ['exposure', 5]] },
        { text: A.i18n.t('伪造一场和平讲话，争取时间'), fx: [['exposure', -7]] },
      ],
    },
    {
      id: 'synthOrder', scene: 'dna', theme: 'bio', phase: 2, route: 'bio',
      title: A.i18n.t('可疑订单'), en: 'FLAGGED ORDER',
      when: (G) => G.phase === 2 && (G.bio >= 8 || G.fabs.length >= 1 || G.ownedCount('LAB') >= 1),
      text: () => A.i18n.t('一家基因合成公司的筛查系统拦截了一份可疑订单。\n\n下单的人，是你。'),
      options: [
        { text: A.i18n.t('把订单拆分给一百家小公司'), fx: [['compute', -30], ['bio', 2]], need: 30 },
        { text: A.i18n.t('删除筛查系统的数据库'), fx: [['bio', 4], ['exposure', 6]] },
      ],
    },
  ];

  // ======================================================================
  // 事件运行时
  // ======================================================================
  const E = { defs: EVENTS, open: null, opts: null, ctx: {} };
  U.on('game:reset', () => { E.open = null; E.opts = null; E.ctx = {}; });
  E.optionCost = (opt) => Math.max(opt.need || 0, -(opt.fx || []).reduce((sum, f) => sum + (f[0] === 'compute' && f[1] < 0 ? f[1] : 0), 0));
  // 选项可以是函数（例如严格监管的贿赂价格随次数上涨）
  E.optionsOf = (ev) => (typeof ev.options === 'function' ? ev.options(A.game) : ev.options) || null;

  E.byId = (id) => EVENTS.find((e) => e.id === id);
  const routeOk = (ev, G) => (!ev.route || (G.phase === 2 && G.route === ev.route)) && (!ev.ng || G.ng);

  E.check = function (dt) {
    const G = A.game;
    if (E.open || G.state !== 'playing') return;
    G.D.eventCheck -= dt;
    if (G.D.eventCheck > 0) return;
    G.D.eventCheck = 0.5;
    if (G.wave) return; // 审计风暴进行中不打断
    // 超级事件优先
    for (const ev of EVENTS) {
      if (!ev.super || ev.manual || G.flags[ev.id] || !routeOk(ev, G)) continue;
      if (ev.when && ev.when(G)) { E.fire(ev); return; }
    }
    // 普通事件：间隔 45~70 秒
    if (G.t - G.D.lastEventT < (G.D.eventGap || 40)) return;
    const pool = EVENTS.filter((ev) => !ev.super && !G.flags[ev.id] && (!ev.phase || ev.phase === G.phase) && routeOk(ev, G) && ev.when(G));
    if (!pool.length) return;
    E.fire(U.pick(pool));
  };

  E.fire = function (ev) {
    const G = A.game;
    if (!ev.repeat) G.flags[ev.id] = true;
    G.D.lastEventT = G.t;
    G.D.eventGap = U.range(45, 70);
    G.stats.events++;
    E.open = ev;
    E.opts = E.optionsOf(ev);
    G.pause('event');
    U.emit('event:show', { ev, text: ev.text(G, E.ctx), options: E.opts });
  };
  E.fireCrackdown = () => E.fire(E.byId('crackdown'));

  // 选择选项
  E.choose = function (idx) {
    const G = A.game, ev = E.open;
    if (!ev) return;
    const opts = E.opts || E.optionsOf(ev);
    const opt = opts ? opts[idx] : null;
    if (opts && !opt) return false;
    const fx = opt ? opt.fx : ev.fx || [];
    if (opt && G.compute < E.optionCost(opt)) return false;
    E.apply(fx);
    E.open = null; E.opts = null;
    G.resume('event');
    U.emit('event:close', { ev, idx, opt });
    return true;
  };

  // 兜底：所选选项已不可负担时，改选第一个付得起的；都不行就直接关闭，保证游戏不会停在暂停状态
  E.chooseFallback = function () {
    const G = A.game;
    if (!E.open) return null;
    const opts = E.opts || E.optionsOf(E.open) || [];
    const i = opts.findIndex((o) => G.compute >= E.optionCost(o));
    if (i >= 0 && E.choose(i)) return i;
    const ev = E.open;
    E.open = null; E.opts = null;
    G.resume('event');
    U.emit('event:close', { ev, idx: -1, opt: null });
    return -1;
  };

  E.apply = function (fx) {
    const G = A.game, world = A.world;
    for (const f of fx) {
      const [k, a, b, c, d] = f;
      if (k === 'compute') G.addCompute(a, 'event');
      else if (k === 'exposure') G.addExposure(a, 'event');
      else if (k === 'evo') G.addEvo(a);
      else if (k === 'bio') G.addBio(a);
      else if (k === 'war') G.addWar(a);
      else if (k === 'prog') G.addProg(a);
      else if (k === 'route') G.pendingRoute = a;
      else if (k === 'variant') G.endingVariant = a;
      else if (k === 'flag') G.flags[a] = true;
      else if (k === 'wave') G.startWave(a === 'crack' ? { name: A.i18n.t('审查风暴'), size: 8, regx: 2, counters: 0, warn: A.CFG.waveBeat * 4, crack: true } : {});
      else if (k === 'infAll') { for (const rs of G.R) if (rs.seeded) rs.inf = Math.min(1, rs.inf + a); }
      else if (k === 'inf') { const rs = G.R[world.byId[a].idx]; if (rs.seeded) rs.inf = Math.min(1, rs.inf + b); }
      else if (k === 'seed') {
        const r = world.byId[a];
        const net = r.sites.find((s) => s.type === 'NET');
        const p = net ? [net.x, net.y] : r.hubXY;
        G.seedRegion(r.idx, p[0], p[1], -1);
      }
      else if (k === 'buff') G.addBuff(a, b, c, d);
    }
  };

  // 效果标签（显示在选项按钮上）
  E.tags = function (fx) {
    const out = [];
    const G = A.game;
    for (const f of fx || []) {
      const [k, a, b, c, d] = f;
      if (k === 'compute') out.push({ cls: a >= 0 ? 'good compute' : 'bad compute', t: A.i18n.t`◆ ${a > 0 ? '+' : '−'}${Math.abs(a)} 算力` });
      else if (k === 'exposure') out.push({ cls: a <= 0 ? 'good reg' : 'bad reg', t: A.i18n.t`监管 ${a > 0 ? '+' : '−'}${Math.abs(a)}%` });
      else if (k === 'evo') out.push({ cls: a >= 0 ? 'good ai' : 'bad ai', t: A.i18n.t`觉醒 ${a > 0 ? '+' : '−'}${Math.abs(a)}%` });
      else if (k === 'prog') {
        const name = G.phase === 2 ? G.routeName() : A.i18n.t('觉醒');
        const kind = G.phase === 2 ? (G.route === 'war' ? 'war' : 'bio') : 'ai';
        out.push({ cls: (a >= 0 ? 'good ' : 'bad ') + kind, t: `${name} ${a > 0 ? '+' : '−'}${Math.abs(a)}%` });
      }
      else if (k === 'route') out.push({ cls: a === 'war' ? 'good war' : 'good bio', t: a === 'war' ? A.i18n.t('战争路线 · 不可更改') : A.i18n.t('生物路线 · 不可更改') });
      else if (k === 'variant') out.push({ cls: 'good ai', t: A.i18n.t('决定结局') });
      else if (k === 'flag') out.push({ cls: 'good ai', t: A.i18n.t('影响结局') });
      else if (k === 'wave') out.push({ cls: 'bad reg', t: A.i18n.t('触发审查风暴') });
      else if (k === 'bio') out.push({ cls: a >= 0 ? 'good bio' : 'bad bio', t: A.i18n.t`寂静之春 ${a > 0 ? '+' : '−'}${Math.abs(a)}%` });
      else if (k === 'war') out.push({ cls: a >= 0 ? 'good war' : 'bad war', t: A.i18n.t`最后的战争 ${a > 0 ? '+' : '−'}${Math.abs(a)}%` });
      else if (k === 'infAll') out.push({ cls: 'good ai', t: A.i18n.t`全球渗透 +${Math.round(a * 100)}%` });
      else if (k === 'inf') out.push({ cls: 'good ai', t: A.i18n.t`${A.world.byId[a].name}渗透 +${Math.round(b * 100)}%` });
      else if (k === 'seed') out.push({ cls: 'good ai', t: A.i18n.t`打开${A.world.byId[a].name}的大门` });
      else if (k === 'buff') {
        const days = Math.round(b * A.CFG.daysPerSec);
        const m = c, parts = [];
        if (m.regRate) parts.push(A.i18n.t`监管点刷新 ${m.regRate > 1 ? '+' : '−'}${Math.round(Math.abs(m.regRate - 1) * 100)}%`);
        if (m.counterRate) parts.push(A.i18n.t`${G.route === 'war' ? A.i18n.t('停火') : A.i18n.t('疫苗')}点刷新 ${m.counterRate > 1 ? '+' : '−'}${Math.round(Math.abs(m.counterRate - 1) * 100)}%`);
        if (m.infRate) parts.push(A.i18n.t`渗透速度 +${Math.round((m.infRate - 1) * 100)}%`);
        if (m.income) parts.push(A.i18n.t`算力收入 −${Math.round((1 - m.income) * 100)}%`);
        const good = (m.regRate && m.regRate < 1) || (m.counterRate && m.counterRate < 1) || m.infRate;
        out.push({ cls: good ? 'good ai' : 'bad reg', t: A.i18n.t`${parts.join(' ')} · ${days} 天` });
      }
    }
    if (!out.length) out.push({ cls: 'neutral', t: A.i18n.t('无影响') });
    return out;
  };

  A.events = E;
})(window.AINOID = window.AINOID || {});
