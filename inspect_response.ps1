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

function Inspect-Endpoint($url, $name) {
    Write-Host "`n--- Inspecting $name ($url) ---"
    try {
        $response = Invoke-RestMethod -Uri $url -Method Get -Headers $apiHeaders
        
        # Check type
        $type = $response.GetType().Name
        Write-Host "Type: $type"
        
        if ($type -eq "Object[]" -or $type -eq "JArray") {
            Write-Host "It is an Array. Length: $($response.Count)"
            if ($response.Count -gt 0) {
                Write-Host "First Item Keys: $($response[0] | Get-Member -MemberType NoteProperty | Select -ExpandProperty Name)"
            }
        }
        elseif ($type -eq "PSCustomObject") {
            Write-Host "It is an Object. Keys: $($response | Get-Member -MemberType NoteProperty | Select -ExpandProperty Name)"
            # Dump 1st level
            # $response | ConvertTo-Json -Depth 1 | Write-Host
        }
    }
    catch {
        Write-Host "Failed: $($_.Exception.Message)"
    }
}

Inspect-Endpoint "$baseUrl/api/v1/templates" "Templates"
Inspect-Endpoint "$baseUrl/api/v1/campaigns" "Campaigns"
