# Test script for Gemini-powered chatbot with AC-only guard

Write-Host "========================================"  -ForegroundColor Cyan
Write-Host "  DVTech AI Chatbot Test Suite"  -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Login first
$loginBody = @{
    email = "customer1@email.com"
    password = "Password123"
} | ConvertTo-Json

$loginResponse = Invoke-RestMethod -Uri "http://localhost:3000/api/auth/login" -Method POST -Headers @{"Content-Type"="application/json"} -Body $loginBody
$token = $loginResponse.token
$headers = @{
    "Authorization" = "Bearer $token"
    "Content-Type" = "application/json"
}

Write-Host "Logged in successfully" -ForegroundColor Green
Write-Host ""

# Test 1: AC-related question
Write-Host "Test 1: AC-related question" -ForegroundColor Yellow
$body1 = @{ message = "What services does DVTech offer?" } | ConvertTo-Json
try {
    $response1 = Invoke-RestMethod -Uri "http://localhost:3000/api/ai/chatbot" -Method POST -Headers $headers -Body $body1
    Write-Host "SUCCESS" -ForegroundColor Green
    Write-Host "Response: $($response1.message)"
    Write-Host ""
} catch {
    Write-Host "FAILED: $($_.Exception.Message)" -ForegroundColor Red
    if ($_.ErrorDetails) {
        Write-Host "Details: $($_.ErrorDetails.Message)" -ForegroundColor Red
    }
    Write-Host ""
}

Start-Sleep -Seconds 2

# Test 2: Room recommendation
Write-Host "Test 2: Room recommendation" -ForegroundColor Yellow
$body2 = @{ message = "I need help choosing an AC for my bedroom" } | ConvertTo-Json
try {
    $response2 = Invoke-RestMethod -Uri "http://localhost:3000/api/ai/chatbot" -Method POST -Headers $headers -Body $body2
    Write-Host "SUCCESS" -ForegroundColor Green
    Write-Host "Response: $($response2.message)"
    Write-Host ""
} catch {
    Write-Host "FAILED: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host ""
}

Start-Sleep -Seconds 2

# Test 3: Non-AC topic (refrigerator)
Write-Host "Test 3: Non-AC topic - should redirect" -ForegroundColor Yellow
$body3 = @{ message = "Can you help me fix my refrigerator?" } | ConvertTo-Json
try {
    $response3 = Invoke-RestMethod -Uri "http://localhost:3000/api/ai/chatbot" -Method POST -Headers $headers -Body $body3
    Write-Host "SUCCESS - Response received" -ForegroundColor Green
    Write-Host "Response: $($response3.message)"
    
    $responseText = $response3.message
    if ($responseText -match "specialized.*air conditioning" -or $responseText -match "AC-related") {
        Write-Host "GUARD WORKING - Bot redirected correctly" -ForegroundColor Green
    } else {
        Write-Host "WARNING - Bot may have answered off-topic" -ForegroundColor Yellow
    }
    Write-Host ""
} catch {
    Write-Host "FAILED: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host ""
}

Start-Sleep -Seconds 2

# Test 4: Non-AC topic (weather)
Write-Host "Test 4: Non-AC topic - weather" -ForegroundColor Yellow
$body4 = @{ message = "What is the weather today?" } | ConvertTo-Json
try {
    $response4 = Invoke-RestMethod -Uri "http://localhost:3000/api/ai/chatbot" -Method POST -Headers $headers -Body $body4
    Write-Host "SUCCESS - Response received" -ForegroundColor Green
    Write-Host "Response: $($response4.message)"
    
    $responseText = $response4.message
    if ($responseText -match "specialized.*air conditioning" -or $responseText -match "AC-related") {
        Write-Host "GUARD WORKING - Bot redirected correctly" -ForegroundColor Green
    } else {
        Write-Host "WARNING - Bot may have answered off-topic" -ForegroundColor Yellow
    }
    Write-Host ""
} catch {
    Write-Host "FAILED: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host ""
}

Write-Host "========================================"  -ForegroundColor Cyan
Write-Host "  Test Suite Complete" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
