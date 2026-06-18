<script>
	import * as THREE from 'three';
	import { themeStore } from '../stores/themes.js';

	let canvas = $state(null);

	// Theme palettes: fog matches the page background, accent drives the horizon
	// glow, terrain is the subtle line color of the breathing landscape.
	const PALETTES = {
		light: { accent: 0x0066ff, fog: 0xf4f6fb, terrain: 0xb9c2d4 },
		dark: { accent: 0xffe260, fog: 0x0c0c0e, terrain: 0x2b2d35 },
		blue: { accent: 0x2563eb, fog: 0xf3f7fd, terrain: 0xb3c6e0 },
		green: { accent: 0x16a34a, fog: 0xf4faf6, terrain: 0xb7d4c3 }
	};

	$effect(() => {
		if (!canvas) return;

		const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
		const isMobile = window.innerWidth < 768;

		const renderer = new THREE.WebGLRenderer({
			canvas,
			alpha: true,
			antialias: false,
			powerPreference: 'high-performance'
		});
		renderer.setPixelRatio(Math.min(window.devicePixelRatio, isMobile ? 1.25 : 1.5));
		renderer.setSize(window.innerWidth, window.innerHeight);

		const scene = new THREE.Scene();
		scene.fog = new THREE.FogExp2(PALETTES.light.fog, 0.022);

		const camera = new THREE.PerspectiveCamera(
			50,
			window.innerWidth / window.innerHeight,
			0.1,
			120
		);
		camera.position.set(0, 4.2, 16);
		camera.lookAt(0, 1.2, -40);

		// ============================================================
		// BREATHING TERRAIN — a single wireframe plane displaced by
		// layered sine waves; calm dunes rolling toward the horizon.
		// ============================================================
		const SEG_X = isMobile ? 56 : 96;
		const SEG_Z = isMobile ? 36 : 60;
		const terrainGeo = new THREE.PlaneGeometry(140, 90, SEG_X, SEG_Z);
		terrainGeo.rotateX(-Math.PI / 2);
		const basePos = terrainGeo.attributes.position.array.slice();

		const terrainMat = new THREE.MeshBasicMaterial({
			color: PALETTES.light.terrain,
			wireframe: true,
			transparent: true,
			opacity: 0.32,
			depthWrite: false
		});
		const terrain = new THREE.Mesh(terrainGeo, terrainMat);
		terrain.position.set(0, 0, -28);
		scene.add(terrain);

		function displaceTerrain(t) {
			const pos = terrainGeo.attributes.position;
			for (let i = 0; i < pos.count; i++) {
				const x = basePos[i * 3];
				const z = basePos[i * 3 + 2];
				pos.array[i * 3 + 1] =
					Math.sin(x * 0.16 + t * 0.22) * Math.cos(z * 0.13 - t * 0.16) * 1.5 +
					Math.sin(x * 0.045 - t * 0.1) * 2.2 +
					Math.cos(z * 0.05 + t * 0.07) * 1.4;
			}
			pos.needsUpdate = true;
		}

		// ============================================================
		// HORIZON SUN — one plane with a feathered radial-gradient
		// texture, so the glow dissolves with no hard edge.
		// ============================================================
		const glowCanvas = document.createElement('canvas');
		glowCanvas.width = 256;
		glowCanvas.height = 256;
		const glowCtx = glowCanvas.getContext('2d');
		const gradient = glowCtx.createRadialGradient(128, 128, 0, 128, 128, 128);
		gradient.addColorStop(0, 'rgba(255, 255, 255, 0.85)');
		gradient.addColorStop(0.35, 'rgba(255, 255, 255, 0.3)');
		gradient.addColorStop(0.7, 'rgba(255, 255, 255, 0.08)');
		gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
		glowCtx.fillStyle = gradient;
		glowCtx.fillRect(0, 0, 256, 256);
		const glowTex = new THREE.CanvasTexture(glowCanvas);

		const sunGeo = new THREE.PlaneGeometry(38, 38);
		const sunMat = new THREE.MeshBasicMaterial({
			map: glowTex,
			color: PALETTES.light.accent,
			transparent: true,
			opacity: 0.45,
			depthWrite: false
		});
		const sun = new THREE.Mesh(sunGeo, sunMat);
		sun.position.set(0, 4.5, -70);
		scene.add(sun);

		// ============================================================
		// DRIFTING MOTES — sparse points rising like slow embers
		// ============================================================
		const MOTES = isMobile ? 40 : 80;
		const motePos = new Float32Array(MOTES * 3);
		for (let i = 0; i < MOTES; i++) {
			motePos[i * 3] = (Math.random() - 0.5) * 70;
			motePos[i * 3 + 1] = Math.random() * 14;
			motePos[i * 3 + 2] = -5 - Math.random() * 55;
		}
		const moteGeo = new THREE.BufferGeometry();
		moteGeo.setAttribute('position', new THREE.BufferAttribute(motePos, 3));
		const moteMat = new THREE.PointsMaterial({
			color: PALETTES.light.accent,
			size: 0.09,
			transparent: true,
			opacity: 0.35,
			sizeAttenuation: true,
			depthWrite: false
		});
		const motes = new THREE.Points(moteGeo, moteMat);
		scene.add(motes);

		function driftMotes() {
			const pos = moteGeo.attributes.position;
			for (let i = 0; i < MOTES; i++) {
				pos.array[i * 3 + 1] += 0.008;
				if (pos.array[i * 3 + 1] > 15) pos.array[i * 3 + 1] = 0;
			}
			pos.needsUpdate = true;
		}

		// === Theme transitions (lerped every frame, cheap) ===
		const current = {
			accent: new THREE.Color(PALETTES.light.accent),
			fog: new THREE.Color(PALETTES.light.fog),
			terrain: new THREE.Color(PALETTES.light.terrain)
		};
		const target = {
			accent: current.accent.clone(),
			fog: current.fog.clone(),
			terrain: current.terrain.clone()
		};
		const unsubscribeTheme = themeStore.subscribe((name) => {
			const p = PALETTES[name] || PALETTES.light;
			target.accent.set(p.accent);
			target.fog.set(p.fog);
			target.terrain.set(p.terrain);
		});
		function applyColors(a = 0.06) {
			current.accent.lerp(target.accent, a);
			current.fog.lerp(target.fog, a);
			current.terrain.lerp(target.terrain, a);
			scene.fog.color.copy(current.fog);
			terrainMat.color.copy(current.terrain);
			sunMat.color.copy(current.accent);
			moteMat.color.copy(current.accent);
		}

		// === Scroll: gently sink the horizon as content takes over ===
		function updateScroll() {
			const f = Math.min(window.scrollY / (window.innerHeight * 0.9), 1);
			canvas.style.opacity = String(1 - 0.7 * f);
			sun.position.y = 4.5 - f * 2.5;
		}
		function onScroll() {
			updateScroll();
		}
		updateScroll();

		function onResize() {
			camera.aspect = window.innerWidth / window.innerHeight;
			camera.updateProjectionMatrix();
			renderer.setSize(window.innerWidth, window.innerHeight);
		}
		window.addEventListener('scroll', onScroll, { passive: true });
		window.addEventListener('resize', onResize);

		// === Animation loop ===
		let rafId = 0;
		const clock = new THREE.Clock();
		let running = true;

		function renderFrame() {
			const t = clock.getElapsedTime();
			applyColors();
			displaceTerrain(t);
			driftMotes();

			// slow autonomous drift — no pointer tracking, nothing to chase
			camera.position.x = Math.sin(t * 0.05) * 1.8;
			camera.position.y = 4.2 + Math.sin(t * 0.09) * 0.5;
			camera.lookAt(0, 1.2, -40);

			renderer.render(scene, camera);
		}

		function loop() {
			if (!running) return;
			renderFrame();
			rafId = requestAnimationFrame(loop);
		}

		function disposeAll() {
			terrainGeo.dispose();
			terrainMat.dispose();
			sunGeo.dispose();
			sunMat.dispose();
			glowTex.dispose();
			moteGeo.dispose();
			moteMat.dispose();
			renderer.dispose();
		}

		if (prefersReducedMotion) {
			applyColors(1);
			displaceTerrain(0);
			renderFrame();
			const unsubStatic = themeStore.subscribe(() => {
				applyColors(1);
				renderer.render(scene, camera);
			});
			const staticResize = () => {
				onResize();
				renderer.render(scene, camera);
			};
			window.addEventListener('resize', staticResize);
			return () => {
				unsubStatic();
				unsubscribeTheme();
				window.removeEventListener('resize', staticResize);
				window.removeEventListener('scroll', onScroll);
				window.removeEventListener('resize', onResize);
				disposeAll();
			};
		}

		function onVisibility() {
			if (document.hidden) {
				running = false;
				cancelAnimationFrame(rafId);
			} else if (!running) {
				running = true;
				loop();
			}
		}
		document.addEventListener('visibilitychange', onVisibility);
		loop();

		return () => {
			running = false;
			cancelAnimationFrame(rafId);
			document.removeEventListener('visibilitychange', onVisibility);
			window.removeEventListener('scroll', onScroll);
			window.removeEventListener('resize', onResize);
			unsubscribeTheme();
			disposeAll();
		};
	});
</script>

<canvas bind:this={canvas} class="three-scene" aria-hidden="true"></canvas>

<style>
	.three-scene {
		position: fixed;
		inset: 0;
		width: 100%;
		height: 100%;
		z-index: 0;
		pointer-events: none;
		display: block;
		transition: opacity 0.25s linear;
	}
</style>
