import 'package:flutter/material.dart';

import '../../app.dart';
import '../theme/app_theme.dart';
import '../widgets/components.dart';

class PrivacyScreen extends StatelessWidget {
  const PrivacyScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final controller = AppScope.of(context);
    return Scaffold(
      appBar: AppBar(title: const Text('隐私中心')),
      body: AmbientBackground(
        child: AdaptiveBody(
          padding: const EdgeInsets.fromLTRB(20, 12, 20, 32),
          child: ListView(
            children: [
              const PageHeader(title: '你的数据由你决定', subtitle: '每类敏感信息单独授权；撤回后会调用公共清理入口。'),
              const SizedBox(height: 22),
              SurfaceCard(
                child: Column(
                  children: controller.consent.entries.map((entry) => Column(
                        children: [
                          SwitchListTile.adaptive(
                            contentPadding: EdgeInsets.zero,
                            value: entry.value,
                            onChanged: (value) => controller.updateConsent(entry.key, value),
                            title: Text(entry.key),
                            subtitle: Text(_consentCopy(entry.key)),
                          ),
                          if (entry.key != controller.consent.keys.last) const Divider(),
                        ],
                      )).toList(),
                ),
              ),
              const SizedBox(height: 12),
              const SurfaceCard(
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Icon(Icons.info_outline_rounded, color: MianyuColors.primarySoft),
                    SizedBox(width: 12),
                    Expanded(child: Text('对话原文、明文 PIN、访问令牌和原始录音不会进入核心记录。推测默认关闭。')),
                  ],
                ),
              ),
              const SizedBox(height: 28),
              const SectionTitle('本机数据', caption: '删除方案、场景、播放记录、反馈、偏好、收藏与积分'),
              const SizedBox(height: 12),
              SurfaceCard(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text('删除后无法恢复', style: TextStyle(fontWeight: FontWeight.w700)),
                    const SizedBox(height: 5),
                    const Text('公共声音和故事素材会保留，不包含你的私人数据。'),
                    const SizedBox(height: 16),
                    SizedBox(
                      width: double.infinity,
                      height: 48,
                      child: OutlinedButton.icon(
                        onPressed: controller.isClearingData ? null : () => _confirmDelete(context),
                        icon: controller.isClearingData
                            ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2))
                            : const Icon(Icons.delete_outline_rounded),
                        label: Text(controller.isClearingData ? '正在清理…' : '删除本机数据'),
                        style: OutlinedButton.styleFrom(foregroundColor: MianyuColors.danger, side: const BorderSide(color: MianyuColors.danger)),
                      ),
                    ),
                  ],
                ),
              ),
              const NonMedicalFooter(),
            ],
          ),
        ),
      ),
    );
  }

  static String _consentCopy(String key) => switch (key) {
        '对话相关' => '默认关闭；用于个性化方案，不永久保存原文',
        '播放摘要' => '记录开始、暂停与结束，只表达应用使用事实',
        '噪声摘要' => '默认关闭；仅在单独授权后生成摘要',
        _ => '默认关闭；外部设备属于非 MVP 可选输入',
      };

  Future<void> _confirmDelete(BuildContext context) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('删除全部本机数据？'),
        content: const Text('会清理方案、场景、记录、反馈、偏好、收藏和积分。这个操作无法撤销。'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context, false), child: const Text('取消')),
          FilledButton(onPressed: () => Navigator.pop(context, true), style: FilledButton.styleFrom(backgroundColor: MianyuColors.danger), child: const Text('确认删除')),
        ],
      ),
    );
    if (confirmed != true || !context.mounted) return;
    await AppScope.of(context).eraseData();
    if (context.mounted) ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('已清理本机数据')));
  }
}
