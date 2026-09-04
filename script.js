(function () {
  const dropZone = document.getElementById("dropZone");
  const fileInput = document.getElementById("fileInput");
  const preview = document.getElementById("preview");
  const uploadHint = document.getElementById("uploadHint");
  const solveBtn = document.getElementById("solveBtn");
  const statusEl = document.getElementById("status");
  const resultSection = document.getElementById("resultSection");
  const answerBox = document.getElementById("answerBox");
  const questionsBox = document.getElementById("questionsBox");
  const copyBtn = document.getElementById("copyBtn");

  let selectedFile = null;

  function showStatus(message, isError) {
    statusEl.hidden = false;
    statusEl.textContent = message;
    statusEl.classList.toggle("error", Boolean(isError));
  }

  function hideStatus() {
    statusEl.hidden = true;
  }

  function setFile(file) {
    if (!file || !file.type.startsWith("image/")) {
      showStatus("Please choose a valid image file.", true);
      return;
    }
    selectedFile = file;
    solveBtn.disabled = false;
    hideStatus();

    const reader = new FileReader();
    reader.onload = (e) => {
      preview.src = e.target.result;
      preview.hidden = false;
      uploadHint.hidden = true;
    };
    reader.readAsDataURL(file);
  }

  dropZone.addEventListener("click", () => fileInput.click());

  fileInput.addEventListener("change", (e) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  });

  ["dragenter", "dragover"].forEach((evt) => {
    dropZone.addEventListener(evt, (e) => {
      e.preventDefault();
      dropZone.classList.add("dragover");
    });
  });

  ["dragleave", "drop"].forEach((evt) => {
    dropZone.addEventListener(evt, (e) => {
      e.preventDefault();
      dropZone.classList.remove("dragover");
    });
  });

  dropZone.addEventListener("drop", (e) => {
    const file = e.dataTransfer.files && e.dataTransfer.files[0];
    if (file) setFile(file);
  });

  solveBtn.addEventListener("click", async () => {
    if (!selectedFile) return;

    const apiBase = window.API_BASE_URL;
    if (!apiBase || apiBase.includes("YOUR-BACKEND")) {
      showStatus("Set window.API_BASE_URL in config.js to your Render backend URL first.", true);
      return;
    }

    solveBtn.disabled = true;
    resultSection.hidden = true;
    showStatus("Reading the image and solving… this can take a few seconds.");

    const formData = new FormData();
    formData.append("image", selectedFile);

    try {
      const startedAt = performance.now();
      const response = await fetch(`${apiBase}/api/solve`, {
        method: "POST",
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || `Request failed with status ${response.status}`);
      }

      const elapsedSec = ((performance.now() - startedAt) / 1000).toFixed(1);

      answerBox.value = data.answer || "";
      questionsBox.value = data.questions || "";
      resultSection.hidden = false;
      showStatus(`Done in ${elapsedSec}s.`);
    } catch (err) {
      showStatus(err.message || "Something went wrong. Please try again.", true);
    } finally {
      solveBtn.disabled = false;
    }
  });

  copyBtn.addEventListener("click", async () => {
    if (!answerBox.value) return;
    try {
      await navigator.clipboard.writeText(answerBox.value);
      const original = copyBtn.textContent;
      copyBtn.textContent = "Copied!";
      setTimeout(() => (copyBtn.textContent = original), 1500);
    } catch {
      answerBox.select();
      document.execCommand("copy");
    }
  });
})();
