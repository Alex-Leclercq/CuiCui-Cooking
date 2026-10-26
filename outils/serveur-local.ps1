# Petit serveur web pour tester CuiCui Cooking sur l'ordinateur,
# sans rien installer : http://localhost:8080
# Lancement : powershell -ExecutionPolicy Bypass -File outils/serveur-local.ps1

param([int]$Port = 8080)

$racine = Split-Path -Parent $PSScriptRoot
$types = @{
  ".html" = "text/html; charset=utf-8"
  ".css" = "text/css; charset=utf-8"
  ".js" = "text/javascript; charset=utf-8"
  ".json" = "application/json; charset=utf-8"
  ".webmanifest" = "application/manifest+json; charset=utf-8"
  ".svg" = "image/svg+xml"
  ".png" = "image/png"
  ".jpg" = "image/jpeg"
}

$ecoute = New-Object System.Net.HttpListener
$ecoute.Prefixes.Add("http://localhost:$Port/")
$ecoute.Start()
Write-Host "CuiCui Cooking disponible sur http://localhost:$Port (Ctrl+C pour arrêter)"

try {
  while ($ecoute.IsListening) {
    $contexte = $ecoute.GetContext()
    $chemin = [Uri]::UnescapeDataString($contexte.Request.Url.AbsolutePath).TrimStart("/")
    if ($chemin -eq "") { $chemin = "index.html" }
    $fichier = [IO.Path]::GetFullPath((Join-Path $racine $chemin))
    $reponse = $contexte.Response

    if ($fichier.StartsWith($racine) -and (Test-Path $fichier -PathType Leaf)) {
      $octets = [IO.File]::ReadAllBytes($fichier)
      $type = $types[[IO.Path]::GetExtension($fichier).ToLower()]
      if ($type) { $reponse.ContentType = $type }
      $reponse.Headers.Add("Cache-Control", "no-cache")
      $reponse.OutputStream.Write($octets, 0, $octets.Length)
    } else {
      $reponse.StatusCode = 404
    }
    $reponse.Close()
    Write-Host "$($reponse.StatusCode) /$chemin"
  }
} finally {
  $ecoute.Stop()
}
