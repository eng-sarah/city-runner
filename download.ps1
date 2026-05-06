$urls = @{
    "libs/pose/pose_landmark_lite.tflite" = "https://cdn.jsdelivr.net/npm/@mediapipe/pose/pose_landmark_lite.tflite"
    "libs/pose/pose_landmark_full.tflite" = "https://cdn.jsdelivr.net/npm/@mediapipe/pose/pose_landmark_full.tflite"
    "libs/pose/pose_landmark_heavy.tflite" = "https://cdn.jsdelivr.net/npm/@mediapipe/pose/pose_landmark_heavy.tflite"
}

New-Item -ItemType Directory -Force -Path "libs"
New-Item -ItemType Directory -Force -Path "libs/pose"

foreach ($file in $urls.Keys) {
    Write-Host "Downloading $file..."
    Invoke-WebRequest -Uri $urls[$file] -OutFile $file
}
Write-Host "All downloads completed."
