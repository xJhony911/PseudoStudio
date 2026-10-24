param([string]$Compiler = 'g++')
$ErrorActionPreference = 'Stop'
$root = Split-Path $PSScriptRoot -Parent
$source = Join-Path $root 'vendor/pseint/pseint'
$output = Join-Path $root 'engine/pseint.exe'
$names = @('main','intercambio','SynCheck','Ejecutar','global','zockets','utils','zcurlib','new_evaluar','new_memoria','new_funciones','new_programa','case_map','zcurlib_lnx','zcurlib_win','LangSettings','DataValue')
$files = $names | ForEach-Object { Join-Path $source "$_.cpp" }
New-Item -ItemType Directory -Path (Split-Path $output) -Force | Out-Null
& $Compiler '-std=c++14' '-O2' '-DNDEBUG' '-DWIN32' '-DUSE_ZOCKETS' '-ffloat-store' '-static' '-static-libgcc' '-static-libstdc++' @files '-lwsock32' '-o' $output
if ($LASTEXITCODE -ne 0) { throw 'Falló la compilación del motor PSeInt.' }
Write-Output "Motor compilado: $output"
