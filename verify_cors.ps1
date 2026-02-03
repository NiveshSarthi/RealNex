$baseUrl = "https://ckk4swcsssos844w0ccos4og.72.61.248.175.sslip.io"
$loginUrl = "$baseUrl/auth/login"

Write-Host "--- Checking CORS Headers on Login Endpoint ---"
try {
    # Send an OPTIONS request (preflight simulation)
    $request = [System.Net.WebRequest]::Create($loginUrl)
    $request.Method = "OPTIONS"
    $request.Headers.Add("Origin", "http://localhost:3000")
    $request.Headers.Add("Access-Control-Request-Method", "POST")
    $request.Headers.Add("Access-Control-Request-Headers", "content-type")
    
    $response = $request.GetResponse()
    Write-Host "Status: $($response.StatusCode)"
    Write-Host "Access-Control-Allow-Origin: $($response.Headers['Access-Control-Allow-Origin'])"
    Write-Host "Access-Control-Allow-Methods: $($response.Headers['Access-Control-Allow-Methods'])"
    $response.Close()
}
catch {
    Write-Host "OPTIONS Request Failed: $($_.Exception.Message)"
    if ($_.Exception.Response) {
        Write-Host "Status: $($_.Exception.Response.StatusCode)"
        Write-Host "Headers: $($_.Exception.Response.Headers)"
    }
}

Write-Host "`n--- Checking CORS Headers on GET Request (Post-Auth not needed for header check usually) ---"
try {
    # Just checking if normal GET returns CORS headers even on 401/200
    $request = [System.Net.WebRequest]::Create("$baseUrl/api/v1/templates")
    $request.Method = "GET"
    $request.Headers.Add("Origin", "http://localhost:3000")
    
    try {
        $response = $request.GetResponse()
    }
    catch {
        $response = $_.Exception.Response
    }
    
    if ($response) {
        Write-Host "Status: $($response.StatusCode)"
        Write-Host "Access-Control-Allow-Origin: $($response.Headers['Access-Control-Allow-Origin'])"
        $response.Close()
    }
}
catch {
    Write-Host "GET Request Failed: $($_.Exception.Message)"
}
