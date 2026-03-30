$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$assetRoot = Join-Path $root "assets"
$pptRoot = Join-Path $assetRoot "ppt"
$slidesRoot = Join-Path $pptRoot "slides"
$demoRoot = Join-Path $assetRoot "demo"
$generatedRoot = Join-Path $assetRoot "generated"
$chromePath = "C:\Program Files\Google\Chrome\Application\chrome.exe"
$demoUrl = "https://cnc.zaojiaqan.xyz/"

$pptPath = (
    Get-ChildItem "C:\Users\jhr66\Downloads" -Filter "*.pptx" |
    Where-Object { $_.BaseName -like "*V1.0*" -and $_.Length -gt 1000000 } |
    Sort-Object LastWriteTime -Descending |
    Select-Object -First 1 -ExpandProperty FullName
)

if (-not $pptPath) {
    throw "No suitable V1.0 product PPT was found in Downloads."
}

New-Item -ItemType Directory -Path $slidesRoot -Force | Out-Null
New-Item -ItemType Directory -Path $demoRoot -Force | Out-Null
New-Item -ItemType Directory -Path $generatedRoot -Force | Out-Null

$tempSlides = Join-Path $env:TEMP "linguacnc_ppt_export"
$tempPpt = Join-Path $env:TEMP "linguacnc_business_plan_source.pptx"

if (Test-Path $tempSlides) {
    Remove-Item -Recurse -Force $tempSlides
}
if (Test-Path $tempPpt) {
    Remove-Item -Force $tempPpt
}

New-Item -ItemType Directory -Path $tempSlides | Out-Null
Copy-Item $pptPath $tempPpt -Force

$power = New-Object -ComObject PowerPoint.Application
$power.Visible = -1
$presentation = $power.Presentations.Open($tempPpt, $true, $false, $false)
$presentation.SaveAs($tempSlides, 18)
$presentation.Close()
$power.Quit()

Get-ChildItem $slidesRoot -File -ErrorAction SilentlyContinue | Remove-Item -Force
$slideFiles = Get-ChildItem $tempSlides -File | Sort-Object { [int]([regex]::Match($_.BaseName, '\d+').Value) }
$index = 1
foreach ($file in $slideFiles) {
    $target = Join-Path $slidesRoot ("slide-{0:D2}.png" -f $index)
    Copy-Item $file.FullName $target -Force
    $index++
}

Remove-Item -Recurse -Force $tempSlides
Remove-Item -Force $tempPpt

if (Test-Path $chromePath) {
    & $chromePath --headless=new --disable-gpu --hide-scrollbars --window-size=1440,1080 --virtual-time-budget=9000 --screenshot="$($demoRoot)\demo-home.png" $demoUrl | Out-Null
}

python (Join-Path $root "generate_business_assets.py")
