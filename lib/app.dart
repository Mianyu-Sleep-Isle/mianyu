import 'package:flutter/material.dart';

import 'app_controller.dart';
import 'presentation/screens/home_screen.dart';
import 'presentation/screens/onboarding_screen.dart';
import 'presentation/theme/app_theme.dart';

class MianyuApp extends StatefulWidget {
  const MianyuApp({super.key});

  @override
  State<MianyuApp> createState() => _MianyuAppState();
}

class _MianyuAppState extends State<MianyuApp> {
  late final AppController controller = AppController();

  @override
  void dispose() {
    controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => AppScope(
        controller: controller,
        child: AnimatedBuilder(
          animation: controller,
          builder: (context, _) => MaterialApp(
            title: '眠屿',
            debugShowCheckedModeBanner: false,
            theme: buildMianyuTheme(),
            home: controller.onboardingComplete ? const AppScaffold() : const OnboardingScreen(),
          ),
        ),
      );
}

class AppScope extends InheritedNotifier<AppController> {
  const AppScope({required AppController controller, required super.child, super.key}) : super(notifier: controller);

  static AppController of(BuildContext context) {
    final scope = context.dependOnInheritedWidgetOfExactType<AppScope>();
    assert(scope != null, 'AppScope is missing above this context');
    return scope!.notifier!;
  }
}

class AppScaffold extends StatelessWidget {
  const AppScaffold({super.key});

  @override
  Widget build(BuildContext context) {
    AppScope.of(context);
    return const Scaffold(body: HomeScreen());
  }
}
