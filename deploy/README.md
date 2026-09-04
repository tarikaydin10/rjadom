# Deployment

Zwei Varianten. Nimm **A**, wenn Rjadom allein auf einer Maschine läuft. Nimm
**B**, wenn auf dem Server schon etwas anderes die Ports 80/443 hat.

Gemeinsam ist beiden: gebaut wird in der CI, auf den Server gehen nur `dist/`
und **eine einzige Server-Datei ohne Abhängigkeiten** — zusammen rund 1 MB,
40 Dateien, kein `node_modules`, kein npm auf dem Server. Ein Deploy ist zwei
`rsync` und ein Neustart. Eine kaputte Paket-Registry kann die laufende App
deshalb nie umwerfen, nur eine neue Version verhindern.

```
/srv/rjadom/app/dist/            ← das gebaute Frontend
/srv/rjadom/app/server/index.mjs ← der Server, ohne Abhängigkeiten
/var/lib/rjadom/                 ← eure Antworten, außerhalb des Deploy-Pfads
/etc/rjadom.env                  ← PAIR_SECRET, nur hier
```

Die Trennung ist Absicht: ein Deploy überschreibt `/srv/rjadom/app` vollständig
und kann `/var/lib/rjadom` nicht anfassen.

---

# Variante A · Rjadom allein auf dem Server

```bash
curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
apt-get install -y nodejs caddy rsync

adduser --system --group --no-create-home --shell /usr/sbin/nologin rjadom
adduser --disabled-password --gecos "" deploy

mkdir -p /srv/rjadom/app/dist /srv/rjadom/app/server /var/lib/rjadom
chown -R deploy:deploy /srv/rjadom
chown -R rjadom:rjadom /var/lib/rjadom && chmod 750 /var/lib/rjadom

# Die Passphrase. Steht nur hier — nie im Repository, nie im Build, nie in der CI.
node -e "console.log('PAIR_SECRET=' + require('crypto').randomBytes(24).toString('base64url'))" \
  > /etc/rjadom.env
chmod 600 /etc/rjadom.env
cat /etc/rjadom.env    # diesen Wert einmal auf jedem der beiden Telefone eingeben

cp deploy/rjadom.service /etc/systemd/system/
systemctl daemon-reload && systemctl enable rjadom

cp deploy/Caddyfile /etc/caddy/Caddyfile   # Domain eintragen
systemctl reload caddy

echo 'deploy ALL=(root) NOPASSWD: /usr/bin/systemctl restart rjadom' > /etc/sudoers.d/rjadom
chmod 440 /etc/sudoers.d/rjadom && visudo -c
```

In GitHub zusätzlich die Variable `RESTART_COMMAND` auf
`sudo /usr/bin/systemctl restart rjadom` setzen. Weiter bei
[GitHub konfigurieren](#github-konfigurieren).

---

# Variante B · Mehrere Systeme auf einem Server

Ein Caddy vorne, dahinter jede Anwendung als eigenes Projekt:

```
                    ┌──────────────────────┐
   :80 / :443  ───► │  edge (Caddy)        │   kennt keine App, nur conf.d/
                    │  /srv/edge/conf.d/   │   neue Site = Datei + reload
                    └───┬──────────────┬───┘
                        │              │
                    rjadom          irgendwas anderes
                 (eigenes Projekt)   (jederzeit wegwerfbar)
```

Der Punkt dieser Anordnung: **was verlässlich laufen muss, darf nicht von dem
abhängen, was ständig neu gebaut wird.** Rjadom läuft weiter, wenn du eine
Testumgebung daneben löschst — und du kannst sie ohne Nachdenken löschen.

## B1 · Den Türsteher aufsetzen

Noch nicht starten — die Ports sind ja belegt.

```bash
mkdir -p /srv/edge/conf.d /srv/rjadom/app/dist /srv/rjadom/app/server /var/lib/rjadom
cp deploy/edge/docker-compose.yml /srv/edge/
cp deploy/edge/Caddyfile /srv/edge/          # E-Mail-Adresse eintragen

# Der Container läuft als UID 1000 und muss in /var/lib/rjadom schreiben können.
chown -R 1000:1000 /var/lib/rjadom && chmod 750 /var/lib/rjadom

node -e "console.log('PAIR_SECRET=' + require('crypto').randomBytes(24).toString('base64url'))" \
  > /etc/rjadom.env
chmod 644 /etc/rjadom.env    # der Container liest sie als UID 1000
cat /etc/rjadom.env
```

> **Zertifikate mitnehmen.** Hat der bisherige Proxy schon Let's-Encrypt-Zertifikate,
> kopierst du sie einmalig in das Volume des Türstehers, statt sie neu ausstellen
> zu lassen. Erst nach `docker compose up -d` ausführen, damit das Volume existiert:
> ```bash
> docker run --rm -v ALTES_CADDY_VOLUME:/from -v edge_edge-data:/to \
>   alpine sh -c 'cp -a /from/. /to/'
> docker restart edge-caddy
> ```
> Ohne diesen Schritt holt Caddy die Zertifikate einfach neu — auch in Ordnung,
> nur nicht umsonst.

## B2 · Die bestehende Anwendung hinter den Türsteher legen

Hier gibt es zwei Wege, und welcher passt, hängt davon ab, was in der Caddyfile
der bestehenden Anwendung steht:

**Weg 1 — der bisherige Proxy verschwindet.** Wenn seine Caddyfile nur
`domain { reverse_proxy irgendwas:port }` enthält, wandert dieser Block
unverändert nach `/srv/edge/conf.d/`, der alte Web-Container wird aus dem Stack
entfernt, und `edge` tritt dessen Netzwerk bei (in
`deploy/edge/docker-compose.yml` ein zweites, `external: true` gesetztes Netz
ergänzen). Sauberste Variante: ein Proxy weniger.

**Weg 2 — der bisherige Proxy bleibt, nur innen.** Wenn er mehr tut als
weiterleiten (statische Dateien aus dem Image, SPA-Routing, Rewrites), lässt du
ihn stehen: in seiner Compose-Datei die `ports:`-Veröffentlichung von 80/443
entfernen, ihn dem Netz `edge` beitreten lassen, und in `/srv/edge/conf.d/`
kommt ein Block, der auf ihn zeigt:

```
alte-domain.de {
	reverse_proxy alter-web-container:80
}
```

Sein eigenes TLS entfällt damit — das macht jetzt der Türsteher.

## B3 · Rjadom starten

```bash
cp deploy/rjadom/docker-compose.yml /srv/rjadom/
cp deploy/rjadom/rjadom.caddy /srv/edge/conf.d/    # Domain eintragen

cd /srv/edge   && docker compose up -d     # ab jetzt hört der Türsteher
cd /srv/rjadom && docker compose up -d
```

Beim ersten Mal ist `app/` noch leer und der Container startet in eine
Neustartschleife — das ist erwartet und erledigt sich mit dem ersten Deploy.

```bash
echo 'deploy ALL=(root) NOPASSWD: /usr/bin/docker restart rjadom' > /etc/sudoers.d/rjadom
chmod 440 /etc/sudoers.d/rjadom && visudo -c
```

Bewusst **kein** `usermod -aG docker deploy`: Mitglied der docker-Gruppe zu sein
ist praktisch gleichbedeutend mit Root. Diese eine sudo-Zeile erlaubt genau ein
Kommando.

Ab hier ist eine neue Anwendung auf dieser Maschine: eigenes Verzeichnis,
eigenes Compose-Projekt, eine Datei in `conf.d/`, `docker exec edge-caddy caddy
reload --config /etc/caddy/Caddyfile`. Nichts anderes wird angefasst.

---

<h2 id="github-konfigurieren">GitHub konfigurieren</h2>

Deploy-Schlüssel auf deinem Rechner:

```bash
ssh-keygen -t ed25519 -f ~/.ssh/rjadom_deploy -C "github-actions" -N ""
ssh-copy-id -i ~/.ssh/rjadom_deploy.pub deploy@DEIN_SERVER
ssh-keyscan -t ed25519 DEIN_SERVER          # Ausgabe für SSH_KNOWN_HOSTS
```

**Settings → Secrets and variables → Actions**

| Typ | Name | Wert |
|---|---|---|
| Secret | `SSH_PRIVATE_KEY` | Inhalt von `~/.ssh/rjadom_deploy` |
| Secret | `SSH_KNOWN_HOSTS` | Ausgabe von `ssh-keyscan` |
| Secret | `SSH_HOST` | IP oder Hostname |
| Secret | `SSH_USER` | `deploy` |
| Variable | `DOMAIN` | eure Domain — für den Health-Check |
| Variable | `SSH_PORT` | nur falls nicht 22 |
| Variable | `RESTART_COMMAND` | nur für Variante A (systemd) |
| Variable | `VITE_WEATHER_BASE_URL` | nur falls Open-Meteo selbst gehostet |

Der Host-Key wird **gepinnt**, nicht beim ersten Mal blind vertraut: ein Deploy
bricht lieber ab, als den Schlüssel an irgendwen zu geben, der unter der Adresse
antwortet.

Der Health-Check nach jedem Neustart prüft zwei Dinge: `GET /` muss **200**
liefern, `GET /api/session` ohne Zugangsdaten **401**. Damit ist bestätigt, dass
die App läuft *und* das Schloss zu ist — ohne dass die Passphrase je in die CI
muss.

---

## Sicherung

Alles, was nicht wiederherstellbar ist, liegt an zwei Stellen:

```bash
tar czf /root/rjadom-$(date +%F).tar.gz /var/lib/rjadom /etc/rjadom.env
```

## Erreichbarkeit aus Russland

Der Code hängt an keinem Anbieter, die Adresse tut es. Wenn es klemmt:

* **Zuerst die Domain prüfen, nicht den Server.** Eine zweite Domain auf dieselbe
  IP zu legen, dauert Minuten — an der App ändert sich dafür nichts.
* **Kein Cloudflare davor.** Caddy holt die Zertifikate direkt; damit gibt es
  keinen weiteren Vermittler, der ausfallen oder blockiert werden kann.
* **Ausfälle sind überbrückbar.** Die App funktioniert offline vollständig
  weiter; Antworten sammeln sich lokal und gehen raus, sobald es wieder geht.
  Ein Ausfall von Stunden kostet niemanden etwas.
