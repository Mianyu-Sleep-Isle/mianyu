import 'package:flutter/material.dart';

import '../../app.dart';
import '../../domain/contracts.dart';
import '../theme/app_theme.dart';
import '../widgets/components.dart';
import 'points_screen.dart';
import 'privacy_screen.dart';

class SettingsScreen extends StatelessWidget {
  const SettingsScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final controller = AppScope.of(context);
    return AmbientBackground(
      child: AdaptiveBody(
        padding: const EdgeInsets.fromLTRB(20, 24, 20, 112),
        child: ListView(
          children: [
            const PageHeader(title: '我的', subtitle: '年龄模式、PIN、授权与关于都只在这里管理。'),
            const SizedBox(height: 22),
            SurfaceCard(
              child: Row(
                children: [
                  ClipRRect(borderRadius: BorderRadius.circular(18), child: Image.asset('assets/images/brand/app_icon.png', width: 64, height: 64)),
                  const SizedBox(width: 14),
                  Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [const Text('本机匿名用户', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w700)), const SizedBox(height: 4), Text(controller.ageMode.label, style: const TextStyle(color: MianyuColors.textMuted))])),
                  const Icon(Icons.shield_outlined, color: MianyuColors.success),
                ],
              ),
            ),
            const SizedBox(height: 24),
            const SectionTitle('内容与保护'),
            const SizedBox(height: 10),
            SurfaceCard(
              child: Column(
                children: [
                  _SettingsTile(
                    icon: Icons.child_care_rounded,
                    title: '年龄模式',
                    subtitle: controller.ageMode.label,
                    onTap: () => _showAgeMode(context),
                  ),
                  const Divider(),
                  _SettingsTile(
                    icon: Icons.pin_outlined,
                    title: controller.pinConfigured ? '修改本机 PIN' : '设置本机 PIN',
                    subtitle: controller.pinConfigured ? '已启用，不回显明文' : '儿童模式敏感入口保护',
                    onTap: () => _showPin(context),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 24),
            const SectionTitle('数据与成长'),
            const SizedBox(height: 10),
            SurfaceCard(
              child: Column(
                children: [
                  _SettingsTile(icon: Icons.stars_outlined, title: '健康积分', subtitle: '只奖励开始计划与提交反馈', onTap: () => Navigator.of(context).push(MaterialPageRoute(builder: (_) => const PointsScreen()))),
                  const Divider(),
                  _SettingsTile(icon: Icons.privacy_tip_outlined, title: '隐私中心', subtitle: '授权、撤回与删除本机数据', onTap: () => Navigator.of(context).push(MaterialPageRoute(builder: (_) => const PrivacyScreen()))),
                ],
              ),
            ),
            const SizedBox(height: 24),
            const SectionTitle('关于'),
            const SizedBox(height: 10),
            SurfaceCard(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      ClipOval(child: Image.asset('assets/images/brand/app_icon_circle.png', width: 42, height: 42, fit: BoxFit.cover)),
                      const SizedBox(width: 12),
                      const Text('眠屿 MVP', style: TextStyle(fontWeight: FontWeight.w700)),
                    ],
                  ),
                  SizedBox(height: 6),
                  Text('二维/伪 3D 声景 · 规则建议 · 本地优先'),
                  SizedBox(height: 12),
                  Text('播放记录只表达应用使用事实，不展示未经测量的夜间结论。', style: TextStyle(color: MianyuColors.textMuted)),
                ],
              ),
            ),
            const NonMedicalFooter(),
          ],
        ),
      ),
    );
  }

  Future<void> _showAgeMode(BuildContext context) async {
    final controller = AppScope.of(context);
    final choice = await showModalBottomSheet<AgeMode>(
      context: context,
      showDragHandle: true,
      builder: (context) => SafeArea(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(20, 4, 20, 24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text('切换年龄模式', style: Theme.of(context).textTheme.titleLarge),
              const SizedBox(height: 8),
              const Text('儿童模式会过滤成人故事和自由对话，不会开启第二套 App。'),
              const SizedBox(height: 16),
              RadioListTile(value: AgeMode.adult, groupValue: controller.ageMode, onChanged: (value) => Navigator.pop(context, value), title: const Text('成人模式')),
              RadioListTile(value: AgeMode.child, groupValue: controller.ageMode, onChanged: (value) => Navigator.pop(context, value), title: const Text('儿童模式')),
            ],
          ),
        ),
      ),
    );
    if (choice != null && context.mounted) controller.updateAgeMode(choice);
  }

  Future<void> _showPin(BuildContext context) async {
    final input = TextEditingController();
    final saved = await showDialog<bool>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        title: const Text('设置本机 PIN'),
        content: TextField(
          controller: input,
          obscureText: true,
          keyboardType: TextInputType.number,
          autofillHints: const [AutofillHints.password],
          decoration: const InputDecoration(labelText: '4 位 PIN', helperText: '仅保存在本机；演示不会写入日志'),
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(dialogContext, false), child: const Text('取消')),
          FilledButton(onPressed: () => Navigator.pop(dialogContext, input.text.trim().length == 4), child: const Text('保存')),
        ],
      ),
    );
    if (saved == true && context.mounted) AppScope.of(context).setPinConfigured(true);
    input.dispose();
  }
}

class _SettingsTile extends StatelessWidget {
  const _SettingsTile({required this.icon, required this.title, required this.subtitle, required this.onTap});
  final IconData icon;
  final String title;
  final String subtitle;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) => ListTile(
        contentPadding: EdgeInsets.zero,
        minVerticalPadding: 12,
        leading: Container(width: 44, height: 44, decoration: BoxDecoration(color: MianyuColors.primary.withValues(alpha: .15), borderRadius: BorderRadius.circular(13)), child: Icon(icon, color: MianyuColors.primarySoft)),
        title: Text(title),
        subtitle: Text(subtitle),
        trailing: const Icon(Icons.chevron_right_rounded),
        onTap: onTap,
      );
}
