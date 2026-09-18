const fileInput = document.getElementById("file-input");
const dropzone = document.getElementById("dropzone");
const dropzoneHint = document.getElementById("dropzone-hint");
const previewImg = document.getElementById("preview-img");
const extractBtn = document.getElementById("extract-btn");
const uploadError = document.getElementById("upload-error");

const reviewPanel = document.getElementById("review-panel");
const reviewForm = document.getElementById("review-form");
const categorySelect = document.getElementById("f-category");
const discardBtn = document.getElementById("discard-btn");
const saveBtn = document.getElementById("save-btn");
const saveError = document.getElementById("save-error");

const toast = document.getElementById("toast");

let selectedFile = null;

function showToast(message, isError = false) {
  toast.textContent = message;
  toast.classList.toggle("toast-error", isError);
  toast.classList.remove("hidden");
  setTimeout(() => toast.classList.add("hidden"), 3200);
}

function setError(el, message) {
  if (!message) {
    el.classList.add("hidden");
    el.textContent = "";
    return;
  }
  el.textContent = message;
  el.classList.remove("hidden");
}

async function loadCategories() {
  try {
    const res = await fetch("/api/categories");
    const data = await res.json();
    categorySelect.innerHTML = "";
    for (const cat of data.categories) {
      const opt = document.createElement("option");
      opt.value = cat;
      opt.textContent = cat;
      categorySelect.appendChild(opt);
    }
  } catch (err) {
    // Fine to fail silently here — the select will just stay empty until extract fills it in.
  }
}

function handleFile(file) {
  if (!file) return;
  selectedFile = file;
  setError(uploadError, "");

  const reader = new FileReader();
  reader.onload = () => {
    previewImg.src = reader.result;
    previewImg.classList.remove("hidden");
    dropzoneHint.classList.add("hidden");
  };
  reader.readAsDataURL(file);

  extractBtn.disabled = false;
}

fileInput.addEventListener("change", (e) => handleFile(e.target.files[0]));

["dragover", "dragenter"].forEach((evt) =>
  dropzone.addEventListener(evt, (e) => {
    e.preventDefault();
    dropzone.classList.add("drag-over");
  })
);

["dragleave", "dragend"].forEach((evt) =>
  dropzone.addEventListener(evt, () => dropzone.classList.remove("drag-over"))
);

dropzone.addEventListener("drop", (e) => {
  e.preventDefault();
  dropzone.classList.remove("drag-over");
  const file = e.dataTransfer.files[0];
  if (file) {
    fileInput.files = e.dataTransfer.files;
    handleFile(file);
  }
});

function fillForm(fields) {
  for (const [key, value] of Object.entries(fields)) {
    const input = reviewForm.elements.namedItem(key);
    if (input && value !== undefined && value !== null) {
      input.value = value;
    }
  }
}

extractBtn.addEventListener("click", async () => {
  if (!selectedFile) return;
  setError(uploadError, "");
  extractBtn.disabled = true;
  extractBtn.textContent = "Reading slip…";

  try {
    const formData = new FormData();
    formData.append("file", selectedFile);

    const res = await fetch("/api/extract", { method: "POST", body: formData });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || "Couldn't extract details from that image.");
    }

    const fields = await res.json();
    fillForm(fields);
    reviewPanel.classList.remove("hidden");
    reviewPanel.scrollIntoView({ behavior: "smooth", block: "start" });
  } catch (err) {
    setError(uploadError, err.message);
  } finally {
    extractBtn.disabled = false;
    extractBtn.textContent = "Extract details";
  }
});

discardBtn.addEventListener("click", () => {
  reviewPanel.classList.add("hidden");
  selectedFile = null;
  fileInput.value = "";
  previewImg.classList.add("hidden");
  dropzoneHint.classList.remove("hidden");
  extractBtn.disabled = true;
  reviewForm.reset();
  setError(saveError, "");
});

saveBtn.addEventListener("click", async () => {
  setError(saveError, "");

  const formData = new FormData(reviewForm);
  const payload = Object.fromEntries(formData.entries());
  payload.amount = parseFloat(payload.amount);

  if (!reviewForm.reportValidity()) return;
  if (Number.isNaN(payload.amount)) {
    setError(saveError, "Amount must be a number.");
    return;
  }

  saveBtn.disabled = true;
  saveBtn.textContent = "Saving…";

  try {
    const res = await fetch("/api/save", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || "Couldn't save to Google Sheets.");
    }

    showToast("Saved to Google Sheets ✓");
    discardBtn.click();
  } catch (err) {
    setError(saveError, err.message);
  } finally {
    saveBtn.disabled = false;
    saveBtn.textContent = "Save to Google Sheets";
  }
});

loadCategories();
