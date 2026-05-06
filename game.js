class Game {
    constructor(containerId) {
        this.container = document.getElementById(containerId);
        this.scene = new THREE.Scene();
        // Synthwave deep purple/blue background
        const bgColor = 0x0a0515;
        this.scene.fog = new THREE.FogExp2(bgColor, 0.015);
        
        this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 300);
        this.cameraOffset = new THREE.Vector3(0, 4, 8);
        this.camera.position.copy(this.cameraOffset);
        
        this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setClearColor(bgColor, 1);
        this.container.appendChild(this.renderer.domElement);
        
        // Game State
        this.speed = 0;
        this.baseSpeed = 0.5;
        this.targetSpeed = 0;
        this.score = 0;
        this.isPlaying = false;
        
        // Character State
        this.laneWidth = 3;
        this.currentLane = 0;
        this.targetX = 0;
        
        this.isJumping = false;
        this.jumpVelocity = 0;
        this.gravity = -0.015;
        this.characterY = 0; // Base Y for the procedural character
        
        this.isDucking = false;
        this.duckTimer = 0;

        // Environment arrays
        this.objects = []; 
        this.buildings = [];
        this.roadGrid = null;
        
        this.initEnvironment();
        this.initCharacter();
        this.initLights();
        
        window.addEventListener('resize', () => this.onWindowResize(), false);
    }
    
    initLights() {
        const ambientLight = new THREE.AmbientLight(0x2a0a4a, 1.5);
        this.scene.add(ambientLight);
        
        const dirLight = new THREE.DirectionalLight(0x00f3ff, 1);
        dirLight.position.set(10, 20, 10);
        this.scene.add(dirLight);

        const fillLight = new THREE.DirectionalLight(0xff00f7, 1);
        fillLight.position.set(-10, 20, -10);
        this.scene.add(fillLight);
    }
    
    initEnvironment() {
        // --- The Road Grid ---
        const gridGeo = new THREE.PlaneGeometry(100, 300, 40, 100);
        const gridMat = new THREE.MeshBasicMaterial({ 
            color: 0xff00f7, 
            wireframe: true,
            transparent: true,
            opacity: 0.3
        });
        const grid = new THREE.Mesh(gridGeo, gridMat);
        grid.rotation.x = -Math.PI / 2;
        grid.position.y = 0;
        this.scene.add(grid);
        this.roadGrid = grid;
        
        // Solid road base to hide grid underneath
        const roadGeo = new THREE.PlaneGeometry(12, 300);
        const roadMat = new THREE.MeshStandardMaterial({ 
            color: 0x050210, 
            roughness: 0.1, 
            metalness: 0.8 
        });
        const road = new THREE.Mesh(roadGeo, roadMat);
        road.rotation.x = -Math.PI / 2;
        road.position.y = -0.05;
        this.scene.add(road);

        // --- Synthwave Sun ---
        const sunGeo = new THREE.CircleGeometry(40, 64);
        const sunShaderMat = new THREE.ShaderMaterial({
            uniforms: {
                color1: { value: new THREE.Color(0xff0055) },
                color2: { value: new THREE.Color(0xffdd00) }
            },
            vertexShader: `
                varying vec2 vUv;
                void main() {
                    vUv = uv;
                    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
                }
            `,
            fragmentShader: `
                uniform vec3 color1;
                uniform vec3 color2;
                varying vec2 vUv;
                void main() {
                    float stripe = sin(vUv.y * 50.0 - 1.5);
                    float threshold = mix(0.9, -0.5, vUv.y);
                    if (stripe > threshold && vUv.y < 0.45) discard;
                    
                    vec3 col = mix(color1, color2, vUv.y);
                    gl_FragColor = vec4(col, 1.0);
                }
            `,
            side: THREE.DoubleSide,
            transparent: true
        });
        const sun = new THREE.Mesh(sunGeo, sunShaderMat);
        sun.position.set(0, 15, -200);
        this.scene.add(sun);

        // --- Procedural Buildings ---
        for (let i = 0; i < 60; i++) {
            this.spawnBuilding();
        }
    }

    spawnBuilding() {
        const isLeft = Math.random() > 0.5;
        const xPos = isLeft ? -10 - Math.random() * 40 : 10 + Math.random() * 40;
        const zPos = 20 - Math.random() * 250;
        
        const width = 2 + Math.random() * 6;
        const depth = 2 + Math.random() * 6;
        const height = 10 + Math.random() * 40;

        const geo = new THREE.BoxGeometry(width, height, depth);
        const mat = new THREE.MeshStandardMaterial({ 
            color: 0x050215, 
            emissive: 0x110522,
            roughness: 0.4
        });
        const mesh = new THREE.Mesh(geo, mat);
        
        const edges = new THREE.EdgesGeometry(geo);
        const lineMat = new THREE.LineBasicMaterial({ color: 0x00f3ff, transparent: true, opacity: 0.5 });
        const wireframe = new THREE.LineSegments(edges, lineMat);
        mesh.add(wireframe);

        mesh.position.set(xPos, height / 2, zPos);
        this.scene.add(mesh);
        this.buildings.push(mesh);
    }
    
    initCharacter() {
        this.character = new THREE.Group();
        
        // Materials for the Young Lady
        const skinMat = new THREE.MeshStandardMaterial({ color: 0xffe0bd, roughness: 0.6 }); // Skin tone
        const dressMat = new THREE.MeshStandardMaterial({ color: 0xff00f7, emissive: 0x550055, roughness: 0.2 }); // Neon dress
        const hairMat = new THREE.MeshStandardMaterial({ color: 0x00f3ff, emissive: 0x005555, roughness: 0.4 }); // Neon cyan hair
        
        // Head
        const head = new THREE.Mesh(new THREE.SphereGeometry(0.3, 16, 16), skinMat);
        head.position.y = 1.6;
        this.character.add(head);
        
        // Ponytail
        const ponytail = new THREE.Mesh(new THREE.ConeGeometry(0.15, 0.6, 8), hairMat);
        ponytail.position.set(0, 1.5, -0.3);
        ponytail.rotation.x = -Math.PI / 4;
        this.character.add(ponytail);
        
        // Torso / Dress
        const dress = new THREE.Mesh(new THREE.ConeGeometry(0.5, 1.0, 16), dressMat);
        dress.position.y = 0.9;
        this.character.add(dress);
        
        // Limbs (Pivots)
        const armGeo = new THREE.CylinderGeometry(0.06, 0.06, 0.6, 8);
        armGeo.translate(0, -0.3, 0); // Translate so pivot is at top
        
        const legGeo = new THREE.CylinderGeometry(0.08, 0.08, 0.7, 8);
        legGeo.translate(0, -0.35, 0);
        
        this.leftArm = new THREE.Mesh(armGeo, skinMat);
        this.leftArm.position.set(0.4, 1.3, 0);
        this.character.add(this.leftArm);
        
        this.rightArm = new THREE.Mesh(armGeo, skinMat);
        this.rightArm.position.set(-0.4, 1.3, 0);
        this.character.add(this.rightArm);
        
        this.leftLeg = new THREE.Mesh(legGeo, skinMat);
        this.leftLeg.position.set(0.2, 0.5, 0);
        this.character.add(this.leftLeg);
        
        this.rightLeg = new THREE.Mesh(legGeo, skinMat);
        this.rightLeg.position.set(-0.2, 0.5, 0);
        this.character.add(this.rightLeg);
        
        // Light
        const charLight = new THREE.PointLight(0xff00f7, 2, 10);
        charLight.position.set(0, 1, 1);
        this.character.add(charLight);

        this.character.position.set(0, this.characterY, 0);
        this.character.scale.set(1.1, 1.4, 1.1);
        this.scene.add(this.character);
        
        this.characterBox = new THREE.Box3();
    }
    
    start() {
        this.isPlaying = true;
        this.score = 0;
        this.lives = 3;
        this.invincibleTimer = 0;
        this.speed = 0;
        this.targetSpeed = this.baseSpeed;
        this.objects.forEach(obj => this.scene.remove(obj.mesh));
        this.objects = [];
    }
    
    stop() {
        this.isPlaying = false;
        this.speed = 0;
        this.targetSpeed = 0;
    }
    
    spawnObject() {
        const typeRand = Math.random();
        let type = 'coin';
        if (typeRand > 0.7) type = 'duck_obs';
        else if (typeRand > 0.4) type = 'jump_obs';
        
        const lane = Math.floor(Math.random() * 3) - 1; 
        const xPos = lane * this.laneWidth;
        const zPos = -150; 
        
        let mesh;
        if (type === 'coin') {
            const geo = new THREE.CylinderGeometry(0.4, 0.4, 0.1, 16);
            const mat = new THREE.MeshBasicMaterial({ color: 0xffd700 });
            mesh = new THREE.Mesh(geo, mat);
            mesh.rotation.x = Math.PI / 2;
            mesh.position.set(xPos, 1.0, zPos);
        } else if (type === 'jump_obs') {
            const geo = new THREE.BoxGeometry(2, 1.5, 1);
            const mat = new THREE.MeshStandardMaterial({ color: 0x110000, emissive: 0xff0055, emissiveIntensity: 0.8 });
            mesh = new THREE.Mesh(geo, mat);
            const edges = new THREE.EdgesGeometry(geo);
            const lineMat = new THREE.LineBasicMaterial({ color: 0xffffff });
            mesh.add(new THREE.LineSegments(edges, lineMat));
            mesh.position.set(xPos, 0.75, zPos);
        } else {
            const geo = new THREE.CylinderGeometry(0.2, 0.2, 3, 8);
            const mat = new THREE.MeshBasicMaterial({ color: 0x00ff00 });
            mesh = new THREE.Mesh(geo, mat);
            mesh.rotation.z = Math.PI / 2;
            mesh.position.set(xPos, 2.2, zPos);
            const light = new THREE.PointLight(0x00ff00, 1, 5);
            mesh.add(light);
        }
        
        this.scene.add(mesh);
        this.objects.push({ mesh, type, collected: false, active: true });
    }
    
    update(onScoreUpdate, onGameOver, onLifeLost) {
        if (!this.isPlaying) return;
        
        if (this.invincibleTimer > 0) {
            this.invincibleTimer--;
            this.character.visible = this.invincibleTimer % 10 < 5;
        } else {
            this.character.visible = true;
        }

        this.speed += (this.targetSpeed - this.speed) * 0.05;
        if (this.speed < 0.05) this.speed = 0;
        
        // Move floor grid texture/vertices
        if (this.roadGrid) {
            this.roadGrid.position.z += this.speed;
            if (this.roadGrid.position.z > 30) {
                this.roadGrid.position.z -= 30; 
            }
        }

        // Animate procedural buildings
        for (let b of this.buildings) {
            b.position.z += this.speed;
            if (b.position.z > 20) {
                b.position.z -= 270;
                b.position.x = (Math.random() > 0.5 ? -1 : 1) * (10 + Math.random() * 40);
                b.scale.y = 0.5 + Math.random() * 1.5;
            }
        }
        
        this.targetX = this.currentLane * this.laneWidth;
        this.character.position.x += (this.targetX - this.character.position.x) * 0.15;
        
        // Character lean effect when changing lanes
        this.character.rotation.z = (this.character.position.x - this.targetX) * 0.1;

        if (this.isJumping) {
            this.character.position.y += this.jumpVelocity;
            this.jumpVelocity += this.gravity;
            
            // Jump pose animation
            this.leftArm.rotation.x = -Math.PI / 2;
            this.rightArm.rotation.x = -Math.PI / 2;
            this.leftLeg.rotation.x = Math.PI / 6;
            this.rightLeg.rotation.x = -Math.PI / 6;

            if (this.character.position.y <= this.characterY) {
                this.character.position.y = this.characterY;
                this.isJumping = false;
                this.jumpVelocity = 0;
            }
        }
        
        if (this.isDucking) {
            this.duckTimer--;
            // Ducking / Sliding pose
            this.character.rotation.x = -Math.PI / 2.5; // Lean far back/slide
            this.character.position.y = this.characterY - 0.4;
            this.leftArm.rotation.x = Math.PI;
            this.rightArm.rotation.x = Math.PI;
            this.leftLeg.rotation.x = 0;
            this.rightLeg.rotation.x = 0;

            if (this.duckTimer <= 0) {
                this.isDucking = false;
                this.character.rotation.x = 0;
                this.character.position.y = this.characterY;
            }
        } else if (!this.isJumping) {
            this.character.position.y = this.characterY;
            this.character.rotation.x = 0; // Reset
            
            // Running animation
            if (this.speed > 0.1) {
                const time = Date.now() * 0.015 * (this.speed * 2);
                const swing = Math.sin(time) * Math.PI / 3;
                this.leftArm.rotation.x = swing;
                this.rightArm.rotation.x = -swing;
                this.leftLeg.rotation.x = -swing;
                this.rightLeg.rotation.x = swing;
            } else {
                // Idle pose
                this.leftArm.rotation.x = 0;
                this.rightArm.rotation.x = 0;
                this.leftLeg.rotation.x = 0;
                this.rightLeg.rotation.x = 0;
            }
        }

        this.characterBox.setFromObject(this.character);
        this.characterBox.expandByScalar(-0.1); 
        
        if (Math.random() < 0.02 + (this.speed * 0.015)) {
            this.spawnObject();
        }
        
        for (let i = this.objects.length - 1; i >= 0; i--) {
            const obj = this.objects[i];
            
            if (!obj.active) continue;
            
            obj.mesh.position.z += this.speed;
            
            if (obj.type === 'coin') {
                obj.mesh.rotation.y += 0.1; 
                obj.mesh.rotation.z += 0.05;
            } else if (obj.type === 'jump_obs') {
                obj.mesh.rotation.y += 0.02; 
            }
            
            const objBox = new THREE.Box3().setFromObject(obj.mesh);
            objBox.expandByScalar(-0.1); 

            if (this.characterBox.intersectsBox(objBox)) {
                if (obj.type === 'coin' && !obj.collected) {
                    obj.collected = true;
                    obj.active = false;
                    this.scene.remove(obj.mesh);
                    this.score += 10;
                    if (onScoreUpdate) onScoreUpdate(this.score);
                } else if (!obj.collected) {
                    if (this.invincibleTimer <= 0) {
                        this.lives--;
                        this.invincibleTimer = 60;
                        if (onLifeLost) onLifeLost(this.lives);
                        if (this.lives <= 0) {
                            if (onGameOver) onGameOver();
                        }
                    }
                }
            }
            
            if (obj.mesh.position.z > 15) {
                this.scene.remove(obj.mesh);
                this.objects.splice(i, 1);
            }
        }
        
        // Camera Follow 
        this.camera.position.x += (this.character.position.x * 0.3 - this.camera.position.x) * 0.1;
        this.camera.position.y = this.character.position.y + this.cameraOffset.y;
        this.camera.position.z = this.character.position.z + this.cameraOffset.z;
        this.camera.lookAt(this.character.position.x * 0.5, this.character.position.y + 1, this.character.position.z - 20);
        
        this.camera.fov = 75 + (this.speed * 20); 
        this.camera.updateProjectionMatrix();
    }
    
    render() {
        this.renderer.render(this.scene, this.camera);
    }
    
    onWindowResize() {
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
    }

    jump() {
        if (!this.isJumping) {
            this.isJumping = true;
            this.jumpVelocity = 0.35;
            this.isDucking = false;
        }
    }

    duck() {
        if (!this.isJumping && !this.isDucking) {
            this.isDucking = true;
            this.duckTimer = 30;
        }
    }

    setLane(lane) {
        if (lane >= -1 && lane <= 1) {
            this.currentLane = lane;
        }
    }

    jog() {
        this.targetSpeed = this.baseSpeed + 0.5; 
    }

    idle() {
        this.targetSpeed = 0;
    }
}
