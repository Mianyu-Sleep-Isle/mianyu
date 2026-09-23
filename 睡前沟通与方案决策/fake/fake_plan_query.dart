/// 模块2 Fake：从内存 Map 查询固定方案。

import 'fake_plan_composer.dart';

abstract interface class PlanQueryPort {
  SleepPlan? 查询方案(String planId);
}

class 假的方案查询器 implements PlanQueryPort {
  假的方案查询器({Map<String, SleepPlan>? 固定方案}) : _方案表 = 固定方案 ?? <String, SleepPlan>{};

  final Map<String, SleepPlan> _方案表;

  @override
  SleepPlan? 查询方案(String planId) => _方案表[planId];

  void 写入方案(SleepPlan 方案) {
    _方案表[方案.planId] = 方案;
  }
}

