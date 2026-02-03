$baseUrl = "https://ckk4swcsssos844w0ccos4og.72.61.248.175.sslip.io"

# As per API_DOCUMENTATION.md
$authUrl = "$baseUrl/auth/login"
$contactsUrl = "$baseUrl/api/v1/contacts"
$campaignsUrl = "$baseUrl/api/v1/campaigns"
$templatesUrl = "$baseUrl/api/v1/templates"

$headers = @{ "Content-Type" = "application/json" }
$body = @{
    email    = "Syndicate@niveshsarthi.com"
    password = "Syndicate@123"
} | ConvertTo-Json

Write-Host "=== Strict Documentation Verification ==="
Write-Host "Base URL: $baseUrl"
Write-Host ""

# 1. Authentication
Write-Host "1. Testing Auth ($authUrl)..."
try {
    $authResponse = Invoke-RestMethod -Uri $authUrl -Method Post -Headers $headers -Body $body -TimeoutSec 30
    $token = $authResponse.access_token
    Write-Host "   [PASS] Token obtained."
}
catch {
    Write-Host "   [FAIL] Auth failed: $($_.Exception.Message)"
    if ($_.Exception.Response) { Write-Host "   Status: $($_.Exception.Response.StatusCode)" }
    # Try continuing if we have a hardcoded token? No, we need auth.
    exit
}

$apiHeaders = @{ 
    "Authorization" = "Bearer $token"
    "Content-Type"  = "application/json" 
}

# 2. Resources
$endpoints = @{
    "Contacts"  = $contactsUrl
    "Campaigns" = $campaignsUrl
    "Templates" = $templatesUrl
}

foreach ($name in $endpoints.Keys) {
    $url = $endpoints[$name]
    Write-Host "`n2. Testing $name ($url)..."
    try {
        $response = Invoke-RestMethod -Uri $url -Method Get -Headers $apiHeaders -TimeoutSec 30
        Write-Host "   [PASS] Success."
        if ($response.contacts) { Write-Host "   - Items: $($response.contacts.Count)" }
    }
    catch {
        Write-Host "   [FAIL] $name : $($_.Exception.Message)"
        if ($_.Exception.Response) { Write-Host "   Status: $($_.Exception.Response.StatusCode)" }
    }
}
