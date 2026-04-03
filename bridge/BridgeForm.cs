namespace StudioTallyBridge;

public class BridgeForm : Form
{
    // ── Brand ──
    static readonly Color BG = Color.FromArgb(10, 10, 15);
    static readonly Color BG_CARD = Color.FromArgb(12, 12, 20);
    static readonly Color BG_INPUT = Color.FromArgb(8, 8, 14);
    static readonly Color BORDER = Color.FromArgb(26, 26, 46);
    static readonly Color TEXT = Color.FromArgb(200, 200, 210);
    static readonly Color TEXT_DIM = Color.FromArgb(80, 80, 100);
    static readonly Color GREEN = Color.FromArgb(80, 250, 123);
    static readonly Color RED = Color.FromArgb(255, 85, 85);
    static readonly Color CYAN = Color.FromArgb(139, 233, 253);
    static readonly Color AMBER = Color.FromArgb(255, 184, 108);
    static readonly Font FF = new("Consolas", 9f);
    static readonly Font FF_BOLD = new("Consolas", 9f, FontStyle.Bold);
    static readonly Font FF_TITLE = new("Consolas", 16f, FontStyle.Bold);
    static readonly Font FF_SMALL = new("Consolas", 8f);

    // ── State ──
    private enum AppState { Connect, Mapping, Run }
    private AppState _state = AppState.Connect;
    private VmixClient? _vmix;
    private FirebaseClient? _firebase;
    private WebSocketServer? _wsServer;
    private Dictionary<int, string?> _inputMapping = new();
    private bool _pushing;
    private List<VmixInput> _lastInputs = new();
    private bool _lanMode;

    // Current full state for LAN broadcast
    private Dictionary<string, object> _fullState = new();

    // ── Panels ──
    private Panel pnlConnect = null!;
    private Panel pnlMapping = null!;
    private Panel pnlRun = null!;

    // Connect
    private TextBox txtRoom = null!;
    private TextBox txtIp = null!;
    private NumericUpDown numPort = null!;
    private CheckBox chkLan = null!;
    private Panel pnlRoomRow = null!;
    private Button btnConnect = null!;
    private Label lblError = null!;

    // Mapping
    private Label lblMappingInfo = null!;
    private Panel pnlMappingScroll = null!;
    private Button btnStartRun = null!;
    private Button btnBackToConnect = null!;

    // Run
    private Label lblRunInfo = null!;
    private Label lblRunStatus = null!;
    private Label lblLanInfo = null!;
    private FlowLayoutPanel pnlTallyGrid = null!;
    private ListBox lstLog = null!;
    private Panel pnlLogArea = null!;
    private Button btnToggleLog = null!;
    private Button btnStopRun = null!;
    private bool _logVisible;

    public BridgeForm()
    {
        InitializeUI();
        LoadSettings();
        SwitchState(AppState.Connect);
    }

    private void InitializeUI()
    {
        Text = "StudioTally Bridge";
        ClientSize = new Size(460, 580);
        FormBorderStyle = FormBorderStyle.FixedSingle;
        MaximizeBox = false;
        StartPosition = FormStartPosition.CenterScreen;
        BackColor = BG;
        ForeColor = TEXT;

        // ═══ HEADER ═══
        var pnlHeader = new Panel { Dock = DockStyle.Top, Height = 56, BackColor = BG };
        pnlHeader.Controls.Add(new Label { Text = "STUDIOTALLY", Font = FF_TITLE, ForeColor = GREEN, Location = new Point(16, 8), AutoSize = true });
        pnlHeader.Controls.Add(new Label { Text = "BRIDGE · VMIX", Font = FF_SMALL, ForeColor = TEXT_DIM, Location = new Point(18, 33), AutoSize = true });
        pnlHeader.Controls.Add(new Label { Text = "●", Font = new Font("Consolas", 12f), ForeColor = RED, Location = new Point(418, 10), AutoSize = true });
        var lnkInfo = new LinkLabel { Text = "info", Font = FF_SMALL, LinkColor = TEXT_DIM, ActiveLinkColor = CYAN, Location = new Point(414, 34), AutoSize = true };
        lnkInfo.LinkClicked += (s, e) => ShowAbout();
        pnlHeader.Controls.Add(lnkInfo);
        var sep = new Panel { Dock = DockStyle.Top, Height = 1, BackColor = BORDER };

        // ═══ CONNECT ═══
        pnlConnect = new Panel { Dock = DockStyle.Fill, Visible = false };
        var ci = new Panel { Width = 300, Height = 380 };
        ci.Location = new Point(80, 30);

        int y = 0;

        // LAN mode toggle
        chkLan = new CheckBox
        {
            Text = "  MODALITÀ LAN (senza internet)", Font = FF_BOLD, ForeColor = AMBER,
            Location = new Point(0, y), AutoSize = true,
        };
        chkLan.CheckedChanged += (s, e) =>
        {
            _lanMode = chkLan.Checked;
            pnlRoomRow.Visible = !_lanMode;
        };
        ci.Controls.Add(chkLan); y += 32;

        // Room (hidden in LAN mode)
        pnlRoomRow = new Panel { Location = new Point(0, y), Width = 300, Height = 68 };
        pnlRoomRow.Controls.Add(new Label { Text = "STANZA", Font = FF_SMALL, ForeColor = TEXT_DIM, Location = new Point(0, 0), AutoSize = true });
        txtRoom = new TextBox { Location = new Point(0, 18), Width = 300, BackColor = BG_INPUT, ForeColor = CYAN, Font = new Font("Consolas", 16f, FontStyle.Bold), BorderStyle = BorderStyle.FixedSingle, TextAlign = HorizontalAlignment.Center, MaxLength = 5, CharacterCasing = CharacterCasing.Upper };
        pnlRoomRow.Controls.Add(txtRoom);
        ci.Controls.Add(pnlRoomRow); y += 74;

        ci.Controls.Add(new Label { Text = "INDIRIZZO IP VMIX", Font = FF_SMALL, ForeColor = TEXT_DIM, Location = new Point(0, y), AutoSize = true }); y += 18;
        txtIp = new TextBox { Location = new Point(0, y), Width = 300, BackColor = BG_INPUT, ForeColor = TEXT, Font = FF_BOLD, BorderStyle = BorderStyle.FixedSingle, Text = "localhost" }; ci.Controls.Add(txtIp); y += 36;
        ci.Controls.Add(new Label { Text = "PORTA VMIX", Font = FF_SMALL, ForeColor = TEXT_DIM, Location = new Point(0, y), AutoSize = true }); y += 18;
        numPort = new NumericUpDown { Location = new Point(0, y), Width = 90, Minimum = 1, Maximum = 65535, Value = 8088, BackColor = BG_INPUT, ForeColor = TEXT, Font = FF_BOLD, BorderStyle = BorderStyle.FixedSingle }; ci.Controls.Add(numPort); y += 44;

        btnConnect = new Button { Text = "▶  CONNETTI", Location = new Point(0, y), Width = 300, Height = 44, FlatStyle = FlatStyle.Flat, Font = FF_BOLD, BackColor = Color.FromArgb(15, 40, 15), ForeColor = GREEN };
        btnConnect.FlatAppearance.BorderColor = GREEN;
        btnConnect.Click += BtnConnect_Click;
        ci.Controls.Add(btnConnect); y += 54;
        lblError = new Label { Location = new Point(0, y), AutoSize = true, ForeColor = RED, Font = FF_SMALL, MaximumSize = new Size(300, 0) }; ci.Controls.Add(lblError);
        pnlConnect.Controls.Add(ci);

        // ═══ MAPPING ═══
        pnlMapping = new Panel { Dock = DockStyle.Fill, Visible = false, Padding = new Padding(12, 8, 12, 8) };
        lblMappingInfo = new Label { Text = "", Font = FF_SMALL, ForeColor = CYAN, Dock = DockStyle.Top, Height = 26, TextAlign = ContentAlignment.MiddleLeft };
        var lblMapTitle = new Label { Text = "MAPPING INPUT → CAMERA", Font = FF_SMALL, ForeColor = TEXT_DIM, Dock = DockStyle.Top, Height = 20 };
        pnlMappingScroll = new Panel { Dock = DockStyle.Fill, AutoScroll = true, BackColor = BG };
        var mappingBtnPanel = new Panel { Dock = DockStyle.Bottom, Height = 50 };
        btnStartRun = new Button { Text = "▶  AVVIA", Width = 200, Height = 40, FlatStyle = FlatStyle.Flat, Font = FF_BOLD, BackColor = Color.FromArgb(15, 40, 15), ForeColor = GREEN, Location = new Point(30, 5) };
        btnStartRun.FlatAppearance.BorderColor = GREEN;
        btnStartRun.Click += (s, e) => SwitchState(AppState.Run);
        btnBackToConnect = new Button { Text = "← INDIETRO", Width = 140, Height = 40, FlatStyle = FlatStyle.Flat, Font = FF_SMALL, BackColor = BG_CARD, ForeColor = TEXT_DIM, Location = new Point(240, 5) };
        btnBackToConnect.FlatAppearance.BorderColor = BORDER;
        btnBackToConnect.Click += (s, e) => { DisconnectAll(); SwitchState(AppState.Connect); };
        mappingBtnPanel.Controls.AddRange(new Control[] { btnStartRun, btnBackToConnect });
        pnlMapping.Controls.Add(pnlMappingScroll);
        pnlMapping.Controls.Add(lblMapTitle);
        pnlMapping.Controls.Add(lblMappingInfo);
        pnlMapping.Controls.Add(mappingBtnPanel);

        // ═══ RUN ═══
        pnlRun = new Panel { Dock = DockStyle.Fill, Visible = false, Padding = new Padding(12, 8, 12, 8) };
        var runHeader = new Panel { Dock = DockStyle.Top, Height = 50 };
        lblRunInfo = new Label { Text = "", Font = FF_BOLD, ForeColor = CYAN, Location = new Point(0, 2), AutoSize = true };
        lblRunStatus = new Label { Text = "● LIVE", Font = FF_BOLD, ForeColor = GREEN, Location = new Point(350, 2), AutoSize = true };
        lblLanInfo = new Label { Text = "", Font = FF, ForeColor = AMBER, Location = new Point(0, 24), AutoSize = true };
        runHeader.Controls.AddRange(new Control[] { lblRunInfo, lblRunStatus, lblLanInfo });

        pnlTallyGrid = new FlowLayoutPanel { Dock = DockStyle.Fill, AutoScroll = true, FlowDirection = FlowDirection.LeftToRight, BackColor = BG, Padding = new Padding(0, 4, 0, 4) };

        var runBtnPanel = new Panel { Dock = DockStyle.Bottom, Height = 44 };
        btnStopRun = new Button { Text = "■  STOP", Width = 160, Height = 36, FlatStyle = FlatStyle.Flat, Font = FF_SMALL, BackColor = Color.FromArgb(30, 15, 15), ForeColor = RED, Location = new Point(0, 4) };
        btnStopRun.FlatAppearance.BorderColor = Color.FromArgb(80, 30, 30);
        btnStopRun.Click += (s, e) => { _pushing = false; _wsServer?.Stop(); SwitchState(AppState.Mapping); };
        btnToggleLog = new Button { Text = "LOG ▼", Width = 100, Height = 36, FlatStyle = FlatStyle.Flat, Font = FF_SMALL, BackColor = BG_CARD, ForeColor = TEXT_DIM, Location = new Point(170, 4) };
        btnToggleLog.FlatAppearance.BorderColor = BORDER;
        btnToggleLog.Click += (s, e) => ToggleLog();
        runBtnPanel.Controls.AddRange(new Control[] { btnStopRun, btnToggleLog });

        pnlLogArea = new Panel { Dock = DockStyle.Bottom, Height = 0, Visible = false };
        lstLog = new ListBox { Dock = DockStyle.Fill, BackColor = BG_INPUT, ForeColor = TEXT_DIM, Font = FF_SMALL, BorderStyle = BorderStyle.FixedSingle, SelectionMode = SelectionMode.None };
        pnlLogArea.Controls.Add(lstLog);

        pnlRun.Controls.Add(pnlTallyGrid);
        pnlRun.Controls.Add(runHeader);
        pnlRun.Controls.Add(pnlLogArea);
        pnlRun.Controls.Add(runBtnPanel);

        // ═══ ASSEMBLY ═══
        Controls.Add(pnlConnect);
        Controls.Add(pnlMapping);
        Controls.Add(pnlRun);
        Controls.Add(sep);
        Controls.Add(pnlHeader);
    }

    private void ToggleLog()
    {
        _logVisible = !_logVisible;
        pnlLogArea.Visible = _logVisible;
        pnlLogArea.Height = _logVisible ? 140 : 0;
        btnToggleLog.Text = _logVisible ? "LOG ▲" : "LOG ▼";
    }

    private void SwitchState(AppState state)
    {
        _state = state;
        pnlConnect.Visible = state == AppState.Connect;
        pnlMapping.Visible = state == AppState.Mapping;
        pnlRun.Visible = state == AppState.Run;

        if (state == AppState.Run)
        {
            _pushing = true;
            lstLog.Items.Clear();

            if (_lanMode)
            {
                // Start WebSocket server
                _wsServer = new WebSocketServer();
                _wsServer.OnCommand += (func, parms) =>
                {
                    Log($"CMD ← {func} (LAN)");
                    if (_vmix?.IsConnected == true)
                        _ = _vmix.SendCommand(func, parms);
                };
                _wsServer.OnClientCountChanged += count =>
                {
                    BeginInvoke(() => lblRunStatus.Text = $"● LAN · {count} client");
                };
                _wsServer.OnLog += msg => Log(msg);
                _wsServer.Start(9900);

                var ips = WebSocketServer.GetLocalIPs();
                var ipStr = ips.Count > 0 ? string.Join(", ", ips) : "localhost";
                lblRunInfo.Text = "MODALITÀ LAN";
                lblLanInfo.Text = $"ws://{ips.FirstOrDefault() ?? "localhost"}:9900";
                Log($"LAN server avviato — connetti i telefoni a:");
                Log($"  ws://{ips.FirstOrDefault() ?? "localhost"}:9900");
            }
            else
            {
                lblRunInfo.Text = $"STANZA {txtRoom.Text.Trim().ToUpper()}";
                lblLanInfo.Text = "";
            }

            Log("Tally attivo");
            if (_lastInputs.Count > 0)
            {
                UpdateTallyGrid(_lastInputs);
                PushState(_lastInputs);
            }
        }
    }

    private void Log(string msg)
    {
        if (InvokeRequired) { BeginInvoke(() => Log(msg)); return; }
        lstLog.Items.Add($"[{DateTime.Now:HH:mm:ss}] {msg}");
        if (lstLog.Items.Count > 150) lstLog.Items.RemoveAt(0);
        lstLog.TopIndex = lstLog.Items.Count - 1;
    }

    // ── Connect ──
    private async void BtnConnect_Click(object? sender, EventArgs e)
    {
        var ip = txtIp.Text.Trim();
        var port = (int)numPort.Value;
        _lanMode = chkLan.Checked;

        if (string.IsNullOrEmpty(ip)) { lblError.Text = "Inserisci IP vMix"; return; }
        if (!_lanMode)
        {
            var room = txtRoom.Text.Trim().ToUpper();
            if (room.Length < 5) { lblError.Text = "Codice stanza: 5 caratteri"; return; }
        }

        lblError.Text = ""; btnConnect.Enabled = false; btnConnect.Text = "CONNESSIONE...";
        SaveSettings(txtRoom.Text.Trim().ToUpper(), ip, port, _lanMode);

        // Firebase (only if not LAN mode)
        if (!_lanMode)
        {
            var room = txtRoom.Text.Trim().ToUpper();
            _firebase = new FirebaseClient();
            var fbOk = await _firebase.Connect(room);
            if (!fbOk)
            {
                lblError.Text = "Stanza non trovata"; btnConnect.Enabled = true; btnConnect.Text = "▶  CONNETTI";
                _firebase.Dispose(); _firebase = null; return;
            }
            _firebase.OnCommand += async (func, parms) => { Log($"CMD ← {func}"); if (_vmix?.IsConnected == true) await _vmix.SendCommand(func, parms); };
        }

        // vMix
        _vmix = new VmixClient();
        var ready = new TaskCompletionSource<bool>();
        _vmix.OnInputsDiscovered += inputs => { BeginInvoke(() => BuildMappingUI(inputs)); ready.TrySetResult(true); };
        _vmix.OnTallyUpdate += inputs => { _lastInputs = inputs; BeginInvoke(() => HandleTallyUpdate(inputs)); };
        _vmix.OnStatusChange += (ok, err) =>
        {
            if (!ok) { BeginInvoke(() => { lblError.Text = $"vMix: {err}"; btnConnect.Enabled = true; btnConnect.Text = "▶  CONNETTI"; }); ready.TrySetResult(false); }
        };
        _vmix.Connect(ip, port);

        var success = await ready.Task;
        btnConnect.Enabled = true; btnConnect.Text = "▶  CONNETTI";
        if (!success)
        {
            _vmix.Dispose(); _vmix = null;
            _firebase?.Disconnect(); _firebase?.Dispose(); _firebase = null;
            return;
        }
        SwitchState(AppState.Mapping);
    }

    // ── Mapping ──
    private void BuildMappingUI(List<VmixInput> inputs)
    {
        pnlMappingScroll.Controls.Clear();
        _inputMapping.Clear();
        lblMappingInfo.Text = $"{inputs.Count} input da vMix — assegna alle camere o ignora";
        int yPos = 0; int camNum = 1;
        foreach (var input in inputs)
        {
            _inputMapping[input.Number] = $"cam{camNum}";
            var row = new Panel { Location = new Point(0, yPos), Width = 410, Height = 30 };
            row.Controls.Add(new Label { Text = $"[{input.Number}]", Font = FF_SMALL, ForeColor = TEXT_DIM, Location = new Point(0, 5), Width = 32, TextAlign = ContentAlignment.MiddleRight });
            row.Controls.Add(new Label { Text = input.Title, Font = FF, ForeColor = TEXT, Location = new Point(38, 4), Width = 195, AutoEllipsis = true });
            row.Controls.Add(new Label { Text = "→", Font = FF, ForeColor = TEXT_DIM, Location = new Point(238, 4), Width = 20, TextAlign = ContentAlignment.MiddleCenter });
            var combo = new ComboBox { Location = new Point(264, 2), Width = 140, DropDownStyle = ComboBoxStyle.DropDownList, BackColor = BG_INPUT, ForeColor = CYAN, Font = FF_SMALL, FlatStyle = FlatStyle.Flat };
            combo.Items.Add("— ignora —");
            for (int c = 1; c <= Math.Max(inputs.Count, 12); c++) combo.Items.Add($"CAM {c}");
            combo.SelectedIndex = camNum;
            var num = input.Number;
            combo.SelectedIndexChanged += (s, e) => { _inputMapping[num] = combo.SelectedIndex == 0 ? null : $"cam{combo.SelectedIndex}"; };
            row.Controls.Add(combo);
            pnlMappingScroll.Controls.Add(row);
            yPos += 32; camNum++;
        }
    }

    // ── Tally ──
    private void HandleTallyUpdate(List<VmixInput> inputs)
    {
        if (_state == AppState.Run) UpdateTallyGrid(inputs);
        if (_pushing) PushState(inputs);
    }

    private void PushState(List<VmixInput> inputs)
    {
        var tallies = new Dictionary<string, string>();
        var camNames = new Dictionary<string, string>();
        foreach (var input in inputs)
        {
            var mapped = _inputMapping.GetValueOrDefault(input.Number);
            if (mapped == null) continue;
            tallies[mapped] = input.TallyState;
            camNames[mapped] = input.Title;
        }
        if (tallies.Count == 0) return;

        // Push to Firebase (cloud mode)
        if (_firebase?.IsConnected == true)
            _ = _firebase.WriteTally(tallies, camNames);

        // Broadcast to LAN clients
        if (_wsServer?.IsRunning == true)
        {
            // Build full state for LAN clients
            _fullState["tallies"] = tallies;
            _fullState["camNames"] = camNames;
            _fullState["_bridge"] = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();
            _wsServer.BroadcastState(_fullState);
        }
    }

    /// <summary>Called by Master PWA (via LAN WebSocket) to update timers/messages</summary>
    public void UpdateFullState(string key, object value)
    {
        _fullState[key] = value;
    }

    private void UpdateTallyGrid(List<VmixInput> inputs)
    {
        pnlTallyGrid.SuspendLayout();
        pnlTallyGrid.Controls.Clear();
        foreach (var input in inputs)
        {
            var mapped = _inputMapping.GetValueOrDefault(input.Number);
            if (mapped == null) continue;
            var isPgm = input.TallyState == "program";
            var isPvw = input.TallyState == "preview";
            var camLabel = mapped.ToUpper().Replace("CAM", "CAM ");
            var card = new Panel { Width = 205, Height = 62, BackColor = isPgm ? Color.FromArgb(130, 10, 10) : isPvw ? Color.FromArgb(8, 50, 8) : Color.FromArgb(18, 18, 28), Margin = new Padding(3) };
            card.Controls.Add(new Label { Text = camLabel, Font = FF_BOLD, ForeColor = isPgm ? Color.White : isPvw ? Color.FromArgb(180, 255, 180) : TEXT_DIM, Location = new Point(6, 4), AutoSize = true });
            card.Controls.Add(new Label { Text = input.Title, Font = FF_SMALL, ForeColor = isPgm ? Color.FromArgb(255, 200, 200) : isPvw ? Color.FromArgb(180, 230, 180) : TEXT_DIM, Location = new Point(6, 24), Width = 193, AutoEllipsis = true });
            card.Controls.Add(new Label { Text = isPgm ? "● PROGRAM" : isPvw ? "● PREVIEW" : "OFF", Font = FF_BOLD, ForeColor = isPgm ? RED : isPvw ? GREEN : TEXT_DIM, Location = new Point(6, 42), AutoSize = true });
            pnlTallyGrid.Controls.Add(card);
        }
        pnlTallyGrid.ResumeLayout(true);
    }

    private void DisconnectAll()
    {
        _pushing = false;
        _vmix?.Disconnect(); _vmix?.Dispose(); _vmix = null;
        _firebase?.Disconnect(); _firebase?.Dispose(); _firebase = null;
        _wsServer?.Stop(); _wsServer?.Dispose(); _wsServer = null;
        _inputMapping.Clear(); _lastInputs.Clear(); _fullState.Clear();
        pnlMappingScroll.Controls.Clear();
        pnlTallyGrid.Controls.Clear();
    }

    // ── Settings ──
    private string SettingsPath => Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "bridge_settings.txt");
    private void SaveSettings(string room, string ip, int port, bool lan)
    {
        try { File.WriteAllLines(SettingsPath, new[] { room, ip, port.ToString(), lan ? "1" : "0" }); } catch { }
    }
    private void LoadSettings()
    {
        try
        {
            if (!File.Exists(SettingsPath)) return;
            var l = File.ReadAllLines(SettingsPath);
            if (l.Length >= 1) txtRoom.Text = l[0];
            if (l.Length >= 2) txtIp.Text = l[1];
            if (l.Length >= 3 && int.TryParse(l[2], out var p)) numPort.Value = p;
            if (l.Length >= 4 && l[3] == "1") chkLan.Checked = true;
        }
        catch { }
    }

    // ── About ──
    private void ShowAbout()
    {
        var version = System.Reflection.Assembly.GetExecutingAssembly().GetName().Version;
        var verStr = version != null ? $"{version.Major}.{version.Minor}.{version.Build}" : "1.0.0";
        var dlg = new Form { Text = "Info", ClientSize = new Size(320, 220), FormBorderStyle = FormBorderStyle.FixedDialog, MaximizeBox = false, MinimizeBox = false, StartPosition = FormStartPosition.CenterParent, BackColor = BG, ForeColor = TEXT, ShowInTaskbar = false };
        var ok = new Button { Text = "OK", Width = 80, Height = 30, Location = new Point(120, 178), FlatStyle = FlatStyle.Flat, BackColor = BG_CARD, ForeColor = TEXT, Font = FF }; ok.FlatAppearance.BorderColor = BORDER; ok.Click += (s, e) => dlg.Close();
        dlg.Controls.Add(ok);
        dlg.Controls.Add(new Label { Text = "by Dr. Ing Davide Bertolino (Italy)", Font = FF_SMALL, ForeColor = TEXT_DIM, TextAlign = ContentAlignment.MiddleCenter, Dock = DockStyle.Top, Height = 24 });
        var lnk = new LinkLabel { Text = "www.studiotally.com", Font = FF, LinkColor = CYAN, ActiveLinkColor = GREEN, TextAlign = ContentAlignment.MiddleCenter, Dock = DockStyle.Top, Height = 28 };
        lnk.LinkClicked += (s, e) => { try { System.Diagnostics.Process.Start(new System.Diagnostics.ProcessStartInfo("https://www.studiotally.com") { UseShellExecute = true }); } catch { } };
        dlg.Controls.Add(lnk);
        dlg.Controls.Add(new Label { Text = "Bridge vMix per StudioTally\nTally · Timer · Messaggistica\nCloud + LAN", Font = FF_SMALL, ForeColor = TEXT_DIM, TextAlign = ContentAlignment.MiddleCenter, Dock = DockStyle.Top, Height = 48 });
        dlg.Controls.Add(new Label { Text = $"Versione {verStr}", Font = FF, ForeColor = TEXT_DIM, TextAlign = ContentAlignment.MiddleCenter, Dock = DockStyle.Top, Height = 24 });
        dlg.Controls.Add(new Label { Text = "STUDIOTALLY BRIDGE", Font = FF_TITLE, ForeColor = GREEN, TextAlign = ContentAlignment.MiddleCenter, Dock = DockStyle.Top, Height = 40, Padding = new Padding(0, 10, 0, 0) });
        dlg.ShowDialog(this);
    }

    protected override void OnFormClosing(FormClosingEventArgs e) { DisconnectAll(); base.OnFormClosing(e); }
}
