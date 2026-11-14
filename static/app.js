const form = document.querySelector("#churn-form");
const fields = document.querySelector("#fields");
const button = form.querySelector("button");
const result = document.querySelector("#result");

const labels = {
  tenure: "Lama berlangganan (bulan)",
  PhoneService: "Layanan telepon",
  MultipleLines: "Multi-jalur telepon",
  InternetService: "Layanan internet",
  OnlineSecurity: "Keamanan online",
  OnlineBackup: "Backup online",
  DeviceProtection: "Proteksi perangkat",
  TechSupport: "Dukungan teknis",
  StreamingTV: "Streaming TV",
  StreamingMovies: "Streaming film",
  Contract: "Jenis kontrak",
  PaperlessBilling: "Tagihan tanpa kertas",
  PaymentMethod: "Metode pembayaran",
  MonthlyCharges: "Tagihan bulanan ($)",
  TotalCharges: "Total tagihan ($)"
};

// Tentukan warna hasil berdasarkan probabilitas churn
function riskClass(data) {
  const entries = Object.entries(data.probabilities || {});
  const churn = entries.find(([name]) => /^(yes|churn|ya|1|true)$/i.test(name.trim()));
  if (!churn) {
    return /yes|churn|ya/i.test(data.prediction) ? "risk-high" : "risk-low";
  }
  const p = churn[1];
  return p >= 0.7 ? "risk-high" : p >= 0.4 ? "risk-mid" : "risk-low";
}

function clearRisk() {
  result.classList.remove("risk-high", "risk-mid", "risk-low");
}

async function loadForm() {
  try {
    const response = await fetch("/features");
    if (!response.ok) throw new Error("Formulir gagal dimuat.");
    const schema = await response.json();

    for (const [group, columns] of Object.entries(schema.groups)) {
      const section = document.createElement("fieldset");
      const legend = document.createElement("legend");
      legend.textContent = group;
      section.append(legend);

      for (const col of columns) {
        const label = document.createElement("label");
        const bounds = schema.numeric[col];
        const input = document.createElement(bounds ? "input" : "select");
        label.textContent = labels[col] || col;
        input.name = col;
        input.required = true;

        if (bounds) {
          input.type = "number";
          input.min = bounds.min;
          input.max = bounds.max;
          input.step = "any";
          input.placeholder = `${bounds.min}–${bounds.max}`;
        } else {
          const placeholder = new Option("Pilih", "", true, true);
          placeholder.disabled = true;
          input.append(placeholder);
          for (const option of schema.categorical[col]) {
            input.append(new Option(option, option));
          }
        }

        label.append(input);
        section.append(label);
      }
      fields.append(section);
    }
    button.disabled = false;
  } catch (error) {
    result.textContent = error.message;
  }
}

form.addEventListener("submit", async event => {
  event.preventDefault();
  button.disabled = true;
  clearRisk();
  result.textContent = "Memproses prediksi…";

  const payload = Object.fromEntries(
    Array.from(fields.querySelectorAll("input, select"), input => [
      input.name, input.type === "number" ? input.valueAsNumber : input.value
    ])
  );

  try {
    const response = await fetch("/predict", {
      method: "POST",
      headers: {"Content-Type": "application/json"},
      body: JSON.stringify(payload)
    });

    if (!response.ok) throw new Error("Periksa kembali isian dan rentang angka.");
    const data = await response.json();
    const scores = Object.entries(data.probabilities).map(
      ([label, value]) => `${label}: ${(value * 100).toFixed(1)}%`
    );

    result.textContent = [
      data.prediction + (data.simulation ? " (Simulasi)" : ""),
      "",
      "Estimasi probabilitas model",
      ...scores
    ].join("\n");
    result.classList.add(riskClass(data));
  } catch (error) {
    clearRisk();
    result.textContent = error.message;
  } finally {
    button.disabled = false;
  }
});

loadForm();