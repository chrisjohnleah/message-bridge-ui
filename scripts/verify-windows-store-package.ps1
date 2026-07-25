param(
  [Parameter(Mandatory = $true)]
  [string]$PackagePath
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest
Add-Type -AssemblyName System.IO.Compression.FileSystem

$expectedIdentityName = "HappyWebs.MessageBridge"
$expectedPublisher = "CN=4D83A70F-1C90-4ECF-B70B-11A526955C12"
$expectedPublisherDisplayName = "Happy Webs"
$expectedDisplayName = "Message Bridge"

$resolvedPackage = (Resolve-Path -LiteralPath $PackagePath).Path
if ([System.IO.Path]::GetExtension($resolvedPackage) -ne ".appx") {
  throw "Expected an .appx package, received: $resolvedPackage"
}

$extractRoot = Join-Path ([System.IO.Path]::GetTempPath()) (
  "message-bridge-appx-" + [System.Guid]::NewGuid().ToString("N")
)

try {
  [System.IO.Compression.ZipFile]::ExtractToDirectory($resolvedPackage, $extractRoot)

  $manifestPath = Join-Path $extractRoot "AppxManifest.xml"
  if (-not (Test-Path -LiteralPath $manifestPath -PathType Leaf)) {
    throw "AppxManifest.xml is missing from the package"
  }

  $manifestDocument = New-Object System.Xml.XmlDocument
  $manifestDocument.PreserveWhitespace = $true
  $manifestDocument.XmlResolver = $null
  $manifestDocument.Load($manifestPath)

  $namespaceManager = New-Object System.Xml.XmlNamespaceManager(
    $manifestDocument.NameTable
  )
  $namespaceManager.AddNamespace(
    "appx",
    "http://schemas.microsoft.com/appx/manifest/foundation/windows10"
  )

  $identity = $manifestDocument.SelectSingleNode(
    "/appx:Package/appx:Identity",
    $namespaceManager
  )
  if ($null -eq $identity) {
    throw "Package identity is missing from AppxManifest.xml"
  }

  if ($identity.GetAttribute("Name") -ne $expectedIdentityName) {
    throw "Unexpected package identity name: $($identity.GetAttribute('Name'))"
  }
  if ($identity.GetAttribute("Publisher") -ne $expectedPublisher) {
    throw "Unexpected package publisher: $($identity.GetAttribute('Publisher'))"
  }

  $publisherDisplayName = $manifestDocument.SelectSingleNode(
    "/appx:Package/appx:Properties/appx:PublisherDisplayName",
    $namespaceManager
  )
  if (
    $null -eq $publisherDisplayName -or
    $publisherDisplayName.InnerText -ne $expectedPublisherDisplayName
  ) {
    throw "Unexpected publisher display name"
  }

  $displayName = $manifestDocument.SelectSingleNode(
    "/appx:Package/appx:Properties/appx:DisplayName",
    $namespaceManager
  )
  if ($null -eq $displayName -or $displayName.InnerText -ne $expectedDisplayName) {
    throw "Unexpected application display name"
  }

  $application = $manifestDocument.SelectSingleNode(
    "/appx:Package/appx:Applications/appx:Application",
    $namespaceManager
  )
  if ($null -eq $application -or [string]::IsNullOrWhiteSpace(
      $application.GetAttribute("Executable")
    )) {
    throw "Application executable is missing from AppxManifest.xml"
  }

  $applicationPath = Join-Path $extractRoot $application.GetAttribute(
    "Executable"
  )
  if (-not (Test-Path -LiteralPath $applicationPath -PathType Leaf)) {
    throw "Declared application executable is missing from the package"
  }

  $bridgePath = Join-Path $extractRoot "app/resources/bin/whatsapp-bridge.exe"
  if (-not (Test-Path -LiteralPath $bridgePath -PathType Leaf)) {
    throw "Bundled WhatsApp bridge executable is missing from the package"
  }

  Write-Host "Verified Microsoft Store package identity and bundled bridge:"
  Write-Host "  $resolvedPackage"
  Write-Host "  $expectedIdentityName"
  Write-Host "  $expectedPublisher"
} finally {
  if (Test-Path -LiteralPath $extractRoot) {
    Remove-Item -LiteralPath $extractRoot -Recurse -Force
  }
}
