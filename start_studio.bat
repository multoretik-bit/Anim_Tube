@echo off
title AnimTube Studio Starter
echo 🚀 AnimTube: Starting Local Server...
echo ---------------------------------------
echo.
echo [1/2] Checking for Node.js...
node -v >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ Node.js not found! Trying PowerShell fallback...
    goto powershell
)

echo [2/2] Starting server via npx...
start "" "http://localhost:3000"
npx -y serve -p 3000 .
goto end

:powershell
echo [2/2] Starting server via PowerShell...
start "" "http://localhost:3000"
powershell -ExecutionPolicy Bypass -Command "Write-Host 'Starting server on http://localhost:3000...'; $listener = New-Object System.Net.HttpListener; $listener.Prefixes.Add('http://localhost:3000/'); $listener.Start(); while($listener.IsListening) { $context = $listener.GetContext(); $response = $context.Response; $path = $context.Request.Url.LocalPath; if($path -eq '/') { $path = '/index.html' }; $content = [System.IO.File]::ReadAllBytes((Join-Path $pwd $path)); $response.OutputStream.Write($content, 0, $content.Length); $response.Close() }"

:end
pause
