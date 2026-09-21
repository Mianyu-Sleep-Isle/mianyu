import 'package:flutter/material.dart';

import '../../app.dart';
import '../../domain/contracts.dart';
import '../theme/app_theme.dart';
import '../widgets/components.dart';

class PointsScreen extends StatelessWidget {
  const PointsScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final controller = AppScope.of(context);
    return Scaffold(
      appBar: AppBar(title: const Text('健康积分')),
      body: AmbientBackground(
        child: AdaptiveBody(
          padding: const EdgeInsets.fromLTRB(20, 12, 20, 32),
          child: FutureBuilder<List<PointsEntryDto>>(
            future: controller.ports.points.entries(),
            builder: (context, snapshot) {
              final entries = snapshot.data ?? const [];
              final balance = entries.isEmpty ? 0 : entries.last.balanceAfter;
              return ListView(
                children: [
                  SurfaceCard(
                    color: const Color(0xFF26304C),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Text('当前积分', style: TextStyle(color: MianyuColors.textMuted)),
                        const SizedBox(height: 8),
                        Text('$balance', style: const TextStyle(fontSize: 48, fontWeight: FontWeight.w300, color: MianyuColors.accentSoft)),
                        const SizedBox(height: 6),
                        const Text('积分奖励开始计划与提交反馈，不奖励播放时长。'),
                      ],
                    ),
                  ),
                  const SizedBox(height: 24),
                  const SectionTitle('积分记录', caption: '没有连签惩罚，也不会因为中途退出扣分'),
                  const SizedBox(height: 12),
                  if (entries.isEmpty)
                    const EmptyState(title: '还没有积分记录', message: '开始自己的睡前计划，或提交一次次日反馈，就会出现第一条记录。')
                  else
                    ...entries.reversed.map((entry) => Padding(
                          padding: const EdgeInsets.only(bottom: 10),
                          child: SurfaceCard(
                            child: Row(
                              children: [
                                Container(
                                  width: 46,
                                  height: 46,
                                  decoration: BoxDecoration(color: MianyuColors.accent.withValues(alpha: .15), shape: BoxShape.circle),
                                  child: Icon(entry.type == PointsEventType.planStarted ? Icons.play_arrow_rounded : Icons.rate_review_outlined, color: MianyuColors.accentSoft),
                                ),
                                const SizedBox(width: 12),
                                Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [Text(entry.remark, style: const TextStyle(fontWeight: FontWeight.w700)), const SizedBox(height: 3), const Text('应用行为 · 与时长和结果无关', style: TextStyle(fontSize: 12, color: MianyuColors.textMuted))])),
                                Text('+${entry.points}', style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w800, color: MianyuColors.success)),
                              ],
                            ),
                          ),
                        )),
                  const NonMedicalFooter(),
                ],
              );
            },
          ),
        ),
      ),
    );
  }
}
