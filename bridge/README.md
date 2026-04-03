# StudioTally Bridge — vMix

Applicazione Windows che collega vMix a StudioTally via Firebase.
Gira sul PC dove è installato vMix, legge il tally in tempo reale e lo sincronizza con tutti i telefoni.

## Requisiti

- Windows 10/11 x64
- .NET 8 SDK (per compilare) — scarica da https://dotnet.microsoft.com/download/dotnet/8.0
- vMix con Web Controller attivo (Settings → Web Controller)

## Aprire in Visual Studio

1. Apri Visual Studio
2. File → Open → Project/Solution → seleziona `StudioTallyBridge.csproj`
3. F5 per avviare in debug

## Compilare l'exe self-contained

```bash
dotnet publish -c Release -r win-x64 --self-contained true -p:PublishSingleFile=true
```

L'exe si trova in `bin/Release/net8.0-windows/win-x64/publish/StudioTallyBridge.exe`
Questo file non richiede .NET installato — si copia e si esegue.

## Utilizzo

1. Avvia StudioTally sul telefono e crea una stanza (es: `ABC12`)
2. Avvia StudioTallyBridge sul PC
3. Inserisci il codice stanza (`ABC12`)
4. Inserisci l'IP di vMix (`localhost` se è lo stesso PC, oppure l'IP LAN)
5. Clicca **CONNETTI**

Il bridge legge lo stato tally da vMix ogni 250ms e lo pusha su Firebase.
I comandi inviati dal master (CUT, FADE, ecc.) vengono ricevuti e inoltrati a vMix.

## Come funziona

```
vMix HTTP API (localhost:8088)
  ↓ polling 250ms
StudioTallyBridge.exe
  ↓ REST PATCH
Firebase RTDB
  ↓ onValue (real-time)
Telefoni (Master + Viewer)
```

- Nessun problema CORS (l'app desktop fa le chiamate HTTP, non il browser)
- Il tally include i nomi degli input di vMix
- I comandi dal master vengono eseguiti su vMix (CUT, FADE, FadeToBlack, ecc.)
- Le impostazioni (stanza, IP, porta) vengono salvate in `bridge_settings.txt`
