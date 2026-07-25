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

$packageArchive = [System.IO.Compression.ZipFile]::OpenRead($resolvedPackage)

try {
  $archivePaths = @(
    $packageArchive.Entries | ForEach-Object {
      ($_.FullName -replace "\\", "/") -replace "^[\\/]+", ""
    }
  )

  $manifestEntry = $packageArchive.Entries |
    Where-Object { $_.FullName -ieq "AppxManifest.xml" } |
    Select-Object -First 1
  if ($null -eq $manifestEntry) {
    throw "AppxManifest.xml is missing from the package"
  }

  $manifestDocument = New-Object System.Xml.XmlDocument
  $manifestDocument.PreserveWhitespace = $true
  $manifestDocument.XmlResolver = $null
  $manifestStream = $manifestEntry.Open()
  try {
    $manifestDocument.Load($manifestStream)
  } finally {
    $manifestStream.Dispose()
  }

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

  $applicationExecutable = (
    $application.GetAttribute("Executable") -replace "\\", "/"
  ) -replace "^[\\/]+", ""
  if ($archivePaths -notcontains $applicationExecutable) {
    $packagedExecutables = @(
      $archivePaths |
        Where-Object { $_ -match "\.exe$" } |
        Select-Object -First 20
    )
    throw (
      "Declared application executable is missing from the package: " +
      "$applicationExecutable. Packaged executables: " +
      ($packagedExecutables -join ", ")
    )
  }

  $bridgePath = "app/resources/bin/whatsapp-bridge.exe"
  if ($archivePaths -notcontains $bridgePath) {
    throw "Bundled WhatsApp bridge executable is missing from the package"
  }

  Write-Host "Verified Microsoft Store package identity and bundled bridge:"
  Write-Host "  $resolvedPackage"
  Write-Host "  $expectedIdentityName"
  Write-Host "  $expectedPublisher"
} finally {
  $packageArchive.Dispose()
}
