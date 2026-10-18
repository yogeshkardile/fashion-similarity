const API_URL = String(window.FASHION_API_URL || "").trim().replace(/\/+$/, "");
const WAKE_MS = 180000, POLL_MS = 4000, PING_MS = 15000, SEARCH_MS = 60000;
const MAX_SIZE = 10 * 1024 * 1024;

const imageInput = document.getElementById("imageInput");
const chooseButton = document.getElementById("chooseButton");
const changeButton = document.getElementById("changeButton");
const removeButton = document.getElementById("removeButton");
const uploadBox = document.getElementById("uploadBox");
const preview = document.getElementById("preview");
const uploadMessage = document.getElementById("uploadMessage");
const previewActions = document.getElementById("previewActions");
const fileName = document.getElementById("fileName");
const searchButton = document.getElementById("searchButton");
const searchLabel = document.getElementById("searchLabel");
const topK = document.getElementById("topK");
const statusEl = document.getElementById("status");
const results = document.getElementById("results");
const resultCount = document.getElementById("resultCount");
const resultsSection = document.getElementById("resultsSection");
const lightbox = document.getElementById("lightbox");
const lbImage = document.getElementById("lbImage");
const lbCaption = document.getElementById("lbCaption");
const backendBar = document.getElementById("backendBar");
const backendText = document.getElementById("backendText");
const wakeButton = document.getElementById("wakeButton");

let selectedFile = null, previewUrl = null, controller = null, items = [], lbIndex = 0;
let backendReady = false, busy = false, waking = false;

function setStatus(text = "", type = "") { statusEl.textContent = text; statusEl.dataset.type = type; }
function resetResults() { results.replaceChildren(); resultCount.textContent = ""; }
function emptyMessage(text) { const p = document.createElement("p"); p.className = "empty-message"; p.textContent = text; results.replaceChildren(p); }
const imageUrl = (item) => `${API_URL}/images/${encodeURIComponent(item.image_id)}`;

chooseButton.addEventListener("click", (e) => { e.stopPropagation(); imageInput.click(); });
changeButton.addEventListener("click", () => imageInput.click());
removeButton.addEventListener("click", clearImage);

uploadBox.addEventListener("click", (e) => { if (!selectedFile && !e.target.closest("button")) imageInput.click(); });
uploadBox.addEventListener("keydown", (e) => { if (!selectedFile && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); imageInput.click(); } });

imageInput.addEventListener("change", () => { const file = imageInput.files[0]; if (file) selectImage(file); imageInput.value = ""; });

["dragenter", "dragover"].forEach((t) => uploadBox.addEventListener(t, (e) => { e.preventDefault(); uploadBox.classList.add("dragover"); }));
["dragleave", "drop"].forEach((t) => uploadBox.addEventListener(t, (e) => { e.preventDefault(); uploadBox.classList.remove("dragover"); }));
uploadBox.addEventListener("drop", (e) => { const file = e.dataTransfer.files[0]; if (file) selectImage(file); });

document.addEventListener("paste", (e) => {
    const file = [...(e.clipboardData?.files || [])].find((f) => f.type.startsWith("image/"));
    if (file) selectImage(file);
});

function selectImage(file) {
    if (!file.type.startsWith("image/")) return setStatus("Please select an image file (JPG, PNG or WEBP).", "error");
    if (file.size > MAX_SIZE) return setStatus("That image is larger than 10 MB. Choose a smaller one.", "error");

    if (previewUrl) URL.revokeObjectURL(previewUrl);
    controller?.abort();
    selectedFile = file;
    previewUrl = URL.createObjectURL(file);

    preview.src = previewUrl;
    preview.hidden = false;
    uploadMessage.hidden = true;
    previewActions.hidden = false;
    fileName.textContent = file.name || "Pasted image";
    uploadBox.classList.add("has-image");
    uploadBox.removeAttribute("role");
    uploadBox.tabIndex = -1;
    updateSearchState();
    setStatus();
    resetResults();
    emptyMessage("Press “Find similar images” to see matches.");
}

function clearImage() {
    controller?.abort();
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    selectedFile = previewUrl = null;
    preview.hidden = true; preview.removeAttribute("src");
    uploadMessage.hidden = false;
    previewActions.hidden = true;
    uploadBox.classList.remove("has-image");
    uploadBox.setAttribute("role", "button");
    uploadBox.tabIndex = 0;
    updateSearchState();
    setStatus();
    resetResults();
    emptyMessage("Your matching images will appear here.");
}

function setLoading(on) {
    busy = on;
    updateSearchState();
    searchButton.classList.toggle("loading", on);
    searchLabel.textContent = on ? "Searching..." : "Find similar images";
}

function showSkeletons(n) {
    results.replaceChildren(...Array.from({ length: Math.min(n, 12) }, () => {
        const card = document.createElement("div");
        card.className = "result-card skeleton";
        card.innerHTML = '<div class="sk-img"></div><div class="sk-line"></div>';
        return card;
    }));
}

searchButton.addEventListener("click", searchImages);

async function searchImages() {
    if (!selectedFile) return;

    controller?.abort();
    controller = new AbortController();
    const { signal } = controller;

    setLoading(true);
    setStatus("Searching for similar images...");
    resultCount.textContent = "";
    showSkeletons(Number(topK.value));
    if (window.innerWidth <= 900) resultsSection.scrollIntoView({ behavior: "smooth", block: "start" });

    const formData = new FormData();
    formData.append("file", selectedFile);
    let timedOut = false;
    const timer = setTimeout(() => { timedOut = true; controller.abort(); }, SEARCH_MS);

    try {
        const response = await fetch(`${API_URL}/search?top_k=${encodeURIComponent(topK.value)}`, { method: "POST", body: formData, signal });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(errorDetail(data.detail) || `Search failed (HTTP ${response.status}). Please try again.`);

        displayResults(data.results || []);
        setStatus(data.results?.length ? "Search complete." : "No similar images found.", data.results?.length ? "success" : "");
    } catch (error) {
        if (error.name === "AbortError" && !timedOut) return;
        console.error("Search error:", error);
        const network = error instanceof TypeError;
        if (network) setBackend("offline", "Lost connection to the backend. Retry to reconnect.");
        emptyMessage("Something went wrong. Check your image and try again.");
        setStatus(timedOut ? "The search took too long. Try again." : network ? "Can't reach the backend. Retry the connection above." : error.message, "error");
    } finally {
        clearTimeout(timer);
        if (controller?.signal === signal) setLoading(false);
    }
}

function displayResults(list) {
    items = list;
    results.replaceChildren();
    resultCount.textContent = `${list.length} ${list.length === 1 ? "result" : "results"}`;

    if (!list.length) return emptyMessage("Try a different image, ideally a clear photo of a single item.");

    list.forEach((item, i) => {
        const card = document.createElement("button");
        card.type = "button";
        card.className = "result-card";
        card.setAttribute("aria-label", `Open image ${item.image_id ?? "unknown"}`);

        const image = document.createElement("img");
        image.alt = `Fashion item ${item.image_id}`;
        image.loading = "lazy";
        if (item.image_id !== undefined && item.image_id !== null) {
            image.src = imageUrl(item);
            image.onerror = () => { image.onerror = null; image.alt = "Image unavailable"; image.src = "data:image/svg+xml," + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="300" height="400"><rect width="100%" height="100%" fill="#f1efed"/><text x="50%" y="50%" fill="#928c96" font-family="Arial" font-size="14" text-anchor="middle">Image unavailable</text></svg>'); };
        } else image.alt = "Image ID missing from search result";

        const rank = document.createElement("span");
        rank.className = "rank";
        rank.textContent = `#${i + 1}`;

        const similarity = Number(item.similarity);
        const valid = Number.isFinite(similarity);
        const pct = valid ? Math.max(0, Math.min(100, similarity * 100)) : 0;

        const info = document.createElement("span");
        info.className = "result-info";
        info.innerHTML = '<b></b><span></span><div class="bar"><i></i></div>';
        info.querySelector("b").textContent = `Image #${item.image_id ?? "Unknown"}`;
        info.querySelector("span").textContent = valid ? `${pct.toFixed(1)}% match` : "Match unavailable";
        info.querySelector("i").style.setProperty("--s", `${pct}%`);

        card.append(image, rank, info);
        card.addEventListener("click", () => openLightbox(i));
        results.appendChild(card);
    });
}

function openLightbox(i) {
    lbIndex = (i + items.length) % items.length;
    const item = items[lbIndex], s = Number(item.similarity);
    lbImage.src = imageUrl(item);
    lbImage.alt = `Fashion item ${item.image_id}`;
    lbCaption.textContent = `Image #${item.image_id} · ${Number.isFinite(s) ? (s * 100).toFixed(1) + "% match" : "match unavailable"} · ${lbIndex + 1} of ${items.length}`;
    if (!lightbox.open) lightbox.showModal();
}

document.getElementById("lbClose").addEventListener("click", () => lightbox.close());
document.getElementById("lbPrev").addEventListener("click", () => openLightbox(lbIndex - 1));
document.getElementById("lbNext").addEventListener("click", () => openLightbox(lbIndex + 1));
lightbox.addEventListener("click", (e) => { if (e.target === lightbox) lightbox.close(); });
lightbox.addEventListener("keydown", (e) => { if (e.key === "ArrowLeft") openLightbox(lbIndex - 1); if (e.key === "ArrowRight") openLightbox(lbIndex + 1); });

function errorDetail(d) { return Array.isArray(d) ? d.map((x) => x.msg).filter(Boolean).join("; ") : typeof d === "string" ? d : ""; }

function updateSearchState() { searchButton.disabled = busy || !selectedFile || !backendReady; }

function setBackend(state, text) {
    backendBar.dataset.state = state;
    backendText.textContent = text;
    backendReady = state === "online";
    wakeButton.hidden = state === "online" || state === "checking" || state === "misconfigured";
    wakeButton.disabled = state === "waking";
    wakeButton.textContent = state === "waking" ? "Connecting..." : "Retry connection";
    updateSearchState();
}

async function checkHealth(timeout = PING_MS) {
    const c = new AbortController(), t = setTimeout(() => c.abort(), timeout);
    try {
        const res = await fetch(`${API_URL}/health`, { signal: c.signal, cache: "no-store" });
        if (!res.ok) return { ok: false, reason: `The backend returned HTTP ${res.status}.` };
        let data;
        try { data = await res.json(); } catch { return { ok: false, reason: "The backend sent an invalid response." }; }
        if (!data || data.status !== "ok") return { ok: false, reason: "The backend is starting but not ready yet." };
        if (!Number.isInteger(data.indexed_images) || data.indexed_images <= 0) return { ok: false, reason: "The backend is running but its image index isn't loaded." };
        return { ok: true, count: data.indexed_images };
    } catch (error) {
        return { ok: false, reason: error.name === "AbortError" ? "The backend didn't answer in time." : "Can't reach the backend." };
    } finally { clearTimeout(t); }
}

async function connectBackend() {
    if (waking) return;
    waking = true;
    const start = Date.now();
    let last = { ok: false, reason: "" };
    try {
        while (true) {
            const elapsed = Date.now() - start;
            setBackend("waking", elapsed < 6000 ? "Connecting to the backend..." : `Waiting for the backend to start... ${Math.round(elapsed / 1000)}s (can take up to 3 minutes)`);
            last = await checkHealth(Math.min(PING_MS, Math.max(1000, WAKE_MS - elapsed)));
            if (last.ok) return setBackend("online", `Backend is ready (${last.count.toLocaleString()} images indexed).`);
            if (Date.now() - start >= WAKE_MS) break;
            await new Promise((r) => setTimeout(r, Math.min(POLL_MS, Math.max(0, WAKE_MS - (Date.now() - start)))));
        }
        setBackend("offline", `${last.reason} Gave up after 3 minutes. If the service is stopped or has crashed, start or redeploy it from your hosting dashboard, then retry.`);
    } finally { waking = false; }
}

wakeButton.addEventListener("click", connectBackend);

if (!API_URL) setBackend("misconfigured", "API URL is not configured. Set window.FASHION_API_URL in config.js.");
else if (location.protocol === "https:" && API_URL.startsWith("http:") && !/^http:\/\/(localhost|127\.0\.0\.1)(:|\/|$)/.test(API_URL)) setBackend("misconfigured", "The page uses HTTPS but the API URL uses HTTP. Use an HTTPS API URL in config.js.");
else connectBackend();

let misses = 0;
setInterval(async () => {
    if (!backendReady || busy || waking) return;
    const r = await checkHealth(8000);
    misses = r.ok ? 0 : misses + 1;
    if (misses >= 2) { misses = 0; setBackend("offline", `${r.reason} Retry to reconnect.`); }
}, 30000);
