import 'package:flutter/material.dart';

import '../../app.dart';
import '../../domain/contracts.dart';
import '../theme/app_theme.dart';
import '../widgets/components.dart';

class FeedbackScreen extends StatefulWidget {
  const FeedbackScreen({super.key});

  @override
  State<FeedbackScreen> createState() => _FeedbackScreenState();
}

class _FeedbackScreenState extends State<FeedbackScreen> {
  String ease = 'normal';
  String comfort = 'comfortable';
  VoicePreference voice = VoicePreference.unspecified;
  final noteController = TextEditingController();
  bool submitting = false;

  @override
  void dispose() {
    noteController.dispose();
    super.dispose();
  }

  Future<void> submit() async {
    setState(() => submitting = true);
    final sessionId = AppScope.of(context).session?.id ?? 'session-demo-previous';
    await AppScope.of(context).submitFeedback(MorningFeedbackDto(
      sessionId: sessionId,
      fallAsleepEase: ease,
      soundComfort: comfort,
      voiceNextTime: voice,
      submittedAt: DateTime.now(),
      note: noteController.text.trim().isEmpty ? null : noteController.text.trim(),
    ));
    if (mounted) setState(() => submitting = false);
  }

  @override
  Widget build(BuildContext context) {
    final submitted = AppScope.of(context).feedbackSubmitted;
    return Scaffold(
      appBar: AppBar(title: const Text('次日反馈')),
      body: AmbientBackground(
        child: AdaptiveBody(
          padding: const EdgeInsets.fromLTRB(20, 12, 20, 32),
          child: ListView(
            children: [
              const PageHeader(title: '昨晚的感受如何？', subtitle: '只需要三个选择。你的主观感受不会被播放记录替代。'),
              const SizedBox(height: 24),
              _QuestionCard(
                number: '01',
                title: '是否容易入睡？',
                child: _ChoiceRow(
                  values: const {'easy': '较容易', 'normal': '一般', 'difficult': '较困难', 'unknown': '无法判断'},
                  selected: ease,
                  onChanged: (value) => setState(() => ease = value),
                ),
              ),
              const SizedBox(height: 12),
              _QuestionCard(
                number: '02',
                title: '声音是否舒服？',
                child: _ChoiceRow(
                  values: const {'comfortable': '舒服', 'acceptable': '可以接受', 'uncomfortable': '不舒服'},
                  selected: comfort,
                  onChanged: (value) => setState(() => comfort = value),
                ),
              ),
              const SizedBox(height: 12),
              _QuestionCard(
                number: '03',
                title: '下次还要不要人声？',
                child: _ChoiceRow<VoicePreference>(
                  values: const {VoicePreference.want: '想要', VoicePreference.avoid: '不要', VoicePreference.unspecified: '看情况'},
                  selected: voice,
                  onChanged: (value) => setState(() => voice = value),
                ),
              ),
              const SizedBox(height: 16),
              TextField(
                controller: noteController,
                maxLines: 3,
                enabled: !submitted,
                decoration: const InputDecoration(labelText: '补充一句（可跳过）', hintText: '例如：雨声可以再小一点'),
              ),
              const SizedBox(height: 18),
              if (submitted) ...[
                const SurfaceCard(
                  color: Color(0xFF123A38),
                  child: Row(
                    children: [
                      Icon(Icons.check_circle_rounded, color: MianyuColors.success),
                      SizedBox(width: 12),
                      Expanded(child: Text('已记入偏好，本次获得 8 积分。重复提交不会重复加分。')),
                    ],
                  ),
                ),
                const SizedBox(height: 12),
              ],
              PrimaryButton(label: submitted ? '已提交' : '提交反馈', icon: Icons.check_rounded, loading: submitting, onPressed: submitted ? null : submit),
              const NonMedicalFooter(),
            ],
          ),
        ),
      ),
    );
  }
}

class _QuestionCard extends StatelessWidget {
  const _QuestionCard({required this.number, required this.title, required this.child});
  final String number;
  final String title;
  final Widget child;

  @override
  Widget build(BuildContext context) => SurfaceCard(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Text(number, style: const TextStyle(color: MianyuColors.primarySoft, fontWeight: FontWeight.w800)),
                const SizedBox(width: 10),
                Expanded(child: Text(title, style: Theme.of(context).textTheme.titleMedium)),
              ],
            ),
            const SizedBox(height: 14),
            child,
          ],
        ),
      );
}

class _ChoiceRow<T> extends StatelessWidget {
  const _ChoiceRow({required this.values, required this.selected, required this.onChanged});
  final Map<T, String> values;
  final T selected;
  final ValueChanged<T> onChanged;

  @override
  Widget build(BuildContext context) => Wrap(
        spacing: 8,
        runSpacing: 8,
        children: values.entries.map((entry) => ChoiceChip(label: Text(entry.value), selected: selected == entry.key, onSelected: (_) => onChanged(entry.key))).toList(),
      );
}
