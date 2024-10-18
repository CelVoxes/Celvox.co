// Add this new function at the top level of the file
export function calculateHypergeometricPValue(
	k: number,
	n: number,
	K: number,
	N: number
): number {
	// Ensure inputs are valid
	if (k < 0 || n < 0 || K < 0 || N < 0 || k > n || K > N || n > N) {
		return NaN;
	}

	let pValue = 0;
	const maxSuccesses = Math.min(n, K);

	for (let i = k; i <= maxSuccesses; i++) {
		const logProb =
			logCombination(K, i) +
			logCombination(N - K, n - i) -
			logCombination(N, n);
		pValue += Math.exp(logProb);
	}

	return pValue;
}

function logCombination(n: number, k: number): number {
	return logFactorial(n) - logFactorial(k) - logFactorial(n - k);
}

function logFactorial(n: number): number {
	if (n <= 1) return 0;
	let result = 0;
	for (let i = 2; i <= n; i++) {
		result += Math.log(i);
	}
	return result;
}

export function adjustPValues(pValues: number[]): number[] {
	const n = pValues.length;
	// Create a copy of the array before sorting
	const sortedPValues = [...pValues].sort((a, b) => a - b);
	const adjustedPValues = sortedPValues.map((p, index) => {
		const adjustedPValue = Math.min(1, (p * n) / (index + 1));
		return adjustedPValue;
	});
	return adjustedPValues;
}
