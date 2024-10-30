import "./App.css";
import { Dashboard } from "@/components/pages/Dashboard";
import { Toaster } from "@/components/ui/toaster";
import { useState, useEffect } from "react";
import {
	User as FirebaseUser,
	onAuthStateChanged,
	getAuth,
} from "firebase/auth";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";

import Home from "@/components/pages/Home";
import LoginPage from "@/components/pages/LoginPage";
import "@/firebase";
import About from "@/components/pages/About";
import ContactPage from "@/components/pages/ContactPage";
import Blog from "@/components/pages/Blog";
import Cellama from "@/components/pages/solutions/Cellama";
import UserProfilePage from "@/components/pages/UserProfilePage";
import ResetPassword from "@/components/pages/ResetPassword";

function App() {
	const [user, setUser] = useState<FirebaseUser | null>(null);
	const auth = getAuth();

	useEffect(() => {
		const unsubscribe = onAuthStateChanged(auth, (user) => {
			setUser(user);
		});
		return () => unsubscribe(); // Cleanup on unmount
	}, [auth]);

	return (
		<>
			<Toaster />

			<Router>
				<Routes>
					<Route path="/" element={<Home />} />
					<Route path="/about" element={<About />} />
					<Route path="/blog" element={<Blog />} />
					<Route path="/solutions/cellama" element={<Cellama />} />
					<Route path="/dashboard" element={<Dashboard user={user} />} />
					<Route path="/login" element={<LoginPage user={user} />} />
					<Route path="/profile" element={<UserProfilePage />} />
					<Route path="/contact" element={<ContactPage />} />
					<Route path="/reset-password" element={<ResetPassword />} />
				</Routes>
			</Router>
		</>
	);
}

export default App;
