import 'package:flutter/foundation.dart';

import 'data/fake_services.dart';
import 'domain/contracts.dart';

class AppController extends ChangeNotifier {
  AppController() {
    store = FakeStore();
    ports = buildFakePorts(store);
  }

  late FakeStore store;
  late AppPorts ports;

  bool onboardingComplete = false;
  int navigationIndex = 0;
  AgeMode ageMode = AgeMode.adult;
  bool pinConfigured = false;
  bool nonMedicalAccepted = false;
  bool isOutdoor = false;
  bool isPaused = false;
  bool feedbackSubmitted = false;
  bool isGenerating = false;
  bool isClearingData = false;
  String? previewingId;
  SleepPlanDto? plan;
  SceneConfigDto? scene;
  SleepSessionDto? session;

  final Map<String, bool> consent = {
    '对话相关': false,
    '播放摘要': true,
    '噪声摘要': false,
    '设备摘要': false,
  };

  void setNavigation(int value) {
    navigationIndex = value;
    notifyListeners();
  }

  void finishOnboarding({required AgeMode mode, required bool pin, required bool accepted}) {
    ageMode = mode;
    pinConfigured = pin;
    nonMedicalAccepted = accepted;
    store.user = store.user.copyWith(ageMode: mode, pinConfigured: pin, nonMedicalAccepted: accepted);
    onboardingComplete = true;
    notifyListeners();
  }

  Future<SleepPlanDto> composePlan(SleepIntentDto intent) async {
    isGenerating = true;
    notifyListeners();
    await Future<void>.delayed(const Duration(milliseconds: 650));
    plan = await ports.planComposer.compose(intent, ageMode);
    scene = _sceneFromPlan(plan!);
    isGenerating = false;
    notifyListeners();
    return plan!;
  }

  SceneConfigDto _sceneFromPlan(SleepPlanDto value) {
    final sources = <SceneAudioSourceDto>[];
    for (var index = 0; index < value.tracks.length; index++) {
      final track = value.tracks[index];
      final outdoor = track.defaultSpace == DefaultSpace.outdoor;
      sources.add(SceneAudioSourceDto(
        id: 'source-${track.assetId}',
        track: track,
        space: outdoor ? SpaceType.outdoor : SpaceType.indoor,
        x: .24 + (index % 3) * .24,
        y: .28 + (index % 2) * .28,
        volume: track.volume,
        enabled: true,
      ));
    }
    return SceneConfigDto(
      id: 'scene-demo-001',
      name: '我的睡前小屋',
      status: SceneLifecycleStatus.draft,
      sources: sources,
      version: 1,
    );
  }

  void ensureDefaultPlan() {
    if (plan != null) return;
    plan = const SleepPlanDto(
      id: 'plan-demo-default',
      type: PlanType.mix,
      reason: '用室内暖声搭配窗外小雨，层次清楚但不过度刺激。',
      source: PlanSource.rule,
      status: PlanStatus.confirmed,
      durationMinutes: 30,
      fadeOutMinutes: 5,
      tracks: [
        TrackRefDto(assetId: 'A01', name: '小雨', assetPath: 'assets/images/sounds/rain_light.png', defaultSpace: DefaultSpace.outdoor),
        TrackRefDto(assetId: 'A03', name: '壁炉', assetPath: 'assets/images/sounds/fireplace.png', defaultSpace: DefaultSpace.indoor),
        TrackRefDto(assetId: 'A04', name: '翻书声', assetPath: 'assets/images/sounds/page_turn.png', defaultSpace: DefaultSpace.indoor),
      ],
    );
    scene = _sceneFromPlan(plan!);
  }

  void ensureEditableScene() {
    if (scene != null) return;
    scene = const SceneConfigDto(
      id: 'scene-demo-empty',
      name: '我的睡前小屋',
      status: SceneLifecycleStatus.draft,
      sources: [],
      version: 1,
    );
    notifyListeners();
  }

  void addSource(TrackRefDto track, {double x = .5, double y = .5}) {
    ensureEditableScene();
    if (scene!.status != SceneLifecycleStatus.draft || track.assetId == 'A12') return;
    final space = track.defaultSpace == DefaultSpace.outdoor ? SpaceType.outdoor : SpaceType.indoor;
    final next = SceneAudioSourceDto(
      id: 'source-${track.assetId}-${scene!.sources.length}',
      track: track,
      space: space,
      x: x.clamp(.04, .88).toDouble(),
      y: y.clamp(.08, .82).toDouble(),
      volume: track.volume,
      enabled: true,
    );
    scene = scene!.copyWith(sources: [...scene!.sources, next]);
    isOutdoor = space == SpaceType.outdoor;
    notifyListeners();
  }

  void editFrozenScene() {
    if (scene?.status != SceneLifecycleStatus.handedOff) return;
    scene = SceneConfigDto(
      id: '${scene!.id}-v${scene!.version + 1}',
      name: scene!.name,
      status: SceneLifecycleStatus.draft,
      sources: scene!.sources,
      version: scene!.version + 1,
    );
    notifyListeners();
  }

  void toggleSpace() {
    isOutdoor = !isOutdoor;
    notifyListeners();
  }

  void updateSourcePosition(String id, double x, double y) {
    if (scene == null || scene!.status != SceneLifecycleStatus.draft) return;
    scene = scene!.copyWith(
      sources: scene!.sources
          .map((source) => source.id == id
              ? source.copyWith(x: x.clamp(.04, .88).toDouble(), y: y.clamp(.08, .82).toDouble())
              : source)
          .toList(),
    );
    notifyListeners();
  }

  void nudgeSource(String id, double dx, double dy) {
    final source = scene?.sources.where((item) => item.id == id).firstOrNull;
    if (source != null) updateSourcePosition(id, source.x + dx, source.y + dy);
  }

  void updateSourceVolume(String id, double volume) {
    if (scene == null || scene!.status != SceneLifecycleStatus.draft) return;
    scene = scene!.copyWith(
      sources: scene!.sources.map((source) => source.id == id ? source.copyWith(volume: volume) : source).toList(),
    );
    notifyListeners();
  }

  void removeSource(String id) {
    if (scene == null || scene!.status != SceneLifecycleStatus.draft) return;
    scene = scene!.copyWith(sources: scene!.sources.where((source) => source.id != id).toList());
    notifyListeners();
  }

  Future<void> saveScene() async {
    if (scene == null) return;
    scene = await ports.sceneQuery.saveDraft(scene!);
    notifyListeners();
  }

  Future<void> freezeScene() async {
    if (scene == null || scene!.sources.isEmpty) return;
    scene = await ports.sceneQuery.freeze(scene!);
    notifyListeners();
  }

  Future<void> startSleep() async {
    if (plan == null || scene?.status != SceneLifecycleStatus.handedOff) {
      throw StateError('validation_error');
    }
    session = await ports.sleepSession.start(plan!, scene!);
    isPaused = false;
    notifyListeners();
  }

  Future<void> togglePause() async {
    isPaused = !isPaused;
    if (isPaused) {
      await ports.sleepSession.pause();
    } else {
      await ports.sleepSession.resume();
    }
    notifyListeners();
  }

  Future<void> stopSleep() async {
    await ports.sleepSession.stop();
    isPaused = false;
    notifyListeners();
  }

  Future<void> togglePreview(String id) async {
    if (previewingId == id) {
      await ports.audioEngine.stopPreview();
      previewingId = null;
    } else {
      await ports.audioEngine.preview(id);
      previewingId = id;
    }
    notifyListeners();
  }

  Future<void> submitFeedback(MorningFeedbackDto feedback) async {
    await ports.feedback.submit(feedback);
    feedbackSubmitted = true;
    notifyListeners();
  }

  void updateConsent(String key, bool value) {
    consent[key] = value;
    notifyListeners();
  }

  void updateAgeMode(AgeMode value) {
    ageMode = value;
    store.user = store.user.copyWith(ageMode: value);
    notifyListeners();
  }

  void setPinConfigured(bool value) {
    pinConfigured = value;
    store.user = store.user.copyWith(pinConfigured: value);
    notifyListeners();
  }

  Future<void> eraseData() async {
    isClearingData = true;
    notifyListeners();
    await Future<void>.delayed(const Duration(milliseconds: 600));
    await ports.erasure.eraseAll();
    plan = null;
    scene = null;
    session = null;
    feedbackSubmitted = false;
    isClearingData = false;
    notifyListeners();
  }
}

extension _FirstOrNull<T> on Iterable<T> {
  T? get firstOrNull => isEmpty ? null : first;
}
