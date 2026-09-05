(function () {
  const dropZone = document.getElementById("dropZone");
  const fileInput = document.getElementById("fileInput");
  const preview = document.getElementById("preview");
  const uploadHint = document.getElementById("uploadHint");
  const textInputZone = document.getElementById("textInputZone");
  const textQuestionInput = document.getElementById("textQuestionInput");
  
  const tabImageBtn = document.getElementById("tabImageBtn");
  const tabTextBtn = document.getElementById("tabTextBtn");
  
  const solveBtn = document.getElementById("solveBtn");
  const statusEl = document.getElementById("status");
  const resultSection = document.getElementById("resultSection");
  const answerBox = document.getElementById("answerBox");
  const questionsBox = document.getElementById("questionsBox");
  const copyBtn = document.getElementById("copyBtn");

  // Modal elements
  const workspaceModal = document.getElementById("workspaceModal");
  const closeModalBtn = document.getElementById("closeModalBtn");
  const formattedQuestionDisplay = document.getElementById("formattedQuestionDisplay");
  const userAnswerInput = document.getElementById("userAnswerInput");
  const llmAnswerBanner = document.getElementById("llmAnswerBanner");
  const bannerStatusText = document.getElementById("bannerStatusText");
  const modalCopyLlmBtn = document.getElementById("modalCopyLlmBtn");
  const copyUserAnswerBtn = document.getElementById("copyUserAnswerBtn");

  let selectedFile = null;
  let activeMode = "image"; // "image" | "text"
  let currentLlmAnswer = "";

  // Mode Switchers
  tabImageBtn.addEventListener("click", () => switchMode("image"));
  tabTextBtn.addEventListener("click", () => switchMode("text"));

  function switchMode(mode) {
    activeMode = mode;
    if (mode === "image") {
      tabImageBtn.classList.add("active");
      tabTextBtn.classList.remove("active");
      dropZone.hidden = false;
      textInputZone.hidden = true;
      solveBtn.disabled = !selectedFile;
    } else {
      tabTextBtn.classList.add("active");
      tabImageBtn.classList.remove("active");
      dropZone.hidden = true;
      textInputZone.hidden = false;
      solveBtn.disabled = !textQuestionInput.value.trim();
    }
  }

  textQuestionInput.addEventListener("input", () => {
    if (activeMode === "text") {
      solveBtn.disabled = !textQuestionInput.value.trim();
    }
  });

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
    if (activeMode === "image") solveBtn.disabled = false;
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

  // Safe HTML Escaper and Formatter for Modal View
  function formatQuestionText(text) {
    const esc = text
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
      
    // Format double newlines into paragraphs, single newlines into linebreaks
    return esc
      .split(/\n\n+/)
      .map(p => `<p>${p.replace(/\n/g, "<br/>")}</p>`)
      .join("");
  }

  function openWorkspaceModal(initialQuestion) {
    formattedQuestionDisplay.innerHTML = formatQuestionText(initialQuestion);
    userAnswerInput.value = "";
    currentLlmAnswer = "";
    
    // Reset Banner State
    llmAnswerBanner.className = "llm-banner pending";
    bannerStatusText.textContent = "⏳ LLM is solving... write your answer below in the meantime!";
    modalCopyLlmBtn.hidden = true;
    modalCopyLlmBtn.textContent = "📋 Copy LLM Answer";

    workspaceModal.hidden = false;
  }

  closeModalBtn.addEventListener("click", () => {
    workspaceModal.hidden = true;
  });

  solveBtn.addEventListener("click", async () => {
    const apiBase = window.API_BASE_URL;
    if (!apiBase || apiBase.includes("YOUR-BACKEND")) {
      showStatus("Set window.API_BASE_URL in config.js to your Render backend URL first.", true);
      return;
    }

    solveBtn.disabled = true;
    resultSection.hidden = true;
    showStatus("Processing request...");

    let endpoint = `${apiBase}/api/solve`;
    let reqOptions = {};

    if (activeMode === "text") {
      const qText = textQuestionInput.value.trim();
      if (!qText) return;
      openWorkspaceModal(qText);

      endpoint = `${apiBase}/api/solve-text`;
      reqOptions = {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ questionsText: qText }),
      };
    } else {
      if (!selectedFile) return;
      openWorkspaceModal("Extracting verbatim text from your image...");

      const formData = new FormData();
      formData.append("image", selectedFile);
      reqOptions = { method: "POST", body: formData };
    }

    try {
      const startedAt = performance.now();
      const response = await fetch(endpoint, reqOptions);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || `Request failed with status ${response.status}`);
      }

      const elapsedSec = ((performance.now() - startedAt) / 1000).toFixed(1);

      // Populate Extracted/Formatted Question if it came from Gemini Vision
      if (data.questions) {
        formattedQuestionDisplay.innerHTML = formatQuestionText(data.questions);
        questionsBox.value = data.questions;
      }

      // Populate Answer
      currentLlmAnswer = data.answer || "";
      answerBox.value = currentLlmAnswer;
      resultSection.hidden = false;

      // Update Modal Banner to Success State
      llmAnswerBanner.className = "llm-banner success";
      bannerStatusText.textContent = `✅ Answer ready (${elapsedSec}s)!`;
      modalCopyLlmBtn.hidden = false;

      showStatus(`Done in ${elapsedSec}s.`);
    } catch (err) {
      showStatus(err.message || "Something went wrong. Please try again.", true);
      llmAnswerBanner.className = "llm-banner error";
      bannerStatusText.textContent = `❌ ${err.message || "Failed to generate answer."}`;
    } finally {
      solveBtn.disabled = false;
    }
  });

  // Fast Copy Actions
  async function copyTextToClipboard(text, btnElement, successLabel) {
    if (!text) return;
    const originalText = btnElement.textContent;
    try {
      await navigator.clipboard.writeText(text);
      btnElement.textContent = successLabel;
    } catch (_err) {
      btnElement.textContent = "Copied!";
    }
    setTimeout(() => {
      btnElement.textContent = originalText;
    }, 1800);
  }

  modalCopyLlmBtn.addEventListener("click", () => {
    copyTextToClipboard(currentLlmAnswer, modalCopyLlmBtn, "Copied LLM Answer!");
  });

  copyUserAnswerBtn.addEventListener("click", () => {
    copyTextToClipboard(userAnswerInput.value, copyUserAnswerBtn, "Copied My Answer!");
  });

  copyBtn.addEventListener("click", () => {
    copyTextToClipboard(answerBox.value, copyBtn, "Copied!");
  });
})();
