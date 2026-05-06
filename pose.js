class PoseController {
    constructor(videoElement, canvasElement, onEventCallback, onReadyCallback) {
        this.videoElement = videoElement;
        this.canvasElement = canvasElement;
        this.canvasCtx = canvasElement.getContext('2d');
        this.onEvent = onEventCallback;
        this.onReady = onReadyCallback;
        
        // Pose State History for heuristics
        this.history = [];
        this.historyLength = 15; // frames to remember

        // Cooldowns to prevent spamming events
        this.lastJumpTime = 0;
        this.lastDuckTime = 0;
        this.lastLaneTime = 0;
        
        // Lane state (-1: left, 0: center, 1: right)
        this.currentLane = 0;
        
        this.init();
    }

    init() {
        this.pose = new Pose({locateFile: (file) => {
            return `libs/pose/${file}`;
        }});

        this.pose.setOptions({
            modelComplexity: 1,
            smoothLandmarks: true,
            enableSegmentation: false,
            smoothSegmentation: false,
            minDetectionConfidence: 0.5,
            minTrackingConfidence: 0.5
        });

        this.pose.onResults((results) => this.onResults(results));

        this.camera = new Camera(this.videoElement, {
            onFrame: async () => {
                await this.pose.send({image: this.videoElement});
            },
            width: 480,
            height: 360
        });

        this.camera.start().then(() => {
            if (this.onReady) this.onReady();
        });
    }

    onResults(results) {
        // Draw Skeleton
        this.canvasCtx.save();
        this.canvasCtx.clearRect(0, 0, this.canvasElement.width, this.canvasElement.height);
        
        if (results.poseLandmarks) {
            drawConnectors(this.canvasCtx, results.poseLandmarks, POSE_CONNECTIONS,
                           {color: '#00FF00', lineWidth: 2});
            drawLandmarks(this.canvasCtx, results.poseLandmarks,
                          {color: '#FF0000', lineWidth: 1, radius: 2});
            
            this.processLandmarks(results.poseLandmarks);
        }
        
        this.canvasCtx.restore();
    }

    processLandmarks(landmarks) {
        const now = Date.now();
        
        // Extract key points
        // Landmarks: 11 (left shoulder), 12 (right shoulder), 23 (left hip), 24 (right hip), 25 (left knee), 26 (right knee)
        const leftShoulder = landmarks[11];
        const rightShoulder = landmarks[12];
        const leftHip = landmarks[23];
        const rightHip = landmarks[24];
        
        if (!leftShoulder || !rightShoulder || !leftHip || !rightHip) return;

        // Calculate center points
        const shoulderCenter = {
            x: (leftShoulder.x + rightShoulder.x) / 2,
            y: (leftShoulder.y + rightShoulder.y) / 2
        };
        const hipCenter = {
            x: (leftHip.x + rightHip.x) / 2,
            y: (leftHip.y + rightHip.y) / 2
        };

        const currentFrame = {
            time: now,
            shoulderCenter,
            hipCenter
        };

        this.history.push(currentFrame);
        if (this.history.length > this.historyLength) {
            this.history.shift();
        }

        if (this.history.length < 5) return;

        // --- 1. Detect Lean (Lane Switching) ---
        // X coordinates in mediapipe go from 0 (left) to 1 (right)
        // Since we mirror the video visually, the user moving right means X goes right in camera
        // A typical center is around 0.5. Let's use 0.4 and 0.6 as thresholds.
        if (now - this.lastLaneTime > 500) { // 500ms cooldown
            const leanThreshold = 0.12;
            const avgX = shoulderCenter.x;
            // Baseline assume user tries to stand in center. If they move off center by leanThreshold
            if (avgX < 0.5 - leanThreshold && this.currentLane < 1) {
                // Moved left in unmirrored camera -> Physically moved RIGHT
                this.currentLane = 1;
                this.onEvent('leanRight');
                this.lastLaneTime = now;
            } else if (avgX > 0.5 + leanThreshold && this.currentLane > -1) {
                // Moved right in unmirrored camera -> Physically moved LEFT
                this.currentLane = -1;
                this.onEvent('leanLeft');
                this.lastLaneTime = now;
            } else if (avgX >= 0.5 - leanThreshold + 0.05 && avgX <= 0.5 + leanThreshold - 0.05) {
                if (this.currentLane !== 0) {
                    this.currentLane = 0;
                    this.onEvent('leanCenter');
                    this.lastLaneTime = now;
                }
            }
        }

        // --- 2. Detect Jump and Duck ---
        // Look at Y displacement of hips over the last few frames. Y goes from 0 (top) to 1 (bottom).
        // So moving UP means Y decreases.
        const oldestFrame = this.history[0];
        const hipDeltaY = currentFrame.hipCenter.y - oldestFrame.hipCenter.y;
        
        if (now - this.lastJumpTime > 800 && now - this.lastDuckTime > 800) {
            const jumpThreshold = -0.06; // Hips moved up rapidly
            const duckThreshold = 0.06;  // Hips moved down rapidly

            if (hipDeltaY < jumpThreshold) {
                this.onEvent('jump');
                this.lastJumpTime = now;
                return; // Prioritize jump over other movements
            } else if (hipDeltaY > duckThreshold) {
                this.onEvent('duck');
                this.lastDuckTime = now;
                return; 
            }
        }

        // --- 3. Detect Jogging in place ---
        // To detect jogging, we can look for high frequency small vertical bounces in the hips/shoulders.
        // We calculate the variance or total absolute path of Y.
        let pathY = 0;
        for (let i = 1; i < this.history.length; i++) {
            pathY += Math.abs(this.history[i].hipCenter.y - this.history[i-1].hipCenter.y);
        }
        
        // If pathY is significant over the history window but we didn't trigger jump/duck
        const jogThreshold = 0.08; 
        if (pathY > jogThreshold && (now - this.lastJumpTime > 500) && (now - this.lastDuckTime > 500)) {
            this.onEvent('jog');
        } else {
            this.onEvent('idle');
        }
    }
}
