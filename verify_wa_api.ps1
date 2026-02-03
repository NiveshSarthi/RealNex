$baseUrl = "https://ckk4swcsssos844w0ccos4og.72.61.248.175.sslip.io"
$authUrl = "$baseUrl/api/auth/login"
$headers = @{ "Content-Type" = "application/json" }
$body = @{
    email    = "Syndicate@niveshsarthi.com"
    password = "Syndicate@123"
} | ConvertTo-Json

Write-Host "1. Authenticating..."
try {
    $authResponse = Invoke-RestMethod -Uri $authUrl -Method Post -Headers $headers -Body $body -TimeoutSec 60
    $token = $authResponse.access_token
    Write-Host "   [PASSED] Token obtained."
}
catch {
    Write-Host "   [FAILED] Auth failed: $($_.Exception.Message)"
    exit
}

$apiHeaders = @{ 
    "Authorization" = "Bearer $token"
    "Content-Type"  = "application/json" 
}

# Define endpoints to test variants
$testPaths = @(
    "/api/contacts",
    "/contacts",
    "/v1/contacts",
    "/api/v1/contacts",
    "/api/templates",
    "/api/campaigns"
)

foreach ($path in $testPaths) {
    $fullUrl = "$baseUrl$path"
    Write-Host "`nTesting $fullUrl..."
    
    try {
        $response = Invoke-RestMethod -Uri $fullUrl -Method Get -Headers $apiHeaders -TimeoutSec 10
        Write-Host "   [PASSED] Success!"
        # if ($response) { $response | ConvertTo-Json -Depth 1 | Write-Host }
    }
    catch {
        Write-Host "   [FAILED] : $($_.Exception.Message)"
        if ($_.Exception.Response) { Write-Host "   Status: $($_.Exception.Response.StatusCode)" }
    }
}
