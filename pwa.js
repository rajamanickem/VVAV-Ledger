const installButton = document.querySelector("#install-app");
let installPrompt;

window.addEventListener("beforeinstallprompt", (event) => {
  event.preventDefault();
  installPrompt = event;
  installButton.classList.remove("hidden");
});

installButton.addEventListener("click", async () => {
  if (!installPrompt) return;
  installButton.disabled = true;
  try {
    await installPrompt.prompt();
    await installPrompt.userChoice;
  } catch (error) {
    console.error("Could not open the app install prompt.", error);
  } finally {
    installPrompt = null;
    installButton.disabled = false;
    installButton.classList.add("hidden");
  }
});

window.addEventListener("appinstalled", () => {
  installPrompt = null;
  installButton.classList.add("hidden");
});

if ("serviceWorker" in navigator && ["https:", "http:"].includes(window.location.protocol)) {
  navigator.serviceWorker.register(new URL("service-worker.js", document.baseURI))
    .catch((error) => console.error("Could not register the offline app worker.", error));
}
