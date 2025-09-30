 Get-ChildItem -Recurse |  Where-Object { $_.Attributes -match "ReparsePoint" } | Select FullName
