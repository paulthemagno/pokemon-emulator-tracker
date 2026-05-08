# Pokemon Tracker

Dashboard web per leggere salvataggi Pokemon e, in modalita live, seguire Pokemon Crystal mentre gira in mGBA.

## Cosa fa

- Importa file `.sav` / `.srm` Gen 1, Gen 2 e parte Gen 3.
- Mostra trainer, party, PC box, inventario e posizione.
- Supporta una modalita live per Pokemon Crystal tramite script Lua in mGBA.
- In live mode aggiorna party, HP, EXP, mosse, badge, trainer info e landmark Pokégear.

## Setup

Richiede Node.js recente e Corepack.

```bash
corepack enable
corepack pnpm install
corepack pnpm dev
```

Apri:

```text
http://localhost:3000
```

Per esporre la UI ad altri dispositivi sulla stessa rete:

```bash
corepack pnpm dev --hostname 0.0.0.0
```

Poi apri l'IP del computer host, per esempio:

```text
http://192.168.1.83:3000
```

## Live con mGBA

1. Apri Pokemon Crystal in mGBA.
2. Apri `Tools -> Scripting...`.
3. Carica `live-adapters/mgba-crystal-live.lua`.
4. Nella web app premi **Start Live**.

Lo script mGBA espone un piccolo server locale su:

```text
http://127.0.0.1:8080/snapshot
```

La web app chiama `/api/live`, che fa proxy verso lo script live.

## Condivisione del progetto

Quando condividi il codice, passa la repository intera ma non `node_modules`.

File/cartelle importanti:

- `app/`
- `components/`
- `hooks/`
- `lib/`
- `live-adapters/`
- `public/`
- `package.json`
- `pnpm-lock.yaml`
- `next.config.mjs`
- `tsconfig.json`

Chi riceve il progetto deve eseguire:

```bash
corepack enable
corepack pnpm install
corepack pnpm dev
```

## Stato noto

- La modalita `.sav` rimane la via piu universale per gli emulatori senza adapter live.
- Il live vero dipende dall'emulatore. Al momento l'adapter curato e' `mGBA + Pokemon Crystal`.
- La mappa live usa landmark stile Pokégear, non coordinate passo-passo.
- Alcune aree Gen 3 hanno ancora errori TypeScript storici e vanno ripulite prima di considerare il progetto stabile.

## Dati generati

Le descrizioni degli item nei tooltip sono locali in `lib/pokemon/data/item-descriptions.ts`.
Il file viene generato da PokeAPI per gli item Gen 1-3 che l'app puo' parsare.

Per rigenerarlo dopo modifiche alle tabelle item:

```bash
node scripts/generate-item-descriptions.mjs
```

## Documenti

- [Live adapters](live-adapters/README.md)
- [Agent notes](AGENTS.md)
- [Architecture notes](docs/architecture.md)
- [Known issues](docs/known-issues.md)
