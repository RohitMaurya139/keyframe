# Deploying KEYFRAME (free, always-on)

KEYFRAME is **one Express server** that serves the React UI, the API, and the
rendered videos from a single origin, and runs the Chromium + FFmpeg render
queue. So it deploys as **one app on one host** — no separate frontend, no CORS.

> **Why not Vercel/Netlify?** Those are serverless: requests are killed after
> 10–300 s, there's no persistent disk, and you can't run a Chromium render
> farm. A single render takes ~15 min and writes files to disk, so KEYFRAME
> needs a host that *stays running and has a disk*. The free option that fits is
> an **Oracle Cloud "Always Free" Ampere VM** (below). The same steps work on
> any Ubuntu box (a VPS, EC2, etc.).

---

## What you need

- An [Oracle Cloud Free Tier](https://www.oracle.com/cloud/free/) account (card for
  identity verification only — Always Free resources never charge).
- The API keys from `server/.env.example` (OpenRouter, Pixabay, Freesound, …).

---

## 1. Create the VM

Oracle Console → **Compute → Instances → Create instance**:

| Setting | Value |
|---|---|
| Shape | **Ampere (Arm) — `VM.Standard.A1.Flex`** |
| OCPUs / RAM | **4 OCPU / 24 GB** (the full Always-Free allowance) |
| Image | **Ubuntu 22.04** |
| SSH | upload your public key |

> Use the **Ampere ARM** shape, not the AMD "Micro" — Micro has only 1 GB RAM,
> which can't run Chromium. ARM gives you 24 GB free.

SSH in: `ssh ubuntu@<your-vm-public-ip>`

## 2. Open the firewall (Oracle's classic two-layer gotcha)

**a) VCN ingress** — Console → your VM's subnet → **Security List** → add
ingress rules: source `0.0.0.0/0`, TCP ports **80** (and **443** if you add HTTPS).

**b) Instance iptables** — Oracle's Ubuntu image blocks everything but SSH by
default. On the VM:
```bash
sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 80 -j ACCEPT
sudo netfilter-persistent save
```

## 3. Clone + provision

```bash
sudo apt-get update -y && sudo apt-get install -y git
git clone https://github.com/iamshubhamratra/KEYFRAME-.git KEYFRAME
cd KEYFRAME
bash deploy/oracle-setup.sh          # Node 22, FFmpeg, Chromium + libs, fonts, swap
```
Note the **Chromium path** it prints at the end (e.g. `/usr/bin/chromium-browser`).

## 4. Add your secret keys

`.env` is gitignored, so create it on the server:
```bash
cp server/.env.example server/.env
nano server/.env                     # paste your real keys
chmod 600 server/.env
```

## 5. Build (frontend → `server/public/dist`, install server deps)

```bash
bash deploy/build.sh
```

## 6. Run it always-on (systemd)

```bash
sudo cp deploy/keyframe.service /etc/systemd/system/keyframe.service
# If the Chromium path from step 3 is NOT /usr/bin/chromium-browser, edit it:
sudo nano /etc/systemd/system/keyframe.service   # → PUPPETEER_EXECUTABLE_PATH=...
sudo systemctl daemon-reload
sudo systemctl enable --now keyframe
sudo systemctl status keyframe        # should say "active (running)"
```

## 7. Put it on port 80 (nginx)

```bash
sudo apt-get install -y nginx
sudo cp deploy/nginx-keyframe.conf /etc/nginx/sites-available/keyframe
sudo ln -sf /etc/nginx/sites-available/keyframe /etc/nginx/sites-enabled/keyframe
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t && sudo systemctl reload nginx
```

## 8. Verify

```bash
curl -s http://localhost:8080/health           # {"ok":true,...}
```
Then open **`http://<your-vm-public-ip>/`** in a browser → the KEYFRAME UI loads.
Create a short test video end-to-end. Watch it render:
```bash
journalctl -u keyframe -f
```
The **first render downloads Chromium and warms caches**, so it's slower than
later ones. Once an `.mp4` appears in the gallery, you're live. 🎉

---

## Updating after you push new code

```bash
cd ~/KEYFRAME
git pull
bash deploy/build.sh
sudo systemctl restart keyframe
```

## Optional: HTTPS + a domain

Point a domain's A-record at the VM IP, set `server_name` in the nginx config, then:
```bash
sudo apt-get install -y certbot python3-certbot-nginx
sudo certbot --nginx -d your-domain.com
```

---

## Troubleshooting

| Symptom | Fix |
|---|---|
| **Render fails: "No usable sandbox!"** | Ubuntu 22.04 enables unprivileged user namespaces (sandbox works). If you hardened the kernel, either re-enable `kernel.unprivileged_userns_clone=1` or add `--no-sandbox` to the render flags. |
| **Render fails: Chromium not found / won't download (ARM64)** | There's no ARM Chrome-for-Testing build. Confirm `PUPPETEER_EXECUTABLE_PATH` points at the system Chromium from step 3 and `PUPPETEER_SKIP_DOWNLOAD=true` is set (both are in the systemd unit). Test: `chromium-browser --version`. |
| **Out of memory during render** | Lower concurrency: in the unit set `JOB_CONCURRENCY=1` and `RENDER_WORKERS=1`, then `daemon-reload` + restart. The 4 GB swap from setup also helps. |
| **Site unreachable from browser** | Both firewall layers must be open (step 2): VCN Security List **and** instance iptables. |
| **`journalctl` shows config errors on boot** | A required key is missing from `server/.env` — compare against `server/.env.example`. |
