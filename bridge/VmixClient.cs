using System.Xml.Linq;

namespace StudioTallyBridge;

public class VmixInput
{
    public int Number { get; set; }
    public string Key { get; set; } = "";
    public string Title { get; set; } = "";
    public string TallyState { get; set; } = "off"; // "program" | "preview" | "off"
}

public class VmixClient : IDisposable
{
    private readonly HttpClient _http = new() { Timeout = TimeSpan.FromSeconds(3) };
    private string _baseUrl = "";
    private System.Threading.Timer? _timer;
    private string _lastTallyJson = "";

    public bool IsConnected { get; private set; }
    public string? LastError { get; private set; }
    public List<VmixInput> Inputs { get; private set; } = new();

    /// <summary>Fires when tally changes. Provides full input list with tally state.</summary>
    public event Action<List<VmixInput>>? OnTallyUpdate;

    /// <summary>Fires when input list changes (first connect or inputs added/removed).</summary>
    public event Action<List<VmixInput>>? OnInputsDiscovered;

    public event Action<bool, string?>? OnStatusChange;

    public void Connect(string ip, int port = 8088)
    {
        _baseUrl = $"http://{ip}:{port}";
        LastError = null;
        _lastTallyJson = "";
        Inputs.Clear();

        _timer?.Dispose();
        _timer = new System.Threading.Timer(async _ => await Poll(), null, 0, 300);
    }

    public void Disconnect()
    {
        _timer?.Dispose();
        _timer = null;
        IsConnected = false;
        Inputs.Clear();
        OnStatusChange?.Invoke(false, null);
    }

    private async Task Poll()
    {
        try
        {
            var xml = await _http.GetStringAsync($"{_baseUrl}/api");
            var doc = XDocument.Parse(xml);
            var vmix = doc.Root;
            if (vmix == null) return;

            int.TryParse(vmix.Element("active")?.Value ?? "0", out var activeNum);
            int.TryParse(vmix.Element("preview")?.Value ?? "0", out var previewNum);

            var xmlInputs = vmix.Descendants("input").ToList();
            var newInputs = new List<VmixInput>();

            for (int i = 0; i < xmlInputs.Count; i++)
            {
                var num = i + 1;
                var title = xmlInputs[i].Attribute("title")?.Value
                         ?? xmlInputs[i].Attribute("shortTitle")?.Value
                         ?? $"Input {num}";
                var key = xmlInputs[i].Attribute("key")?.Value ?? "";

                newInputs.Add(new VmixInput
                {
                    Number = num,
                    Key = key,
                    Title = title,
                    TallyState = num == activeNum ? "program" : num == previewNum ? "preview" : "off"
                });
            }

            // Check if input list changed
            var inputListChanged = newInputs.Count != Inputs.Count
                || newInputs.Zip(Inputs).Any(pair => pair.First.Title != pair.Second.Title);

            Inputs = newInputs;

            if (inputListChanged)
                OnInputsDiscovered?.Invoke(newInputs);

            // Check tally change
            var tallyJson = string.Join(",", newInputs.Select(i => $"{i.Number}:{i.TallyState}"));
            if (tallyJson != _lastTallyJson)
            {
                _lastTallyJson = tallyJson;
                OnTallyUpdate?.Invoke(newInputs);
            }

            if (!IsConnected)
            {
                IsConnected = true;
                LastError = null;
                OnStatusChange?.Invoke(true, null);
            }
        }
        catch (Exception ex)
        {
            if (IsConnected)
            {
                IsConnected = false;
                LastError = ex.Message;
                OnStatusChange?.Invoke(false, ex.Message);
            }
        }
    }

    public async Task SendCommand(string function, Dictionary<string, string>? parameters = null)
    {
        if (string.IsNullOrEmpty(_baseUrl)) return;
        try
        {
            var qs = $"Function={Uri.EscapeDataString(function)}";
            if (parameters != null)
                foreach (var kv in parameters)
                    qs += $"&{Uri.EscapeDataString(kv.Key)}={Uri.EscapeDataString(kv.Value)}";
            await _http.GetAsync($"{_baseUrl}/api?{qs}");
        }
        catch { }
    }

    public void Dispose()
    {
        _timer?.Dispose();
        _http.Dispose();
    }
}
