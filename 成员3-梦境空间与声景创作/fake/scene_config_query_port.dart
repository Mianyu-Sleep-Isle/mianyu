/// 模块3 只读查询端口。组长冻结契约后可把本文件挪到 shared/contracts。
library;

class SceneConfigQueryException implements Exception {
  SceneConfigQueryException(this.code, this.message);
  final String code;
  final String message;
  @override
  String toString() => '$code: $message';
}

abstract class SceneConfigQueryPort {
  /// 按具体版本读取。找不到返回 null，不抛「最新版本」。
  Future<SceneConfigDto?> getById(String sceneConfigId);

  /// 仅返回已交接、可供睡眠页使用的版本。
  Future<SceneConfigDto?> getHandedOffById(String sceneConfigId);
}

class SceneConfigDto {
  const SceneConfigDto({
    required this.sceneConfigId,
    required this.sceneFamilyId,
    required this.userId,
    required this.sceneName,
    required this.spaceType,
    required this.environmentType,
    required this.reverbType,
    required this.bedX,
    required this.bedY,
    required this.creationMethod,
    required this.configVersion,
    required this.lifecycleStatus,
    required this.elements,
    required this.audioSources,
    this.previousVersionId,
    this.sourcePlanId,
    this.handedOffAt,
    this.backgroundAsset,
  });

  final String sceneConfigId;
  final String sceneFamilyId;
  final String? previousVersionId;
  final String userId;
  final String sceneName;
  final String spaceType;
  final String environmentType;
  final String reverbType;
  final double bedX;
  final double bedY;
  final String? sourcePlanId;
  final String creationMethod;
  final int configVersion;
  final String lifecycleStatus;
  final String? handedOffAt;
  final String? backgroundAsset;
  final List<SceneElementDto> elements;
  final List<SceneAudioSourceDto> audioSources;
}

class SceneElementDto {
  const SceneElementDto({
    required this.elementId,
    required this.elementName,
    required this.elementType,
    required this.positionX,
    required this.positionY,
    required this.spaceType,
    required this.zOrder,
    this.boundSourceId,
  });

  final String elementId;
  final String elementName;
  final String elementType;
  final double positionX;
  final double positionY;
  final String spaceType;
  final int zOrder;
  final String? boundSourceId;
}

class SceneAudioSourceDto {
  const SceneAudioSourceDto({
    required this.sourceId,
    required this.assetId,
    required this.spaceType,
    required this.positionX,
    required this.positionY,
    required this.baseVolume,
    required this.pan,
    required this.distance,
    required this.loopMode,
    required this.enabled,
    this.intervalSec,
    this.fadeInSec = 0,
    this.fadeOutSec = 0,
  });

  final String sourceId;
  final String assetId;
  final String spaceType;
  final double positionX;
  final double positionY;
  final double baseVolume;
  final double pan;
  final double distance;
  final String loopMode;
  final int? intervalSec;
  final int fadeInSec;
  final int fadeOutSec;
  final bool enabled;
}
