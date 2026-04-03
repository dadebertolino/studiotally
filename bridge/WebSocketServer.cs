using System.Collections.Concurrent;
using System.Net;
using System.Net.NetworkInformation;
using System.Net.Sockets;
using System.Net.WebSockets;
using System.Text;
using System.Text.Json;

namespace StudioTallyBridge;

/// <summary>
/// WebSocket server for LAN mode.
/// - Broadcasts state (tally, timers, messages) to all connected phones
/// - Receives commands from phones (CUT, FADE, etc.)
/// - Also serves as HTTP server for PWA static files
/// </summary>
public class WebSocketServer : IDisposable
{
    private HttpListener? _listener;
    private readonly ConcurrentDictionary<string, WebSocket> _clients = new();
    private CancellationTokenSource? _cts;
    private string _currentState = "{}";
    private int _clientCounter;

    public int Port { get; private set; }
    public bool IsRunning { get; private set; }
    public int ClientCount => _clients.Count;

    /// <summary>Fires when a command comes from a phone</summary>
    public event Action<string, Dictionary<string, string>?>? OnCommand;

    /// <summary>Fires when client count changes</summary>
    public event Action<int>? OnClientCountChanged;

    /// <summary>Fires for logging</summary>
    public event Action<string>? OnLog;

    /// <summary>Get all LAN IPs of this machine</summary>
    public static List<string> GetLocalIPs()
    {
        var ips = new List<string>();
        try
        {
            foreach (var ni in NetworkInterface.GetAllNetworkInterfaces())
            {
                if (ni.OperationalStatus != OperationalStatus.Up) continue;
                if (ni.NetworkInterfaceType == NetworkInterfaceType.Loopback) continue;
                foreach (var addr in ni.GetIPProperties().UnicastAddresses)
                {
                    if (addr.Address.AddressFamily == AddressFamily.InterNetwork)
                        ips.Add(addr.Address.ToString());
                }
            }
        }
        catch { }
        return ips;
    }

    public void Start(int port = 9900)
    {
        Port = port;
        _cts = new CancellationTokenSource();

        _listener = new HttpListener();
        _listener.Prefixes.Add($"http://+:{port}/");

        // Ensure firewall allows incoming connections
        EnsureFirewallRule(port);

        try
        {
            _listener.Start();
            IsRunning = true;
            OnLog?.Invoke($"WebSocket server su porta {port}");
            Task.Run(() => AcceptLoop(_cts.Token));
        }
        catch (HttpListenerException)
        {
            // Try to add URL reservation automatically (requires elevation)
            OnLog?.Invoke("Richiesta permessi per aprire la porta...");
            if (TryAddUrlReservation(port))
            {
                try
                {
                    _listener.Start();
                    IsRunning = true;
                    OnLog?.Invoke($"WebSocket server su porta {port} (permessi configurati)");
                    Task.Run(() => AcceptLoop(_cts.Token));
                }
                catch (Exception ex2)
                {
                    OnLog?.Invoke($"Errore avvio server: {ex2.Message}");
                    IsRunning = false;
                }
            }
            else
            {
                OnLog?.Invoke("Impossibile configurare i permessi. Riavvia come Amministratore.");
                IsRunning = false;
            }
        }
    }

    public void Stop()
    {
        IsRunning = false;
        _cts?.Cancel();

        foreach (var kv in _clients)
        {
            try { kv.Value.CloseAsync(WebSocketCloseStatus.NormalClosure, "shutdown", CancellationToken.None).Wait(1000); }
            catch { }
        }
        _clients.Clear();

        try { _listener?.Stop(); } catch { }
        _listener = null;
        OnClientCountChanged?.Invoke(0);
    }

    /// <summary>Broadcast state to all connected clients</summary>
    public void BroadcastState(object state)
    {
        // Add client count to state
        if (state is Dictionary<string, object> dict)
            dict["_clients"] = _clients.Count;

        var json = JsonSerializer.Serialize(state);
        _currentState = json;

        var bytes = Encoding.UTF8.GetBytes(json);
        var segment = new ArraySegment<byte>(bytes);

        var dead = new List<string>();
        foreach (var kv in _clients)
        {
            try
            {
                if (kv.Value.State == WebSocketState.Open)
                    kv.Value.SendAsync(segment, WebSocketMessageType.Text, true, CancellationToken.None).Wait(500);
                else
                    dead.Add(kv.Key);
            }
            catch { dead.Add(kv.Key); }
        }

        foreach (var id in dead)
        {
            _clients.TryRemove(id, out _);
            OnClientCountChanged?.Invoke(_clients.Count);
        }
    }

    private async Task AcceptLoop(CancellationToken ct)
    {
        while (!ct.IsCancellationRequested && _listener != null)
        {
            try
            {
                var ctx = await _listener.GetContextAsync();

                if (ctx.Request.IsWebSocketRequest)
                {
                    _ = Task.Run(() => HandleWebSocket(ctx, ct));
                }
                else
                {
                    // Serve a simple info page or CORS preflight
                    HandleHttpRequest(ctx);
                }
            }
            catch (ObjectDisposedException) { break; }
            catch (HttpListenerException) { break; }
            catch { }
        }
    }

    private async Task HandleWebSocket(HttpListenerContext ctx, CancellationToken ct)
    {
        WebSocket? ws = null;
        var clientId = $"client-{Interlocked.Increment(ref _clientCounter)}";

        try
        {
            var wsCtx = await ctx.AcceptWebSocketAsync(null);
            ws = wsCtx.WebSocket;
            _clients[clientId] = ws;
            OnClientCountChanged?.Invoke(_clients.Count);
            OnLog?.Invoke($"Client connesso: {clientId} ({ctx.Request.RemoteEndPoint})");

            // Send current state immediately
            var stateBytes = Encoding.UTF8.GetBytes(_currentState);
            await ws.SendAsync(new ArraySegment<byte>(stateBytes), WebSocketMessageType.Text, true, ct);

            // Receive loop
            var buffer = new byte[4096];
            while (ws.State == WebSocketState.Open && !ct.IsCancellationRequested)
            {
                var result = await ws.ReceiveAsync(new ArraySegment<byte>(buffer), ct);

                if (result.MessageType == WebSocketMessageType.Close)
                    break;

                if (result.MessageType == WebSocketMessageType.Text)
                {
                    var msg = Encoding.UTF8.GetString(buffer, 0, result.Count);
                    ProcessClientMessage(msg, clientId);
                }
            }
        }
        catch { }
        finally
        {
            _clients.TryRemove(clientId, out _);
            OnClientCountChanged?.Invoke(_clients.Count);
            OnLog?.Invoke($"Client disconnesso: {clientId}");
            if (ws != null)
                try { ws.Dispose(); } catch { }
        }
    }

    /// <summary>Fires when master sends state update (timer, messages, etc.)</summary>
    public event Action<JsonElement>? OnStateFromMaster;

    private void ProcessClientMessage(string json, string clientId)
    {
        try
        {
            var doc = JsonDocument.Parse(json);
            var root = doc.RootElement;

            if (!root.TryGetProperty("type", out var typeEl)) return;
            var type = typeEl.GetString();

            if (type == "command")
            {
                var func = root.TryGetProperty("function", out var fEl) ? fEl.GetString() ?? "" : "";
                Dictionary<string, string>? parms = null;
                if (root.TryGetProperty("params", out var pEl) && pEl.ValueKind == JsonValueKind.Object)
                {
                    parms = new();
                    foreach (var p in pEl.EnumerateObject())
                        parms[p.Name] = p.Value.GetString() ?? "";
                }
                if (!string.IsNullOrEmpty(func))
                {
                    OnLog?.Invoke($"CMD ← {func} ({clientId})");
                    OnCommand?.Invoke(func, parms);
                }
            }
            else if (type == "state")
            {
                // Master PWA is sending state (timers, messages, etc.)
                // Merge into _currentState and rebroadcast
                OnStateFromMaster?.Invoke(root);

                // Parse and merge into current state dict
                var merged = _currentState != "{}"
                    ? JsonSerializer.Deserialize<Dictionary<string, object>>(_currentState) ?? new()
                    : new Dictionary<string, object>();

                foreach (var prop in root.EnumerateObject())
                {
                    if (prop.Name == "type") continue; // skip the type field
                    merged[prop.Name] = prop.Value.Clone();
                }
                merged["_clients"] = _clients.Count;

                var broadcastJson = JsonSerializer.Serialize(merged);
                _currentState = broadcastJson;

                // Broadcast to all clients (including viewers)
                var bytes = Encoding.UTF8.GetBytes(broadcastJson);
                var segment = new ArraySegment<byte>(bytes);
                var dead = new List<string>();
                foreach (var kv in _clients)
                {
                    try
                    {
                        if (kv.Value.State == WebSocketState.Open)
                            kv.Value.SendAsync(segment, WebSocketMessageType.Text, true, CancellationToken.None).Wait(500);
                        else dead.Add(kv.Key);
                    }
                    catch { dead.Add(kv.Key); }
                }
                foreach (var id in dead) { _clients.TryRemove(id, out _); }
                OnClientCountChanged?.Invoke(_clients.Count);
            }
            else if (type == "identify")
            {
                // Just log the role
                var role = root.TryGetProperty("role", out var rEl) ? rEl.GetString() ?? "?" : "?";
                OnLog?.Invoke($"{clientId} identificato come {role}");
            }
        }
        catch { }
    }

    private static readonly Dictionary<string, string> MimeTypes = new()
    {
        [".html"] = "text/html",
        [".js"] = "application/javascript",
        [".css"] = "text/css",
        [".json"] = "application/json",
        [".png"] = "image/png",
        [".svg"] = "image/svg+xml",
        [".ico"] = "image/x-icon",
        [".woff"] = "font/woff",
        [".woff2"] = "font/woff2",
    };

    private string? _wwwRoot;

    private string? FindWwwRoot()
    {
        if (_wwwRoot != null) return _wwwRoot;
        // Look for wwwroot next to the exe
        var exeDir = AppDomain.CurrentDomain.BaseDirectory;
        var candidate = Path.Combine(exeDir, "wwwroot");
        if (Directory.Exists(candidate) && File.Exists(Path.Combine(candidate, "index.html")))
        {
            _wwwRoot = candidate;
            return _wwwRoot;
        }
        // Also check parent dirs (for dev)
        candidate = Path.Combine(exeDir, "..", "wwwroot");
        if (Directory.Exists(candidate) && File.Exists(Path.Combine(candidate, "index.html")))
        {
            _wwwRoot = Path.GetFullPath(candidate);
            return _wwwRoot;
        }
        return null;
    }

    private void HandleHttpRequest(HttpListenerContext ctx)
    {
        var resp = ctx.Response;
        resp.Headers.Add("Access-Control-Allow-Origin", "*");
        resp.Headers.Add("Access-Control-Allow-Methods", "GET, OPTIONS");
        resp.Headers.Add("Access-Control-Allow-Headers", "*");

        if (ctx.Request.HttpMethod == "OPTIONS")
        {
            resp.StatusCode = 204;
            resp.Close();
            return;
        }

        var path = ctx.Request.Url?.AbsolutePath ?? "/";

        // API endpoint
        if (path == "/api/info")
        {
            var info = JsonSerializer.Serialize(new
            {
                app = "StudioTally Bridge",
                mode = "LAN",
                ws = $"ws://{GetLocalIPs().FirstOrDefault() ?? "localhost"}:{Port}/",
                clients = _clients.Count,
            });
            ServeString(resp, info, "application/json");
            return;
        }

        // Serve static files from wwwroot
        var root = FindWwwRoot();
        if (root != null)
        {
            // Map URL to file
            var filePath = path == "/" ? "index.html" : path.TrimStart('/');
            var fullPath = Path.GetFullPath(Path.Combine(root, filePath));

            // Security: ensure it's inside wwwroot
            if (fullPath.StartsWith(root) && File.Exists(fullPath))
            {
                ServeFile(resp, fullPath);
                return;
            }

            // SPA fallback: serve index.html for any non-file route
            var indexPath = Path.Combine(root, "index.html");
            if (File.Exists(indexPath))
            {
                ServeFile(resp, indexPath);
                return;
            }
        }

        // No wwwroot — show connection info page
        var html = $@"<!DOCTYPE html>
<html><head><meta charset=""utf-8""><meta name=""viewport"" content=""width=device-width,initial-scale=1"">
<title>StudioTally LAN</title>
<style>body{{background:#0a0a0f;color:#eee;font-family:Consolas,monospace;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;text-align:center}}
h1{{color:#50fa7b;font-size:2rem;letter-spacing:0.15em}}
.ws{{color:#8be9fd;font-size:1.2rem;margin:16px 0;padding:12px;border:1px solid #1a1a2e;border-radius:6px;background:#0c0c14}}
p{{color:#666;font-size:0.8rem}}</style></head>
<body><div>
<h1>STUDIOTALLY</h1>
<p>BRIDGE LAN ATTIVO</p>
<div class=""ws"">ws://{GetLocalIPs().FirstOrDefault() ?? "localhost"}:{Port}/</div>
<p>{_clients.Count} client connessi</p>
<p style=""margin-top:24px;color:#ffb86c"">Per usare l'app, copia la cartella 'dist' della build React<br>nella cartella 'wwwroot' accanto all'exe del bridge.</p>
</div></body></html>";
        ServeString(resp, html, "text/html");
    }

    private void ServeFile(HttpListenerResponse resp, string filePath)
    {
        try
        {
            var ext = Path.GetExtension(filePath).ToLower();
            resp.ContentType = MimeTypes.GetValueOrDefault(ext, "application/octet-stream");
            var bytes = File.ReadAllBytes(filePath);
            resp.ContentLength64 = bytes.Length;
            resp.OutputStream.Write(bytes, 0, bytes.Length);
        }
        catch { resp.StatusCode = 500; }
        finally { resp.Close(); }
    }

    private void ServeString(HttpListenerResponse resp, string content, string contentType)
    {
        try
        {
            resp.ContentType = contentType + "; charset=utf-8";
            var bytes = Encoding.UTF8.GetBytes(content);
            resp.ContentLength64 = bytes.Length;
            resp.OutputStream.Write(bytes, 0, bytes.Length);
        }
        catch { resp.StatusCode = 500; }
        finally { resp.Close(); }
    }

    /// <summary>Try to add HTTP URL reservation via netsh (triggers UAC prompt)</summary>
    private static bool TryAddUrlReservation(int port)
    {
        try
        {
            var psi = new System.Diagnostics.ProcessStartInfo
            {
                FileName = "netsh",
                Arguments = $"http add urlacl url=http://+:{port}/ user=Everyone",
                Verb = "runas",  // triggers UAC elevation
                UseShellExecute = true,
                CreateNoWindow = true,
                WindowStyle = System.Diagnostics.ProcessWindowStyle.Hidden,
            };
            var proc = System.Diagnostics.Process.Start(psi);
            proc?.WaitForExit(5000);
            return proc?.ExitCode == 0;
        }
        catch
        {
            // User declined UAC or other error
            return false;
        }
    }

    /// <summary>Open Windows Firewall for the port</summary>
    public static void EnsureFirewallRule(int port)
    {
        try
        {
            var psi = new System.Diagnostics.ProcessStartInfo
            {
                FileName = "netsh",
                Arguments = $"advfirewall firewall add rule name=\"StudioTally Bridge\" dir=in action=allow protocol=TCP localport={port}",
                Verb = "runas",
                UseShellExecute = true,
                CreateNoWindow = true,
                WindowStyle = System.Diagnostics.ProcessWindowStyle.Hidden,
            };
            var proc = System.Diagnostics.Process.Start(psi);
            proc?.WaitForExit(5000);
        }
        catch { }
    }

    public void Dispose()
    {
        Stop();
        _cts?.Dispose();
    }
}
