
const isLocal =
    window.location.hostname === "localhost" ||
    window.location.hostname === "127.0.0.1";

window.FASHION_API_URL = isLocal
    ? "http://127.0.0.1:8000"
    : "https://fashion-similarity.onrender.com";
