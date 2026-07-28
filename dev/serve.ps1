# ============================================================
# سيرفر تطوير محلي بسيط (بدون أي تبعيات — PowerShell فقط)
# الاستخدام:  powershell -ExecutionPolicy Bypass -File dev\serve.ps1
# ثم افتح:    http://localhost:8090
# لدى المطورين: أي سيرفر ثابت يفي بالغرض (npx serve / python -m http.server)
# ============================================================
param([int]$Port = 8090)

$root = Split-Path -Parent $PSScriptRoot   # جذر المشروع (مجلد b2b-platform)
$mime = @{
  '.html' = 'text/html; charset=utf-8'
  '.css'  = 'text/css; charset=utf-8'
  '.js'   = 'text/javascript; charset=utf-8'
  '.json' = 'application/json; charset=utf-8'
  '.png'  = 'image/png'
  '.jpg'  = 'image/jpeg'
  '.svg'  = 'image/svg+xml'
  '.ico'  = 'image/x-icon'
  '.woff2'= 'font/woff2'
}

$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://localhost:$Port/")
$listener.Start()
Write-Host "B2B dev server running at http://localhost:$Port  (root: $root)"

$rootFull = (Resolve-Path $root).Path

try {
  while ($listener.IsListening) {
    $ctx = $listener.GetContext()
    # كل طلب معزول — عطل طلب واحد لا يسقط السيرفر
    try {
      $reqPath = [System.Uri]::UnescapeDataString($ctx.Request.Url.AbsolutePath)
      if ($reqPath -eq '/') { $reqPath = '/index.html' }
      $file = [System.IO.Path]::GetFullPath((Join-Path $root ($reqPath.TrimStart('/') -replace '/', '\')))

      if ($file.StartsWith($rootFull) -and (Test-Path -LiteralPath $file -PathType Leaf)) {
        $bytes = [System.IO.File]::ReadAllBytes($file)
        $ext = [System.IO.Path]::GetExtension($file).ToLower()
        $ctx.Response.ContentType = if ($mime.ContainsKey($ext)) { $mime[$ext] } else { 'application/octet-stream' }
        $ctx.Response.ContentLength64 = $bytes.Length
        $ctx.Response.OutputStream.Write($bytes, 0, $bytes.Length)
      } else {
        $ctx.Response.StatusCode = 404
        $msg = [System.Text.Encoding]::UTF8.GetBytes('404 Not Found')
        $ctx.Response.OutputStream.Write($msg, 0, $msg.Length)
      }
    } catch {
      Write-Host "request error: $($_.Exception.Message)"
      try { $ctx.Response.StatusCode = 500 } catch {}
    } finally {
      try { $ctx.Response.Close() } catch {}
    }
  }
} finally {
  $listener.Stop()
}
