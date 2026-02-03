$baseUrl = "http://localhost:5000/api/auth/login"
# Testing with system credentials first to see if backend is alive
$body = @{
    email    = "ratnakerkumar56@gmail.com"
    password = "password123" # Guessing or using a placeholder. The status code is what matters.
    # If 401, backend is Up but creds wrong.
    # If Connection Refused, backend is Down.
} | ConvertTo-Json

Write-Host "--- Testing Main Backend Login ---"
Write-Host "Target: $baseUrl"

try {
    $response = Invoke-RestMethod -Uri $baseUrl -Method Post -Body $body -ContentType "application/json"
    Write-Host "[SUCCESS] Login/Response Received."
    # If we get here with wrong password, it might be 200 with error? Unlikely for login.
}
catch {
    Write-Host "Request Failed: $($_.Exception.Message)"
    if ($_.Exception.Response) {
        Write-Host "Status: $($_.Exception.Response.StatusCode)" 
        # 401 means backend is UP and answering.
        # 404 means route wrong.
    }
}
