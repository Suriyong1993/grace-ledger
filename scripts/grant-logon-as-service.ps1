# Grants SeServiceLogonRight ("Log on as a service") to a local account via the
# LSA API. Required before a per-user Windows service can start (net start error
# 1069 otherwise). Must run elevated.

param(
  [Parameter(Mandatory = $true)][string]$AccountName
)

$ErrorActionPreference = "Stop"

# Normalize to the fully qualified local name (".\user" or "user" forms fail
# NTAccount resolution; the machine-qualified form does not).
if ($AccountName -like ".\*") {
  $AccountName = "$env:COMPUTERNAME\$($AccountName.Substring(2))"
} elseif ($AccountName -notlike "*\*") {
  $AccountName = "$env:COMPUTERNAME\$AccountName"
}
Write-Host "Resolving account: $AccountName"

$ntAccount = New-Object System.Security.Principal.NTAccount($AccountName)
$sidObj = $ntAccount.Translate([System.Security.Principal.SecurityIdentifier])
$sidValue = $sidObj.Value
Write-Host "Granting SeServiceLogonRight to $AccountName (SID $sidValue)"

Add-Type -TypeDefinition @"
using System;
using System.Text;
using System.Runtime.InteropServices;

public class GlLsa
{
    [StructLayout(LayoutKind.Sequential)]
    private struct LSA_OBJECT_ATTRIBUTES
    {
        public int Length;
        public IntPtr RootDirectory;
        public IntPtr ObjectName;
        public int Attributes;
        public IntPtr SecurityDescriptor;
        public IntPtr SecurityQualityOfService;
    }

    [StructLayout(LayoutKind.Sequential)]
    private struct LSA_UNICODE_STRING
    {
        public ushort Length;
        public ushort MaximumLength;
        public IntPtr Buffer;
    }

    [DllImport("advapi32.dll", SetLastError = true)]
    private static extern uint LsaOpenPolicy(IntPtr systemName, ref LSA_OBJECT_ATTRIBUTES oa, uint access, out IntPtr policy);

    [DllImport("advapi32.dll", SetLastError = true)]
    private static extern uint LsaAddAccountRights(IntPtr policy, byte[] sid, LSA_UNICODE_STRING[] rights, uint count);

    [DllImport("advapi32.dll")]
    private static extern uint LsaClose(IntPtr policy);

    private static LSA_UNICODE_STRING ToLsaString(string value)
    {
        byte[] bytes = Encoding.Unicode.GetBytes(value);
        IntPtr buffer = Marshal.AllocHGlobal(bytes.Length);
        Marshal.Copy(bytes, 0, buffer, bytes.Length);
        return new LSA_UNICODE_STRING { Length = (ushort)bytes.Length, MaximumLength = (ushort)(bytes.Length + 2), Buffer = buffer };
    }

    public static void Grant(string sidValue, string right)
    {
        var sid = new System.Security.Principal.SecurityIdentifier(sidValue);
        byte[] sidBytes = new byte[sid.BinaryLength];
        sid.GetBinaryForm(sidBytes, 0);

        var oa = new LSA_OBJECT_ATTRIBUTES();
        oa.Length = Marshal.SizeOf(oa);

        IntPtr policy;
        uint status = LsaOpenPolicy(IntPtr.Zero, ref oa, 0x000F0FFF, out policy); // POLICY_ALL_ACCESS
        if (status != 0) throw new Exception("LsaOpenPolicy failed: 0x" + status.ToString("X"));
        try
        {
            var rights = new LSA_UNICODE_STRING[] { ToLsaString(right) };
            status = LsaAddAccountRights(policy, sidBytes, rights, 1);
            if (status != 0) throw new Exception("LsaAddAccountRights failed: 0x" + status.ToString("X"));
        }
        finally
        {
            LsaClose(policy);
        }
    }
}
"@

[GlLsa]::Grant($sidValue, "SeServiceLogonRight")
Write-Host "SeServiceLogonRight granted."
