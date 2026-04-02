# Broadcast Timer Pro — Installazione Mac

Tempo totale: ~20 minuti.

---

## STEP 0: Prerequisiti

Apri il **Terminale** (Cmd+Spazio → scrivi "Terminal" → Invio).

### Node.js
Controlla se lo hai già:
```bash
node --version
```
Se non esce nulla o dà errore:
```bash
# Installa Homebrew (se non lo hai)
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

# Installa Node.js
brew install node
```

### Verifica
```bash
node --version   # deve dare v18+ o v20+
npm --version    # deve dare 9+
```

---

## STEP 1: Scarica il progetto

Hai il file `.zip` scaricato da Claude. Decomprimilo e entra nella cartella:

```bash
cd ~/Downloads/broadcast-timer-final
```

Oppure, se hai messo il progetto altrove:
```bash
cd /percorso/della/cartella/broadcast-timer-final
```

---

## STEP 2: Installa le dipendenze

```bash
npm install
```

Aspetta 1-2 minuti. Vedrai una barra di progresso.

---

## STEP 3: Configura Firebase

### 3.1 Crea il progetto Firebase

1. Vai su https://console.firebase.google.com
2. Accedi col tuo account Google
3. Clicca **"Aggiungi progetto"**
4. Nome: `broadcast-timer` (o quello che vuoi)
5. **Disabilita** Google Analytics → **Crea progetto**

### 3.2 Crea il Realtime Database

1. Nel menu a sinistra: **Build → Realtime Database**
2. Clicca **"Crea database"**
3. Posizione: **europe-west1** → Avanti
4. Seleziona **"Avvia in modalità di test"** → **Abilita**

### 3.3 Registra l'app web

1. Nella home del progetto, clicca l'icona **Web (</>)**
2. Nome: `broadcast-timer` → **Registra app**
3. Appare un blocco di codice. Ti servono questi 4 valori:
   - `apiKey`
   - `authDomain`  
   - `databaseURL`
   - `projectId`

### 3.4 Incolla le credenziali

Apri il file `src/firebase-config.js` con un editor di testo:

```bash
open -a TextEdit src/firebase-config.js
```

Oppure con VS Code:
```bash
code src/firebase-config.js
```

Trova queste righe e sostituisci i placeholder:

```javascript
const firebaseConfig = {
  apiKey: "INCOLLA_QUI",        // ← la tua apiKey
  authDomain: "INCOLLA_QUI",    // ← il tuo authDomain
  databaseURL: "INCOLLA_QUI",   // ← il tuo databaseURL
  projectId: "INCOLLA_QUI",     // ← il tuo projectId
};
```

Salva il file (Cmd+S).

### 3.5 Attiva autenticazione anonima

1. Nel menu Firebase: **Build → Authentication** → **Inizia**
2. Tab **"Metodo di accesso"**
3. Clicca **"Anonimo"** → **Attiva** → **Salva**

---

## STEP 4: Avvia il progetto

```bash
npm run dev
```

Vedrai qualcosa tipo:
```
  VITE v5.3.0  ready in 400 ms

  ➜  Local:   http://localhost:5173/
  ➜  Network: http://192.168.1.XX:5173/
```

### Apri nel browser:
- **Sul Mac**: vai su http://localhost:5173
- **Sul telefono**: apri `http://192.168.1.XX:5173` (l'IP che vedi nel terminale)

> ⚠️ Il telefono DEVE essere sulla stessa rete Wi-Fi del Mac.

---

## STEP 5: Prova

1. **Sul Mac (o primo telefono)**: clicca "Inizia" → "Crea Stanza" → sei la Regia
2. **Sul telefono (o secondo browser)**: clicca "Inizia" → "Entra in Stanza" → inserisci il codice a 5 lettere
3. Dalla Regia: premi **▶ Start** → il timer parte su entrambi i dispositivi
4. Vai nella tab **TALLY** → tocca le camere per cambiare PGM/PVW
5. Vai nella tab **🔌 BRIDGE** → connetti vMix o OBS se li hai

---

## Comandi utili

```bash
# Avvia il progetto
npm run dev

# Ferma il progetto
Ctrl+C nel terminale

# Riavvia dopo modifiche
Ctrl+C poi npm run dev
```

---

## Problemi comuni

**"command not found: node"**
→ Node.js non è installato. Torna allo Step 0.

**"npm install" dà errori**
→ Prova: `rm -rf node_modules && npm install`

**Il telefono non si connette**
→ Verifica di essere sulla stessa rete Wi-Fi del Mac.
→ Usa l'indirizzo `http://192.168.X.X:5173` (NON localhost).

**Firebase: "Permission denied"**
→ Le regole del database sono scadute (durano 30 giorni in test mode).
→ Vai su Firebase → Realtime Database → Regole → rimetti le regole di test.

**vMix/OBS non si connette dal bridge**
→ Il browser potrebbe bloccare richieste HTTP non sicure.
→ Prova da Chrome. In alternativa usa l'app desktop (bridge Electron).
