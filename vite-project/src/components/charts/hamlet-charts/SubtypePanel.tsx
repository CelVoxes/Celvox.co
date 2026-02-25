import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import { AlertCircle, CheckCircle, Info } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

type PredictionRecord = Record<string, any>;

interface SubtypePanelProps {
	subtype: PredictionRecord;
	sampleName: string;
}

interface PredictionViewProps {
	prediction: PredictionRecord | null;
	sampleName: string;
	title: string;
	emptyMessage: string;
	referenceLabel: string;
	referenceHref?: string;
	methodologyNote: string;
	clinicalNote: string;
	extraExcludedKeys?: string[];
}

const COMMON_PREDICTION_FIELDS = [
	"predicted_subtype",
	"subtype",
	"classification",
	"predicted_class",
	"final_prediction",
	"best_subtype",
	"prediction",
	"predicted_label",
	"class_label",
];

const isRecord = (value: unknown): value is PredictionRecord =>
	typeof value === "object" && value !== null && !Array.isArray(value);

const hasDirectPredictionField = (value: unknown) => {
	if (!isRecord(value)) return false;
	return COMMON_PREDICTION_FIELDS.some(
		(field) => typeof value[field] === "string" && value[field].length > 0
	);
};

const findNestedPredictionByKey = (
	root: PredictionRecord,
	keyMatcher: (key: string) => boolean
): PredictionRecord | null => {
	for (const [key, value] of Object.entries(root)) {
		if (keyMatcher(key) && isRecord(value)) {
			return value;
		}
	}

	const containerKeys = ["predictions", "models", "classifiers", "diagnostics"];
	for (const containerKey of containerKeys) {
		const container = root[containerKey];
		if (!isRecord(container)) continue;
		for (const [key, value] of Object.entries(container)) {
			if (keyMatcher(key) && isRecord(value)) {
				return value;
			}
		}
	}

	return null;
};

const getBridgePrediction = (subtype: PredictionRecord): PredictionRecord | null =>
	findNestedPredictionByKey(subtype, (key) => key.toLowerCase().includes("bridge"));

const getStandardPrediction = (
	subtype: PredictionRecord,
	bridgePrediction: PredictionRecord | null
): PredictionRecord | null => {
	if (hasDirectPredictionField(subtype)) return subtype;

	for (const [key, value] of Object.entries(subtype)) {
		if (!isRecord(value)) continue;
		if (bridgePrediction && value === bridgePrediction) continue;
		if (hasDirectPredictionField(value)) return value;
		if (key.toLowerCase().includes("severens")) return value;
	}

	const nestedStandard = findNestedPredictionByKey(
		subtype,
		(key) => !key.toLowerCase().includes("bridge")
	);
	if (nestedStandard && hasDirectPredictionField(nestedStandard)) {
		return nestedStandard;
	}

	// Fall back to the original object to preserve existing behavior.
	return subtype;
};

function PredictionView({
	prediction,
	sampleName,
	title,
	emptyMessage,
	referenceLabel,
	referenceHref,
	methodologyNote,
	clinicalNote,
	extraExcludedKeys = [],
}: PredictionViewProps) {
	if (!prediction || Object.keys(prediction).length === 0) {
		return (
			<Card>
				<CardHeader>
					<CardTitle>{title}</CardTitle>
				</CardHeader>
				<CardContent>
					<Alert>
						<Info className="h-4 w-4" />
						<AlertDescription>{emptyMessage}</AlertDescription>
					</Alert>
				</CardContent>
			</Card>
		);
	}

	const getPrimarySubtype = () => {
		for (const field of COMMON_PREDICTION_FIELDS) {
			if (prediction[field] && typeof prediction[field] === "string") {
				return prediction[field] as string;
			}
		}

		for (const [key, value] of Object.entries(prediction)) {
			if (
				typeof value === "string" &&
				value.length > 0 &&
				!key.includes("confidence") &&
				!key.includes("probability") &&
				!key.includes("score") &&
				!key.includes("method") &&
				!key.includes("timestamp") &&
				value !== "Unknown"
			) {
				return value;
			}
		}

		return "Unknown";
	};

	const getConfidence = () =>
		prediction.confidence ?? prediction.probability ?? prediction.score;

	const getFeatures = () => {
		if (prediction.features && Array.isArray(prediction.features)) {
			return prediction.features;
		}
		if (
			prediction.contributing_factors &&
			Array.isArray(prediction.contributing_factors)
		) {
			return prediction.contributing_factors;
		}

		const possibleFeatureFields = [
			"contributing_features",
			"important_features",
			"key_features",
			"predictive_features",
			"decision_features",
			"evidence",
			"factors",
			"markers",
			"biomarkers",
		];

		for (const field of possibleFeatureFields) {
			if (prediction[field] && Array.isArray(prediction[field])) {
				return prediction[field];
			}
		}

		for (const [key, value] of Object.entries(prediction)) {
			if (
				typeof value === "string" &&
				(key.toLowerCase().includes("feature") ||
					key.toLowerCase().includes("factor") ||
					key.toLowerCase().includes("marker")) &&
				value.length > 0
			) {
				const features = value
					.split(/[,;|\n]/)
					.map((f) => f.trim())
					.filter((f) => f.length > 0);
				if (features.length > 0) return features;
			}
		}

		return [];
	};

	const getCutoffInfo = () => {
		const cutoffFields = [
			"cutoff",
			"pass_cutoff",
			"threshold",
			"decision_threshold",
			"classification_cutoff",
			"prediction_cutoff",
		];

		for (const field of cutoffFields) {
			if (prediction[field] !== undefined) {
				return { field, value: prediction[field] };
			}
		}

		for (const [key, value] of Object.entries(prediction)) {
			if (
				key.toLowerCase().includes("cutoff") ||
				key.toLowerCase().includes("threshold") ||
				key.toLowerCase().includes("pass")
			) {
				return { field: key, value };
			}
		}

		return null;
	};

	const getSampleId = () => {
		const sampleFields = [
			"sample_id",
			"sample",
			"patient_id",
			"patient",
			"id",
			"sample_name",
			"subject_id",
		];

		for (const field of sampleFields) {
			if (prediction[field] && typeof prediction[field] === "string") {
				return prediction[field] as string;
			}
		}

		return null;
	};

	const primarySubtype = getPrimarySubtype();
	const confidence = getConfidence();
	const features = getFeatures();
	const cutoffInfo = getCutoffInfo();
	const sampleId = getSampleId();

	const amlSubtypes: Record<
		string,
		{ description: string; prognosis: string; color: string }
	> = {
		"AML with t(8;21)": {
			description: "Acute Myeloid Leukemia with t(8;21) translocation",
			prognosis: "Favorable",
			color: "bg-green-100 text-green-800 border-green-200",
		},
		"AML with inv(16)": {
			description: "Acute Myeloid Leukemia with inv(16) inversion",
			prognosis: "Favorable",
			color: "bg-green-100 text-green-800 border-green-200",
		},
		"AML with t(15;17)": {
			description: "Acute Promyelocytic Leukemia (APL)",
			prognosis: "Favorable with treatment",
			color: "bg-blue-100 text-blue-800 border-blue-200",
		},
		"AML with FLT3-ITD": {
			description: "FLT3 Internal Tandem Duplication",
			prognosis: "Poor",
			color: "bg-red-100 text-red-800 border-red-200",
		},
		"AML with NPM1 mutation": {
			description: "NPM1 mutated AML",
			prognosis: "Favorable",
			color: "bg-green-100 text-green-800 border-green-200",
		},
		"AML-MRC": {
			description: "Myelodysplasia-related AML",
			prognosis: "Poor",
			color: "bg-orange-100 text-orange-800 border-orange-200",
		},
		"AML-NOS": {
			description: "AML Not Otherwise Specified",
			prognosis: "Variable",
			color: "bg-yellow-100 text-yellow-800 border-yellow-200",
		},
		"Therapy-related AML": {
			description: "Secondary AML from prior therapy",
			prognosis: "Poor",
			color: "bg-red-100 text-red-800 border-red-200",
		},
	};

	const subtypeInfo = amlSubtypes[primarySubtype] || {
		description: "Acute leukemia diagnostic prediction",
		prognosis: "Unknown",
		color: "bg-gray-100 text-gray-800 border-gray-200",
	};

	return (
		<div className="space-y-6">
			<Card className="border-2 border-blue-200">
				<CardHeader>
					<CardTitle className="flex items-center gap-2">
						<CheckCircle className="h-5 w-5 text-blue-600" />
						{title}
					</CardTitle>
				</CardHeader>
				<CardContent>
					<div className="space-y-4">
						<div className="text-center">
							<h2 className="text-3xl font-bold text-gray-900 mb-2">
								{primarySubtype}
							</h2>
							<Badge className={`text-lg px-4 py-2 ${subtypeInfo.color}`}>
								{subtypeInfo.prognosis} Prognosis
							</Badge>
						</div>

						<div className="bg-gray-50 rounded-lg p-4">
							<p className="text-gray-700">{subtypeInfo.description}</p>
						</div>

						{confidence !== undefined && confidence !== null && (
							<div className="text-center">
								<p className="text-sm text-gray-600 mb-1">
									Prediction Confidence
								</p>
								<div className="inline-flex items-center gap-2">
									{typeof confidence === "number" && (
										<div className="w-32 bg-gray-200 rounded-full h-3">
											<div
												className="bg-blue-600 h-3 rounded-full transition-all duration-300"
												style={{
													width: `${Math.min(
														100,
														Math.max(0, confidence <= 1 ? confidence * 100 : confidence)
													)}%`,
												}}
											/>
										</div>
									)}
									<span className="text-sm font-medium">
										{typeof confidence === "number"
											? confidence <= 1
												? `${(confidence * 100).toFixed(1)}%`
												: `${confidence.toFixed(1)}%`
											: String(confidence)}
									</span>
								</div>
							</div>
						)}
					</div>
				</CardContent>
			</Card>

			<div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
				<Card>
					<CardHeader>
						<CardTitle>Classification Details</CardTitle>
					</CardHeader>
					<CardContent>
						<div className="space-y-3">
							<div className="flex justify-between items-center py-2 border-b">
								<span className="text-sm font-medium">Sample ID</span>
								<span className="text-sm text-gray-600">
									{sampleId || sampleName}
									{sampleId && sampleId !== sampleName && (
										<span className="text-xs text-gray-500 ml-2">
											(from metadata: {sampleName})
										</span>
									)}
								</span>
							</div>
							<div className="flex justify-between items-center py-2 border-b">
								<span className="text-sm font-medium">Primary Prediction</span>
								<span className="text-sm text-gray-600">{primarySubtype}</span>
							</div>
							{cutoffInfo && (
								<div className="flex justify-between items-center py-2 border-b bg-green-50 px-2 rounded">
									<span className="text-sm font-medium text-green-800">
										🎯{" "}
										{cutoffInfo.field
											.replace(/_/g, " ")
											.replace(/\b\w/g, (l) => l.toUpperCase())}
									</span>
									<span className="text-sm font-bold text-green-700">
										{typeof cutoffInfo.value === "boolean"
											? cutoffInfo.value
												? "✅ PASSED"
												: "❌ FAILED"
											: String(cutoffInfo.value)}
									</span>
								</div>
							)}
							{prediction.method && (
								<div className="flex justify-between items-center py-2 border-b">
									<span className="text-sm font-medium">
										Classification Method
									</span>
									<span className="text-sm text-gray-600">
										{prediction.method}
									</span>
								</div>
							)}
							<div className="flex justify-between items-center py-2 border-b">
								<span className="text-sm font-medium">Reference</span>
								{referenceHref ? (
									<a
										href={referenceHref}
										target="_blank"
										rel="noreferrer"
										className="text-sm text-blue-600 hover:text-blue-800 underline"
									>
										{referenceLabel}
									</a>
								) : (
									<span className="text-sm text-blue-600">{referenceLabel}</span>
								)}
							</div>
							{prediction.timestamp && (
								<div className="flex justify-between items-center py-2 border-b">
									<span className="text-sm font-medium">Analysis Date</span>
									<span className="text-sm text-gray-600">
										{new Date(prediction.timestamp).toLocaleDateString()}
									</span>
								</div>
							)}
						</div>
					</CardContent>
				</Card>

				<Card>
					<CardHeader>
						<CardTitle>Contributing Features</CardTitle>
					</CardHeader>
					<CardContent>
						{Array.isArray(features) && features.length > 0 ? (
							<div className="space-y-2">
								{features.map((feature, index) => (
									<div
										key={index}
										className="flex items-center gap-2 p-2 bg-gray-50 rounded"
									>
										<AlertCircle className="h-4 w-4 text-blue-600" />
										<span className="text-sm">{String(feature)}</span>
									</div>
								))}
							</div>
						) : (
							<div className="text-center py-4 text-gray-500">
								<p>No specific contributing features listed</p>
							</div>
						)}
					</CardContent>
				</Card>
			</div>

			{Object.keys(prediction).length > 3 && (
				<Card>
					<CardHeader>
						<CardTitle>Additional Classification Data</CardTitle>
					</CardHeader>
					<CardContent>
						<div className="max-h-64 overflow-y-auto">
							<Table>
								<TableHeader>
									<TableRow>
										<TableHead>Parameter</TableHead>
										<TableHead>Value</TableHead>
									</TableRow>
								</TableHeader>
								<TableBody>
									{Object.entries(prediction)
										.filter(
											([key]) =>
												![
													...COMMON_PREDICTION_FIELDS,
													"confidence",
													"probability",
													"score",
													"features",
													"contributing_factors",
													"contributing_features",
													"important_features",
													"key_features",
													"predictive_features",
													"decision_features",
													"evidence",
													"factors",
													"markers",
													"biomarkers",
													...(cutoffInfo ? [cutoffInfo.field] : []),
													...(sampleId
														? [
																"sample_id",
																"sample",
																"patient_id",
																"patient",
																"id",
																"sample_name",
																"subject_id",
														  ]
														: []),
													...extraExcludedKeys,
												].includes(key)
										)
										.map(([key, value]) => (
											<TableRow key={key}>
												<TableCell className="font-medium capitalize">
													{key.replace(/_/g, " ")}
												</TableCell>
												<TableCell className="font-mono text-sm">
													{typeof value === "object"
														? JSON.stringify(value)
														: String(value)}
												</TableCell>
											</TableRow>
										))}
								</TableBody>
							</Table>
						</div>
					</CardContent>
				</Card>
			)}

			<Alert className="bg-blue-50 border-blue-200">
				<Info className="h-4 w-4 text-blue-600" />
				<AlertDescription className="text-blue-800">
					<strong>Methodology:</strong> {methodologyNote}
				</AlertDescription>
			</Alert>

			<Alert>
				<Info className="h-4 w-4" />
				<AlertDescription>
					<strong>Clinical Note:</strong> {clinicalNote}
				</AlertDescription>
			</Alert>
		</div>
	);
}

export function SubtypePanel({ subtype, sampleName }: SubtypePanelProps) {
	if (!subtype || Object.keys(subtype).length === 0) {
		return (
			<Card>
				<CardHeader>
					<CardTitle>Acute Leukemia Diagnostic</CardTitle>
				</CardHeader>
				<CardContent>
					<Alert>
						<Info className="h-4 w-4" />
						<AlertDescription>
							No subtype prediction data available for this sample.
						</AlertDescription>
					</Alert>
				</CardContent>
			</Card>
		);
	}

	const bridgePrediction = getBridgePrediction(subtype);
	const standardPrediction = getStandardPrediction(subtype, bridgePrediction);

	return (
		<PredictionView
			prediction={standardPrediction}
			sampleName={sampleName}
			title="Predicted AML Subtype"
			emptyMessage="No AML subtype prediction data available for this sample."
			referenceLabel="Severens et al., Leukemia (2024)"
			methodologyNote="AML subtype classification based on Severens et al., Leukemia (2024). This approach uses integrated genomic and transcriptomic analysis for precise AML subtyping."
			clinicalNote="This subtype prediction is generated from genomic and transcriptomic data. Clinical decisions should be made in consultation with hematologists and alongside morphology, cytogenetics, and other clinical information."
			extraExcludedKeys={["bridge", "Bridge", "predictions", "models"]}
		/>
	);
}

export function BridgePredictionPanel({ subtype, sampleName }: SubtypePanelProps) {
	const bridgePrediction = subtype ? getBridgePrediction(subtype) : null;

	return (
		<PredictionView
			prediction={bridgePrediction}
			sampleName={sampleName}
			title="Bridge Acute Leukemia Prediction"
			emptyMessage="No Bridge prediction data found in this HAMLET output."
			referenceLabel="eonurk/Bridge"
			referenceHref="https://github.com/eonurk/Bridge"
			methodologyNote="Bridge-based acute leukemia diagnostic output is displayed when present in the HAMLET expression subtype payload. This tab reads nested Bridge prediction objects (for example keys containing 'bridge') without requiring a fixed schema."
			clinicalNote="Bridge predictions are displayed as decision-support output. Validate against clinical, morphologic, cytogenetic, and molecular findings before clinical interpretation."
		/>
	);
}
