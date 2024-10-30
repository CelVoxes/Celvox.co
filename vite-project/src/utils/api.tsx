import axios from "axios";

const API_BASE_URL = "http://localhost:5555";

export async function fetchTSNEData() {
	try {
		const response = await axios.get(`${API_BASE_URL}/tsne`);
		return response.data;
	} catch (error) {
		console.error("Error fetching TSNE data:", error);
		throw error;
	}
}

export async function fetchDeconvolutionData() {
	try {
		const response = await axios.get(`${API_BASE_URL}/deconvolution`);
		return response.data;
	} catch (error) {
		console.error("Error fetching deconvolution data:", error);
		throw error;
	}
}

export async function fetchDrugResponseData() {
	const response = await fetch(`${API_BASE_URL}/drug-response`);
	if (!response.ok) {
		throw new Error("Failed to fetch drug response data");
	}
	return response.json();
}

export async function fetchMutationTSNEData() {
	try {
		const response = await axios.get(`${API_BASE_URL}/mutation-tsne`);
		return response.data;
	} catch (error) {
		console.error("Error fetching mutation t-SNE data:", error);
		throw error;
	}
}

export async function uploadSampleData(file: File) {
	// Check if the file is a CSV
	if (!file.name.endsWith(".csv")) {
		throw new Error("Please upload a CSV file");
	}

	const formData = new FormData();
	formData.append("file", file, file.name);

	// Improved logging for FormData
	for (const pair of formData.entries()) {
		console.log(`${pair[0]}:`, pair[1]);
	}

	try {
		const response = await axios.post(
			`${API_BASE_URL}/load-sample-data`,
			formData,
			{
				// Remove manual 'Content-Type' to allow axios to set it correctly
				// headers: {
				//     "Content-Type": "multipart/form-data",
				// },
				onUploadProgress: (progressEvent) => {
					if (progressEvent.total) {
						const percentCompleted = Math.round(
							(progressEvent.loaded * 100) / progressEvent.total
						);
						console.log(`Upload progress: ${percentCompleted}%`);
					}
				},
			}
		);

		if (response.data.error) {
			throw new Error(response.data.error);
		}
		return response.data;
	} catch (error) {
		console.error("Error uploading sample data:", error);
		if (axios.isAxiosError(error)) {
			console.error("Axios error details:", error.response?.data);
			console.error("Axios error status:", error.response?.status);
		}
		throw error;
	}
}

export async function fetchCacheFiles() {
	try {
		const response = await axios.get(`${API_BASE_URL}/cache-files`);
		return response.data;
	} catch (error) {
		console.error("Error fetching cache files:", error);
		throw error;
	}
}

export async function deleteCacheFile(fileName: string) {
	try {
		const response = await axios.delete(`${API_BASE_URL}/delete-cache-file`, {
			data: { fileName },
		});
		console.log("Response from deleteCacheFile:", response.data);
		return response.data;
	} catch (error) {
		console.error("Error deleting cache file:", error);
		throw error;
	}
}

export async function fetchGeneExpressionData(gene: string) {
	const response = await axios.get(`${API_BASE_URL}/gene-expression`, {
		params: { gene },
	});
	return response.data;
}

export async function fetchHarmonizedData() {
	const response = await axios.get(`${API_BASE_URL}/harmonize-data`);
	return response.data;
}

export async function fetchKNNData(k: number) {
	const response = await axios.get(`${API_BASE_URL}/knn`, {
		params: { k },
	});
	return response.data;
}

export async function fetchAIReport(patientInfo: string, model: string) {
	const response = await axios.get(`${API_BASE_URL}/ai-report`, {
		params: { patientInfo, model },
	});
	return response.data;
}

export async function fetchQCMetrics() {
	const response = await axios.get(`${API_BASE_URL}/qc-metrics`);
	return response.data;
}
