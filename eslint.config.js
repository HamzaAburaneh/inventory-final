import js from '@eslint/js';
import svelte from 'eslint-plugin-svelte';
import prettier from 'eslint-config-prettier';
import globals from 'globals';

/** @type {import('eslint').Linter.Config[]} */
export default [
	js.configs.recommended,
	...svelte.configs.recommended,
	prettier,
	...svelte.configs.prettier,
	{
		languageOptions: {
			globals: {
				...globals.browser,
				...globals.node
			}
		}
	},
	{
		rules: {
			'no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
			// App is not deployed under a base path; resolve() adds noise without benefit here.
			'svelte/no-navigation-without-resolve': 'off',
			// Dates in $state are always replaced wholesale (never mutated in place),
			// so SvelteDate is unnecessary.
			'svelte/prefer-svelte-reactivity': 'off'
		}
	},
	{
		ignores: ['build/', '.svelte-kit/', 'dist/', 'svelte5-syntax']
	}
];
