# Ledger

Ledger is a browser-based personal finance app that can also be installed as a web app or packaged for Android with Capacitor.

## Run on the web

Serve this folder over HTTPS (or localhost during development) and open it in a supported browser. For example, with Python installed:

```sh
python -m http.server 8000
```

The browser can then offer the install button; the service worker caches the app shell for offline use. Opening `index.html` directly still works, but service workers and install prompts require a secure origin.

When online, refreshing fetches the latest app files. If an already-open tab still shows an older version after an update, close that tab and reopen `http://localhost:8000`.

To open the app from another device on the same Wi-Fi network, run this Windows command instead:

```powershell
python -m http.server 8766 --bind 0.0.0.0 --directory "C:\Money Manager"
```

Find this computer's IPv4 address with `ipconfig`, then open `http://<IPv4-address>:8766` on the other device. Allow Python through Windows Firewall on private networks if prompted.

## Publish on GitHub Pages

The `Deploy GitHub Pages` workflow publishes the web app when changes are pushed to the `main` branch. Create a public GitHub repository, upload the app's web files and `.github/workflows/pages.yml`, and select **Settings > Pages > GitHub Actions** as the deployment source. The workflow publishes only the web app, not the Android project or local build folders.

The repository is public, so its source code can be viewed by anyone. No transaction exports, browser databases, or credentials belong in the repository. Transactions and account details entered in Ledger stay in local browser/app storage and do not sync to GitHub.

## Build for Android

Install Node.js 22 or newer and Android Studio with its Android SDK, then run:

```sh
npm install
npm run android:add
npm run android:open
```

After changing the web app, run `npm run android:sync` to copy the latest web files into the Android project. Build and run the Android app from Android Studio.

## Data and accounts

Transactions, categories, accounts, and preferences are stored locally in the browser or app installation. They do not sync between devices. Login and sign-up are intentionally not included; adding secure accounts and cloud sync requires choosing and configuring a backend.
