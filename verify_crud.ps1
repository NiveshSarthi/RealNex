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

# --- TEMPLATES CRUD ---
Write-Host "`n--- Testing Templates CRUD ---"
$templateName = "test_gen_template_$(Get-Random)"
Write-Host "Creating Template: $templateName"

$templatePayload = @{
    name       = $templateName
    category   = "MARKETING"
    language   = "en_US"
    components = @(
        @{ type = "BODY"; text = "Hello {{1}}, this is a test template." }
    )
} | ConvertTo-Json -Depth 5

try {
    $createRes = Invoke-RestMethod -Uri "$baseUrl/api/v1/templates" -Method Post -Headers $apiHeaders -Body $templatePayload
    Write-Host "[PASS] Template Created. Response:"
    $createRes | ConvertTo-Json -Depth 5 | Write-Host
}
catch {
    Write-Host "[FAIL] Create Template: $($_.Exception.Message)"
    if ($_.Exception.Response) { 
        $stream = $_.Exception.Response.GetResponseStream()
        $reader = New-Object System.IO.StreamReader($stream)
        $reader.ReadToEnd() | Write-Host
    }
}

Write-Host "`nDeleting Template: $templateName"
try {
    Invoke-RestMethod -Uri "$baseUrl/api/v1/templates/$templateName" -Method Delete -Headers $apiHeaders
    Write-Host "[PASS] Template Deleted."
}
catch {
    Write-Host "[FAIL] Delete Template: $($_.Exception.Message)"
}


# --- CAMPAIGNS CRUD ---
Write-Host "`n--- Testing Campaigns CRUD ---"
# We need an existing template for campaign creation. Using 'hello_world' if exists, or falling back to one from list.
$templates = Invoke-RestMethod -Uri "$baseUrl/api/v1/templates" -Method Get -Headers $apiHeaders
$validTemplate = $templates | Select-Object -First 1
if ($validTemplate) {
    $campTemplateName = $validTemplate.name
    Write-Host "Using Template: $campTemplateName"
    
    $campaignPayload = @{
        template_name    = $campTemplateName
        language_code    = "en_US"
        filters          = @{ tag = "test_tag" }
        variable_mapping = @{ "1" = "{{name}}" }
    } | ConvertTo-Json -Depth 5

    Write-Host "Creating Campaign..."
    try {
        $campRes = Invoke-RestMethod -Uri "$baseUrl/api/v1/campaigns" -Method Post -Headers $apiHeaders -Body $campaignPayload
        Write-Host "[PASS] Campaign Created. Response:"
        $campRes | ConvertTo-Json -Depth 5 | Write-Host
        
        # Cleanup Campaign if ID exists
        if ($campRes._id) {
            Write-Host "Deleting Campaign: $($campRes._id)"
            # Invoke-RestMethod -Uri "$baseUrl/api/v1/campaigns/$($campRes._id)" -Method Delete -Headers $apiHeaders
            # Commented out delete to inspect it
        }
    }
    catch {
        Write-Host "[FAIL] Create Campaign: $($_.Exception.Message)"
        if ($_.Exception.Response) { 
            $stream = $_.Exception.Response.GetResponseStream()
            $reader = New-Object System.IO.StreamReader($stream)
            $reader.ReadToEnd() | Write-Host
        }
    }
}
else {
    Write-Host "[SKIP] No templates found to test campaign creation."
}
