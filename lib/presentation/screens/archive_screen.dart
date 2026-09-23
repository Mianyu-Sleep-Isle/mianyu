import 'package:flutter/material.dart';

import '../../app.dart';
import '../../domain/contracts.dart';
import '../theme/app_theme.dart';
import '../widgets/components.dart';
import 'feedback_screen.dart';
import 'points_screen.dart';

class ArchiveScreen extends StatelessWidget {
  const ArchiveScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final controller = AppScope.of(context);
    return AmbientBackground(
      child: AdaptiveBody(
        padding: const EdgeInsets.fromLTRB(20, 24, 20, 112),
        child: ListView(
          children: [
            PageHeader(
              title: '睡眠档案',
              subtitle: '这里记录使用与感受，不生成睡眠分期，也不判断你是否睡着。',
              trailing: IconButton(
                tooltip: '查看积分',
                onPressed: () => Navigator.of(context).push(MaterialPageRoute(builder: (_) => const PointsScreen())),
                icon: const Icon(Icons.stars_outlined, color: MianyuColors.accentSoft),
              ),
            ),
            const SizedBox(height: 22),
            if (!controller.feedbackSubmitted) ...[
              SurfaceCard(
                color: const Color(0xFF182C50),
                child: Row(
                  children: [
                    const Icon(Icons.wb_sunny_outlined, size: 32, color: MianyuColors.accentSoft),
                    const SizedBox(width: 14),
                    const Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text('有一份次日反馈待完成', style: TextStyle(fontWeight: FontWeight.w700)),
                          SizedBox(height: 4),
                          Text('三个选择即可，也可以稍后再填。'),
                        ],
                      ),
                    ),
                    TextButton(onPressed: () => Navigator.of(context).push(MaterialPageRoute(builder: (_) => const FeedbackScreen())), child: const Text('去填写')),
                  ],
                ),
              ),
              const SizedBox(height: 24),
            ],
            const SectionTitle('最近记录', caption: '每条都保留来源，播放记录只表达应用使用事实'),
            const SizedBox(height: 12),
            _ArchiveEntry(
              date: '9 月 17 日 · 昨晚',
              title: controller.plan?.type.label ?? '纯声景',
              details: controller.session == null ? '演示记录 · 播放 24 分钟' : '播放 ${controller.session!.playbackMinutes} 分钟 · ${controller.scene?.name ?? '睡前小屋'}',
              sources: const [RecordSource.playbackRecord],
              feedback: controller.feedbackSubmitted ? '感觉一般，声音舒适' : null,
            ),
            const SizedBox(height: 12),
            const _ArchiveEntry(
              date: '9 月 15 日',
              title: '短故事＋声景',
              details: '播放 31 分钟 · 雨夜小屋',
              sources: [RecordSource.playbackRecord, RecordSource.subjectiveFeedback],
              feedback: '感觉较容易入睡，下次看情况是否需要人声',
            ),
            const SizedBox(height: 12),
            const _ArchiveEntry(
              date: '9 月 13 日',
              title: '呼吸＋声景',
              details: '播放 18 分钟 · 室内暖声',
              sources: [RecordSource.playbackRecord],
            ),
            const SizedBox(height: 26),
            const SectionTitle('近期使用节律', caption: '只统计开始过睡前计划的日期'),
            const SizedBox(height: 12),
            const _RhythmCard(),
            const NonMedicalFooter(),
          ],
        ),
      ),
    );
  }
}

class _ArchiveEntry extends StatelessWidget {
  const _ArchiveEntry({required this.date, required this.title, required this.details, required this.sources, this.feedback});
  final String date;
  final String title;
  final String details;
  final List<RecordSource> sources;
  final String? feedback;

  @override
  Widget build(BuildContext context) => SurfaceCard(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(date, style: const TextStyle(color: MianyuColors.primarySoft, fontWeight: FontWeight.w700)),
            const SizedBox(height: 7),
            Text(title, style: Theme.of(context).textTheme.titleLarge),
            const SizedBox(height: 5),
            Text(details),
            if (feedback != null) ...[
              const SizedBox(height: 8),
              Text(feedback!, style: const TextStyle(color: MianyuColors.textMuted)),
            ],
            const SizedBox(height: 12),
            Wrap(spacing: 8, runSpacing: 8, children: sources.map(SourceTag.new).toList()),
          ],
        ),
      );
}

class _RhythmCard extends StatelessWidget {
  const _RhythmCard();

  @override
  Widget build(BuildContext context) {
    const active = [true, false, true, true, false, false, true];
    const labels = ['四', '五', '六', '日', '一', '二', '三'];
    return SurfaceCard(
      child: Semantics(
        label: '最近七天有四天开始过自己的睡前计划，不表示睡眠质量。',
        child: Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: List.generate(7, (index) => Column(
                children: [
                  Container(
                    width: 34,
                    height: 34,
                    decoration: BoxDecoration(
                      color: active[index] ? MianyuColors.primary : MianyuColors.night,
                      shape: BoxShape.circle,
                      border: Border.all(color: active[index] ? MianyuColors.primarySoft : MianyuColors.border),
                    ),
                    child: Icon(active[index] ? Icons.nights_stay_rounded : Icons.remove_rounded, size: 17, color: active[index] ? Colors.white : MianyuColors.textMuted),
                  ),
                  const SizedBox(height: 7),
                  Text(labels[index], style: const TextStyle(fontSize: 12, color: MianyuColors.textMuted)),
                ],
              )),
        ),
      ),
    );
  }
}
