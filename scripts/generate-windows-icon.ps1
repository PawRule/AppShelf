param(
  [string]$Source = "assets/app-icon/appshelf-icon-window.png",
  [string]$Out = "assets/app-icon/appshelf-icon.ico"
)

Add-Type -AssemblyName System.Drawing

$sourcePath = if ([System.IO.Path]::IsPathRooted($Source)) {
  $Source
} else {
  Join-Path (Get-Location) $Source
}

$outPath = if ([System.IO.Path]::IsPathRooted($Out)) {
  $Out
} else {
  Join-Path (Get-Location) $Out
}

$outDir = Split-Path -Parent $outPath
New-Item -ItemType Directory -Force -Path $outDir | Out-Null

$sourceImage = [System.Drawing.Image]::FromFile($sourcePath)
$bitmap = [System.Drawing.Bitmap]::new(256, 256, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
$graphics = [System.Drawing.Graphics]::FromImage($bitmap)
$graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
$graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
$graphics.Clear([System.Drawing.Color]::Transparent)
$graphics.DrawImage($sourceImage, 0, 0, 256, 256)

$stream = [System.IO.MemoryStream]::new()
$bitmap.Save($stream, [System.Drawing.Imaging.ImageFormat]::Png)
$pngBytes = $stream.ToArray()

$file = [System.IO.File]::Create($outPath)
$writer = [System.IO.BinaryWriter]::new($file)

try {
  # ICO header: reserved, image type, image count.
  $writer.Write([UInt16]0)
  $writer.Write([UInt16]1)
  $writer.Write([UInt16]1)

  # Directory entry. Width/height 0 means 256 in ICO files.
  $writer.Write([byte]0)
  $writer.Write([byte]0)
  $writer.Write([byte]0)
  $writer.Write([byte]0)
  $writer.Write([UInt16]1)
  $writer.Write([UInt16]32)
  $writer.Write([UInt32]$pngBytes.Length)
  $writer.Write([UInt32]22)
  $writer.Write($pngBytes)
} finally {
  $writer.Dispose()
  $stream.Dispose()
  $graphics.Dispose()
  $bitmap.Dispose()
  $sourceImage.Dispose()
}

Write-Output $outPath
