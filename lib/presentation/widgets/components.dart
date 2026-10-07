import 'package:flutter/material.dart';

import '../../domain/contracts.dart';
import '../theme/app_theme.dart';

class AmbientBackground extends StatelessWidget {
  const AmbientBackground({
    required this.child,
    super.key,
    this.image,
    this.overlayOpacity = .62,
  });

  final Widget child;
  final String? image;
  final double overlayOpacity;

  @override
  Widget build(BuildContext context) {
    return DecoratedBox(
      decoration: BoxDecoration(
        color: MianyuColors.night,
        image: image == null
            ? null
            : DecorationImage(
                image: AssetImage(image!),
                fit: BoxFit.cover,
                colorFilter: ColorFilter.mode(MianyuColors.nightDeep.withValues(alpha: overlayOpacity), BlendMode.srcOver),
              ),
        gradient: image == null
            ? const LinearGradient(
                begin: Alignment.topCenter,
                end: Alignment.bottomCenter,
                colors: [Color(0xFF102654), MianyuColors.night, MianyuColors.nightDeep],
              )
            : null,
      ),
      child: child,
    );
  }
}

class AdaptiveBody extends StatelessWidget {
  const AdaptiveBody({required this.child, super.key, this.padding = const EdgeInsets.all(MianyuSpacing.md)});
  final Widget child;
  final EdgeInsets padding;

  @override
  Widget build(BuildContext context) => LayoutBuilder(
        builder: (context, constraints) {
          final horizontal = constraints.maxWidth >= 840 ? 48.0 : padding.left;
          return Align(
            alignment: Alignment.topCenter,
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 920),
              child: Padding(
                padding: EdgeInsets.fromLTRB(horizontal, padding.top, horizontal, padding.bottom),
                child: child,
              ),
            ),
          );
        },
      );
}

class PageHeader extends StatelessWidget {
  const PageHeader({required this.title, required this.subtitle, super.key, this.trailing});
  final String title;
  final String subtitle;
  final Widget? trailing;

  @override
  Widget build(BuildContext context) => Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(title, style: Theme.of(context).textTheme.headlineMedium),
                const SizedBox(height: 6),
                Text(subtitle, style: Theme.of(context).textTheme.bodyMedium),
              ],
            ),
          ),
          if (trailing != null) ...[const SizedBox(width: 12), trailing!],
        ],
      );
}

class SectionTitle extends StatelessWidget {
  const SectionTitle(this.title, {super.key, this.caption, this.trailing});
  final String title;
  final String? caption;
  final Widget? trailing;

  @override
  Widget build(BuildContext context) => Row(
        crossAxisAlignment: CrossAxisAlignment.end,
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(title, style: Theme.of(context).textTheme.titleLarge),
                if (caption != null) ...[
                  const SizedBox(height: 4),
                  Text(caption!, style: Theme.of(context).textTheme.bodyMedium),
                ],
              ],
            ),
          ),
          if (trailing != null) trailing!,
        ],
      );
}

class SurfaceCard extends StatelessWidget {
  const SurfaceCard({required this.child, super.key, this.padding = const EdgeInsets.all(16), this.color});
  final Widget child;
  final EdgeInsets padding;
  final Color? color;

  @override
  Widget build(BuildContext context) => Card(
        color: color,
        child: Padding(padding: padding, child: child),
      );
}

class PrimaryButton extends StatelessWidget {
  const PrimaryButton({required this.label, required this.onPressed, super.key, this.icon = Icons.arrow_forward_rounded, this.loading = false});
  final String label;
  final VoidCallback? onPressed;
  final IconData icon;
  final bool loading;

  @override
  Widget build(BuildContext context) => SizedBox(
        width: double.infinity,
        height: 52,
        child: FilledButton.icon(
          onPressed: loading ? null : onPressed,
          style: FilledButton.styleFrom(
            backgroundColor: MianyuColors.accent,
            foregroundColor: MianyuColors.nightDeep,
            disabledBackgroundColor: MianyuColors.surfaceRaised,
            disabledForegroundColor: MianyuColors.textMuted,
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(MianyuRadius.pill)),
          ),
          icon: loading
              ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2))
              : Icon(icon, semanticLabel: null),
          label: Text(label),
        ),
      );
}

class GhostButton extends StatelessWidget {
  const GhostButton({required this.label, required this.onPressed, super.key, this.icon});
  final String label;
  final VoidCallback? onPressed;
  final IconData? icon;

  @override
  Widget build(BuildContext context) => SizedBox(
        height: 48,
        child: OutlinedButton.icon(
          onPressed: onPressed,
          icon: icon == null ? const SizedBox.shrink() : Icon(icon, size: 20),
          label: Text(label),
          style: OutlinedButton.styleFrom(
            foregroundColor: MianyuColors.text,
            side: const BorderSide(color: MianyuColors.border),
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(MianyuRadius.pill)),
          ),
        ),
      );
}

class SourceTag extends StatelessWidget {
  const SourceTag(this.source, {super.key});
  final RecordSource source;

  @override
  Widget build(BuildContext context) {
    final icon = switch (source) {
      RecordSource.playbackRecord => Icons.play_circle_outline_rounded,
      RecordSource.subjectiveFeedback => Icons.person_outline_rounded,
      RecordSource.inference => Icons.info_outline_rounded,
    };
    return Semantics(
      label: '记录来源：${source.label}',
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
        decoration: BoxDecoration(
          color: MianyuColors.surfaceRaised,
          borderRadius: BorderRadius.circular(MianyuRadius.pill),
          border: Border.all(color: MianyuColors.border),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            ExcludeSemantics(child: Icon(icon, size: 16, color: MianyuColors.primarySoft)),
            const SizedBox(width: 6),
            Text(source.label, style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600)),
          ],
        ),
      ),
    );
  }
}

class PlanCard extends StatelessWidget {
  const PlanCard({required this.plan, super.key, this.compact = false});
  final SleepPlanDto plan;
  final bool compact;

  @override
  Widget build(BuildContext context) => SurfaceCard(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Expanded(child: Text('今晚 · ${plan.type.label}', style: Theme.of(context).textTheme.titleLarge)),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                  decoration: BoxDecoration(color: MianyuColors.primary.withValues(alpha: .2), borderRadius: BorderRadius.circular(MianyuRadius.pill)),
                  child: Text(plan.source.label, style: const TextStyle(color: MianyuColors.primarySoft, fontWeight: FontWeight.w700, fontSize: 12)),
                ),
              ],
            ),
            const SizedBox(height: 12),
            Text(plan.reason, style: Theme.of(context).textTheme.bodyLarge),
            const SizedBox(height: 14),
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: [
                _MetaPill(icon: Icons.timer_outlined, text: '${plan.durationMinutes} 分钟'),
                _MetaPill(icon: Icons.volume_down_rounded, text: '渐弱 ${plan.fadeOutMinutes} 分钟'),
                if (plan.storyName != null) _MetaPill(icon: Icons.auto_stories_outlined, text: '模板故事 · ${plan.storyName}'),
              ],
            ),
            if (!compact) ...[
              const SizedBox(height: 16),
              Text('音轨', style: Theme.of(context).textTheme.titleMedium),
              const SizedBox(height: 8),
              Wrap(spacing: 8, runSpacing: 8, children: plan.tracks.map((track) => TrackChip(track: track)).toList()),
            ],
          ],
        ),
      );
}

class _MetaPill extends StatelessWidget {
  const _MetaPill({required this.icon, required this.text});
  final IconData icon;
  final String text;

  @override
  Widget build(BuildContext context) => Container(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 7),
        decoration: BoxDecoration(color: MianyuColors.night.withValues(alpha: .65), borderRadius: BorderRadius.circular(MianyuRadius.pill)),
        child: Row(mainAxisSize: MainAxisSize.min, children: [Icon(icon, size: 17, color: MianyuColors.accentSoft), const SizedBox(width: 6), Text(text)]),
      );
}

class TrackChip extends StatelessWidget {
  const TrackChip({required this.track, super.key, this.disabledReason});
  final TrackRefDto track;
  final String? disabledReason;

  @override
  Widget build(BuildContext context) => Tooltip(
        message: disabledReason ?? track.name,
        child: Chip(
          avatar: CircleAvatar(backgroundImage: AssetImage(track.assetPath), backgroundColor: MianyuColors.night),
          label: Text(disabledReason == null ? track.name : '${track.name} · 不可用'),
          labelStyle: TextStyle(color: disabledReason == null ? MianyuColors.text : MianyuColors.textMuted),
        ),
      );
}

class NonMedicalFooter extends StatelessWidget {
  const NonMedicalFooter({super.key});
  @override
  Widget build(BuildContext context) => Semantics(
        label: '非医疗声明',
        child: const Padding(
          padding: EdgeInsets.symmetric(vertical: 20),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(Icons.health_and_safety_outlined, size: 16, color: MianyuColors.textMuted),
              SizedBox(width: 7),
              Flexible(child: Text('眠屿不是医疗产品，不能诊断失眠。', textAlign: TextAlign.center, style: TextStyle(fontSize: 12, color: MianyuColors.textMuted))),
            ],
          ),
        ),
      );
}

class EmptyState extends StatelessWidget {
  const EmptyState({required this.title, required this.message, super.key, this.action});
  final String title;
  final String message;
  final Widget? action;

  @override
  Widget build(BuildContext context) => SurfaceCard(
        child: Column(
          children: [
            const Icon(Icons.nightlight_round, size: 42, color: MianyuColors.primarySoft),
            const SizedBox(height: 12),
            Text(title, style: Theme.of(context).textTheme.titleMedium),
            const SizedBox(height: 6),
            Text(message, textAlign: TextAlign.center),
            if (action != null) ...[const SizedBox(height: 16), action!],
          ],
        ),
      );
}

class ErrorBanner extends StatelessWidget {
  const ErrorBanner({required this.message, super.key, this.onRetry});
  final String message;
  final VoidCallback? onRetry;

  @override
  Widget build(BuildContext context) => Semantics(
        liveRegion: true,
        child: Container(
          padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(
            color: MianyuColors.danger.withValues(alpha: .12),
            border: Border.all(color: MianyuColors.danger.withValues(alpha: .7)),
            borderRadius: BorderRadius.circular(MianyuRadius.sm),
          ),
          child: Row(
            children: [
              const Icon(Icons.error_outline_rounded, color: MianyuColors.danger),
              const SizedBox(width: 10),
              Expanded(child: Text(message)),
              if (onRetry != null) TextButton(onPressed: onRetry, child: const Text('重试')),
            ],
          ),
        ),
      );
}
