; MicMix NSIS customization (electron-builder include).
; The installer runs elevated once. It installs the bundled standard VB-CABLE (VB-Audio) silently,
; restarts Windows Audio so the endpoints appear, and offers a reboot if they need one.
; The app itself is always launched non-elevated; only this installer/uninstaller is elevated.
; In-app updates re-run this installer silently (/S): the driver step is skipped when VB-CABLE is
; already present, and no message boxes are shown in silent mode.

!macro customInstall
  ; VB-CABLE already installed? Its driver service and its own install folder are reliable signs.
  ClearErrors
  ReadRegStr $4 HKLM "SYSTEM\CurrentControlSet\Services\VBAudioVACMME" "ImagePath"
  ${IfNot} ${Errors}
    DetailPrint "MicMix Virtual Mic (VB-CABLE) is already installed; keeping it."
    Goto vbcable_done
  ${EndIf}
  ${If} ${FileExists} "$PROGRAMFILES64\VB\CABLE\VBCABLE_ControlPanel.exe"
    DetailPrint "MicMix Virtual Mic (VB-CABLE) is already installed; keeping it."
    Goto vbcable_done
  ${EndIf}
  DetailPrint "Installing MicMix Virtual Mic (VB-CABLE by VB-Audio Software)..."
  ; Bundled at resources/vbcable/ via extraResources. Standard VB-CABLE only.
  ${If} ${RunningX64}
    StrCpy $0 "$INSTDIR\resources\vbcable\VBCABLE_Setup_x64.exe"
  ${Else}
    StrCpy $0 "$INSTDIR\resources\vbcable\VBCABLE_Setup.exe"
  ${EndIf}
  ${IfNot} ${FileExists} "$0"
    DetailPrint "Bundled VB-CABLE not found. MicMix will guide you through installing it on first launch."
    Goto vbcable_done
  ${EndIf}
  ; -i installs, -h runs it hidden/silent. Windows may still show a one-time driver-signing prompt.
  DetailPrint "Running VB-CABLE silent install..."
  ExecWait '"$0" -i -h' $1
  DetailPrint "VB-CABLE installer exit code: $1"
  ; Restart Windows Audio so CABLE Input/Output show up without a reboot when possible.
  DetailPrint "Restarting Windows Audio service..."
  nsExec::ExecToLog 'net stop audiosrv /y'
  Pop $2
  nsExec::ExecToLog 'net start audiosrv'
  Pop $3
  ; A brand-new virtual audio device often needs a reboot before every app sees it.
  ; Silent (update) installs never get here because the driver already exists, but stay quiet regardless.
  ${IfNot} ${Silent}
    MessageBox MB_YESNO|MB_ICONQUESTION "MicMix Virtual Mic (VB-CABLE) was installed.$\n$\nA restart is recommended so Windows, Discord and games all detect it. Restart now?$\n$\nChoose No to restart later; MicMix will check the device on first launch and guide a Repair if needed." IDNO vbcable_done
    Reboot
  ${EndIf}
  vbcable_done:
!macroend

!macro customUnInstall
  ; Silent uninstalls (the updater replaces the app) never touch the driver.
  ${If} ${Silent}
    Goto keep_vbcable
  ${EndIf}
  MessageBox MB_YESNO|MB_ICONQUESTION "Also remove the MicMix Virtual Mic (VB-CABLE by VB-Audio)?$\n$\nChoose No to keep it installed for other apps." IDNO keep_vbcable
  ${If} ${RunningX64}
    StrCpy $0 "$INSTDIR\resources\vbcable\VBCABLE_Setup_x64.exe"
  ${Else}
    StrCpy $0 "$INSTDIR\resources\vbcable\VBCABLE_Setup.exe"
  ${EndIf}
  ${IfNot} ${FileExists} "$0"
    Goto keep_vbcable
  ${EndIf}
  DetailPrint "Removing VB-CABLE..."
  ExecWait '"$0" -u -h' $1
  DetailPrint "VB-CABLE uninstaller exit code: $1"
  keep_vbcable:
!macroend
