/// 模块2 Fake：按四条预制规则生成结构化助眠方案。
/// 接入正式工程时，PlanComposerPort、SleepPlan 和 SleepIntent 应替换为共享契约。

class 睡前意图 {
  const 睡前意图({
    required this.情绪,
    this.禁忌 = const <String>{},
    this.人声偏好 = 'unspecified',
    this.可用时长分钟,
    this.儿童模式 = false,
  });

  final String 情绪;
  final Set<String> 禁忌;
  final String 人声偏好;
  final int? 可用时长分钟;
  final bool 儿童模式;
}

class 方案音轨 {
  const 方案音轨({
    required this.assetId,
    required this.volume,
    required this.pan,
    required this.distance,
    required this.indoorOrOutdoor,
  });

  final String assetId;
  final double volume;
  final double pan;
  final double distance;
  final String indoorOrOutdoor;
}

class SleepPlan {
  const SleepPlan({
    required this.planId,
    required this.planType,
    required this.reason,
    required this.tracks,
    required this.durationMin,
    required this.fadeOutMin,
    required this.source,
    this.storyId,
    this.breathId,
  });

  final String planId;
  final String planType;
  final String reason;
  final List<方案音轨> tracks;
  final String? storyId;
  final String? breathId;
  final int durationMin;
  final int fadeOutMin;
  final String source;
}

typedef 助眠方案 = SleepPlan;
typedef SleepIntent = 睡前意图;

abstract interface class PlanComposerPort {
  SleepPlan 生成方案(SleepIntent 意图);
}

class 假的方案生成器 implements PlanComposerPort {
  static int _序号 = 0;

  @override
  SleepPlan 生成方案(SleepIntent 意图) {
    final String 方案编号 = 'fake-plan-${++_序号}';
    final List<方案音轨> 基础声景 = <方案音轨>[
      const 方案音轨(assetId: 'A03', volume: 0.35, pan: 0, distance: 0.45, indoorOrOutdoor: 'indoor'),
      const 方案音轨(assetId: 'A04', volume: 0.18, pan: -0.1, distance: 0.55, indoorOrOutdoor: 'indoor'),
    ];

    // 儿童限制优先：儿童模式不返回成人故事。
    if (意图.儿童模式 && 意图.人声偏好 != 'avoid') {
      return SleepPlan(
        planId: 方案编号,
        planType: 'story',
        reason: '当前是儿童模式，我选择儿童故事和轻柔室内声景。',
        tracks: 基础声景,
        storyId: 'story-child-01',
        durationMin: 5,
        fadeOutMin: 2,
        source: 'rule',
      );
    }

    // 预制场景一：赶作业、想听雨但不要打雷。
    // A01、A02 为雨声资源，由成员1提供；模块2只引用 asset_id。
    if (意图.情绪 == '赶作业' || 意图.情绪 == 'wants_rain' || 意图.禁忌.contains('雷声') || 意图.禁忌.contains('thunder')) {
      return SleepPlan(
        planId: 方案编号,
        planType: 'soundscape',
        reason: '你想听雨但不想听雷声，所以我选择轻柔雨声并排除雷声音轨。',
        tracks: const <方案音轨>[
          方案音轨(assetId: 'A01', volume: 0.34, pan: -0.15, distance: 0.55, indoorOrOutdoor: 'outdoor'),
          方案音轨(assetId: 'A02', volume: 0.22, pan: 0.15, distance: 0.70, indoorOrOutdoor: 'outdoor'),
        ],
        durationMin: 意图.可用时长分钟 ?? 20,
        fadeOutMin: 3,
        source: 'rule',
      );
    }

    // 禁忌和不要人声优先于陪伴偏好。
    if (意图.人声偏好 == 'avoid') {
      return SleepPlan(
        planId: 方案编号,
        planType: 'soundscape',
        reason: '你提到不想听人声，所以只保留轻柔环境声。',
        tracks: 基础声景,
        durationMin: 意图.可用时长分钟 ?? 20,
        fadeOutMin: 3,
        source: 'rule',
      );
    }

    if (意图.可用时长分钟 != null && 意图.可用时长分钟! <= 15) {
      return SleepPlan(
        planId: 方案编号,
        planType: 'mix',
        reason: '时间比较短，我安排短呼吸训练配合环境声，结束后逐渐安静下来。',
        tracks: 基础声景,
        breathId: 'breath-gentle-01',
        durationMin: 意图.可用时长分钟!,
        fadeOutMin: 2,
        source: 'rule',
      );
    }

    if (意图.情绪 == 'wants_company') {
      return SleepPlan(
        planId: 方案编号,
        planType: 'mix',
        reason: '你希望有人陪一会儿，我选择短故事和轻柔环境声。',
        tracks: 基础声景,
        storyId: 意图.儿童模式 ? 'story-child-01' : 'story-adult-01',
        durationMin: 20,
        fadeOutMin: 3,
        source: 'rule',
      );
    }

    return SleepPlan(
      planId: 方案编号,
      planType: 'soundscape',
      reason: '我先安排稳定的室内环境声，你可以继续调整音轨。',
      tracks: 基础声景,
      durationMin: 意图.可用时长分钟 ?? 20,
      fadeOutMin: 3,
      source: 'rule',
    );
  }
}
