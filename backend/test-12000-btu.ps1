# Test for 12000 BTU range (should match multiple brands)

$loginBody = '{"email":"customer1@email.com","password":"Password123"}'
$loginResponse = Invoke-RestMethod -Uri "http://localhost:3000/api/ai/room-assessment" -Method POST -Headers @{"Content-Type"="application/json"} -Body $loginBody
$token = $loginResponse.token

Write-Host "Testing 12000 BTU range (20 sqm, 2 occupants, moderate sunlight)" -ForegroundColor Cyan

$boundary = [System.Guid]::NewGuid().ToString()
$LF = "`r`n"

$bodyLines = @(
    "--$boundary",
    "Content-Disposition: form-data; name=`"area`"$LF",
    "18",
    "--$boundary",
    "Content-Disposition: form-data; name=`"ceilingHeight`"$LF",
    "2.7",
    "--$boundary",
    "Content-Disposition: form-data; name=`"occupancy`"$LF",
    "2",
    "--$boundary",
    "Content-Disposition: form-data; name=`"sunlightLevel`"$LF",
    "moderate",
    "--$boundary--$LF"
)

$body = $bodyLines -join $LF
$headers = @{
    "Authorization" = "Bearer $token"
    "Content-Type" = "multipart/form-data; boundary=$boundary"
}

try {
    $response = Invoke-RestMethod -Uri "http://localhost:3000/api/ai/room-assessment" -Method POST -Headers $headers -Body $body
    
    Write-Host "`nSUCCESS!" -ForegroundColor Green
    Write-Host "Total BTU: $($response.recommendation.totalBtu)"
    Write-Host "Unit Type: $($response.recommendation.unitType)`n"
    
    $products = $response.recommendation.recommendedProducts
    if ($products) {
        Write-Host "Recommended Products: $($products.Count)" -ForegroundColor Magenta
        foreach ($p in $products) {
            $badge = if ($p.isPrimary) { " [PRIMARY]" } else { "" }
            Write-Host "  $($p.rank). $($p.brand) $($p.model)$badge | $($p.btuCapacity) BTU | PHP $($p.price)" -ForegroundColor Cyan
        }
        
        $brands = ($products | Select-Object -ExpandProperty brand -Unique)
        Write-Host "`nDISTINCT BRANDS: $($brands.Count) ($($brands -join ', '))" -ForegroundColor Green
        
        if ($products.Count -ge 3) {
            Write-Host "TEST PASSED: 3+ products returned" -ForegroundColor Green
        } else {
            Write-Host "TEST WARNING: Only $($products.Count) products" -ForegroundColor Yellow
        }
    } else {
        Write-Host "No recommendedProducts array" -ForegroundColor Red
    }
} catch {
    Write-Host "ERROR: $($_.Exception.Message)" -ForegroundColor Red
}
