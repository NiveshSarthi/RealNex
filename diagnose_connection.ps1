$targetHost = "ckk4swcsssos844w0ccos4og.72.61.248.175.sslip.io"
$targetPort = 443
$url = "https://$targetHost/api/auth/login"

Write-Host "=== DIAGNOSTIC REPORT ==="
Write-Host "Target: $targetHost"
Write-Host "Time: $(Get-Date)"
Write-Host ""

# 1. DNS Resolution
Write-Host "1. Testing DNS Resolution..."
try {
    $ip = [System.Net.Dns]::GetHostAddresses($targetHost)
    Write-Host "   [PASS] Resolved to: $ip"
}
catch {
    Write-Host "   [FAIL] DNS Resolution failed: $($_.Exception.Message)"
}
Write-Host ""

# 2. TCP Connectivity
Write-Host "2. Testing TCP Connection (Port $targetPort)..."
try {
    $tcp = New-Object System.Net.Sockets.TcpClient
    $connect = $tcp.BeginConnect($targetHost, $targetPort, $null, $null)
    $success = $connect.AsyncWaitHandle.WaitOne(5000, $true)
    if ($success) {
        $tcp.EndConnect($connect)
        Write-Host "   [PASS] TCP Connection successful."
        $tcp.Close()
    }
    else {
        Write-Host "   [FAIL] TCP Connection timed out."
    }
}
catch {
    Write-Host "   [FAIL] TCP Connection error: $($_.Exception.Message)"
}
Write-Host ""

# 3. CURL Verbose Test (Bypassing SSL)
Write-Host "3. Testing HTTP Request (curl -v -k)..."
# We use cmd /c to ensure we use the actual curl.exe, not alias
$proc = Start-Process -FilePath "curl.exe" -ArgumentList "-v", "-k", "-X", "POST", "$url", "-H", "Content-Type: application/json", "--connect-timeout", "10" -NoNewWindow -PassThru -Wait
Write-Host "`n(Check output above for curl details)"
