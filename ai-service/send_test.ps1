$imagePath = "C:\Users\Ivan Inocencio\OneDrive\Desktop\DVTechV2\dvtech-ai\Documents\room.jpg"
$boundary = "----FormBoundary" + (Get-Random)
$fileBytes = [System.IO.File]::ReadAllBytes($imagePath)
$fileName = Split-Path $imagePath -Leaf

$bodyParts = [System.Text.Encoding]::UTF8.GetBytes("--$boundary`r`nContent-Disposition: form-data; name=`"file`"; filename=`"$fileName`"`r`nContent-Type: image/jpeg`r`n`r`n")
$bodyEnd = [System.Text.Encoding]::UTF8.GetBytes("`r`n--$boundary`r`nContent-Disposition: form-data; name=`"include_details`"`r`n`r`ntrue`r`n--$boundary--`r`n")
$body = $bodyParts + $fileBytes + $bodyEnd

$response = Invoke-RestMethod `
    -Uri "http://localhost:8000/api/analyze-room" `
    -Method POST `
    -ContentType "multipart/form-data; boundary=$boundary" `
    -Body $body

$response | ConvertTo-Json -Depth 10
