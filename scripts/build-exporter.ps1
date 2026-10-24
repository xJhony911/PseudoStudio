param([string]$Compiler = 'g++')
$ErrorActionPreference = 'Stop'
$root = Split-Path $PSScriptRoot -Parent
$source = Join-Path $root 'vendor/pseint'
$core = @('utils','global','intercambio','zcurlib','new_evaluar','new_funciones','new_memoria','new_programa','zcurlib_lnx','zcurlib_win','LangSettings','DataValue')
$files = @($core | ForEach-Object { Join-Path $source "pseint/$_.cpp" }) + @(Get-ChildItem -LiteralPath (Join-Path $source 'psexport') -Filter '*.cpp' | ForEach-Object { $_.FullName })
$output = Join-Path $root 'engine/psexport.exe'
& $Compiler '-std=c++14' '-O2' '-DNDEBUG' '-DWIN32' '-D_FOR_PSEXPORT' '-ffloat-store' '-static' '-static-libgcc' '-static-libstdc++' '-I' (Join-Path $source 'pseint') @files '-lwsock32' '-o' $output
if ($LASTEXITCODE -ne 0) { throw 'Falló la compilación del exportador PSeInt.' }
Write-Output "Exportador compilado: $output"


