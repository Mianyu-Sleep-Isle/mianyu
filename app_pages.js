(function buildCompleteApp(){
  const app=document.getElementById('app');
  if(!app||document.getElementById('homeView'))return;

  const iconPaths={
    home:'<path d="M3 11.5 12 4l9 7.5v8a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>',
    edit:'<path d="M4 20h4l11-11-4-4L4 16z"/><path d="m13.5 6.5 4 4"/>',
    archive:'<path d="M4 7h16v13H4z"/><path d="M3 4h18v3H3zM9 11h6"/>',
    user:'<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
    moon:'<path d="M20 15.5A8.5 8.5 0 1 1 8.5 4 7 7 0 0 0 20 15.5z"/>',
    bell:'<path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4"/>',
    message:'<path d="M4 5h16v11H8l-4 4z"/><path d="M8 9h8M8 12h5"/>',
    library:'<path d="M4 4h6v16H4zM14 4h6v16h-6z"/><path d="M7 8h0M17 8h0"/>',
    heart:'<path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8z"/>',
    play:'<path d="m8 5 11 7-11 7z"/>',
    chevron:'<path d="m9 18 6-6-6-6"/>',
    back:'<path d="m15 18-6-6 6-6"/>',
    shield:'<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="m9 12 2 2 4-4"/>',
    lock:'<rect x="4" y="10" width="16" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/>',
    child:'<circle cx="12" cy="8" r="3"/><path d="M6 21v-3a6 6 0 0 1 12 0v3M9 4l-2-2M15 4l2-2"/>',
    adult:'<circle cx="12" cy="7" r="4"/><path d="M5 21v-2a7 7 0 0 1 14 0v2"/>',
    check:'<path d="m5 12 4 4L19 6"/>',
    book:'<path d="M3 5a6 6 0 0 1 9 2v13a6 6 0 0 0-9-2zM21 5a6 6 0 0 0-9 2v13a6 6 0 0 1 9-2z"/>',
    breathe:'<path d="M4 12h5l2-7 3 14 2-7h4"/>',
    preset:'<path d="M4 4h16v16H4zM4 9h16M9 4v16"/>',
    star:'<path d="m12 2 3 6 6.5 1-4.7 4.6 1.1 6.4-5.9-3.1L6.1 20l1.1-6.4L2.5 9 9 8z"/>',
    gift:'<path d="M3 8h18v13H3zM2 5h20v3H2zM12 5v16M12 5H8.5A2.5 2.5 0 1 1 12 2.7zM12 5h3.5A2.5 2.5 0 1 0 12 2.7z"/>',
    privacy:'<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><circle cx="12" cy="11" r="2"/><path d="M12 13v3"/>',
    settings:'<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-2.8 2.8-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6v.2h-4V21a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1L4.2 17l.1-.1a1.7 1.7 0 0 0 .3-1.9A1.7 1.7 0 0 0 3 14H2.8v-4H3a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9L4.2 7 7 4.2l.1.1a1.7 1.7 0 0 0 1.9.3A1.7 1.7 0 0 0 10 3V2.8h4V3a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1L19.8 7l-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.6 1h.2v4H21a1.7 1.7 0 0 0-1.6 1z"/>',
    trash:'<path d="M3 6h18M8 6V3h8v3M6 6l1 15h10l1-15M10 10v7M14 10v7"/>',
    info:'<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7h.01"/>',
    clock:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    plus:'<path d="M12 5v14M5 12h14"/>',
    pause:'<path d="M8 5v14M16 5v14"/>'
  };
  function uiIcon(name,size){return '<svg class="app-icon '+(size||'')+'" viewBox="0 0 24 24" aria-hidden="true">'+(iconPaths[name]||iconPaths.star)+'</svg>'}
  const backBar=function(title,right){return '<header class="page-topbar"><button class="back-action" type="button" data-back aria-label="返回">'+uiIcon('back')+'</button><h1>'+title+'</h1>'+(right||'<span class="spacer"></span>')+'</header>'};

  const html=`
    <section class="view app-page onboarding-page" id="onboardingView" aria-label="首次使用设置">
      <div class="onboarding-shell">
        <div class="onboard-brand"><img src="assets/images/brand/app_icon.png" alt="眠屿图标"><div><strong>眠屿</strong><p class="app-subtitle">让今晚轻一点</p></div></div>
        <div class="onboard-progress" aria-label="设置进度"><i class="active"></i><i></i><i></i><i></i></div>
        <section class="onboard-step active" data-step="0">
          <div class="onboard-art" aria-hidden="true"><span class="ripple-orb"></span><span class="ripple-dot"></span></div>
          <h1>欢迎来到眠屿</h1><p class="app-subtitle">在声音里，慢慢安静下来</p>
          <div class="onboard-step-note">先选择使用模式，内容会随你的选择调整。</div>
          <div class="age-grid">
            <button class="age-card" type="button" data-age="adult"><span class="age-icon">${uiIcon('adult','lg')}</span><strong>成人模式</strong><span>完整的声音与已审核故事</span></button>
            <button class="age-card" type="button" data-age="child"><span class="age-icon">${uiIcon('child','lg')}</span><strong>儿童模式</strong><span>只显示儿童内容包，敏感入口需 PIN</span></button>
          </div>
          <div class="onboard-actions"><button class="app-primary full" id="onboardAgeNext" type="button" disabled>继续</button></div>
        </section>
        <section class="onboard-step" data-step="1">
          <h1>设置本机 PIN</h1><p class="app-subtitle" id="pinStepCopy">可选。用于保护年龄模式与受限内容入口，不会上传。</p>
          <div class="app-card"><div class="app-eyebrow">${uiIcon('lock','sm')} 本机保护</div><label for="onboardPin" class="choice-label">四位数字 PIN <small>可跳过</small></label><input class="pin-input" id="onboardPin" inputmode="numeric" maxlength="4" type="password" autocomplete="new-password" aria-describedby="pinHelp"><p id="pinHelp" style="margin:10px 0 0">PIN 不会以明文展示，也不会写入使用记录。</p></div>
          <div class="onboard-actions button-stack"><button class="app-primary full" id="onboardPinNext" type="button">继续</button><button class="text-link full" id="skipPin" type="button">暂不设置</button></div>
        </section>
        <section class="onboard-step" data-step="2">
          <h1>先说明一件重要的事</h1><p class="app-subtitle">眠屿提供低刺激声音、模板内容与使用记录，不进行睡眠监测。</p>
          <div class="app-card"><div class="app-eyebrow">${uiIcon('shield','sm')} 使用边界</div><h2>它不是医疗产品</h2><p>眠屿不能诊断失眠，也不会根据播放时间判断你是否入睡。需要专业帮助时，请咨询医生或心理健康专业人士。</p></div>
          <label class="consent-check"><input id="medicalConsent" type="checkbox"><span>我已阅读并理解以上非医疗说明。</span></label>
          <div class="onboard-actions"><button class="app-primary full" id="onboardConsentNext" type="button" disabled>确认并继续</button></div>
        </section>
        <section class="onboard-step" data-step="3">
          <h1>选一点今晚偏好</h1><p class="app-subtitle">这一步可以跳过，之后每次方案都仍然可以修改。</p>
          <div class="choice-group"><div class="choice-label">更喜欢的环境</div><div class="choice-list"><button class="choice-chip" type="button">细雨</button><button class="choice-chip" type="button">暖火</button><button class="choice-chip" type="button">森林</button><button class="choice-chip" type="button">安静室内</button></div></div>
          <div class="choice-group"><div class="choice-label">今晚想避开</div><div class="choice-list"><button class="choice-chip" type="button">人声</button><button class="choice-chip" type="button">远雷</button><button class="choice-chip" type="button">节奏声</button></div></div>
          <div class="onboard-actions button-stack"><button class="app-primary full" id="finishOnboarding" type="button">进入眠屿</button><button class="text-link full" id="skipPreferences" type="button">跳过偏好</button></div>
        </section>
      </div>
    </section>

    <section class="view app-page home-spatial" id="homeView" aria-label="眠屿首页">
      <div class="home-scene" aria-label="夜晚的眠屿小岛，房门、档案邮箱和设置长椅可点击探索">
        <div class="home-sky" aria-hidden="true"></div>
        <img class="home-atmosphere-layer" src="prototype_images/home_atmosphere_cutout_v1.png" alt="">
        <div class="home-island-stage">
          <img class="home-island-layer" src="prototype_images/home_island_cutout_v1.png" alt="眠屿夜晚小岛">
          <img class="home-door-open-overlay" src="prototype_images/home_door_open_overlay_v1.png" alt="" aria-hidden="true">
          <div class="home-island-hotspot home-door" id="homeDoor" role="button" tabindex="0" aria-label="打开编辑场景的门"><span class="home-object-label">编辑</span></div>
          <button class="home-island-hotspot home-mailbox" type="button" data-route="archiveView" aria-label="打开睡眠档案"><span class="home-object-label">档案</span></button>
          <button class="home-island-hotspot home-me" type="button" data-route="settingsView" aria-label="打开设置"><img class="home-settings-clock" src="prototype_images/home_settings_clock_v1.png" alt=""><span class="home-object-label">设置</span></button>
        </div>
        <header class="home-scene-header"><div class="home-brand"><img src="assets/images/brand/app_icon_circle.png" alt="眠屿图标"><strong>眠屿</strong></div></header>
        <div class="home-prompt">轻触岛上的物件，探索眠屿</div>
        <div class="home-interactions">
          <button class="home-hotspot home-plan" type="button" data-route="conversationView" aria-label="开始沟通"></button>
          <button class="home-hotspot home-content" type="button" data-route="contentView" aria-label="探索助眠内容"></button>
          <span class="home-door-hint" aria-hidden="true">轻触门，进入声景编辑</span>
        </div>
        <section class="home-plan-sheet home-chat-sheet" aria-label="AI 沟通"><div class="home-plan-heading"><span class="home-plan-icon">${uiIcon('message','sm')}</span><h2>晚上好，我在这里</h2></div><div class="home-plan-main"><div><h3>今晚想聊些什么？</h3><p>告诉我此刻的感受，一起找到适合今晚的陪伴。</p></div><button class="home-plan-cta" type="button" data-route="conversationView">开始沟通 ${uiIcon('chevron','sm')}</button></div><div class="home-plan-links"><button type="button" data-route="contentView">${uiIcon('library','sm')}探索助眠内容 ${uiIcon('chevron','sm')}</button></div></section>
      </div>
    </section>

    <section class="view app-page with-back" id="conversationView" aria-label="开始沟通">
      ${backBar('开始沟通')}
      <div class="conversation-hero page-hero-art" aria-hidden="true"><span class="wave-ribbon wave-one"></span><span class="wave-ribbon wave-two"></span><span class="warm-orb"></span></div>
      <div class="app-eyebrow">今晚，把自己交给温柔</div><h1>今晚感觉怎么样？</h1><p class="app-subtitle">告诉我们此刻的状态，为你生成专属的陪伴。</p>
      <div class="mode-segment" id="composeMode"><button class="active" type="button" data-compose-mode="choices">点选</button><button type="button" data-compose-mode="sentence">说一句</button></div>
      <section class="sentence-composer app-card hidden" id="sentenceComposer"><label class="choice-label" for="sentenceInput">用一句话说说今晚 <small>不会公开</small></label><textarea class="app-textarea" id="sentenceInput" placeholder="例如：明天有考试，只想听十五分钟雨声"></textarea></section>
      <section class="app-card questionnaire-card" id="choiceComposer">
        <div class="questionnaire-row"><div class="choice-label"><span class="question-mark">01</span><span>今晚情绪<small>此刻的心情是？</small></span></div><div class="choice-list" data-choice-group><button class="choice-chip selected">平静</button><button class="choice-chip">有点烦</button><button class="choice-chip">很累</button></div></div>
        <div class="questionnaire-row"><div class="choice-label"><span class="question-mark">02</span><span>需要人声<small>你希望听到人声吗？</small></span></div><div class="choice-list" data-choice-group><button class="choice-chip">需要</button><button class="choice-chip selected">都可以</button><button class="choice-chip">不要</button></div></div>
        <div class="questionnaire-row"><div class="choice-label"><span class="question-mark">03</span><span>不想听到<small>有哪些声音想避开？</small></span></div><div class="choice-list" data-choice-group><button class="choice-chip selected">水声</button><button class="choice-chip">风声</button><button class="choice-chip">人声</button></div></div>
        <div class="questionnaire-row"><div class="choice-label"><span class="question-mark">04</span><span>预计使用<small>你打算听多久？</small></span></div><div class="choice-list" data-choice-group><button class="choice-chip">10 分钟</button><button class="choice-chip">20 分钟</button><button class="choice-chip selected">30 分钟</button></div></div>
      </section>
      <section class="app-section"><div class="app-section-head"><h2>为你推荐</h2><span class="section-hint">快速开始</span></div><div class="preset-list preset-cards" data-preset-list><button class="preset-sentence"><span class="preset-art calm"></span><span><strong>快速安静</strong><small>让思绪慢慢沉下来</small></span></button><button class="preset-sentence"><span class="preset-art companion"></span><span><strong>有人陪伴</strong><small>温柔的人声在身边</small></span></button><button class="preset-sentence compact">赶作业，想听雨，不要打雷。</button><button class="preset-sentence compact">明天考试，只剩十五分钟。</button></div></section>
      <section class="app-section"><button class="app-primary full" id="generatePlan" type="button">生成今晚方案</button></section>
      <article class="app-card plan-card hidden" id="generatedPlan"><div class="plan-head"><div><div class="app-eyebrow">已为你整理</div><h2>纯声景</h2></div><span class="source-tag" id="planSourceLabel">规则建议</span></div><p class="plan-reason" id="generatedReason">保留小雨和室内暖声，并按你的禁忌排除远雷。</p><div class="plan-meta"><span class="soft-tag">30 分钟</span><span class="soft-tag">最后 5 分钟渐弱</span></div><div class="track-row"><span class="track-pill">小雨</span><span class="track-pill">壁炉</span><span class="track-pill">室内底噪</span></div><div class="button-stack" style="margin-top:16px"><button class="app-primary full" id="confirmPlan" type="button">确认并开始</button><div class="button-row"><button class="app-secondary" type="button" data-route="sceneView">去房间预览</button><button class="app-tonal" id="regeneratePlan" type="button">重新生成</button></div></div></article>
    </section>

    <section class="view app-page with-back" id="contentView" aria-label="内容中心">
      ${backBar('内容中心','<button class="icon-action" type="button" data-content-tab="收藏" aria-label="查看收藏">'+uiIcon('heart')+'</button>')}
      <div class="content-intro"><div><div class="app-eyebrow">低刺激内容库</div><h1>找到今晚需要的声音</h1></div><span class="content-intro-orb" aria-hidden="true"></span></div>
      <nav class="content-tabs" aria-label="内容分类"><button class="content-tab active" data-content="声音">声音</button><button class="content-tab" data-content="故事">故事</button><button class="content-tab" data-content="呼吸">呼吸</button><button class="content-tab" data-content="预设">预设</button><button class="content-tab" data-content="收藏">收藏</button></nav>
      <div class="content-list" id="contentList"></div>
    </section>

    <section class="view app-page with-back" id="detailView" aria-label="内容详情">
      ${backBar('故事详情','<button class="icon-action" type="button" id="favoriteStory" aria-label="收藏月光邮局">'+uiIcon('heart')+'</button>')}
      <div class="detail-cover letter-cover" aria-hidden="true"><div class="letter-fold"><span></span></div><i class="letter-light"></i></div>
      <section class="detail-copy"><div class="app-eyebrow">轻声故事 · 12 分钟 · 成人</div><h1>月光邮局</h1><p class="app-subtitle">一封写给夜晚的信，陪你把今天轻轻放下。</p></section>
      <section class="app-card audio-preview"><button class="audio-play" id="previewStory" type="button" aria-label="试听月光邮局">${uiIcon('play')}</button><div class="audio-wave" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i></div><time>00:00 / 12:00</time></section>
      <div class="button-stack app-section"><button class="app-primary full" id="addStoryToPlan" type="button">加入今晚方案 ${uiIcon('chevron','sm')}</button><button class="app-secondary full" id="secondaryPreviewStory" type="button">${uiIcon('play','sm')} 试听</button></div>
      <div class="non-medical">模板故事内容，不代表真人实时陪伴。</div>
    </section>

    <section class="view app-page with-back" id="archiveView" aria-label="睡眠档案">
      ${backBar('睡眠档案','<button class="icon-action" type="button" data-route="pointsView" aria-label="查看积分">'+uiIcon('gift')+'</button>')}
      <section class="next-feedback-card app-card" id="nextFeedbackCard" aria-labelledby="nextFeedbackTitle">
        <div class="next-feedback-glow" aria-hidden="true"><i></i><span></span></div>
        <div class="next-feedback-copy"><div class="app-eyebrow"><span class="feedback-state-dot"></span><span id="feedbackStateLabel">待完成 · 约 30 秒</span></div><h2 id="nextFeedbackTitle">昨晚的声音，等你留一句感受</h2><p id="nextFeedbackCopy">三项轻问会更新你的偏好，但不会把播放时长当作睡眠结果。</p></div>
        <button class="next-feedback-action" id="nextFeedbackAction" type="button" data-route="feedbackView">填写次日反馈 ${uiIcon('chevron','sm')}</button>
      </section>
      <section class="app-section growth-section" id="growthSection" aria-labelledby="growthTitle">
        <div class="app-section-head"><h2 id="growthTitle">个性化成长</h2><button type="button" data-route="pointsView"><span id="growthPointsLabel">120 积分</span> ${uiIcon('chevron','sm')}</button></div>
        <div class="growth-overview app-card">
          <div class="growth-orbit" aria-hidden="true"><span></span><i></i><i></i><i></i></div>
          <div class="growth-copy"><strong id="growthHeadline">已从 6 次反馈中了解你</strong><p id="growthDescription">明确选择会影响下一次方案；每晚的新选择始终优先。</p><div class="preference-chips" id="preferenceChips"><span>偏爱 · 小雨与暖火</span><span>人声 · 都可以</span><span>避开 · 远雷</span></div></div>
          <div class="growth-steps" aria-label="个性化成长方式"><span class="done">明确反馈</span><i></i><span class="done">更新偏好</span><i></i><span>用于下次方案</span></div>
        </div>
      </section>
      <div class="archive-period" role="group" aria-label="选择统计周期"><button class="active" type="button">近 7 天</button><button type="button">近 30 天</button></div>
      <section class="app-card trend-card"><div class="app-section-head"><div><h2>主观舒适度趋势</h2><p>基于每日反馈，不涉及医学测量</p></div><span class="source-tag subjective">主观反馈</span></div><div class="trend-line" aria-label="近七天主观舒适度呈温和上升趋势"><span></span><i style="--x:3%;--y:74%"></i><i style="--x:19%;--y:64%"></i><i style="--x:36%;--y:58%"></i><i style="--x:52%;--y:47%"></i><i style="--x:68%;--y:39%"></i><i style="--x:84%;--y:29%"></i><i style="--x:97%;--y:18%"></i></div><div class="trend-days"><span>周五</span><span>周六</span><span>周日</span><span>周一</span><span>周二</span><span>周三</span><span>周四</span></div></section>
      <section class="app-section"><div class="app-section-head"><h2>最近记录</h2><button type="button" data-route="feedbackView">填写反馈</button></div><div class="archive-records">
        <article class="archive-entry app-card"><span class="record-dot warm"></span><div><time>9 月 18 日</time><h3>播放 15 分钟 · 声音舒服</h3><p>“今晚感觉比较放松，心情也平静了很多。”</p><div class="entry-tags"><span class="source-tag subjective">主观反馈</span></div></div>${uiIcon('chevron')}</article>
        <article class="archive-entry app-card"><span class="record-dot cool"></span><div><time>9 月 17 日</time><h3>播放 20 分钟</h3><p>睡前听了一会儿，应用没有判断你是否入睡。</p><div class="entry-tags"><span class="source-tag">播放记录</span><span class="source-tag inferred">推测（非测量）</span></div></div>${uiIcon('chevron')}</article>
      </div></section>
      <footer class="non-medical">眠屿不是医疗产品，不能诊断失眠。</footer>
    </section>

    <section class="view app-page with-back" id="feedbackView" aria-label="次日反馈">
      ${backBar('次日反馈')}
      <div class="feedback-dawn" aria-hidden="true"><i></i><span></span></div>
      <div id="feedbackForm">
        <div class="app-eyebrow"><span class="source-tag subjective">主观反馈</span><span class="feedback-session">昨晚 · 15 分钟方案</span></div><h1>昨晚感觉怎么样？</h1><p class="app-subtitle">你的感受很重要，帮助我们为你带来更合适的陪伴。</p>
        <section class="feedback-question app-card"><h3>是否容易入睡？</h3><p>回想昨晚躺下后的感受</p><div class="feedback-options" data-feedback="sleep"><button class="feedback-option">容易</button><button class="feedback-option">一般</button><button class="feedback-option">不容易</button></div></section>
        <section class="feedback-question app-card"><h3>声音是否舒服？</h3><p>整体听下来的感受</p><div class="feedback-options" data-feedback="sound"><button class="feedback-option">舒服</button><button class="feedback-option">还可以</button><button class="feedback-option">不舒服</button></div></section>
        <section class="feedback-question app-card"><h3>还要不要人声？</h3><p>未来的陪伴中，你更希望</p><div class="feedback-options" data-feedback="voice"><button class="feedback-option">想要</button><button class="feedback-option">都可以</button><button class="feedback-option">不要</button></div></section>
        <section class="feedback-question"><label class="choice-label" for="feedbackNote">补充一句 <small>可选</small></label><textarea class="app-textarea" id="feedbackNote" maxlength="100" placeholder="例如：雨声可以再轻一点"></textarea><div class="feedback-counter"><span id="feedbackCount">0</span>/100</div></section>
        <button class="app-primary full app-section" id="submitFeedback" type="button">提交反馈 ${uiIcon('chevron','sm')}</button><p class="feedback-note">只根据你的明确选择更新偏好，不推测是否入睡</p>
      </div>
      <section class="feedback-result app-card hidden" id="feedbackResult" tabindex="-1" aria-live="polite" aria-labelledby="feedbackResultTitle">
        <div class="feedback-result-mark">${uiIcon('check')}</div><div class="app-eyebrow">反馈已记入成长档案</div><h1 id="feedbackResultTitle">谢谢你告诉我们</h1><p>下一次生成方案时，会优先参考这次选择。</p>
        <div class="feedback-result-change"><span>本次偏好变化</span><div id="feedbackResultTags"></div></div>
        <div class="feedback-reward"><span class="mark">${uiIcon('star')}</span><span><strong>成长积分 +5</strong><small>鼓励完成反馈，不评价睡眠好坏</small></span></div>
        <button class="app-primary full" type="button" data-route="archiveView">查看个性化成长 ${uiIcon('chevron','sm')}</button>
      </section>
      <footer class="non-medical">眠屿不是医疗产品，不能诊断失眠。</footer>
    </section>

    <section class="view app-page with-back" id="pointsView" aria-label="积分">
      ${backBar('眠屿积分')}
      <section class="app-card points-hero"><div><div class="app-eyebrow">当前积分</div><div class="points-balance" id="pointsBalance">120</div><p>小小的积累，会带来更好的自己</p></div><div class="points-orbit" aria-hidden="true"><i></i><i></i><i></i></div></section>
      <section class="app-section"><div class="app-section-head"><h2>获取积分</h2><span class="section-hint">简单的行动，值得被记录</span></div><div class="points-rule-grid"><article class="app-card"><span class="mark">${uiIcon('star')}</span><strong>按计划开始</strong><b>+10</b><small>完成计划并开始执行</small></article><article class="app-card"><span class="mark">${uiIcon('star')}</span><strong>提交反馈</strong><b>+5</b><small>完成当天的主观反馈</small></article></div></section>
      <section class="app-section app-card"><div class="app-section-head"><h2>积分记录</h2><span class="section-hint">最近记录</span></div><div class="points-list"><div class="points-row"><span class="mark">${uiIcon('star')}</span><span>今日 · 提交反馈<small>完成当天的反馈</small></span><b>+5</b></div><div class="points-row"><span class="mark">${uiIcon('star')}</span><span>昨天 · 按计划开始<small>完成计划并开始执行</small></span><b>+10</b></div><div class="points-row spent"><span class="mark">${uiIcon('star')}</span><span>9 月 16 日 · 使用积分<small>兑换专属陪伴</small></span><b>-20</b></div></div></section>
      <div class="non-medical">积分只鼓励完成计划与反馈，不评价睡眠好坏。</div>
    </section>

    <section class="view app-page with-back" id="settingsView" aria-label="设置">
      ${backBar('设置')}
      <section class="settings-group app-card"><h2>账户与使用</h2><div class="settings-list"><button class="setting-row" type="button" id="ageModeRow"><span class="setting-icon">${uiIcon('adult')}</span><span class="setting-copy"><strong>使用模式</strong><small>成人与儿童内容过滤</small></span><span class="setting-value">成人模式</span><span class="chevron">${uiIcon('chevron')}</span></button><button class="setting-row" type="button" id="pinRow"><span class="setting-icon">${uiIcon('lock')}</span><span class="setting-copy"><strong>儿童 PIN</strong><small>保护受限内容入口</small></span><span class="setting-value">未设置</span><span class="chevron">${uiIcon('chevron')}</span></button></div></section>
      <section class="settings-group app-card"><h2>体验设置</h2><div class="settings-list"><div class="setting-row"><span class="setting-icon">${uiIcon('bell')}</span><span class="setting-copy"><strong>通知</strong><small>计划与反馈提醒</small></span><button class="app-switch on" type="button" role="switch" aria-checked="true" aria-label="通知"></button></div><div class="setting-row"><span class="setting-icon">${uiIcon('breathe')}</span><span class="setting-copy"><strong>减少动态效果</strong><small>降低不必要的界面动效</small></span><button class="app-switch" type="button" role="switch" aria-checked="false" aria-label="减少动态效果"></button></div><div class="setting-row"><span class="setting-icon">${uiIcon('moon')}</span><span class="setting-copy"><strong>夜间亮度</strong><small>跟随设备设置</small></span><span class="setting-value">跟随系统</span><span class="chevron">${uiIcon('chevron')}</span></div></div></section>
      <section class="settings-group app-card"><h2>安全与说明</h2><div class="settings-list"><button class="setting-row" type="button" data-route="privacyView"><span class="setting-icon">${uiIcon('privacy')}</span><span class="setting-copy"><strong>隐私中心</strong></span><span class="chevron">${uiIcon('chevron')}</span></button><button class="setting-row" type="button" id="aboutRow"><span class="setting-icon">${uiIcon('info')}</span><span class="setting-copy"><strong>关于眠屿</strong></span><span class="chevron">${uiIcon('chevron')}</span></button><button class="setting-row" type="button" id="medicalInfoRow"><span class="setting-icon">${uiIcon('shield')}</span><span class="setting-copy"><strong>非医疗说明</strong></span><span class="chevron">${uiIcon('chevron')}</span></button></div></section>
      <p class="app-version">版本 1.0.0</p>
      <footer class="non-medical">眠屿不是医疗产品，不能诊断失眠。</footer>
    </section>

    <section class="view app-page with-back" id="privacyView" aria-label="隐私中心">
      ${backBar('隐私中心')}
      <div class="privacy-hero"><div><div class="app-eyebrow">默认最少授权</div><h1>守护你的<br>安心与自在</h1><p class="app-subtitle">清晰的选择，让好睡眠更安心。</p></div><div class="privacy-emblem" aria-hidden="true"><i></i></div></div>
      <section class="app-section settings-group app-card"><h2>数据授权</h2><p>管理眠屿可以处理的数据类型</p><div class="settings-list"><div class="setting-row"><span class="setting-copy"><strong>对话相关</strong><small>用于提供个性化体验</small></span><button class="app-switch" type="button" role="switch" aria-checked="false" aria-label="对话相关授权"></button></div><div class="setting-row"><span class="setting-copy"><strong>播放摘要</strong><small>用于生成收听记录摘要</small></span><button class="app-switch on" type="button" role="switch" aria-checked="true" aria-label="播放摘要授权"></button></div><div class="setting-row"><span class="setting-copy"><strong>噪声摘要</strong><small>不保存原始录音，默认关闭</small></span><button class="app-switch" type="button" role="switch" aria-checked="false" aria-label="噪声摘要授权"></button></div><div class="setting-row"><span class="setting-copy"><strong>设备摘要</strong><small>设备类型与应用版本，默认关闭</small></span><button class="app-switch" type="button" role="switch" aria-checked="false" aria-label="设备摘要授权"></button></div></div><div class="privacy-hint">${uiIcon('info','sm')} 敏感权限默认关闭，可随时撤回</div></section>
      <section class="privacy-actions"><button class="app-tonal" id="revokePermissions" type="button">撤回全部授权</button><button class="danger-button" id="eraseData" type="button">${uiIcon('trash','sm')} 删除本机数据</button></section>
      <div class="cleanup-status">${uiIcon('check','sm')}<span><strong>最近清理：已完成</strong><small>失败时可重试，不影响基础使用</small></span></div>
      <footer class="non-medical">眠屿不是医疗产品，不能诊断失眠。</footer>
    </section>

    <nav class="app-bottom-nav hidden" id="appBottomNav" aria-label="主要导航"><button type="button" data-main-route="homeView" class="active">${uiIcon('home')}<span>眠屿</span></button><button type="button" data-main-route="sceneView">${uiIcon('edit')}<span>编辑</span></button><button type="button" data-main-route="archiveView">${uiIcon('archive')}<span>档案</span></button><button type="button" data-main-route="settingsView">${uiIcon('settings')}<span>设置</span></button></nav>

    <div class="dialog-scrim" id="appDialog" role="dialog" aria-modal="true" aria-labelledby="dialogTitle"><div class="app-dialog"><h2 id="dialogTitle">确认操作</h2><p id="dialogMessage"></p><div class="button-row"><button class="app-tonal" id="dialogCancel" type="button">取消</button><button class="app-primary" id="dialogConfirm" type="button">确认</button></div></div></div>
  `;
  app.insertAdjacentHTML('beforeend',html);

  const nav=document.getElementById('appBottomNav');
  const routeHistory=[];
  const mainRoutes=new Set(['homeView','archiveView','settingsView']);
  let currentView='onboardingView';
  function setMainNav(route){
    nav.querySelectorAll('[data-main-route]').forEach(function(button){button.classList.toggle('active',button.dataset.mainRoute===route)});
  }
  function navigate(route,push){
    if(!document.getElementById(route))return;
    if(push!==false&&currentView&&currentView!==route)routeHistory.push(currentView);
    document.querySelectorAll('.view').forEach(function(view){view.classList.toggle('active',view.id===route)});
    currentView=route;
    window.scrollTo(0,0);
    nav.classList.toggle('hidden',route==='homeView'||route==='archiveView'||route==='settingsView'||!mainRoutes.has(route));
    if(mainRoutes.has(route))setMainNav(route);
    const view=document.getElementById(route); if(view)view.scrollTop=0;
    if(route==='sceneView'){setEditing(true)}
    if(route==='homeView'){
      document.getElementById('homeView').classList.remove('door-opening');
      window.requestAnimationFrame(syncHomeInteractionFrame);
    }
  }
  function goBack(){
    let route=routeHistory.pop()||'homeView';
    if(route==='sceneView'||route==='sleepView'||route==='onboardingView')route='homeView';
    navigate(route,false);
  }
  window.navigateMianyu=navigate;
  document.addEventListener('click',function(event){
    const door=event.target.closest('[data-home-door]');
    if(door){return}
    const routeButton=event.target.closest('[data-route]');
    if(routeButton){navigate(routeButton.dataset.route);if(routeButton.dataset.contentTab)setContentTab(routeButton.dataset.contentTab);return}
    const backButton=event.target.closest('[data-back]'); if(backButton){goBack();return}
    const mainButton=event.target.closest('[data-main-route]'); if(mainButton){navigate(mainButton.dataset.mainRoute);return}
  });

  function openHomeDoor(){
    const home=document.getElementById('homeView');
    if(!home||!home.classList.contains('active'))return;
    if(home.classList.contains('door-opening'))return;
    home.classList.add('door-opening');
    window.setTimeout(function(){navigate('sceneView')},520);
  }
  const homeDoor=document.getElementById('homeDoor');
  if(homeDoor){homeDoor.dataset.homeDoor='true';homeDoor.addEventListener('click',openHomeDoor);homeDoor.addEventListener('keydown',function(event){if(event.key==='Enter'||event.key===' '){event.preventDefault();openHomeDoor()}})}
  function syncHomeInteractionFrame(){
    const scene=document.querySelector('.home-scene');
    const frame=document.querySelector('.home-interactions');
    if(!scene||!frame)return;
    const rect=scene.getBoundingClientRect();
    frame.style.width=rect.width+'px';frame.style.height=rect.height+'px';frame.style.left='0px';frame.style.top='0px';
  }
  syncHomeInteractionFrame();
  window.addEventListener('resize',syncHomeInteractionFrame);

  let onboardStep=0,onboardAge='',settingsAge='adult',pinConfigured=false;
  function setOnboardStep(step){onboardStep=step;document.querySelectorAll('.onboard-step').forEach(function(el){el.classList.toggle('active',Number(el.dataset.step)===step)});document.querySelectorAll('.onboard-progress i').forEach(function(el,index){el.classList.toggle('active',index<=step)})}
  document.querySelectorAll('[data-age]').forEach(function(button){button.addEventListener('click',function(){onboardAge=button.dataset.age;document.querySelectorAll('[data-age]').forEach(function(x){x.classList.toggle('selected',x===button)});document.getElementById('onboardAgeNext').disabled=false;document.getElementById('pinStepCopy').textContent=onboardAge==='child'?'儿童模式建议设置 PIN，用于保护受限内容入口。':'PIN 可选，用于保护年龄模式与隐私入口。'})});
  document.getElementById('onboardAgeNext').addEventListener('click',function(){setOnboardStep(1)});
  document.getElementById('onboardPinNext').addEventListener('click',function(){pinConfigured=/^\d{4}$/.test(document.getElementById('onboardPin').value);setOnboardStep(2)});
  document.getElementById('skipPin').addEventListener('click',function(){document.getElementById('onboardPin').value='';setOnboardStep(2)});
  document.getElementById('medicalConsent').addEventListener('change',function(event){document.getElementById('onboardConsentNext').disabled=!event.target.checked});
  document.getElementById('onboardConsentNext').addEventListener('click',function(){setOnboardStep(3)});
  function finishOnboarding(){settingsAge=onboardAge||'adult';const modeValue=document.querySelector('#ageModeRow .setting-value');if(modeValue)modeValue.textContent=settingsAge==='adult'?'成人模式':'儿童模式';const sentenceButton=document.querySelector('[data-compose-mode="sentence"]');sentenceButton.hidden=settingsAge==='child'&&!pinConfigured;if(sentenceButton.hidden){document.querySelector('[data-compose-mode="choices"]').click()}navigate('homeView',false);showToast('设置已保存，可以随时修改')}
  document.getElementById('finishOnboarding').addEventListener('click',finishOnboarding);document.getElementById('skipPreferences').addEventListener('click',finishOnboarding);
  document.querySelectorAll('.onboard-step .choice-chip').forEach(function(button){button.addEventListener('click',function(){button.classList.toggle('selected')})});

  document.querySelectorAll('[data-choice-group]').forEach(function(group){group.querySelectorAll('.choice-chip').forEach(function(button){button.addEventListener('click',function(){group.querySelectorAll('.choice-chip').forEach(function(x){x.classList.toggle('selected',x===button)})})})});
  document.querySelectorAll('[data-compose-mode]').forEach(function(button){button.addEventListener('click',function(){if(button.hidden)return;document.querySelectorAll('[data-compose-mode]').forEach(function(x){x.classList.toggle('active',x===button)});const sentence=button.dataset.composeMode==='sentence';document.getElementById('sentenceComposer').classList.toggle('hidden',!sentence);document.getElementById('choiceComposer').classList.toggle('hidden',sentence)})});
  document.querySelectorAll('[data-preset-list] .preset-sentence').forEach(function(button,index){button.addEventListener('click',function(){document.querySelectorAll('[data-preset-list] .preset-sentence').forEach(function(x){x.classList.toggle('selected',x===button)});const reasons=['保留小雨和室内暖声，并按你的禁忌排除远雷。','使用十五分钟短方案，以室内底噪和轻键盘为主。','只保留环境声，不加入任何故事或人声。','加入已审核模板故事，并用小雨与室内底噪托住声音。'];document.getElementById('generatedReason').textContent=reasons[index]})});
  function generatePlan(){const button=document.getElementById('generatePlan');button.disabled=true;button.innerHTML='生成中 <span class="loading-dots"><i></i><i></i><i></i></span>';setTimeout(function(){button.disabled=false;button.textContent='重新整理方案';document.getElementById('generatedPlan').classList.remove('hidden');document.getElementById('generatedPlan').scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth',block:'start'});showToast('已使用规则建议生成方案')},650)}
  document.getElementById('generatePlan').addEventListener('click',generatePlan);document.getElementById('regeneratePlan').addEventListener('click',generatePlan);
  document.getElementById('confirmPlan').addEventListener('click',function(){startSleep();document.getElementById('sleepMessage').textContent='声音正在慢慢变小';nav.classList.add('hidden');currentView='sleepView'});
  const homeStartSleep=document.getElementById('homeStartSleep');
  if(homeStartSleep)homeStartSleep.addEventListener('click',function(){navigate('conversationView')});

  const contentData={
    '声音':[
      {name:'壁炉',meta:'室内 · 温暖火声',art:'fireplace',action:'试听'},
      {name:'小雨',meta:'户外 · 轻柔雨声',art:'rain',action:'试听'},
      {name:'夜晚森林',meta:'户外 · 林间夜声',art:'forest',action:'试听'},
      {name:'远雷',meta:'户外 · 低沉远雷',art:'thunder',action:'试听'},
      {name:'翻书声',meta:'室内 · 轻缓翻页',art:'bookturn',action:'试听'},
      {name:'轻键盘',meta:'室内 · 低声敲击',art:'keyboard',action:'试听'},
      {name:'被子摩擦',meta:'室内 · 柔软织物声',art:'blanket',action:'试听'},
      {name:'室内底噪',meta:'室内 · 稳定环境声',art:'roomtone',action:'试听'}
    ],
    '故事':[
      {name:'窗边听雨',meta:'成人故事 · 4 分钟',art:'story-rain-window',image:'assets/images/content/adult_rain_window.png',action:'详情',detail:true},
      {name:'静室入夜',meta:'成人故事 · 9 分钟',art:'story-quiet-room',image:'assets/images/content/adult_quiet_room.png',action:'详情',detail:true},
      {name:'暖茶时光',meta:'成人故事 · 4 分钟',art:'story-warm-tea',image:'assets/images/content/adult_warm_tea.png',action:'详情',detail:true},
      {name:'星星和小毯子',meta:'儿童故事 · 5 分钟',art:'story-star-blanket',image:'assets/images/content/child_star_blanket.png',action:'详情',detail:true},
      {name:'小小花园的晚安',meta:'儿童故事 · 4 分钟',art:'story-small-garden',image:'assets/images/content/child_small_garden.png',action:'详情',detail:true}
    ],
    '呼吸':[{name:'睡前两分钟呼吸',meta:'呼吸训练 · 2 分钟',art:'breath-relax',image:'assets/images/content/breath_relax.png',action:'详情',detail:true}],
    '预设':[{name:'暖火与细雨',meta:'壁炉 + 小雨 · 可继续修改',art:'fireplace',action:'查看'},{name:'林间留白',meta:'夜晚森林 + 室内底噪',art:'forest',action:'查看'}],
    '收藏':[{name:'小雨',meta:'声音 · 已收藏',art:'rain',action:'试听'},{name:'月光邮局',meta:'模板故事 · 已收藏',art:'letter',action:'详情',detail:true},{name:'壁炉',meta:'声音 · 已收藏',art:'fireplace',action:'试听'}]
  };
  function renderContent(tabName){const list=document.getElementById('contentList');const items=contentData[tabName]||[];list.innerHTML=items.map(function(item){const ageBlocked=settingsAge==='child'&&item.meta.includes('成人');const disabled=item.disabled||ageBlocked;const meta=ageBlocked?'当前是儿童内容包，需要 PIN 才能打开':item.meta;const art=item.image?'<img src="'+item.image+'" alt="" loading="lazy">':'<i></i><i></i><i></i>';return '<article class="content-item '+(disabled?'disabled':'')+'"><div class="content-art art-'+(item.art||'echo')+'" aria-hidden="true">'+art+'</div><div class="content-item-copy"><h3>'+item.name+'</h3><p>'+meta+'</p></div><button class="content-action" type="button" '+(disabled?'disabled':'')+' data-content-name="'+item.name+'" data-detail="'+(item.detail?'1':'0')+'" aria-label="'+(ageBlocked?'需要 PIN 才能打开':item.action)+item.name+'">'+(disabled?uiIcon('lock'):item.action==='试听'?uiIcon('play'):uiIcon('chevron'))+'</button></article>'}).join('');list.querySelectorAll('[data-content-name]').forEach(function(button){button.addEventListener('click',function(){if(button.disabled)return;if(button.dataset.detail==='1')navigate('detailView');else showToast(button.dataset.contentName+(button.getAttribute('aria-label').includes('试听')?' 正在试听':' 已载入'))})})}
  function setContentTab(name){document.querySelectorAll('[data-content]').forEach(function(button){button.classList.toggle('active',button.dataset.content===name)});renderContent(name)}
  document.querySelectorAll('[data-content]').forEach(function(button){button.addEventListener('click',function(){setContentTab(button.dataset.content)})});document.querySelectorAll('[data-content-tab]').forEach(function(button){button.addEventListener('click',function(){setContentTab(button.dataset.contentTab)})});renderContent('声音');
  function toggleStoryPreview(button){const active=button.classList.toggle('playing');button.innerHTML=active?uiIcon('pause','sm')+' 停止试听':uiIcon('play','sm')+' 试听'}
  document.getElementById('previewStory').addEventListener('click',function(event){toggleStoryPreview(event.currentTarget)});document.getElementById('secondaryPreviewStory').addEventListener('click',function(event){toggleStoryPreview(event.currentTarget)});document.getElementById('favoriteStory').addEventListener('click',function(event){event.currentTarget.innerHTML=uiIcon('check');event.currentTarget.setAttribute('aria-label','已收藏月光邮局');showToast('已加入收藏')});document.getElementById('addStoryToPlan').addEventListener('click',function(){showToast('月光邮局已加入今晚方案')});

  document.querySelectorAll('[data-feedback]').forEach(function(group){group.querySelectorAll('.feedback-option').forEach(function(button){button.addEventListener('click',function(){group.querySelectorAll('.feedback-option').forEach(function(x){x.classList.toggle('selected',x===button)})})})});
  const feedbackNote=document.getElementById('feedbackNote');
  feedbackNote.addEventListener('input',function(){document.getElementById('feedbackCount').textContent=String(feedbackNote.value.length)});
  document.getElementById('submitFeedback').addEventListener('click',function(event){
    const groups=[...document.querySelectorAll('[data-feedback]')];
    const complete=groups.every(function(group){return group.querySelector('.selected')});
    if(!complete){showToast('请先完成三项选择');return}
    const answers={};
    groups.forEach(function(group){answers[group.dataset.feedback]=group.querySelector('.selected').textContent.trim()});
    const resultTags=[
      '入睡感受 · '+answers.sleep,
      answers.sound==='不舒服'?'下次降低声音层次':'声景感受 · '+answers.sound,
      '人声偏好 · '+answers.voice
    ];
    document.getElementById('feedbackResultTags').innerHTML=resultTags.map(function(tag){return '<span>'+tag+'</span>'}).join('');
    document.getElementById('feedbackForm').classList.add('hidden');
    document.getElementById('feedbackResult').classList.remove('hidden');
    document.getElementById('pointsBalance').textContent='125';
    document.getElementById('growthPointsLabel').textContent='125 积分';
    document.getElementById('growthHeadline').textContent='已从 7 次反馈中了解你';
    document.getElementById('growthDescription').textContent='刚刚的选择已记录，今晚的新选择仍会始终优先。';
    document.getElementById('preferenceChips').innerHTML=resultTags.slice(1).map(function(tag){return '<span>'+tag+'</span>'}).join('')+'<span>避开 · 远雷</span>';
    document.querySelectorAll('.growth-steps span').forEach(function(step){step.classList.add('done')});
    const feedbackCard=document.getElementById('nextFeedbackCard');
    feedbackCard.classList.add('completed');
    document.getElementById('feedbackStateLabel').textContent='今日反馈已记录';
    document.getElementById('nextFeedbackTitle').textContent='你的偏好又清晰了一点';
    document.getElementById('nextFeedbackCopy').textContent='这次明确选择已经进入成长档案，并会用于下一次方案。';
    document.getElementById('nextFeedbackAction').innerHTML='查看本次反馈 '+uiIcon('chevron','sm');
    event.currentTarget.disabled=true;
    showToast('已记入偏好，本次获得 5 积分');
    document.getElementById('feedbackResult').focus({preventScroll:true});
  });

  document.querySelectorAll('.app-switch').forEach(function(button){button.addEventListener('click',function(){const next=!button.classList.contains('on');button.classList.toggle('on',next);button.setAttribute('aria-checked',String(next));showToast(next?'已开启':'已关闭并清理相关授权')})});
  document.getElementById('ageModeRow').addEventListener('click',function(){const switchMode=function(){settingsAge=settingsAge==='adult'?'child':'adult';const modeText=settingsAge==='adult'?'成人模式':'儿童模式';const modeValue=document.querySelector('#ageModeRow .setting-value');if(modeValue)modeValue.textContent=modeText;document.querySelector('[data-compose-mode="sentence"]').hidden=settingsAge==='child'&&!pinConfigured;showToast(settingsAge==='child'?'已切换儿童内容包':'已切换成人内容包')};if(settingsAge==='child'&&pinConfigured)showDialog('验证本机 PIN','切换到成人模式需要验证本机 PIN。演示中确认代表验证通过。',switchMode);else switchMode()});
  document.getElementById('pinRow').addEventListener('click',function(){showDialog('设置本机 PIN','PIN 仅保存在本机。演示中确认后标记为已设置。',function(){pinConfigured=true;const pinValue=document.querySelector('#pinRow .setting-value');if(pinValue)pinValue.textContent='已设置';showToast('PIN 已设置')})});
  document.getElementById('aboutRow').addEventListener('click',function(){showDialog('关于眠屿','眠屿 MVP 0.1 · 低刺激、可解释、可修改的睡前声音体验。',function(){})});
  document.getElementById('medicalInfoRow').addEventListener('click',function(){showDialog('非医疗说明','眠屿不是医疗产品，不能诊断失眠；播放记录也不代表实际入睡情况。',function(){})});

  const dialog=document.getElementById('appDialog');let dialogAction=null;
  function showDialog(title,message,onConfirm){document.getElementById('dialogTitle').textContent=title;document.getElementById('dialogMessage').textContent=message;dialogAction=onConfirm;dialog.classList.add('show');document.getElementById('dialogCancel').focus()}
  function closeDialog(){dialog.classList.remove('show');dialogAction=null}
  document.getElementById('dialogCancel').addEventListener('click',closeDialog);document.getElementById('dialogConfirm').addEventListener('click',function(){const action=dialogAction;closeDialog();if(action)action()});
  document.getElementById('eraseData').addEventListener('click',function(){showDialog('删除本机数据？','将删除方案、场景、播放记录、反馈和偏好，且无法恢复。',function(){const button=document.getElementById('eraseData');button.disabled=true;button.textContent='正在清理…';setTimeout(function(){button.textContent='已清理';showToast('本机数据已清理')},650)})});
  document.getElementById('revokePermissions').addEventListener('click',function(){showDialog('撤回全部授权？','所有可选数据授权会恢复为关闭，基础功能仍可使用。',function(){document.querySelectorAll('#privacyView .app-switch').forEach(function(button){button.classList.remove('on');button.setAttribute('aria-checked','false')});showToast('已撤回全部可选授权')})});
  document.querySelectorAll('.archive-period button').forEach(function(button){button.addEventListener('click',function(){document.querySelectorAll('.archive-period button').forEach(function(item){item.classList.toggle('active',item===button)});showToast('已切换到'+button.textContent)})});

  nav.querySelector('[data-main-route="sceneView"]').addEventListener('click',function(){nav.classList.add('hidden')});
  document.getElementById('backEdit').addEventListener('click',function(){if(currentView==='sceneView')navigate('homeView',false)});
  document.getElementById('exitSleep').addEventListener('click',function(event){event.preventDefault();event.stopImmediatePropagation();showDialog('退出睡眠模式？','声音会停止，并返回眠屿首页。',function(){clearInterval(timer);navigate('homeView',false);showToast('已结束本次播放')})},true);
  document.getElementById('startButton').addEventListener('click',function(){document.getElementById('sleepMessage').textContent='声音正在慢慢变小';nav.classList.add('hidden');currentView='sleepView'});

  navigate('onboardingView',false);
})();
