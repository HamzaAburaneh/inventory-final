import { mount } from 'svelte';
import VendorUiHarness from './VendorUiHarness.svelte';
import '../../../src/styles/global.css';

mount(VendorUiHarness, { target: document.getElementById('app') });
