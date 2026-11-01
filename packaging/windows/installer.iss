; Mohaseb Pro — Windows installer (Inno Setup 6)
;
; Build with build_package.ps1 (it stages the payload into dist-stage\
; and passes the app version):  ISCC /DAppVersion=3.5.0 installer.iss
;
; What the end user gets, with no manual steps:
;   * the app + a bundled embedded Python (no system Python needed)
;   * a bundled PostgreSQL, installed as a Windows service under a
;     dedicated low-privilege account (SQLite fallback if that fails)
;   * the app itself as an auto-start Windows service
;   * desktop / start-menu shortcuts that open the app in the browser
; Data lives in {commonappdata}\MohasebPro and survives upgrades and
; uninstalls (program files only are removed).

#ifndef AppVersion
  #define AppVersion "0.0.0"
#endif

#define AppName "Mohaseb Pro"
#define DataDir "{commonappdata}\MohasebPro"

[Setup]
AppId={{7C4A9E2B-5D31-4F6A-9C8E-2B7D1A5F9034}
AppName={#AppName}
AppVersion={#AppVersion}
AppPublisher=Mohaseb Pro
DefaultDirName={autopf}\MohasebPro
DefaultGroupName=Mohaseb Pro
DisableProgramGroupPage=yes
OutputDir=output
OutputBaseFilename=MohasebPro-Setup-{#AppVersion}
Compression=lzma2/max
SolidCompression=yes
PrivilegesRequired=admin
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible
MinVersion=10.0
WizardStyle=modern
; The payload (bundled PostgreSQL + Python + wheels) is a few hundred MB.
DiskSpanning=no

[Tasks]
Name: "lanaccess"; Description: "اجازهٔ دسترسی از رایانه‌های دیگر شبکهٔ داخلی (فایروال)"; GroupDescription: "دسترسی شبکه:"
Name: "desktopicon"; Description: "ایجاد میانبر روی دسکتاپ"; GroupDescription: "میانبرها:"

[Dirs]
Name: "{#DataDir}"; Flags: uninsneveruninstall
Name: "{#DataDir}\logs"; Flags: uninsneveruninstall
Name: "{#DataDir}\media"; Flags: uninsneveruninstall

[Files]
Source: "dist-stage\*"; DestDir: "{app}"; Flags: recursesubdirs createallsubdirs ignoreversion

[Icons]
Name: "{group}\محاسب پرو"; Filename: "http://localhost:4173"
Name: "{group}\عیب‌یابی محاسب پرو"; Filename: "powershell.exe"; \
  Parameters: "-NoProfile -ExecutionPolicy Bypass -File ""{app}\runtime\collect-diagnostics.ps1"""
Name: "{group}\پوشهٔ داده‌ها و پشتیبان"; Filename: "{#DataDir}"
Name: "{group}\حذف نصب محاسب پرو"; Filename: "{uninstallexe}"
Name: "{autodesktop}\محاسب پرو"; Filename: "http://localhost:4173"; Tasks: desktopicon

[Run]
; 1) Provision the database (account, PostgreSQL service, role + db,
;    config.ini). Always exits 0; falls back to SQLite on failure.
Filename: "powershell.exe"; \
  Parameters: "-NoProfile -ExecutionPolicy Bypass -File ""{app}\runtime\setup-database.ps1"" -InstallDir ""{app}"" -DataDir ""{#DataDir}"""; \
  StatusMsg: "در حال راه‌اندازی پایگاه داده…"; Flags: runhidden waituntilterminated
; 2) Install + start the application service.
Filename: "powershell.exe"; \
  Parameters: "-NoProfile -ExecutionPolicy Bypass -File ""{app}\runtime\install-services.ps1"" -InstallDir ""{app}"" -DataDir ""{#DataDir}"""; \
  StatusMsg: "در حال نصب سرویس برنامه…"; Flags: runhidden waituntilterminated
; 2b) Verify the app actually answers, and tell the user the outcome.
;     First start includes cluster initdb + migrations, so this polls
;     for up to ~150 seconds. The script always exits 0.
Filename: "powershell.exe"; \
  Parameters: "-NoProfile -ExecutionPolicy Bypass -File ""{app}\runtime\verify-install.ps1"""; \
  StatusMsg: "در حال بررسی اجرای سرویس…"; Flags: waituntilterminated
; 3) Optional LAN access through the Windows firewall (private profile).
Filename: "netsh.exe"; \
  Parameters: "advfirewall firewall delete rule name=""Mohaseb Pro"""; \
  Flags: runhidden waituntilterminated; Tasks: lanaccess
Filename: "netsh.exe"; \
  Parameters: "advfirewall firewall add rule name=""Mohaseb Pro"" dir=in action=allow protocol=TCP localport=4173 profile=private"; \
  StatusMsg: "در حال تنظیم فایروال…"; Flags: runhidden waituntilterminated; Tasks: lanaccess
; 4) Offer to open the app. First start can take up to a minute
;    (database initialisation + migrations); a browser refresh is
;    enough if the page is not ready yet.
Filename: "http://localhost:4173"; Description: "باز کردن محاسب پرو (شروع اول ممکن است کمی طول بکشد)"; \
  Flags: postinstall shellexec nowait skipifsilent unchecked

[UninstallRun]
Filename: "powershell.exe"; \
  Parameters: "-NoProfile -ExecutionPolicy Bypass -File ""{app}\runtime\uninstall-services.ps1"" -InstallDir ""{app}"""; \
  Flags: runhidden waituntilterminated; RunOnceId: "RemoveMohasebServices"
Filename: "netsh.exe"; \
  Parameters: "advfirewall firewall delete rule name=""Mohaseb Pro"""; \
  Flags: runhidden waituntilterminated; RunOnceId: "RemoveMohasebFirewallRule"

[Code]
var
  AdminPage: TInputQueryWizardPage;

procedure InitializeWizard;
begin
  AdminPage := CreateInputQueryPage(wpSelectDir,
    'حساب مدیر سیستم',
    'ساخت اولین حساب مدیر محاسب پرو',
    'با این حساب برای اولین بار وارد برنامه می‌شوید. بعداً می‌توانید از داخل برنامه کاربرهای دیگری بسازید.');
  AdminPage.Add('نام کاربری مدیر:', False);
  AdminPage.Add('رمز عبور مدیر:', True);
  AdminPage.Values[0] := 'admin';
end;

function ShouldSkipPage(PageID: Integer): Boolean;
begin
  { On upgrades the admin already exists; the page would be pointless. }
  Result := (PageID = AdminPage.ID) and
    FileExists(ExpandConstant('{#DataDir}\config.ini'));
end;

function NextButtonClick(CurPageID: Integer): Boolean;
var
  Dir: String;
begin
  Result := True;
  if CurPageID = AdminPage.ID then
  begin
    if Trim(AdminPage.Values[0]) = '' then
    begin
      MsgBox('نام کاربری مدیر نمی‌تواند خالی باشد.', mbError, MB_OK);
      Result := False;
      Exit;
    end;
    if Length(AdminPage.Values[1]) < 6 then
    begin
      MsgBox('رمز عبور مدیر باید حداقل ۶ نویسه باشد.', mbError, MB_OK);
      Result := False;
      Exit;
    end;
    { Hand the credentials to setup-database.ps1 via a short-lived file;
      it merges them into config.ini and deletes this file. }
    Dir := ExpandConstant('{#DataDir}');
    ForceDirectories(Dir);
    SaveStringToFile(Dir + '\install-inputs.ini',
      'admin_user=' + Trim(AdminPage.Values[0]) + #13#10 +
      'admin_password=' + AdminPage.Values[1] + #13#10, False);
  end;
end;
