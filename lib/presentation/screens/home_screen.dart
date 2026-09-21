import 'package:flutter/material.dart';

import '../../app.dart';
import '../../app_controller.dart';
import '../../data/fake_services.dart';
import '../../domain/contracts.dart';
import '../theme/app_theme.dart';
import '../widgets/components.dart';
import 'content_center_screen.dart';
import 'conversation_screen.dart';
import 'room_editor_screen.dart';
import 'settings_screen.dart';
import 'sleep_screen.dart';

class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key});

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  String category = '室内';

  List<TrackRefDto> get categoryTracks {
    if (category == '户外') {
      return fakeSoundTracks.where((track) => ['A01', 'A02', 'A05', 'A06', 'A08', 'A09', 'A12'].contains(track.assetId)).toList();
    }
    if (category == '故事') {
      return const [
        TrackRefDto(assetId: 'S01', name: '模板故事', assetPath: 'assets/images/sounds/page_turn.png', defaultSpace: DefaultSpace.indoor),
        TrackRefDto(assetId: 'S04', name: '儿童故事', assetPath: 'assets/images/sounds/forest_night.png', defaultSpace: DefaultSpace.outdoor),
        TrackRefDto(assetId: 'B01', name: '缓慢呼吸', assetPath: 'assets/images/sounds/wind_soft.png', defaultSpace: DefaultSpace.outdoor),
        TrackRefDto(assetId: 'P01', name: '睡前预设', assetPath: 'assets/images/scenes/bedroom.png', defaultSpace: DefaultSpace.indoor),
      ];
    }
    // 室内只展示真实属于房间的声源；户外雨声不会混入壁炉场景。
    return fakeSoundTracks.where((track) => ['A03', 'A04', 'A07', 'A10', 'A11'].contains(track.assetId)).toList();
  }

  @override
  Widget build(BuildContext context) {
    final controller = AppScope.of(context);
    return Scaffold(
      body: AmbientBackground(
        image: controller.isOutdoor ? 'assets/images/scenes/rain_courtyard.png' : 'assets/images/scenes/bedroom.png',
        overlayOpacity: .34,
        child: SafeArea(
          child: Stack(
            children: [
              _HomeTopBar(
                ageMode: controller.ageMode,
                onPlan: () => Navigator.of(context).push(MaterialPageRoute(builder: (_) => const ConversationScreen())),
                onFavorites: () => Navigator.of(context).push(MaterialPageRoute(builder: (_) => const ContentCenterScreen())),
                onSettings: () => Navigator.of(context).push(MaterialPageRoute(builder: (_) => const SettingsScreen())),
              ),
              Positioned.fill(
                child: DraggableScrollableSheet(
                  initialChildSize: .52,
                  minChildSize: .38,
                  maxChildSize: .88,
                  snap: true,
                  snapSizes: const [.52, .88],
                  builder: (context, scrollController) => _HomeSoundPanel(
                    controller: controller,
                    category: category,
                    tracks: categoryTracks,
                    scrollController: scrollController,
                    onCategoryChanged: (value) => setState(() => category = value),
                    onStart: () => _startSleep(context),
                    onOpenRoom: () => Navigator.of(context).push(MaterialPageRoute(builder: (_) => const RoomEditorScreen())),
                    onOpenPlan: () => Navigator.of(context).push(MaterialPageRoute(builder: (_) => const ConversationScreen())),
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Future<void> _startSleep(BuildContext context) async {
    final controller = AppScope.of(context);
    if (controller.plan == null) {
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('先告诉我今晚的状态，再开始睡前流程。')));
        Navigator.of(context).push(MaterialPageRoute(builder: (_) => const ConversationScreen()));
      }
      return;
    }
    try {
      await controller.startSleep();
      if (context.mounted) Navigator.of(context).push(MaterialPageRoute(builder: (_) => const SleepScreen()));
    } on StateError {
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('先确认方案并保存房间，再开始睡前流程。')));
        Navigator.of(context).push(MaterialPageRoute(builder: (_) => const RoomEditorScreen()));
      }
    }
  }
}

class _HomeTopBar extends StatelessWidget {
  const _HomeTopBar({required this.ageMode, required this.onPlan, required this.onFavorites, required this.onSettings});
  final AgeMode ageMode;
  final VoidCallback onPlan;
  final VoidCallback onFavorites;
  final VoidCallback onSettings;

  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.fromLTRB(20, 14, 16, 0),
        child: Column(
          children: [
            Row(
              children: [
                ClipRRect(
                  borderRadius: BorderRadius.circular(16),
                  child: Image.asset('assets/images/brand/app_icon.png', width: 52, height: 52, fit: BoxFit.cover),
                ),
                const SizedBox(width: 12),
                const Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text('眠屿', style: TextStyle(fontSize: 25, fontWeight: FontWeight.w800, letterSpacing: 1)),
                      Text('在声音里，遇见更好的自己', style: TextStyle(color: MianyuColors.textMuted, fontSize: 12)),
                    ],
                  ),
                ),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 13, vertical: 9),
                  decoration: BoxDecoration(
                    color: MianyuColors.nightDeep.withValues(alpha: .66),
                    border: Border.all(color: MianyuColors.primarySoft.withValues(alpha: .8)),
                    borderRadius: BorderRadius.circular(MianyuRadius.pill),
                  ),
                  child: Row(children: [const Icon(Icons.nights_stay_outlined, size: 18, color: MianyuColors.primarySoft), const SizedBox(width: 7), Text(ageMode == AgeMode.child ? '儿童' : '夜晚')]),
                ),
              ],
            ),
            const SizedBox(height: 12),
            Row(
              children: [
                Expanded(child: _TopAction(icon: Icons.home_outlined, label: '场景', selected: true, onTap: () {})),
                Expanded(child: _TopAction(icon: Icons.star_border_rounded, label: '我的方案', onTap: onPlan)),
                Expanded(child: _TopAction(icon: Icons.favorite_border_rounded, label: '收藏', onTap: onFavorites)),
                Expanded(child: _TopAction(icon: Icons.settings_outlined, label: '设置', onTap: onSettings)),
              ],
            ),
          ],
        ),
      );
}

class _TopAction extends StatelessWidget {
  const _TopAction({required this.icon, required this.label, required this.onTap, this.selected = false});
  final IconData icon;
  final String label;
  final VoidCallback onTap;
  final bool selected;

  @override
  Widget build(BuildContext context) => Semantics(
        button: true,
        label: label,
        child: TextButton(
          onPressed: onTap,
          style: TextButton.styleFrom(
            minimumSize: const Size.fromHeight(50),
            padding: const EdgeInsets.symmetric(horizontal: 4),
            foregroundColor: selected ? Colors.white : MianyuColors.textMuted,
            backgroundColor: selected ? MianyuColors.primary : Colors.transparent,
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(18)),
          ),
          child: Column(mainAxisSize: MainAxisSize.min, children: [Icon(icon, size: 21), const SizedBox(height: 3), Text(label, maxLines: 1, style: const TextStyle(fontSize: 10))]),
        ),
      );
}

class _HomeSoundPanel extends StatelessWidget {
  const _HomeSoundPanel({
    required this.controller,
    required this.category,
    required this.tracks,
    required this.scrollController,
    required this.onCategoryChanged,
    required this.onStart,
    required this.onOpenRoom,
    required this.onOpenPlan,
  });
  final AppController controller;
  final String category;
  final List<TrackRefDto> tracks;
  final ScrollController scrollController;
  final ValueChanged<String> onCategoryChanged;
  final VoidCallback onStart;
  final VoidCallback onOpenRoom;
  final VoidCallback onOpenPlan;

  @override
  Widget build(BuildContext context) => Material(
        color: MianyuColors.surface.withValues(alpha: .97),
        elevation: 14,
        borderRadius: const BorderRadius.vertical(top: Radius.circular(30)),
        child: ListView(
          controller: scrollController,
          padding: const EdgeInsets.fromLTRB(16, 10, 16, 26),
          children: [
            Align(child: Container(width: 54, height: 4, decoration: BoxDecoration(color: MianyuColors.border, borderRadius: BorderRadius.circular(4)))),
            const SizedBox(height: 12),
            Row(
              children: [
                Text('声音盒', style: Theme.of(context).textTheme.headlineMedium?.copyWith(fontSize: 24)),
                const Spacer(),
                Text('${fakeSoundTracks.length} 个素材', style: const TextStyle(color: MianyuColors.textMuted, fontSize: 12)),
              ],
            ),
            const SizedBox(height: 10),
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
            const SizedBox(height: 10),
            GridView.builder(
              shrinkWrap: true,
              physics: const NeverScrollableScrollPhysics(),
              itemCount: tracks.length,
              gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(crossAxisCount: 4, mainAxisSpacing: 9, crossAxisSpacing: 9, childAspectRatio: .82),
              itemBuilder: (context, index) {
                final track = tracks[index];
                final disabled = track.assetId == 'A12' || category == '故事';
                return _HomeSoundTile(
                  track: track,
                  disabled: disabled,
                  onTap: disabled
                      ? null
                      : () {
                          controller.addSource(track);
                          ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('${track.name} 已加入场景')));
                        },
                );
              },
            ),
            if (category == '故事')
              const Padding(
                padding: EdgeInsets.only(top: 7),
                child: Text('故事与呼吸从内容详情进入，当前素材仅作入口缩略图。', style: TextStyle(color: MianyuColors.textMuted, fontSize: 11)),
              ),
            const SizedBox(height: 14),
            Row(
              children: [
                Expanded(
                  child: OutlinedButton.icon(
                    onPressed: onOpenRoom,
                    icon: const Icon(Icons.window_outlined, size: 20),
                    label: Text(controller.scene?.sources.isNotEmpty == true ? '我的睡前小屋' : '布置一间小屋', overflow: TextOverflow.ellipsis),
                    style: OutlinedButton.styleFrom(foregroundColor: MianyuColors.text, side: const BorderSide(color: MianyuColors.border), minimumSize: const Size.fromHeight(50), shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(MianyuRadius.pill))),
                  ),
                ),
                const SizedBox(width: 10),
                Expanded(
                  flex: 2,
                  child: FilledButton.icon(
                    onPressed: onStart,
                    icon: const Icon(Icons.play_arrow_rounded),
                    label: const Text('开始睡眠'),
                    style: FilledButton.styleFrom(backgroundColor: MianyuColors.accent, foregroundColor: MianyuColors.nightDeep, minimumSize: const Size.fromHeight(50), shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(MianyuRadius.pill))),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 12),
            Row(
              children: [
                const Icon(Icons.timer_outlined, color: MianyuColors.primarySoft),
                const SizedBox(width: 8),
                Text(controller.plan == null ? '今晚还没有方案' : '${controller.plan!.durationMinutes} 分钟 · 渐弱 ${controller.plan!.fadeOutMinutes} 分钟', style: const TextStyle(color: MianyuColors.textMuted, fontSize: 12)),
                const Spacer(),
                IconButton(onPressed: onOpenPlan, tooltip: '查看或生成方案', icon: const Icon(Icons.tune_rounded, color: MianyuColors.primarySoft)),
              ],
            ),
            if (controller.plan != null) ...[
              const SizedBox(height: 4),
              PlanCard(plan: controller.plan!, compact: true),
            ] else
              EmptyState(title: '还没有今晚方案', message: '先选一句状态，方案会说明理由，也始终可以修改。', action: GhostButton(label: '开始沟通', icon: Icons.arrow_forward_rounded, onPressed: onOpenPlan)),
            const NonMedicalFooter(),
          ],
        ),
      );
}

class _HomeSoundTile extends StatelessWidget {
  const _HomeSoundTile({required this.track, required this.onTap, this.disabled = false});
  final TrackRefDto track;
  final VoidCallback? onTap;
  final bool disabled;

  @override
  Widget build(BuildContext context) => Semantics(
        button: true,
        enabled: !disabled,
        label: disabled ? '${track.name}，仅用于禁忌验证' : '${track.name}，点按加入场景',
        child: InkWell(
          onTap: onTap,
          borderRadius: BorderRadius.circular(16),
          child: Opacity(
            opacity: disabled ? .42 : 1,
            child: Container(
              padding: const EdgeInsets.all(7),
              decoration: BoxDecoration(color: MianyuColors.night, borderRadius: BorderRadius.circular(16), border: Border.all(color: MianyuColors.border)),
              child: Column(
                children: [
                  Expanded(child: Image.asset(track.assetPath, fit: BoxFit.contain)),
                  const SizedBox(height: 4),
                  Text(track.name, maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(fontSize: 11)),
                ],
              ),
            ),
          ),
        ),
      );
}
