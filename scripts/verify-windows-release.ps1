param(
  [Parameter(Mandatory = $true)]
  [string]$ApplicationDirectory,

  [Parameter(Mandatory = $true)]
  [string]$InstallerPath,

  [switch]$RequireSignature,

  [string]$ExpectedPublisher = "Happy Webs Limited"
)

$ErrorActionPreference = "Stop"

$applicationPath = Join-Path $ApplicationDirectory "Message Bridge.exe"
$bridgePath = Join-Path $ApplicationDirectory "resources/bin/whatsapp-bridge.exe"
$requiredFiles = @($applicationPath, $bridgePath, $InstallerPath)

foreach ($path in $requiredFiles) {
  if (-not (Test-Path -LiteralPath $path -PathType Leaf)) {
    throw "Required Windows release file is missing: $path"
  }
}

if ([System.IO.Path]::GetExtension($InstallerPath) -ne ".exe") {
  throw "Windows release installer must be an .exe file: $InstallerPath"
}

if ($RequireSignature) {
  foreach ($path in $requiredFiles) {
    $signature = Get-AuthenticodeSignature -LiteralPath $path
    if ($signature.Status -ne [System.Management.Automation.SignatureStatus]::Valid) {
      throw "Authenticode signature is not valid for ${path}: $($signature.StatusMessage)"
    }

    if ($null -eq $signature.SignerCertificate) {
      throw "Authenticode signer certificate is missing for $path"
    }

    if ($signature.SignerCertificate.Subject -notmatch [regex]::Escape($ExpectedPublisher)) {
      throw (
        "Unexpected Authenticode publisher for ${path}: " +
        "$($signature.SignerCertificate.Subject)"
      )
    }

    if ($null -eq $signature.TimeStamperCertificate) {
      throw "RFC 3161 timestamp is missing for $path"
    }
  }
}

Write-Host "Verified Windows release contents:"
Write-Host "  Application: $applicationPath"
Write-Host "  Bridge:      $bridgePath"
Write-Host "  Installer:   $InstallerPath"
Write-Host "  Signed:      $RequireSignature"
