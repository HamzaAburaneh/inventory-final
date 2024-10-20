declare module 'arima' {
	export class ARIMA {
		constructor(options: { p: number; d: number; q: number; verbose?: boolean });

		train(data: number[]): void;
		predict(steps: number): [number[], number[]];
	}
}
