$baseUrl = "https://ckk4swcsssos844w0ccos4og.72.61.248.175.sslip.io"
$authUrl = "$baseUrl/auth/login"
$headers = @{ "Content-Type" = "application/json" }
$body = @{
    email    = "Syndicate@niveshsarthi.com"
    password = "Syndicate@123"
} | ConvertTo-Json

try {
    $authResponse = Invoke-RestMethod -Uri $authUrl -Method Post -Headers $headers -Body $body -TimeoutSec 60
    $token = $authResponse.access_token
}
catch {
    Write-Host "Auth Failed"
    exit
}

$apiHeaders = @{ 
    "Authorization" = "Bearer $token"
    "Content-Type"  = "application/json" 
}

Write-Host "--- Inspecting Contacts ($baseUrl/api/v1/contacts) ---"
try {
    $response = Invoke-RestMethod -Uri "$baseUrl/api/v1/contacts" -Method Get -Headers $apiHeaders
    
    # Check type
    $type = $response.GetType().Name
    Write-Host "Type: $type"
    
    if ($type -eq "Object[]" -or $type -eq "JArray") {
        Write-Host "Result is a Direct Array. Length: $($response.Count)"
    }
    elseif ($type -eq "PSCustomObject") {
        Write-Host "Result is an Object. Keys: $($response | Get-Member -MemberType NoteProperty | Select -ExpandProperty Name)"
    }
}
catch {
    Write-Host "Failed: $($_.Exception.Message)"
}
