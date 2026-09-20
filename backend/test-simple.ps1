# Simple test for AI recommendation with smaller room

# Login
$loginBody = '{"email":"customer1@email.com","password":"Password123"}'
$loginResponse = Invoke-RestMethod -Uri "http://localhost:3000/api/auth/login" -Method POST -Headers @{"Content-Type"="application/json"} -Body $loginBody
$token = $loginResponse.token

Write-Host "Logged in successfully" -ForegroundColor Green

# Test smaller room (25 sqm) - should match split-type products
$boundary = [System.Guid]::NewGuid().ToString()
$LF = "`r`n"

$bodyLines = @(
    "--$boundary",
    "Content-Disposition: form-data; name=`"area`"$LF",
    "25",
    "--$boundary",
    "Content-Disposition: form-data; name=`"ceilingHeight`"$LF",
    "2.8",
    "--$boundary",
    "Content-Disposition: form-data; name=`"occupancy`"$LF",
    "3",
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

Write-Host "Submitting room assessment (25 sqm, 3 occupants, moderate sunlight)..." -ForegroundColor Cyan

try {
    $response = Invoke-RestMethod -Uri "http://localhost:3000/api/ai/room-assessment" -Method POST -Headers $headers -Body $body
    
    Write-Host "`nSUCCESS: Recommendation generated!" -ForegroundColor Green
    Write-Host "Total BTU: $($response.recommendation.totalBtu)"
    Write-Host "Recommended HP: $($response.recommendation.recommendedHp)"
    Write-Host "Unit Type: $($response.recommendation.unitType)"
    Write-Host ""
    
    $products = $response.recommendation.recommendedProducts
    if ($products) {
        Write-Host "Recommended Products ($($products.Count)):" -ForegroundColor Magenta
        foreach ($p in $products) {
            $badge = if ($p.isPrimary) { " [PRIMARY]" } else { "" }
            Write-Host "  - $($p.brand) $($p.model)$badge | $($p.btuCapacity) BTU | PHP $($p.price)" -ForegroundColor Cyan
        }
        
        $brands = ($products | Select-Object -ExpandProperty brand -Unique)
        Write-Host "`nDistinct brands: $($brands.Count) ($($brands -join ', '))" -ForegroundColor Green
    } else {
        Write-Host "No recommendedProducts array in response" -ForegroundColor Yellow
    }
} catch {
    Write-Host "ERROR: $($_.Exception.Message)" -ForegroundColor Red
    if ($_.ErrorDetails) {
        Write-Host "Details: $($_.ErrorDetails.Message)" -ForegroundColor Red
    }
}
