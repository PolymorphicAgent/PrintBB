<#
.SYNOPSIS
    Batch-resize PNG images using ImageMagick.

.DESCRIPTION
    Resizes all PNG files in the current directory to multiple resolutions.
    Output files are named using the format:

        <X>_<res>.<ext>

    Where X can be:
      - A per-file override (NameMap)
      - The file's basename (default)

.PARAMETER resolutions
    List of square resolutions to generate (e.g. 16, 32, 64).

.PARAMETER nameMap
    Per-file overrides mapping input filenames to X values.
    Keys must match the input filename exactly (e.g. "icon.png").

.PARAMETER Help
    Displays usage information and examples.

.EXAMPLE
    .\resize-icons.ps1

.EXAMPLE
    .\resize-icons.ps1 -resolutions 64,128

.EXAMPLE
    .\resize-icons.ps1 -namePrefix appicon

.EXAMPLE
    .\resize-icons.ps1 -nameMap @{ "icon.png" = "app"; "logo.png" = "brand" }

.EXAMPLE
    .\resize-icons.ps1 `
        -namePrefix default `
        -nameMap @{ "icon.png" = "appicon" }
#>

param (
    [string[]]$resolutions = @(
        "16","32","48","64","72","96","128","256","512","1024"
    ),

    # Per-file override: "file.png" = "X" in "<X>_<res>.<ext>"
    [hashtable]$nameMap = @{},

    [switch]$Help
)

if ($Help) {
    Write-Host @"
resize-icons.ps1
----------------

Resizes PNG images using ImageMagick.

Output format:
  <X>_<res>.png

X resolution priority:
  1. nameMap override
  2. File basename

Usage:
  .\resize-icons.ps1 [options]

Options:
  -resolutions <string[]>
      List of resolutions to generate
      Default: 16 32 48 64 72 96 128 256 512 1024

  -nameMap <hashtable>
      Per-file override map
      Example:
        @{ "icon.png" = "appicon"; "logo.png" = "brand" }

  -Help
      Show this help text

Examples:
  .\resize-icons.ps1
  .\resize-icons.ps1 -resolutions 64,128
  .\resize-icons.ps1 -nameMap @{ "icon.png" = "app"; "logo.png" = "brand" }

"@
    return
}


$command = "magick {0} -resize {1} .\{2}\{3}_{1}{4}"

foreach ($file in Get-ChildItem *.png) {

    $baseName = $file.BaseName
    $fileName = $file.Name

    # Resolve X priority:
    # 1. nameMap[file.png]
    # 2. file basename
    if ($nameMap.ContainsKey($fileName)) {
        $x = $nameMap[$fileName]
    }
    else {
        $x = $baseName
    }

    New-Item -Path ./$x -ItemType Directory -ErrorAction SilentlyContinue | Out-Null

    Write-Host ("Created ./{0}!" -f $x)

    foreach ($res in $resolutions) {
		
	$cmd = $command -f `
            $file.FullName,   # {0}
            $res,             # {1}
            $x,               # {2} output folder
            $x,               # {3} X in "<X>_<res>"
            $file.Extension   # {4}

        & cmd /c $cmd

        Write-Host ("Created {0}_{1}{2}" -f $x, $res, $file.Extension)

    }

}
