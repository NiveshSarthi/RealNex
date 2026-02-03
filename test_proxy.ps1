$proxyUrl = "http://127.0.0.1:3000/external-api/auth/login"
# Note: Using localhost:3002 because that's where the user said it started.
# If it's not running, this will fail.

Write-Host "--- Testing Local Proxy to External API ---"
Write-Host "Target: $proxyUrl"

$body = @{
    email    = "Syndicate@niveshsarthi.com"
    password = "Syndicate@123"
} | ConvertTo-Json

try {
    # Send request to LOCAL PROXY
    $response = Invoke-RestMethod -Uri $proxyUrl -Method Post -Body $body -ContentType "application/json" -TimeoutSec 30
    Write-Host "[SUCCESS] Proxy works! Response token prefix:"
    Write-Host "$($response.access_token.Substring(0, 15))..."
}
catch {
    Write-Host "[FAIL] Proxy Request Failed: $($_.Exception.Message)"
    if ($_.Exception.Response) {
        Write-Host "Status: $($_.Exception.Response.StatusCode)"
        $stream = $_.Exception.Response.GetResponseStream()
        if ($stream) {
            $reader = New-Object System.IO.StreamReader($stream)
            $reader.ReadToEnd() | Write-Host
        }
    }
}
