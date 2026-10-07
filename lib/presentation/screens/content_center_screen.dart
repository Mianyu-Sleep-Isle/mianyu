import 'package:flutter/material.dart';

import '../../app.dart';
import '../../domain/contracts.dart';
import '../theme/app_theme.dart';
import '../widgets/components.dart';

class ContentCenterScreen extends StatefulWidget {
  const ContentCenterScreen({super.key});

  @override
  State<ContentCenterScreen> createState() => _ContentCenterScreenState();
}

class _ContentCenterScreenState extends State<ContentCenterScreen> with SingleTickerProviderStateMixin {
  late final TabController tabController = TabController(length: 5, vsync: this);
  static const tabs = ['声音', '故事', '呼吸', '预设', '收藏'];

  @override
  void dispose() {
    tabController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => Scaffold(
        appBar: AppBar(
          title: const Text('内容中心'),
          bottom: TabBar(
            controller: tabController,
            isScrollable: true,
            tabAlignment: TabAlignment.start,
            tabs: tabs.map((item) => Tab(text: item)).toList(),
          ),
        ),
        body: AmbientBackground(
          child: TabBarView(
            controller: tabController,
            children: tabs.map((category) => _ContentList(category: category)).toList(),
          ),
        ),
      );
}

class _ContentList extends StatelessWidget {
  const _ContentList({required this.category});
  final String category;

  @override
  Widget build(BuildContext context) {
    final controller = AppScope.of(context);
    return FutureBuilder<List<ContentItemDto>>(
      future: controller.ports.catalog.list(category: category, ageMode: controller.ageMode),
      builder: (context, snapshot) {
        if (!snapshot.hasData) {
          return const Center(child: CircularProgressIndicator.adaptive());
        }
        final items = snapshot.data!;
        return AdaptiveBody(
          padding: const EdgeInsets.fromLTRB(20, 20, 20, 32),
          child: ListView.separated(
            itemCount: items.length + 1,
            separatorBuilder: (_, __) => const SizedBox(height: 12),
            itemBuilder: (context, index) {
              if (index == 0) {
                return Padding(
                  padding: const EdgeInsets.only(bottom: 8),
                  child: PageHeader(
                    title: category,
                    subtitle: _subtitle(category),
                    trailing: category == '收藏' ? const Icon(Icons.favorite_border_rounded, color: MianyuColors.primarySoft) : null,
                  ),
                );
              }
              final item = items[index - 1];
              return _ContentCard(item: item);
            },
          ),
        );
      },
    );
  }

  String _subtitle(String value) => switch (value) {
        '声音' => '试听不等于进入睡眠模式；远雷仅用于禁忌验证。',
        '故事' => '只展示符合年龄模式的内容，模板通过审核才可播放。',
        '呼吸' => '简短、结构化的引导会在结束后自动进入声景。',
        '预设' => '选择后进入编辑器，仍可修改声音位置和音量。',
        _ => '相同场景不会重复出现。',
      };
}

class _ContentCard extends StatelessWidget {
  const _ContentCard({required this.item});
  final ContentItemDto item;

  @override
  Widget build(BuildContext context) {
    final controller = AppScope.of(context);
    final usable = item.canUse(controller.ageMode);
    final reason = item.id == 'A12'
        ? '远雷仅用于禁忌验证，默认方案不会选择'
        : item.reviewStatus != ContentReviewStatus.approved
            ? '这个故事还不能播放'
            : !item.enabled
                ? '声音暂时不能用'
                : null;
    return Semantics(
      button: usable,
      enabled: usable,
      label: '${item.name}，${usable ? '可用' : reason}',
      child: InkWell(
        onTap: usable ? () => Navigator.of(context).push(MaterialPageRoute(builder: (_) => ContentDetailScreen(item: item))) : null,
        borderRadius: BorderRadius.circular(MianyuRadius.md),
        child: Ink(
          padding: const EdgeInsets.all(12),
          decoration: BoxDecoration(
            color: MianyuColors.surface.withValues(alpha: usable ? .96 : .55),
            border: Border.all(color: usable ? MianyuColors.border : MianyuColors.border.withValues(alpha: .5)),
            borderRadius: BorderRadius.circular(MianyuRadius.md),
          ),
          child: Row(
            children: [
              ClipRRect(
                borderRadius: BorderRadius.circular(14),
                child: Image.asset(item.assetPath, width: 78, height: 78, fit: BoxFit.cover, opacity: AlwaysStoppedAnimation(usable ? 1 : .5)),
              ),
              const SizedBox(width: 14),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Expanded(child: Text(item.name, style: Theme.of(context).textTheme.titleMedium)),
                        Text('${item.durationMinutes} 分钟', style: const TextStyle(color: MianyuColors.textMuted, fontSize: 12)),
                      ],
                    ),
                    const SizedBox(height: 5),
                    Text(reason ?? item.description, style: TextStyle(color: usable ? MianyuColors.textMuted : MianyuColors.danger)),
                    const SizedBox(height: 8),
                    Wrap(
                      spacing: 8,
                      runSpacing: 6,
                      children: [
                        _MiniTag(text: item.ageMode == AgeMode.child ? '全年龄' : '成人'),
                        _MiniTag(text: item.reviewStatus == ContentReviewStatus.approved ? '已审核' : '待审核'),
                      ],
                    ),
                  ],
                ),
              ),
              const SizedBox(width: 8),
              Icon(usable ? Icons.chevron_right_rounded : Icons.lock_outline_rounded, color: usable ? MianyuColors.textMuted : MianyuColors.danger),
            ],
          ),
        ),
      ),
    );
  }
}

class _MiniTag extends StatelessWidget {
  const _MiniTag({required this.text});
  final String text;

  @override
  Widget build(BuildContext context) => Container(
        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
        decoration: BoxDecoration(color: MianyuColors.night, borderRadius: BorderRadius.circular(MianyuRadius.pill)),
        child: Text(text, style: const TextStyle(fontSize: 11, color: MianyuColors.textMuted)),
      );
}

class ContentDetailScreen extends StatelessWidget {
  const ContentDetailScreen({required this.item, super.key});
  final ContentItemDto item;

  @override
  Widget build(BuildContext context) {
    final controller = AppScope.of(context);
    final playable = item.canUse(controller.ageMode);
    final isStory = item.category == '故事';
    return Scaffold(
      appBar: AppBar(title: Text(item.name)),
      body: AmbientBackground(
        child: AdaptiveBody(
          padding: const EdgeInsets.fromLTRB(20, 12, 20, 32),
          child: ListView(
            children: [
              ClipRRect(
                borderRadius: BorderRadius.circular(MianyuRadius.lg),
                child: AspectRatio(
                  aspectRatio: 16 / 10,
                  child: Image.asset(item.assetPath, fit: BoxFit.cover),
                ),
              ),
              const SizedBox(height: 22),
              Row(
                children: [
                  Expanded(child: Text(item.name, style: Theme.of(context).textTheme.headlineMedium)),
                  IconButton(onPressed: () {}, tooltip: '收藏', icon: const Icon(Icons.favorite_border_rounded)),
                ],
              ),
              const SizedBox(height: 8),
              Text(item.description, style: Theme.of(context).textTheme.bodyLarge?.copyWith(color: MianyuColors.textMuted)),
              const SizedBox(height: 18),
              SurfaceCard(
                child: Column(
                  children: [
                    _DetailRow(icon: Icons.timer_outlined, label: '时长', value: '${item.durationMinutes} 分钟'),
                    const Divider(),
                    _DetailRow(icon: Icons.interests_outlined, label: '主题', value: item.category),
                    const Divider(),
                    _DetailRow(icon: Icons.child_care_outlined, label: '年龄包', value: item.ageMode == AgeMode.child ? '全年龄 / 儿童可用' : '成人'),
                    const Divider(),
                    _DetailRow(icon: Icons.verified_outlined, label: '审核状态', value: item.reviewStatus == ContentReviewStatus.approved ? '审核通过' : '尚未通过'),
                    if (isStory) ...[
                      const Divider(),
                      const _DetailRow(icon: Icons.record_voice_over_outlined, label: '内容标注', value: '模板故事 · 非真人陪伴'),
                    ],
                  ],
                ),
              ),
              const SizedBox(height: 22),
              if (!playable) const ErrorBanner(message: '这个故事还不能播放。通过审核后再试。'),
              if (!playable) const SizedBox(height: 12),
              PrimaryButton(
                label: controller.previewingId == item.id ? '停止试听' : '试听',
                icon: controller.previewingId == item.id ? Icons.stop_rounded : Icons.play_arrow_rounded,
                onPressed: playable ? () => controller.togglePreview(item.id) : null,
              ),
              const NonMedicalFooter(),
            ],
          ),
        ),
      ),
    );
  }
}

class _DetailRow extends StatelessWidget {
  const _DetailRow({required this.icon, required this.label, required this.value});
  final IconData icon;
  final String label;
  final String value;

  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.symmetric(vertical: 7),
        child: Row(
          children: [
            Icon(icon, size: 21, color: MianyuColors.primarySoft),
            const SizedBox(width: 12),
            Expanded(child: Text(label, style: const TextStyle(color: MianyuColors.textMuted))),
            Flexible(child: Text(value, textAlign: TextAlign.end, style: const TextStyle(fontWeight: FontWeight.w600))),
          ],
        ),
      );
}
