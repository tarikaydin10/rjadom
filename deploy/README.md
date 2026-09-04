# Deployment auf einen Hetzner-VPS

Einmalige Einrichtung, danach deployt jeder Push auf `main` automatisch.

Das Ziel der Aufstellung: **ein Hostname**. App und API liegen hinter derselben
Adresse, es gibt kein CDN, keinen Font-Host, keinen Auth-Anbieter. Genau eine
Sache muss aus Russland erreichbar sein.

---

## 1 · Server vorbereiten

Auf dem VPS, als root:

```bash
# Node und Caddy
curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
apt-get install -y nodejs caddy rsync

# Dienstbenutzer ohne Login und ohne Home
adduser --system --group --no-create-home --shell /usr/sbin/nologin rjadom

# Deploy-Benutzer, dem GitHub die Dateien schickt
adduser --disabled-password --gecos "" deploy

mkdir -p /srv/rjadom/dist /srv/rjadom/server /var/lib/rjadom
chown -R deploy:deploy /srv/rjadom
chown -R rjadom:rjadom /var/lib/rjadom
chmod 750 /var/lib/rjadom
```

## 2 · Die Passphrase

Sie steht **nur** hier, nie im Repository und nie im Build:

```bash
node -e "console.log('PAIR_SECRET=' + require('crypto').randomBytes(24).toString('base64url'))" \
  > /etc/rjadom.env
chmod 600 /etc/rjadom.env
cat /etc/rjadom.env   # diesen Wert gibst du einmal auf jedem der beiden Telefone ein
```

## 3 · Dienst und Reverse Proxy

```bash
cp deploy/rjadom.service /etc/systemd/system/rjadom.service
systemctl daemon-reload
systemctl enable rjadom

# Caddyfile: rjadom.example.com durch deine Domain ersetzen
cp deploy/Caddyfile /etc/caddy/Caddyfile
systemctl reload caddy
```

Der Dienst startet erst sauber, wenn `dist/` existiert — also nach dem ersten
Deploy. Das ist in Ordnung.

Damit GitHub neu starten darf, genau dieses eine Kommando erlauben:

```bash
echo 'deploy ALL=(root) NOPASSWD: /usr/bin/systemctl restart rjadom' \
  > /etc/sudoers.d/rjadom
chmod 440 /etc/sudoers.d/rjadom
visudo -c
```

## 4 · Deploy-Schlüssel

Auf deinem Rechner:

```bash
ssh-keygen -t ed25519 -f ~/.ssh/rjadom_deploy -C "github-actions" -N ""
ssh-copy-id -i ~/.ssh/rjadom_deploy.pub deploy@DEIN_SERVER

# Host-Key festnageln, damit ein Deploy abbricht statt blind zu vertrauen
ssh-keyscan -t ed25519 DEIN_SERVER
```

## 5 · GitHub konfigurieren

**Settings → Secrets and variables → Actions**

| Typ | Name | Wert |
|---|---|---|
| Secret | `SSH_PRIVATE_KEY` | Inhalt von `~/.ssh/rjadom_deploy` (der private Schlüssel) |
| Secret | `SSH_KNOWN_HOSTS` | Ausgabe von `ssh-keyscan` aus Schritt 4 |
| Secret | `SSH_HOST` | IP oder Hostname des VPS |
| Secret | `SSH_USER` | `deploy` |
| Variable | `DOMAIN` | `rjadom.example.com` — für den Health-Check |
| Variable | `SSH_PORT` | nur falls nicht 22 |
| Variable | `VITE_WEATHER_BASE_URL` | nur falls du Open-Meteo selbst hostest |

Dann **Actions → Deploy → Run workflow**, oder einfach auf `main` pushen.

## 6 · Was der Health-Check prüft

Nach dem Neustart erwartet der Workflow zwei Antworten:

* `GET /` → **200** — die App wird ausgeliefert
* `GET /api/session` ohne Zugangsdaten → **401** — das Schloss ist zu

Schlägt eines davon fehl, schlägt der Deploy fehl. Die Passphrase selbst kommt
dafür nicht in die CI.

---

## Sicherung

Alles, was nicht wiederherstellbar ist, liegt in einer Datei:

```bash
# z.B. täglich per cron
tar czf /root/rjadom-$(date +%F).tar.gz /var/lib/rjadom /etc/rjadom.env
```

## Erreichbarkeit aus Russland

Der Code hängt an keinem Anbieter, aber die Adresse tut es. Wenn es klemmt:

* **Zuerst die Domain prüfen, nicht den Server.** Eine zweite Domain auf dieselbe
  IP zu legen, ist in Minuten erledigt — die App muss dafür nicht angefasst werden.
* **Kein Cloudflare davor.** Caddy holt die Zertifikate direkt; damit gibt es
  keinen weiteren Vermittler, der ausfallen oder blockiert werden kann.
* **Ausfälle sind überbrückbar.** Die App funktioniert offline vollständig
  weiter; Antworten sammeln sich lokal und gehen raus, sobald es wieder geht.
  Ein Ausfall von Stunden kostet niemanden etwas.
