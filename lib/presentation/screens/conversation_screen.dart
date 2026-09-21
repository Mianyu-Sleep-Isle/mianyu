import 'package:flutter/material.dart';

import '../../app.dart';
import '../../domain/contracts.dart';
import '../theme/app_theme.dart';
import '../widgets/components.dart';
import 'room_editor_screen.dart';

class ConversationScreen extends StatefulWidget {
  const ConversationScreen({super.key});

  @override
  State<ConversationScreen> createState() => _ConversationScreenState();
}

class _ConversationScreenState extends State<ConversationScreen> {
  Emotion emotion = Emotion.calm;
  VoicePreference voice = VoicePreference.unspecified;
  int minutes = 30;
  String? preset;
  final forbidden = <String>{};
  bool showSentence = false;

  static const presets = [
    '赶作业，想听雨，不要打雷。',
    '明天考试，只剩十五分钟。',
    '不要人声。',
    '心情不好，想有人陪一会儿。',
  ];

  Future<void> generate() async {
    if (preset?.contains('考试') ?? false) minutes = 15;
    if (preset?.contains('不要人声') ?? false) voice = VoicePreference.avoid;
    if (preset?.contains('想有人陪') ?? false) emotion = Emotion.wantsCompany;
    if (preset?.contains('不要打雷') ?? false) forbidden.add('远雷');
    await AppScope.of(context).composePlan(SleepIntentDto(
      emotion: emotion,
      voicePreference: voice,
      availableMinutes: minutes,
      forbiddenTags: forbidden.toList(),
      presetSentence: preset,
    ));
    if (mounted) setState(() => showSentence = false);
  }

  @override
  Widget build(BuildContext context) {
    final controller = AppScope.of(context);
    final childMode = controller.ageMode == AgeMode.child;
    return Scaffold(
      appBar: AppBar(title: const Text('今晚沟通')),
      body: AmbientBackground(
        child: AdaptiveBody(
          padding: const EdgeInsets.fromLTRB(20, 12, 20, 32),
          child: ListView(
            children: [
              const PageHeader(
                title: '今晚想怎么被陪伴？',
                subtitle: '默认用点选，不用把所有感受都说清楚。',
              ),
              const SizedBox(height: 16),
              if (childMode)
                const Align(alignment: Alignment.centerLeft, child: Chip(avatar: Icon(Icons.lock_outline_rounded, size: 18), label: Text('儿童模式 · 自由对话已锁')))
              else
                SegmentedButton<bool>(
                  segments: const [
                    ButtonSegment(value: false, label: Text('点选'), icon: Icon(Icons.touch_app_outlined)),
                    ButtonSegment(value: true, label: Text('说一句'), icon: Icon(Icons.chat_bubble_outline_rounded)),
                  ],
                  selected: {showSentence},
                  onSelectionChanged: (value) => setState(() => showSentence = value.first),
                  showSelectedIcon: false,
                  style: const ButtonStyle(minimumSize: WidgetStatePropertyAll(Size(120, 48))),
                ),
              const SizedBox(height: 24),
              if (showSentence && !childMode) ...[
                TextField(
                  minLines: 2,
                  maxLines: 4,
                  decoration: const InputDecoration(labelText: '说说今晚的状态', hintText: '例如：想听雨，但不要雷声……', helperText: '这段文字只用于生成今晚方案，演示版不会永久保存。'),
                  onChanged: (value) => preset = value,
                ),
                const SizedBox(height: 24),
              ] else ...[
                const SectionTitle('现在的情绪'),
                const SizedBox(height: 10),
                Wrap(
                  spacing: 8,
                  runSpacing: 8,
                  children: {
                    Emotion.calm: '平静',
                    Emotion.anxious: '有点紧张',
                    Emotion.excited: '思绪停不下',
                    Emotion.wantsCompany: '想有人陪',
                  }.entries.map((entry) => ChoiceChip(label: Text(entry.value), selected: emotion == entry.key, onSelected: (_) => setState(() => emotion = entry.key))).toList(),
                ),
                const SizedBox(height: 22),
                const SectionTitle('要不要人声'),
                const SizedBox(height: 10),
                Wrap(
                  spacing: 8,
                  runSpacing: 8,
                  children: {
                    VoicePreference.want: '想听故事',
                    VoicePreference.avoid: '不要人声',
                    VoicePreference.unspecified: '都可以',
                  }.entries.map((entry) => ChoiceChip(label: Text(entry.value), selected: voice == entry.key, onSelected: (_) => setState(() => voice = entry.key))).toList(),
                ),
                const SizedBox(height: 22),
                SectionTitle('可用时间', trailing: Text('$minutes 分钟', style: const TextStyle(color: MianyuColors.accentSoft, fontWeight: FontWeight.w700))),
                Slider(value: minutes.toDouble(), min: 15, max: 60, divisions: 3, label: '$minutes 分钟', onChanged: (value) => setState(() => minutes = value.round())),
                const SizedBox(height: 8),
                const SectionTitle('今晚不要出现'),
                const SizedBox(height: 10),
                Wrap(
                  spacing: 8,
                  runSpacing: 8,
                  children: ['远雷', '键盘', '人声'].map((tag) => FilterChip(label: Text(tag), selected: forbidden.contains(tag), onSelected: (_) => setState(() => forbidden.contains(tag) ? forbidden.remove(tag) : forbidden.add(tag)))).toList(),
                ),
                const SizedBox(height: 26),
                const SectionTitle('也可以直接选一句', caption: '四条预制句覆盖 MVP 演示路径'),
                const SizedBox(height: 10),
                ...presets.map((value) => Padding(
                      padding: const EdgeInsets.only(bottom: 10),
                      child: _PresetTile(value: value, selected: preset == value, onTap: () => setState(() => preset = value)),
                    )),
              ],
              const SizedBox(height: 8),
              PrimaryButton(
                label: controller.plan == null ? '生成今晚方案' : '重新生成方案',
                icon: Icons.auto_awesome_outlined,
                loading: controller.isGenerating,
                onPressed: generate,
              ),
              if (controller.plan != null) ...[
                const SizedBox(height: 28),
                const SectionTitle('给你的建议', caption: '方案来自结构化规则，可继续修改'),
                const SizedBox(height: 12),
                PlanCard(plan: controller.plan!),
                const SizedBox(height: 14),
                Row(
                  children: [
                    Expanded(child: GhostButton(label: '修改点选', icon: Icons.tune_rounded, onPressed: () => Scrollable.ensureVisible(context))),
                    const SizedBox(width: 12),
                    Expanded(child: GhostButton(label: '去房间预览', icon: Icons.window_outlined, onPressed: () => Navigator.of(context).push(MaterialPageRoute(builder: (_) => const RoomEditorScreen())))),
                  ],
                ),
                const SizedBox(height: 12),
                PrimaryButton(label: '确认方案，去布置房间', icon: Icons.check_circle_outline_rounded, onPressed: () => Navigator.of(context).push(MaterialPageRoute(builder: (_) => const RoomEditorScreen()))),
              ],
            ],
          ),
        ),
      ),
    );
  }
}

class _PresetTile extends StatelessWidget {
  const _PresetTile({required this.value, required this.selected, required this.onTap});
  final String value;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) => Semantics(
        selected: selected,
        button: true,
        label: value,
        child: InkWell(
          onTap: onTap,
          borderRadius: BorderRadius.circular(MianyuRadius.md),
          child: Ink(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: selected ? MianyuColors.primary.withValues(alpha: .22) : MianyuColors.surface,
              borderRadius: BorderRadius.circular(MianyuRadius.md),
              border: Border.all(color: selected ? MianyuColors.primarySoft : MianyuColors.border, width: selected ? 1.6 : 1),
            ),
            child: Row(
              children: [
                Icon(selected ? Icons.check_circle_rounded : Icons.chat_bubble_outline_rounded, color: selected ? MianyuColors.primarySoft : MianyuColors.textMuted),
                const SizedBox(width: 12),
                Expanded(child: Text(value, style: const TextStyle(fontSize: 15))),
              ],
            ),
          ),
        ),
      );
}
