namespace StudioTallyBridge;

static class Program
{
    [STAThread]
    static void Main()
    {
        ApplicationConfiguration.Initialize();
        Application.Run(new BridgeForm());
    }
}
