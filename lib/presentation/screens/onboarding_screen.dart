import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../app.dart';
import '../../domain/contracts.dart';
import '../theme/app_theme.dart';
import '../widgets/components.dart';

class OnboardingScreen extends StatefulWidget {
  const OnboardingScreen({super.key});

  @override
  State<OnboardingScreen> createState() => _OnboardingScreenState();
}

class _OnboardingScreenState extends State<OnboardingScreen> {
  final pageController = PageController();
  final pinController = TextEditingController();
  int step = 0;
  AgeMode mode = AgeMode.adult;
  bool usePin = false;
  bool accepted = false;
  final selectedPreferences = <String>{'小雨'};

  @override
  void dispose() {
    pageController.dispose();
    pinController.dispose();
    super.dispose();
  }

  void next() {
    if (step < 3) {
      pageController.nextPage(duration: const Duration(milliseconds: 220), curve: Curves.easeOutCubic);
    } else {
      AppScope.of(context).finishOnboarding(mode: mode, pin: mode == AgeMode.child && usePin, accepted: accepted);
    }
  }

  @override
  Widget build(BuildContext context) => Scaffold(
        body: AmbientBackground(
          image: 'assets/images/scenes/bedroom.png',
          overlayOpacity: .72,
          child: SafeArea(
            child: Column(
              children: [
                Padding(
                  padding: const EdgeInsets.fromLTRB(20, 14, 20, 8),
                  child: Row(
                    children: [
                      ClipRRect(
                        borderRadius: BorderRadius.circular(14),
                        child: Image.asset('assets/images/brand/app_icon.png', width: 48, height: 48, fit: BoxFit.cover),
                      ),
                      const SizedBox(width: 12),
                      const Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text('眠屿', style: TextStyle(fontSize: 22, fontWeight: FontWeight.w800)),
                            Text('在声音里，遇见更好的自己', style: TextStyle(color: MianyuColors.textMuted, fontSize: 13)),
                          ],
                        ),
                      ),
                      Text('${step + 1} / 4', style: const TextStyle(color: MianyuColors.textMuted)),
                    ],
                  ),
                ),
                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 20),
                  child: LinearProgressIndicator(
                    value: (step + 1) / 4,
                    minHeight: 4,
                    borderRadius: BorderRadius.circular(4),
                    backgroundColor: MianyuColors.surfaceRaised,
                    color: MianyuColors.primarySoft,
                  ),
                ),
                Expanded(
                  child: PageView(
                    controller: pageController,
                    physics: const NeverScrollableScrollPhysics(),
                    onPageChanged: (value) => setState(() => step = value),
                    children: [
                      _AgeStep(mode: mode, onChanged: (value) => setState(() => mode = value)),
                      _PinStep(
                        mode: mode,
                        usePin: usePin,
                        pinController: pinController,
                        onChanged: (value) => setState(() => usePin = value),
                        onPinChanged: (_) => setState(() {}),
                      ),
                      _NoticeStep(accepted: accepted, onChanged: (value) => setState(() => accepted = value)),
                      _PreferenceStep(selected: selectedPreferences, onToggle: (value) => setState(() => selectedPreferences.contains(value) ? selectedPreferences.remove(value) : selectedPreferences.add(value))),
                    ],
                  ),
                ),
                Padding(
                  padding: const EdgeInsets.fromLTRB(20, 8, 20, 20),
                  child: Row(
                    children: [
                      if (step > 0)
                        Expanded(
                          child: GhostButton(
                            label: '上一步',
                            icon: Icons.arrow_back_rounded,
                            onPressed: () => pageController.previousPage(duration: const Duration(milliseconds: 180), curve: Curves.easeOut),
                          ),
                        ),
                      if (step > 0) const SizedBox(width: 12),
                      Expanded(
                        flex: 2,
                        child: PrimaryButton(
                          label: step == 3 ? '进入眠屿' : '继续',
                          onPressed: (step == 1 && mode == AgeMode.child && usePin && pinController.text.length != 4) ||
                                  (step >= 2 && !accepted)
                              ? null
                              : next,
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ),
      );
}

class _StepBody extends StatelessWidget {
  const _StepBody({required this.eyebrow, required this.title, required this.description, required this.child});
  final String eyebrow;
  final String title;
  final String description;
  final Widget child;

  @override
  Widget build(BuildContext context) => AdaptiveBody(
        padding: const EdgeInsets.fromLTRB(20, 32, 20, 16),
        child: ListView(
          children: [
            Text(eyebrow, style: const TextStyle(color: MianyuColors.accentSoft, fontWeight: FontWeight.w700, letterSpacing: 1.2)),
            const SizedBox(height: 10),
            Text(title, style: Theme.of(context).textTheme.displaySmall),
            const SizedBox(height: 12),
            Text(description, style: Theme.of(context).textTheme.bodyLarge?.copyWith(color: MianyuColors.textMuted)),
            const SizedBox(height: 28),
            child,
          ],
        ),
      );
}

class _AgeStep extends StatelessWidget {
  const _AgeStep({required this.mode, required this.onChanged});
  final AgeMode mode;
  final ValueChanged<AgeMode> onChanged;

  @override
  Widget build(BuildContext context) => _StepBody(
        eyebrow: '先从适合你的内容开始',
        title: '选择内容模式',
        description: '儿童模式使用同一套页面，但会过滤成人故事与自由对话。你之后可以在设置里更改。',
        child: SegmentedButton<AgeMode>(
          segments: const [
            ButtonSegment(value: AgeMode.adult, icon: Icon(Icons.person_outline_rounded), label: Text('成人模式')),
            ButtonSegment(value: AgeMode.child, icon: Icon(Icons.child_care_rounded), label: Text('儿童模式')),
          ],
          selected: {mode},
          onSelectionChanged: (value) => onChanged(value.first),
          style: const ButtonStyle(minimumSize: WidgetStatePropertyAll(Size.fromHeight(56))),
        ),
      );
}

class _PinStep extends StatelessWidget {
  const _PinStep({
    required this.mode,
    required this.usePin,
    required this.pinController,
    required this.onChanged,
    required this.onPinChanged,
  });
  final AgeMode mode;
  final bool usePin;
  final TextEditingController pinController;
  final ValueChanged<bool> onChanged;
  final ValueChanged<String> onPinChanged;

  @override
  Widget build(BuildContext context) => _StepBody(
        eyebrow: '本机保护',
        title: mode == AgeMode.child ? '为敏感入口设置 PIN' : '不需要额外设置',
        description: mode == AgeMode.child
            ? 'PIN 只保存在本机，用于解锁自由对话和成人内容。界面不会回显或记录明文。'
            : '成人模式可直接继续；如果之后切换儿童模式，再设置本机 PIN 即可。',
        child: SurfaceCard(
          child: Column(
            children: [
              SwitchListTile.adaptive(
                value: mode == AgeMode.child && usePin,
                onChanged: mode == AgeMode.child ? onChanged : null,
                title: const Text('启用本机 PIN'),
                subtitle: const Text('用于解锁自由对话与成人内容'),
                secondary: const Icon(Icons.lock_outline_rounded, color: MianyuColors.primarySoft),
                contentPadding: EdgeInsets.zero,
              ),
              if (mode == AgeMode.child && usePin) ...[
                const SizedBox(height: 8),
                TextField(
                  controller: pinController,
                  onChanged: onPinChanged,
                  keyboardType: TextInputType.number,
                  obscureText: true,
                  maxLength: 4,
                  inputFormatters: [FilteringTextInputFormatter.digitsOnly],
                  autofillHints: const [AutofillHints.newPassword],
                  decoration: const InputDecoration(
                    labelText: '设置 4 位 PIN',
                    hintText: '仅保存在本机',
                    prefixIcon: Icon(Icons.password_rounded),
                    counterText: '',
                  ),
                ),
                const SizedBox(height: 6),
                Align(
                  alignment: Alignment.centerLeft,
                  child: Text(
                    pinController.text.length == 4 ? 'PIN 已就绪' : '请输入 4 位数字后继续',
                    style: TextStyle(
                      color: pinController.text.length == 4 ? MianyuColors.success : MianyuColors.textMuted,
                      fontSize: 12,
                    ),
                  ),
                ),
              ],
            ],
          ),
        ),
      );
}

class _NoticeStep extends StatelessWidget {
  const _NoticeStep({required this.accepted, required this.onChanged});
  final bool accepted;
  final ValueChanged<bool> onChanged;

  @override
  Widget build(BuildContext context) => _StepBody(
        eyebrow: '使用前说明',
        title: '感受比猜测更重要',
        description: '眠屿会记录你的选择、播放操作与次日反馈，但不会把停止操作等同于入睡，也不会提供医疗诊断。',
        child: SurfaceCard(
          child: Column(
            children: [
              const ListTile(
                contentPadding: EdgeInsets.zero,
                leading: Icon(Icons.fact_check_outlined, color: MianyuColors.primarySoft),
                title: Text('数据会标明来源'),
                subtitle: Text('主观反馈 / 播放记录 / 推测（非测量）'),
              ),
              const Divider(),
              CheckboxListTile(
                value: accepted,
                onChanged: (value) => onChanged(value ?? false),
                controlAffinity: ListTileControlAffinity.leading,
                contentPadding: EdgeInsets.zero,
                title: const Text('我已阅读并理解非医疗说明'),
              ),
            ],
          ),
        ),
      );
}

class _PreferenceStep extends StatelessWidget {
  const _PreferenceStep({required this.selected, required this.onToggle});
  final Set<String> selected;
  final ValueChanged<String> onToggle;

  @override
  Widget build(BuildContext context) => _StepBody(
        eyebrow: '可选',
        title: '先选几种舒服的声音',
        description: '这一步可以跳过。每晚明确选择和禁忌始终优先于历史偏好。',
        child: Wrap(
          spacing: 10,
          runSpacing: 10,
          children: ['小雨', '壁炉', '翻书声', '微风', '水流声', '夜晚森林']
              .map((value) => FilterChip(
                    label: Text(value),
                    selected: selected.contains(value),
                    onSelected: (_) => onToggle(value),
                    avatar: Icon(selected.contains(value) ? Icons.check_rounded : Icons.graphic_eq_rounded, size: 18),
                  ))
              .toList(),
        ),
      );
}
