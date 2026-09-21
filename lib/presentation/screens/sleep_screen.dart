import 'dart:async';
import 'dart:ui';

import 'package:flutter/material.dart';

import '../../app.dart';
import '../theme/app_theme.dart';
import '../widgets/components.dart';

class SleepScreen extends StatefulWidget {
  const SleepScreen({super.key});

  @override
  State<SleepScreen> createState() => _SleepScreenState();
}

class _SleepScreenState extends State<SleepScreen> {
  Timer? timer;
  late int secondsLeft;
  int selectedMinutes = 30;

  @override
  void initState() {
    super.initState();
    secondsLeft = 30 * 60;
    timer = Timer.periodic(const Duration(seconds: 1), (_) {
      if (!mounted || AppScope.of(context).isPaused) return;
      if (secondsLeft > 0) setState(() => secondsLeft--);
    });
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    final duration = AppScope.of(context).plan?.durationMinutes;
    if (duration != null && secondsLeft == 30 * 60) {
      selectedMinutes = duration;
      secondsLeft = duration * 60;
    }
  }

  @override
  void dispose() {
    timer?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final controller = AppScope.of(context);
    final min = secondsLeft ~/ 60;
    final sec = secondsLeft % 60;
    final fading = secondsLeft <= (controller.plan?.fadeOutMinutes ?? 5) * 60;
    return PopScope(
      canPop: false,
      onPopInvokedWithResult: (_, __) => _confirmExit(),
      child: Scaffold(
        body: AmbientBackground(
          image: 'assets/images/scenes/bedroom.png',
          overlayOpacity: .76,
          child: SafeArea(
            child: Padding(
              padding: const EdgeInsets.fromLTRB(24, 22, 24, 18),
              child: Column(
                children: [
                  const Row(
                    children: [
                      Icon(Icons.nights_stay_rounded, color: MianyuColors.primarySoft),
                      SizedBox(width: 10),
                      Text('睡眠模式', style: TextStyle(fontSize: 20, fontWeight: FontWeight.w700)),
                      Spacer(),
                      Text('低光', style: TextStyle(color: MianyuColors.textMuted)),
                    ],
                  ),
                  const Spacer(),
                  Text(controller.isPaused ? '已暂停' : (fading ? '声音正在慢慢变小' : '声音正在陪着你'), style: Theme.of(context).textTheme.titleMedium?.copyWith(color: MianyuColors.textMuted)),
                  const SizedBox(height: 18),
                  Semantics(
                    label: '剩余 $min 分 ${sec.toString().padLeft(2, '0')} 秒',
                    child: Text(
                      '$min:${sec.toString().padLeft(2, '0')}',
                      style: const TextStyle(fontSize: 72, fontWeight: FontWeight.w300, letterSpacing: 2, fontFeatures: [FontFeature.tabularFigures()]),
                    ),
                  ),
                  const SizedBox(height: 18),
                  Wrap(
                    spacing: 8,
                    runSpacing: 8,
                    alignment: WrapAlignment.center,
                    children: (controller.plan?.tracks ?? const []).map((track) => TrackChip(track: track)).toList(),
                  ),
                  const Spacer(),
                  Container(
                    padding: const EdgeInsets.fromLTRB(12, 14, 12, 12),
                    decoration: BoxDecoration(
                      color: MianyuColors.nightDeep.withValues(alpha: .84),
                      border: Border.all(color: MianyuColors.border),
                      borderRadius: BorderRadius.circular(30),
                    ),
                    child: Row(
                      children: [
                        _SleepControl(
                          icon: controller.isPaused ? Icons.play_arrow_rounded : Icons.pause_rounded,
                          label: controller.isPaused ? '继续' : '暂停',
                          primary: true,
                          onTap: controller.togglePause,
                        ),
                        Container(width: 1, height: 48, color: MianyuColors.border),
                        Expanded(
                          child: DropdownButtonHideUnderline(
                            child: DropdownButton<int>(
                              value: selectedMinutes,
                              isExpanded: true,
                              alignment: Alignment.center,
                              dropdownColor: MianyuColors.surface,
                              icon: const Icon(Icons.keyboard_arrow_down_rounded, color: MianyuColors.primarySoft),
                              items: const [15, 30, 45, 60]
                                  .map((minutes) => DropdownMenuItem(value: minutes, child: Text('$minutes 分钟')))
                                  .toList(),
                              onChanged: controller.isPaused
                                  ? null
                                  : (value) {
                                      if (value == null) return;
                                      setState(() {
                                        selectedMinutes = value;
                                        secondsLeft = value * 60;
                                      });
                                    },
                            ),
                          ),
                        ),
                        Container(width: 1, height: 48, color: MianyuColors.border),
                        _SleepControl(icon: Icons.close_rounded, label: '退出', onTap: _confirmExit),
                      ],
                    ),
                  ),
                  const NonMedicalFooter(),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }

  Future<void> _confirmExit() async {
    final shouldExit = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('结束这次播放？'),
        content: const Text('会停止当前声音并返回首页。这里只记录播放事实，不会把停止操作等同于入睡。'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context, false), child: const Text('继续播放')),
          FilledButton(onPressed: () => Navigator.pop(context, true), child: const Text('结束播放')),
        ],
      ),
    );
    if (shouldExit != true || !mounted) return;
    await AppScope.of(context).stopSleep();
    if (mounted) Navigator.of(context).popUntil((route) => route.isFirst);
  }
}

class _SleepControl extends StatelessWidget {
  const _SleepControl({required this.icon, required this.label, required this.onTap, this.primary = false});
  final IconData icon;
  final String label;
  final VoidCallback onTap;
  final bool primary;

  @override
  Widget build(BuildContext context) => Semantics(
        button: true,
        label: label,
        child: InkResponse(
          onTap: onTap,
          radius: 46,
          child: SizedBox(
            width: 84,
            height: 84,
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Icon(icon, size: 34, color: primary ? MianyuColors.primarySoft : MianyuColors.text),
                const SizedBox(height: 5),
                Text(label),
              ],
            ),
          ),
        ),
      );
}
