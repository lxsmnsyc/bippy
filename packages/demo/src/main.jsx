import Inspector from "bippy/dist/experiments/inspect";
import { StrictMode, useEffect } from "react";
import { createRoot } from "react-dom/client";

function App() {
  useEffect(() => {
    console.log('mounted');
  }, []);
	return <h1>Hello World</h1>;
}

const root = document.getElementById("root");

if (root) {
	createRoot(root).render(
		<StrictMode>
			<Inspector enabled={true} dangerouslyRunInProduction={true} />
			<App />
		</StrictMode>,
	);
}
