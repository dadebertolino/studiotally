using System.Text;
using System.Text.Json;

namespace StudioTallyBridge;

public class FirebaseClient : IDisposable
{
    private readonly HttpClient _http = new() { Timeout = TimeSpan.FromSeconds(5) };
    private const string DB_URL = "https://broadcast-timer-608e4-default-rtdb.europe-west1.firebasedatabase.app";

    private string _roomCode = "";
    private System.Threading.Timer? _cmdTimer;
    private long _lastCmdTs;

    public bool IsConnected { get; private set; }

    public event Action<string, Dictionary<string, string>?>? OnCommand;
    public event Action<bool, string?>? OnStatusChange;

    public async Task<bool> Connect(string roomCode)
    {
        _roomCode = roomCode;
        try
        {
            var resp = await _http.GetAsync($"{DB_URL}/rooms/{roomCode}/masterUid.json");
            var body = await resp.Content.ReadAsStringAsync();
            if (body == "null" || !resp.IsSuccessStatusCode)
            {
                OnStatusChange?.Invoke(false, "Stanza non trovata");
                return false;
            }

            IsConnected = true;
            _lastCmdTs = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();
            OnStatusChange?.Invoke(true, null);

            _cmdTimer = new System.Threading.Timer(async _ => await PollCommands(), null, 1000, 1000);
            return true;
        }
        catch (Exception ex)
        {
            OnStatusChange?.Invoke(false, ex.Message);
            return false;
        }
    }

    public void Disconnect()
    {
        _cmdTimer?.Dispose();
        _cmdTimer = null;
        IsConnected = false;
        OnStatusChange?.Invoke(false, null);
    }

    /// <summary>Write mapped tally + camera names to Firebase state (PATCH = merge)</summary>
    public async Task WriteTally(Dictionary<string, string> tallies, Dictionary<string, string> camNames)
    {
        if (!IsConnected || string.IsNullOrEmpty(_roomCode)) return;
        try
        {
            var payload = new Dictionary<string, object>
            {
                ["tallies"] = tallies,
                ["camNames"] = camNames,
                ["_bridge"] = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds()
            };

            var json = JsonSerializer.Serialize(payload);
            var content = new StringContent(json, Encoding.UTF8, "application/json");
            var req = new HttpRequestMessage(new HttpMethod("PATCH"),
                $"{DB_URL}/rooms/{_roomCode}/state.json")
            { Content = content };
            await _http.SendAsync(req);
        }
        catch { }
    }

    private async Task PollCommands()
    {
        if (!IsConnected) return;
        try
        {
            var resp = await _http.GetAsync($"{DB_URL}/rooms/{_roomCode}/bridgeCommands.json");
            var body = await resp.Content.ReadAsStringAsync();
            if (body == "null" || string.IsNullOrEmpty(body)) return;

            var cmds = JsonSerializer.Deserialize<Dictionary<string, JsonElement>>(body);
            if (cmds == null) return;

            foreach (var kv in cmds)
            {
                var ts = kv.Value.TryGetProperty("ts", out var tsEl) ? tsEl.GetInt64() : 0;
                if (ts <= _lastCmdTs) continue;
                _lastCmdTs = ts;

                var func = kv.Value.TryGetProperty("function", out var fEl) ? fEl.GetString() ?? "" : "";
                Dictionary<string, string>? parms = null;
                if (kv.Value.TryGetProperty("params", out var pEl) && pEl.ValueKind == JsonValueKind.Object)
                {
                    parms = new();
                    foreach (var p in pEl.EnumerateObject())
                        parms[p.Name] = p.Value.GetString() ?? "";
                }

                if (!string.IsNullOrEmpty(func))
                    OnCommand?.Invoke(func, parms);
            }

            _ = _http.DeleteAsync($"{DB_URL}/rooms/{_roomCode}/bridgeCommands.json");
        }
        catch { }
    }

    public void Dispose()
    {
        _cmdTimer?.Dispose();
        _http.Dispose();
    }
}
