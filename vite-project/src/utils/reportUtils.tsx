import { calculateBinomialProbability } from "@/utils/zzz";
import { TSNEDataItem, KNNDataItem } from "@/utils/interfaces";

const METADATA_ATTRIBUTES = [
	"sex",
	"tissue",
	"prim_rec",
	"FAB",
	"WHO_2022",
	"ICC_2022",
	"KMT2A_diagnosis",
	"rare_diagnosis",
	"clusters",
	"blasts",
];

export const generateKNNReport = (
	tsneData: TSNEDataItem[],
	knnData: KNNDataItem[],
	k: number
): Record<string, Record<string, unknown>> => {
	const uploadedSamples = tsneData.filter((d) => d.data_source === "uploaded");
	const newReport: Record<string, Record<string, unknown>> = {};

	// Calculate overall frequencies for each attribute
	const overallFrequencies: Record<string, Record<string, number>> = {};
	METADATA_ATTRIBUTES.forEach((attr) => {
		overallFrequencies[attr] = tsneData.reduce((acc, sample) => {
			const value = sample[attr];
			if (value !== null && value !== undefined && value !== "NA") {
				acc[value] = (acc[value] || 0) + 1;
			}
			return acc;
		}, {} as Record<string, number>);
	});

	uploadedSamples.forEach((sample) => {
		const knnItem = knnData.find((item) => item.sample_id === sample.sample_id);

		if (knnItem) {
			const neighbors = knnItem.knn_indices
				.slice(0, k)
				.map((index) => {
					const neighborKNN = knnData[index - 1];
					return neighborKNN
						? tsneData.find((d) => d.sample_id === neighborKNN.sample_id)
						: null;
				})
				.filter((n): n is TSNEDataItem => n !== null);

			const sampleReport: Record<string, unknown> = {};

			METADATA_ATTRIBUTES.forEach((attr) => {
				const values = neighbors
					.map((neighbor) => neighbor[attr])
					.filter(
						(value): value is string | number =>
							value !== null && value !== undefined && value !== "NA"
					);

				if (values.length === 0) {
					sampleReport[attr] = {
						mostProbable: "No data available",
						probability: 0,
						breakdown: [],
					};
				} else {
					// Calculate value counts within the neighbors
					const valueCount = values.reduce((acc, value) => {
						acc[value] = (acc[value] || 0) + 1;
						return acc;
					}, {} as Record<string, number>);

					const sortedValues = Object.entries(valueCount).sort(
						(a, b) => b[1] - a[1]
					);

					const breakdown = sortedValues.map(([value, count]) => {
						const totalInCategory = overallFrequencies[attr][value] || 0;
						const p = totalInCategory / tsneData.length;
						const binomialPValue = calculateBinomialProbability(k, count, p);

						// Add safety check for enrichment ratio calculation
						const enrichmentRatio =
							totalInCategory === 0 || k === 0
								? 0
								: Math.log(count / k / (totalInCategory / tsneData.length));

						return {
							value,
							count,
							percentage: (count / k) * 100,
							totalInCategory,
							neighborFrequency: `${count}/${k}`,
							databaseFrequency: `${totalInCategory}/${tsneData.length}`,
							enrichmentRatio,
							probabilityScore: binomialPValue,
						};
					});

					sampleReport[attr] = {
						breakdown: breakdown.sort(
							(a, b) => a.probabilityScore - b.probabilityScore
						),
					};
				}
			});

			newReport[sample.sample_id] = sampleReport;
		}
	});

	return newReport;
};
