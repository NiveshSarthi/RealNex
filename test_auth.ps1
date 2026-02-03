$headers = @{ "Content-Type" = "application/json" }
$body = @{
    email    = "Syndicate@niveshsarthi.com"
    password = "Syndicate@123"
} | ConvertTo-Json

$endpoints = @(
    "https://whatsaapapi.niveshsarthi.com/auth/login",
    "https://whatsaapapi.niveshsarthi.com/api/auth/login",
    "https://whatsaapapi.niveshsarthi.com/api/v1/auth/login",
    "https://whatsaapapi.niveshsarthi.com/v1/auth/login"
)

foreach ($url in $endpoints) {
    Write-Host "`nTesting $url..."
    try {
        $response = Invoke-RestMethod -Uri $url -Method Post -Headers $headers -Body $body -TimeoutSec 10
        Write-Host "SUCCESS $url"
        Write-Host "Token: $($response.access_token)"
        # Exit after first success if you want, but sticking to listing all for info
        if ($response.access_token) {
            exit
        }
    }
    catch {
        Write-Host "FAILED $url : $($_.Exception.Message)"
        if ($_.Exception.Response) {
            Write-Host "Status: $($_.Exception.Response.StatusCode)"
        }
    }
}
