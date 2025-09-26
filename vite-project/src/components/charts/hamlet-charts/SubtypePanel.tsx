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

interface SubtypePanelProps {
	subtype: Record<string, any>;
	sampleName: string;
}

export function SubtypePanel({ subtype, sampleName }: SubtypePanelProps) {
	// Handle different possible formats of subtype data
	if (!subtype || Object.keys(subtype).length === 0) {
		return (
			<Card>
				<CardHeader>
					<CardTitle>AML Subtype Prediction</CardTitle>
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

	const getPrimarySubtype = () => {
		// Check common prediction field names
		const possibleFields = [
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

		for (const field of possibleFields) {
			if (subtype[field] && typeof subtype[field] === "string") {
				return subtype[field] as string;
			}
		}

		// If no direct string field found, look for any string value that might be a subtype
		for (const [key, value] of Object.entries(subtype)) {
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

	const getConfidence = () => {
		return subtype.confidence || subtype.probability || subtype.score;
	};

	const getFeatures = () => {
		// First try the standard field names
		if (subtype.features && Array.isArray(subtype.features)) {
			return subtype.features;
		}
		if (
			subtype.contributing_factors &&
			Array.isArray(subtype.contributing_factors)
		) {
			return subtype.contributing_factors;
		}

		// Look for other possible field names
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
			if (subtype[field] && Array.isArray(subtype[field])) {
				return subtype[field];
			}
		}

		// Look for string fields that might contain feature information
		for (const [key, value] of Object.entries(subtype)) {
			if (
				typeof value === "string" &&
				(key.toLowerCase().includes("feature") ||
					key.toLowerCase().includes("factor") ||
					key.toLowerCase().includes("marker")) &&
				value.length > 0
			) {
				// Try to split on common delimiters
				const features = value
					.split(/[,;|\n]/)
					.map((f) => f.trim())
					.filter((f) => f.length > 0);
				if (features.length > 0) {
					return features;
				}
			}
		}

		return [];
	};

	const getCutoffInfo = () => {
		// Look for cutoff-related fields
		const cutoffFields = [
			"cutoff",
			"pass_cutoff",
			"threshold",
			"decision_threshold",
			"classification_cutoff",
			"prediction_cutoff",
		];

		for (const field of cutoffFields) {
			if (subtype[field] !== undefined) {
				return { field, value: subtype[field] };
			}
		}

		// Look for any field containing "cutoff" or "threshold"
		for (const [key, value] of Object.entries(subtype)) {
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
		// Look for sample ID related fields
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
			if (subtype[field] && typeof subtype[field] === "string") {
				return subtype[field] as string;
			}
		}

		return null;
	};

	const primarySubtype = getPrimarySubtype();
	const confidence = getConfidence();
	const features = getFeatures();
	const cutoffInfo = getCutoffInfo();
	const sampleId = getSampleId();

	// Common AML subtypes and their characteristics
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
		description: "AML subtype classification",
		prognosis: "Unknown",
		color: "bg-gray-100 text-gray-800 border-gray-200",
	};

	return (
		<div className="space-y-6">
			{/* Primary Prediction */}
			<Card className="border-2 border-blue-200">
				<CardHeader>
					<CardTitle className="flex items-center gap-2">
						<CheckCircle className="h-5 w-5 text-blue-600" />
						Predicted AML Subtype
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

						{confidence && (
							<div className="text-center">
								<p className="text-sm text-gray-600 mb-1">
									Prediction Confidence
								</p>
								<div className="inline-flex items-center gap-2">
									<div className="w-32 bg-gray-200 rounded-full h-3">
										<div
											className="bg-blue-600 h-3 rounded-full transition-all duration-300"
											style={{
												width: `${Math.min(
													100,
													(confidence as number) * 100
												)}%`,
											}}
										/>
									</div>
									<span className="text-sm font-medium">
										{typeof confidence === "number"
											? (confidence * 100).toFixed(1)
											: confidence}
										%
									</span>
								</div>
							</div>
						)}
					</div>
				</CardContent>
			</Card>

			{/* Detailed Information */}
			<div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
				{/* Subtype Details */}
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
								<span className="text-sm font-medium">Primary Subtype</span>
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
							{subtype.method && (
								<div className="flex justify-between items-center py-2 border-b">
									<span className="text-sm font-medium">
										Classification Method
									</span>
									<span className="text-sm text-gray-600">
										{subtype.method}
									</span>
								</div>
							)}
							<div className="flex justify-between items-center py-2 border-b">
								<span className="text-sm font-medium">Reference</span>
								<span className="text-sm text-blue-600 hover:text-blue-800 cursor-pointer">
									Severens et al., Leukemia (2024)
								</span>
							</div>
							{subtype.timestamp && (
								<div className="flex justify-between items-center py-2 border-b">
									<span className="text-sm font-medium">Analysis Date</span>
									<span className="text-sm text-gray-600">
										{new Date(subtype.timestamp).toLocaleDateString()}
									</span>
								</div>
							)}
						</div>
					</CardContent>
				</Card>

				{/* Contributing Features */}
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
										<span className="text-sm">{feature}</span>
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

			{/* Additional Subtype Information */}
			{Object.keys(subtype).length > 3 && (
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
									{Object.entries(subtype)
										.filter(
											([key]) =>
												![
													"predicted_subtype",
													"subtype",
													"classification",
													"predicted_class",
													"final_prediction",
													"best_subtype",
													"prediction",
													"predicted_label",
													"class_label",
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
													// Exclude fields we've extracted and displayed above
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

			{/* Methodology Reference */}
			<Alert className="bg-blue-50 border-blue-200">
				<Info className="h-4 w-4 text-blue-600" />
				<AlertDescription className="text-blue-800">
					<strong>Methodology:</strong> AML subtype classification based on
					Severens et al., Leukemia (2024). This approach uses integrated
					genomic and transcriptomic analysis for precise AML subtyping.
				</AlertDescription>
			</Alert>

			{/* Clinical Implications */}
			<Alert>
				<Info className="h-4 w-4" />
				<AlertDescription>
					<strong>Clinical Note:</strong> This subtype prediction is generated
					from genomic and transcriptomic data. Clinical decisions should always
					be made in consultation with hematologists and consider additional
					clinical information, morphology, and cytogenetics.
				</AlertDescription>
			</Alert>
		</div>
	);
}
