$baseUrl = "https://ckk4swcsssos844w0ccos4og.72.61.248.175.sslip.io"
$authUrl = "$baseUrl/auth/login"
$headers = @{ "Content-Type" = "application/json" }
$body = @{
    email    = "Syndicate@niveshsarthi.com"
    password = "Syndicate@123"
} | ConvertTo-Json

Write-Host "--- 1. Authenticating ---"
try {
    $authResponse = Invoke-RestMethod -Uri $authUrl -Method Post -Headers $headers -Body $body -TimeoutSec 60
    $token = $authResponse.access_token
    Write-Host "Token obtained: $($token.Substring(0, 10))..."
}
catch {
    Write-Host "Auth Failed: $($_.Exception.Message)"
    exit
}

$apiHeaders = @{ 
    "Authorization" = "Bearer $token"
    "Content-Type"  = "application/json" 
}

Write-Host "`n--- 2. Fetching Templates ---"
try {
    $response = Invoke-RestMethod -Uri "$baseUrl/api/v1/templates" -Method Get -Headers $apiHeaders -TimeoutSec 30
    
    Write-Host "Response Type: $($response.GetType().Name)"
    
    if ($response -is [Array]) {
        Write-Host "Result is an Array. Count: $($response.Count)"
        if ($response.Count -gt 0) {
            Write-Host "First Item:"
            $response[0] | ConvertTo-Json -Depth 2 | Write-Host
        }
    }
    else {
        Write-Host "Result is NOT an array."
        $response | ConvertTo-Json -Depth 2 | Write-Host
    }
}
catch {
    Write-Host "Fetch Failed: $($_.Exception.Message)"
    if ($_.Exception.Response) {
        $stream = $_.Exception.Response.GetResponseStream()
        if ($stream) {
            $reader = New-Object System.IO.StreamReader($stream)
            $reader.ReadToEnd() | Write-Host
        }
    }
}
