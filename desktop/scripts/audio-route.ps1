# OAB Studio – Windows playback device helper
#   audio-route.ps1 list          -> JSON list of active playback devices {id,name,default}
#   audio-route.ps1 set <id>      -> makes <id> the default playback device (all roles)
param([string]$cmd = 'list', [string]$id = '')
$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;
namespace OAB {
  [Guid("f8679f50-850a-41cf-9c72-430f290290c8"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
  interface IPolicyConfig {
    [PreserveSig] int GetMixFormat([MarshalAs(UnmanagedType.LPWStr)] string a, IntPtr b);
    [PreserveSig] int GetDeviceFormat([MarshalAs(UnmanagedType.LPWStr)] string a, int b, IntPtr c);
    [PreserveSig] int ResetDeviceFormat([MarshalAs(UnmanagedType.LPWStr)] string a);
    [PreserveSig] int SetDeviceFormat([MarshalAs(UnmanagedType.LPWStr)] string a, IntPtr b, IntPtr c);
    [PreserveSig] int GetProcessingPeriod([MarshalAs(UnmanagedType.LPWStr)] string a, int b, IntPtr c, IntPtr d);
    [PreserveSig] int SetProcessingPeriod([MarshalAs(UnmanagedType.LPWStr)] string a, IntPtr b);
    [PreserveSig] int GetShareMode([MarshalAs(UnmanagedType.LPWStr)] string a, IntPtr b);
    [PreserveSig] int SetShareMode([MarshalAs(UnmanagedType.LPWStr)] string a, IntPtr b);
    [PreserveSig] int GetPropertyValue([MarshalAs(UnmanagedType.LPWStr)] string a, IntPtr b, IntPtr c);
    [PreserveSig] int SetPropertyValue([MarshalAs(UnmanagedType.LPWStr)] string a, IntPtr b, IntPtr c);
    [PreserveSig] int SetDefaultEndpoint([MarshalAs(UnmanagedType.LPWStr)] string id, int role);
    [PreserveSig] int SetEndpointVisibility([MarshalAs(UnmanagedType.LPWStr)] string a, int b);
  }
  [ComImport, Guid("870af99c-171d-4f9e-af0d-e63df40c2bc9")] class CPolicyConfigClient {}

  [Guid("D666063F-1587-4E43-81F1-B948E807363F"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
  interface IMMDevice {
    [PreserveSig] int Activate(ref Guid iid, int ctx, IntPtr p, out IntPtr o);
    [PreserveSig] int OpenPropertyStore(int access, out IntPtr store);
    [PreserveSig] int GetId([MarshalAs(UnmanagedType.LPWStr)] out string id);
  }
  [Guid("A95664D2-9614-4F35-A746-DE8DB63617E6"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
  interface IMMDeviceEnumerator {
    [PreserveSig] int EnumAudioEndpoints(int flow, int mask, out IntPtr devices);
    [PreserveSig] int GetDefaultAudioEndpoint(int flow, int role, out IMMDevice device);
  }
  [ComImport, Guid("BCDE0395-E52F-467C-8E3D-C4579291692E")] class MMDeviceEnumerator {}

  public static class Audio {
    public static string GetDefault() {
      var en = (IMMDeviceEnumerator)(new MMDeviceEnumerator());
      IMMDevice d; if (en.GetDefaultAudioEndpoint(0, 1, out d) != 0 || d == null) return "";
      string id; d.GetId(out id); return id ?? "";
    }
    public static int SetDefault(string id) {
      var pc = (IPolicyConfig)(new CPolicyConfigClient());
      int r = 0; for (int role = 0; role < 3; role++) r |= pc.SetDefaultEndpoint(id, role); return r;
    }
  }
}
"@

if ($cmd -eq 'set') {
  $r = [OAB.Audio]::SetDefault($id)
  @{ ok = ($r -eq 0); code = $r } | ConvertTo-Json -Compress
  exit
}

$def = [OAB.Audio]::GetDefault()
$root = 'HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\MMDevices\Audio\Render'
$list = @()
foreach ($k in Get-ChildItem $root) {
  try {
    $state = (Get-ItemProperty $k.PSPath -Name DeviceState).DeviceState
    if ($state -ne 1) { continue }
    $p = Get-ItemProperty (Join-Path $k.PSPath 'Properties')
    $name = $p.'{a45c254e-df1c-4efd-8020-67d146a850e0},2'
    $iface = $p.'{b3f8fa53-0004-438e-9003-51a46e139bfc},6'
    $full = if ($iface) { "$name ($iface)" } else { "$name" }
    $devId = '{0.0.0.00000000}.' + $k.PSChildName.ToLower()
    $list += [pscustomobject]@{ id = $devId; name = $full; default = ($devId -eq $def.ToLower()) }
  } catch { }
}
@{ default = $def; devices = $list } | ConvertTo-Json -Compress -Depth 4
