# Releasing Marginalia

Releases are built by `.github/workflows/release.yml` when you push a version tag
(`vX.Y.Z`). It builds the macOS universal `.dmg` and the Windows `.msi`/`.exe`,
then publishes a GitHub Release.

- **macOS** — code-signed with a *Developer ID Application* certificate and
  notarized by Apple, so it opens without a Gatekeeper warning. Requires the
  secrets in [macOS signing setup](#macos-signing-setup) below.
- **Windows** — not yet code-signed (SmartScreen warns on first run). Signing is
  pending a [SignPath Foundation](https://signpath.org/) grant; see
  [Windows signing](#windows-signing-pending).

Without the signing secrets the workflow still works — it just produces an
**unsigned** macOS build (exactly as before), so nothing breaks if a secret is
missing or you fork the repo.

---

## Cutting a release

1. Bump the version in **all three** files so they match:
   - `src-tauri/tauri.conf.json` → `"version"`
   - `package.json` → `"version"`
   - `src-tauri/Cargo.toml` → `version` (and run a build so `Cargo.lock` updates)
2. Commit on `main` (via PR).
3. Tag and push:
   ```bash
   git tag v0.2.0
   git push origin v0.2.0
   ```
4. Watch the **Release** workflow in the Actions tab. When it finishes, the
   GitHub Release has the signed macOS `.dmg` and the Windows installers.

> First signed build: after it publishes, download the `.dmg` on a Mac that has
> **never** run Marginalia, and confirm it opens with no "damaged/unidentified
> developer" prompt. Only then update the macOS install note in `README.md`
> (drop the `xattr` workaround).

---

## macOS signing setup

One-time setup. You need an **Apple Developer Program** membership (paid).

### 1. Create a "Developer ID Application" certificate

This is the certificate type for distributing an app **outside** the Mac App
Store. (Not "Apple Development" or "Mac App Distribution".) **No Xcode required** —
Keychain Access (built into macOS) plus the developer website is enough.

**a. Make a certificate request (Keychain Access).**
- Open **Keychain Access** (Applications → Utilities, or Spotlight).
- Menu: **Keychain Access → Certificate Assistant → Request a Certificate From a
  Certificate Authority…**
- **User Email Address:** your Apple ID email. **Common Name:** your name.
  Leave **CA Email Address** blank.
- Choose **Saved to disk** → **Continue**, and save
  `CertificateSigningRequest.certSigningRequest`.
  (This also creates the matching private key in your login keychain — keep it.)

**b. Create the certificate (website).**
- Go to <https://developer.apple.com/account/resources/certificates/list> → **+**.
- Under **Software**, pick **Developer ID Application** → **Continue**.
  (Only the membership's **Account Holder** can create this — for an individual
  enrollment that's you.)
- Upload the `.certSigningRequest` from step a → **Continue** → **Download** the
  `developerID_application.cer`.

**c. Install it.**
- Double-click the downloaded `.cer`. It lands in your **login** keychain and
  pairs with the private key from step a.

> Xcode alternative (if you happen to have it): **Xcode → Settings → Accounts →**
> your team **→ Manage Certificates… → + → Developer ID Application** does all of
> the above in one click. It is not required.

### 2. Export the certificate as a `.p12`

In **Keychain Access**, find **"Developer ID Application: … (TEAMID)"** (expand it
to confirm it has a private key), right-click → **Export…** → save as
`certificate.p12` and set an **export password** (you'll need it below).

### 3. Gather the values

```bash
# base64 of the .p12 (this is the APPLE_CERTIFICATE secret)
base64 -i certificate.p12 | pbcopy

# your exact signing identity string, e.g. "Developer ID Application: Jane Doe (ABCDE12345)"
security find-identity -v -p codesigning
```

- **Team ID** (10 chars): <https://developer.apple.com/account> → **Membership**.
- **App-specific password** (for notarization): <https://appleid.apple.com> →
  **Sign-In and Security → App-Specific Passwords → +**. Copy the generated
  `xxxx-xxxx-xxxx-xxxx` value.

### 4. Add the GitHub repository secrets

**Repo → Settings → Secrets and variables → Actions → New repository secret.**
Add all six:

| Secret | Value |
| --- | --- |
| `APPLE_CERTIFICATE` | base64 of `certificate.p12` (step 3) |
| `APPLE_CERTIFICATE_PASSWORD` | the `.p12` export password (step 2) |
| `APPLE_SIGNING_IDENTITY` | e.g. `Developer ID Application: Jane Doe (ABCDE12345)` |
| `APPLE_ID` | your Apple account email |
| `APPLE_PASSWORD` | the app-specific password (step 3) |
| `APPLE_TEAM_ID` | your 10-character Team ID |

That's it — the next tagged release signs and notarizes the macOS build.

### Alternative: notarize with an App Store Connect API key

Instead of `APPLE_ID` / `APPLE_PASSWORD` / `APPLE_TEAM_ID`, you can notarize with
an API key (not tied to your Apple ID / 2FA). Create a key at
**App Store Connect → Users and Access → Integrations → App Store Connect API**
with the *Developer* role, then provide the key file to the runner and set
`APPLE_API_ISSUER` (issuer UUID), `APPLE_API_KEY` (key ID), and
`APPLE_API_KEY_PATH` (path to the `.p8`) instead of the three `APPLE_*` Apple ID
vars. Keep the certificate secrets the same.

### Troubleshooting

- **"The specified item could not be found in the keychain"** → `APPLE_CERTIFICATE`
  or its password is wrong, or the cert isn't a *Developer ID Application* type.
- **Notarization fails / "invalid"** → check the notarization log; usually a
  hardened-runtime/entitlement issue. Tauri enables the hardened runtime
  automatically when signing.
- **`APPLE_SIGNING_IDENTITY` mismatch** → must match `security find-identity`
  output exactly, including the team id in parentheses.

---

## Windows signing (pending)

Windows installers are currently unsigned; SmartScreen warns on first run. A
[SignPath Foundation](https://signpath.org/) OSS certificate grant has been
requested. Once approved, add the SignPath signing step to `release.yml` and
update this section (and the Windows note in `README.md`).
