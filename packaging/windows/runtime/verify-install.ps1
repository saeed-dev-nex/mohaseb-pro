# Mohaseb Pro - post-install verification.
# Polls the local app URL until the service answers (first start runs
# database initialisation + migrations, which can take a while), then
# tells the user the outcome with a message box. Without this step a
# failed install looks exactly like a successful one: a desktop
# shortcut pointing at a dead page. Always exits 0.

param(
    [string]$Url = 'http://127.0.0.1:4173/',
    [int]$TimeoutSec = 150
)

$deadline = (Get-Date).AddSeconds($TimeoutSec)
$ok = $false
while ((Get-Date) -lt $deadline) {
    try {
        $resp = Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 5
        if ($resp.StatusCode -ge 200 -and $resp.StatusCode -lt 500) { $ok = $true; break }
    }
    catch { }
    Start-Sleep -Seconds 3
}

Add-Type -AssemblyName System.Windows.Forms
if ($ok) {
    [System.Windows.Forms.MessageBox]::Show(
        'محاسب پرو نصب و اجرا شد. از میانبر روی دسکتاپ یا منوی استارت می‌توانید وارد برنامه شوید.',
        'محاسب پرو', 'OK', 'Information') | Out-Null
}
else {
    $logs = Join-Path $env:ProgramData 'MohasebPro\logs'
    [System.Windows.Forms.MessageBox]::Show(
        "سرویس محاسب پرو هنوز پاسخ نمی‌دهد. چند دقیقه صبر کنید و میانبر را دوباره امتحان کنید؛ اگر درست نشد، از منوی استارت «عیب‌یابی محاسب پرو» را اجرا کنید و فایل ساخته‌شده روی دسکتاپ را برای پشتیبانی بفرستید.`n`nپوشهٔ لاگ‌ها: $logs",
        'محاسب پرو', 'OK', 'Warning') | Out-Null
}
exit 0
