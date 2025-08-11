import React, { useState } from "react";

// Loop Diuretic Converter React Component

export default function LoopConverterApp() {
  const [inputDrug, setInputDrug] = useState("furosemide");
  const [inputRoute, setInputRoute] = useState("po");
  const [dose, setDose] = useState(40);
  const [results, setResults] = useState(null);

  // Conversion units based on furosemide PO equivalence
  const drugs = {
    furosemide: {
      label: "Furosemide",
      routes: {
        po: { label: "PO", unitsPerMg: 1 },
        iv: { label: "IV", unitsPerMg: 2 },
      },
    },
    bumetanide: {
      label: "Bumetanide",
      routes: {
        po: { label: "PO", unitsPerMg: 40 },
        iv: { label: "IV", unitsPerMg: 40 },
      },
    },
    torsemide: {
      label: "Torsemide",
      routes: {
        po: { label: "PO", unitsPerMg: 2 },
        iv: { label: "IV", unitsPerMg: 2 },
      },
    },
    ethacrynic: {
      label: "Ethacrynic acid",
      routes: {
        po: { label: "PO", unitsPerMg: 0.8 },
        iv: { label: "IV", unitsPerMg: 0.8 },
      },
    },
  };

  function round(n) {
    if (!isFinite(n)) return "—";
    if (Math.abs(n) < 0.1) return Number(n).toFixed(3);
    return Number(n).toFixed(2);
  }

  function convert() {
    const drugDef = drugs[inputDrug];
    if (!drugDef) return;
    const routeDef = drugDef.routes[inputRoute];
    if (!routeDef) return;

    const numericDose = Number(dose);
    if (isNaN(numericDose) || numericDose <= 0) {
      setResults({ error: "Enter a valid positive dose (mg)" });
      return;
    }

    const furoUnits = numericDose * routeDef.unitsPerMg;
    const out = [];

    for (const [key, val] of Object.entries(drugs)) {
      for (const [rkey, rdef] of Object.entries(val.routes)) {
        const targetDose = furoUnits / rdef.unitsPerMg;
        out.push({
          drugKey: key,
          drugLabel: val.label,
          routeKey: rkey,
          routeLabel: rdef.label,
          dose: targetDose,
        });
      }
    }

    const order = [
      "furosemide|po",
      "furosemide|iv",
      "bumetanide|po",
      "bumetanide|iv",
      "torsemide|po",
      "torsemide|iv",
      "ethacrynic|po",
      "ethacrynic|iv",
    ];

    out.sort(
      (a, b) => order.indexOf(`${a.drugKey}|${a.routeKey}`) - order.indexOf(`${b.drugKey}|${b.routeKey}`)
    );

    setResults({ furoUnits, rows: out });
  }

  // Run conversion when component mounts
  React.useEffect(() => {
    convert();
  }, []);

  // Quick test cases
  const tests = [
    { label: "40 mg furosemide PO", drug: "furosemide", route: "po", dose: 40 },
    { label: "20 mg furosemide IV", drug: "furosemide", route: "iv", dose: 20 },
    { label: "1 mg bumetanide IV", drug: "bumetanide", route: "iv", dose: 1 },
    { label: "20 mg torsemide PO", drug: "torsemide", route: "po", dose: 20 },
    { label: "50 mg ethacrynic PO", drug: "ethacrynic", route: "po", dose: 50 },
  ];

  function runTest(t) {
    setInputDrug(t.drug);
    setInputRoute(t.route);
    setDose(t.dose);
    setTimeout(convert, 0);
  }

  return (
    <div style={{ maxWidth: 600, margin: "auto", fontFamily: "Arial, sans-serif", padding: 20 }}>
      <h1 style={{ fontSize: 24, fontWeight: "bold", marginBottom: 10 }}>Loop Diuretic Converter</h1>
      <p>Choose drug, route, enter dose (mg), and click Convert.</p>

      <div style={{ display: "flex", gap: 10, marginTop: 20, marginBottom: 20 }}>
        <div style={{ flex: 1 }}>
          <label>Drug:</label>
          <select
            style={{ width: "100%", padding: 8 }}
            value={inputDrug}
            onChange={(e) => setInputDrug(e.target.value)}
          >
            {Object.entries(drugs).map(([k, v]) => (
              <option key={k} value={k}>
                {v.label}
              </option>
            ))}
          </select>
        </div>

        <div style={{ flex: 1 }}>
          <label>Route:</label>
          <select
            style={{ width: "100%", padding: 8 }}
            value={inputRoute}
            onChange={(e) => setInputRoute(e.target.value)}
          >
            {Object.entries(drugs[inputDrug].routes).map(([rk, rv]) => (
              <option key={rk} value={rk}>
                {rv.label}
              </option>
            ))}
          </select>
        </div>

        <div style={{ flex: 1 }}>
          <label>Dose (mg):</label>
          <input
            type="number"
            style={{ width: "100%", padding: 8 }}
            value={dose}
            onChange={(e) => setDose(e.target.value)}
          />
        </div>
      </div>

      <button
        onClick={convert}
        style={{
          backgroundColor: "#2563eb",
          color: "white",
          padding: "10px 20px",
          border: "none",
          borderRadius: 6,
          cursor: "pointer",
        }}
      >
        Convert
      </button>

      <div style={{ marginTop: 30 }}>
        {results && results.error && <p style={{ color: "red" }}>{results.error}</p>}

        {results && !results.error && (
          <div>
            <p>
              Furosemide PO-equivalent units: <strong>{round(results.furoUnits)}</strong>
            </p>

            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ borderBottom: "1px solid #ddd" }}>
                  <th style={{ textAlign: "left", padding: 8 }}>Drug</th>
                  <th style={{ textAlign: "left", padding: 8 }}>Route</th>
                  <th style={{ textAlign: "right", padding: 8 }}>Dose (mg)</th>
                </tr>
              </thead>
              <tbody>
                {results.rows.map((r, i) => (
                  <tr
                    key={i}
                    style={{
                      backgroundColor:
                        r.drugKey === inputDrug && r.routeKey === inputRoute ? "#def" : "transparent",
                    }}
                  >
                    <td style={{ padding: 8 }}>{r.drugLabel}</td>
                    <td style={{ padding: 8 }}>{r.routeLabel}</td>
                    <td style={{ padding: 8, textAlign: "right" }}>{round(r.dose)}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div style={{ marginTop: 20, fontSize: 12, color: "#666" }}>
              <p>
                <strong>Note:</strong> Clinical equivalences used: 40 mg furosemide PO = 1 mg bumetanide = 20 mg
                torsemide = 50 mg ethacrynic acid. Furosemide IV is about twice as potent as PO.
              </p>
            </div>
          </div>
        )}
      </div>

      <div style={{ marginTop: 30 }}>
        <p>Quick tests:</p>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {tests.map((t) => (
            <button
              key={t.label}
              onClick={() => runTest(t)}
              style={{
                padding: "6px 10px",
                borderRadius: 6,
                border: "1px solid #ccc",
                backgroundColor: "#f9f9f9",
                cursor: "pointer",
              }}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
