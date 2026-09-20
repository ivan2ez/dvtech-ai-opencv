# Test script for AI recommendation endpoint with multiple products

# Login as customer first
$loginBody = @{
    email = "customer1@email.com"
    password = "Password123"
} | ConvertTo-Json

$loginResponse = Invoke-RestMethod -Uri "http://localhost:3000/api/auth/login" -Method POST -Headers @{"Content-Type"="application/json"} -Body $loginBody

$token = $loginResponse.token
Write-Host "Logged in as customer1@email.com" -ForegroundColor Green
Write-Host ""

# Submit a room assessment
Write-Host "Submitting room assessment..." -ForegroundColor Cyan
Write-Host "  - Area: 120 sqm"
Write-Host "  - Ceiling Height: 3 meters"
Write-Host "  - Occupancy: 10 persons"
Write-Host "  - Sunlight Level: high"
Write-Host ""

# Create multipart form data
$boundary = [System.Guid]::NewGuid().ToString()
$LF = "`r`n"

$bodyLines = @(
    "--$boundary",
    "Content-Disposition: form-data; name=`"area`"$LF",
    "120",
    "--$boundary",
    "Content-Disposition: form-data; name=`"ceilingHeight`"$LF",
    "3",
    "--$boundary",
    "Content-Disposition: form-data; name=`"occupancy`"$LF",
    "10",
    "--$boundary",
    "Content-Disposition: form-data; name=`"sunlightLevel`"$LF",
    "high",
    "--$boundary--$LF"
)

$body = $bodyLines -join $LF

$headers = @{
    "Authorization" = "Bearer $token"
    "Content-Type" = "multipart/form-data; boundary=$boundary"
}

$response = Invoke-RestMethod -Uri "http://localhost:3000/api/ai/room-assessment" -Method POST -Headers $headers -Body $body

Write-Host "Recommendation generated successfully!" -ForegroundColor Green
Write-Host ""
Write-Host "=======================================================" -ForegroundColor Yellow
Write-Host "              AI RECOMMENDATION RESULT" -ForegroundColor Yellow
Write-Host "=======================================================" -ForegroundColor Yellow
Write-Host ""

Write-Host "CALCULATED SPECIFICATIONS:" -ForegroundColor Magenta
Write-Host "  Total BTU Required: $($response.recommendation.totalBtu)"
Write-Host "  Recommended HP: $($response.recommendation.recommendedHp)"
Write-Host "  Unit Type: $($response.recommendation.unitType)"
Write-Host ""

Write-Host "REASONING:" -ForegroundColor Magenta
Write-Host "  $($response.recommendation.reasoning)"
Write-Host ""

# Display recommended products
$products = $response.recommendation.recommendedProducts
if ($products -and $products.Count -gt 0) {
    Write-Host "RECOMMENDED PRODUCTS ($($products.Count) options):" -ForegroundColor Magenta
    Write-Host "-------------------------------------------------------"
    Write-Host ""
    
    $count = 1
    foreach ($product in $products) {
        if ($product.isPrimary) {
            Write-Host "  $count. $($product.brand) $($product.model) [PRIMARY]" -ForegroundColor Cyan
        } else {
            Write-Host "  $count. $($product.brand) $($product.model)" -ForegroundColor Cyan
        }
        Write-Host "     Type: $($product.type) | HP: $($product.horsepower) | BTU: $($product.btuCapacity)"
        Write-Host "     Price: PHP $($product.price) | Rank: #$($product.rank)"
        if ($product.description) {
            Write-Host "     Description: $($product.description)"
        }
        Write-Host ""
        $count++
    }
    
    Write-Host "=======================================================" -ForegroundColor Yellow
    Write-Host ""
    
    # Verify distinct brands
    $brands = $products | ForEach-Object { $_.brand } | Select-Object -Unique
    $brandList = $brands -join ", "
    Write-Host "VALIDATION: Found $($brands.Count) distinct brands: $brandList" -ForegroundColor Green
    
    if ($products.Count -ge 3) {
        Write-Host "SUCCESS: System returned $($products.Count) product options (target: 3+)" -ForegroundColor Green
    } else {
        Write-Host "WARNING: Only $($products.Count) products returned (expected: 3+)" -ForegroundColor Yellow
    }
} else {
    Write-Host "WARNING: No recommended products array found" -ForegroundColor Yellow
    Write-Host "Raw response:" -ForegroundColor Gray
    $response.recommendation | ConvertTo-Json -Depth 5
}
