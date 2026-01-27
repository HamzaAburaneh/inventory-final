<script>
	import { onMount, onDestroy } from 'svelte';
	import * as THREE from 'three';

	let container;
	let scene, camera, renderer;
	let geometry, material, mesh; // Added declarations
	let lines = [];
	let animationId;

	onMount(() => {
		init();
		animate();
	});

	onDestroy(() => {
		if (typeof window !== 'undefined') {
			if (animationId) cancelAnimationFrame(animationId);
			window.removeEventListener('resize', onWindowResize);
		}
		if (renderer) renderer.dispose();
		if (geometry) geometry.dispose();
		if (material) material.dispose();
	});

	function init() {
		if (!container) return;

		scene = new THREE.Scene();
		
		camera = new THREE.PerspectiveCamera(
			75,
			container.clientWidth / container.clientHeight,
			1,
			2000
		);
		camera.position.z = 600;

		// Create Floating Particles
		geometry = new THREE.BufferGeometry();
		const particlesCount = 1500;
		const posArray = new Float32Array(particlesCount * 3);

		for(let i = 0; i < particlesCount * 3; i+=3) {
			// Spread particles across a large volume
			posArray[i] = (Math.random() - 0.5) * 1000; // x
			posArray[i+1] = (Math.random() - 0.5) * 1000; // y
			posArray[i+2] = (Math.random() - 0.5) * 1000; // z
		}

		geometry.setAttribute('position', new THREE.BufferAttribute(posArray, 3));
		
		material = new THREE.PointsMaterial({
			size: 2,
			color: 0xffe260, // Tech Yellow
			transparent: true,
			opacity: 0.6,
			sizeAttenuation: true
		});

		mesh = new THREE.Points(geometry, material);
		scene.add(mesh);

		renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
		renderer.setSize(container.clientWidth, container.clientHeight);
		renderer.setPixelRatio(
			typeof window !== 'undefined' ? Math.min(window.devicePixelRatio, 2) : 1
		);
		container.appendChild(renderer.domElement);

		if (typeof window !== 'undefined') {
			window.addEventListener('resize', onWindowResize);
		}
	}

	function onWindowResize() {
		if (!container || !camera || !renderer) return;
		camera.aspect = container.clientWidth / container.clientHeight;
		camera.updateProjectionMatrix();
		renderer.setSize(container.clientWidth, container.clientHeight);
	}

	function animate() {
		if (typeof window !== 'undefined') {
			animationId = requestAnimationFrame(animate);
		}

		// Slowly rotate the particle cloud
		if (mesh) {
			mesh.rotation.y += 0.0005;
			mesh.rotation.x += 0.0002;
		}

		if (renderer && scene && camera) {
			renderer.render(scene, camera);
		}
	}
</script>

<div class="three-container" bind:this={container}></div>

<style>
	.three-container {
		width: 100%;
		height: 100%;
		position: absolute;
		top: 0;
		left: 0;
		z-index: 0;
		pointer-events: none;
		overflow: hidden;
	}
</style>
