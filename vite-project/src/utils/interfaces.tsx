export interface KNNDataItem {
	sample_id: string;
	knn_indices: number[];
	knn_distances: number[];
}

export interface TSNEDataItem {
	sample_id: string;
	X1: number;
	X2: number;
	data_source: string;
	[key: string]: string | number; // Allow for dynamic metadata attributes
}

export interface BreakdownItem {
	value: string;
	count: number;
	percentage: number;
	pValue: string;
	adjustedPValue: string;
	totalInCategory: number;
	neighborFrequency: string;
	databaseFrequency: string;
	enrichmentRatio: number;
	probabilityScore: number;
}

export interface MetadataReportItem {
	mostProbable: string;
	probability: number;
	breakdown: BreakdownItem;
}

export interface DrugData {
	drug: string;
	averageAUC: number;
	count: number;
	aucs: number[];
	totalSamples: number;
}

export interface DrugResponse {
	sample_id: string;
	inhibitor: string;
	auc: number;
}

export interface DrugComparison {
	drug: string;
	neighborAvg: number;
	allSamplesAvg: number;
	pValue: number;
	significant: boolean;
	totalSamples?: number;
}

export interface DrugReport {
	allSamples?: DrugData[];
	neighborSamples?: DrugData[];
	comparisons?: (DrugComparison | null)[];
}

export interface MutationReport {
	gene: string;
	count: number;
	pValue: number;
	neighborFrequency: string;
	databaseFrequency: string;
}

export interface ProcessedData {
	sample: {
		sample_id: string;
		[key: string]: unknown;
	};
	metadataReport: Record<string, MetadataReportItem>;
	mutationReport: MutationReport;
	drugReport: {
		allSamples?: DrugData[];
		neighborSamples?: DrugData[];
		comparisons?: (DrugComparison | null)[];
	};
}
