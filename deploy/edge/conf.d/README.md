# Site-Konfigurationen

Jede Datei `*.caddy` hier ist eine Site. Neue App: Datei ablegen, dann

```bash
docker exec edge-caddy caddy reload --config /etc/caddy/Caddyfile
```

Kein Rebuild, kein Neustart, keine andere App betroffen. Ein Syntaxfehler lässt
den Reload fehlschlagen und die laufende Konfiguration unangetastet — Caddy
übernimmt nur, was es vorher validiert hat.
