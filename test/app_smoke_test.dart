import 'package:flutter_test/flutter_test.dart';
import 'package:mianyu_app/app.dart';

void main() {
  testWidgets('首次启动展示年龄门与非医疗流程入口', (tester) async {
    await tester.pumpWidget(const MianyuApp());
    expect(find.text('选择内容模式'), findsOneWidget);
    expect(find.text('成人模式'), findsOneWidget);
    expect(find.text('儿童模式'), findsOneWidget);
  });
}
