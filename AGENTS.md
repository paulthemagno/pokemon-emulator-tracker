# Agent Notes

Queste note sono per Codex o altri agenti che riprendono il lavoro.

## Regola principale

Aggiorna questi `.md` mentre lavori. Se cambi setup, live adapter, mappa, coordinate, endpoint, o workflow utente, aggiorna almeno uno tra:

- `README.md`
- `live-adapters/README.md`
- `docs/architecture.md`
- `docs/known-issues.md`
- `AGENTS.md`

## Contesto progetto

Il progetto e' una app Next/React per Pokemon save tracking. Ha due sorgenti dati:

- Upload `.sav` / `.srm`
- Live emulator memory tramite `/api/live`

Il live corrente e' focalizzato su Pokemon Crystal in mGBA.

## Live mGBA

File principale:

```text
live-adapters/mgba-crystal-live.lua
```

Lo script legge WRAM Crystal e serve JSON su `127.0.0.1:8080`.

Endpoint usato dalla UI:

```text
GET /api/live
```

che normalizza con:

```text
lib/pokemon/live-normalizer.ts
```

## Mappa Pokégear

La UI usa mappe locali in:

```text
public/maps/
```

La conversione `mapGroup/mapId -> landmark -> coordinate` vive in:

```text
lib/pokemon/data/gen2-map-landmarks.ts
```

Non usare un offset globale per tutte le mappe. Alcuni landmark possono richiedere `offsetX` / `offsetY` specifici. Goldenrod e' stato calibrato manualmente.

Le coordinate Kanto e Johto devono restare coerenti con `pokecrystal` `data/maps/landmarks.asm`.

## Badge

Gli sprite badge sono locali:

```text
public/badges/
```

Non hotlinkare Bulbagarden direttamente nella UI: alcuni asset si rompono o sono instabili nel browser.

## Cose da non rifare

- Non usare mappe screenshot allungate/croppate con coordinate di un'altra mappa.
- Non mettere label citta' sovrapposte alla mappa se rovinano la leggibilita'.
- Non calibrare Kanto rompendo Johto, o viceversa.
- Non assumere che un offset funzioni per tutti i landmark.

## Verifica minima

Dopo modifiche frontend:

```bash
curl -I http://127.0.0.1:3000
```

Se il server non e' acceso:

```bash
./node_modules/.bin/next dev --hostname 0.0.0.0
```

In sandbox puo' servire escalation per bindare `0.0.0.0:3000`.
