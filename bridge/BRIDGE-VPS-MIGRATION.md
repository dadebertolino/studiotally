# Bridge .NET — Migrazione da Firebase a VPS

## Cosa cambia
Il ramo CLOUD del bridge ora parla col VPS (`wss://ws.studiotally.com`) via WebSocket,
invece di fare PATCH HTTP a Firebase RTDB. La LAN mode (WebSocketServer) resta INVARIATA.

## File

### NUOVO
- **VpsClient.cs** → mettilo nella cartella `bridge/`. Stessa interfaccia di FirebaseClient
  (Connect, Disconnect, WriteTally, OnCommand, OnStatusChange, IsConnected).
  Usa System.Net.WebSockets.ClientWebSocket (built-in .NET 8, nessuna dipendenza NuGet).

### MODIFICATO
- **BridgeForm.cs** → 2 sole righe cambiate:
    - `private FirebaseClient? _firebase;`  →  `private VpsClient? _firebase;`
    - `_firebase = new FirebaseClient();`   →  `_firebase = new VpsClient();`
  (il nome del campo resta `_firebase` per non toccare le altre 6 righe che lo usano)

### INVARIATO
- FirebaseClient.cs → lascialo nel progetto (non piu' usato, ma utile per rollback)
- VmixClient.cs, WebSocketServer.cs, Program.cs, .csproj → nessuna modifica

## Come funziona ora (cloud)
1. Connect(room): verifica via REST `GET https://ws.studiotally.com/room/{CODE}` che la stanza esista,
   poi apre il WebSocket persistente e manda `{type:"join", code, role:"bridge"}`.
2. WriteTally: manda `{type:"patch", data:{tallies, camNames}}`. Il server timbra `_bridge`
   automaticamente (perche' role=bridge), quindi il Master rileva il bridge come prima.
3. Comandi dalla regia: il server invia `{type:"bridgeCommand", command:{function, params, ts}}`
   sul WebSocket; VpsClient solleva l'evento OnCommand → la form li gira a vMix. Niente piu' polling.
4. Reconnect automatico ogni 2s se la connessione cade (resta su per ore di diretta).

## Differenze tecniche vs Firebase
- Firebase: PATCH HTTP ripetuti + polling GET ogni 1s per i comandi.
- VPS: una connessione WebSocket persistente, push bidirezionale. Piu' efficiente e a bassa latenza.
- I comandi non si "consumano" piu' con DELETE: arrivano in push, una volta sola.

## Build
Apri la soluzione in Visual Studio (o `dotnet build`) e compila come prima.
Nessuna nuova dipendenza NuGet: ClientWebSocket e' nel runtime .NET 8.

## Test
1. Crea una stanza dalla PWA (regia) — ottieni un codice a 5 lettere.
2. Apri il bridge, modalita' cloud (NON LAN), inserisci il codice, IP vMix, Connetti.
3. Nel bridge: lo stato deve passare a "connesso"; manda i tally mappando gli input.
4. Sulla PWA (Master): deve comparire il badge BRIDGE e i tally devono aggiornarsi.
5. Dalla PWA manda un comando (es. CUT) → deve arrivare a vMix via bridge.

## Rollback
In BridgeForm.cs rimetti `FirebaseClient` al posto di `VpsClient` (2 righe).
