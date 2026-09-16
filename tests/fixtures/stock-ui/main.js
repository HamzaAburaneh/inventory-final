import { mount } from 'svelte';
import StockUiHarness from './StockUiHarness.svelte';
import '../../../src/styles/global.css';

mount(StockUiHarness, { target: document.getElementById('app') });
