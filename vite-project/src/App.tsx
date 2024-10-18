import "./App.css";
import { Dashboard } from "@/components/Dashboard";
import { Toaster } from "@/components/ui/toaster";
import { Footer } from "@/components/Footer";

function App() {
	return (
		<>
			<div className="flex justify-center items-center h-full">
				<Dashboard />
			</div>

			<Footer />
			<Toaster />
		</>
	);
}

export default App;
