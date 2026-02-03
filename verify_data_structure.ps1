$baseUrl = "https://whatsaapapi.niveshsarthi.com"
$authUrl = "$baseUrl/api/auth/login"
$headers = @{ "Content-Type" = "application/json" }
$body = @{
    email    = "Syndicate@niveshsarthi.com"
    password = "Syndicate@123"
} | ConvertTo-Json

try {
    $authResponse = Invoke-RestMethod -Uri $authUrl -Method Post -Headers $headers -Body $body
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

$url = "$baseUrl/api/contacts"
Write-Host "Fetching $url..."
try {
    $response = Invoke-RestMethod -Uri $url -Method Get -Headers $apiHeaders
    Write-Host "Response Type: $($response.GetType().Name)"
    Write-Host "Keys: $($response | Get-Member -MemberType NoteProperty | Select-Object -ExpandProperty Name)"
    
    # Check if 'contacts' key exists or likely structure
    if ($response.contacts) {
        Write-Host "Confirmed 'contacts' array present."
    }
    else {
        Write-Host "Response Body Snippet: $($response | ConvertTo-Json -Depth 2)"
    }

}
catch {
    Write-Host "Failed: $($_.Exception.Message)"
}
