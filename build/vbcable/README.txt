Place the standard VB-CABLE package files here before building the installer.
This folder is intentionally empty in source control; the driver is NOT
redistributed in this repository.

What to download
----------------
1. Go to https://vb-audio.com/Cable/  (the official VB-Audio download page).
2. Download "VB-CABLE Driver Pack" (the standard, free VB-CABLE — NOT
   VB-CABLE A+B or C+D, which may not be bundled).
3. Unzip it and copy at least these files into this folder (build/vbcable/):
       VBCABLE_Setup_x64.exe
       VBCABLE_Setup.exe          (optional, for 32-bit Windows)
       VBCABLE_Driver_Pack**\...  (the whole unzipped pack is fine to copy)

The bundled files land at  resources/vbcable/  inside the installed app, where
build/installer.nsh runs  VBCABLE_Setup_x64.exe -i -h  during installation.

Licensing
---------
VB-CABLE is donationware by VB-Audio. Bundling the standard VB-CABLE in a
third-party installer is permitted as long as the end user can identify it as a
VB-Audio product and is able to donate/pay. MicMix shows this attribution in the
installer license page and in Settings > About. See build/LICENSE-notice.txt.
Do not bundle VB-CABLE A+B or C+D.
