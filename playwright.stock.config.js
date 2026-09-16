import config from './playwright.config.js';

// Stock fixtures create their own isolated servers; the queue fixture is a production bundle.
export default {
	...config,
	webServer: undefined,
	workers: 1,
	testMatch: /stock-(locations-ui|queue-emulator)\.test\.js/
};
