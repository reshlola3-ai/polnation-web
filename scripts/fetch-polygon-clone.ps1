$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'

$projectRoot = Split-Path -Parent $PSScriptRoot
$targetRoot = Join-Path $projectRoot 'public\polygon-clone'
$assetRoot = Join-Path $targetRoot 'assets'
$indexPath = Join-Path $targetRoot 'index.html'
$sourceUrl = 'https://polygon.technology/'

$allowedAssetHosts = @(
  'cdn.prod.website-files.com',
  'polytech-assets.polygon.technology',
  'teamepyc.github.io',
  'cdn.jsdelivr.net',
  'cdnjs.cloudflare.com',
  'd3e54v103j8qbb.cloudfront.net',
  'unpkg.com',
  'wv2sd6.csb.app'
)

$skipHosts = @(
  'www.googletagmanager.com',
  'googletagmanager.com',
  'googleads.g.doubleclick.net',
  'app.termly.io',
  'cdn.intellimize.co',
  'api.intellimize.co',
  'log.intellimize.co',
  '117265402.intellimizeio.com',
  'app.optibase.io',
  'snap.licdn.com',
  'px.ads.linkedin.com',
  'static.ads-twitter.com',
  'www.google-analytics.com'
)

$skipSchemes = @('mailto', 'tel', 'javascript', 'data', 'blob')

New-Item -ItemType Directory -Force -Path $targetRoot | Out-Null
Get-ChildItem -Path $targetRoot -Force | Remove-Item -Recurse -Force
New-Item -ItemType Directory -Force -Path $assetRoot | Out-Null

$downloaded = @{}

function Get-DeterministicAssetPath {
  param(
    [Parameter(Mandatory = $true)]
    [uri] $Uri
  )

  $hostName = ($Uri.Host -replace '[^a-zA-Z0-9.-]', '_')
  $pathPart = $Uri.AbsolutePath.TrimStart('/')
  if ([string]::IsNullOrWhiteSpace($pathPart)) {
    $pathPart = 'index'
  }

  $rawName = [System.IO.Path]::GetFileName($pathPart)
  if ([string]::IsNullOrWhiteSpace($rawName)) {
    $rawName = 'index'
  }

  $safeName = [uri]::UnescapeDataString($rawName) -replace '[^a-zA-Z0-9._-]', '_'
  if ([string]::IsNullOrWhiteSpace([System.IO.Path]::GetExtension($safeName))) {
    $safeName += '.bin'
  }

  $folderHint = if ($pathPart.Contains('/')) {
    ($pathPart.Substring(0, $pathPart.LastIndexOf('/')) -replace '[^a-zA-Z0-9/_-]', '_')
  } else {
    ''
  }

  $hashInput = $Uri.AbsoluteUri.ToLowerInvariant()
  $hash = [System.BitConverter]::ToString(
    [System.Security.Cryptography.SHA1]::Create().ComputeHash(
      [System.Text.Encoding]::UTF8.GetBytes($hashInput)
    )
  ).Replace('-', '').Substring(0, 10).ToLowerInvariant()

  $relativeFolder = Join-Path $hostName $folderHint
  $relativeFolder = $relativeFolder.Trim('\')
  $relativePath = if ([string]::IsNullOrWhiteSpace($relativeFolder)) {
    Join-Path $hostName "${hash}_$safeName"
  } else {
    Join-Path $relativeFolder "${hash}_$safeName"
  }

  return ($relativePath -replace '\\', '/')
}

function Test-DownloadableUri {
  param(
    [Parameter(Mandatory = $true)]
    [string] $Url
  )

  if ([string]::IsNullOrWhiteSpace($Url)) {
    return $false
  }

  foreach ($scheme in $skipSchemes) {
    if ($Url.StartsWith("${scheme}:", [System.StringComparison]::OrdinalIgnoreCase)) {
      return $false
    }
  }

  try {
    $uri = [uri] $Url
  } catch {
    return $false
  }

  if (-not $uri.IsAbsoluteUri) {
    return $false
  }

  if ($skipHosts -contains $uri.Host) {
    return $false
  }

  return $allowedAssetHosts -contains $uri.Host
}

function Save-RemoteFile {
  param(
    [Parameter(Mandatory = $true)]
    [uri] $Uri
  )

  $key = $Uri.AbsoluteUri
  if ($downloaded.ContainsKey($key)) {
    return $downloaded[$key]
  }

  $relativePath = Get-DeterministicAssetPath -Uri $Uri
  $localPath = Join-Path $assetRoot ($relativePath -replace '/', '\')
  $localDir = Split-Path -Parent $localPath
  New-Item -ItemType Directory -Force -Path $localDir | Out-Null

  try {
    Invoke-WebRequest -Uri $Uri.AbsoluteUri -OutFile $localPath
    $downloaded[$key] = $relativePath
    return $relativePath
  } catch {
    if (Test-Path $localPath) {
      Remove-Item -LiteralPath $localPath -Force -ErrorAction SilentlyContinue
    }
    Write-Warning "Skipping asset download for $($Uri.AbsoluteUri): $($_.Exception.Message)"
    $downloaded[$key] = $null
    return $null
  }
}

function Get-AbsoluteUrl {
  param(
    [Parameter(Mandatory = $true)]
    [string] $Url,
    [Parameter(Mandatory = $true)]
    [uri] $BaseUri
  )

  if ($Url.StartsWith('//')) {
    return "$($BaseUri.Scheme):$Url"
  }

  try {
    return ([uri]::new($BaseUri, $Url)).AbsoluteUri
  } catch {
    return $null
  }
}

function Localize-TextContent {
  param(
    [Parameter(Mandatory = $true)]
    [string] $Content,
    [Parameter(Mandatory = $true)]
    [uri] $BaseUri
  )

  $pattern = '(?<url>(https?:\/\/|\/\/)[^"''\s)<>]+)'
  return [regex]::Replace($Content, $pattern, {
    param($match)
    $rawUrl = $match.Groups['url'].Value
    $absoluteUrl = Get-AbsoluteUrl -Url $rawUrl -BaseUri $BaseUri
    if (-not $absoluteUrl) {
      return $rawUrl
    }
    if (-not (Test-DownloadableUri -Url $absoluteUrl)) {
      return $rawUrl
    }

    $relativePath = Save-RemoteFile -Uri ([uri] $absoluteUrl)
    if ([string]::IsNullOrWhiteSpace($relativePath)) {
      return $rawUrl
    }
    return "./assets/$relativePath"
  })
}

$homeResponse = Invoke-WebRequest -Uri $sourceUrl
$homeHtml = $homeResponse.Content
$homeBaseUri = [uri] $sourceUrl

$scriptStripPatterns = @(
  '<script[^>]*googletagmanager[^<]*</script>',
  '<script[^>]*google-analytics[^<]*</script>',
  '<script[^>]*intellimize[^<]*</script>',
  '<script[^>]*optibase[^<]*</script>',
  '<script[^>]*linkedin[^<]*</script>',
  '<script[^>]*ads-twitter[^<]*</script>',
  '<noscript>\s*<img[^>]*px\.ads\.linkedin\.com[^<]*</noscript>',
  '<script[^>]*termly[^<]*</script>',
  '<script>\s*window\.dataLayer = window\.dataLayer \|\| \[\];[\s\S]*?<\/script>',
  '<script>\(function\(w,d,s,l,i\)\{w\[l\]=w\[l\]\|\|\[\];w\[l\]\.push\(\{''gtm\.start''[\s\S]*?<\/script>',
  '<script type="text\/javascript">\s*_linkedin_partner_id = "9547313";[\s\S]*?<\/script>',
  '<script>\s*!function\(e,t,n,s,u,a\)\{e\.twq[\s\S]*?<\/script>',
  '<script type="text\/javascript">\s*\(function\(l\)\s*\{[\s\S]*?snap\.licdn\.com\/li\.lms-analytics\/insight\.min\.js[\s\S]*?<\/script>',
  '<noscript><iframe src="https:\/\/www\.googletagmanager\.com\/ns\.html\?id=GTM-KQ9THKT"[\s\S]*?<\/iframe><\/noscript>',
  '<noscript><iframe src="https:\/\/www\.googletagmanager\.com\/ns\.html\?id=GTM-NRG47BSK"[\s\S]*?<\/iframe><\/noscript>'
)

foreach ($pattern in $scriptStripPatterns) {
  $homeHtml = [regex]::Replace($homeHtml, $pattern, '', 'IgnoreCase,Singleline')
}

$homeHtml = $homeHtml -replace '<link href="https://cdn\.prod\.website-files\.com" rel="preconnect" crossorigin="anonymous"/>', ''
$homeHtml = $homeHtml -replace '<link href="https://api\.intellimize\.co"[^>]+>', ''
$homeHtml = $homeHtml -replace '<link href="https://log\.intellimize\.co"[^>]+>', ''
$homeHtml = $homeHtml -replace '<link href="https://117265402\.intellimizeio\.com"[^>]+>', ''
$homeHtml = $homeHtml -replace '<link href="https://cdn\.intellimize\.co/snippet/117265402\.js" rel="preload" as="script"/>', ''
$homeHtml = $homeHtml -replace '<script[^>]*>var wfClientScript=document\.createElement\("script"\);wfClientScript\.src="https://cdn\.intellimize\.co/snippet/117265402\.js"[\s\S]*?<\/script>', ''
$homeHtml = $homeHtml -replace '<link href="https://polygon\.technology" rel="canonical"/>', '<link href="/polygon-clone/index.html" rel="canonical"/>'
$homeHtml = $homeHtml -replace '<style>\.anti-flicker, \.anti-flicker \* \{visibility: hidden !important; opacity: 0 !important;\}</style>', ''
$homeHtml = $homeHtml -replace 'localStorage\.removeItem\(''intellimize_opt_out_117265402''\); if \(localStorage\.getItem\(''intellimize_data_tracking_type''\) !== ''always''\) \{ localStorage\.setItem\(''intellimize_data_tracking_type'', ''always''\); \}', ''

$homeHtml = Localize-TextContent -Content $homeHtml -BaseUri $homeBaseUri

Get-ChildItem -Path $assetRoot -Recurse -File | ForEach-Object {
  if ($_.Extension -in @('.css', '.js', '.html', '.json')) {
    $raw = Get-Content $_.FullName -Raw
    $baseUri = $null

    foreach ($entry in $downloaded.GetEnumerator()) {
      $candidate = Join-Path $assetRoot ($entry.Value -replace '/', '\')
      if ([System.IO.Path]::GetFullPath($candidate) -eq $_.FullName) {
        $baseUri = [uri] $entry.Key
        break
      }
    }

    if ($baseUri) {
      $localized = Localize-TextContent -Content $raw -BaseUri $baseUri
      Set-Content -Path $_.FullName -Value $localized -NoNewline
    }
  }
}

Set-Content -Path $indexPath -Value $homeHtml -NoNewline
Write-Host "Polygon clone written to $indexPath"
