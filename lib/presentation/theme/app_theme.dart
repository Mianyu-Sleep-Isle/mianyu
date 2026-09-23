import 'package:flutter/material.dart';

abstract final class MianyuColors {
  static const night = Color(0xFF07132E);
  static const nightDeep = Color(0xFF030918);
  static const surface = Color(0xFF0E2142);
  static const surfaceRaised = Color(0xFF162D52);
  static const primary = Color(0xFF5C7CFA);
  static const primarySoft = Color(0xFF8FA8FF);
  static const accent = Color(0xFFFFA24C);
  static const accentSoft = Color(0xFFFFD08A);
  static const text = Color(0xFFF5F7FF);
  static const textMuted = Color(0xFFC3CEE7);
  static const border = Color(0xFF38527F);
  static const success = Color(0xFF79C8A4);
  static const danger = Color(0xFFFF8A8A);
}

abstract final class MianyuSpacing {
  static const xxs = 4.0;
  static const xs = 8.0;
  static const sm = 12.0;
  static const md = 16.0;
  static const lg = 24.0;
  static const xl = 32.0;
  static const xxl = 48.0;
}

abstract final class MianyuRadius {
  static const sm = 12.0;
  static const md = 18.0;
  static const lg = 26.0;
  static const pill = 999.0;
}

ThemeData buildMianyuTheme() {
  final scheme = ColorScheme.fromSeed(
    seedColor: MianyuColors.primary,
    brightness: Brightness.dark,
    surface: MianyuColors.surface,
    error: MianyuColors.danger,
  ).copyWith(
    primary: MianyuColors.primary,
    onPrimary: Colors.white,
    secondary: MianyuColors.accent,
    onSecondary: MianyuColors.nightDeep,
    surface: MianyuColors.surface,
    onSurface: MianyuColors.text,
    outline: MianyuColors.border,
  );
  return ThemeData(
    useMaterial3: true,
    brightness: Brightness.dark,
    colorScheme: scheme,
    scaffoldBackgroundColor: MianyuColors.night,
    fontFamilyFallback: const ['Noto Sans SC', 'PingFang SC', 'Microsoft YaHei'],
    textTheme: const TextTheme(
      displaySmall: TextStyle(fontSize: 34, height: 1.18, fontWeight: FontWeight.w700, color: MianyuColors.text),
      headlineMedium: TextStyle(fontSize: 26, height: 1.25, fontWeight: FontWeight.w700, color: MianyuColors.text),
      titleLarge: TextStyle(fontSize: 20, height: 1.35, fontWeight: FontWeight.w700, color: MianyuColors.text),
      titleMedium: TextStyle(fontSize: 17, height: 1.4, fontWeight: FontWeight.w600, color: MianyuColors.text),
      bodyLarge: TextStyle(fontSize: 16, height: 1.6, color: MianyuColors.text),
      bodyMedium: TextStyle(fontSize: 14, height: 1.55, color: MianyuColors.textMuted),
      labelLarge: TextStyle(fontSize: 15, height: 1.3, fontWeight: FontWeight.w600),
    ),
    appBarTheme: const AppBarTheme(
      backgroundColor: Colors.transparent,
      foregroundColor: MianyuColors.text,
      centerTitle: false,
      elevation: 0,
      surfaceTintColor: Colors.transparent,
      titleTextStyle: TextStyle(fontSize: 20, fontWeight: FontWeight.w700, color: MianyuColors.text),
    ),
    cardTheme: CardThemeData(
      color: MianyuColors.surface.withValues(alpha: .94),
      elevation: 0,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(MianyuRadius.md),
        side: const BorderSide(color: MianyuColors.border, width: .8),
      ),
      margin: EdgeInsets.zero,
    ),
    navigationBarTheme: NavigationBarThemeData(
      height: 72,
      backgroundColor: MianyuColors.surface,
      indicatorColor: MianyuColors.primary.withValues(alpha: .22),
      labelTextStyle: WidgetStateProperty.resolveWith((states) => TextStyle(
            fontSize: 12,
            fontWeight: states.contains(WidgetState.selected) ? FontWeight.w700 : FontWeight.w500,
            color: states.contains(WidgetState.selected) ? MianyuColors.text : MianyuColors.textMuted,
          )),
    ),
    chipTheme: ChipThemeData(
      backgroundColor: MianyuColors.surfaceRaised,
      selectedColor: MianyuColors.primary.withValues(alpha: .28),
      disabledColor: MianyuColors.surfaceRaised.withValues(alpha: .42),
      side: const BorderSide(color: MianyuColors.border),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(MianyuRadius.pill)),
      labelStyle: const TextStyle(color: MianyuColors.text),
      secondaryLabelStyle: const TextStyle(color: MianyuColors.text),
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 8),
    ),
    inputDecorationTheme: InputDecorationTheme(
      filled: true,
      fillColor: MianyuColors.surfaceRaised,
      labelStyle: const TextStyle(color: MianyuColors.textMuted),
      hintStyle: const TextStyle(color: MianyuColors.textMuted),
      contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 16),
      border: OutlineInputBorder(borderRadius: BorderRadius.circular(MianyuRadius.md), borderSide: const BorderSide(color: MianyuColors.border)),
      enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(MianyuRadius.md), borderSide: const BorderSide(color: MianyuColors.border)),
      focusedBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(MianyuRadius.md), borderSide: const BorderSide(color: MianyuColors.primary, width: 2)),
    ),
    dividerColor: MianyuColors.border,
    splashFactory: InkRipple.splashFactory,
  );
}
