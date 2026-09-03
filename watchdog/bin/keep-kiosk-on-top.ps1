# Purpose: Keep the station's dedicated Chrome kiosk above other desktop apps.
# Context: Chrome's --kiosk flag makes a window fullscreen but does not assign
#   topmost Z-order, so a late-opening PICO or SteamVR window can cover it.
# Responsibility: Wait for the uniquely titled conductor window and mark that
#   window topmost after each Watchdog launch.
# Boundary: This script changes only window Z-order. Watchdog still owns the
#   Chrome process, and kiosk.yaml still owns its browser arguments.

param(
  [string]$WindowTitle = 'Becoming Many',
  [int]$TimeoutSeconds = 30
)

Add-Type @'
using System;
using System.Runtime.InteropServices;
using System.Text;

public static class KioskWindowPosition
{
    private delegate bool EnumWindowsCallback(IntPtr window, IntPtr parameter);

    [DllImport("user32.dll")]
    [return: MarshalAs(UnmanagedType.Bool)]
    private static extern bool EnumWindows(
        EnumWindowsCallback callback,
        IntPtr parameter
    );

    [DllImport("user32.dll")]
    [return: MarshalAs(UnmanagedType.Bool)]
    private static extern bool IsWindowVisible(IntPtr window);

    [DllImport("user32.dll", CharSet = CharSet.Unicode)]
    private static extern int GetWindowText(
        IntPtr window,
        StringBuilder title,
        int maximumCount
    );

    [DllImport("user32.dll", SetLastError = true)]
    [return: MarshalAs(UnmanagedType.Bool)]
    public static extern bool SetWindowPos(
        IntPtr window,
        IntPtr insertAfter,
        int x,
        int y,
        int width,
        int height,
        uint flags
    );

    public static IntPtr FindVisibleWindow(string titlePart)
    {
        IntPtr result = IntPtr.Zero;
        EnumWindows(delegate(IntPtr window, IntPtr parameter)
        {
            if (!IsWindowVisible(window))
            {
                return true;
            }

            StringBuilder title = new StringBuilder(512);
            GetWindowText(window, title, title.Capacity);
            if (title.ToString().IndexOf(
                titlePart,
                StringComparison.OrdinalIgnoreCase
            ) < 0)
            {
                return true;
            }

            result = window;
            return false;
        }, IntPtr.Zero);
        return result;
    }
}
'@

$topmostWindow = [IntPtr](-1)
$keepSize = 0x0001
$keepPosition = 0x0002
$doNotActivate = 0x0010
$showWindow = 0x0040
$positionFlags = $keepSize -bor $keepPosition -bor $doNotActivate -bor $showWindow
$deadline = [DateTime]::UtcNow.AddSeconds($TimeoutSeconds)

do {
  $windowHandle = [KioskWindowPosition]::FindVisibleWindow($WindowTitle)
  if ($windowHandle -ne [IntPtr]::Zero) {
    $positioned = [KioskWindowPosition]::SetWindowPos(
      $windowHandle,
      $topmostWindow,
      0,
      0,
      0,
      0,
      $positionFlags
    )
    if (-not $positioned) {
      $errorCode = [Runtime.InteropServices.Marshal]::GetLastWin32Error()
      Write-Error "[keep-kiosk-on-top] SetWindowPos failed with Windows error $errorCode"
      exit 1
    }

    Write-Output "[keep-kiosk-on-top] kiosk window is topmost"
    exit 0
  }

  Start-Sleep -Milliseconds 250
} while ([DateTime]::UtcNow -lt $deadline)

Write-Error "[keep-kiosk-on-top] no '$WindowTitle' window appeared within ${TimeoutSeconds}s"
exit 1
