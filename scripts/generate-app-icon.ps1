param(
  [int]$Size = 1024,
  [string]$Out = "assets/app-icon/appshelf-icon-source.png"
)

Add-Type -AssemblyName System.Drawing
Add-Type -AssemblyName System.Windows.Forms

function New-RoundedRectPath {
  param(
    [float]$X,
    [float]$Y,
    [float]$W,
    [float]$H,
    [float]$R
  )

  $path = [System.Drawing.Drawing2D.GraphicsPath]::new()
  $d = $R * 2
  $path.AddArc($X, $Y, $d, $d, 180, 90)
  $path.AddArc($X + $W - $d, $Y, $d, $d, 270, 90)
  $path.AddArc($X + $W - $d, $Y + $H - $d, $d, $d, 0, 90)
  $path.AddArc($X, $Y + $H - $d, $d, $d, 90, 90)
  $path.CloseFigure()
  return $path
}

function S {
  param([float]$Value)
  return $Value * $script:scale
}

$resolvedOut = if ([System.IO.Path]::IsPathRooted($Out)) {
  $Out
} else {
  Join-Path (Get-Location) $Out
}

$outDir = Split-Path -Parent $resolvedOut
New-Item -ItemType Directory -Force -Path $outDir | Out-Null

$script:scale = $Size / 1024
$bmp = [System.Drawing.Bitmap]::new($Size, $Size, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
$graphics = [System.Drawing.Graphics]::FromImage($bmp)
$graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
$graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
$graphics.Clear([System.Drawing.Color]::Transparent)

try {
  $bgPath = New-RoundedRectPath (S 96) (S 96) (S 832) (S 832) (S 174)
  $bgRect = [System.Drawing.RectangleF]::new((S 96), (S 96), (S 832), (S 832))
  $bgBrush = [System.Drawing.Drawing2D.LinearGradientBrush]::new(
    $bgRect,
    [System.Drawing.ColorTranslator]::FromHtml("#2563EB"),
    [System.Drawing.ColorTranslator]::FromHtml("#0F9F7A"),
    45
  )
  $blend = [System.Drawing.Drawing2D.ColorBlend]::new()
  $blend.Positions = [float[]](0, 0.58, 1)
  $blend.Colors = [System.Drawing.Color[]](
    [System.Drawing.ColorTranslator]::FromHtml("#2563EB"),
    [System.Drawing.ColorTranslator]::FromHtml("#087EA4"),
    [System.Drawing.ColorTranslator]::FromHtml("#0F9F7A")
  )
  $bgBrush.InterpolationColors = $blend
  $graphics.FillPath($bgBrush, $bgPath)

  $shadowBrush = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb(50, 6, 78, 107))
  $tileBrush = [System.Drawing.SolidBrush]::new([System.Drawing.ColorTranslator]::FromHtml("#F9FAFB"))
  $arrowBrush = [System.Drawing.SolidBrush]::new([System.Drawing.ColorTranslator]::FromHtml("#087EA4"))

  $tiles = @(
    @(315, 260, 202, 202, 42),
    @(551, 294, 178, 168, 38),
    @(315, 506, 202, 184, 40),
    @(551, 506, 178, 184, 40)
  )

  foreach ($tile in $tiles) {
    $shadow = New-RoundedRectPath (S ($tile[0] + 0)) (S ($tile[1] + 14)) (S $tile[2]) (S $tile[3]) (S $tile[4])
    $graphics.FillPath($shadowBrush, $shadow)
    $shadow.Dispose()
  }

  foreach ($tile in $tiles) {
    $path = New-RoundedRectPath (S $tile[0]) (S $tile[1]) (S $tile[2]) (S $tile[3]) (S $tile[4])
    $graphics.FillPath($tileBrush, $path)
    $path.Dispose()
  }

  $shelfShadow = New-RoundedRectPath (S 254) (S 736) (S 516) (S 37) (S 18.5)
  $graphics.FillPath($shadowBrush, $shelfShadow)
  $shelfShadow.Dispose()

  $shelf = New-RoundedRectPath (S 254) (S 724) (S 516) (S 37) (S 18.5)
  $graphics.FillPath($tileBrush, $shelf)
  $shelf.Dispose()

  $arrow = [System.Drawing.Drawing2D.GraphicsPath]::new()
  $arrow.AddPolygon([System.Drawing.PointF[]](
    [System.Drawing.PointF]::new((S 628), (S 581)),
    [System.Drawing.PointF]::new((S 628), (S 637)),
    [System.Drawing.PointF]::new((S 709), (S 609))
  ))
  $graphics.FillPath($arrowBrush, $arrow)
  $arrow.Dispose()
}
finally {
  if ($bgBrush) { $bgBrush.Dispose() }
  if ($tileBrush) { $tileBrush.Dispose() }
  if ($arrowBrush) { $arrowBrush.Dispose() }
  if ($shadowBrush) { $shadowBrush.Dispose() }
  if ($bgPath) { $bgPath.Dispose() }
  $graphics.Dispose()
}

$bmp.Save($resolvedOut, [System.Drawing.Imaging.ImageFormat]::Png)
$bmp.Dispose()
Write-Output $resolvedOut
