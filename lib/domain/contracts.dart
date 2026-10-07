import 'dart:async';

// 冻结公共枚举：数据库/Port 使用英文值，界面统一映射中文。
enum AgeMode { adult, child }
enum DefaultSpace { indoor, outdoor, either }
enum ContentReviewStatus { draft, pending, approved, rejected, disabled }
enum Emotion { excited, anxious, wantsCompany, calm, unspecified }
enum VoicePreference { want, avoid, unspecified }
enum PlanType { soundscape, story, breath, mix }
enum PlanSource { rule, llm }
enum PlanStatus { draft, confirmed, cancelled }
enum SpaceType { indoor, outdoor }
enum SceneLifecycleStatus { draft, handedOff, retired }
enum SessionStatus { preparing, running, paused, completed, cancelled, failed }
enum StageType { breath, story, soundscape, fadeOut }
enum RecordSource { playbackRecord, subjectiveFeedback, inference }
enum PointsEventType { planStarted, feedbackSubmitted, knowledgeCompleted }

extension AgeModeCopy on AgeMode {
  String get label => this == AgeMode.adult ? '成人模式' : '儿童模式';
}

extension PlanTypeCopy on PlanType {
  String get label => switch (this) {
        PlanType.soundscape => '纯声景',
        PlanType.story => '短故事＋声景',
        PlanType.breath => '呼吸＋声景',
        PlanType.mix => '混合方案',
      };
}

extension PlanSourceCopy on PlanSource {
  String get label => this == PlanSource.rule ? '规则建议' : '模型建议';
}

extension RecordSourceCopy on RecordSource {
  String get label => switch (this) {
        RecordSource.playbackRecord => '播放记录',
        RecordSource.subjectiveFeedback => '主观反馈',
        RecordSource.inference => '推测（非测量）',
      };
}

// 10 个跨模块 DTO。页面只依赖这些不可变数据，不读取模块内部模型。
class UserContextDto {
  const UserContextDto({
    required this.userId,
    required this.ageMode,
    required this.pinConfigured,
    required this.nonMedicalAccepted,
  });

  final String userId;
  final AgeMode ageMode;
  final bool pinConfigured;
  final bool nonMedicalAccepted;

  UserContextDto copyWith({
    AgeMode? ageMode,
    bool? pinConfigured,
    bool? nonMedicalAccepted,
  }) =>
      UserContextDto(
        userId: userId,
        ageMode: ageMode ?? this.ageMode,
        pinConfigured: pinConfigured ?? this.pinConfigured,
        nonMedicalAccepted: nonMedicalAccepted ?? this.nonMedicalAccepted,
      );
}

class ContentItemDto {
  const ContentItemDto({
    required this.id,
    required this.name,
    required this.category,
    required this.assetPath,
    required this.ageMode,
    required this.reviewStatus,
    required this.enabled,
    required this.durationMinutes,
    this.description = '',
  });

  final String id;
  final String name;
  final String category;
  final String assetPath;
  final AgeMode ageMode;
  final ContentReviewStatus reviewStatus;
  final bool enabled;
  final int durationMinutes;
  final String description;

  bool canUse(AgeMode current) =>
      enabled && reviewStatus == ContentReviewStatus.approved && (current == AgeMode.adult || ageMode == AgeMode.child);
}

class SleepIntentDto {
  const SleepIntentDto({
    required this.emotion,
    required this.voicePreference,
    required this.availableMinutes,
    required this.forbiddenTags,
    this.presetSentence,
  });

  final Emotion emotion;
  final VoicePreference voicePreference;
  final int availableMinutes;
  final List<String> forbiddenTags;
  final String? presetSentence;
}

class TrackRefDto {
  const TrackRefDto({
    required this.assetId,
    required this.name,
    required this.assetPath,
    required this.defaultSpace,
    this.volume = .56,
    this.pan = 0,
    this.distance = .25,
  });

  final String assetId;
  final String name;
  final String assetPath;
  final DefaultSpace defaultSpace;
  final double volume;
  final double pan;
  final double distance;
}

class SleepPlanDto {
  const SleepPlanDto({
    required this.id,
    required this.type,
    required this.reason,
    required this.source,
    required this.status,
    required this.durationMinutes,
    required this.fadeOutMinutes,
    required this.tracks,
    this.storyName,
  });

  final String id;
  final PlanType type;
  final String reason;
  final PlanSource source;
  final PlanStatus status;
  final int durationMinutes;
  final int fadeOutMinutes;
  final List<TrackRefDto> tracks;
  final String? storyName;

  SleepPlanDto copyWith({PlanStatus? status, List<TrackRefDto>? tracks}) => SleepPlanDto(
        id: id,
        type: type,
        reason: reason,
        source: source,
        status: status ?? this.status,
        durationMinutes: durationMinutes,
        fadeOutMinutes: fadeOutMinutes,
        tracks: tracks ?? this.tracks,
        storyName: storyName,
      );
}

class SceneAudioSourceDto {
  const SceneAudioSourceDto({
    required this.id,
    required this.track,
    required this.space,
    required this.x,
    required this.y,
    required this.volume,
    required this.enabled,
  });

  final String id;
  final TrackRefDto track;
  final SpaceType space;
  final double x;
  final double y;
  final double volume;
  final bool enabled;

  SceneAudioSourceDto copyWith({
    SpaceType? space,
    double? x,
    double? y,
    double? volume,
    bool? enabled,
  }) =>
      SceneAudioSourceDto(
        id: id,
        track: track,
        space: space ?? this.space,
        x: x ?? this.x,
        y: y ?? this.y,
        volume: volume ?? this.volume,
        enabled: enabled ?? this.enabled,
      );
}

class SceneConfigDto {
  const SceneConfigDto({
    required this.id,
    required this.name,
    required this.status,
    required this.sources,
    required this.version,
  });

  final String id;
  final String name;
  final SceneLifecycleStatus status;
  final List<SceneAudioSourceDto> sources;
  final int version;

  SceneConfigDto copyWith({SceneLifecycleStatus? status, List<SceneAudioSourceDto>? sources}) => SceneConfigDto(
        id: id,
        name: name,
        status: status ?? this.status,
        sources: sources ?? this.sources,
        version: version,
      );
}

class SleepSessionDto {
  const SleepSessionDto({
    required this.id,
    required this.planId,
    required this.sceneId,
    required this.status,
    required this.startedAt,
    required this.playbackMinutes,
  });

  final String id;
  final String planId;
  final String sceneId;
  final SessionStatus status;
  final DateTime startedAt;
  final int playbackMinutes;
}

class MorningFeedbackDto {
  const MorningFeedbackDto({
    required this.sessionId,
    required this.fallAsleepEase,
    required this.soundComfort,
    required this.voiceNextTime,
    required this.submittedAt,
    this.note,
  });

  final String sessionId;
  final String fallAsleepEase;
  final String soundComfort;
  final VoicePreference voiceNextTime;
  final DateTime submittedAt;
  final String? note;
}

class PointsEntryDto {
  const PointsEntryDto({
    required this.id,
    required this.type,
    required this.points,
    required this.balanceAfter,
    required this.occurredAt,
    required this.remark,
  });

  final String id;
  final PointsEventType type;
  final int points;
  final int balanceAfter;
  final DateTime occurredAt;
  final String remark;
}

// 12 个冻结 Port。前端通过这些边界消费 Fake 或未来真实 Adapter。
abstract interface class ContentCatalogPort {
  Future<List<ContentItemDto>> list({required String category, required AgeMode ageMode});
}

abstract interface class PlayableResourceResolverPort {
  Future<bool> canResolve(String assetId);
}

abstract interface class PlanComposerPort {
  Future<SleepPlanDto> compose(SleepIntentDto intent, AgeMode ageMode);
}

abstract interface class PlanQueryPort {
  Future<SleepPlanDto?> current();
}

abstract interface class SceneConfigQueryPort {
  Future<SceneConfigDto?> current();
  Future<SceneConfigDto> saveDraft(SceneConfigDto scene);
  Future<SceneConfigDto> freeze(SceneConfigDto scene);
}

abstract interface class SleepSessionPort {
  Future<SleepSessionDto> start(SleepPlanDto plan, SceneConfigDto scene);
  Future<void> pause();
  Future<void> resume();
  Future<void> stop();
}

abstract interface class AudioEnginePort {
  Future<void> preview(String assetId);
  Future<void> stopPreview();
}

abstract interface class FeedbackCommandPort {
  Future<MorningFeedbackDto> submit(MorningFeedbackDto feedback);
}

abstract interface class PreferenceQueryPort {
  Future<VoicePreference> voicePreference();
}

abstract interface class PointLedgerPort {
  Future<List<PointsEntryDto>> entries();
}

abstract interface class AuthPort {
  Future<UserContextDto> currentUser();
  Future<bool> verifyPin(String pin);
}

abstract interface class UserDataErasurePort {
  Future<void> eraseAll();
}

class AppPorts {
  const AppPorts({
    required this.catalog,
    required this.resourceResolver,
    required this.planComposer,
    required this.planQuery,
    required this.sceneQuery,
    required this.sleepSession,
    required this.audioEngine,
    required this.feedback,
    required this.preferences,
    required this.points,
    required this.auth,
    required this.erasure,
  });

  final ContentCatalogPort catalog;
  final PlayableResourceResolverPort resourceResolver;
  final PlanComposerPort planComposer;
  final PlanQueryPort planQuery;
  final SceneConfigQueryPort sceneQuery;
  final SleepSessionPort sleepSession;
  final AudioEnginePort audioEngine;
  final FeedbackCommandPort feedback;
  final PreferenceQueryPort preferences;
  final PointLedgerPort points;
  final AuthPort auth;
  final UserDataErasurePort erasure;
}
