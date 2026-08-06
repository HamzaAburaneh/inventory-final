<script>
	import * as THREE from 'three';

	let canvas = $state(null);

	function readScenePalette() {
		const styles = getComputedStyle(document.documentElement);
		return {
			accent: styles.getPropertyValue('--scene-accent').trim(),
			fog: styles.getPropertyValue('--scene-fog').trim(),
			terrain: styles.getPropertyValue('--scene-terrain').trim(),
			terrainOpacity: styles.getPropertyValue('--scene-terrain-opacity').trim(),
			scrollFade: styles.getPropertyValue('--scene-scroll-fade').trim()
		};
	}

	function parseSceneNumber(value, fallback) {
		if (value === '') return fallback;
		const parsed = Number(value);
		return Number.isFinite(parsed) ? parsed : fallback;
	}

	$effect(() => {
		if (!canvas) return;

		const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
		const isMobile = window.innerWidth < 768;
		// Antialiasing must be requested at context-creation time, not on the
		// renderer (it inherits whatever `context` was already made with) — this
		// is what keeps the wireframe from turning into moiré noise where the
		// grid lines compress toward the horizon.
		// `powerPreference: 'high-performance'` is deliberately NOT set: on hybrid-GPU
		// laptops it forces the discrete card awake for what is only a background
		// scene, which is a large power/heat cost for no visual gain.
		const context = canvas.getContext('webgl2', {
			alpha: true,
			antialias: true
		});
		if (!context) {
			canvas.classList.add('webgl-unavailable');
			return;
		}
		const initialPalette = readScenePalette();

		const renderer = new THREE.WebGLRenderer({
			canvas,
			context,
			alpha: true,
			antialias: true
		});
		// Fragment cost scales with the square of this, so it is the single biggest
		// GPU lever here. MSAA still runs at whatever ratio we pick, so the wireframe
		// stays smooth-edged — capping this trades resolution, not antialiasing.
		renderer.setPixelRatio(Math.min(window.devicePixelRatio, isMobile ? 1 : 1.25));
		renderer.setSize(window.innerWidth, window.innerHeight);

		const scene = new THREE.Scene();
		scene.fog = new THREE.FogExp2(initialPalette.fog, 0.022);

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
		// Kept deliberately coarse. The dune wavelengths below span ~18 segments each,
		// so the surface still reads as smooth, but a denser grid only produced cells
		// too small to resolve — near the horizon they merged into a solid smear while
		// costing vertices to displace every frame and lines to rasterize.
		const SEG_X = isMobile ? 44 : 64;
		const SEG_Z = isMobile ? 28 : 40;
		const terrainGeo = new THREE.PlaneGeometry(140, 90, SEG_X, SEG_Z);
		terrainGeo.rotateX(-Math.PI / 2);
		const basePos = terrainGeo.attributes.position.array.slice();

		const terrainMat = new THREE.MeshBasicMaterial({
			color: initialPalette.terrain,
			wireframe: true,
			transparent: true,
			opacity: parseSceneNumber(initialPalette.terrainOpacity, 0.32),
			depthWrite: false
		});
		const terrain = new THREE.Mesh(terrainGeo, terrainMat);
		terrain.position.set(0, 0, -28);
		scene.add(terrain);

		// Standing waves, not travelling ones. Putting `t` inside the spatial phase
		// (sin(x*k + t*w)) marches the crests across the plane, and because the two
		// z-terms used to travel in opposite directions at similar speeds they beat
		// against each other — which is why the grid only *sometimes* looked like it
		// was creeping toward the horizon. Here the spatial phase is fixed and only
		// the amplitude breathes, so every crest stays put and the surface just
		// swells and relaxes in place.
		//
		// The spatial half is therefore constant per vertex, so it is computed once
		// here instead of four trig calls per vertex per frame.
		const vertexCount = terrainGeo.attributes.position.count;
		const shapeXZ = new Float32Array(vertexCount);
		const shapeX = new Float32Array(vertexCount);
		const shapeZ = new Float32Array(vertexCount);
		for (let i = 0; i < vertexCount; i++) {
			const x = basePos[i * 3];
			const z = basePos[i * 3 + 2];
			shapeXZ[i] = Math.sin(x * 0.16) * Math.cos(z * 0.13);
			shapeX[i] = Math.sin(x * 0.045);
			shapeZ[i] = Math.cos(z * 0.05);
		}

		function displaceTerrain(t) {
			const pos = terrainGeo.attributes.position;
			// Each envelope stays positive (0.1..1 and 0.2..1 of nominal) so the
			// terrain never flattens to nothing or inverts through zero, and the
			// three run at unrelated rates so they never trough together.
			const ampXZ = 1.5 * (0.55 + 0.45 * Math.sin(t * 0.22));
			const ampX = 2.2 * (0.6 + 0.4 * Math.sin(t * 0.1 + 1.7));
			const ampZ = 1.4 * (0.6 + 0.4 * Math.cos(t * 0.07));
			for (let i = 0; i < vertexCount; i++) {
				pos.array[i * 3 + 1] = shapeXZ[i] * ampXZ + shapeX[i] * ampX + shapeZ[i] * ampZ;
			}
			pos.needsUpdate = true;
		}

		// === Theme transitions (lerped every frame, cheap) ===
		const current = {
			accent: new THREE.Color(initialPalette.accent),
			fog: new THREE.Color(initialPalette.fog),
			terrain: new THREE.Color(initialPalette.terrain)
		};
		const target = {
			accent: current.accent.clone(),
			fog: current.fog.clone(),
			terrain: current.terrain.clone()
		};
		// Per-frame lerp, so the default is tuned to the capped 30fps loop below —
		// at 0.06 (the old 60fps value) a theme switch would now fade twice as slowly.
		function applyColors(a = 0.12) {
			current.accent.lerp(target.accent, a);
			current.fog.lerp(target.fog, a);
			current.terrain.lerp(target.terrain, a);
			scene.fog.color.copy(current.fog);
			terrainMat.color.copy(current.terrain);
		}
		let scrollFade = parseSceneNumber(initialPalette.scrollFade, 0.7);
		function syncScenePalette() {
			const palette = readScenePalette();
			target.accent.set(palette.accent);
			target.fog.set(palette.fog);
			target.terrain.set(palette.terrain);
			terrainMat.opacity = parseSceneNumber(palette.terrainOpacity, 0.32);
			scrollFade = parseSceneNumber(palette.scrollFade, 0.7);
			updateScroll();
			if (prefersReducedMotion) {
				applyColors(1);
				renderer.render(scene, camera);
			}
		}
		const themeObserver = new MutationObserver(syncScenePalette);
		themeObserver.observe(document.documentElement, {
			attributes: true,
			attributeFilter: ['data-theme']
		});
		// CSS HMR replaces stylesheet contents without changing `data-theme`, so
		// re-read the computed custom properties after Vite applies an update.
		if (import.meta.hot) {
			import.meta.hot.on('vite:afterUpdate', syncScenePalette);
		}
		function stopScenePaletteSync() {
			themeObserver.disconnect();
			if (import.meta.hot) {
				import.meta.hot.off('vite:afterUpdate', syncScenePalette);
			}
		}

		// === Scroll: gently sink the horizon as content takes over ===
		function updateScroll() {
			const f = Math.min(window.scrollY / (window.innerHeight * 0.9), 1);
			canvas.style.opacity = String(1 - scrollFade * f);
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
		// Monotonic elapsed seconds since mount. Avoids THREE.Clock (deprecated in
		// favour of THREE.Timer); performance.now() is all this loop needs.
		const startTime = performance.now();
		let running = true;

		function renderFrame() {
			const t = (performance.now() - startTime) / 1000;
			applyColors();
			displaceTerrain(t);

			// slow autonomous drift — no pointer tracking, nothing to chase
			camera.position.x = Math.sin(t * 0.05) * 1.8;
			camera.position.y = 4.2 + Math.sin(t * 0.09) * 0.5;
			camera.lookAt(0, 1.2, -40);

			renderer.render(scene, camera);
		}

		// The drift and the breathing are slow enough that 30fps is indistinguishable
		// from 60 here, and it halves both the per-frame vertex work and the
		// rasterization cost. All motion is driven by elapsed seconds, not by frame
		// count, so capping the rate slows nothing down — it only draws less often.
		const FRAME_INTERVAL = 1000 / 30;
		// Slack so a 60Hz vsync tick landing a hair under the interval is not skipped
		// (which would drop the scene to an uneven 20fps).
		const FRAME_SLACK = 4;
		let lastFrame = 0;

		function loop(now = performance.now()) {
			if (!running) return;
			rafId = requestAnimationFrame(loop);
			if (now - lastFrame < FRAME_INTERVAL - FRAME_SLACK) return;
			lastFrame = now;
			renderFrame();
		}

		function disposeAll() {
			terrainGeo.dispose();
			terrainMat.dispose();
			renderer.dispose();
		}

		if (prefersReducedMotion) {
			applyColors(1);
			displaceTerrain(0);
			renderFrame();
			const staticResize = () => {
				onResize();
				renderer.render(scene, camera);
			};
			window.addEventListener('resize', staticResize);
			return () => {
				stopScenePaletteSync();
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
			stopScenePaletteSync();
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
