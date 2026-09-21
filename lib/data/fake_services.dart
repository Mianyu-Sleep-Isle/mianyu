import '../domain/contracts.dart';

class FakeStore {
  UserContextDto user = const UserContextDto(
    userId: 'user-local-demo',
    ageMode: AgeMode.adult,
    pinConfigured: false,
    nonMedicalAccepted: false,
  );
  SleepPlanDto? plan;
  SceneConfigDto? scene;
  SleepSessionDto? session;
  MorningFeedbackDto? feedback;
  bool previewing = false;
  final List<PointsEntryDto> pointEntries = [];
}

const _sounds = <TrackRefDto>[
  TrackRefDto(assetId: 'A01', name: '小雨', assetPath: 'assets/images/sounds/rain_light.png', defaultSpace: DefaultSpace.outdoor),
  TrackRefDto(assetId: 'A02', name: '雨打窗户', assetPath: 'assets/images/sounds/rain_window.png', defaultSpace: DefaultSpace.outdoor),
  TrackRefDto(assetId: 'A03', name: '壁炉', assetPath: 'assets/images/sounds/fireplace.png', defaultSpace: DefaultSpace.indoor),
  TrackRefDto(assetId: 'A04', name: '翻书声', assetPath: 'assets/images/sounds/page_turn.png', defaultSpace: DefaultSpace.indoor),
  TrackRefDto(assetId: 'A05', name: '微风', assetPath: 'assets/images/sounds/wind_soft.png', defaultSpace: DefaultSpace.outdoor),
  TrackRefDto(assetId: 'A06', name: '水流声', assetPath: 'assets/images/sounds/stream.png', defaultSpace: DefaultSpace.outdoor),
  TrackRefDto(assetId: 'A07', name: '夜晚室内底噪', assetPath: 'assets/images/sounds/room_tone.png', defaultSpace: DefaultSpace.indoor),
  TrackRefDto(assetId: 'A08', name: '柴火燃烧', assetPath: 'assets/images/sounds/wood_fire.png', defaultSpace: DefaultSpace.outdoor),
  TrackRefDto(assetId: 'A09', name: '夜晚森林', assetPath: 'assets/images/sounds/forest_night.png', defaultSpace: DefaultSpace.outdoor),
  TrackRefDto(assetId: 'A10', name: '轻键盘', assetPath: 'assets/images/sounds/keyboard.png', defaultSpace: DefaultSpace.indoor),
  TrackRefDto(assetId: 'A11', name: '被子枕头摩擦声', assetPath: 'assets/images/sounds/blanket.png', defaultSpace: DefaultSpace.indoor),
  TrackRefDto(assetId: 'A12', name: '远雷', assetPath: 'assets/images/sounds/thunder.png', defaultSpace: DefaultSpace.outdoor),
];

class FakeContentCatalog implements ContentCatalogPort {
  @override
  Future<List<ContentItemDto>> list({required String category, required AgeMode ageMode}) async {
    if (category == '声音') {
      return _sounds
          .map((track) => ContentItemDto(
                id: track.assetId,
                name: track.name,
                category: '声音',
                assetPath: track.assetPath,
                ageMode: AgeMode.child,
                reviewStatus: ContentReviewStatus.approved,
                enabled: track.assetId != 'A12',
                durationMinutes: 8,
                description: track.assetId == 'A12' ? '仅用于验证“不要打雷”的禁忌过滤' : '可循环的低刺激环境声',
              ))
          .toList();
    }
    if (category == '故事') {
      final all = <ContentItemDto>[
        const ContentItemDto(id: 'S01', name: '岛屿尽头的灯', category: '故事', assetPath: 'assets/images/sounds/page_turn.png', ageMode: AgeMode.adult, reviewStatus: ContentReviewStatus.approved, enabled: true, durationMinutes: 12, description: '低刺激模板故事 · 温和叙事'),
        const ContentItemDto(id: 'S02', name: '慢慢驶过的夜车', category: '故事', assetPath: 'assets/images/sounds/room_tone.png', ageMode: AgeMode.adult, reviewStatus: ContentReviewStatus.approved, enabled: true, durationMinutes: 15, description: '低刺激模板故事 · 无悬念结尾'),
        const ContentItemDto(id: 'S03', name: '窗边的晚风', category: '故事', assetPath: 'assets/images/sounds/wind_soft.png', ageMode: AgeMode.adult, reviewStatus: ContentReviewStatus.pending, enabled: false, durationMinutes: 10, description: '仍在审核，暂不可播放'),
        const ContentItemDto(id: 'S04', name: '月亮邮差', category: '故事', assetPath: 'assets/images/sounds/forest_night.png', ageMode: AgeMode.child, reviewStatus: ContentReviewStatus.approved, enabled: true, durationMinutes: 9, description: '儿童模板故事 · 无惊吓内容'),
        const ContentItemDto(id: 'S05', name: '会打哈欠的小岛', category: '故事', assetPath: 'assets/images/sounds/blanket.png', ageMode: AgeMode.child, reviewStatus: ContentReviewStatus.approved, enabled: true, durationMinutes: 8, description: '儿童模板故事 · 无悬念结尾'),
      ];
      return all.where((item) => ageMode == AgeMode.adult || item.ageMode == AgeMode.child).toList();
    }
    if (category == '呼吸') {
      return const [
        ContentItemDto(id: 'B01', name: '两分钟缓慢呼吸', category: '呼吸', assetPath: 'assets/images/sounds/wind_soft.png', ageMode: AgeMode.child, reviewStatus: ContentReviewStatus.approved, enabled: true, durationMinutes: 2, description: '吸气 4 秒 · 呼气 6 秒 · 12 轮'),
      ];
    }
    if (category == '预设') {
      return const [
        ContentItemDto(id: 'P01', name: '我的睡前小屋', category: '预设', assetPath: 'assets/images/scenes/bedroom.png', ageMode: AgeMode.child, reviewStatus: ContentReviewStatus.approved, enabled: true, durationMinutes: 30, description: '卧室与雨夜小院 · 可继续编辑'),
      ];
    }
    return const [
      ContentItemDto(id: 'F01', name: '收藏 · 我的睡前小屋', category: '收藏', assetPath: 'assets/images/scenes/bedroom.png', ageMode: AgeMode.child, reviewStatus: ContentReviewStatus.approved, enabled: true, durationMinutes: 30, description: '同一场景只保留一条收藏'),
    ];
  }
}

class FakePlayableResolver implements PlayableResourceResolverPort {
  @override
  Future<bool> canResolve(String assetId) async => assetId != 'A12';
}

class FakePlanServices implements PlanComposerPort, PlanQueryPort {
  FakePlanServices(this.store);
  final FakeStore store;

  @override
  Future<SleepPlanDto> compose(SleepIntentDto intent, AgeMode ageMode) async {
    final avoidVoice = intent.voicePreference == VoicePreference.avoid;
    final shortTime = intent.availableMinutes <= 15;
    final wantsCompany = intent.emotion == Emotion.wantsCompany && !avoidVoice;
    final asksRain = intent.presetSentence?.contains('雨') ?? false;
    final forbidsThunder = intent.forbiddenTags.contains('远雷') || (intent.presetSentence?.contains('不要打雷') ?? false);

    final List<TrackRefDto> tracks;
    final PlanType type;
    final String reason;
    String? story;
    if (avoidVoice) {
      type = PlanType.soundscape;
      tracks = [_sounds[4], _sounds[5], _sounds[6]];
      reason = '你明确选择了不要人声，因此只保留柔和、可调的环境声。';
    } else if (shortTime || intent.emotion == Emotion.anxious) {
      type = PlanType.breath;
      tracks = [_sounds[6], _sounds[9]];
      reason = '时间较短或思绪偏紧张，先用两分钟呼吸，再让轻室内声自然接续。';
    } else if (wantsCompany) {
      type = PlanType.story;
      tracks = [_sounds[0], _sounds[6]];
      story = ageMode == AgeMode.child ? '月亮邮差' : '岛屿尽头的灯';
      reason = '你想要一点陪伴感，选择已审核的短故事，并用小雨托住人声。';
    } else {
      type = PlanType.mix;
      tracks = asksRain ? [_sounds[0], _sounds[1], _sounds[2], _sounds[3]] : [_sounds[0], _sounds[2], _sounds[4]];
      reason = forbidsThunder
          ? '按你的要求保留雨声，并已排除远雷；室内暖声会让层次更柔和。'
          : '用室内暖声搭配窗外小雨，层次清楚但不过度刺激。';
    }
    final plan = SleepPlanDto(
      id: 'plan-demo-001',
      type: type,
      reason: reason,
      source: PlanSource.rule,
      status: PlanStatus.confirmed,
      durationMinutes: intent.availableMinutes,
      fadeOutMinutes: 5,
      tracks: tracks.where((track) => !(forbidsThunder && track.assetId == 'A12')).toList(),
      storyName: story,
    );
    store.plan = plan;
    return plan;
  }

  @override
  Future<SleepPlanDto?> current() async => store.plan;
}

class FakeSceneConfig implements SceneConfigQueryPort {
  FakeSceneConfig(this.store);
  final FakeStore store;

  @override
  Future<SceneConfigDto?> current() async => store.scene;

  @override
  Future<SceneConfigDto> freeze(SceneConfigDto scene) async {
    final frozen = scene.copyWith(status: SceneLifecycleStatus.handedOff);
    store.scene = frozen;
    return frozen;
  }

  @override
  Future<SceneConfigDto> saveDraft(SceneConfigDto scene) async {
    store.scene = scene.copyWith(status: SceneLifecycleStatus.draft);
    return store.scene!;
  }
}

class FakeSleepSession implements SleepSessionPort {
  FakeSleepSession(this.store);
  final FakeStore store;

  @override
  Future<void> pause() async {}

  @override
  Future<void> resume() async {}

  @override
  Future<SleepSessionDto> start(SleepPlanDto plan, SceneConfigDto scene) async {
    if (plan.status != PlanStatus.confirmed || scene.status != SceneLifecycleStatus.handedOff) {
      throw StateError('validation_error');
    }
    final session = SleepSessionDto(
      id: 'session-demo-001',
      planId: plan.id,
      sceneId: scene.id,
      status: SessionStatus.running,
      startedAt: DateTime.now(),
      playbackMinutes: 0,
    );
    store.session = session;
    if (!store.pointEntries.any((entry) => entry.type == PointsEventType.planStarted)) {
      store.pointEntries.add(PointsEntryDto(
        id: 'points-start',
        type: PointsEventType.planStarted,
        points: 10,
        balanceAfter: 10,
        occurredAt: DateTime.now(),
        remark: '按自己的计划开始睡前流程',
      ));
    }
    return session;
  }

  @override
  Future<void> stop() async {}
}

class FakeAudioEngine implements AudioEnginePort {
  FakeAudioEngine(this.store);
  final FakeStore store;

  @override
  Future<void> preview(String assetId) async => store.previewing = assetId != 'A12';

  @override
  Future<void> stopPreview() async => store.previewing = false;
}

class FakeFeedback implements FeedbackCommandPort {
  FakeFeedback(this.store);
  final FakeStore store;

  @override
  Future<MorningFeedbackDto> submit(MorningFeedbackDto feedback) async {
    store.feedback = feedback;
    if (!store.pointEntries.any((entry) => entry.type == PointsEventType.feedbackSubmitted)) {
      final previous = store.pointEntries.isEmpty ? 0 : store.pointEntries.last.balanceAfter;
      store.pointEntries.add(PointsEntryDto(
        id: 'points-feedback',
        type: PointsEventType.feedbackSubmitted,
        points: 8,
        balanceAfter: previous + 8,
        occurredAt: DateTime.now(),
        remark: '提交次日主观反馈',
      ));
    }
    return feedback;
  }
}

class FakePreference implements PreferenceQueryPort {
  @override
  Future<VoicePreference> voicePreference() async => VoicePreference.unspecified;
}

class FakePoints implements PointLedgerPort {
  FakePoints(this.store);
  final FakeStore store;

  @override
  Future<List<PointsEntryDto>> entries() async => List.unmodifiable(store.pointEntries);
}

class FakeAuthAndErasure implements AuthPort, UserDataErasurePort {
  FakeAuthAndErasure(this.store);
  final FakeStore store;

  @override
  Future<UserContextDto> currentUser() async => store.user;

  @override
  Future<bool> verifyPin(String pin) async => pin == '1024';

  @override
  Future<void> eraseAll() async {
    store
      ..plan = null
      ..scene = null
      ..session = null
      ..feedback = null
      ..pointEntries.clear();
  }
}

AppPorts buildFakePorts(FakeStore store) {
  final plan = FakePlanServices(store);
  final auth = FakeAuthAndErasure(store);
  return AppPorts(
    catalog: FakeContentCatalog(),
    resourceResolver: FakePlayableResolver(),
    planComposer: plan,
    planQuery: plan,
    sceneQuery: FakeSceneConfig(store),
    sleepSession: FakeSleepSession(store),
    audioEngine: FakeAudioEngine(store),
    feedback: FakeFeedback(store),
    preferences: FakePreference(),
    points: FakePoints(store),
    auth: auth,
    erasure: auth,
  );
}

List<TrackRefDto> get fakeSoundTracks => _sounds;
