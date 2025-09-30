$scriptsDir = split-path $MyInvocation.MyCommand.Definition
$rootDir = "$scriptsDir\..\.."
$projectDir = "manualto-service-v1\service"
Remove-Item -Recurse $rootDir\$projectDir\node_modules\@binders\binders-service-common\lib
New-Item -Path $rootDir\$projectDir\node_modules\@binders\binders-service-common\lib -ItemType SymbolicLink -Value $rootDir\binders-service-common-v1\dist\src


