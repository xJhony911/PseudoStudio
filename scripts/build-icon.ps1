$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing
$root = Split-Path $PSScriptRoot -Parent
$target = Join-Path $root 'build'
New-Item -ItemType Directory -Path $target -Force | Out-Null
$bitmap = New-Object System.Drawing.Bitmap 256,256
$graphics = [System.Drawing.Graphics]::FromImage($bitmap)
$graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
$graphics.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit
$shape = New-Object System.Drawing.Drawing2D.GraphicsPath
$shape.AddArc(8,8,80,80,180,90)
$shape.AddArc(168,8,80,80,270,90)
$shape.AddArc(168,168,80,80,0,90)
$shape.AddArc(8,168,80,80,90,90)
$shape.CloseFigure()
$background = New-Object System.Drawing.Drawing2D.LinearGradientBrush ([System.Drawing.Point]::new(0,0)),([System.Drawing.Point]::new(256,256)),([System.Drawing.ColorTranslator]::FromHtml('#22264e')),([System.Drawing.ColorTranslator]::FromHtml('#0b1124'))
$graphics.FillPath($background,$shape)
$mark = New-Object System.Drawing.Drawing2D.GraphicsPath
$mark.AddLine(72,199,72,62)
$mark.AddLine(72,62,137,62)
$mark.AddBezier(137,62,173,62,194,81,194,111)
$mark.AddBezier(194,111,194,141,173,160,137,160)
$mark.AddLine(137,160,72,160)
$purple = New-Object System.Drawing.Pen ([System.Drawing.ColorTranslator]::FromHtml('#a18aff')),26
$purple.StartCap = $purple.EndCap = [System.Drawing.Drawing2D.LineCap]::Round
$purple.LineJoin = [System.Drawing.Drawing2D.LineJoin]::Round
$mint = New-Object System.Drawing.SolidBrush ([System.Drawing.ColorTranslator]::FromHtml('#69efd7'))
$mintPen = New-Object System.Drawing.Pen $mint,12
$mintPen.StartCap = $mintPen.EndCap = [System.Drawing.Drawing2D.LineCap]::Round
$graphics.DrawPath($purple,$mark)
$graphics.FillPolygon($mint,[System.Drawing.Point[]]@([System.Drawing.Point]::new(119,88),[System.Drawing.Point]::new(151,110),[System.Drawing.Point]::new(119,133)))
$graphics.DrawLine($mintPen,137,160,137,199)
$graphics.DrawLine($mintPen,137,199,192,199)
$graphics.FillRectangle($mint,180,187,24,24)
$purpleBrush = New-Object System.Drawing.SolidBrush ([System.Drawing.ColorTranslator]::FromHtml('#b9a0ff'))
$graphics.FillEllipse($purpleBrush,56,183,32,32)
$png = Join-Path $target 'icon.png'
$bitmap.Save($png,[System.Drawing.Imaging.ImageFormat]::Png)
$bytes = [System.IO.File]::ReadAllBytes($png)
$stream = [System.IO.File]::Create((Join-Path $target 'icon.ico'))
$writer = New-Object System.IO.BinaryWriter $stream
$writer.Write([UInt16]0); $writer.Write([UInt16]1); $writer.Write([UInt16]1)
$writer.Write([byte]0); $writer.Write([byte]0); $writer.Write([byte]0); $writer.Write([byte]0)
$writer.Write([UInt16]1); $writer.Write([UInt16]32); $writer.Write([UInt32]$bytes.Length); $writer.Write([UInt32]22)
$writer.Write($bytes); $writer.Dispose(); $stream.Dispose()
$background.Dispose(); $mark.Dispose(); $mint.Dispose(); $mintPen.Dispose(); $purpleBrush.Dispose(); $purple.Dispose(); $shape.Dispose(); $graphics.Dispose(); $bitmap.Dispose()
