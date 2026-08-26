# 앱 아이콘 생성 스크립트 (Windows 전용, PowerShell 5.1+)
#   powershell -ExecutionPolicy Bypass -File scripts/make-icons.ps1
# Segoe UI Emoji의 🥨을 브랜드 갈색(#A56A3A)으로 렌더링한 뒤,
# 실제 그려진 픽셀의 경계 상자를 스캔해 캔버스 정중앙에 배치한다.
# 배경은 사이트 배경색(#FDFAF3)과 동일. 산출물:
#   public/icon-512.png · public/icon-192.png · public/apple-touch-icon.png (180)
#   public/favicon.png (192, 투명 배경 + 글리프 최대 크기 — 파비콘 전용)

Add-Type -AssemblyName PresentationCore, PresentationFramework, WindowsBase

$root = Split-Path -Parent $PSScriptRoot
$bgColor = '#FDFAF3'   # 사이트 배경 크림톤 (tailwind body 배경과 동일)
$fgColor = '#A56A3A'   # tailwind pretzel
$glyphRatio = 0.62     # 아이콘 한 변 대비 글리프 최대 크기 비율

# 1) 투명 캔버스에 글리프만 크게 렌더링
$work = 640
$dv = New-Object System.Windows.Media.DrawingVisual
$dc = $dv.RenderOpen()
$fg = New-Object System.Windows.Media.SolidColorBrush ([System.Windows.Media.ColorConverter]::ConvertFromString($fgColor))
$tf = New-Object System.Windows.Media.Typeface 'Segoe UI Emoji'
$ft = New-Object System.Windows.Media.FormattedText('🥨', [System.Globalization.CultureInfo]::InvariantCulture, [System.Windows.FlowDirection]::LeftToRight, $tf, 400, $fg, 1.0)
$pt = New-Object System.Windows.Point(60, 60)
$dc.DrawText($ft, $pt)
$dc.Close()
$rtb = New-Object System.Windows.Media.Imaging.RenderTargetBitmap($work, $work, 96, 96, [System.Windows.Media.PixelFormats]::Pbgra32)
$rtb.Render($dv)

# 2) 알파 채널을 스캔해 실제 그려진 영역의 경계 상자 찾기
$stride = $work * 4
$bytes = New-Object byte[] ($stride * $work)
$rtb.CopyPixels($bytes, $stride, 0)
$minX = $work; $minY = $work; $maxX = -1; $maxY = -1
for ($y = 0; $y -lt $work; $y++) {
  $rowBase = $y * $stride
  for ($x = 0; $x -lt $work; $x++) {
    if ($bytes[$rowBase + $x * 4 + 3] -gt 8) {
      if ($x -lt $minX) { $minX = $x }
      if ($x -gt $maxX) { $maxX = $x }
      if ($y -lt $minY) { $minY = $y }
      if ($y -gt $maxY) { $maxY = $y }
    }
  }
}
if ($maxX -lt 0) { throw '글리프가 렌더링되지 않았어요 (Segoe UI Emoji 확인)' }
$gw = $maxX - $minX + 1
$gh = $maxY - $minY + 1
$cropRect = New-Object System.Windows.Int32Rect($minX, $minY, $gw, $gh)
$glyph = New-Object System.Windows.Media.Imaging.CroppedBitmap($rtb, $cropRect)
Write-Output "glyph bbox: ${gw}x${gh}"

# 3) 512 아이콘 합성 — 경계 상자 기준으로 정중앙 배치
$size = 512
$target = [Math]::Round($size * $glyphRatio)
if ($gw -ge $gh) { $dw = $target; $dh = [Math]::Round($target * $gh / $gw) }
else { $dh = $target; $dw = [Math]::Round($target * $gw / $gh) }
$dx = ($size - $dw) / 2
$dy = ($size - $dh) / 2
$dv2 = New-Object System.Windows.Media.DrawingVisual
$dc2 = $dv2.RenderOpen()
$bg = New-Object System.Windows.Media.SolidColorBrush ([System.Windows.Media.ColorConverter]::ConvertFromString($bgColor))
$bgRect = New-Object System.Windows.Rect(0, 0, $size, $size)
$dc2.DrawRectangle($bg, $null, $bgRect)
$imgRect = New-Object System.Windows.Rect($dx, $dy, $dw, $dh)
$dc2.DrawImage($glyph, $imgRect)
$dc2.Close()
$base = New-Object System.Windows.Media.Imaging.RenderTargetBitmap($size, $size, 96, 96, [System.Windows.Media.PixelFormats]::Pbgra32)
$base.Render($dv2)

function Save-Png([System.Windows.Media.Imaging.BitmapSource]$src, [string]$path) {
  $enc = New-Object System.Windows.Media.Imaging.PngBitmapEncoder
  $enc.Frames.Add([System.Windows.Media.Imaging.BitmapFrame]::Create($src))
  $fs = [System.IO.File]::Create($path)
  try { $enc.Save($fs) } finally { $fs.Close() }
  Write-Output "saved $path"
}

Save-Png $base (Join-Path $root 'public\icon-512.png')

# 4) 512에서 축소해 192 / 180 생성
foreach ($job in @(@{ px = 192; out = 'public\icon-192.png' }, @{ px = 180; out = 'public\apple-touch-icon.png' })) {
  $scale = $job.px / $size
  $t = New-Object System.Windows.Media.ScaleTransform($scale, $scale)
  $small = New-Object System.Windows.Media.Imaging.TransformedBitmap($base, $t)
  Save-Png $small (Join-Path $root $job.out)
}

# 5) 파비콘 — 배경 없이(투명) 글리프를 캔버스 최대 크기로
$fSize = 192
if ($gw -ge $gh) { $fw = $fSize; $fh = [Math]::Round($fSize * $gh / $gw) }
else { $fh = $fSize; $fw = [Math]::Round($fSize * $gw / $gh) }
$fx = ($fSize - $fw) / 2
$fy = ($fSize - $fh) / 2
$dv3 = New-Object System.Windows.Media.DrawingVisual
$dc3 = $dv3.RenderOpen()
$favRect = New-Object System.Windows.Rect($fx, $fy, $fw, $fh)
$dc3.DrawImage($glyph, $favRect)
$dc3.Close()
$fav = New-Object System.Windows.Media.Imaging.RenderTargetBitmap($fSize, $fSize, 96, 96, [System.Windows.Media.PixelFormats]::Pbgra32)
$fav.Render($dv3)
Save-Png $fav (Join-Path $root 'public\favicon.png')
