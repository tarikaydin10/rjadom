# Deployment

Zwei Varianten. Nimm **A**, wenn Ryadom allein auf einer Maschine läuft. Nimm
**B**, wenn auf dem Server schon etwas anderes die Ports 80/443 hat.

Gemeinsam ist beiden: gebaut wird in der CI, auf den Server gehen nur `dist/`
und **eine einzige Server-Datei ohne Abhängigkeiten** — zusammen rund 1 MB,
40 Dateien, kein `node_modules`, kein npm auf dem Server. Ein Deploy ist zwei
`rsync` und ein Neustart. Eine kaputte Paket-Registry kann die laufende App
deshalb nie umwerfen, nur eine neue Version verhindern.

```
/srv/ryadom/app/dist/            ← das gebaute Frontend
/srv/ryadom/app/server/index.mjs ← der Server, ohne Abhängigkeiten
/var/lib/ryadom/                 ← eure Antworten, außerhalb des Deploy-Pfads
/etc/ryadom.env                  ← PAIR_SECRET, nur hier
```

Die Trennung ist Absicht: ein Deploy überschreibt `/srv/ryadom/app` vollständig
und kann `/var/lib/ryadom` nicht anfassen.

---

# Variante A · Ryadom allein auf dem Server

```bash
curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
apt-get install -y nodejs caddy rsync

adduser --system --group --no-create-home --shell /usr/sbin/nologin ryadom
adduser --disabled-password --gecos "" deploy

mkdir -p /srv/ryadom/app/dist /srv/ryadom/app/server /var/lib/ryadom
chown -R deploy:deploy /srv/ryadom
chown -R ryadom:ryadom /var/lib/ryadom && chmod 750 /var/lib/ryadom

# Die Passphrase. Steht nur hier — nie im Repository, nie im Build, nie in der CI.
node -e "console.log('PAIR_SECRET=' + require('crypto').randomBytes(24).toString('base64url'))" \
  > /etc/ryadom.env
chmod 600 /etc/ryadom.env
cat /etc/ryadom.env    # diesen Wert einmal auf jedem der beiden Telefone eingeben

cp deploy/ryadom.service /etc/systemd/system/
systemctl daemon-reload && systemctl enable ryadom

cp deploy/Caddyfile /etc/caddy/Caddyfile   # Domain eintragen
systemctl reload caddy

echo 'deploy ALL=(root) NOPASSWD: /usr/bin/systemctl restart ryadom' > /etc/sudoers.d/ryadom
chmod 440 /etc/sudoers.d/ryadom && visudo -c
```

In GitHub zusätzlich die Variable `RESTART_COMMAND` auf
`sudo /usr/bin/systemctl restart ryadom` setzen. Weiter bei
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
                    ryadom          irgendwas anderes
                 (eigenes Projekt)   (jederzeit wegwerfbar)
```

Der Punkt dieser Anordnung: **was verlässlich laufen muss, darf nicht von dem
abhängen, was ständig neu gebaut wird.** Ryadom läuft weiter, wenn du eine
Testumgebung daneben löschst — und du kannst sie ohne Nachdenken löschen.

## B1 · Den Türsteher aufsetzen

Noch nicht starten — die Ports sind ja belegt.

```bash
mkdir -p /srv/edge/conf.d /srv/ryadom/app/dist /srv/ryadom/app/server /var/lib/ryadom
cp deploy/edge/docker-compose.yml /srv/edge/
cp deploy/edge/Caddyfile /srv/edge/          # E-Mail-Adresse eintragen

# Ein eigener Dienstbenutzer für den Container — ausdrücklich nicht derselbe,
# unter dem der Deploy einloggt. Sonst gehörte einem geleakten Deploy-Key auch
# gleich das Datenverzeichnis. `adduser deploy` bekommt auf einem frischen
# Ubuntu UID 1000; deshalb hier nie 1000 fest verdrahten.
adduser --system --group --no-create-home --shell /usr/sbin/nologin ryadomsvc
printf 'RYADOM_UID=%s\nRYADOM_GID=%s\n' "$(id -u ryadomsvc)" "$(id -g ryadomsvc)" \
  > /srv/ryadom/.env
chown -R ryadomsvc:ryadomsvc /var/lib/ryadom && chmod 750 /var/lib/ryadom

# Die Passphrase liest Docker selbst, als root, und reicht sie in den Container.
# Der Container-Benutzer braucht die Datei nie — also gehört sie root allein.
node -e "console.log('PAIR_SECRET=' + require('crypto').randomBytes(24).toString('base64url'))" \
  > /etc/ryadom.env
chown root:root /etc/ryadom.env && chmod 600 /etc/ryadom.env
cat /etc/ryadom.env
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

## B3 · Ryadom starten

```bash
cp deploy/ryadom/docker-compose.yml /srv/ryadom/
cp deploy/ryadom/ryadom.caddy /srv/edge/conf.d/    # Domain eintragen

cd /srv/edge   && docker compose up -d     # ab jetzt hört der Türsteher
cd /srv/ryadom && docker compose up -d
```

Beim ersten Mal ist `app/` noch leer und der Container startet in eine
Neustartschleife — das ist erwartet und erledigt sich mit dem ersten Deploy.

```bash
echo 'deploy ALL=(root) NOPASSWD: /usr/bin/docker restart ryadom' > /etc/sudoers.d/ryadom
chmod 440 /etc/sudoers.d/ryadom && visudo -c
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

Am einfachsten **auf dem Server** — dort ist das Werkzeug vollständig, und der
Schlüssel gibt ohnehin nur Zugang zu genau dieser Maschine. Unter Windows
scheitern `ssh-copy-id` (gibt es nicht) und `ssh-keyscan` (zu alt für das
KEX-Verfahren neuerer Server) sonst nur:

```bash
ssh-keygen -t ed25519 -f /tmp/k -C github-actions -N ''
cat /tmp/k.pub >> /home/deploy/.ssh/authorized_keys
chown deploy:deploy /home/deploy/.ssh/authorized_keys && chmod 600 /home/deploy/.ssh/authorized_keys

echo "── SSH_PRIVATE_KEY_B64 (eine Zeile) ──"
base64 -w0 /tmp/k; echo
echo "── SSH_KNOWN_HOSTS ──"
echo "DEINE_SERVER_IP $(cut -d' ' -f1,2 /etc/ssh/ssh_host_ed25519_key.pub)"

shred -u /tmp/k /tmp/k.pub
```

Den Host-Key direkt aus `/etc/ssh/ssh_host_ed25519_key.pub` zu lesen ist auch
inhaltlich besser als `ssh-keyscan`: du liest ihn dort, wo er entsteht, statt
ihn dir übers Netz von jemandem geben zu lassen, der behauptet, der Server zu
sein.

**Settings → Secrets and variables → Actions**

| Typ | Name | Wert |
|---|---|---|
| Secret | `SSH_PRIVATE_KEY_B64` | `base64 -w0 ~/.ssh/ryadom_deploy` — **eine** Zeile, nichts kann verlorengehen |
| Secret | `SSH_KNOWN_HOSTS` | Ausgabe von `ssh-keyscan` |
| Secret | `SSH_HOST` | IP oder Hostname |
| Secret | `SSH_USER` | `deploy` |
| Variable | `DOMAIN` | eure Domain — für den Health-Check |

| Variable | `SSH_PORT` | nur falls nicht 22 |
| Variable | `RESTART_COMMAND` | nur für Variante A (systemd) |
| Variable | `VITE_WEATHER_BASE_URL` | nur falls Open-Meteo selbst gehostet |

`DOMAIN`, `SSH_PORT` und `RESTART_COMMAND` werden aus **beiden** Reitern gelesen —
ob GitHub etwas „Secret" oder „Variable" nennt, ist eine Eigenheit der Oberfläche
und soll keinen Deploy stillschweigend zerlegen. Für `DOMAIN` ist der
Variables-Reiter trotzdem der bessere Ort: Secrets werden in Logs durch `***`
ersetzt, und dann liest sich der Health-Check als `https://***/`, was die
Fehlersuche unnötig erschwert. Eine Domain ist ohnehin kein Geheimnis — sie steht
im DNS.

Der Host-Key wird **gepinnt**, nicht beim ersten Mal blind vertraut: ein Deploy
bricht lieber ab, als den Schlüssel an irgendwen zu geben, der unter der Adresse
antwortet.

Der Health-Check nach jedem Neustart prüft zwei Dinge: `GET /` muss **200**
liefern, `GET /api/session` ohne Zugangsdaten **401**. Damit ist bestätigt, dass
die App läuft *und* das Schloss zu ist — ohne dass die Passphrase je in die CI
muss.

---

## Die Passwörter ändern

**Jede Seite hat ihr eigenes.** Das ist keine Bequemlichkeit, sondern der Grund,
warum die Seite feststeht: Der Server leitet sie daraus ab, *welches* Passwort
gepasst hat. Mit einem gemeinsamen Passwort konnte die Seite nur im Header
behauptet werden — und wer es kannte, konnte sich als die andere Person ausgeben
und deren Antwort lesen, ohne selbst geschrieben zu haben.

Sie stehen ausschließlich in `/etc/ryadom.env` auf dem Server — nie im Code, nie
im Repository, nie im Build:

```bash
cat > /etc/ryadom.env <<'EOF'
PAIR_SECRET_A=passwort-fuer-hamburg
PAIR_SECRET_B=passwort-fuer-kaliningrad
EOF
chown root:root /etc/ryadom.env && chmod 600 /etc/ryadom.env
cd /srv/ryadom && docker compose up -d --force-recreate
```

Danach melden sich beide Telefone einmal neu an: unter „Мы / Us" auf „Dieses
Gerät vergessen", dann das neue Passwort. **Eure Antworten bleiben erhalten** —
sie hängen nicht am Passwort.

Falsche Versuche werden zunehmend langsamer beantwortet, global gezählt: die
ersten beiden sofort (das ist ein Tippfehler), danach wächst die Verzögerung bis
auf eine Minute. Ein Angreifer kommt damit auf rund 1.440 Versuche am Tag statt
Millionen; euch kostet es nichts, weil ihr pro Gerät einmal entsperrt. Aussperren
kann euch damit niemand — es bremst, es blockiert nicht.

Zwei Dinge, die der Server erzwingt bzw. erlaubt:

* **Kürzer als 16 Zeichen ist erlaubt, wird aber beim Start angemahnt.** Wie viel
  Passwort genug ist, entscheidet ihr — ihr wisst, wer bei euch vorbeischauen
  könnte. Nur ehrlich dazu: die Adresse der App ist nicht geheim, in den Logs
  stehen Bots, die jede Domain abklappern, und die Bremse unten kauft gegen ein
  kurzes Wörterbuchwort Zeit, keine Sicherheit.
* **Beide müssen verschieden sein.** Sind sie gleich (oder wird das alte
  `PAIR_SECRET` benutzt), warnt der Server beim Start und fällt darauf zurück,
  dem Client zu glauben, welche Seite er ist.
* **Beliebige Zeichen**, auch Kyrillisch oder Emoji. Der Client kodiert das
  Passwort, bevor es in den HTTP-Header geht: Header dürfen nur Latin-1
  enthalten, ein russisches Passwort würde sonst schon im Browser scheitern.
  Ein Passwort auf Russisch ist also möglich — und für diese App naheliegend.

## Wenn ein Geheimnis abhandenkommt

Es gibt genau zwei, und beide sind in Minuten ersetzt. Das ist Absicht: ein
Geheimnis, dessen Austausch wehtut, tauscht man im Zweifel nicht aus.

Passiert das versehentlich — in eine Chat-Nachricht kopiert, in ein Log
geraten, auf einem fremden Rechner geöffnet — dann **beide** ersetzen, nicht nur
das offensichtliche. Wer den Deploy-Schlüssel hat, kann den ausgelieferten Code
austauschen und den Dienst neu starten; damit ist auch alles kompromittiert, was
der Prozess sieht.

```bash
# 1 · Deploy-Schlüssel
: > /home/deploy/.ssh/authorized_keys
ssh-keygen -t ed25519 -f /tmp/k -C github-actions -N ''
cat /tmp/k.pub >> /home/deploy/.ssh/authorized_keys
chown deploy:deploy /home/deploy/.ssh/authorized_keys && chmod 600 /home/deploy/.ssh/authorized_keys
cat /tmp/k          # → direkt in das GitHub-Secret, danach:
shred -u /tmp/k /tmp/k.pub

# 2 · Passphrase
node -e "console.log('PAIR_SECRET=' + require('crypto').randomBytes(24).toString('base64url'))" \
  > /etc/ryadom.env
chown root:root /etc/ryadom.env && chmod 600 /etc/ryadom.env
cd /srv/ryadom && docker compose up -d --force-recreate
```

Nach Schritt 2 melden sich beide Telefone einmal neu an — unter „Мы / Us" auf
„Dieses Gerät vergessen", dann die neue Passphrase eingeben. **Eure Antworten
bleiben dabei erhalten**, sie hängen nicht an der Passphrase.

Geheimnisse nie über einen Umweg weitergeben. `cat` direkt vor dem Einfügen ins
Zielfeld, und das war es — nicht erst in eine Datei, einen Chat oder eine
Notiz-App.

## Sicherung

Alles, was nicht wiederherstellbar ist, liegt an zwei Stellen:

```bash
tar czf /root/ryadom-$(date +%F).tar.gz /var/lib/ryadom /etc/ryadom.env
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
