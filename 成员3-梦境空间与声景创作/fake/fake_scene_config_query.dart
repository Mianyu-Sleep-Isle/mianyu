import 'scene_config_query_port.dart';

/// M0 Fake：固定两套场景，不读数据库。
/// V01 卧室已交接；V02 小院为草稿（前端编辑器用）。
class FakeSceneConfigQuery implements SceneConfigQueryPort {
  FakeSceneConfigQuery([Map<String, SceneConfigDto>? scenes])
      : _scenes = scenes ?? _seed();

  final Map<String, SceneConfigDto> _scenes;

  static const bedroomId = '11111111-1111-4111-8111-111111111101';
  static const yardId = '11111111-1111-4111-8111-111111111102';

  @override
  Future<SceneConfigDto?> getById(String sceneConfigId) async {
    return _scenes[sceneConfigId];
  }

  @override
  Future<SceneConfigDto?> getHandedOffById(String sceneConfigId) async {
    final scene = _scenes[sceneConfigId];
    if (scene == null || scene.lifecycleStatus != 'handed_off') {
      return null;
    }
    return scene;
  }
}

Map<String, SceneConfigDto> _seed() {
  const userId = '00000000-0000-4000-8000-000000000001';
  const rainAsset = 'aaaaaaaa-0001-4000-8000-0000000000a1';
  const fireAsset = 'aaaaaaaa-0003-4000-8000-0000000000a3';
  const bedroomSource = 's1111111-0001-4000-8000-0000000000b1';
  const yardSource = 's1111111-0002-4000-8000-0000000000b2';

  final bedroom = SceneConfigDto(
    sceneConfigId: FakeSceneConfigQuery.bedroomId,
    sceneFamilyId: 'f1111111-1111-4111-8111-111111111101',
    userId: userId,
    sceneName: '夜雨卧室',
    spaceType: 'indoor',
    environmentType: 'bedroom',
    reverbType: 'indoor_soft',
    bedX: 0.50,
    bedY: 0.75,
    creationMethod: 'preset',
    configVersion: 1,
    lifecycleStatus: 'handed_off',
    handedOffAt: '2026-09-17T12:00:00Z',
    backgroundAsset: 'assets/scenes/placeholder_room.png',
    audioSources: const [
      SceneAudioSourceDto(
        sourceId: bedroomSource,
        assetId: fireAsset,
        spaceType: 'indoor',
        positionX: 0.22,
        positionY: 0.62,
        baseVolume: 0.45,
        pan: -0.35,
        distance: 0.30,
        loopMode: 'loop',
        enabled: true,
      ),
    ],
    elements: const [
      SceneElementDto(
        elementId: 'e1111111-0001-4000-8000-0000000000c1',
        elementName: '窗',
        elementType: 'window',
        positionX: 0.82,
        positionY: 0.28,
        spaceType: 'indoor',
        zOrder: 1,
      ),
      SceneElementDto(
        elementId: 'e1111111-0002-4000-8000-0000000000c2',
        elementName: '壁炉',
        elementType: 'fireplace',
        positionX: 0.22,
        positionY: 0.62,
        spaceType: 'indoor',
        zOrder: 2,
        boundSourceId: bedroomSource,
      ),
      SceneElementDto(
        elementId: 'e1111111-0003-4000-8000-0000000000c3',
        elementName: '床',
        elementType: 'bed',
        positionX: 0.50,
        positionY: 0.75,
        spaceType: 'indoor',
        zOrder: 0,
      ),
    ],
  );

  final yard = SceneConfigDto(
    sceneConfigId: FakeSceneConfigQuery.yardId,
    sceneFamilyId: 'f1111111-1111-4111-8111-111111111102',
    userId: userId,
    sceneName: '雨夜小院',
    spaceType: 'outdoor',
    environmentType: 'rain_courtyard',
    reverbType: 'outdoor_open',
    bedX: 0.50,
    bedY: 0.80,
    creationMethod: 'preset',
    configVersion: 1,
    lifecycleStatus: 'draft',
    backgroundAsset: 'assets/scenes/placeholder_yard.png',
    audioSources: const [
      SceneAudioSourceDto(
        sourceId: yardSource,
        assetId: rainAsset,
        spaceType: 'outdoor',
        positionX: 0.55,
        positionY: 0.40,
        baseVolume: 0.55,
        pan: 0.10,
        distance: 0.45,
        loopMode: 'loop',
        enabled: true,
      ),
    ],
    elements: const [
      SceneElementDto(
        elementId: 'e1111111-0004-4000-8000-0000000000c4',
        elementName: '门',
        elementType: 'door',
        positionX: 0.12,
        positionY: 0.70,
        spaceType: 'outdoor',
        zOrder: 1,
      ),
      SceneElementDto(
        elementId: 'e1111111-0005-4000-8000-0000000000c5',
        elementName: '雨',
        elementType: 'rain',
        positionX: 0.55,
        positionY: 0.40,
        spaceType: 'outdoor',
        zOrder: 2,
        boundSourceId: yardSource,
      ),
    ],
  );

  return {
    bedroom.sceneConfigId: bedroom,
    yard.sceneConfigId: yard,
  };
}
