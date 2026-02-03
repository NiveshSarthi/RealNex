$baseUrl = "https://ckk4swcsssos844w0ccos4og.72.61.248.175.sslip.io"
$authUrl = "$baseUrl/auth/login"
$headers = @{ "Content-Type" = "application/json" }
$body = @{
    email    = "Syndicate@niveshsarthi.com"
    password = "Syndicate@123"
} | ConvertTo-Json

Write-Host "--- Authenticating ---"
try {
    $authResponse = Invoke-RestMethod -Uri $authUrl -Method Post -Headers $headers -Body $body -TimeoutSec 60
    $token = $authResponse.access_token
    Write-Host "Token obtained."
}
catch {
    Write-Host "Auth Failed: $($_.Exception.Message)"
    exit
}

$apiHeaders = @{ 
    "Authorization" = "Bearer $token"
    "Content-Type"  = "application/json" 
}

Write-Host "`n--- Testing Campaign Creation ---"
# Attempting to create a campaign using 'hello_world' which is standard
$campaignPayload = @{
    template_name    = "hello_world"
    language_code    = "en_US"
    filters          = @{ tag = "test_tag" }
    variable_mapping = @{ "1" = "Test User" }
} | ConvertTo-Json -Depth 5

try {
    $campRes = Invoke-RestMethod -Uri "$baseUrl/api/v1/campaigns" -Method Post -Headers $apiHeaders -Body $campaignPayload -TimeoutSec 60
    Write-Host "[PASS] Campaign Created. Response:"
    $campRes | ConvertTo-Json -Depth 5 | Write-Host
}
catch {
    Write-Host "[FAIL] Create Campaign: $($_.Exception.Message)"
    if ($_.Exception.Response) { 
        $stream = $_.Exception.Response.GetResponseStream()
        if ($stream) {
            $reader = New-Object System.IO.StreamReader($stream)
            $body = $reader.ReadToEnd()
            Write-Host "   Response Body: $body"
        }
    }
}
