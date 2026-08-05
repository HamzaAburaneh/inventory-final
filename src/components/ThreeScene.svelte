<script>
	import * as THREE from 'three';

	let canvas = $state(null);

	function readScenePalette() {
		const styles = getComputedStyle(document.documentElement);
		return {
			accent: styles.getPropertyValue('--scene-accent').trim(),
			fog: styles.getPropertyValue('--scene-fog').trim(),
			terrain: styles.getPropertyValue('--scene-terrain').trim(),
			glowRgb: styles.getPropertyValue('--scene-glow-rgb').trim()
		};
	}

	$effect(() => {
		if (!canvas) return;

		const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
		const isMobile = window.innerWidth < 768;
		const context = canvas.getContext('webgl2', {
			alpha: true,
			antialias: false,
			powerPreference: 'high-performance'
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
			antialias: false,
			powerPreference: 'high-performance'
		});
		renderer.setPixelRatio(Math.min(window.devicePixelRatio, isMobile ? 1.25 : 1.5));
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
		const SEG_X = isMobile ? 56 : 96;
		const SEG_Z = isMobile ? 36 : 60;
		const terrainGeo = new THREE.PlaneGeometry(140, 90, SEG_X, SEG_Z);
		terrainGeo.rotateX(-Math.PI / 2);
		const basePos = terrainGeo.attributes.position.array.slice();

		const terrainMat = new THREE.MeshBasicMaterial({
			color: initialPalette.terrain,
			wireframe: true,
			transparent: true,
			opacity: 0.32,
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

		// ============================================================
		// HORIZON SUN — one plane with a feathered radial-gradient
		// texture, so the glow dissolves with no hard edge.
		// ============================================================
		const glowCanvas = document.createElement('canvas');
		glowCanvas.width = 256;
		glowCanvas.height = 256;
		const glowCtx = glowCanvas.getContext('2d');
		const gradient = glowCtx.createRadialGradient(128, 128, 0, 128, 128, 128);
		gradient.addColorStop(0, `rgba(${initialPalette.glowRgb}, 0.85)`);
		gradient.addColorStop(0.35, `rgba(${initialPalette.glowRgb}, 0.3)`);
		gradient.addColorStop(0.7, `rgba(${initialPalette.glowRgb}, 0.08)`);
		gradient.addColorStop(1, `rgba(${initialPalette.glowRgb}, 0)`);
		glowCtx.fillStyle = gradient;
		glowCtx.fillRect(0, 0, 256, 256);
		const glowTex = new THREE.CanvasTexture(glowCanvas);

		const sunGeo = new THREE.PlaneGeometry(38, 38);
		const sunMat = new THREE.MeshBasicMaterial({
			map: glowTex,
			color: initialPalette.accent,
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

		// Soft round sprite. PointsMaterial draws a bare quad without a map, so at
		// the size below the near motes would read as squares — this feathers them
		// into dots with a bright core, which is also what makes them easier to
		// pick out than simply raising the opacity of a flat square would.
		// Kept white: the material's `color` is lerped to the theme accent every
		// frame in applyColors(), and map * color does the tinting.
		const moteCanvas = document.createElement('canvas');
		moteCanvas.width = 64;
		moteCanvas.height = 64;
		const moteCtx = moteCanvas.getContext('2d');
		// Shaped like a neon bulb: a solid core with a hard shoulder, then a bright
		// near-glow that decays into a long faint tail — the profile you get from
		// stacking box-shadows at 20/40/60/80px over a filled dot. The plateau
		// around 0.46 stands in for the wide, low-alpha ring those bulbs carry.
		//
		// Brightness is what separates a bulb from a smudge, not width: an earlier
		// pass had a halo this wide but at low alpha and it just read as being out
		// of focus. The hard core edge at 0.26/0.30 is the other half of that.
		const moteGradient = moteCtx.createRadialGradient(32, 32, 0, 32, 32, 32);
		moteGradient.addColorStop(0, 'rgba(255, 255, 255, 1)');
		moteGradient.addColorStop(0.26, 'rgba(255, 255, 255, 1)');
		moteGradient.addColorStop(0.3, 'rgba(255, 255, 255, 0.72)');
		moteGradient.addColorStop(0.38, 'rgba(255, 255, 255, 0.42)');
		moteGradient.addColorStop(0.46, 'rgba(255, 255, 255, 0.3)');
		moteGradient.addColorStop(0.56, 'rgba(255, 255, 255, 0.18)');
		moteGradient.addColorStop(0.72, 'rgba(255, 255, 255, 0.08)');
		moteGradient.addColorStop(0.88, 'rgba(255, 255, 255, 0.03)');
		moteGradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
		moteCtx.fillStyle = moteGradient;
		moteCtx.fillRect(0, 0, 64, 64);
		const moteTex = new THREE.CanvasTexture(moteCanvas);
		// The sprite is drawn much smaller than 64px on screen; mipmapping that
		// down softens the edge we just sharpened, so sample it directly.
		moteTex.generateMipmaps = false;
		moteTex.minFilter = THREE.LinearFilter;

		const moteMat = new THREE.PointsMaterial({
			color: initialPalette.accent,
			map: moteTex,
			// Holds the solid core near 6px on the nearest motes now that the core
			// is 26% of the sprite, leaving the rest of the quad for the glow.
			size: 0.5,
			transparent: true,
			// Full strength, so a mote lands on the accent's true value (the gold
			// of the panel ring in dark, the app blue in light) instead of a
			// washed-out fraction of it.
			opacity: 1,
			sizeAttenuation: true,
			depthWrite: false
		});
		const motes = new THREE.Points(moteGeo, moteMat);
		scene.add(motes);

		// Every material here is depthWrite: false, so nothing populates the depth
		// buffer and draw order is decided purely by the transparent sort — which
		// orders back-to-front by z. The motes span z -5..-60 and the terrain plane
		// is 90 deep, so they genuinely interleave and motes kept disappearing
		// behind wireframe crests. Explicit renderOrder pins the layering: horizon
		// glow, then terrain, then motes always last and on top. depthTest is off
		// on the motes so no future opaque geometry can occlude them either.
		sun.renderOrder = 0;
		terrain.renderOrder = 1;
		motes.renderOrder = 2;
		moteMat.depthTest = false;

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
			accent: new THREE.Color(initialPalette.accent),
			fog: new THREE.Color(initialPalette.fog),
			terrain: new THREE.Color(initialPalette.terrain)
		};
		const target = {
			accent: current.accent.clone(),
			fog: current.fog.clone(),
			terrain: current.terrain.clone()
		};
		function applyColors(a = 0.06) {
			current.accent.lerp(target.accent, a);
			current.fog.lerp(target.fog, a);
			current.terrain.lerp(target.terrain, a);
			scene.fog.color.copy(current.fog);
			terrainMat.color.copy(current.terrain);
			sunMat.color.copy(current.accent);
			moteMat.color.copy(current.accent);
		}
		const themeObserver = new MutationObserver(() => {
			const palette = readScenePalette();
			target.accent.set(palette.accent);
			target.fog.set(palette.fog);
			target.terrain.set(palette.terrain);
			if (prefersReducedMotion) {
				applyColors(1);
				renderer.render(scene, camera);
			}
		});
		themeObserver.observe(document.documentElement, {
			attributes: true,
			attributeFilter: ['data-theme']
		});

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
		// Monotonic elapsed seconds since mount. Avoids THREE.Clock (deprecated in
		// favour of THREE.Timer); performance.now() is all this loop needs.
		const startTime = performance.now();
		let running = true;

		function renderFrame() {
			const t = (performance.now() - startTime) / 1000;
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
			moteTex.dispose();
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
				themeObserver.disconnect();
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
			themeObserver.disconnect();
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
