Add-Type -AssemblyName System.Drawing

function New-AppIcon {
    param([int]$Size, [string]$OutPath)

    $bmp = New-Object System.Drawing.Bitmap $Size, $Size
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $g.Clear([System.Drawing.Color]::FromArgb(15, 23, 42))

    $accent = [System.Drawing.Color]::FromArgb(99, 102, 241)
    $g.FillRectangle((New-Object System.Drawing.SolidBrush $accent), 0, 0, $Size, $Size)

    $docW = [int]($Size * 0.42)
    $docH = [int]($Size * 0.52)
    $docX = [int](($Size - $docW) / 2)
    $docY = [int](($Size - $docH) / 2)
    $g.FillRectangle([System.Drawing.Brushes]::White, $docX, $docY, $docW, $docH)

    $linePen = New-Object System.Drawing.Pen $accent, ([Math]::Max(2, $Size / 64))
    $lineY1 = $docY + [int]($docH * 0.35)
    $lineY2 = $docY + [int]($docH * 0.55)
    $lineX1 = $docX + [int]($docW * 0.18)
    $lineX2 = $docX + [int]($docW * 0.82)
    $g.DrawLine($linePen, $lineX1, $lineY1, $lineX2, $lineY1)
    $g.DrawLine($linePen, $lineX1, $lineY2, $docX + [int]($docW * 0.62), $lineY2)

    $dir = Split-Path $OutPath -Parent
    if (-not (Test-Path $dir)) { New-Item -ItemType Directory -Path $dir -Force | Out-Null }
    $bmp.Save($OutPath, [System.Drawing.Imaging.ImageFormat]::Png)

    $g.Dispose()
    $bmp.Dispose()
}

$root = Split-Path $PSScriptRoot -Parent
$iconDir = Join-Path $root 'public\icons'
New-AppIcon -Size 192 -OutPath (Join-Path $iconDir 'icon-192.png')
New-AppIcon -Size 512 -OutPath (Join-Path $iconDir 'icon-512.png')
Write-Host 'Generated PWA icons in public/icons/'
