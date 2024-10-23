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
		} else if (line.startsWith("#### ")) {
			return (
				<h4 key={index} className="text-base font-normal mt-1 mb-1">
					{line.slice(5)}
				</h4>
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

export const calculateTTest = (aucs1: number[], aucs2: number[]) => {
	// Calculate means
	const mean1 = aucs1.reduce((sum, val) => sum + val, 0) / aucs1.length;
	const mean2 = aucs2.reduce((sum, val) => sum + val, 0) / aucs2.length;

	// Calculate variances
	const variance1 =
		aucs1.reduce((sum, val) => sum + Math.pow(val - mean1, 2), 0) /
		(aucs1.length - 1);
	const variance2 =
		aucs2.reduce((sum, val) => sum + Math.pow(val - mean2, 2), 0) /
		(aucs2.length - 1);

	// Calculate t-statistic
	const n1 = aucs1.length;
	const n2 = aucs2.length;
	const pooledSE = Math.sqrt(variance1 / n1 + variance2 / n2);
	const tStatistic = (mean1 - mean2) / pooledSE;

	// Calculate degrees of freedom (using Welch–Satterthwaite equation)
	const df =
		Math.pow(variance1 / n1 + variance2 / n2, 2) /
		(Math.pow(variance1 / n1, 2) / (n1 - 1) +
			Math.pow(variance2 / n2, 2) / (n2 - 1));

	// Calculate p-value (two-tailed test)
	const pValue = 2 * (1 - tDistribution(Math.abs(tStatistic), df));

	return {
		tStatistic,
		degreesOfFreedom: df,
		pValue,
	};
};

// Add this function to calculate p-value using t-distribution
function tDistribution(t: number, df: number): number {
	// This is a simplified approximation of the t-distribution
	// For more accurate results, consider using a statistical library
	const x = df / (df + t * t);
	const result = 1 - 0.5 * Math.pow(x, df / 2);
	return result;
}
