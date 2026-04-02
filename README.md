# StudioTally

Timer, tally e controllo regia per produzioni live — tutto dal browser, zero hardware.

## Cosa fa

StudioTally trasforma qualsiasi telefono in un monitor da studio televisivo. Il regista crea una stanza, condivide un codice a 5 lettere, e tutti i dispositivi si sincronizzano in tempo reale via Firebase.

### Funzionalità

**Timer**
- **Show Clock** — orologio count up dello show, visibile su tutti i viewer
- **Segment Timer** — cronometro o countdown per segmenti, con preset rapidi (30s, 1m, 2m, 3m, 5m, 10m) e input custom
- **Camera Timers** — countdown individuali per camera (preset 1m/2m/3m/5m + custom), visibili solo sulla camera destinataria
- Sincronizzazione real-time: il timer scorre fluido su tutti i dispositivi remoti

**Tally**
- Tally light PGM/PVW per ogni camera con pipeline tap (OFF → PVW → PGM → OFF)
- Transizioni: CUT, FADE, FTB, DIP, WIPE (bidirezionali con lo switcher se il bridge è attivo)
- Camere rinominabili, aggiungibili/rimuovibili dinamicamente
- Fullscreen tally per cameraman e ospiti remoti

**Messaggistica**
- Messaggi diretti dal regista a singole camere
- Preset rapidi: STRINGI, ALLARGA, 30 SEC, 1 MIN, CHIUDI, STAND BY, VAI, MUOVITI
- Testo libero per messaggi custom
- Il messaggio appare grande e lampeggiante sul viewer della camera

**Bridge (nel browser)**
- Connessione diretta a vMix (HTTP API, porta 8088) — zero installazione
- Connessione diretta a OBS Studio (WebSocket v5, porta 4455) — zero installazione
- Tally automatico dallo switcher: il telefono legge PGM/PVW direttamente
- Comandi rapidi: CUT, FADE, REC, STOP

**Stanze persistenti**
- Durata programmabile: 4h, 12h, 24h, 48h, 72h (default), 7 giorni
- La stanza sopravvive alla disconnessione del regista
- Riconnessione automatica alla stanza attiva
- Estensione TTL (+12h/+24h/+48h) dall'interno della stanza
- Auto-cleanup delle stanze scadute

**Altro**
- PWA installabile (schermo intero, niente barra browser)
- Wake Lock per impedire lo spegnimento schermo
- i18n: 10 lingue (IT, EN, FR, DE, ES, PT, JA, KO, ZH, AR)
- Fallback locale se Firebase non è configurato

## Stack

- **Frontend**: React + Vite (single page, no router)
- **Sync**: Firebase Realtime Database
- **Auth**: Firebase Anonymous Auth
- **Deploy**: Vercel
- **Bridge**: connessione diretta browser → switcher via LAN (fetch HTTP per vMix, WebSocket per OBS)

## Struttura progetto

```
src/
  App.jsx                 # Router + global styles
  main.jsx                # Entry point
  firebase-config.js      # Firebase init, room API, TTL, viewer presence
  useFirebaseSync.js      # Hook: sync state master↔viewer via Firebase
  useWakeLock.js          # Hook: impedisce spegnimento schermo
  i18n.js                 # 10 lingue
  styles/
    constants.js          # Font, colori tally, presets, formatter
  components/
    UI.jsx                # Btn, Badge, Card, Label, StatusDot, TimerDigits, TallyCard
  screens/
    Landing.jsx           # Splash con feature list
    Lobby.jsx             # Crea/entra stanza, selettore TTL, riconnessione
    Master.jsx            # Schermata regista (timer + tally + bridge)
    Viewer.jsx            # Schermata viewer (3 modalità: selezione, overview, fullscreen)
  panels/
    TimerPanel.jsx        # Show Clock + Segment Timer (cronometro/countdown)
    TallyPanel.jsx        # Griglia camere, transizioni, camera timers, messaggi
    BridgePanel.jsx       # Connessione vMix/OBS
  bridges/
    useVmixBridge.js      # Hook: polling HTTP vMix
    useObsBridge.js       # Hook: WebSocket OBS v5
```

## Setup

### 1. Clona e installa

```bash
git clone https://github.com/TUO_USER/studiotally.git
cd studiotally
npm install
```

### 2. Configura Firebase

1. Vai su [Firebase Console](https://console.firebase.google.com)
2. Crea un progetto (o usa uno esistente)
3. Attiva **Realtime Database** (regione `europe-west1`)
4. Attiva **Authentication** → Abilita **Anonymous**
5. Copia le credenziali in `src/firebase-config.js`

### 3. Database Rules

Deploya le regole da `database.rules.json`:

```bash
firebase deploy --only database
```

### 4. Dev locale

```bash
npm run dev
```

### 5. Deploy su Vercel

```bash
npm run build
vercel --prod
```

## Come si usa

1. **Regista**: apri l'app → Crea Stanza → scegli durata → condividi il codice a 5 lettere
2. **Cameraman/Ospiti**: apri l'app → Entra in Stanza → inserisci il codice → scegli "Tutte le camere" o una specifica
3. **Bridge** (opzionale): nella schermata regista, tab 🔌 BRIDGE → scegli vMix o OBS → inserisci l'IP del PC → Connetti

## Licenza

MIT
