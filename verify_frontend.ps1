$ErrorActionPreference = 'Stop'

$scriptPath = $MyInvocation.MyCommand.Path
$projectRoot = if ([string]::IsNullOrWhiteSpace($scriptPath)) {
    (Get-Location).Path
}
else {
    Split-Path -Parent $scriptPath
}
$libRoot = Join-Path $projectRoot 'lib'
$failures = [System.Collections.Generic.List[string]]::new()

function Assert-Check {
    param(
        [bool]$Condition,
        [string]$Message
    )

    if ($Condition) {
        Write-Host "[PASS] $Message" -ForegroundColor Green
    }
    else {
        Write-Host "[FAIL] $Message" -ForegroundColor Red
        $failures.Add($Message)
    }
}

$dartFiles = Get-ChildItem -Path $libRoot -Recurse -Filter '*.dart'
$allSource = ($dartFiles | Get-Content -Raw) -join "`n"
$contractSource = Get-Content -Raw (Join-Path $libRoot 'domain\contracts.dart')

$screenNames = @(
    'OnboardingScreen', 'HomeScreen', 'ConversationScreen', 'ContentCenterScreen',
    'ContentDetailScreen', 'RoomEditorScreen', 'SleepScreen', 'FeedbackScreen',
    'ArchiveScreen', 'PointsScreen', 'PrivacyScreen', 'SettingsScreen'
)
foreach ($screenName in $screenNames) {
    Assert-Check ($allSource -match "class\s+$screenName\s+extends") "页面 $screenName 已实现"
}

$enumCount = ([regex]::Matches($contractSource, '(?m)^enum\s+\w+')).Count
$dtoCount = ([regex]::Matches($contractSource, '(?m)^class\s+\w+Dto\s*\{')).Count
$portCount = ([regex]::Matches($contractSource, '(?m)^abstract interface class\s+\w+Port\s*\{')).Count
Assert-Check ($enumCount -eq 14) '冻结枚举数量为 14'
Assert-Check ($dtoCount -eq 10) '跨模块 DTO 数量为 10'
Assert-Check ($portCount -eq 12) 'Port 接口数量为 12'

$assetFiles = Get-ChildItem -Path (Join-Path $projectRoot 'assets\images') -Recurse -File
$soundAssets = Get-ChildItem -Path (Join-Path $projectRoot 'assets\images\sounds') -Filter '*.png'
 $iconAssets = Get-ChildItem -Path (Join-Path $projectRoot 'assets\images\icons') -Filter '*.svg'
Assert-Check ($assetFiles.Count -eq 42) '视觉素材总数为 42（PNG 30、SVG 源图标 12）'
Assert-Check ($soundAssets.Count -eq 12) '12 个声音素材均已接入'
Assert-Check ($iconAssets.Count -eq 12) '12 个 SVG 声音源图标均已保留'
Assert-Check (Test-Path -LiteralPath (Join-Path $projectRoot 'assets\images\scenes\reference_home.png')) '成员四初始界面参考图已归档'

$assetReferences = [regex]::Matches($allSource, "assets/images/[A-Za-z0-9_./-]+\.png") | ForEach-Object Value | Sort-Object -Unique
foreach ($assetReference in $assetReferences) {
    $resolvedAsset = Join-Path $projectRoot ($assetReference -replace '/', '\')
    Assert-Check (Test-Path -LiteralPath $resolvedAsset) "素材引用存在：$assetReference"
}

$forbiddenPhrases = @('已入睡', '睡眠时长', '深睡', '打鼾', '治疗失眠', '连续打卡失败', '角色失望')
foreach ($phrase in $forbiddenPhrases) {
    Assert-Check (-not $allSource.Contains($phrase)) "界面不含禁用表述：$phrase"
}

$requiredCopy = @(
    '眠屿不是医疗产品，不能诊断失眠。',
    '主观反馈', '播放记录', '推测（非测量）',
    '赶作业，想听雨，不要打雷。',
    '明天考试，只剩十五分钟。',
    '不要人声。',
    '心情不好，想有人陪一会儿。'
)
foreach ($copy in $requiredCopy) {
    Assert-Check ($allSource.Contains($copy)) "关键文案存在：$copy"
}

$pubspec = Get-Content -Raw (Join-Path $projectRoot 'pubspec.yaml')
Assert-Check ($pubspec -match '(?ms)^dependencies:\r?\n  flutter:\r?\n    sdk: flutter\r?\n') '运行时只依赖 Flutter SDK'

$previewSource = Get-Content -Raw (Join-Path $projectRoot 'system_preview.html')
$appPagesSource = Get-Content -Raw (Join-Path $projectRoot 'app_pages.js')
$appPagesStyles = Get-Content -Raw (Join-Path $projectRoot 'app_pages.css')
$completePreviewSource = $previewSource + "`n" + $appPagesSource + "`n" + $appPagesStyles
Assert-Check (-not ($previewSource -match '>P(?:0|1|2|3|4|5|6|7|8|9|10|11)[^<]*<')) '用户预览不显示 P0–P11 开发编号'
Assert-Check (-not $previewSource.Contains('系统预览')) '用户预览不显示“系统预览”开发字样'
Assert-Check ($previewSource.Contains('drag-overlay') -and $previewSource.Contains('drag-preview')) '预览包含拖拽虚像提示层'
Assert-Check ($previewSource.Contains('ghost-float') -and $previewSource.Contains('entity-settle')) '预览包含拖拽与落位动效'
Assert-Check ($previewSource.Contains('sheetHandle') -and $previewSource.Contains('sheet-hidden')) '声音盒支持下拉隐藏'
Assert-Check ($previewSource.Contains('phone.dragging .sound-sheet')) '拖拽时声音盒切换半透明状态'
foreach ($label in @('场景', '我的方案', '收藏', '设置', '开始睡眠', '睡眠模式')) {
    Assert-Check ($previewSource.Contains($label)) "真实用户流程入口存在：$label"
}
foreach ($assetId in 1..12 | ForEach-Object { 'A{0:d2}' -f $_ }) {
    Assert-Check ($previewSource.Contains("id:'$assetId'")) "预览已登记声音素材：$assetId"
}

$previewPages = @(
    'onboardingView', 'homeView', 'conversationView', 'contentView', 'detailView',
    'sceneView', 'sleepView', 'feedbackView', 'archiveView', 'pointsView',
    'privacyView', 'settingsView'
)
foreach ($pageId in $previewPages) {
    Assert-Check ($completePreviewSource.Contains($pageId)) "浏览器预览页面已接入：$pageId"
}
foreach ($label in @('眠屿', '编辑', '档案', '设置')) {
    Assert-Check ($appPagesSource.Contains(">$label<")) "四项主导航存在：$label"
}
foreach ($copy in $requiredCopy) {
    Assert-Check ($completePreviewSource.Contains($copy)) "浏览器预览关键文案存在：$copy"
}
foreach ($phrase in $forbiddenPhrases) {
    Assert-Check (-not $completePreviewSource.Contains($phrase)) "浏览器预览不含禁用表述：$phrase"
}
Assert-Check ($appPagesSource.Contains('夜晚森林') -and $appPagesSource.Contains('远雷')) '内容中心包含完整户外素材'
Assert-Check ($appPagesStyles.Contains('abstract low-light background') -and -not $appPagesStyles.Contains('bedroom.png') -and -not $appPagesStyles.Contains('rain_courtyard.png')) '非编辑页面未复用声景背景图'

$flutterCommand = Get-Command flutter -ErrorAction SilentlyContinue
if ($null -eq $flutterCommand) {
    Write-Host '[INFO] 当前主机未安装 Flutter SDK；跳过 flutter analyze/test。' -ForegroundColor Yellow
}
else {
    Push-Location $projectRoot
    try {
        flutter pub get
        if ($LASTEXITCODE -ne 0) { throw 'flutter pub get 失败' }
        flutter analyze
        if ($LASTEXITCODE -ne 0) { throw 'flutter analyze 失败' }
        flutter test
        if ($LASTEXITCODE -ne 0) { throw 'flutter test 失败' }
    }
    catch {
        $failures.Add($_.Exception.Message)
    }
    finally {
        Pop-Location
    }
}

if ($failures.Count -gt 0) {
    Write-Host "`n验收失败：$($failures.Count) 项。" -ForegroundColor Red
    exit 1
}

Write-Host "`n静态验收通过。" -ForegroundColor Green
