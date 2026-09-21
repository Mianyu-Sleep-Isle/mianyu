import 'dart:math' as math;

import 'package:flutter/material.dart';

import '../../app.dart';
import '../../data/fake_services.dart';
import '../../domain/contracts.dart';
import '../theme/app_theme.dart';
import '../widgets/components.dart';
import 'sleep_screen.dart';

class RoomEditorScreen extends StatefulWidget {
  const RoomEditorScreen({super.key, this.inShell = false});
  final bool inShell;

  @override
  State<RoomEditorScreen> createState() => _RoomEditorScreenState();
}

class _RoomEditorScreenState extends State<RoomEditorScreen> {
  String? selectedSourceId;
  String trayCategory = '室内';

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    final controller = AppScope.of(context);
    if (controller.scene == null) {
      WidgetsBinding.instance.addPostFrameCallback((_) => controller.ensureEditableScene());
    }
  }

  @override
  Widget build(BuildContext context) {
    final controller = AppScope.of(context);
    final scene = controller.scene;
    final frozen = scene?.status == SceneLifecycleStatus.handedOff;
    return Scaffold(
      extendBodyBehindAppBar: true,
      appBar: widget.inShell
          ? null
          : AppBar(
              title: Text(frozen ? '已保存的场景' : '编辑场景'),
              actions: [
                if (!frozen) TextButton(onPressed: controller.saveScene, child: const Text('保存草稿')),
              ],
            ),
      body: AmbientBackground(
        image: controller.isOutdoor ? 'assets/images/scenes/rain_courtyard.png' : 'assets/images/scenes/bedroom.png',
        overlayOpacity: .2,
        child: SafeArea(
          child: Column(
            children: [
              if (widget.inShell)
                Padding(
                  padding: const EdgeInsets.fromLTRB(20, 16, 20, 10),
                  child: PageHeader(
                    title: frozen ? '我的睡前小屋' : '编辑场景',
                    subtitle: frozen ? '场景已冻结，睡眠模式会读取这个版本。' : '拖动物体改变左右与远近；点窗切换室外。',
                    trailing: frozen
                        ? IconButton(onPressed: controller.editFrozenScene, tooltip: '创建新版本继续编辑', icon: const Icon(Icons.edit_outlined))
                        : IconButton(onPressed: controller.saveScene, tooltip: '保存草稿', icon: const Icon(Icons.save_outlined)),
                  ),
                ),
              Expanded(
                child: Stack(
                  children: [
                    Positioned.fill(
                      child: _RoomCanvas(
                        sources: scene?.sources ?? const [],
                        space: controller.isOutdoor ? SpaceType.outdoor : SpaceType.indoor,
                        editable: !frozen,
                        selectedSourceId: selectedSourceId,
                        onSelected: (value) => setState(() => selectedSourceId = value),
                      ),
                    ),
                    Positioned(
                      left: 16,
                      top: widget.inShell ? 4 : 12,
                      child: SegmentedButton<bool>(
                        segments: const [
                          ButtonSegment(value: false, icon: Icon(Icons.bedroom_parent_outlined), label: Text('室内')),
                          ButtonSegment(value: true, icon: Icon(Icons.nature_people_outlined), label: Text('户外')),
                        ],
                        selected: {controller.isOutdoor},
                        onSelectionChanged: (_) => controller.toggleSpace(),
                        showSelectedIcon: false,
                      ),
                    ),
                    if (!controller.isOutdoor)
                      Positioned(
                        right: 16,
                        top: widget.inShell ? 4 : 12,
                        child: Semantics(
                          button: true,
                          label: '点窗进入雨夜小院',
                          child: FilledButton.tonalIcon(
                            onPressed: controller.toggleSpace,
                            icon: const Icon(Icons.window_rounded),
                            label: const Text('点窗看小院'),
                          ),
                        ),
                      ),
                    if (scene?.sources.where((item) => item.space == (controller.isOutdoor ? SpaceType.outdoor : SpaceType.indoor)).isEmpty ?? true)
                      const Center(
                        child: IgnorePointer(
                          child: SurfaceCard(
                            child: Text('把下方声音拖到画面中\n松手后按指尖位置放置', textAlign: TextAlign.center),
                          ),
                        ),
                      ),
                  ],
                ),
              ),
              _SoundTray(
                frozen: frozen,
                selectedSourceId: selectedSourceId,
                category: trayCategory,
                onCategoryChanged: (value) => setState(() => trayCategory = value),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _RoomCanvas extends StatelessWidget {
  const _RoomCanvas({
    required this.sources,
    required this.space,
    required this.editable,
    required this.selectedSourceId,
    required this.onSelected,
  });
  final List<SceneAudioSourceDto> sources;
  final SpaceType space;
  final bool editable;
  final String? selectedSourceId;
  final ValueChanged<String> onSelected;

  _SceneVisualSpec _visualSpec(String assetId, double canvasWidth, double canvasHeight) {
    final short = canvasWidth < canvasHeight ? canvasWidth : canvasHeight;
    final specs = <String, _SceneVisualSpec>{
      // Weather is an atmospheric layer, so it spans the scene instead of looking like a tile.
      'A01': _SceneVisualSpec(canvasWidth * .72, canvasHeight * .72, floor: false, opacity: .72),
      'A02': _SceneVisualSpec(canvasWidth * .58, canvasHeight * .42, floor: false, opacity: .8),
      'A03': _SceneVisualSpec(short * .56, short * .56, floor: true),
      'A04': _SceneVisualSpec(short * .30, short * .22, floor: true),
      'A05': _SceneVisualSpec(short * .34, short * .30, floor: false, opacity: .76),
      'A06': _SceneVisualSpec(short * .45, short * .28, floor: true),
      'A07': _SceneVisualSpec(short * .30, short * .24, floor: false, opacity: .4),
      'A08': _SceneVisualSpec(short * .46, short * .42, floor: true),
      'A09': _SceneVisualSpec(short * .46, short * .38, floor: false, opacity: .68),
      'A10': _SceneVisualSpec(short * .42, short * .24, floor: true),
      'A11': _SceneVisualSpec(short * .46, short * .34, floor: true),
      'A12': _SceneVisualSpec(short * .34, short * .28, floor: false, opacity: .66),
    };
    return specs[assetId] ?? _SceneVisualSpec(short * .34, short * .30, floor: true);
  }

  Widget _recommendedGhost(List<TrackRefDto> candidates, BoxConstraints constraints) {
    if (candidates.isEmpty) return const SizedBox.shrink();
    final track = candidates.first;
    final visual = _visualSpec(track.assetId, constraints.maxWidth, constraints.maxHeight);
    final recommended = _recommendedPosition(track.assetId);
    return Positioned(
      left: recommended.dx * constraints.maxWidth - visual.width / 2,
      top: recommended.dy * constraints.maxHeight - visual.height / 2,
      child: _GhostTarget(track: track, visual: visual),
    );
  }

  @override
  Widget build(BuildContext context) {
    final controller = AppScope.of(context);
    return LayoutBuilder(
      builder: (context, constraints) => DragTarget<TrackRefDto>(
        onWillAcceptWithDetails: (details) => editable && details.data.assetId != 'A12',
        onAcceptWithDetails: (details) {
          final box = context.findRenderObject()! as RenderBox;
          final local = box.globalToLocal(details.offset);
          controller.addSource(details.data, x: local.dx / constraints.maxWidth, y: local.dy / constraints.maxHeight);
        },
        builder: (context, candidates, rejected) => Stack(
          children: [
            if (candidates.isNotEmpty)
              Positioned.fill(
                child: DecoratedBox(
                  decoration: BoxDecoration(border: Border.all(color: MianyuColors.accentSoft, width: 3), color: MianyuColors.primary.withValues(alpha: .1)),
                ),
              ),
            _recommendedGhost(candidates, constraints),
            ...sources.where((item) => item.space == space).map((source) {
              final visual = _visualSpec(source.track.assetId, constraints.maxWidth, constraints.maxHeight);
              final left = source.x * constraints.maxWidth - visual.width / 2;
              final top = source.y * constraints.maxHeight - visual.height / 2;
              final selected = selectedSourceId == source.id;
              return Positioned(
                left: left,
                top: top,
                child: Semantics(
                  button: true,
                  selected: selected,
                  label: '${source.track.name}，音量 ${(source.volume * 100).round()}%，可拖动，也可用下方方向按钮移动',
                  child: GestureDetector(
                    onTap: () => onSelected(source.id),
                    onPanUpdate: editable
                        ? (details) => controller.updateSourcePosition(
                              source.id,
                              source.x + details.delta.dx / constraints.maxWidth,
                              source.y + details.delta.dy / constraints.maxHeight,
                            )
                        : null,
                    child: AnimatedContainer(
                      duration: const Duration(milliseconds: 150),
                      width: visual.width,
                      height: visual.height,
                      padding: EdgeInsets.zero,
                      decoration: BoxDecoration(
                        color: Colors.transparent,
                        borderRadius: BorderRadius.circular(visual.width * .12),
                        border: selected ? Border.all(color: MianyuColors.accentSoft.withValues(alpha: .82), width: 1.5) : null,
                        boxShadow: [
                          if (visual.floor) BoxShadow(color: Colors.black.withValues(alpha: .22), blurRadius: 16, spreadRadius: -4, offset: const Offset(0, 8)),
                          if (selected) BoxShadow(color: MianyuColors.accent.withValues(alpha: .30), blurRadius: 22, spreadRadius: 4),
                        ],
                      ),
                      child: Opacity(opacity: visual.opacity, child: Image.asset(source.track.assetPath, fit: BoxFit.contain)),
                    ),
                  ),
                ),
              );
            }),
          ],
        ),
      ),
    );
  }
}

class _SceneVisualSpec {
  const _SceneVisualSpec(this.width, this.height, {required this.floor, this.opacity = 1});
  final double width;
  final double height;
  final bool floor;
  final double opacity;
}

Offset _recommendedPosition(String assetId) {
  switch (assetId) {
    case 'A03':
      return const Offset(.26, .78);
    case 'A04':
      return const Offset(.76, .68);
    case 'A07':
      return const Offset(.48, .40);
    case 'A08':
      return const Offset(.72, .76);
    case 'A10':
      return const Offset(.70, .78);
    case 'A11':
      return const Offset(.54, .76);
    case 'A01':
      return const Offset(.50, .44);
    case 'A02':
      return const Offset(.72, .38);
    case 'A05':
      return const Offset(.28, .42);
    case 'A06':
      return const Offset(.68, .76);
    case 'A09':
      return const Offset(.52, .44);
    case 'A12':
      return const Offset(.55, .34);
    default:
      return const Offset(.50, .50);
  }
}

class _GhostTarget extends StatelessWidget {
  const _GhostTarget({required this.track, required this.visual});
  final TrackRefDto track;
  final _SceneVisualSpec visual;

  @override
  Widget build(BuildContext context) => SizedBox(
        width: visual.width,
        height: visual.height,
        child: Stack(
          alignment: Alignment.center,
          children: [
            CustomPaint(size: Size(visual.width, visual.height), painter: _DragRingPainter()),
            Opacity(opacity: .26, child: Image.asset(track.assetPath, fit: BoxFit.contain)),
          ],
        ),
      );
}

class _SoundTray extends StatelessWidget {
  const _SoundTray({
    required this.frozen,
    required this.selectedSourceId,
    required this.category,
    required this.onCategoryChanged,
  });
  final bool frozen;
  final String? selectedSourceId;
  final String category;
  final ValueChanged<String> onCategoryChanged;

  List<TrackRefDto> get categoryTracks {
    if (category == '户外') {
      return fakeSoundTracks.where((track) => ['A01', 'A02', 'A05', 'A06', 'A08', 'A09', 'A12'].contains(track.assetId)).toList();
    }
    if (category == '故事') {
      return const [
        TrackRefDto(assetId: 'S01', name: '模板故事', assetPath: 'assets/images/sounds/page_turn.png', defaultSpace: DefaultSpace.indoor),
        TrackRefDto(assetId: 'B01', name: '缓慢呼吸', assetPath: 'assets/images/sounds/wind_soft.png', defaultSpace: DefaultSpace.indoor),
      ];
    }
    return fakeSoundTracks.where((track) => ['A03', 'A04', 'A07', 'A10', 'A11'].contains(track.assetId)).toList();
  }

  @override
  Widget build(BuildContext context) {
    final controller = AppScope.of(context);
    final selected = controller.scene?.sources.where((item) => item.id == selectedSourceId).firstOrNull;
    return Container(
      constraints: const BoxConstraints(maxHeight: 420),
      padding: const EdgeInsets.fromLTRB(16, 10, 16, 14),
      decoration: BoxDecoration(
        color: MianyuColors.surface.withValues(alpha: .97),
        borderRadius: const BorderRadius.vertical(top: Radius.circular(28)),
        border: const Border(top: BorderSide(color: MianyuColors.border)),
      ),
      child: SafeArea(
        top: false,
        child: SingleChildScrollView(
          child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(width: 52, height: 4, decoration: BoxDecoration(color: MianyuColors.border, borderRadius: BorderRadius.circular(4))),
            const SizedBox(height: 10),
            Row(
              children: [
                Text(frozen ? '已冻结声景' : '声音盒', style: Theme.of(context).textTheme.titleLarge),
                const Spacer(),
                Text('${controller.scene?.sources.length ?? 0} 个声音', style: const TextStyle(color: MianyuColors.textMuted)),
              ],
            ),
            const SizedBox(height: 10),
            if (!frozen)
              SingleChildScrollView(
                scrollDirection: Axis.horizontal,
                child: Row(
                  children: ['室内', '户外', '故事']
                      .map(
                        (item) => Padding(
                          padding: const EdgeInsets.only(right: 8),
                          child: ChoiceChip(
                            label: Text(item),
                            selected: category == item,
                            onSelected: (_) => onCategoryChanged(item),
                            selectedColor: MianyuColors.primary,
                            backgroundColor: MianyuColors.night,
                            side: const BorderSide(color: MianyuColors.border),
                            labelStyle: TextStyle(color: category == item ? Colors.white : MianyuColors.textMuted, fontWeight: FontWeight.w700),
                          ),
                        ),
                      )
                      .toList(),
                ),
              ),
            if (!frozen) const SizedBox(height: 8),
            if (!frozen)
              GridView.builder(
                shrinkWrap: true,
                physics: const NeverScrollableScrollPhysics(),
                itemCount: categoryTracks.length,
                gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                  crossAxisCount: 4,
                  mainAxisSpacing: 8,
                  crossAxisSpacing: 8,
                  childAspectRatio: .82,
                ),
                itemBuilder: (context, index) {
                  final track = categoryTracks[index];
                  final disabled = track.assetId == 'A12' || category == '故事';
                  final item = _TrayItem(track: track, disabled: disabled);
                  if (disabled) return item;
                  return Draggable<TrackRefDto>(
                    data: track,
                    feedback: _DragFeedback(track: track),
                    childWhenDragging: Opacity(opacity: .35, child: item),
                    child: InkWell(
                      onTap: () => ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('请按住素材并拖到场景中，松手完成放置。'))),
                      borderRadius: BorderRadius.circular(14),
                      child: item,
                    ),
                  );
                },
              ),
            if (category == '故事' && !frozen) const Padding(
              padding: EdgeInsets.only(top: 6),
              child: Align(
                alignment: Alignment.centerLeft,
                child: Text('故事与呼吸从内容详情进入，当前素材仅作入口缩略图。', style: TextStyle(color: MianyuColors.textMuted, fontSize: 11)),
              ),
            ),
            if (selected != null && !frozen) ...[
              const SizedBox(height: 8),
              _SelectedSourceControls(source: selected),
            ],
            if (selected == null && !frozen) ...[
              const SizedBox(height: 8),
              const Text('按住素材拖到场景中；虚像是推荐位置，松手位置才是最终落点。', style: TextStyle(color: MianyuColors.textMuted, fontSize: 12)),
            ],
            const SizedBox(height: 10),
            Row(
              children: [
                if (frozen)
                  Expanded(child: GhostButton(label: '创建新版本', icon: Icons.edit_outlined, onPressed: controller.editFrozenScene))
                else ...[
                  Expanded(child: GhostButton(label: '保存草稿', icon: Icons.save_outlined, onPressed: controller.saveScene)),
                  const SizedBox(width: 10),
                  Expanded(
                    child: FilledButton.icon(
                      onPressed: controller.scene?.sources.isNotEmpty == true ? controller.freezeScene : null,
                      style: FilledButton.styleFrom(
                        backgroundColor: MianyuColors.accent,
                        foregroundColor: MianyuColors.nightDeep,
                      ),
                      icon: const Icon(Icons.lock_outline_rounded),
                      label: const Text('保存并冻结'),
                    ),
                  ),
                ],
                if (frozen) ...[
                  const SizedBox(width: 10),
                  Expanded(
                    child: FilledButton.icon(
                      onPressed: controller.plan == null
                          ? null
                          : () async {
                              await controller.startSleep();
                              if (context.mounted) Navigator.of(context).push(MaterialPageRoute(builder: (_) => const SleepScreen()));
                            },
                      icon: const Icon(Icons.play_arrow_rounded),
                      label: Text(controller.plan == null ? '需要已确认方案' : '开始睡眠'),
                    ),
                  ),
                ],
              ],
            ),
            ],
          ),
        ),
      ),
    );
  }
}

class _DragFeedback extends StatelessWidget {
  const _DragFeedback({required this.track});
  final TrackRefDto track;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.transparent,
      child: Container(
        width: 64,
        height: 64,
        padding: const EdgeInsets.all(9),
        decoration: BoxDecoration(
          color: MianyuColors.nightDeep.withValues(alpha: .94),
          borderRadius: BorderRadius.circular(17),
          border: Border.all(color: MianyuColors.accentSoft, width: 2),
          boxShadow: const [BoxShadow(color: Colors.black54, blurRadius: 16, offset: Offset(0, 8))],
        ),
        child: Image.asset(track.assetPath, fit: BoxFit.contain),
      ),
    );
  }
}

class _DragRingPainter extends CustomPainter {
  @override
  void paint(Canvas canvas, Size size) {
    final center = size.center(Offset.zero);
    final paint = Paint()
      ..color = MianyuColors.accentSoft.withValues(alpha: .74)
      ..style = PaintingStyle.stroke
      ..strokeWidth = 1.4;
    for (final radius in [42.0, 60.0, 75.0]) {
      final path = Path();
      for (var i = 0; i < 32; i++) {
        final start = i * math.pi / 16;
        final end = start + math.pi / 32;
        path.addArc(Rect.fromCircle(center: center, radius: radius), start, end - start);
      }
      canvas.drawPath(path, paint);
    }
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}

class _TrayItem extends StatelessWidget {
  const _TrayItem({required this.track, this.disabled = false, this.floating = false});
  final TrackRefDto track;
  final bool disabled;
  final bool floating;

  @override
  Widget build(BuildContext context) => Tooltip(
        message: disabled ? '远雷只用于禁忌验证，当前不可添加' : '${track.name}：点按添加，或拖到场景',
        child: Opacity(
          opacity: disabled ? .42 : 1,
          child: Container(
            width: double.infinity,
            height: 92,
            padding: const EdgeInsets.all(8),
            decoration: BoxDecoration(
              color: MianyuColors.night,
              borderRadius: BorderRadius.circular(14),
              border: Border.all(color: floating ? MianyuColors.accentSoft : MianyuColors.border, width: floating ? 2 : 1),
            ),
            child: Column(
              children: [
                SizedBox(height: 52, child: Image.asset(track.assetPath, fit: BoxFit.contain)),
                const SizedBox(height: 4),
                Text(track.name, maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(fontSize: 11)),
              ],
            ),
          ),
        ),
      );
}

class _SelectedSourceControls extends StatelessWidget {
  const _SelectedSourceControls({required this.source});
  final SceneAudioSourceDto source;

  @override
  Widget build(BuildContext context) {
    final controller = AppScope.of(context);
    return Column(
      children: [
        Row(
          children: [
            Expanded(child: Text('${source.track.name} · 音量 ${(source.volume * 100).round()}%', style: const TextStyle(fontWeight: FontWeight.w700))),
            _NudgeButton(icon: Icons.delete_outline_rounded, label: '删除声音', color: MianyuColors.danger, onPressed: () => controller.removeSource(source.id)),
          ],
        ),
        Slider(value: source.volume, onChanged: (value) => controller.updateSourceVolume(source.id, value)),
        Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            _NudgeButton(icon: Icons.arrow_left_rounded, label: '向左移动', onPressed: () => controller.nudgeSource(source.id, -.06, 0)),
            _NudgeButton(icon: Icons.arrow_upward_rounded, label: '移远', onPressed: () => controller.nudgeSource(source.id, 0, -.06)),
            _NudgeButton(icon: Icons.arrow_downward_rounded, label: '移近', onPressed: () => controller.nudgeSource(source.id, 0, .06)),
            _NudgeButton(icon: Icons.arrow_right_rounded, label: '向右移动', onPressed: () => controller.nudgeSource(source.id, .06, 0)),
          ],
        ),
      ],
    );
  }
}

class _NudgeButton extends StatelessWidget {
  const _NudgeButton({required this.icon, required this.label, required this.onPressed, this.color});
  final IconData icon;
  final String label;
  final VoidCallback onPressed;
  final Color? color;

  @override
  Widget build(BuildContext context) => IconButton(onPressed: onPressed, tooltip: label, color: color, icon: Icon(icon));
}

extension _FirstOrNull<T> on Iterable<T> {
  T? get firstOrNull => isEmpty ? null : first;
}
