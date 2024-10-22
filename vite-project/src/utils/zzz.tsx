// Add this new function at the top level of the file
export function calculateHypergeometricPValue(
	k: number, // Number of samples with the gene mutation among the neighbors
	n: number, // Number of neighbors (k in your KNN)
	K: number, // Total number of samples with the gene mutation in the entire dataset
	N: number // Total number of samples in the dataset
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

export const renderMarkdown = (text: string) => {
	const lines = text.split("\n");
	return lines.map((line, index) => {
		if (line.startsWith("# ")) {
			return (
				<h1 key={index} className="text-2xl font-bold mt-4 mb-2">
					{line.slice(2)}
				</h1>
			);
		} else if (line.startsWith("## ")) {
			return (
				<h2 key={index} className="text-xl font-semibold mt-3 mb-2">
					{line.slice(3)}
				</h2>
			);
		} else if (line.startsWith("### ")) {
			return (
				<h3 key={index} className="text-lg font-medium mt-2 mb-1">
					{line.slice(4)}
				</h3>
			);
		} else if (line.startsWith("- ")) {
			return (
				<li key={index} className="ml-4 list-disc list-inside">
					{line.slice(2)}
				</li>
			);
		} else if (line.match(/^\d+\. /)) {
			return (
				<li key={index} className="ml-4 list-decimal list-inside">
					{line.slice(line.indexOf(" ") + 1)}
				</li>
			);
		} else if (line.trim() === "") {
			return <br key={index} />;
		} else {
			return (
				<p key={index} className="mb-2">
					{line}
				</p>
			);
		}
	});
};
