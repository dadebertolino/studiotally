using System.Net.WebSockets;
using System.Text;
using System.Text.Json;

namespace StudioTallyBridge;

/// <summary>
/// VpsClient — sostituisce FirebaseClient per il backend VPS (WebSocket).
/// Stessa interfaccia pubblica di FirebaseClient:
///   Connect(roomCode), Disconnect(), WriteTally(tallies, camNames),
///   eventi OnCommand / OnStatusChange, proprieta' IsConnected.
/// Connessione persistente a wss://ws.studiotally.com con reconnect automatico.
/// </summary>
public class VpsClient : IDisposable
{
    private const string WS_URL   = "wss://ws.studiotally.com";
    private const string HTTP_URL = "https://ws.studiotally.com";

    private readonly HttpClient _http = new() { Timeout = TimeSpan.FromSeconds(5) };
    private ClientWebSocket? _ws;
    private CancellationTokenSource? _cts;
    private string _roomCode = "";
    private volatile bool _running;
    private volatile bool _joined;

    public bool IsConnected { get; private set; }

    public event Action<string, Dictionary<string, string>?>? OnCommand;
    public event Action<bool, string?>? OnStatusChange;

    public async Task<bool> Connect(string roomCode)
    {
        _roomCode = roomCode.ToUpper();

        // 1) Verifica che la stanza esista (come faceva Firebase con masterUid)
        try
        {
            var resp = await _http.GetAsync($"{HTTP_URL}/room/{_roomCode}");
            if (!resp.IsSuccessStatusCode)
            {
                OnStatusChange?.Invoke(false, "Stanza non trovata");
                return false;
            }
            var body = await resp.Content.ReadAsStringAsync();
            using var doc = JsonDocument.Parse(body);
            if (!doc.RootElement.TryGetProperty("exists", out var ex) || !ex.GetBoolean())
            {
                OnStatusChange?.Invoke(false, "Stanza non trovata");
                return false;
            }
        }
        catch (Exception e)
        {
            OnStatusChange?.Invoke(false, e.Message);
            return false;
        }

        // 2) Apri la connessione WebSocket persistente
        _running = true;
        _cts = new CancellationTokenSource();
        _ = Task.Run(() => ConnectionLoop(_cts.Token));
        return true;
    }

    private async Task ConnectionLoop(CancellationToken ct)
    {
        while (_running && !ct.IsCancellationRequested)
        {
            try
            {
                _ws = new ClientWebSocket();
                await _ws.ConnectAsync(new Uri(WS_URL), ct);

                // join come 'bridge'
                await SendJson(new { type = "join", code = _roomCode, role = "bridge" }, ct);
                _joined = true;
                IsConnected = true;
                OnStatusChange?.Invoke(true, null);

                // loop di ricezione (comandi dalla regia)
                var buf = new byte[8192];
                var sb = new StringBuilder();
                while (_running && _ws.State == WebSocketState.Open && !ct.IsCancellationRequested)
                {
                    sb.Clear();
                    WebSocketReceiveResult res;
                    do
                    {
                        res = await _ws.ReceiveAsync(new ArraySegment<byte>(buf), ct);
                        if (res.MessageType == WebSocketMessageType.Close)
                        {
                            await _ws.CloseAsync(WebSocketCloseStatus.NormalClosure, "", ct);
                            break;
                        }
                        sb.Append(Encoding.UTF8.GetString(buf, 0, res.Count));
                    } while (!res.EndOfMessage);

                    if (sb.Length > 0) HandleMessage(sb.ToString());
                }
            }
            catch (OperationCanceledException) { break; }
            catch (Exception e)
            {
                IsConnected = false;
                _joined = false;
                OnStatusChange?.Invoke(false, e.Message);
            }

            IsConnected = false;
            _joined = false;

            // reconnect dopo 2s, se ancora attivo
            if (_running && !ct.IsCancellationRequested)
            {
                OnStatusChange?.Invoke(false, "Riconnessione...");
                try { await Task.Delay(2000, ct); } catch { break; }
            }
        }
    }

    private void HandleMessage(string raw)
    {
        try
        {
            using var doc = JsonDocument.Parse(raw);
            var root = doc.RootElement;
            if (!root.TryGetProperty("type", out var tEl)) return;
            var type = tEl.GetString();

            // comando dalla regia: { type:"bridgeCommand", command:{ function, params, ts } }
            if (type == "bridgeCommand" && root.TryGetProperty("command", out var cmd))
            {
                var func = cmd.TryGetProperty("function", out var fEl) ? fEl.GetString() ?? "" : "";
                Dictionary<string, string>? parms = null;
                if (cmd.TryGetProperty("params", out var pEl) && pEl.ValueKind == JsonValueKind.Object)
                {
                    parms = new();
                    foreach (var p in pEl.EnumerateObject())
                        parms[p.Name] = p.Value.ValueKind == JsonValueKind.String
                            ? p.Value.GetString() ?? ""
                            : p.Value.ToString();
                }
                if (!string.IsNullOrEmpty(func))
                    OnCommand?.Invoke(func, parms);
            }
        }
        catch { }
    }

    /// <summary>Invia i tally mappati al VPS (patch = merge lato server)</summary>
    public async Task WriteTally(Dictionary<string, string> tallies, Dictionary<string, string> camNames)
    {
        if (!IsConnected || !_joined || _ws?.State != WebSocketState.Open) return;
        try
        {
            var msg = new
            {
                type = "patch",
                data = new Dictionary<string, object>
                {
                    ["tallies"] = tallies,
                    ["camNames"] = camNames
                    // _bridge lo timbra il server automaticamente per role=bridge
                }
            };
            await SendJson(msg, _cts?.Token ?? CancellationToken.None);
        }
        catch { }
    }

    private async Task SendJson(object obj, CancellationToken ct)
    {
        if (_ws?.State != WebSocketState.Open) return;
        var json = JsonSerializer.Serialize(obj);
        var bytes = Encoding.UTF8.GetBytes(json);
        await _ws.SendAsync(new ArraySegment<byte>(bytes), WebSocketMessageType.Text, true, ct);
    }

    public void Disconnect()
    {
        _running = false;
        _joined = false;
        IsConnected = false;
        try { _cts?.Cancel(); } catch { }
        try { _ws?.Abort(); } catch { }
        OnStatusChange?.Invoke(false, null);
    }

    public void Dispose()
    {
        Disconnect();
        try { _cts?.Dispose(); } catch { }
        try { _ws?.Dispose(); } catch { }
        _http.Dispose();
    }
}
