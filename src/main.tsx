import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import ScenarioCouncil from "./ScenarioCouncil";
import "./styles.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    {new URLSearchParams(window.location.search).get("council") === "1" ? <ScenarioCouncil /> : <><App /><a className="sc-demo-link" href="?council=1">Try the scenario council ↗</a></>}
  </React.StrictMode>,
);
